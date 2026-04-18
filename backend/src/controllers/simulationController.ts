import { NextFunction, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import { SimulationService } from "../services/simulationService";
import { fetchAssetCatalogFilters } from "../services/assetCatalogService";
import { mapCategoryToSymbolType, searchSymbols, toAssetSearchItem } from "../services/symbol.service";
import { buildCountryFilterInput, matchesCountryFlexible } from "../services/symbol.helpers";
import { AppError } from "../utils/appError";
import { requireUserId } from "../utils/request";
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

function matchesAssetFilters(asset: ReturnType<typeof toAssetSearchItem>, filters: {
  category?: string;
  country?: string;
  source?: string;
  exchangeType?: string;
  futureCategory?: string;
  economyCategory?: string;
}): boolean {
  if (filters.category && asset.category.toLowerCase() !== filters.category) return false;
  if (filters.country && !matchesCountryFlexible(String(asset.country || ""), String(asset.exchange || ""), filters.country)) return false;
  if (filters.source && String(asset.source || "").toLowerCase() !== filters.source) return false;
  if (filters.exchangeType && String(asset.exchangeType || "").toLowerCase() !== filters.exchangeType) return false;
  if (filters.futureCategory && String(asset.futureCategory || "").toLowerCase() !== filters.futureCategory) return false;
  if (filters.economyCategory && String(asset.economyCategory || "").toLowerCase() !== filters.economyCategory) return false;
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
      const headerCountry = (
        req.headers["x-user-country"]
        || req.headers["x-vercel-ip-country"]
        || req.headers["cf-ipcountry"]
        || req.headers["x-country"]
      )?.toString();
      const userCountry = buildCountryFilterInput(headerCountry)?.code;

      const queryType = typeof req.query.type === "string"
        ? req.query.type
        : mapCategoryToSymbolType(category);

      const userId = req.user?.userId;
      let payload;
      try {
        payload = await searchSymbols({
          query: typeof req.query.q === "string" ? req.query.q : "",
          type: queryType,
          country: requestedCountry,
          limit: safeLimit,
          cursor,
          userId,
          userCountry,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "INVALID_CURSOR_TOKEN") {
          throw new AppError(400, "INVALID_CURSOR_TOKEN", "Cursor token is invalid");
        }
        throw error;
      }

      let assets = payload.items
        .map((item) => toAssetSearchItem(item))
        .filter((asset) => matchesAssetFilters(asset, {
          category: requestedCategory,
          country: requestedCountry,
          source: requestedSource,
          exchangeType: requestedExchangeType,
          futureCategory: requestedFutureCategory,
          economyCategory: requestedEconomyCategory,
        }));

      let total = payload.total;

      if (requestedCountry && assets.length < Math.min(50, safeLimit)) {
        const relaxedPayload = await searchSymbols({
          query: typeof req.query.q === "string" ? req.query.q : "",
          type: queryType,
          country: undefined,
          limit: Math.max(100, safeLimit),
          cursor,
          userId,
          userCountry: userCountry || requestedCountry,
        });

        const relaxedAssets = relaxedPayload.items
          .map((item) => toAssetSearchItem(item))
          .filter((asset) => matchesAssetFilters(asset, {
            category: requestedCategory,
            country: requestedCountry,
            source: requestedSource,
            exchangeType: requestedExchangeType,
            futureCategory: requestedFutureCategory,
            economyCategory: requestedEconomyCategory,
          }));

        if (relaxedAssets.length > assets.length) {
          assets = relaxedAssets.slice(0, safeLimit);
          total = Math.max(relaxedPayload.total, relaxedAssets.length);
        }
      }

      const requestedQuery = typeof req.query.q === "string" ? req.query.q : "";
      assets = prioritizeDefaultBluechips(assets, requestedCategory, requestedCountry, requestedQuery);

      logger.info("search_debug_assets", {
        countryReceived: requestedCountry || "(none)",
        userCountry: userCountry || "(none)",
        query: requestedQuery,
        category: requestedCategory || "(none)",
        symbolsBeforeFilter: payload.items.length,
        symbolsAfterFilter: assets.length,
      });

      res.json({
        assets,
        total,
        page: 1,
        limit: safeLimit,
        hasMore: payload.hasMore,
        nextCursor: payload.nextCursor,
      });
    },

    assetFilters: async (req: AuthenticatedRequest, res: Response) => {
      const payload = await fetchAssetCatalogFilters({
        category: typeof req.query.category === "string" ? req.query.category : undefined,
      });

      res.json(payload);
    },
  };
}
