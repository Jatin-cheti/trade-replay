/**
 * Symbol Expansion Service — orchestration layer.
 * Source functions are in symbolExpansion.fmp.ts and symbolExpansion.crypto.ts.
 * Shared helpers/types are in symbolExpansion.helpers.ts.
 */

import { GlobalSymbolMaster } from "../models/GlobalSymbolMaster";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { computePrefixesForSymbol } from "./searchIntelligence.service";
import { inferDomainForSymbol } from "./domainInference.service";
import {
  startIngestion,
  saveCheckpoint,
  completeIngestion,
  failIngestion,
  shouldSkipIngestion,
} from "./ingestionState.service";

import {
  type ExpansionResult,
  type FullExpansionReport,
  isFmpAvailable,
  fmpSkippedResult,
  deriveCurrency,
  normalizeSymbolType,
} from "./symbolExpansion.helpers";
import { markSearchIndexDirty } from "./searchIndex.service";

export type { ExpansionResult, FullExpansionReport };

import {
  expandFmpStocks,
  expandFmpEtfs,
  expandFmpAvailableTraded,
  expandFmpCrypto,
  expandFmpForex,
  expandFmpCommodities,
  expandFmpExchangeStocks,
  expandFmpDeepScreener,
} from "./symbolExpansion.fmp";

import {
  expandCoinGeckoFull,
  expandCoinGeckoMarkets,
  expandBinanceFull,
  expandCoinbase,
  expandKraken,
  expandExoticForex,
  expandGlobalIndices,
} from "./symbolExpansion.crypto";

import {
  expandOkx,
  expandBybit,
  expandGateio,
  expandKucoin,
  expandMexc,
  expandBitfinex,
  expandAlphaVantageListing,
  expandHuobi,
  expandCryptoCom,
} from "./symbolExpansion.altexchanges";

// ── Sync GlobalMaster → Symbol table ────────────────────────────────────

export async function syncGlobalMasterToSymbols(batchSize = 1000): Promise<{ synced: number }> {
  let synced = 0;

  const pipeline = [
    {
      $lookup: {
        from: "symbols",
        localField: "fullSymbol",
        foreignField: "fullSymbol",
        as: "existing",
      },
    },
    { $match: { existing: { $size: 0 } } },
    { $project: { existing: 0 } },
    { $limit: batchSize },
  ];

  const missing = await GlobalSymbolMaster.aggregate(pipeline);

  if (missing.length === 0) return { synced: 0 };

  const ops = missing.map((doc: Record<string, unknown>) => {
    const symbol = doc.symbol as string;
    const name = doc.name as string;
    const exchange = doc.exchange as string;
    const country = doc.country as string;
    const symbolType = doc.type as string;
    const normalizedType = normalizeSymbolType(symbolType);
    const prefixes = computePrefixesForSymbol(symbol, name);
    const domain = inferDomainForSymbol({ symbol, name, exchange }) ?? (doc.domain as string) ?? "";

    return {
      updateOne: {
        filter: { fullSymbol: doc.fullSymbol },
        update: {
          $setOnInsert: {
            symbol,
            fullSymbol: doc.fullSymbol,
            name,
            exchange,
            country,
            type: normalizedType,
            currency: (doc.currency as string) || deriveCurrency(country),
            iconUrl: (doc.logoUrl as string) || "",
            companyDomain: domain,
            s3Icon: "",
            popularity: 0,
            searchFrequency: 0,
            userUsage: 0,
            priorityScore: 0,
            source: (doc.source as string) || "global-master-sync",
            ...prefixes,
          },
        },
        upsert: true,
      },
    };
  });

  if (ops.length > 0) {
    const result = await SymbolModel.bulkWrite(ops, { ordered: false });
    synced = result.upsertedCount;
    if (synced > 0) {
      markSearchIndexDirty("global_master_sync");
    }
  }

  return { synced };
}

// ── Main entry: run incremental expansion ────────────────────────────────

