import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import { requireUserId } from "../utils/request";
import { mapServiceError } from "../utils/serviceError";
import { AppError } from "../utils/appError";
import { ensurePortfolio } from "../services/portfolioService";
import {
  createSavedPortfolio,
  importSavedPortfolioFromCsv,
  getSavedPortfolioById,
  listSavedPortfolios,
  updateSavedPortfolio,
} from "../services/savedPortfolioService";
import { downloadPortfolioCsv, generatePortfolioUploadUrl } from "../services/s3.service";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  baseCurrency: z.string().min(3).max(8).optional(),
  holdings: z.array(z.object({
    symbol: z.string().min(1),
    quantity: z.number().positive(),
    avgPrice: z.number().positive(),
  })).min(1),
});

const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120).optional(),
  fileSizeBytes: z.number().int().positive().max(5 * 1024 * 1024).optional(),
  userId: z.string().optional(),
});

const importFromS3Schema = z.object({
  s3Key: z.string().min(1).max(400),
  name: z.string().min(2).max(80).optional(),
  baseCurrency: z.string().min(3).max(8).optional(),
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

    generateUploadUrl: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = uploadUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_UPLOAD_REQUEST", "Invalid upload request payload"));
        return;
      }

      const requestedUserId = parsed.data.userId;
      if (requestedUserId && requestedUserId !== userId) {
        next(new AppError(403, "USER_ID_MISMATCH", "Upload request user mismatch"));
        return;
      }

      if (!parsed.data.fileName.toLowerCase().endsWith(".csv")) {
        next(new AppError(400, "INVALID_FILE_TYPE", "Only CSV files allowed"));
        return;
      }

      try {
        const result = await generatePortfolioUploadUrl(
          userId,
          parsed.data.fileName,
          parsed.data.contentType,
          parsed.data.fileSizeBytes,
        );
        res.json(result);
      } catch (error) {
        next(mapServiceError(error, "S3_UPLOAD_URL_FAILED", "Could not create upload URL"));
      }
    },

    importCsv: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const userId = requireUserId(req);
      const parsed = importFromS3Schema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_IMPORT_REQUEST", "CSV import payload is invalid"));
        return;
      }

      const name = typeof parsed.data.name === "string" && parsed.data.name.trim().length >= 2
        ? parsed.data.name.trim()
        : `Imported Portfolio ${new Date().toISOString().slice(0, 10)}`;

      const baseCurrency = typeof parsed.data.baseCurrency === "string"
        ? parsed.data.baseCurrency.trim().toUpperCase()
        : undefined;

      try {
        const csvRaw = await downloadPortfolioCsv(userId, parsed.data.s3Key);
        const created = await importSavedPortfolioFromCsv({
          userId,
          name,
          baseCurrency,
          csvRaw,
        });
        res.status(201).json(created);
      } catch (error) {
        next(mapServiceError(error, "PORTFOLIO_IMPORT_FAILED", "Failed to import portfolio"));
      }
    },
  };
}
