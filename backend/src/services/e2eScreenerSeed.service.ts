import { isMongoUsingMemoryFallback } from "../config/db";
import { env } from "../config/env";
import { CleanAssetModel } from "../models/CleanAsset";
import { logger } from "../utils/logger";

type SeedAsset = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: "stock" | "etf";
  sector: string;
  marketCap: number;
  volume: number;
  priorityScore: number;
};

const E2E_SCREENER_ASSETS: SeedAsset[] = [
  // India stocks
  { symbol: "RELIANCE", fullSymbol: "RELIANCE.NSE", name: "Reliance Industries Ltd", exchange: "NSE", country: "IN", type: "stock", sector: "Energy", marketCap: 245_000_000_000, volume: 3_400_000, priorityScore: 98 },
  { symbol: "TCS", fullSymbol: "TCS.NSE", name: "Tata Consultancy Services", exchange: "NSE", country: "IN", type: "stock", sector: "Technology", marketCap: 170_000_000_000, volume: 1_500_000, priorityScore: 97 },
  { symbol: "INFY", fullSymbol: "INFY.NSE", name: "Infosys Ltd", exchange: "NSE", country: "IN", type: "stock", sector: "Technology", marketCap: 94_000_000_000, volume: 2_900_000, priorityScore: 96 },
  { symbol: "HDFCBANK", fullSymbol: "HDFCBANK.NSE", name: "HDFC Bank Ltd", exchange: "NSE", country: "IN", type: "stock", sector: "Financial Services", marketCap: 132_000_000_000, volume: 4_200_000, priorityScore: 95 },
  { symbol: "ITC", fullSymbol: "ITC.NSE", name: "ITC Ltd", exchange: "NSE", country: "IN", type: "stock", sector: "Consumer Defensive", marketCap: 62_000_000_000, volume: 6_800_000, priorityScore: 94 },

  // Global stocks
  { symbol: "AAPL", fullSymbol: "AAPL.NASDAQ", name: "Apple Inc", exchange: "NASDAQ", country: "US", type: "stock", sector: "Technology", marketCap: 2_700_000_000_000, volume: 42_000_000, priorityScore: 99 },
  { symbol: "MSFT", fullSymbol: "MSFT.NASDAQ", name: "Microsoft Corp", exchange: "NASDAQ", country: "US", type: "stock", sector: "Technology", marketCap: 2_900_000_000_000, volume: 24_000_000, priorityScore: 99 },
  { symbol: "NVDA", fullSymbol: "NVDA.NASDAQ", name: "NVIDIA Corp", exchange: "NASDAQ", country: "US", type: "stock", sector: "Technology", marketCap: 2_300_000_000_000, volume: 55_000_000, priorityScore: 99 },
  { symbol: "AMZN", fullSymbol: "AMZN.NASDAQ", name: "Amazon.com Inc", exchange: "NASDAQ", country: "US", type: "stock", sector: "Consumer Cyclical", marketCap: 1_900_000_000_000, volume: 38_000_000, priorityScore: 98 },
  { symbol: "TSLA", fullSymbol: "TSLA.NASDAQ", name: "Tesla Inc", exchange: "NASDAQ", country: "US", type: "stock", sector: "Consumer Cyclical", marketCap: 780_000_000_000, volume: 66_000_000, priorityScore: 97 },

  // ETFs (include India so default IN quick-filter can return rows)
  { symbol: "SPY", fullSymbol: "SPY.ARCA", name: "SPDR S&P 500 ETF Trust", exchange: "ARCA", country: "US", type: "etf", sector: "Index", marketCap: 530_000_000_000, volume: 88_000_000, priorityScore: 99 },
  { symbol: "QQQ", fullSymbol: "QQQ.NASDAQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", country: "US", type: "etf", sector: "Index", marketCap: 270_000_000_000, volume: 46_000_000, priorityScore: 98 },
  { symbol: "VTI", fullSymbol: "VTI.ARCA", name: "Vanguard Total Stock Market ETF", exchange: "ARCA", country: "US", type: "etf", sector: "Index", marketCap: 390_000_000_000, volume: 3_800_000, priorityScore: 97 },
  { symbol: "NIFTYBEES", fullSymbol: "NIFTYBEES.NSE", name: "Nippon India ETF Nifty BeES", exchange: "NSE", country: "IN", type: "etf", sector: "Index", marketCap: 8_400_000_000, volume: 2_300_000, priorityScore: 96 },
  { symbol: "JUNIORBEES", fullSymbol: "JUNIORBEES.NSE", name: "Nippon India ETF Nifty Junior BeES", exchange: "NSE", country: "IN", type: "etf", sector: "Index", marketCap: 1_200_000_000, volume: 390_000, priorityScore: 95 },
];

export async function ensureE2EScreenerSeedData(): Promise<void> {
  const shouldSeed = env.E2E || isMongoUsingMemoryFallback();
  if (!shouldSeed) {
    return;
  }

  const today = new Date();
  const recentEarningsDate = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upcomingEarningsDate = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const bulkOps = E2E_SCREENER_ASSETS.map((asset) => ({
    updateOne: {
      filter: { fullSymbol: asset.fullSymbol },
      update: {
        $setOnInsert: {
          symbol: asset.symbol,
          fullSymbol: asset.fullSymbol,
          name: asset.name,
          exchange: asset.exchange,
          country: asset.country,
          type: asset.type,
          currency: asset.country === "IN" ? "INR" : "USD",
          sector: asset.sector,
          source: "e2e-seed",
          marketCap: asset.marketCap,
          volume: asset.volume,
          liquidityScore: Math.max(1, Math.round(asset.volume / 100_000)),
          popularity: Math.max(1, Math.round(asset.priorityScore / 10)),
          priorityScore: asset.priorityScore,
          iconUrl: "",
          s3Icon: "",
          companyDomain: "",
          isActive: true,
          recentEarningsDate,
          upcomingEarningsDate,
        },
      },
      upsert: true,
    },
  }));

  const result = await CleanAssetModel.bulkWrite(bulkOps, { ordered: false });

  logger.info("e2e_screener_seed_ready", {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount,
    totalSeedRows: E2E_SCREENER_ASSETS.length,
    mode: env.E2E ? "e2e" : "memory-fallback",
  });
}
