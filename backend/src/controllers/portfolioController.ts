import { NextFunction, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import { requireUserId } from "../utils/request";
import { mapServiceError } from "../utils/serviceError";
import { AppError } from "../utils/appError";
import { ensurePortfolio } from "../services/portfolioService";
import {
  createSavedPortfolio,
  getSavedPortfolioById,
  importSavedPortfolioFromCsv,
  listSavedPortfolios,
  updateSavedPortfolio,
} from "../services/savedPortfolioService";

const upload = multer({ storage: multer.memoryStorage() });
export const portfolioCsvUploadMiddleware = upload.single("file");

const createSchema = z.object({
  name: z.string().min(2).max(80),
  baseCurrency: z.string().min(3).max(8).optional(),
  holdings: z.array(z.object({
    symbol: z.string().min(1),
    quantity: z.number().positive(),
    avgPrice: z.number().positive(),
  })).min(1),
});

export function createPortfolioController() {
  return {
    getCurrentPortfolio: async (req: AuthenticatedRequest, res: Response) => {
      const userId = requireUserId(req);
      res.json(await ensurePortfolio(userId));
    },

    listSaved: async (req: AuthenticatedRequest, res: Response) => {
      const userId = requireUserId(req);
      res.json(await listSavedPortfolios(userId));
    },

    getById: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      try {
        res.json(await getSavedPortfolioById(userId, String(req.params.portfolioId)));
      } catch (error) {
        next(mapServiceError(error, "PORTFOLIO_LOOKUP_FAILED", "Failed to fetch portfolio"));
      }
    },

    create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_PORTFOLIO_PAYLOAD", "Invalid portfolio payload"));
        return;
      }

      try {
        res.status(201).json(await createSavedPortfolio({ userId, ...parsed.data }));
      } catch (error) {
        next(mapServiceError(error, "PORTFOLIO_CREATE_FAILED", "Failed to create portfolio"));
      }
    },

    update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_PORTFOLIO_PAYLOAD", "Invalid portfolio payload"));
        return;
      }

      try {
        res.json(await updateSavedPortfolio({
          userId,
          portfolioId: String(req.params.portfolioId),
          ...parsed.data,
        }));
      } catch (error) {
        next(mapServiceError(error, "PORTFOLIO_UPDATE_FAILED", "Failed to update portfolio"));
      }
    },

    importCsv: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      if (!req.file) {
        next(new AppError(400, "MISSING_CSV_FILE", "CSV file is required"));
        return;
      }

      const name = typeof req.body?.name === "string" && req.body.name.trim().length >= 2
        ? req.body.name.trim()
        : `Imported Portfolio ${new Date().toISOString().slice(0, 10)}`;

      const baseCurrency = typeof req.body?.baseCurrency === "string"
        ? req.body.baseCurrency.trim().toUpperCase()
        : undefined;

      try {
        const created = await importSavedPortfolioFromCsv({
          userId,
          name,
          baseCurrency,
          csvRaw: req.file.buffer.toString("utf8"),
        });
        res.status(201).json(created);
      } catch (error) {
        next(mapServiceError(error, "PORTFOLIO_IMPORT_FAILED", "Failed to import portfolio"));
      }
    },
  };
}
