import pLimit from "p-limit";
import type { MissingLogoWorkItem } from "./missingLogo.service";
import { markFailed, markResolved } from "./missingLogo.service";
import { resolveLogoForSymbol, updateSymbolLogo } from "./logo.service";

export interface LogoBatchResult {
  processed: number;
  resolved: number;
}

async function processSingleSymbol(
  item: MissingLogoWorkItem,
  strategy: "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only",
  options: { minConfidence: number; popularityForceThreshold: number },
): Promise<LogoBatchResult> {
  try {
    const resolvedLogo = await resolveLogoForSymbol({
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange,
      type: item.type,
      country: item.country,
      strategy,
      minConfidence: options.minConfidence,
      forceAttempt: (item.searchFrequency ?? 0) + (item.userUsage ?? 0) >= options.popularityForceThreshold,
    });

    if (!resolvedLogo.logoUrl) {
      await markFailed(item.fullSymbol, resolvedLogo.reason || "LOGO_NOT_FOUND", {
        hasDomain: resolvedLogo.hasDomain,
        hasLogo: false,
      });
      return { processed: 1, resolved: 0 };
    }

    const updated = await updateSymbolLogo(item.fullSymbol, resolvedLogo.logoUrl, resolvedLogo.domain || "");
    if (!updated) {
      await markFailed(item.fullSymbol, "SYMBOL_UPDATE_NO_MATCH", {
        hasDomain: resolvedLogo.hasDomain,
        hasLogo: true,
      });
      return { processed: 1, resolved: 0 };
    }

    await markResolved(item.fullSymbol);
    return { processed: 1, resolved: 1 };
  } catch (error) {
    await markFailed(item.fullSymbol, error instanceof Error ? error.message : String(error), {
      hasDomain: false,
      hasLogo: false,
    });
    return { processed: 1, resolved: 0 };
  }
}

export async function processLogoBatchWithConcurrency(
  items: MissingLogoWorkItem[],
  concurrency = 20,
  strategy: "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only" = "normal",
  options: { minConfidence?: number; popularityForceThreshold?: number } = {},
): Promise<LogoBatchResult> {
  const limit = pLimit(Math.max(1, concurrency));
  const minConfidence = options.minConfidence ?? (strategy === "aggressive" ? 0.5 : 0.7);
  const popularityForceThreshold = options.popularityForceThreshold ?? 120;

  const outcomes = await Promise.all(
    items.map((item) => limit(() => processSingleSymbol(item, strategy, { minConfidence, popularityForceThreshold }))),
  );

  let processed = 0;
  let resolved = 0;
  for (const outcome of outcomes) {
    processed += outcome.processed;
    resolved += outcome.resolved;
  }

  return { processed, resolved };
}
