import { NextFunction, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import { SimulationService } from "../services/simulationService";
import { fetchAssetCatalogFilters, searchAssetCatalog } from "../services/assetCatalogService";
import { mapCategoryToSymbolType, searchSymbols, toAssetSearchItem } from "../services/symbol.service";
import { buildCountryFilterInput, escapeRegex, matchesCountryFlexible } from "../services/symbol.helpers";
import { isRedisReady, redisClient } from "../config/redis";
import { CleanAssetModel } from "../models/CleanAsset";
import { SymbolModel } from "../models/Symbol";
import { AppError } from "../utils/appError";
import { requireUserId } from "../utils/request";
import { getLiveQuotes } from "../services/snapshotEngine.service";
import { detectQueryIntent, recordSearchClick, recordSearchImpressions } from "../services/searchIndex.service";
import { mapServiceError } from "../utils/serviceError";
import { logger } from "../utils/logger";

const upload = multer({ storage: multer.memoryStorage() });
export const csvUploadMiddleware = upload.single("file");

const initSchema = z.object({
  scenarioId: z.string().min(1),
  symbol: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  portfolioId: z.string().optional(),
});

const controlSchema = z.object({
  action: z.enum(["play", "pause", "step-forward", "step-backward"]),
  speed: z.number().min(0.5).max(10).optional(),
});

const seekSchema = z.object({ index: z.number().int().min(0) });
const tradeSchema = z.object({ type: z.enum(["BUY", "SELL"]), quantity: z.number().int().positive() });
const currencySchema = z.object({ currency: z.enum(["USD", "INR", "EUR", "GBP", "JPY"]) });

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "all") return undefined;
  return normalized;
}

function normalizeCategory(value: unknown): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) return undefined;
  if (normalized === "stock") return "stocks";
  if (normalized === "fund") return "funds";
  if (normalized === "future") return "futures";
  if (normalized === "index") return "indices";
  if (normalized === "bond") return "bonds";
  if (normalized === "economic") return "economy";
  if (normalized === "option") return "options";
  return normalized;
}

type UiAsset = ReturnType<typeof toAssetSearchItem>;

function isOptionContractLabel(symbol: string, name: string): boolean {
  const sym = symbol.toUpperCase();
  const label = name.toUpperCase();
  return /-\d{6}-[CP]-/.test(sym)
    || /(^|[-_.])(CE|PE)([-_.]|$)/.test(sym)
    || /\b(OPTION|OPTIONS|CALL|PUT)\b/.test(label);
}

function isFutureContractLabel(symbol: string, name: string): boolean {
  const sym = symbol.toUpperCase();
  const label = name.toUpperCase();
  return sym.includes("-FUT")
    || sym.includes("-PERP")
    || /-F-\d{6}$/.test(sym)
    || /\b(FUTURE|FUTURES|PERPETUAL|PERP)\b/.test(label);
}

