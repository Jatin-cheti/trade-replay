import { SymbolModel } from "../models/Symbol";
import { inferDomainWithConfidence } from "./domainConfidence.service";
import { classifySymbol, type SymbolClass } from "./symbolClassifier.service";
import { FailureReason, recordResolverDiagnostic } from "./diagnostics.service";
import { getKnownDomain, rememberResolvedDomain } from "./domainMemory.service";
import { getCuratedDomain, saveToDomainDataset } from "./curatedDomainDataset.service";
import { invalidateSymbolCaches } from "./cacheInvalidation.service";
import { recalculatePriorityScores } from "./symbol.service";
import { resolveTrustedDomainMultiSource } from "./domain-intelligence.service";
import { getHighConfidenceDomain } from "../config/highConfidenceDomainMap";

import {
  normalizeDomain,
  normalizeSymbol,
  googleFaviconUrl,
  duckduckgoIconUrl,
  CRYPTO_ICON_MAP,
  extractBaseSymbol,
  extractCryptoBaseSymbol,
  etfFallbackLogoUrl,
  forexFallbackLogoUrl,
  validateLogoUrlDetailed,
} from "./logo.helpers";

import {
  tryFetchFmpLogo,
  tryFetchCoinGeckoLogo,
} from "./logo.providers";

export { tryFetchLogo } from "./logo.providers";

export interface ResolveLogoResult {
  logoUrl: string | null;
  domain: string | null;
  hasDomain: boolean;
  confidence: number;
  classification: SymbolClass;
  reason?: FailureReason;
  attemptedSources: string[];
  source?: string;
}

