import { Response } from "express";
import { z } from "zod";
import { AppError } from "../utils/appError";
import {
  getLiveCandles,
  getLiveQuotes,
  getLiveSnapshot,
  ingestLiveSnapshot,
} from "../services/snapshotEngine.service";

type InternalRequest = { body: unknown; headers: Record<string, unknown> };

const candlesSchema = z.object({
  symbol: z.string().min(1),
  limit: z.coerce.number().int().min(20).max(500).optional(),
});

const quotesSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1),
});

const snapshotSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1),
  candleSymbols: z.array(z.string().min(1)).optional(),
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

export function createAssetServiceInternalController() {
  return {
    health: async (_req: InternalRequest, res: Response) => {
      res.json({ ok: true, service: "asset-service" });
    },

    candles: async (req: InternalRequest, res: Response) => {
      const parsed = candlesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_ASSET_SERVICE_CANDLES_QUERY", "Invalid asset service candles payload");
      }

      res.json(await getLiveCandles(parsed.data));
    },

    quotes: async (req: InternalRequest, res: Response) => {
      const parsed = quotesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_ASSET_SERVICE_QUOTES_QUERY", "Invalid asset service quotes payload");
      }

      res.json(await getLiveQuotes(parsed.data));
    },

    snapshot: async (req: InternalRequest, res: Response) => {
      const parsed = snapshotSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_ASSET_SERVICE_SNAPSHOT_QUERY", "Invalid asset service snapshot payload");
      }

      res.json(await getLiveSnapshot(parsed.data));
    },

    ingestSnapshot: async (req: InternalRequest, res: Response) => {
      const parsed = snapshotIngestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "INVALID_ASSET_SERVICE_SNAPSHOT_INGEST", "Invalid asset service snapshot ingest payload");
      }

      res.json(await ingestLiveSnapshot(parsed.data));
    },
  };
}