function normalizeCompanyRoot(item: Pick<UiAsset, "symbol" | "ticker" | "name">): string {
  const ticker = String(item.symbol || item.ticker || "").toUpperCase();
  const strippedTicker = ticker
    .replace(/-F-\d{6}$/g, "")
    .replace(/-\d{6}-[CP]-.+$/g, "")
    .replace(/-PERP$/g, "")
    .replace(/-FUT$/g, "")
    .replace(/\..+$/g, "")
    .replace(/[^A-Z0-9]/g, "");

  if (strippedTicker) {
    return strippedTicker;
  }

  const name = String(item.name || "")
    .toUpperCase()
    .replace(/\b(LIMITED|LTD\.?|INC\.?|CORP\.?|CORPORATION|CO\.?|PLC|HOLDINGS?)\b/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return "";
  return name.split(" ")[0] || "";
}

function pickExistingLogo(item: UiAsset): string {
  return String(item.displayIconUrl || item.logoUrl || item.iconUrl || "");
}

/** Enrich assets with live snapshot prices. O(n) via Map lookup. */
async function enrichWithSnapshotPrices(assets: UiAsset[]): Promise<UiAsset[]> {
  if (assets.length === 0) return assets;
  const symbols = assets.map((a) => (a.symbol || a.ticker || "").toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return assets;
  try {
    const { quotes } = await getLiveQuotes({ symbols });
    return assets.map((asset) => {
      const key = (asset.symbol || asset.ticker || "").toUpperCase();
      const quote = quotes[key];
      if (!quote) return asset;
      return {
        ...asset,
        price: quote.price ?? asset.price,
        change: quote.change ?? asset.change,
        changePercent: quote.changePercent ?? asset.changePercent,
        pnl: quote.change ?? asset.pnl,
        volume: quote.volume && quote.volume > 0 ? quote.volume : asset.volume,
      };
    });
  } catch {
    return assets;
  }
}

async function applyLogoReuse(assets: UiAsset[]): Promise<UiAsset[]> {
  if (assets.length === 0) return assets;

  const baseToLogo = new Map<string, string>();
  const unresolvedBases = new Set<string>();

  for (const asset of assets) {
    const base = normalizeCompanyRoot(asset);
    if (!base) continue;
    const logo = pickExistingLogo(asset);
    if (logo) {
      baseToLogo.set(base, logo);
    } else {
      unresolvedBases.add(base);
    }
  }

  if (isRedisReady() && unresolvedBases.size > 0) {
    const unresolvedList = Array.from(unresolvedBases);
    const redisKeys = unresolvedList.map((base) => `logo-reuse:${base}`);
    const cached = await redisClient.mget(redisKeys).catch(() => [] as Array<string | null>);
    unresolvedList.forEach((base, index) => {
      const cachedLogo = cached[index];
      if (cachedLogo) {
        baseToLogo.set(base, cachedLogo);
      }
    });
  }

  const patched = assets.map((asset) => {
    const existing = pickExistingLogo(asset);
    if (existing) return asset;

    const base = normalizeCompanyRoot(asset);
    if (!base) return asset;
    const reused = baseToLogo.get(base);
    if (!reused) return asset;

    return {
      ...asset,
      logoUrl: reused,
      displayIconUrl: reused,
      iconUrl: asset.iconUrl || reused,
      isFallback: false,
      source: `${asset.source || "symbol-registry"}+logo-reuse`,
    };
  });

  if (isRedisReady() && baseToLogo.size > 0) {
    const pipeline = redisClient.pipeline();
    for (const [base, logo] of baseToLogo.entries()) {
      pipeline.setex(`logo-reuse:${base}`, 3600, logo);
    }
    void pipeline.exec().catch(() => {});
  }

  return patched;
}

function matchesAssetFilters(asset: ReturnType<typeof toAssetSearchItem>, filters: {
  category?: string;
  country?: string;
  type?: string;
  sector?: string;
  source?: string;
  exchangeType?: string;
  futureCategory?: string;
  economyCategory?: string;
  expiry?: string;
  strike?: string;
  underlyingAsset?: string;
}): boolean {
  if (filters.category && asset.category.toLowerCase() !== filters.category) return false;
  if (filters.country && !matchesCountryFlexible(String(asset.country || ""), String(asset.exchange || ""), filters.country)) return false;
  if (filters.type && String(asset.type || "").toLowerCase() !== filters.type) return false;
  if (filters.sector && String(asset.sector || "").toLowerCase() !== filters.sector) return false;
  // For indices, source filter can match either the source field or country code
  if (filters.source) {
    const assetSource = String(asset.source || "").toLowerCase();
    const assetCountry = String(asset.country || "").toLowerCase();
    if (assetSource !== filters.source && assetCountry !== filters.source) return false;
  }
  if (filters.exchangeType && String(asset.exchangeType || "").toLowerCase() !== filters.exchangeType) return false;
  if (filters.futureCategory && String(asset.futureCategory || "").toLowerCase() !== filters.futureCategory) return false;
  if (filters.economyCategory && String(asset.economyCategory || "").toLowerCase() !== filters.economyCategory) return false;
  if (filters.expiry && String((asset as Record<string, unknown>).expiry || "").toLowerCase() !== filters.expiry) return false;
  if (filters.strike && String((asset as Record<string, unknown>).strike || "").toLowerCase() !== filters.strike) return false;
  if (filters.underlyingAsset && String((asset as Record<string, unknown>).underlyingAsset || "").toLowerCase() !== filters.underlyingAsset) return false;
  return true;
}

function prioritizeDefaultBluechips(
  assets: Array<ReturnType<typeof toAssetSearchItem>>,
  category: string | undefined,
  country: string | undefined,
  query: string,
): Array<ReturnType<typeof toAssetSearchItem>> {
  if (query.trim().length > 0) return assets;
  if (category !== "stocks") return assets;

  const normalizedCountry = (country || "").toUpperCase();
  const defaultBluechipsByCountry: Record<string, string[]> = {
    IN: [
      "RELIANCE",
      "TCS",
      "HDFCBANK",
      "ICICIBANK",
      "INFY",
      "SBIN",
      "BHARTIARTL",
      "ITC",
      "LT",
      "HINDUNILVR",
      "AXISBANK",
      "KOTAKBANK",
      "BAJFINANCE",
      "MARUTI",
      "TITAN",
      "SUNPHARMA",
      "ULTRACEMCO",
      "M&M",
      "NTPC",
      "POWERGRID",
    ],
  };

  const bluechips = defaultBluechipsByCountry[normalizedCountry];
  if (!bluechips || bluechips.length === 0) return assets;

  const rankMap = new Map<string, number>(bluechips.map((symbol, index) => [symbol, index]));

  return [...assets].sort((left, right) => {
    const leftKey = String(left.symbol || left.ticker || "").toUpperCase();
    const rightKey = String(right.symbol || right.ticker || "").toUpperCase();

    const leftRank = rankMap.get(leftKey);
    const rightRank = rankMap.get(rightKey);
    const leftPinned = leftRank !== undefined;
    const rightPinned = rightRank !== undefined;

    if (leftPinned && rightPinned) return (leftRank as number) - (rightRank as number);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;

    const rightLiquidity = Number(right.liquidityScore || 0);
    const leftLiquidity = Number(left.liquidityScore || 0);
    if (rightLiquidity !== leftLiquidity) return rightLiquidity - leftLiquidity;

    const rightMarketCap = Number(right.marketCap || 0);
    const leftMarketCap = Number(left.marketCap || 0);
    if (rightMarketCap !== leftMarketCap) return rightMarketCap - leftMarketCap;

    return String(leftKey).localeCompare(String(rightKey));
  });
}

export function createSimulationController(service: SimulationService) {
  return {
    init: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = initSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_INIT_PAYLOAD", "Invalid init payload"));
        return;
      }
      try {
        res.json(await service.init(userId, parsed.data));
      } catch (error) {
        next(mapServiceError(error, "SIMULATION_INIT_FAILED", "Simulation init failed"));
      }
    },

    control: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = controlSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_CONTROL_PAYLOAD", "Invalid control payload"));
        return;
      }
      try {
        res.json(await service.control(userId, parsed.data.action, parsed.data.speed));
      } catch (error) {
        next(mapServiceError(error, "SIMULATION_CONTROL_FAILED", "Simulation control failed"));
      }
    },

    seek: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = seekSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_SEEK_PAYLOAD", "Invalid seek payload"));
        return;
      }
      try {
        res.json(await service.seek(userId, parsed.data.index));
      } catch (error) {
        next(mapServiceError(error, "SIMULATION_SEEK_FAILED", "Simulation seek failed"));
      }
    },

    trade: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = tradeSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_TRADE_PAYLOAD", "Invalid trade payload"));
        return;
      }
      try {
        res.json(await service.executeTrade(userId, parsed.data));
      } catch (error) {
        next(mapServiceError(error, "SIMULATION_TRADE_FAILED", "Simulation trade failed"));
      }
    },

    setCurrency: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = currencySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_CURRENCY_PAYLOAD", "Invalid currency payload"));
        return;
      }
      res.json(await service.updateCurrency(userId, parsed.data.currency));
    },

    importPortfolio: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      if (!req.file) {
        next(new AppError(400, "MISSING_CSV_FILE", "CSV file is required"));
        return;
      }
      const payload = await service.importPortfolioCsv(userId, req.file.buffer.toString("utf8"));
      res.json(payload);
    },

    state: async (req: AuthenticatedRequest, res: Response) => {
      const userId = requireUserId(req);
      res.json(await service.getState(userId));
    },

    assets: async (req: AuthenticatedRequest, res: Response) => {
      const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 50;
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 50;
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const requestedQuery = typeof req.query.q === "string" ? req.query.q : "";

      const category = typeof req.query.category === "string"
        ? req.query.category
        : typeof req.query.market === "string"
          ? req.query.market
          : undefined;

      const requestedCategory = normalizeCategory(category);
      const requestedCountryRaw = normalizeOptional(req.query.country);
      const requestedCountry = buildCountryFilterInput(requestedCountryRaw)?.code;
      const requestedSource = normalizeOptional(req.query.source);
      const requestedExchangeType = normalizeOptional(req.query.exchangeType);
      const requestedFutureCategory = normalizeOptional(req.query.futureCategory);
      const requestedEconomyCategory = normalizeOptional(req.query.economyCategory);
      const requestedType = normalizeOptional(req.query.type);
      const requestedSector = normalizeOptional(req.query.sector);
      const requestedExpiry = normalizeOptional(req.query.expiry);
      const requestedStrike = normalizeOptional(req.query.strike);
      const requestedUnderlyingAsset = normalizeOptional(req.query.underlyingAsset);
      const headerCountry = (
        req.headers["x-user-country"]
        || req.headers["x-vercel-ip-country"]
        || req.headers["cf-ipcountry"]
        || req.headers["x-country"]
      )?.toString();
      const userCountry = buildCountryFilterInput(headerCountry)?.code;

      // Always use the category-based type for DB search; UI type filter is applied separately
      const queryType = mapCategoryToSymbolType(category);

      const userId = req.user?.userId;
      const assetFilters = {
        category: requestedCategory,
        country: requestedCountry,
        type: requestedType,
        sector: requestedSector,
        source: requestedSource,
        exchangeType: requestedExchangeType,
        futureCategory: requestedFutureCategory,
        economyCategory: requestedEconomyCategory,
        expiry: requestedExpiry,
        strike: requestedStrike,
        underlyingAsset: requestedUnderlyingAsset,
      };

      // ── Over-fetch factor: when post-filters are active we need more candidates ──
      const hasPostFilters = !!(requestedCategory || requestedType || requestedSector ||
        requestedSource || requestedExchangeType || requestedFutureCategory ||
        requestedEconomyCategory || requestedExpiry || requestedStrike || requestedUnderlyingAsset);
      const fetchLimit = hasPostFilters ? Math.min(100, safeLimit * 3) : safeLimit;
      const maxScanPages = hasPostFilters ? 6 : 3;

      const fetchFilteredWindow = async (countryForSearch?: string) => {
        let scanCursor = cursor?.startsWith("off:") ? undefined : cursor;
        let totalHint = 0;
        let scannedRows = 0;
        let hasMore = false;
        let nextCursor: string | null = null;
        const deduped = new Map<string, UiAsset>();

        for (let page = 0; page < maxScanPages; page += 1) {
          let payload;
          try {
            payload = await searchSymbols({
              query: requestedQuery,
              type: queryType,
              country: countryForSearch,
              limit: fetchLimit,
              cursor: scanCursor,
              userId,
              userCountry,
              forceCursorMode: true,
            });
          } catch (error) {
            if (error instanceof Error && error.message === "INVALID_CURSOR_TOKEN") {
              throw new AppError(400, "INVALID_CURSOR_TOKEN", "Cursor token is invalid");
            }
            throw error;
          }

          if (payload.total > 0) {
            totalHint = Math.max(totalHint, payload.total);
          }

          scannedRows += payload.items.length;
          const filteredBatch = payload.items
            .map((item) => toAssetSearchItem(item))
            .filter((asset) => matchesAssetFilters(asset, assetFilters));

          for (const asset of filteredBatch) {
            const key = `${asset.category}|${asset.exchange}|${asset.symbol}`;
            if (!deduped.has(key)) {
              deduped.set(key, asset);
            }
          }

          hasMore = Boolean(payload.hasMore && payload.nextCursor);
          nextCursor = hasMore ? payload.nextCursor ?? null : null;

          if (deduped.size >= safeLimit) {
            break;
          }
          if (!payload.hasMore || !payload.nextCursor) {
            break;
          }

          scanCursor = payload.nextCursor;
        }

        return {
          assets: Array.from(deduped.values()),
          totalHint,
          scannedRows,
          hasMore,
          nextCursor,
        };
      };

      const buildCleanAssetsFallback = async (requestedCount: number, offset = 0): Promise<UiAsset[]> => {
        const resolvedRequestedCategory = requestedCategory || "all";
        if (resolvedRequestedCategory === "all" && !requestedQuery.trim()) return [];

        const categoryTypeMap: Record<string, string> = {
          stocks: "stock",
          funds: "etf",
          crypto: "crypto",
          forex: "forex",
          indices: "index",
          bonds: "bond",
          economy: "economy",
          futures: "derivative",
          options: "derivative",
        };

        const cleanType = categoryTypeMap[resolvedRequestedCategory];

        const andFilters: Array<Record<string, unknown>> = [{ isActive: true }];

        if (cleanType) {
          andFilters.push({ type: cleanType });
        }

        if (requestedCountry) {
          const countryInput = buildCountryFilterInput(requestedCountry);
          if (countryInput) {
            const countryOrExchange: Array<Record<string, unknown>> = [
              { country: { $in: countryInput.aliases } },
            ];
            if (countryInput.exchanges.length > 0) {
              countryOrExchange.push({ exchange: { $in: countryInput.exchanges } });
            }
            andFilters.push({ $or: countryOrExchange });
          }
        }

        if (requestedQuery.trim()) {
          const escapedQuery = escapeRegex(requestedQuery.trim());
          if (requestedQuery.trim().length <= 2) {
            andFilters.push({ symbol: { $regex: `^${escapedQuery}`, $options: "i" } });
          } else {
            andFilters.push({
              $or: [
                { symbol: { $regex: `^${escapedQuery}`, $options: "i" } },
                { name: { $regex: escapedQuery, $options: "i" } },
                { fullSymbol: { $regex: escapedQuery, $options: "i" } },
              ],
            });
          }
        }

        if (resolvedRequestedCategory === "options") {
          andFilters.push({
            $or: [
              { symbol: { $regex: "-\\d{6}-[CP]-", $options: "i" } },
              { symbol: { $regex: "(^|[-_.])(CE|PE)([-_.]|$)", $options: "i" } },
              { name: { $regex: "\\b(option|options|call|put)\\b", $options: "i" } },
            ],
          });
        }

        if (resolvedRequestedCategory === "futures") {
          andFilters.push({
            $or: [
              { symbol: { $regex: "-F-\\d{6}$", $options: "i" } },
              { symbol: { $regex: "-FUT", $options: "i" } },
              { symbol: { $regex: "-PERP", $options: "i" } },
              { name: { $regex: "\\b(future|futures|perpetual|perp)\\b", $options: "i" } },
            ],
          });
        }

        const cleanFilter: Record<string, unknown> = andFilters.length === 1
          ? andFilters[0]
          : { $and: andFilters };

        const docs = await CleanAssetModel.find(cleanFilter)
          .sort({ priorityScore: -1, marketCap: -1, liquidityScore: -1, _id: -1 })
          .skip(Math.max(0, offset))
          .limit(requestedCount)
          .lean();

        const categoryFromType = (typeValue: string): UiAsset["category"] => {
          if (typeValue === "stock") return "stocks";
          if (typeValue === "etf") return "funds";
          if (typeValue === "crypto") return "crypto";
          if (typeValue === "forex") return "forex";
          if (typeValue === "index") return "indices";
          if (typeValue === "bond") return "bonds";
          if (typeValue === "economy") return "economy";
          return "futures";
        };

        return docs.map((doc) => {
          const symbol = String(doc.symbol || "");
          const name = String(doc.name || "");
          const fromOptionsPattern = isOptionContractLabel(symbol, name);
          const fromFuturesPattern = isFutureContractLabel(symbol, name);

          const resolvedCategory = resolvedRequestedCategory === "all"
            ? categoryFromType(String(doc.type || "stock"))
            : resolvedRequestedCategory === "options"
              ? (fromOptionsPattern ? "options" : "options")
              : resolvedRequestedCategory === "futures"
                ? (fromFuturesPattern ? "futures" : "futures")
                : resolvedRequestedCategory;

          const logoUrl = String(doc.s3Icon || doc.iconUrl || "");

          return {
            ticker: symbol,
            symbol,
            name,
            exchange: String(doc.exchange || ""),
            region: String(doc.country || ""),
            instrumentType: String(doc.type || ""),
            type: String(doc.type || ""),
            category: resolvedCategory,
            assetType: resolvedCategory,
            market: (resolvedCategory.charAt(0).toUpperCase() + resolvedCategory.slice(1)) as UiAsset["market"],
            country: String(doc.country || ""),
            sector: String((doc as Record<string, unknown>).sector || ""),
            exchangeType: "",
            icon: logoUrl,
            exchangeIcon: "",
            exchangeLogoUrl: "",
            iconUrl: String(doc.iconUrl || ""),
            logoUrl,
            displayIconUrl: logoUrl,
            isFallback: !doc.iconUrl && !doc.s3Icon,
            source: String(doc.source || "clean-assets"),
            futureCategory: undefined,
            economyCategory: undefined,
            expiry: undefined,
            strike: undefined,
            underlyingAsset: undefined,
            contracts: undefined,
            price: 0,
            change: 0,
            changePercent: 0,
            pnl: 0,
            volume: doc.volume ?? 0,
            marketCap: doc.marketCap ?? 0,
            liquidityScore: doc.liquidityScore ?? 0,
          } as UiAsset;
        });
      };

      const decodeCategoryOffset = (rawCursor?: string): number => {
        if (!rawCursor || !rawCursor.startsWith("off:")) return 0;
        const parsed = Number.parseInt(rawCursor.slice(4), 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      };

      const mapCatalogAssetToUi = (item: Record<string, unknown> | any): UiAsset => ({
        ticker: String(item.ticker || ""),
        symbol: String(item.symbol || item.ticker || ""),
        name: String(item.name || ""),
        exchange: String(item.exchange || ""),
        region: String(item.country || item.region || ""),
        instrumentType: String(item.instrumentType || item.type || "stock") as UiAsset["instrumentType"],
        type: String(item.type || "stock") as UiAsset["type"],
        category: String(item.category || requestedCategory || "stocks") as UiAsset["category"],
        assetType: String(item.assetType || item.category || requestedCategory || "stocks") as UiAsset["assetType"],
        market: String(item.market || "Stocks") as UiAsset["market"],
        country: String(item.country || ""),
        sector: String(item.sector || ""),
        exchangeType: String(item.exchangeType || ""),
        icon: String(item.icon || ""),
        exchangeIcon: String(item.exchangeIcon || ""),
        exchangeLogoUrl: String(item.exchangeLogoUrl || ""),
        iconUrl: String(item.iconUrl || ""),
        logoUrl: String(item.logoUrl || item.iconUrl || ""),
        displayIconUrl: String(item.logoUrl || item.iconUrl || ""),
        isFallback: false,
        source: String(item.source || "catalog-seed"),
        futureCategory: item.futureCategory as string | undefined,
        economyCategory: item.economyCategory as string | undefined,
        expiry: item.expiry as string | undefined,
        strike: item.strike as string | undefined,
        underlyingAsset: item.underlyingAsset as string | undefined,
        price: 0,
        change: 0,
        changePercent: 0,
        pnl: 0,
        volume: 0,
        marketCap: 0,
        liquidityScore: 0,
      });

      /** Query Symbol collection directly for categories that are sparse in clean_assets. */
      const buildSymbolFallback = async (requestedCount: number, offset = 0): Promise<UiAsset[]> => {
        const resolvedCat = requestedCategory || "all";
        if (resolvedCat === "all" && !requestedQuery.trim()) return [];

        const categoryTypeMap: Record<string, string> = {
          stocks: "stock",
          funds: "etf",
          crypto: "crypto",
          forex: "forex",
          indices: "index",
          bonds: "bond",
          economy: "economy",
          futures: "derivative",
          options: "derivative",
        };

        const symType = categoryTypeMap[resolvedCat];

        const andFilters: Array<Record<string, unknown>> = [];
        if (symType) andFilters.push({ type: symType });

        if (requestedCountry) {
          const countryInput = buildCountryFilterInput(requestedCountry);
          if (countryInput) {
            const countryOrExchange: Array<Record<string, unknown>> = [
              { country: { $in: countryInput.aliases } },
            ];
            if (countryInput.exchanges.length > 0) {
              countryOrExchange.push({ exchange: { $in: countryInput.exchanges } });
            }
            andFilters.push({ $or: countryOrExchange });
          }
        }

        if (requestedQuery.trim()) {
          const escapedQuery = escapeRegex(requestedQuery.trim());
          // Short queries (≤2 chars): only match by symbol prefix to avoid name noise
          if (requestedQuery.trim().length <= 2) {
            andFilters.push({ symbol: { $regex: `^${escapedQuery}`, $options: "i" } });
          } else {
            andFilters.push({
              $or: [
                { symbol: { $regex: `^${escapedQuery}`, $options: "i" } },
                { name: { $regex: escapedQuery, $options: "i" } },
              ],
            });
          }
        }

        const filter: Record<string, unknown> = andFilters.length === 0
          ? {}
          : andFilters.length === 1
            ? andFilters[0]
            : { $and: andFilters };

        // Phase 1: find exact symbol match at the intent-appropriate exchange
        const stockExchanges = ["NASDAQ", "NYSE", "NSE", "BSE", "LSE", "TSE", "HKEX", "SSE", "SZSE", "ASX", "TSX", "EURONEXT", "XETRA", "NYSEARCA"];
        const cryptoExchanges = ["BINANCE", "COINBASE", "KRAKEN", "BYBIT", "OKX"];
        const queryIntent = detectQueryIntent(requestedQuery.trim());
        const pinnedExchanges = queryIntent === "crypto" ? cryptoExchanges : stockExchanges;
        let pinnedDoc: Record<string, unknown> | null = null;
        if (requestedQuery.trim() && offset === 0) {
          // For crypto intent, search for the query as USDT pair first (BTC → BTCUSDT)
          if (queryIntent === "crypto") {
            const cryptoSymbol = requestedQuery.trim().toUpperCase();
            pinnedDoc = await SymbolModel.findOne({
              $or: [
                { symbol: `${cryptoSymbol}USDT`, exchange: { $in: cryptoExchanges }, type: "crypto" },
                { symbol: cryptoSymbol, exchange: { $in: cryptoExchanges }, type: "crypto" },
              ],
            }).sort({ priorityScore: -1 }).lean() as Record<string, unknown> | null;
          }
          if (!pinnedDoc) {
            pinnedDoc = await SymbolModel.findOne({
              symbol: requestedQuery.trim().toUpperCase(),
              exchange: { $in: pinnedExchanges },
              ...(symType ? { type: symType } : {}),
            }).lean() as Record<string, unknown> | null;
          }
        }

        // Phase 2: normal regex query
        const docs = await SymbolModel.find(filter)
          .sort({ priorityScore: -1, marketCap: -1, liquidityScore: -1, _id: -1 })
          .skip(Math.max(0, offset))
          .limit(requestedCount)
          .lean();

        // Merge: pinned first, then rest (deduped)
        const pinnedId = pinnedDoc ? String(pinnedDoc._id) : null;
        const allDocs = pinnedDoc
          ? [pinnedDoc, ...docs.filter((d) => String(d._id) !== pinnedId)]
          : [...docs];
        const mapped = allDocs.slice(0, requestedCount).map((doc) => toAssetSearchItem(doc as any));

        // Rank exact symbol matches first, then prefer real exchanges over SEC/COINGECKO
        // Intent-aware: boost crypto results for crypto-intent queries (BTC, ETH, etc.)
        if (requestedQuery.trim()) {
          const upper = requestedQuery.trim().toUpperCase();
          const intent = detectQueryIntent(upper);
          const realExchanges = new Set(["NASDAQ", "NYSE", "NSE", "BSE", "LSE", "TSE", "HKEX", "SSE", "SZSE", "ASX", "TSX", "EURONEXT", "XETRA"]);
          const cryptoExchanges = new Set(["BINANCE", "COINBASE", "KRAKEN", "BYBIT", "OKX", "HUOBI"]);
          mapped.sort((a, b) => {
            const aSym = (a.symbol || a.ticker || "").toUpperCase();
            const bSym = (b.symbol || b.ticker || "").toUpperCase();

            // Intent boost: when intent is crypto, boost crypto results significantly
            const aIntentBoost = intent === "crypto" && a.type === "crypto" ? 100
              : intent === "crypto" && a.type !== "crypto" ? -50 : 0;
            const bIntentBoost = intent === "crypto" && b.type === "crypto" ? 100
              : intent === "crypto" && b.type !== "crypto" ? -50 : 0;
            if (aIntentBoost !== bIntentBoost) return bIntentBoost - aIntentBoost;

            // Exact symbol match first
            const aExact = aSym === upper ? 2 : 0;
            const bExact = bSym === upper ? 2 : 0;
            if (aExact !== bExact) return bExact - aExact;
            // Among exact matches, prefer real exchanges (or crypto exchanges for crypto intent)
            if (aExact && bExact) {
              const preferredExchanges = intent === "crypto" ? cryptoExchanges : realExchanges;
              const aReal = preferredExchanges.has((a.exchange || "").toUpperCase()) ? 1 : 0;
              const bReal = preferredExchanges.has((b.exchange || "").toUpperCase()) ? 1 : 0;
              if (aReal !== bReal) return bReal - aReal;
            }
            return 0; // preserve DB sort order
          });
        }

        return mapped;
      };

      // Fast path: query searches hit Symbol collection first, then clean_assets.
      if (requestedQuery.trim()) {
        const queryOffset = decodeCategoryOffset(cursor);
        let cleanQueryBatch = await buildSymbolFallback(safeLimit + 1, queryOffset);

        // Fallback to CleanAsset when Symbol collection yields nothing
        if (cleanQueryBatch.length === 0) {
          cleanQueryBatch = await buildCleanAssetsFallback(safeLimit + 1, queryOffset);
        }

        if (cleanQueryBatch.length > 0) {
          const hasMoreFromCleanQuery = cleanQueryBatch.length > safeLimit;
          const paged = await enrichWithSnapshotPrices(await applyLogoReuse(cleanQueryBatch.slice(0, safeLimit)));
          const nextCleanQueryCursor = hasMoreFromCleanQuery ? `off:${queryOffset + safeLimit}` : null;

          res.json({
            assets: paged,
            total: queryOffset + paged.length + (hasMoreFromCleanQuery ? 1 : 0),
            page: 1,
            limit: safeLimit,
            hasMore: hasMoreFromCleanQuery,
            nextCursor: nextCleanQueryCursor,
          });
          return;
        }
      }

      // Fast path: category browsing (empty query) reads from Symbol + CleanAsset with lightweight cursor.
      if (!requestedQuery.trim() && requestedCategory && requestedCategory !== "all") {
        const categoryOffset = decodeCategoryOffset(cursor);

        // Use Symbol collection as the primary paginated source for all categories
        const symbolBatch = await buildSymbolFallback(safeLimit + 1, categoryOffset);

        if (symbolBatch.length > 0) {
          const hasMore = symbolBatch.length > safeLimit;
          const paged = await enrichWithSnapshotPrices(await applyLogoReuse(symbolBatch.slice(0, safeLimit)));
          const nextCat = hasMore ? `off:${categoryOffset + safeLimit}` : null;

          // Get a proper total count for this category
          const categoryTypeMap: Record<string, string> = {
            stocks: "stock", funds: "etf", crypto: "crypto", forex: "forex",
            indices: "index", bonds: "bond", economy: "economy", futures: "derivative", options: "derivative",
          };
          const countType = categoryTypeMap[requestedCategory!];
          const totalCount = countType
            ? await SymbolModel.countDocuments({ type: countType }).catch(() => paged.length)
            : paged.length;

          const resolvedHasMore = hasMore || (categoryOffset + safeLimit < totalCount);
          const resolvedNextCursor = resolvedHasMore ? `off:${categoryOffset + safeLimit}` : null;

          res.json({
            assets: paged,
            total: Math.max(totalCount, categoryOffset + paged.length + (resolvedHasMore ? 1 : 0)),
            page: 1,
            limit: safeLimit,
            hasMore: resolvedHasMore,
            nextCursor: resolvedNextCursor,
          });
          return;
        }

        // CleanAsset fallback when Symbol collection has nothing for this category
        const cleanBatch = await buildCleanAssetsFallback(safeLimit + 1, categoryOffset);
        if (cleanBatch.length > 0) {
          const hasMoreFromClean = cleanBatch.length > safeLimit;
          const paged = await enrichWithSnapshotPrices(await applyLogoReuse(cleanBatch.slice(0, safeLimit)));
          const nextCategoryCursor = hasMoreFromClean ? `off:${categoryOffset + safeLimit}` : null;

          res.json({
            assets: paged,
            total: categoryOffset + paged.length + (hasMoreFromClean ? 1 : 0),
            page: 1,
            limit: safeLimit,
            hasMore: hasMoreFromClean,
            nextCursor: nextCategoryCursor,
          });
          return;
        }

        // Secondary fallback for sparse categories in clean_assets.
        const seedFallback = await searchAssetCatalog({
          q: requestedQuery,
          category: requestedCategory,
          country: requestedCountry,
          type: requestedType,
          sector: requestedSector,
          source: requestedSource,
          exchangeType: requestedExchangeType,
          futureCategory: requestedFutureCategory,
          economyCategory: requestedEconomyCategory,
          expiry: requestedExpiry,
          strike: requestedStrike,
          underlyingAsset: requestedUnderlyingAsset,
          limit: safeLimit,
        }).catch(() => ({ assets: [] as Array<Record<string, unknown>> }));

        if (seedFallback.assets.length > 0) {
          const mappedSeed = await enrichWithSnapshotPrices(await applyLogoReuse(seedFallback.assets.map((item) => mapCatalogAssetToUi(item))));
          res.json({
            assets: mappedSeed,
            total: mappedSeed.length,
            page: 1,
            limit: safeLimit,
            hasMore: false,
            nextCursor: null,
          });
          return;
        }
      }

      // Fast path: "All" category + empty query ➜ Symbol collection with offset pagination
      if (!requestedQuery.trim() && (!requestedCategory || requestedCategory === "all")) {
        const categoryOffset = decodeCategoryOffset(cursor);
        const allFilter: Record<string, unknown> = {};
        if (requestedCountry) {
          const countryInput = buildCountryFilterInput(requestedCountry);
          if (countryInput) {
            const countryOrExchange: Array<Record<string, unknown>> = [
              { country: { $in: countryInput.aliases } },
            ];
            if (countryInput.exchanges.length > 0) {
              countryOrExchange.push({ exchange: { $in: countryInput.exchanges } });
            }
            allFilter.$or = countryOrExchange;
          }
        }
        const allDocs = await SymbolModel.find(allFilter)
          .sort({ priorityScore: -1, marketCap: -1, liquidityScore: -1, _id: -1 })
          .skip(categoryOffset)
          .limit(safeLimit + 1)
          .lean();
        const allBatch = allDocs.map((doc) => toAssetSearchItem(doc as any));
        const allHasMore = allBatch.length > safeLimit;
        const allPaged = await enrichWithSnapshotPrices(await applyLogoReuse(allBatch.slice(0, safeLimit)));
        const allTotalCount = await SymbolModel.estimatedDocumentCount().catch(() => allPaged.length);
        const allResolvedHasMore = allHasMore || (categoryOffset + safeLimit < allTotalCount);
        res.json({
          assets: allPaged,
          total: allTotalCount,
          page: 1,
          limit: safeLimit,
          hasMore: allResolvedHasMore,
          nextCursor: allResolvedHasMore ? `off:${categoryOffset + safeLimit}` : null,
        });
        return;
      }

      const primaryWindow = await fetchFilteredWindow(requestedCountry);
      let assets = primaryWindow.assets;
      let nextCursor = primaryWindow.nextCursor;
      let actualHasMore = primaryWindow.hasMore;
      let totalHint = primaryWindow.totalHint;
      let scannedRows = primaryWindow.scannedRows;

      if (requestedCountry && !cursor && assets.length < Math.min(50, safeLimit)) {
        const relaxedWindow = await fetchFilteredWindow(undefined);
        if (relaxedWindow.assets.length > assets.length) {
          assets = relaxedWindow.assets;
          nextCursor = relaxedWindow.nextCursor;
          actualHasMore = relaxedWindow.hasMore;
          totalHint = Math.max(totalHint, relaxedWindow.totalHint);
          scannedRows = relaxedWindow.scannedRows;
        }
      }

      assets = prioritizeDefaultBluechips(assets, requestedCategory, requestedCountry, requestedQuery);

      // Fallback chain for empty categories: DB -> seed catalog -> clean_assets injection
      if (assets.length === 0 && requestedCategory && requestedCategory !== "all") {
        try {
          const catalogFallback = await searchAssetCatalog({
            q: requestedQuery,
            category: requestedCategory,
            country: requestedCountry,
            type: requestedType,
            sector: requestedSector,
            source: requestedSource,
            exchangeType: requestedExchangeType,
            futureCategory: requestedFutureCategory,
            economyCategory: requestedEconomyCategory,
            expiry: requestedExpiry,
            strike: requestedStrike,
            underlyingAsset: requestedUnderlyingAsset,
            limit: safeLimit,
          });

          if (catalogFallback.assets.length > 0) {
            assets = catalogFallback.assets.map((item) => mapCatalogAssetToUi(item));
            actualHasMore = false;
            nextCursor = null;
            totalHint = assets.length;
          }
        } catch {
          // Seed fallback is best-effort
        }
      }

      if (assets.length === 0 && requestedCategory && requestedCategory !== "all") {
        const cleanFallback = await buildCleanAssetsFallback(safeLimit);
        if (cleanFallback.length > 0) {
          assets = cleanFallback;
          actualHasMore = false;
          nextCursor = null;
          totalHint = cleanFallback.length;
        }
      }

      if (assets.length > 0 && assets.length < Math.min(5, safeLimit) && requestedCategory && requestedCategory !== "all") {
        const extraClean = await buildCleanAssetsFallback(safeLimit * 2);
        if (extraClean.length > 0) {
          const deduped = new Map<string, UiAsset>();
          for (const asset of [...assets, ...extraClean]) {
            const key = `${asset.category}|${asset.exchange}|${asset.symbol}`;
            if (!deduped.has(key)) {
              deduped.set(key, asset);
            }
          }
          assets = Array.from(deduped.values());
          totalHint = Math.max(totalHint, assets.length);
        }
      }

      assets = await enrichWithSnapshotPrices(await applyLogoReuse(assets));

      const trimmedAssets = assets.slice(0, safeLimit);
      const resolvedHasMore = Boolean(actualHasMore && nextCursor);
      const resolvedTotal = totalHint > 0
        ? Math.max(trimmedAssets.length, totalHint)
        : (resolvedHasMore ? trimmedAssets.length + 1 : trimmedAssets.length);

      logger.info("search_debug_assets", {
        countryReceived: requestedCountry || "(none)",
        userCountry: userCountry || "(none)",
        query: requestedQuery,
        category: requestedCategory || "(none)",
        symbolsBeforeFilter: scannedRows,
        symbolsAfterFilter: trimmedAssets.length,
        hasMore: resolvedHasMore,
      });

      res.json({
        assets: trimmedAssets,
        total: resolvedTotal,
        page: 1,
        limit: safeLimit,
        hasMore: resolvedHasMore,
        nextCursor: resolvedHasMore ? nextCursor : null,
      });
    },

    assetFilters: async (req: AuthenticatedRequest, res: Response) => {
      const payload = await fetchAssetCatalogFilters({
        category: typeof req.query.category === "string" ? req.query.category : undefined,
      });

      res.json(payload);
    },

    searchClick: async (req: AuthenticatedRequest, res: Response) => {
      const { query: q, symbol, exchange, position } = req.body as {
        query?: string;
        symbol?: string;
        exchange?: string;
        position?: number;
      };
      if (!q || !symbol) {
        res.status(400).json({ error: "query and symbol are required" });
        return;
      }
      // Fire-and-forget: record click with user dedup for CTR scoring + Kafka
      void recordSearchClick(q, symbol, req.user?.userId);
      try {
        const crypto = await import("node:crypto");
        const { produceSearchClick } = await import("../kafka/eventProducers");
        produceSearchClick({
          eventId: crypto.randomUUID(),
          timestamp: Date.now(),
          query: q,
          symbol,
          exchange: exchange ?? "",
          position: position ?? -1,
          userId: req.user?.userId,
        });
      } catch { /* kafka optional */ }
      res.json({ ok: true });
    },

    searchImpression: async (req: AuthenticatedRequest, res: Response) => {
      const { query: q, symbols } = req.body as {
        query?: string;
        symbols?: string[];
      };
      if (!q || !Array.isArray(symbols) || symbols.length === 0) {
        res.status(400).json({ error: "query and symbols[] are required" });
        return;
      }
      // Fire-and-forget: record impressions for CTR denominator
      void recordSearchImpressions(q, symbols);
      res.json({ ok: true });
    },
  };
}
