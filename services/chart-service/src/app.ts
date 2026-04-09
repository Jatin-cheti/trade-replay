import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { computeIndicators, transformCandles } from "./lib/compute";
import { bundleSchema, computeIndicatorsSchema, transformSchema } from "./lib/validation";
import {
  getWithStaleWhileRevalidate,
  ttlPolicyFromSource,
} from "./services/cache";
import {
  buildBundleCacheKey,
  buildIndicatorsCacheKey,
  buildTransformCacheKey,
} from "./services/cacheKeys";
import { resolveCandles } from "./services/candleSource";
import { getMetricsSnapshot, incrementCounter } from "./services/metrics";
import { logInfo } from "./services/logger";
import { isRedisReady } from "./config/redis";
import { getStreamingHealth } from "./services/streaming";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.use((req, res, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();

    res.setHeader("x-request-id", requestId);
    incrementCounter(`http.requests.${req.method}.${req.path}`);

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      incrementCounter(`http.responses.${req.method}.${req.path}.${res.statusCode}`);
      logInfo("http_request", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      });
    });

    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "chart-service",
      cacheBackend: isRedisReady() ? "redis" : "memory",
      redisReady: isRedisReady(),
      streaming: getStreamingHealth(),
    });
  });

  app.get("/metrics", (_req, res) => {
    res.json({
      service: "chart-service",
      counters: getMetricsSnapshot(),
    });
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

    const policy = ttlPolicyFromSource(parsed.data.source);
    const key = buildIndicatorsCacheKey({
      source: parsed.data.source,
      candles: resolvedCandles,
      indicators: parsed.data.indicators,
    });

    try {
      const computed = await getWithStaleWhileRevalidate(
        key,
        policy,
        async () => computeIndicators({
          candles: resolvedCandles,
          indicators: parsed.data.indicators,
        }),
      );
      res.json({ ...computed.payload, cached: computed.cached, stale: computed.stale });
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

    const policy = ttlPolicyFromSource(parsed.data.source);
    const key = buildTransformCacheKey({
      source: parsed.data.source,
      candles: resolvedCandles,
      transformType: parsed.data.transformType,
      params: parsed.data.params,
    });

    try {
      const transformed = await getWithStaleWhileRevalidate(
        key,
        policy,
        async () => transformCandles({
          candles: resolvedCandles,
          transformType: parsed.data.transformType,
          params: parsed.data.params,
        }),
      );
      res.json({ ...transformed.payload, cached: transformed.cached, stale: transformed.stale });
    } catch (_error) {
      res.status(500).json({ code: "CHART_TRANSFORM_FAILED" });
    }
  });

  app.post("/bundle", async (req, res) => {
    const parsed = bundleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: "INVALID_CHART_BUNDLE_PAYLOAD", issues: parsed.error.issues });
      return;
    }

    const resolvedCandles = await resolveCandles(parsed.data.candles, parsed.data.source);
    if (resolvedCandles.length === 0) {
      res.status(400).json({ code: "NO_CANDLES_AVAILABLE" });
      return;
    }

    const policy = ttlPolicyFromSource(parsed.data.source);
    const key = buildBundleCacheKey({
      source: parsed.data.source,
      candles: resolvedCandles,
      transformType: parsed.data.transformType,
      params: parsed.data.params,
      indicators: parsed.data.indicators,
    });

    try {
      const bundled = await getWithStaleWhileRevalidate(
        key,
        policy,
        async () => {
          const transformed = parsed.data.transformType
            ? transformCandles({
              candles: resolvedCandles,
              transformType: parsed.data.transformType,
              params: parsed.data.params,
            })
            : null;

          const indicators = (parsed.data.indicators && parsed.data.indicators.length > 0)
            ? computeIndicators({
              candles: transformed?.candles ?? resolvedCandles,
              indicators: parsed.data.indicators,
            })
            : null;

          return {
            candlesCount: resolvedCandles.length,
            candles: resolvedCandles,
            transformed,
            indicators,
            meta: {
              symbol: parsed.data.source?.symbol ?? null,
              timeframe: parsed.data.source?.timeframe ?? null,
              from: parsed.data.source?.from ?? null,
              to: parsed.data.source?.to ?? null,
            },
          };
        },
      );

      res.json({ ...bundled.payload, cached: bundled.cached, stale: bundled.stale });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("UNKNOWN_INDICATOR:")) {
        res.status(400).json({ code: message });
        return;
      }
      res.status(500).json({ code: "CHART_BUNDLE_FAILED" });
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
