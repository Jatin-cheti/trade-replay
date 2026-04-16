import { createHash } from "node:crypto";
import { SymbolModel } from "../models/Symbol";
import { redisClient, isRedisReady } from "../config/redis";
import { resolveLogoForSymbol } from "./logo.service";
import { googleFaviconUrl, normalizeDomain, normalizeSymbol, getLogoSourceFromUrl, CRYPTO_ICON_MAP, extractCryptoBaseSymbol } from "./logo.helpers";
import { inferDomainWithConfidence } from "./domainConfidence.service";
import { getHighConfidenceDomain } from "../config/highConfidenceDomainMap";
import { logger } from "../utils/logger";

// ── Types ───────────────────────────────────────────────────────────────

interface BrandRecord {
  brandId: string;
  canonicalDomain: string | null;
  canonicalLogoUrl: string | null;
  logoHash: string | null;
  verified: boolean;
  verifiedAt: Date | null;
  symbolCount: number;
}

interface LogoVerification {
  symbol: string;
  fullSymbol: string;
  status: "correct" | "wrong_domain" | "wrong_logo" | "missing" | "fallback" | "api_key_leak";
  currentIconUrl: string;
  currentDomain: string;
  expectedDomain: string | null;
  fixedIconUrl: string | null;
  fixedDomain: string | null;
  confidence: number;
  reason: string;
}

// ── Brand ID Normalization ──────────────────────────────────────────────

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?|holdings?|group|trust|etf|fund|series\s*\d*)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeBrandId(name: string, symbol: string): string {
  const cleaned = normalizeCompanyName(name);
  const tokens = cleaned.split(" ").filter((t) => t.length >= 2).slice(0, 3);
  if (tokens.length === 0) return normalizeSymbol(symbol).toLowerCase();
  return tokens.join("-");
}

// ── Logo Hash ───────────────────────────────────────────────────────────

export function hashLogoUrl(url: string): string {
  return createHash("sha256").update(url.split("?")[0] || url).digest("hex").slice(0, 16);
}

// ── Domain Authority Check ──────────────────────────────────────────────

const FMP_DOMAIN = "financialmodelingprep.com";
const KNOWN_PROVIDER_DOMAINS = new Set([FMP_DOMAIN, "clearbit.com", "logo.clearbit.com"]);

function isProviderDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  const norm = normalizeDomain(domain);
  return KNOWN_PROVIDER_DOMAINS.has(norm);
}

function hasApiKeyInUrl(url: string): boolean {
  return /[?&]apikey=/i.test(url);
}

function getExpectedDomain(symbol: string, name: string, exchange?: string): string | null {
  const sym = normalizeSymbol(symbol);

  // 1. High-confidence hardcoded map
  const hardcoded = getHighConfidenceDomain(sym);
  if (hardcoded) return normalizeDomain(hardcoded);

  // 2. Verified domain map (domainConfidence)
  const inference = inferDomainWithConfidence({ symbol: sym, name, exchange });
  if (inference.domain && inference.confidence >= 0.95) return normalizeDomain(inference.domain);

  return null;
}

// ── Single Symbol Verification ──────────────────────────────────────────