export async function resolveLogoForSymbol(input: {
  symbol: string;
  fullSymbol?: string;
  name: string;
  exchange?: string;
  companyDomain?: string;
  type?: string;
  country?: string;
  strategy?: "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only";
  minConfidence?: number;
  forceAttempt?: boolean;
}): Promise<ResolveLogoResult> {
  const strategy = input.strategy ?? "normal";
  const strictDomainOnly = strategy === "strict_domain_only";
  const attemptedSources: string[] = [];
  const country = (input.country || "GLOBAL").toUpperCase();
  const baseSymbol = extractBaseSymbol(input.symbol);

  const normalizeCompanyName = (name: string): string => name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const domainRoot = (domain: string): string => normalizeDomain(domain).split(".")[0] || "";

  const domainSimilarity = (domain: string, companyName: string): number => {
    const root = domainRoot(domain);
    if (!root) return 0;
    const tokens = normalizeCompanyName(companyName).split(" ").filter((token) => token.length >= 3);
    if (!tokens.length) return 0;
    const joined = tokens.join("");
    if (joined.includes(root) || root.includes(joined)) return 1;
    const overlaps = tokens.filter((token) => root.includes(token) || token.includes(root));
    return overlaps.length / tokens.length;
  };

  const isGenericDomain = (domain: string): boolean => {
    const root = domainRoot(domain);
    return new Set(["group", "global", "holding", "holdings", "service", "services"]).has(root);
  };

  const isDomainReusedAcrossCompanies = async (domain: string): Promise<boolean> => {
    const normalizedDomain = normalizeDomain(domain);
    const normalizedSymbol = normalizeSymbol(input.symbol);
    const normalizedName = normalizeCompanyName(input.name);
    const rows = await SymbolModel.find({ companyDomain: normalizedDomain, symbol: { $ne: normalizedSymbol } })
      .select({ name: 1 })
      .limit(5)
      .lean<Array<{ name: string }>>();
    return rows.some((row) => normalizeCompanyName(row.name) !== normalizedName);
  };

  const acceptDomain = async (domain: string | null, confidence: number): Promise<boolean> => {
    if (!domain) return false;
    const normalized = normalizeDomain(domain);
    if (!normalized || normalized.length <= 4 || !normalized.includes(".")) return false;
    if (domainRoot(normalized).length <= 1 || isGenericDomain(normalized)) return false;
    const similarity = domainSimilarity(normalized, input.name);
    const keywordMatched = normalizeCompanyName(input.name).split(" ").some((token) => token.length >= 4 && domainRoot(normalized).includes(token));
    if (similarity <= 0.5 && !keywordMatched) return false;
    if (similarity <= 0.55 && confidence < 0.65) return false;
    if (confidence < 0.95 && await isDomainReusedAcrossCompanies(normalized)) return false;
    return true;
  };

  if (baseSymbol && baseSymbol !== input.symbol.toUpperCase()) {
    attemptedSources.push("base-symbol-lookup");
    const baseRecord = await SymbolModel.findOne({
      symbol: baseSymbol,
      $or: [{ iconUrl: { $ne: "" } }, { s3Icon: { $ne: "" } }],
    })
      .sort({ logoValidatedAt: -1 })
      .select({ iconUrl: 1, s3Icon: 1, companyDomain: 1 })
      .lean<{ iconUrl?: string; s3Icon?: string; companyDomain?: string } | null>();

    const reusedIcon = baseRecord?.iconUrl || baseRecord?.s3Icon || "";
    if (reusedIcon.startsWith("http")) {
      const baseCompanyDomain = baseRecord?.companyDomain || null;
      const result: ResolveLogoResult = {
        logoUrl: reusedIcon,
        domain: baseCompanyDomain,
        hasDomain: Boolean(baseCompanyDomain),
        confidence: 0.99,
        classification: "company",
        attemptedSources,
        source: "base-symbol-lookup",
      };
      recordResolverDiagnostic({
        symbol: input.symbol,
        type: input.type || "company",
        country,
        attemptedSources,
        domain: result.domain,
        confidence: result.confidence,
        result: "resolved",
        source: result.source,
      });
      return result;
    }
  }

  const classification = classifySymbol({
    symbol: input.symbol,
    name: input.name,
    exchange: input.exchange,
    type: input.type,
  });

  const normalizedInputType = (input.type || "").toLowerCase();
  const controlledFallbackClass = classification === "forex" || classification === "unknown" || normalizedInputType === "index";

  if (controlledFallbackClass) {
    const source = classification === "forex" ? "forex-fallback" : "fund-fallback";
    attemptedSources.push(source);
    const genericIcon = classification === "forex"
      ? forexFallbackLogoUrl(input.symbol)
      : etfFallbackLogoUrl();
    const result: ResolveLogoResult = {
      logoUrl: genericIcon,
      domain: null,
      hasDomain: false,
      confidence: 1,
      classification,
      attemptedSources,
      source,
    };
    recordResolverDiagnostic({
      symbol: input.symbol,
      type: input.type || classification,
      country,
      attemptedSources,
      domain: result.domain,
      confidence: result.confidence,
      result: "resolved",
      source: result.source,
    });
    return result;
  }

  if (classification === "crypto") {
    const cryptoBase = extractCryptoBaseSymbol(input.symbol).toUpperCase();
    const mappedCryptoIcon = CRYPTO_ICON_MAP[cryptoBase];
    if (mappedCryptoIcon) {
      attemptedSources.push("crypto-static-map");
      return {
        logoUrl: mappedCryptoIcon,
        domain: null,
        hasDomain: false,
        confidence: 1,
        classification,
        attemptedSources,
        source: "crypto-static-map",
      };
    }

    attemptedSources.push("coingecko");
    const coingeckoLogo = await tryFetchCoinGeckoLogo(input.symbol);
    if (coingeckoLogo) {
      return {
        logoUrl: coingeckoLogo,
        domain: null,
        hasDomain: false,
        confidence: 0.95,
        classification,
        attemptedSources,
        source: "coingecko",
      };
    }

    attemptedSources.push("fmp");
    const cryptoFmp = await tryFetchFmpLogo(input.symbol);
    if (cryptoFmp) {
      return {
        logoUrl: cryptoFmp,
        domain: null,
        hasDomain: false,
        confidence: 0.8,
        classification,
        attemptedSources,
        source: "fmp",
      };
    }

    return {
      logoUrl: null,
      domain: null,
      hasDomain: false,
      confidence: 0,
      classification,
      reason: FailureReason.NO_DOMAIN,
      attemptedSources,
    };
  }

  const fullSymbol = input.fullSymbol || `${(input.exchange || "GLOBAL").toUpperCase()}:${input.symbol}`;
  const highConfidenceDomain = getHighConfidenceDomain(input.symbol);
  const curatedDomain = await getCuratedDomain({ symbol: input.symbol, fullSymbol });
  const validatedCuratedDomain = curatedDomain ? normalizeDomain(curatedDomain) : null;

  const confidenceMeta = inferDomainWithConfidence({
    symbol: input.symbol,
    name: input.name,
    exchange: input.exchange,
  });
  const inferredTrustedDomain = confidenceMeta.reason.startsWith("verified")
    ? normalizeDomain(confidenceMeta.domain || "")
    : null;

  const knownDomain = await getKnownDomain(input.symbol);
  const validatedKnownDomain = knownDomain ? normalizeDomain(knownDomain) : null;

  const trustedResolution = await resolveTrustedDomainMultiSource({
    symbol: input.symbol,
    companyName: input.name,
    exchange: input.exchange,
  });
  const trustedDomain = trustedResolution.domain ? normalizeDomain(trustedResolution.domain) : null;
  if (trustedResolution.source) {
    attemptedSources.push(`domain-intelligence:${trustedResolution.source}`);
  }

  const domainCandidates = [
    { domain: highConfidenceDomain ? normalizeDomain(highConfidenceDomain) : null, confidence: 0.995, source: "high-confidence-map" },
    { domain: trustedDomain, confidence: trustedResolution.confidence, source: "domain-intelligence" },
    { domain: validatedCuratedDomain, confidence: 0.99, source: "domain-dataset" },
    { domain: inferredTrustedDomain, confidence: confidenceMeta.confidence, source: "verified-map" },
    { domain: validatedKnownDomain, confidence: 0.95, source: "domain-memory" },
  ].filter((entry): entry is { domain: string; confidence: number; source: string } => Boolean(entry.domain));

  for (const entry of domainCandidates) {
    const trustedBypass = entry.source === "domain-intelligence" && entry.confidence >= 0.75;
    if (!trustedBypass && !(await acceptDomain(entry.domain, entry.confidence))) {
      continue;
    }

    attemptedSources.push(entry.source);
    const candidates: Array<{ source: string; url: string }> = [
      { source: "google", url: googleFaviconUrl(entry.domain) },
      { source: "duckduckgo", url: duckduckgoIconUrl(entry.domain) },
    ];

    for (const candidate of candidates) {
      attemptedSources.push(candidate.source);
      // eslint-disable-next-line no-await-in-loop
      const validation = await validateLogoUrlDetailed(candidate.url);
      const allowUnverifiedTrustedLogo = (strategy === "deep_enrichment"
        && entry.confidence >= 0.75
        && candidate.source === "google")
        || (trustedBypass && candidate.source === "google");
      if (validation.ok || allowUnverifiedTrustedLogo) {
        const result: ResolveLogoResult = {
          logoUrl: candidate.url,
          domain: entry.domain,
          hasDomain: true,
          confidence: entry.confidence,
          classification,
          attemptedSources,
          source: candidate.source,
        };

        await rememberResolvedDomain({
          symbol: input.symbol,
          domain: entry.domain,
          confidence: Math.max(0.8, entry.confidence),
          source: candidate.source,
          companyName: input.name,
        });
        await saveToDomainDataset(input.symbol, entry.domain, entry.confidence);

        recordResolverDiagnostic({
          symbol: input.symbol,
          type: input.type || classification,
          country,
          attemptedSources,
          domain: result.domain,
          confidence: result.confidence,
          result: "resolved",
          source: result.source,
        });
        return result;
      }
    }
  }

  if (!strictDomainOnly) {
    attemptedSources.push("fmp");
    const fmp = await tryFetchFmpLogo(input.symbol);
    if (fmp) {
      const result: ResolveLogoResult = {
        logoUrl: fmp,
        domain: null,
        hasDomain: false,
        confidence: 0.8,
        classification,
        attemptedSources,
        source: "fmp",
      };
      recordResolverDiagnostic({
        symbol: input.symbol,
        type: input.type || classification,
        country,
        attemptedSources,
        domain: null,
        confidence: result.confidence,
        result: "resolved",
        source: result.source,
      });
      return result;
    }
  }

  const noDomainResult: ResolveLogoResult = {
    logoUrl: null,
    domain: null,
    hasDomain: false,
    confidence: confidenceMeta.confidence,
    classification,
    reason: FailureReason.NO_DOMAIN,
    attemptedSources,
  };
  recordResolverDiagnostic({
    symbol: input.symbol,
    type: input.type || classification,
    country,
    attemptedSources,
    domain: null,
    confidence: noDomainResult.confidence,
    result: "failed",
    failureReason: FailureReason.NO_DOMAIN,
  });
  return noDomainResult;
}

export async function updateSymbolLogo(fullSymbol: string, logoUrl: string, domain: string, s3Icon = ""): Promise<boolean> {
  const result = await SymbolModel.updateOne(
    { fullSymbol: fullSymbol.toUpperCase() },
    {
      $set: {
        iconUrl: logoUrl,
        s3Icon,
        companyDomain: domain,
        logoValidatedAt: new Date(),
        logoAttempts: 0,
        lastLogoAttemptAt: Date.now(),
      },
    },
  );

  if (result.modifiedCount > 0) {
    await invalidateSymbolCaches(fullSymbol);
    await recalculatePriorityScores([fullSymbol.toUpperCase()]);
    return true;
  }

  return false;
}