import axios from "axios";
import { SymbolModel } from "../../models/Symbol";
import { logger } from "../../utils/logger";

const BASE = "https://api.coingecko.com/api/v3";
const PAGE_SIZE = 250;
const PAGE_DELAY_MS = 7_000;
const TIMEOUT_MS = 15000;
const MAX_PAGES = 40; // 250 * 40 = 10,000 coins

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
}

async function fetchMarketsPage(page: number, attempt = 0): Promise<MarketCoin[]> {
  try {
    const { data } = await axios.get<MarketCoin[]>(`${BASE}/coins/markets`, {
      timeout: TIMEOUT_MS,
      headers: { "User-Agent": "tradereplay-scraper/1.0" },
      params: {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: PAGE_SIZE,
        page,
        sparkline: false,
      },
    });
    return data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 429 && attempt < 3) {
      logger.warn("coingecko_markets_rate_limited", { page, attempt });
      await sleep(65_000);
      return fetchMarketsPage(page, attempt + 1);
    }
    logger.warn("coingecko_markets_page_failed", { page, message: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export async function runCoinGeckoFullScraper(options?: {
  limit?: number;
  onProgress?: (stats: { processed: number; resolved: number; total: number }) => void;
}): Promise<{ processed: number; resolved: number }> {
  const unresolvedCount = await SymbolModel.countDocuments({
    exchange: "COINGECKO",
    $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }],
  });

  if (unresolvedCount === 0) {
    logger.info("coingecko_scraper_nothing_to_do");
    return { processed: 0, resolved: 0 };
  }

  logger.info("coingecko_scraper_start_markets", { unresolvedCount });

  const unresolvedSymbols = new Set(
    (await SymbolModel.find({
      exchange: "COINGECKO",
      $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }],
    }).select({ symbol: 1 }).lean<Array<{ symbol: string }>>().exec()).map((r) => r.symbol),
  );

  let processed = 0;
  let resolved = 0;
  const maxPages = options?.limit ? Math.ceil(options.limit / PAGE_SIZE) : MAX_PAGES;

  for (let page = 1; page <= maxPages; page++) {
    const coins = await fetchMarketsPage(page);
    if (coins.length === 0) {
      logger.info("coingecko_scraper_no_more_pages", { page });
      break;
    }

    const ops = [];
    for (const coin of coins) {
      const sym = coin.symbol.toUpperCase();
      if (!unresolvedSymbols.has(sym)) continue;
      if (!coin.image || coin.image.includes("missing_")) continue;

      ops.push({
        updateMany: {
          filter: {
            exchange: "COINGECKO",
            symbol: sym,
            $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }],
          },
          update: {
            $set: { iconUrl: coin.image, logoValidatedAt: new Date(), logoAttempts: 0 },
          },
        },
      });
    }

    if (ops.length > 0) {
      const result = await SymbolModel.bulkWrite(ops, { ordered: false });
      resolved += result.modifiedCount;
      for (const op of ops) {
        unresolvedSymbols.delete(op.updateMany.filter.symbol);
      }
    }

    processed += coins.length;
    logger.info("coingecko_scraper_page_done", { page, coinsOnPage: coins.length, opsRun: ops.length, resolved, processed });
    options?.onProgress?.({ processed, resolved, total: unresolvedCount });

    if (page < maxPages && coins.length === PAGE_SIZE) {
      await sleep(PAGE_DELAY_MS);
    }
  }

  logger.info("coingecko_scraper_complete", { processed, resolved });
  return { processed, resolved };
}