export function verifySymbolLogo(doc: {
  symbol: string;
  fullSymbol: string;
  name: string;
  type: string;
  exchange?: string;
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
}): LogoVerification {
  const symbol = normalizeSymbol(doc.symbol);
  const currentIcon = doc.iconUrl || "";
  const currentDomain = doc.companyDomain || "";
  const isCrypto = doc.type === "crypto";

  // Missing logo
  if (!currentIcon) {
    return {
      symbol, fullSymbol: doc.fullSymbol, status: "missing",
      currentIconUrl: "", currentDomain, expectedDomain: null,
      fixedIconUrl: null, fixedDomain: null, confidence: 0, reason: "no_icon_url",
    };
  }

  // API key leak in URL
  if (hasApiKeyInUrl(currentIcon)) {
    const expectedDomain = getExpectedDomain(symbol, doc.name, doc.exchange);
    return {
      symbol, fullSymbol: doc.fullSymbol, status: "api_key_leak",
      currentIconUrl: currentIcon, currentDomain, expectedDomain,
      fixedIconUrl: expectedDomain ? googleFaviconUrl(expectedDomain) : null,
      fixedDomain: expectedDomain, confidence: expectedDomain ? 0.99 : 0, reason: "url_contains_api_key",
    };
  }

  // Wrong companyDomain (e.g., financialmodelingprep.com for AAPL)
  if (isProviderDomain(currentDomain)) {
    const expectedDomain = getExpectedDomain(symbol, doc.name, doc.exchange);
    if (expectedDomain) {
      return {
        symbol, fullSymbol: doc.fullSymbol, status: "wrong_domain",
        currentIconUrl: currentIcon, currentDomain, expectedDomain,
        fixedIconUrl: googleFaviconUrl(expectedDomain), fixedDomain: expectedDomain,
        confidence: 0.99, reason: `domain_is_provider_not_company`,
      };
    }
  }

  // Crypto: verify mapped icon
  if (isCrypto) {
    const base = extractCryptoBaseSymbol(symbol).toUpperCase();
    const expected = CRYPTO_ICON_MAP[base];
    if (expected && currentIcon !== expected && !currentIcon.includes("coingecko.com")) {
      return {
        symbol, fullSymbol: doc.fullSymbol, status: "wrong_logo",
        currentIconUrl: currentIcon, currentDomain, expectedDomain: null,
        fixedIconUrl: expected, fixedDomain: null, confidence: 1, reason: "crypto_icon_mismatch",
      };
    }
  }

  // Check if domain matches company (non-crypto, non-derivative)
  if (!isCrypto && doc.type !== "derivative" && doc.type !== "forex") {
    const expectedDomain = getExpectedDomain(symbol, doc.name, doc.exchange);
    if (expectedDomain && currentDomain && normalizeDomain(currentDomain) !== expectedDomain) {
      return {
        symbol, fullSymbol: doc.fullSymbol, status: "wrong_domain",
        currentIconUrl: currentIcon, currentDomain, expectedDomain,
        fixedIconUrl: googleFaviconUrl(expectedDomain), fixedDomain: expectedDomain,
        confidence: 0.98, reason: "domain_mismatch_vs_verified_map",
      };
    }
  }

  return {
    symbol, fullSymbol: doc.fullSymbol, status: "correct",
    currentIconUrl: currentIcon, currentDomain, expectedDomain: currentDomain || null,
    fixedIconUrl: null, fixedDomain: null, confidence: 1, reason: "passed_all_checks",
  };
}

// ── Brand Cache (Redis) ─────────────────────────────────────────────────

const BRAND_KEY_PREFIX = "brand:";
const BRAND_TTL_SECONDS = 86400 * 7; // 7 days

async function getBrandFromRedis(brandId: string): Promise<BrandRecord | null> {
  if (!isRedisReady()) return null;
  try {
    const raw = await redisClient.get(`${BRAND_KEY_PREFIX}${brandId}`);
    if (!raw) return null;
    return JSON.parse(raw) as BrandRecord;
  } catch { return null; }
}

async function setBrandInRedis(brand: BrandRecord): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redisClient.set(`${BRAND_KEY_PREFIX}${brand.brandId}`, JSON.stringify(brand), "EX", BRAND_TTL_SECONDS);
  } catch { /* non-fatal */ }
}

// ── Canonical Brand Resolution ──────────────────────────────────────────

export async function resolveCanonicalBrand(symbol: string, name: string, exchange?: string): Promise<BrandRecord | null> {
  const brandId = computeBrandId(name, symbol);

  // Check Redis first
  const cached = await getBrandFromRedis(brandId);
  if (cached?.verified) return cached;

  // Find any verified sibling with the same brand
  const siblings = await SymbolModel.find({
    $or: [
      { symbol: normalizeSymbol(symbol) },
      { companyDomain: { $ne: "" } },
    ],
  })
    .select({ symbol: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1, logoValidatedAt: 1, name: 1 })
    .sort({ logoValidatedAt: -1 })
    .limit(5)
    .lean<Array<{ symbol: string; iconUrl?: string; s3Icon?: string; companyDomain?: string; logoValidatedAt?: Date; name: string }>>();

  // Find the best sibling with matching brand
  const sameCompany = siblings.filter((s) => computeBrandId(s.name, s.symbol) === brandId);
  const best = sameCompany.find((s) => s.companyDomain && !isProviderDomain(s.companyDomain) && s.iconUrl);

  if (best) {
    const brand: BrandRecord = {
      brandId,
      canonicalDomain: best.companyDomain || null,
      canonicalLogoUrl: best.iconUrl || null,
      logoHash: best.iconUrl ? hashLogoUrl(best.iconUrl) : null,
      verified: Boolean(best.companyDomain && !isProviderDomain(best.companyDomain)),
      verifiedAt: new Date(),
      symbolCount: sameCompany.length,
    };
    await setBrandInRedis(brand);
    return brand;
  }

  return null;
}

