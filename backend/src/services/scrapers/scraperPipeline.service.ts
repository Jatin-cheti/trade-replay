import pLimit from "p-limit";
import { connectDB } from "../../config/db";
import { SymbolModel } from "../../models/Symbol";
import { logger } from "../../utils/logger";
import { runCoinGeckoFullScraper } from "./coingeckoScraper.service";
import { searchDomainDDG, extractDomainFromUrl } from "./ddgSearch.service";
import { pickBestDomain } from "./domainMatcher.service";
import { extractLogoFromWebsite } from "./logoExtractor.service";
import { saveToDomainDataset } from "../curatedDomainDataset.service";
import { rememberResolvedDomain } from "../domainMemory.service";
import { invalidateSymbolCaches } from "../cacheInvalidation.service";
import { getFmpKey } from "../apiKeyManager.service";

const STOCK_BATCH_SIZE = 200;
const STOCK_CONCURRENCY = 15;
const LOOP_SLEEP_MS = 10_000;
const DOMAIN_MIN_SCORE = 0.2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function googleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function fmpImageUrl(symbol: string): string {
  const key = getFmpKey();
  const suffix = key ? `?apikey=${encodeURIComponent(key)}` : "";
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png${suffix}`;
}

function clearbitLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${encodeURIComponent(domain)}`;
}

async function validateLogoUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, headers: { "User-Agent": "tradereplay-scraper/1.0" } });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    const cl = parseInt(res.headers.get("content-length") || "0", 10);
    if (ct.includes("text/html")) return false;
    if (cl > 0 && cl < 100) return false;
    return true;
  } catch { return false; }
}

