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
  tryFetchClearbitLogo,
  tryOrderedLogoSources,
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
  allSourcesTried?: boolean;
  needsManualReview?: boolean;
  domainCandidates?: string[];
  mappingConfidence?: "high" | "medium" | "low";
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function domainRoot(domain: string): string {
  return normalizeDomain(domain).split(".")[0] || "";
}

function domainSimilarity(domain: string, companyName: string): number {
  const root = domainRoot(domain);
  if (!root) return 0;
  const tokens = normalizeCompanyName(companyName).split(" ").filter((token) => token.length >= 3);
  if (!tokens.length) return 0;
  const joined = tokens.join("");
  if (joined.includes(root) || root.includes(joined)) return 1;
  const overlaps = tokens.filter((token) => root.includes(token) || token.includes(root));
  return overlaps.length / tokens.length;
}

function mappingConfidenceFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 0.9) return "high";
  if (score >= 0.7) return "medium";
  return "low";
}

async function getDbSymbolContext(input: {
  symbol: string;
  fullSymbol?: string;
  exchange?: string;
  name: string;
  country?: string;
}) {
  const symbolUpper = normalizeSymbol(input.symbol);
  const fullSymbol = input.fullSymbol || `${(input.exchange || "GLOBAL").toUpperCase()}:${symbolUpper}`;
  const doc = await SymbolModel.findOne({
    $or: [{ fullSymbol }, { symbol: symbolUpper }],
  })
    .sort({ marketCap: -1, priorityScore: -1 })
    .select({ name: 1, exchange: 1, sector: 1, country: 1, marketCap: 1, companyDomain: 1 })
    .lean<{ name?: string; exchange?: string; sector?: string; country?: string; marketCap?: number; companyDomain?: string } | null>();

  return {
    fullCompanyName: doc?.name || input.name,
    exchange: doc?.exchange || input.exchange || "",
    sector: doc?.sector || "",
    country: doc?.country || input.country || "GLOBAL",
    marketCap: typeof doc?.marketCap === "number" ? doc.marketCap : 0,
    dbDomain: doc?.companyDomain || "",
  };
}

function generateTopDomainCandidates(context: {
  symbol: string;
  companyName: string;
  country: string;
  existing: string[];
}): string[] {
  const normalizedName = normalizeCompanyName(context.companyName);
  const tokens = normalizedName.split(" ").filter((token) => token.length >= 3);
  const joined = tokens.join("");
  const country = context.country.toUpperCase();
  const tlds = country === "IN" ? [".com", ".co.in", ".in"] : [".com", ".io", ".org"];

  const generated = new Set<string>();
  for (const existing of context.existing) {
    if (existing) generated.add(normalizeDomain(existing));
  }
  const baseFromSymbol = normalizeSymbol(context.symbol).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (baseFromSymbol.length >= 3) {
    generated.add(`${baseFromSymbol}.com`);
  }
  if (joined.length >= 3) {
    for (const tld of tlds) generated.add(`${joined}${tld}`);
  }
  if (tokens.length > 0) {
    for (const tld of tlds) generated.add(`${tokens[0]}${tld}`);
  }

  const ranked = Array.from(generated)
    .filter((domain) => domain.includes("."))
    .sort((a, b) => domainSimilarity(b, context.companyName) - domainSimilarity(a, context.companyName));

  return ranked.slice(0, 3);
}

