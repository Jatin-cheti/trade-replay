import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../types/auth";
import {
  getAssetServiceCandles,
  getAssetServiceQuotes,
  getSnapshots,
  ingestAssetServiceSnapshots,
} from "../clients/assetService.client";
import { AppError } from "../utils/appError";

const candlesSchema = z.object({
  symbol: z.string().min(1),
  limit: z.coerce.number().int().min(20).max(500).optional(),
});

const quotesSchema = z.object({
  symbols: z.string().min(1),
});

const snapshotSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1),
  candleSymbols: z.array(z.string().min(1)).optional(),
  candleLimit: z.number().int().min(20).max(500).optional(),
});

const publicSnapshotQuerySchema = z.object({
  symbols: z.string().min(1),
  candleSymbols: z.string().optional(),
  candleLimit: z.coerce.number().int().min(20).max(500).optional(),
});

const snapshotIngestSchema = z.object({
  quotes: z.record(z.object({
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    volume: z.number(),
    timestamp: z.string(),
    symbol: z.string().optional(),
    source: z.string().optional(),
  })).optional(),
  candlesBySymbol: z.record(z.array(z.object({
    time: z.string(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
  }))).optional(),
});

export function createLiveMarketController() {
  return {
    candles: async (req: AuthenticatedRequest, res: Response) => {
      const parsed = candlesSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_LIVE_CANDLES_QUERY", "Invalid live candles query");
      }

      const payload = await getAssetServiceCandles({
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

      res.json(await getAssetServiceQuotes(symbols));
    },

    snapshot: async (req: AuthenticatedRequest, res: Response) => {
      const parsed = snapshotSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_LIVE_SNAPSHOT_PAYLOAD", "Invalid live snapshot payload");
      }

      const payload = await getSnapshots({
        symbols: parsed.data.symbols,
        candleSymbols: parsed.data.candleSymbols,
        candleLimit: parsed.data.candleLimit,
      });

      res.json(payload);
    },

    publicSnapshotGet: async (req: AuthenticatedRequest, res: Response) => {
      const parsed = publicSnapshotQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid public live snapshot query", errorCode: "INVALID_PUBLIC_LIVE_SNAPSHOT_QUERY" });
        return;
      }

      const symbols = parsed.data.symbols.split(",").map((symbol) => symbol.trim()).filter(Boolean);
      const candleSymbols = (parsed.data.candleSymbols || "").split(",").map((symbol) => symbol.trim()).filter(Boolean);
      if (symbols.length === 0) {
        res.status(400).json({ success: false, message: "At least one symbol is required", errorCode: "INVALID_PUBLIC_LIVE_SNAPSHOT_QUERY" });
        return;
      }

      try {
        const payload = await getSnapshots({
          symbols,
          candleSymbols,
          candleLimit: parsed.data.candleLimit,
        });
        res.json(payload);
      } catch (error) {
        const statusCode = error instanceof AppError ? error.statusCode : 503;
        const errorCode = error instanceof AppError ? error.errorCode : "ASSET_SERVICE_SNAPSHOT_FAILED";
        const message = error instanceof Error ? error.message : "Asset service snapshot unavailable";
        res.status(statusCode).json({ success: false, message, errorCode });
      }
    },

    publicSnapshotPost: async (req: AuthenticatedRequest, res: Response) => {
      const parsed = snapshotSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid public live snapshot payload", errorCode: "INVALID_PUBLIC_LIVE_SNAPSHOT_PAYLOAD" });
        return;
      }

      try {
        const payload = await getSnapshots({
          symbols: parsed.data.symbols,
          candleSymbols: parsed.data.candleSymbols,
          candleLimit: parsed.data.candleLimit,
        });
        res.json(payload);
      } catch (error) {
        const statusCode = error instanceof AppError ? error.statusCode : 503;
        const errorCode = error instanceof AppError ? error.errorCode : "ASSET_SERVICE_SNAPSHOT_FAILED";
        const message = error instanceof Error ? error.message : "Asset service snapshot unavailable";
        res.status(statusCode).json({ success: false, message, errorCode });
      }
    },

    ingestSnapshot: async (req: AuthenticatedRequest, res: Response) => {
      const parsed = snapshotIngestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_LIVE_SNAPSHOT_INGEST_PAYLOAD", "Invalid live snapshot ingest payload");
      }

      const payload = await ingestAssetServiceSnapshots(parsed.data);
      res.json(payload);
    },
  };
}
