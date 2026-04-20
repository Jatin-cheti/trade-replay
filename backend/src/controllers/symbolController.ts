import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../utils/appError";
import { AuthenticatedRequest } from "../types/auth";
import { fetchSymbolFilters, mapCategoryToSymbolType, searchSymbols, toAssetSearchItem } from "../services/symbol.service";
import { buildCountryFilterInput, coerceSymbolType } from "../services/symbol.helpers";
import { mapServiceError } from "../utils/serviceError";
import { MissingLogoModel } from "../models/MissingLogo";
import { reportMissingLogoToRemote } from "../services/logoServiceMode.service";

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

const tradingViewSearchSchema = z.object({
  text: z.string().default(""),
  exchange: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  start: z.union([z.string(), z.number()]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const TRADINGVIEW_MAX_WINDOW = 1000;

function parseStartOffset(start: unknown): number {
  if (typeof start === "number" && Number.isFinite(start)) {
    return Math.max(0, Math.floor(start));
  }

  if (typeof start === "string") {
    const parsed = Number.parseInt(start, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function resolveSearchType(type?: string, category?: string): string | undefined {
  const mapped = mapCategoryToSymbolType(type) ?? mapCategoryToSymbolType(category);
  if (mapped) return mapped;

  const direct = coerceSymbolType(type);
  if (direct) return direct;

  return undefined;
}

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

    searchTradingView: async (req: Request, res: Response, next: NextFunction) => {
      const parsed = tradingViewSearchSchema.safeParse(req.query);
      if (!parsed.success) {
        next(new AppError(400, "INVALID_SYMBOL_SEARCH_QUERY", "Invalid symbol search query"));
        return;
      }

      try {
        const start = Math.min(TRADINGVIEW_MAX_WINDOW, parseStartOffset(parsed.data.start));
        const pageLimit = parsed.data.limit;
        const fetchLimit = Math.min(TRADINGVIEW_MAX_WINDOW, Math.max(pageLimit, start + pageLimit));

        const exchangeToken = parsed.data.exchange?.trim().toUpperCase();
        const exchangeCountry = buildCountryFilterInput(exchangeToken);
        const shouldUseCountryFilter = Boolean(
          exchangeToken
          && exchangeCountry
          && (exchangeCountry.code.length === 2 || exchangeCountry.exchanges.length > 0),
        );

        const userId = (req as AuthenticatedRequest).user?.userId;
        const resolvedType = resolveSearchType(parsed.data.type, parsed.data.category);

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
          query: parsed.data.text,
          type: resolvedType,
          country: shouldUseCountryFilter ? exchangeCountry?.code : undefined,
          limit: fetchLimit,
          userId,
          userCountry,
        });

        let symbols = payload.items.map((item) => toAssetSearchItem(item));
        if (exchangeToken && !shouldUseCountryFilter) {
          symbols = symbols.filter((item) => {
            const exchange = String(item.exchange || "").toUpperCase();
            const source = String(item.source || "").toUpperCase();
            return exchange === exchangeToken || source === exchangeToken;
          });
        }

        const pagedSymbols = symbols.slice(start, start + pageLimit);
        const consumed = start + pagedSymbols.length;
        const reachedWindowCap = consumed >= TRADINGVIEW_MAX_WINDOW;
        const knownTotal = payload.total >= 0 ? payload.total : symbols.length;

        const hasMore = !reachedWindowCap && (
          consumed < knownTotal
          || (payload.hasMore && consumed <= symbols.length)
        );

        res.json({
          symbols: pagedSymbols,
          total: knownTotal,
          nextCursor: hasMore ? String(consumed) : null,
          hasMore,
        });
      } catch (error) {
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
        await reportMissingLogoToRemote(parsed.data);

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
  };
}
