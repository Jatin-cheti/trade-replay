import { logger } from "../../utils/logger";
import type { GlobalSymbolCandidate, GlobalSymbolProvider } from "../globalSymbolIngestion.service";

const MARKETS_URL = "https://api.coingecko.com/api/v3/coins/markets";
const LIST_URL = "https://api.coingecko.com/api/v3/coins/list?include_platform=false";
const MARKETS_PAGES = 10;
const PER_PAGE = 250;
const SLEEP_MS = 1500;
const TIMEOUT_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "tradereplay-global-ingestion/1.0" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

type MarketCoin = { id?: string; symbol?: string; name?: string; image?: string };
type ListCoin = { id?: string; symbol?: string; name?: string };

export const coingeckoProvider: GlobalSymbolProvider = {
  name: "coingecko",
  fetchSymbols: async (): Promise<GlobalSymbolCandidate[]> => {
    const results: GlobalSymbolCandidate[] = [];
    const seenIds = new Set<string>();

    // Phase 1: top 2,500 coins from markets endpoint (includes image URLs)
    for (let page = 1; page <= MARKETS_PAGES; page++) {
      try {
        const url = `${MARKETS_URL}?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=${page}&sparkline=false`;
        const res = await fetchWithTimeout(url);
        if (res.status === 429) {
          logger.warn("coingecko_rate_limited", { page });
          await sleep(10000);
          page--; // retry same page
          continue;
        }
        if (!res.ok) {
          logger.warn("coingecko_markets_failed", { page, status: res.status });
          break;
        }
        const coins = (await res.json()) as MarketCoin[];
        let added = 0;
        for (const coin of coins) {
          if (!coin.symbol) continue;
          const id = coin.id || coin.symbol;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          results.push({
            symbol: coin.symbol.toUpperCase(),
            exchange: "COINGECKO",
            name: coin.name || coin.symbol || "",
            type: "crypto",
            country: "GLOBAL",
            currency: "USD",
            source: "coingecko",
            iconUrl: coin.image || undefined,
            metadata: { id },
          });
          added++;
        }
        logger.info("coingecko_markets_page", { page, added, total: results.length });
        if (coins.length < PER_PAGE) break;
        await sleep(SLEEP_MS);
      } catch (error) {
        logger.warn("coingecko_markets_page_error", {
          page,
          message: error instanceof Error ? error.message : String(error),
        });
        await sleep(SLEEP_MS * 2);
      }
    }

    // Phase 2: full list for tail symbols not in top 2,500 (no images)
    try {
      const res = await fetchWithTimeout(LIST_URL);
      if (res.ok) {
        const list = (await res.json()) as ListCoin[];
        let tailAdded = 0;
        for (const coin of list) {
          if (!coin.symbol) continue;
          const id = coin.id || coin.symbol;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          results.push({
            symbol: coin.symbol.toUpperCase(),
            exchange: "COINGECKO",
            name: coin.name || coin.symbol || "",
            type: "crypto",
            country: "GLOBAL",
            currency: "USD",
            source: "coingecko",
            metadata: { id },
          });
          tailAdded++;
        }
        logger.info("coingecko_tail_added", { tailAdded });
      }
    } catch (error) {
      logger.warn("coingecko_list_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info("coingecko_fetch_complete", { total: results.length });
    return results;
  },
};