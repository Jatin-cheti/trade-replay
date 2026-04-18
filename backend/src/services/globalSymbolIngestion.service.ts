import { GlobalSymbolMaster } from "../models/GlobalSymbolMaster";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { bseProvider } from "./providers/bse.provider";
import { coingeckoProvider } from "./providers/coingecko.provider";
import { nseProvider } from "./providers/nse.provider";
import { openfigiProvider } from "./providers/openfigi.provider";
import { secProvider } from "./providers/sec.provider";
import { wikidataProvider } from "./providers/wikidata.provider";
import { markSearchIndexDirty } from "./searchIndex.service";

export type GlobalSymbolCandidate = {
  symbol: string;
  exchange: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  source: string;
  metadata?: Record<string, unknown>;
  iconUrl?: string;
};

export type GlobalSymbolProvider = {
  name: string;
  fetchSymbols: () => Promise<GlobalSymbolCandidate[]>;
};

const PROVIDERS: GlobalSymbolProvider[] = [
  coingeckoProvider,
  wikidataProvider,
  secProvider,
  openfigiProvider,
  nseProvider,
  bseProvider,
];

function normalizeCandidate(candidate: GlobalSymbolCandidate): GlobalSymbolCandidate & { fullSymbol: string } {
  const symbol = candidate.symbol.trim().toUpperCase();
  const exchange = candidate.exchange.trim().toUpperCase();
  const fullSymbol = `${exchange}:${symbol}`;
  return {
    ...candidate,
    symbol,
    exchange,
    name: candidate.name.trim(),
    country: candidate.country.trim().toUpperCase(),
    currency: candidate.currency.trim().toUpperCase(),
    type: candidate.type.trim().toLowerCase(),
    fullSymbol,
  };
}

function candidateDomain(candidate: GlobalSymbolCandidate): string {
  const domain = candidate.metadata?.domain;
  if (typeof domain !== "string") return "";
  return domain.trim().toLowerCase();
}

async function upsertGlobalSymbols(rows: Array<GlobalSymbolCandidate & { fullSymbol: string }>): Promise<void> {
  if (rows.length === 0) return;

  const now = new Date();
  const masterOps = rows.map((row) => ({
    updateOne: {
      filter: { fullSymbol: row.fullSymbol },
      update: {
        $set: {
          symbol: row.symbol,
          fullSymbol: row.fullSymbol,
          name: row.name,
          exchange: row.exchange,
          country: row.country,
          type: row.type,
          currency: row.currency,
          source: row.source,
          metadata: row.metadata || {},
          status: "active",
          lastSeenAt: now,
        },
        $setOnInsert: { firstSeenAt: now },
      },
      upsert: true,
    },
  }));

  for (let index = 0; index < masterOps.length; index += 500) {
    const batch = masterOps.slice(index, index + 500);
    // eslint-disable-next-line no-await-in-loop
    await GlobalSymbolMaster.bulkWrite(batch, { ordered: false });
  }

  const symbolOps = rows.map((row) => {
    const domain = candidateDomain(row);
    const marketCap = typeof row.metadata?.marketCap === "number" ? row.metadata.marketCap : 0;
    const volume = typeof row.metadata?.volume === "number" ? row.metadata.volume : 0;
    const update: { $setOnInsert: Record<string, unknown>; $set?: Record<string, unknown> } = {
      $setOnInsert: {
        symbol: row.symbol,
        fullSymbol: row.fullSymbol,
        name: row.name,
        exchange: row.exchange,
        country: row.country,
        type: row.type,
        currency: row.currency,
        iconUrl: "",
        logoAttempts: 0,
        popularity: 0,
        searchFrequency: 0,
        userUsage: 0,
        priorityScore: 0,
        marketCap,
        volume,
        liquidityScore: 0,
        isSynthetic: false,
        searchPrefixes: [],
        baseSymbol: "",
        source: row.source,
      },
    };

    if (domain) {
      update.$set = { companyDomain: domain };
    }

    return {
      updateOne: {
        filter: { fullSymbol: row.fullSymbol },
        update,
        upsert: true,
      },
    };
  });

  for (let index = 0; index < symbolOps.length; index += 500) {
    const batch = symbolOps.slice(index, index + 500);
    // eslint-disable-next-line no-await-in-loop
    await SymbolModel.bulkWrite(batch, { ordered: false });
  }

  // Secondary pass: update iconUrl on existing symbols where it is still empty
  const iconUrlOps = rows
    .filter((row) => row.iconUrl)
    .map((row) => ({
      updateOne: {
        filter: { fullSymbol: row.fullSymbol, iconUrl: "" },
        update: { $set: { iconUrl: row.iconUrl } },
      },
    }));
  for (let index = 0; index < iconUrlOps.length; index += 500) {
    const batch = iconUrlOps.slice(index, index + 500);
    // eslint-disable-next-line no-await-in-loop
    await SymbolModel.bulkWrite(batch, { ordered: false });
  }

  markSearchIndexDirty("global_symbol_ingestion");
}

export async function ingestGlobalSymbolsOnce(): Promise<{ providers: number; symbols: number }> {
  let total = 0;

  for (const provider of PROVIDERS) {
    // eslint-disable-next-line no-await-in-loop
    const raw = await provider.fetchSymbols();
    const normalized = raw
      .map(normalizeCandidate)
      .filter((row) => row.symbol.length > 0 && row.name.length > 0);
    // eslint-disable-next-line no-await-in-loop
    await upsertGlobalSymbols(normalized);
    total += normalized.length;
  }

  logger.info("global_symbol_ingestion_pass", { providers: PROVIDERS.length, symbols: total });
  return { providers: PROVIDERS.length, symbols: total };
}

export async function continuousSymbolIngestion(intervalMs = 3 * 60 * 60 * 1000): Promise<void> {
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ingestGlobalSymbolsOnce();
    } catch (error) {
      logger.error("global_symbol_ingestion_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}



