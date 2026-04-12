/**
 * Tail Elimination Engine
 *
 * 8-strategy pipeline for resolving the last ~1% of unresolved symbols.
 * Strategies are executed in strict order; the first one that produces a logo wins.
 *
 *  1. Symbol clustering (base-symbol logo reuse)
 *  2. Fuzzy matching (Levenshtein + token similarity against resolved symbols)
 *  3. Domain reuse (similar company name â†’ reuse domain/logo)
 *  4. Inheritance (ETFâ†’issuer, FOREXâ†’central bank, derivativeâ†’underlying)
 *  5. Crypto derivatives (BTC/USDTâ†’BTC, ETH-PERPâ†’ETH)
 *  6. Aggressive multi-source search
 *  7. Domain heuristic (high-confidence guessed domain accept)
 *  8. Exchange-level fallback (deterministic, never null)
 */

import { SymbolModel } from "../models/Symbol";
import { MissingLogoModel } from "../models/MissingLogo";
import { resolveLogoForSymbol, updateSymbolLogo } from "./logo.service";
import { resolveCluster, getClusterLogo, extractBaseSymbol, setClusterLogo } from "./clusterCache.service";
import {
  isExhausted,
  recordRetry,
  recordNetworkCall,
  markExhausted,
  classifyPriority,
  shouldSkipLowPriority,
  incrementSkipped,
  type SymbolPriority,
} from "./costGuardrails.service";
import { markResolved, markFailed, type MissingLogoWorkItem } from "./missingLogo.service";
import { logger } from "../utils/logger";
import { EXCHANGE_FAVICON, DEFAULT_EXCHANGE_ICON, ETF_ISSUER_DOMAINS, CRYPTO_BASE_MAP, levenshtein, tokenSimilarity, normalizeCompanyName, extractCryptoBase, isEtfLike, isForexLike, yieldToEventLoop } from "./tailElimination.helpers";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TailEliminationResult {
  processed: number;
  resolved: number;
  strategyBreakdown: Record<string, number>;
  exhausted: number;
  skipped: number;
}

export type TailStrategy =
  | "cluster"
  | "fuzzy"
  | "domain-reuse"
  | "inheritance"
  | "crypto-derivative"
  | "aggressive-search"
  | "domain-heuristic"
  | "exchange-fallback";

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Strategy 1: Cluster resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tryCluster(item: MissingLogoWorkItem): Promise<{ logoUrl: string; domain: string } | null> {
  const base = extractBaseSymbol(item.symbol);
  const entry = await getClusterLogo(item.symbol);
  if (entry?.iconUrl) {
    return { logoUrl: entry.iconUrl, domain: entry.domain };
  }
  return null;
}

// â”€â”€ Strategy 2: Fuzzy match against resolved symbols â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tryFuzzyMatch(item: MissingLogoWorkItem): Promise<{ logoUrl: string; domain: string } | null> {
  const normalizedName = normalizeCompanyName(item.name);
  if (!normalizedName || normalizedName.length < 3) return null;

  // Find resolved symbols with similar names using text search
  const candidates = await SymbolModel.find({
    iconUrl: { $exists: true, $ne: "" },
    $text: { $search: normalizedName },
  })
    .select({ name: 1, iconUrl: 1, companyDomain: 1, symbol: 1 })
    .limit(10)
    .lean<Array<{ name: string; iconUrl: string; companyDomain?: string; symbol: string }>>();

  if (!candidates.length) return null;

  for (const cand of candidates) {
    const similarity = tokenSimilarity(item.name, cand.name);
    if (similarity >= 0.85) {
      return { logoUrl: cand.iconUrl, domain: cand.companyDomain ?? "" };
    }

    // Levenshtein on normalized names
    const candNorm = normalizeCompanyName(cand.name);
    const maxLen = Math.max(normalizedName.length, candNorm.length);
    if (maxLen > 0) {
      const dist = levenshtein(normalizedName, candNorm);
      const lSimilarity = 1 - dist / maxLen;
      if (lSimilarity >= 0.85) {
        return { logoUrl: cand.iconUrl, domain: cand.companyDomain ?? "" };
      }
    }
  }

  return null;
}

