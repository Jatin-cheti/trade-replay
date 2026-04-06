import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import { getLiveCandles, getLiveQuotes } from "../services/liveMarketService";
import { AppError } from "../utils/appError";

const candlesSchema = z.object({
  symbol: z.string().min(1),
  limit: z.coerce.number().int().min(20).max(500).optional(),
});

const quotesSchema = z.object({
  symbols: z.string().min(1),
});

export function createLiveMarketController() {
  return {
    candles: async (req: AuthenticatedRequest, res: Response) => {
      const parsed = candlesSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_LIVE_CANDLES_QUERY", "Invalid live candles query");
      }

      const payload = getLiveCandles({
        symbol: parsed.data.symbol,
        limit: parsed.data.limit,
      });

      res.json(payload);
    },

    quotes: async (req: AuthenticatedRequest, res: Response) => {
      const parsed = quotesSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_LIVE_QUOTES_QUERY", "Invalid live quotes query");
      }

      const symbols = parsed.data.symbols
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);

      if (symbols.length === 0) {
        throw new AppError(400, "INVALID_LIVE_QUOTES_QUERY", "At least one symbol is required");
      }

      res.json(getLiveQuotes({ symbols }));
    },
  };
}