// ── Batch Fix Pipeline ──────────────────────────────────────────────────

interface BatchFixResult {
  total: number;
  fixed: number;
  alreadyCorrect: number;
  failed: number;
  apiKeyLeaks: number;
  wrongDomain: number;
  missing: number;
  details: LogoVerification[];
}

export async function verifyAndFixBatch(batchSize = 500, dryRun = false): Promise<BatchFixResult> {
  const docs = await SymbolModel.find({
    type: { $nin: ["derivative"] },
    $or: [
      { iconUrl: { $ne: "" } },
      { iconUrl: "" },
      { iconUrl: null },
    ],
  })
    .select({
      symbol: 1, fullSymbol: 1, name: 1, type: 1, exchange: 1,
      iconUrl: 1, s3Icon: 1, companyDomain: 1, priorityScore: 1,
    })
    .sort({ priorityScore: -1 })
    .limit(batchSize)
    .lean<Array<{
      symbol: string; fullSymbol: string; name: string; type: string; exchange?: string;
      iconUrl?: string; s3Icon?: string; companyDomain?: string;
    }>>();

  const result: BatchFixResult = {
    total: docs.length, fixed: 0, alreadyCorrect: 0, failed: 0,
    apiKeyLeaks: 0, wrongDomain: 0, missing: 0, details: [],
  };

  for (const doc of docs) {
    const verification = verifySymbolLogo(doc);
    result.details.push(verification);

    if (verification.status === "correct") {
      result.alreadyCorrect += 1;
      continue;
    }

    if (verification.status === "missing") {
      result.missing += 1;
      if (!dryRun) {
        try {
          const resolved = await resolveLogoForSymbol({
            symbol: doc.symbol, fullSymbol: doc.fullSymbol, name: doc.name,
            exchange: doc.exchange, type: doc.type, strategy: "normal",
          });
          if (resolved.logoUrl) {
            await SymbolModel.updateOne(
              { fullSymbol: doc.fullSymbol },
              {
                $set: {
                  iconUrl: resolved.logoUrl,
                  companyDomain: resolved.domain || "",
                  logoValidatedAt: new Date(),
                  logoVerificationStatus: "validated",
                },
              },
            );
            result.fixed += 1;
          } else {
            result.failed += 1;
          }
        } catch {
          result.failed += 1;
        }
      }
      continue;
    }

    if (verification.status === "api_key_leak") result.apiKeyLeaks += 1;
    if (verification.status === "wrong_domain") result.wrongDomain += 1;

    if (verification.fixedIconUrl && !dryRun) {
      try {
        await SymbolModel.updateOne(
          { fullSymbol: doc.fullSymbol },
          {
            $set: {
              iconUrl: verification.fixedIconUrl,
              companyDomain: verification.fixedDomain || "",
              logoValidatedAt: new Date(),
              logoVerificationStatus: "validated",
              logoQualityScore: Math.round(verification.confidence * 100),
            },
          },
        );
        result.fixed += 1;
      } catch {
        result.failed += 1;
      }
    } else if (!verification.fixedIconUrl) {
      result.failed += 1;
    }
  }

  logger.info("logo_authority_batch_complete", {
    total: result.total,
    fixed: result.fixed,
    alreadyCorrect: result.alreadyCorrect,
    failed: result.failed,
    apiKeyLeaks: result.apiKeyLeaks,
    wrongDomain: result.wrongDomain,
    missing: result.missing,
  });

  return result;
}

// ── Propagate Brand Logo to all Symbols ─────────────────────────────────

export async function propagateBrandLogo(symbol: string, domain: string, logoUrl: string): Promise<number> {
  const result = await SymbolModel.updateMany(
    {
      symbol: normalizeSymbol(symbol),
      $or: [
        { companyDomain: "" },
        { companyDomain: null },
        { companyDomain: FMP_DOMAIN },
      ],
    },
    {
      $set: {
        iconUrl: logoUrl,
        companyDomain: domain,
        logoValidatedAt: new Date(),
        logoVerificationStatus: "validated",
      },
    },
  );
  return result.modifiedCount;
}