async function resolveDomainWithDisambiguation(input: {
  symbol: string;
  fullSymbol?: string;
  name: string;
  exchange?: string;
  country?: string;
  trustedCandidates: Array<{ domain: string; confidence: number }>;
  attemptedSources: string[];
}): Promise<{ domain: string | null; confidence: number; candidates: string[] }> {
  const context = await getDbSymbolContext(input);
  const topByAiHeuristic = generateTopDomainCandidates({
    symbol: input.symbol,
    companyName: context.fullCompanyName,
    country: context.country,
    existing: [context.dbDomain, ...input.trustedCandidates.map((entry) => entry.domain)],
  });

  const mergedCandidates = Array.from(new Set([
    ...input.trustedCandidates.map((entry) => normalizeDomain(entry.domain)),
    ...topByAiHeuristic,
  ])).slice(0, 6);

  let best: { domain: string; confidence: number } | null = null;
  for (const candidate of mergedCandidates) {
    input.attemptedSources.push(`domain-candidate:${candidate}`);

    // Step C: verify with Clearbit first.
    // eslint-disable-next-line no-await-in-loop
    const clearbitCandidate = await tryFetchClearbitLogo(candidate);
    if (!clearbitCandidate) {
      continue;
    }

    // Step D: homepage title/domain token match.
    const score = domainSimilarity(candidate, context.fullCompanyName);
    const highMarketCapBoost = context.marketCap >= 1_000_000_000 ? 0.05 : 0;
    const finalScore = Math.min(1, score + highMarketCapBoost);

    if (!best || finalScore > best.confidence) {
      best = { domain: candidate, confidence: finalScore };
    }
  }

  if (!best) {
    return {
      domain: null,
      confidence: 0,
      candidates: mergedCandidates,
    };
  }

  return {
    domain: best.domain,
    confidence: Math.max(0.6, best.confidence),
    candidates: mergedCandidates,
  };
}

function aiGeneratedGenericLogo(symbol: string): string {
  const initials = normalizeSymbol(symbol).slice(0, 2) || "NA";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1f2937"/><text x="50%" y="55%" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="24" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
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

  const filteredTrusted = [] as Array<{ domain: string; confidence: number }>;
  for (const entry of domainCandidates) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await acceptDomain(entry.domain, entry.confidence))) continue;
    filteredTrusted.push({ domain: entry.domain, confidence: entry.confidence });
  }

  const disambiguated = await resolveDomainWithDisambiguation({
    symbol: input.symbol,
    fullSymbol,
    name: input.name,
    exchange: input.exchange,
    country,
    trustedCandidates: filteredTrusted,
    attemptedSources,
  });

  if (disambiguated.domain) {
    attemptedSources.push("domain-disambiguated");
    const ordered = await tryOrderedLogoSources(disambiguated.domain, input.name);
    if (ordered) {
      const result: ResolveLogoResult = {
        logoUrl: ordered.logoUrl,
        domain: disambiguated.domain,
        hasDomain: true,
        confidence: disambiguated.confidence,
        classification,
        attemptedSources,
        source: ordered.source,
        allSourcesTried: false,
        needsManualReview: false,
        domainCandidates: disambiguated.candidates,
        mappingConfidence: mappingConfidenceFromScore(disambiguated.confidence),
      };

      await rememberResolvedDomain({
        symbol: input.symbol,
        domain: disambiguated.domain,
        confidence: Math.max(0.8, disambiguated.confidence),
        source: ordered.source,
        companyName: input.name,
      });
      await saveToDomainDataset(input.symbol, disambiguated.domain, disambiguated.confidence);

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

  if (!strictDomainOnly) {
    attemptedSources.push("ai-generated-generic");
    return {
      logoUrl: aiGeneratedGenericLogo(input.symbol),
      domain: disambiguated.domain,
      hasDomain: Boolean(disambiguated.domain),
      confidence: 0.25,
      classification,
      attemptedSources,
      source: "ai-generated-generic",
      allSourcesTried: true,
      needsManualReview: true,
      domainCandidates: disambiguated.candidates,
      mappingConfidence: "low",
      reason: FailureReason.NO_DOMAIN,
    };
  }

  const noDomainResult: ResolveLogoResult = {
    logoUrl: null,
    domain: null,
    hasDomain: false,
    confidence: confidenceMeta.confidence,
    classification,
    reason: FailureReason.NO_DOMAIN,
    attemptedSources,
    allSourcesTried: true,
    needsManualReview: true,
    domainCandidates: disambiguated.candidates,
    mappingConfidence: "low",
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