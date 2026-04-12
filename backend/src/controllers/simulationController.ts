import { NextFunction, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import { SimulationService } from "../services/simulationService";
import { fetchAssetCatalogFilters } from "../services/assetCatalogService";
import { mapCategoryToSymbolType, searchSymbols, toAssetSearchItem } from "../services/symbol.service";
import { AppError } from "../utils/appError";
import { requireUserId } from "../utils/request";
import { mapServiceError } from "../utils/serviceError";

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

      const queryType = typeof req.query.type === "string"
        ? req.query.type
        : mapCategoryToSymbolType(category);

      const userId = req.user?.userId;
      let payload;
      try {
        payload = await searchSymbols({
          query: typeof req.query.q === "string" ? req.query.q : "",
          type: queryType,
          country: typeof req.query.country === "string" ? req.query.country : undefined,
          limit: safeLimit,
          cursor,
          userId,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "INVALID_CURSOR_TOKEN") {
          throw new AppError(400, "INVALID_CURSOR_TOKEN", "Cursor token is invalid");
        }
        throw error;
      }

      res.json({
        assets: payload.items.map((item) => toAssetSearchItem(item)),
        total: payload.total,
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