export async function ingestGlobalSymbolsIncremental(): Promise<FullExpansionReport> {
  const INGESTION_KEY = "symbol-expansion-incremental";
  const totalBefore = await GlobalSymbolMaster.estimatedDocumentCount();
  const start = Date.now();
  const allResults: ExpansionResult[] = [];
  let phaseIndex = 0;

  if (await shouldSkipIngestion(INGESTION_KEY, 4 * 60 * 60 * 1000)) {
    logger.info("symbol_expansion_skipped_recent");
    return {
      totalBefore,
      totalAfter: totalBefore,
      netGain: 0,
      sources: [],
      totalDurationMs: 0,
    };
  }

  await startIngestion(INGESTION_KEY);
  logger.info("symbol_expansion_start", { totalBefore });

  try {
    // Phase 1: Test FMP with one call first (circuit breaker trips if unreachable)
    const fmpStocks = await expandFmpStocks();
    allResults.push(fmpStocks);
    await saveCheckpoint(INGESTION_KEY, {
      lastCursor: "phase1-fmp-stocks",
      lastOffset: ++phaseIndex,
      batchIngested: fmpStocks.newInserted,
      metadata: { phase: "fmp-stocks" },
    });

    // If FMP is up, run remaining core endpoints in parallel
    if (isFmpAvailable()) {
      const [fmpEtfs, fmpTraded, fmpCrypto, fmpForex, fmpCommodities] = await Promise.all([
        expandFmpEtfs(),
        expandFmpAvailableTraded(),
        expandFmpCrypto(),
        expandFmpForex(),
        expandFmpCommodities(),
      ]);
      allResults.push(fmpEtfs, fmpTraded, fmpCrypto, fmpForex, fmpCommodities);
    } else {
      allResults.push(
        fmpSkippedResult("fmp-etfs"), fmpSkippedResult("fmp-traded"),
        fmpSkippedResult("fmp-crypto"), fmpSkippedResult("fmp-forex"),
        fmpSkippedResult("fmp-commodities"),
      );
    }
    await saveCheckpoint(INGESTION_KEY, {
      lastCursor: "phase2-fmp-core",
      lastOffset: ++phaseIndex,
      batchIngested: allResults.reduce((s, r) => s + r.newInserted, 0),
      metadata: { phase: "fmp-core" },
    });

    // Phase 2: Exchange-specific (sequential due to rate limits)
    const exchangeResults = await expandFmpExchangeStocks();
    allResults.push(...exchangeResults);
    await saveCheckpoint(INGESTION_KEY, {
      lastCursor: "phase3-fmp-exchanges",
      lastOffset: ++phaseIndex,
      batchIngested: exchangeResults.reduce((s, r) => s + r.newInserted, 0),
      metadata: { phase: "fmp-exchanges" },
    });

    // Phase 3: Deep screener
    const screenerResults = await expandFmpDeepScreener();
    allResults.push(...screenerResults);
    await saveCheckpoint(INGESTION_KEY, {
      lastCursor: "phase4-fmp-screener",
      lastOffset: ++phaseIndex,
      batchIngested: screenerResults.reduce((s, r) => s + r.newInserted, 0),
      metadata: { phase: "fmp-screener" },
    });

    // Phase 4: Crypto exchanges (parallel)
    const [coingeckoFull, coingeckoMarkets, binance, coinbase, kraken] = await Promise.all([
      expandCoinGeckoFull(),
      expandCoinGeckoMarkets(),
      expandBinanceFull(),
      expandCoinbase(),
      expandKraken(),
    ]);
    allResults.push(coingeckoFull, coingeckoMarkets, binance, coinbase, kraken);
    await saveCheckpoint(INGESTION_KEY, {
      lastCursor: "phase5-crypto-major",
      lastOffset: ++phaseIndex,
      batchIngested: [coingeckoFull, coingeckoMarkets, binance, coinbase, kraken].reduce((s, r) => s + r.newInserted, 0),
      metadata: { phase: "crypto-major" },
    });

    // Phase 4b: Additional crypto exchanges (parallel, free public APIs)
    const [okx, bybit, gateio, kucoin, mexc, bitfinex, huobi, cryptoCom] = await Promise.all([
      expandOkx(),
      expandBybit(),
      expandGateio(),
      expandKucoin(),
      expandMexc(),
      expandBitfinex(),
      expandHuobi(),
      expandCryptoCom(),
    ]);
    allResults.push(okx, bybit, gateio, kucoin, mexc, bitfinex, huobi, cryptoCom);
    await saveCheckpoint(INGESTION_KEY, {
      lastCursor: "phase6-crypto-exotic",
      lastOffset: ++phaseIndex,
      batchIngested: [okx, bybit, gateio, kucoin, mexc, bitfinex, huobi, cryptoCom].reduce((s, r) => s + r.newInserted, 0),
      metadata: { phase: "crypto-exotic" },
    });

    // Phase 4c: Stock listing from Alpha Vantage
    const avListing = await expandAlphaVantageListing();
    allResults.push(avListing);

    // Phase 5: Curated (instant, no network)
    const [exoticForex, globalIndices] = await Promise.all([
      expandExoticForex(),
      expandGlobalIndices(),
    ]);
    allResults.push(exoticForex, globalIndices);

    const totalAfter = await GlobalSymbolMaster.estimatedDocumentCount();
    const report: FullExpansionReport = {
      totalBefore,
      totalAfter,
      netGain: totalAfter - totalBefore,
      sources: allResults,
      totalDurationMs: Date.now() - start,
    };

    await completeIngestion(INGESTION_KEY);

    logger.info("symbol_expansion_complete", {
      totalBefore,
      totalAfter,
      netGain: report.netGain,
      sources: allResults.length,
      durationMs: report.totalDurationMs,
    });

    return report;
  } catch (error) {
    await failIngestion(INGESTION_KEY, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ── Get expansion stats ──────────────────────────────────────────────────

export async function getExpansionStats(): Promise<{
  globalMasterCount: number;
  symbolTableCount: number;
  gap: number;
  bySource: Array<{ source: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  byCountry: Array<{ country: string; count: number }>;
}> {
  const [masterCount, symbolCount, bySource, byType, byCountry] = await Promise.all([
    GlobalSymbolMaster.estimatedDocumentCount(),
    SymbolModel.estimatedDocumentCount(),
    GlobalSymbolMaster.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]) as Promise<Array<{ _id: string; count: number }>>,
    GlobalSymbolMaster.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]) as Promise<Array<{ _id: string; count: number }>>,
    GlobalSymbolMaster.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]) as Promise<Array<{ _id: string; count: number }>>,
  ]);

  return {
    globalMasterCount: masterCount,
    symbolTableCount: symbolCount,
    gap: masterCount - symbolCount,
    bySource: bySource.map((r) => ({ source: r._id, count: r.count })),
    byType: byType.map((r) => ({ type: r._id, count: r.count })),
    byCountry: byCountry.map((r) => ({ country: r._id, count: r.count })),
  };
}