// â”€â”€ Strategy 3: Domain reuse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tryDomainReuse(item: MissingLogoWorkItem): Promise<{ logoUrl: string; domain: string } | null> {
  const normalizedName = normalizeCompanyName(item.name);
  if (!normalizedName || normalizedName.length < 4) return null;

  // Find a resolved symbol whose name overlaps significantly
  const firstToken = normalizedName.split(" ")[0];
  if (!firstToken || firstToken.length < 3) return null;

  const candidates = await SymbolModel.find({
    companyDomain: { $exists: true, $ne: "" },
    iconUrl: { $exists: true, $ne: "" },
    name: { $regex: firstToken, $options: "i" },
  })
    .select({ name: 1, companyDomain: 1, iconUrl: 1 })
    .limit(20)
    .lean<Array<{ name: string; companyDomain: string; iconUrl: string }>>();

  for (const cand of candidates) {
    const similarity = tokenSimilarity(item.name, cand.name);
    if (similarity >= 0.85) {
      return { logoUrl: cand.iconUrl, domain: cand.companyDomain };
    }
  }

  return null;
}

// â”€â”€ Strategy 4: Inheritance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tryInheritance(item: MissingLogoWorkItem): Promise<{ logoUrl: string; domain: string } | null> {
  // ETF â†’ issuer domain
  if (isEtfLike(item)) {
    const base = extractBaseSymbol(item.symbol);
    const issuerDomain = ETF_ISSUER_DOMAINS[base];
    if (issuerDomain) {
      const url = `https://www.google.com/s2/favicons?domain=${issuerDomain}&sz=128`;
      return { logoUrl: url, domain: issuerDomain };
    }
    // Generic ETF fallback
    return { logoUrl: "https://www.google.com/s2/favicons?domain=etf.com&sz=128", domain: "etf.com" };
  }

  // Forex â†’ xe.com
  if (isForexLike(item)) {
    return { logoUrl: "https://www.google.com/s2/favicons?domain=xe.com&sz=128", domain: "xe.com" };
  }

  // Index â†’ exchange favicon
  if (item.type === "index") {
    const favicon = EXCHANGE_FAVICON[item.exchange.toUpperCase()] ?? DEFAULT_EXCHANGE_ICON;
    return { logoUrl: favicon, domain: "" };
  }

  return null;
}

// â”€â”€ Strategy 5: Crypto derivatives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tryCryptoDerivative(item: MissingLogoWorkItem): Promise<{ logoUrl: string; domain: string } | null> {
  if (item.type !== "crypto") return null;

  const base = extractCryptoBase(item.symbol);
  if (!base) return null;

  // Static map first
  if (CRYPTO_BASE_MAP[base]) {
    return { logoUrl: CRYPTO_BASE_MAP[base], domain: "" };
  }

  // Check if we have a resolved symbol for the base
  const resolved = await SymbolModel.findOne({
    symbol: base,
    type: "crypto",
    iconUrl: { $exists: true, $ne: "" },
  })
    .select({ iconUrl: 1 })
    .lean<{ iconUrl?: string } | null>();

  if (resolved?.iconUrl) {
    return { logoUrl: resolved.iconUrl, domain: "" };
  }

  return null;
}

// â”€â”€ Strategy 6: Aggressive multi-source search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tryAggressiveSearch(item: MissingLogoWorkItem): Promise<{ logoUrl: string; domain: string } | null> {
  await recordNetworkCall(item.fullSymbol, 2); // each resolveLogoForSymbol costs ~2 network calls

  const result = await resolveLogoForSymbol({
    symbol: item.symbol,
    name: item.name,
    exchange: item.exchange,
    type: item.type,
    country: item.country,
    strategy: "deep_enrichment",
    minConfidence: 0.5,
    forceAttempt: true,
  });

  if (result.logoUrl) {
    return { logoUrl: result.logoUrl, domain: result.domain ?? "" };
  }
  return null;
}

// â”€â”€ Strategy 7: Domain heuristic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tryDomainHeuristic(item: MissingLogoWorkItem): Promise<{ logoUrl: string; domain: string } | null> {
  // Try guessing domain from symbol/name
  const token = normalizeCompanyName(item.name).split(" ")[0];
  if (!token || token.length < 3) return null;

  const isIndia = item.country === "IN" || item.country === "INDIA";
  const tlds = isIndia ? [".com", ".co.in", ".in"] : [".com", ".io", ".org"];

  for (const tld of tlds) {
    const domain = `${token}${tld}`;
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    // Google favicons almost always return something; we accept if domain is plausible
    // No network validation needed â€” Google handles it
    await recordNetworkCall(item.fullSymbol, 1);
    return { logoUrl: url, domain };
  }
  return null;
}

// â”€â”€ Strategy 8: Exchange fallback (terminal â€” always resolves) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getExchangeFallback(item: MissingLogoWorkItem): { logoUrl: string; domain: string } {
  const exchangeUpper = item.exchange.toUpperCase();
  const favicon = EXCHANGE_FAVICON[exchangeUpper] ?? DEFAULT_EXCHANGE_ICON;
  return { logoUrl: favicon, domain: "" };
}

