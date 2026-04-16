import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../utils/appError";
import { AuthenticatedRequest } from "../types/auth";
import { fetchSymbolFilters, mapCategoryToSymbolType, searchSymbols } from "../services/symbol.service";
import { buildCountryFilterInput } from "../services/symbol.helpers";
import { mapServiceError } from "../utils/serviceError";
import { MissingLogoModel } from "../models/MissingLogo";
import { verifySymbolLogo } from "../services/logoAuthority.service";
import { SymbolModel } from "../models/Symbol";

const searchSchema = z.object({
  query: z.string().default(""),
  q: z.string().optional(),
  type: z.string().optional(),
  country: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().optional(),
  category: z.string().optional(),
});

const missingLogoSchema = z.object({
  symbol: z.string().min(1),
  fullSymbol: z.string().min(1),
  name: z.string().min(1),
  exchange: z.string().min(1),
  type: z.string().min(1),
  country: z.string().min(1),
  fallbackType: z.string().min(1),
});

export function createSymbolController() {
  return {
    search: async (req: Request, res: Response, next: NextFunction) => {
      const parsed = searchSchema.safeParse(req.query);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_SYMBOL_SEARCH_QUERY", "Invalid symbol search query"));
        return;
      }

      try {
        const resolvedType = parsed.data.type ?? mapCategoryToSymbolType(parsed.data.category);
        const userId = (req as AuthenticatedRequest).user?.userId;
        const effectiveQuery = parsed.data.q ?? parsed.data.query;

        // Extract user country from proxy headers (Vercel, Cloudflare, nginx, or explicit)
        const userCountryRaw = (
          req.headers["x-user-country"]
          || req.headers["x-vercel-ip-country"]
          || req.headers["cf-ipcountry"]
          || req.headers["x-country"]
        ) as string | undefined;
        const userCountry = buildCountryFilterInput(userCountryRaw)?.code ?? (
          req.headers["x-vercel-ip-country"]
          || req.headers["cf-ipcountry"]
          || req.headers["x-country"]
        ) as string | undefined;

        const payload = await searchSymbols({
          query: effectiveQuery,
          type: resolvedType,
          country: parsed.data.country,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
          cursor: parsed.data.cursor,
          userId,
          userCountry,
        });

        res.json(payload);
      } catch (error) {
        if (error instanceof Error && error.message === "INVALID_CURSOR_TOKEN") {
          next(new AppError(400, "INVALID_CURSOR_TOKEN", "Cursor token is invalid"));
          return;
        }
        next(mapServiceError(error, "SYMBOL_SEARCH_FAILED", "Could not search symbols"));
      }
    },

    filters: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const type = typeof req.query.type === "string" ? req.query.type : undefined;
        const payload = await fetchSymbolFilters(type);
        res.json(payload);
      } catch (error) {
        next(mapServiceError(error, "SYMBOL_FILTERS_FAILED", "Could not load symbol filters"));
      }
    },

    reportMissingLogo: async (req: Request, res: Response, next: NextFunction) => {
      const parsed = missingLogoSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_MISSING_LOGO_PAYLOAD", "Invalid missing logo payload"));
        return;
      }

      try {
        await MissingLogoModel.updateOne(
          { fullSymbol: parsed.data.fullSymbol.toUpperCase() },
          {
            $setOnInsert: {
              symbol: parsed.data.symbol.toUpperCase(),
              fullSymbol: parsed.data.fullSymbol.toUpperCase(),
              name: parsed.data.name,
              exchange: parsed.data.exchange.toUpperCase(),
              type: parsed.data.type.toLowerCase(),
              country: parsed.data.country.toUpperCase(),
              firstSeenAt: new Date(),
              retryCount: 0,
            },
            $set: {
              fallbackType: parsed.data.fallbackType.toLowerCase(),
              lastSeenAt: new Date(),
              status: "pending",
              resolvedAt: null,
            },
            $inc: { count: 1, searchFrequency: 1, userUsage: 1 },
          },
          { upsert: true },
        );

        res.status(204).send();
      } catch (error) {
        next(mapServiceError(error, "MISSING_LOGO_REPORT_FAILED", "Could not report missing logo"));
      }
    },

    logoAudit: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const symbol = typeof req.query.symbol === "string" ? req.query.symbol.toUpperCase() : undefined;
        const limit = Math.min(Number(req.query.limit) || 25, 100);

        if (symbol) {
          const docs = await SymbolModel.find({ symbol })
            .select({ symbol: 1, fullSymbol: 1, name: 1, type: 1, exchange: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1, logoVerificationStatus: 1, logoQualityScore: 1 })
            .limit(10)
            .lean();
          const results = docs.map((d) => verifySymbolLogo(d));
          res.json({ symbol, count: results.length, results });
          return;
        }

        const [total, withIcon, validated, repaired, apiKeyLeaks, wrongDomain] = await Promise.all([
          SymbolModel.estimatedDocumentCount(),
          SymbolModel.countDocuments({ iconUrl: { $ne: "", $exists: true } }),
          SymbolModel.countDocuments({ logoVerificationStatus: "validated" }),
          SymbolModel.countDocuments({ logoVerificationStatus: "repaired" }),
          SymbolModel.countDocuments({ iconUrl: /apikey=/i }),
          SymbolModel.countDocuments({ companyDomain: { $in: ["financialmodelingprep.com", "clearbit.com"] } }),
        ]);

        res.json({
          total,
          withIcon,
          coverage: total > 0 ? `${((withIcon / total) * 100).toFixed(1)}%` : "0%",
          validated,
          repaired,
          apiKeyLeaks,
          wrongDomain,
        });
      } catch (error) {
        next(mapServiceError(error, "LOGO_AUDIT_FAILED", "Logo audit failed"));
      }
    },
  };
}
