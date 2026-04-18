import type { Request, Response } from "express";
import { candleQuerySchema, multiCandleQuerySchema } from "../lib/validation";
import { getCandles, getMultiCandles, getSymbols } from "../services/candle.service";

export async function getCandlesController(req: Request, res: Response): Promise<void> {
  const parsed = candleQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_CANDLE_QUERY", message: parsed.error.message } });
    return;
  }
  const candles = await getCandles(parsed.data);
  res.json({ ok: true, data: candles, meta: { count: candles.length } });
}

export function getSymbolsController(_req: Request, res: Response): void {
  res.json({ ok: true, data: getSymbols() });
}

export function getRealtimeController(_req: Request, res: Response): void {
  res.status(426).json({ ok: false, error: { code: "WS_REQUIRED", message: "Use websocket upgrade on /api/chart/realtime/:symbol" } });
}

export async function postMultiController(req: Request, res: Response): Promise<void> {
  const parsed = multiCandleQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_MULTI_QUERY", message: parsed.error.message } });
    return;
  }
  const data = await getMultiCandles(parsed.data);
  res.json({ ok: true, data });
}