async function resolveStockViaScrapers(item: {
  symbol: string; fullSymbol: string; name: string; exchange: string; country: string;
}): Promise<{ logoUrl: string; domain: string } | null> {
  // Strategy 1: FMP direct image
  const fmpUrl = fmpImageUrl(item.symbol);
  if (await validateLogoUrl(fmpUrl)) {
    return { logoUrl: fmpUrl, domain: "financialmodelingprep.com" };
  }

  // Strategy 2: Domain inference + Clearbit + logo extraction
  const searchUrls = await searchDomainDDG(item.name);
  if (searchUrls.length > 0) {
    const bestDomain = pickBestDomain(item.name, searchUrls, DOMAIN_MIN_SCORE);
    if (bestDomain) {
      // Try Clearbit first (fast, high quality)
      const clearbitUrl = clearbitLogoUrl(bestDomain);
      if (await validateLogoUrl(clearbitUrl)) {
        return { logoUrl: clearbitUrl, domain: bestDomain };
      }

      // Try website scraping
      const extractedLogo = await extractLogoFromWebsite(bestDomain);
      if (extractedLogo && await validateLogoUrl(extractedLogo)) {
        return { logoUrl: extractedLogo, domain: bestDomain };
      }

      // Try Google favicon for the verified domain
      const faviconUrl = googleFaviconUrl(bestDomain);
      if (await validateLogoUrl(faviconUrl)) {
        return { logoUrl: faviconUrl, domain: bestDomain };
      }
    }
  }

  // Strategy 3: Google favicon with symbol ticker as domain hint
  const tickerDomain = `${item.symbol.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
  const tickerFavicon = googleFaviconUrl(tickerDomain);
  if (await validateLogoUrl(tickerFavicon)) {
    return { logoUrl: tickerFavicon, domain: tickerDomain };
  }

  return null;
}

async function processStockBatch(attemptCutoff: number): Promise<{ processed: number; resolved: number; symbols: string[] }> {
  const batch = await SymbolModel.find({
    type: "stock",
    $and: [
      { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] },
      { $or: [{ lastLogoAttemptAt: { $exists: false } }, { lastLogoAttemptAt: null }, { lastLogoAttemptAt: { $lt: attemptCutoff } }] },
    ],
  })
    .sort({ searchFrequency: -1, popularity: -1 })
    .limit(STOCK_BATCH_SIZE)
    .select({ symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1 })
    .lean<Array<{ symbol: string; fullSymbol: string; name: string; exchange: string; country: string }>>()
    .exec();

  if (batch.length === 0) return { processed: 0, resolved: 0, symbols: [] };

  const limit = pLimit(STOCK_CONCURRENCY);
  let resolved = 0;
  const processedSymbols = batch.map((b) => b.fullSymbol);

  await Promise.allSettled(
    batch.map((item) =>
      limit(async () => {
        try {
          const result = await resolveStockViaScrapers(item);
          if (!result) return;

          const updated = await SymbolModel.updateOne(
            { fullSymbol: item.fullSymbol, $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] },
            { $set: { iconUrl: result.logoUrl, companyDomain: result.domain, logoValidatedAt: new Date(), logoAttempts: 0, lastLogoAttemptAt: Date.now() } },
          );

          if (updated.modifiedCount > 0) {
            resolved++;
            if (result.domain !== "financialmodelingprep.com") {
              await saveToDomainDataset(item.symbol, result.domain, 0.9).catch(() => {});
              await rememberResolvedDomain({ symbol: item.symbol, domain: result.domain, confidence: 0.9, source: "scraper-pipeline", companyName: item.name }).catch(() => {});
            }
            await invalidateSymbolCaches(item.fullSymbol).catch(() => {});
          }
        } catch (error) {
          logger.warn("stock_resolve_error", { symbol: item.symbol, message: error instanceof Error ? error.message : String(error) });
        }
      }),
    ),
  );

  // Mark ALL processed items (success + failure) with attempt time so they get skipped next batch
  if (processedSymbols.length > 0) {
    await SymbolModel.updateMany(
      { fullSymbol: { $in: processedSymbols }, $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] },
      { $set: { lastLogoAttemptAt: Date.now() } },
    ).exec();
  }

  return { processed: batch.length, resolved, symbols: processedSymbols };
}

async function processAllStocks(): Promise<{ processed: number; resolved: number }> {
  let totalProcessed = 0;
  let totalResolved = 0;
  let batchNum = 0;
  const cutoff = Date.now() - 60000; // skip anything attempted within last minute

  while (true) {
    batchNum++;
    const result = await processStockBatch(cutoff);
    totalProcessed += result.processed;
    totalResolved += result.resolved;

    logger.info("scraper_stock_batch_done", { batch: batchNum, batchProcessed: result.processed, batchResolved: result.resolved, totalProcessed, totalResolved });

    if (result.processed === 0) break;
    await sleep(500);
  }

  return { processed: totalProcessed, resolved: totalResolved };
}

async function processCryptoBatch(): Promise<{ processed: number; resolved: number }> {
  const unresolvedCount = await SymbolModel.countDocuments({
    exchange: "COINGECKO",
    $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }],
  });

  return { processed: 0, resolved: 0 }; // Skip crypto - already maxed CoinGecko markets API

  logger.info("scraper_pipeline_crypto_phase", { unresolved: unresolvedCount });
  try {
    return await runCoinGeckoFullScraper({ limit: 10000 });
  } catch (error) {
    const message = String(error);
    logger.error("scraper_pipeline_crypto_error", { message });
    return { processed: 0, resolved: 0 };
  }
}

async function getCoverageStats(): Promise<{ total: number; withIcon: number; coverage: number }> {
  const [total, withIcon] = await Promise.all([
    SymbolModel.estimatedDocumentCount(),
    SymbolModel.countDocuments({ iconUrl: { $ne: "", $exists: true } }),
  ]);
  return { total, withIcon, coverage: total > 0 ? (withIcon / total) * 100 : 0 };
}

export async function runScraperPipeline(): Promise<void> {
  await connectDB();
  logger.info("scraper_pipeline_start");

  let cycle = 0;

  while (true) {
    cycle++;
    const stats = await getCoverageStats();
    logger.info("scraper_pipeline_cycle", { cycle, ...stats, coveragePercent: stats.coverage.toFixed(2) });

    if (stats.coverage >= 99.9) {
      logger.info("scraper_pipeline_target_reached", stats);
      break;
    }

    // Phase 1: CoinGecko bulk markets
    const cryptoResult = await processCryptoBatch();
    logger.info("scraper_pipeline_crypto_result", cryptoResult);

    // Phase 2: Stock resolution Ã¢â‚¬â€ process ALL unresolved stocks
    const stockUnresolved = await SymbolModel.countDocuments({
      type: "stock",
      $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }],
    });

    if (stockUnresolved > 0) {
      logger.info("scraper_pipeline_stock_phase", { unresolved: stockUnresolved });
      const stockResult = await processAllStocks();
      logger.info("scraper_pipeline_stock_result", stockResult);
    }

    const postStats = await getCoverageStats();
    logger.info("scraper_pipeline_cycle_end", { cycle, ...postStats, coveragePercent: postStats.coverage.toFixed(2) });

    await sleep(LOOP_SLEEP_MS);
  }
}