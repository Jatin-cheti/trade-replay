import express from "express";
import { z } from "zod";
import { computeIndicators, transformCandles } from "./lib/compute";
import { computeIndicatorsSchema, transformSchema } from "./lib/validation";
import { cacheKey, getCached, setCached } from "./services/cache";
import { resolveCandles } from "./services/candleSource";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "chart-service" });
  });

  app.post("/compute/indicators", async (req, res) => {
    const parsed = computeIndicatorsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: "INVALID_CHART_INDICATOR_PAYLOAD", issues: parsed.error.issues });
      return;
    }

    const resolvedCandles = await resolveCandles(parsed.data.candles, parsed.data.source);
    if (resolvedCandles.length === 0) {
      res.status(400).json({ code: "NO_CANDLES_AVAILABLE" });
      return;
    }

    const requestPayload = {
      candles: resolvedCandles,
      indicators: parsed.data.indicators,
    };

    const key = cacheKey("compute-indicators", requestPayload);
    const cached = await getCached<unknown>(key);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    try {
      const computed = computeIndicators(requestPayload);
      await setCached(key, computed);
      res.json({ ...computed, cached: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("UNKNOWN_INDICATOR:")) {
        res.status(400).json({ code: message });
        return;
      }
      res.status(500).json({ code: "CHART_COMPUTE_FAILED" });
    }
  });

  app.post("/transform", async (req, res) => {
    const parsed = transformSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: "INVALID_CHART_TRANSFORM_PAYLOAD", issues: parsed.error.issues });
      return;
    }

    const resolvedCandles = await resolveCandles(parsed.data.candles, parsed.data.source);
    if (resolvedCandles.length === 0) {
      res.status(400).json({ code: "NO_CANDLES_AVAILABLE" });
      return;
    }

    const requestPayload = {
      candles: resolvedCandles,
      transformType: parsed.data.transformType,
      params: parsed.data.params,
    };

    const key = cacheKey("transform", requestPayload);
    const cached = await getCached<unknown>(key);
    if (cached) {
      res.json({ ...cached, cached: true });
      return;
    }

    try {
      const transformed = transformCandles(requestPayload);
      await setCached(key, transformed);
      res.json({ ...transformed, cached: false });
    } catch (_error) {
      res.status(500).json({ code: "CHART_TRANSFORM_FAILED" });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ code: "NOT_FOUND" });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({ code: "INVALID_PAYLOAD", issues: error.issues });
      return;
    }
    res.status(500).json({ code: "INTERNAL_ERROR" });
  });

  return app;
}