// â”€â”€ Main pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STRATEGY_PIPELINE: Array<{
  name: TailStrategy;
  fn: (item: MissingLogoWorkItem) => Promise<{ logoUrl: string; domain: string } | null>;
  minPriority?: SymbolPriority; // skip this strategy for lower priorities
}> = [
  { name: "cluster", fn: tryCluster },
  { name: "fuzzy", fn: tryFuzzyMatch },
  { name: "domain-reuse", fn: tryDomainReuse },
  { name: "inheritance", fn: tryInheritance },
  { name: "crypto-derivative", fn: tryCryptoDerivative },
  { name: "aggressive-search", fn: tryAggressiveSearch, minPriority: "medium" },
  { name: "domain-heuristic", fn: tryDomainHeuristic },
];

const PRIORITY_ORDER: SymbolPriority[] = ["high", "medium", "low"];

function priorityMeetsMinimum(actual: SymbolPriority, minimum?: SymbolPriority): boolean {
  if (!minimum) return true;
  return PRIORITY_ORDER.indexOf(actual) <= PRIORITY_ORDER.indexOf(minimum);
}

export async function eliminateTail(
  items: MissingLogoWorkItem[],
  options?: { batchSize?: number },
): Promise<TailEliminationResult> {
  const batchSize = options?.batchSize ?? 100;
  const result: TailEliminationResult = {
    processed: 0,
    resolved: 0,
    strategyBreakdown: {},
    exhausted: 0,
    skipped: 0,
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Event-loop yield every 50 items
    if (i > 0 && i % 50 === 0) {
      await yieldToEventLoop();
    }

    // Cost guardrail check
    const exhausted = await isExhausted(item.fullSymbol);
    if (exhausted) {
      result.exhausted++;
      continue;
    }

    const priority = classifyPriority({
      popularity: item.popularity,
      searchFrequency: item.searchFrequency,
      userUsage: item.userUsage,
      exchange: item.exchange,
    });

    // Skip low priority symbols that have been retried too many times
    if (shouldSkipLowPriority(priority, item.retryCount)) {
      incrementSkipped();
      result.skipped++;
      continue;
    }

    await recordRetry(item.fullSymbol);

    let resolvedByStrategy: TailStrategy | null = null;
    let resolvedLogo: { logoUrl: string; domain: string } | null = null;

    // Run through strategy pipeline
    for (const strategy of STRATEGY_PIPELINE) {
      if (!priorityMeetsMinimum(priority, strategy.minPriority)) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        resolvedLogo = await strategy.fn(item);
        if (resolvedLogo) {
          resolvedByStrategy = strategy.name;
          break;
        }
      } catch (err) {
        logger.warn("tail_strategy_error", {
          strategy: strategy.name,
          fullSymbol: item.fullSymbol,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Terminal fallback: exchange icon (always resolves)
    if (!resolvedLogo) {
      resolvedLogo = getExchangeFallback(item);
      resolvedByStrategy = "exchange-fallback";
    }

    // Apply the resolution
    const updated = await updateSymbolLogo(
      item.fullSymbol,
      resolvedLogo.logoUrl,
      resolvedLogo.domain,
    );

    if (updated) {
      await markResolved(item.fullSymbol);
      result.resolved++;
      result.strategyBreakdown[resolvedByStrategy!] =
        (result.strategyBreakdown[resolvedByStrategy!] ?? 0) + 1;

      // Populate cluster cache for sibling symbols
      const base = extractBaseSymbol(item.symbol);
      await setClusterLogo(base, {
        iconUrl: resolvedLogo.logoUrl,
        domain: resolvedLogo.domain,
        cachedAt: Date.now(),
      });
    } else {
      await markFailed(item.fullSymbol, `tail_${resolvedByStrategy}_update_failed`);
    }

    result.processed++;
  }

  return result;
}

// â”€â”€ Quick stats query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TailCoverageStats {
  totalSymbols: number;
  mapped: number;
  missing: number;
  coverage: string;
  quarantined: number;
}

export async function getTailCoverageStats(): Promise<TailCoverageStats> {
  const [total, missing, quarantined] = await Promise.all([
    SymbolModel.countDocuments(),
    SymbolModel.countDocuments({ $or: [{ iconUrl: { $exists: false } }, { iconUrl: "" }] }),
    MissingLogoModel.countDocuments({ status: "unresolvable" }),
  ]);

  const mapped = total - missing;
  return {
    totalSymbols: total,
    mapped,
    missing,
    coverage: total > 0 ? ((mapped / total) * 100).toFixed(2) + "%" : "0%",
    quarantined,
  };
}
