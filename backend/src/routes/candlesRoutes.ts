/**
 * GET /api/candles/:symbol
 *
 * Public endpoint for historical OHLCV candle data.
 * Fetches real market data from Yahoo Finance.
 *
 * Query parameters:
 *   resolution  '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M'  (default: 'D')
 *   from        Unix timestamp seconds UTC  (default: 1 year ago)
 *   to          Unix timestamp seconds UTC  (default: now)
 *   limit       Max candles to return, cropped from the start of the range  (default: 2000)
 *   exchange    Optional exchange hint (e.g. 'NSE') — looked up from DB if omitted
 *
 * Response:
 *   { candles: [...], symbol: string, resolution: string, count: number }
 */

import { Router, Request, Response } from "express";
import { fetchYahooCandles, toYahooSymbol } from "../services/yahooFinance.service";
import { CleanAssetModel } from "../models/CleanAsset";
import { logger } from "../utils/logger";

export function createCandlesRoutes(): Router {
  const router = Router();

  router.get("/:symbol", async (req: Request, res: Response) => {
    const rawSymbol = decodeURIComponent(String(req.params["symbol"] ?? ""))
      .trim()
      .toUpperCase();

    if (!rawSymbol) {
      return res.status(400).json({ error: "symbol is required" });
    }

    // Validate resolution
    const VALID_RESOLUTIONS = new Set(["1", "2", "5", "15", "30", "60", "D", "W", "M"]);
    const resolution = String(req.query["resolution"] ?? "D").toUpperCase();
    if (!VALID_RESOLUTIONS.has(resolution)) {
      return res.status(400).json({ error: `invalid resolution: ${resolution}` });
    }

    const now     = Math.floor(Date.now() / 1000);
    const fromSec = Number(req.query["from"]) || (now - 366 * 86_400);
    const toSec   = Number(req.query["to"])   || now;
    const limit   = Math.min(5_000, Math.max(1, Number(req.query["limit"] ?? 5_000)));

    if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || fromSec >= toSec) {
      return res.status(400).json({ error: "from must be a valid timestamp less than to" });
    }

    // Optional exchange hint from query; otherwise look it up in the DB
    let exchange: string | null = req.query["exchange"]
      ? String(req.query["exchange"]).toUpperCase()
      : null;

    if (!exchange) {
      try {
        const doc = await CleanAssetModel
          .findOne({ $or: [{ symbol: rawSymbol }, { fullSymbol: rawSymbol }] })
          .select({ exchange: 1 })
          .lean() as { exchange?: string } | null;
        exchange = doc?.exchange ?? null;
      } catch {
        // Non-fatal — continue without exchange suffix
      }
    }

    const yahooSymbol = toYahooSymbol(rawSymbol, exchange);

    logger.info("candles_request", {
      symbol: rawSymbol,
      yahooSymbol,
      resolution,
      from: new Date(fromSec * 1000).toISOString().split("T")[0],
      to:   new Date(toSec   * 1000).toISOString().split("T")[0],
    });

    try {
      const candles = await fetchYahooCandles(yahooSymbol, resolution, fromSec, toSec);

      // Crop from the start of the range (ascending order) up to `limit` items
      const result = candles.slice(0, limit);

      return res.json({
        candles: result,
        symbol:     rawSymbol,
        resolution,
        count:      result.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("candles_fetch_error", { symbol: rawSymbol, yahooSymbol, error: msg });
      return res.status(502).json({ error: "Failed to fetch candles", detail: msg });
    }
  });

  return router;
}
