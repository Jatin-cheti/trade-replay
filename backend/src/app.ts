import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import rateLimit from "express-rate-limit";
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { env } from "./config/env";
import { redisClient, redisPublisher, redisSubscriber } from "./config/redis";
import { verifyJwt } from "./utils/jwt";
import { logger } from "./utils/logger";
import authRoutes from "./routes/authRoutes";
import { createSimulationRoutes } from "./routes/simulationRoutes";
import { createLiveMarketRoutes } from "./routes/liveMarketRoutes";
import { createPortfolioRoutes } from "./routes/portfolioRoutes";
import { createTradeRoutes } from "./routes/tradeRoutes";
import { createSymbolRoutes } from "./routes/symbolRoutes";
import { createAlertsRoutes } from "./routes/alertsRoutes";
import { createDatafeedRoutes } from "./routes/datafeedRoutes";
import { verifyToken } from "./middlewares/verifyToken";
import { createPortfolioController } from "./controllers/portfolioController";
import { createSymbolController } from "./controllers/symbolController";
import { SimulationEngine } from "./services/simulationEngine";
import { getLogoQueue } from "./services/logoQueue.service";
import { warmSymbolSearchCache } from "./services/symbol.service";
import { startSearchIndexService } from "./services/searchIndex.service";
import { getMetricsSnapshot } from "./services/metrics.service";
import { getFullCoverageReport, runTailEliminationOnce, startTailOrchestrator, stopTailOrchestrator, isOrchestratorRunning } from "./services/tailOrchestrator.service";
import { startScalingOrchestrator, stopScalingOrchestrator, isScalingOrchestratorRunning, getLiveScalingReport, runExpansionOnce, runSyncOnce, getScalingStatus } from "./services/scalingOrchestrator.service";
import { getExpansionStats } from "./services/symbolExpansion.service";
import { getShardStats } from "./services/redisShard.service";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { requestLogger } from "./middlewares/requestLogger";

export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const symbolController = createSymbolController();
  let lastCompletedCount = 0;
  let lastMetricsSampleAt = Date.now();
  app.set("trust proxy", 1);
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Math.max(100, env.API_RATE_LIMIT_MAX),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => Boolean(req.headers.authorization),
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  io.adapter(createAdapter(redisPublisher, redisSubscriber));

  const engine = new SimulationEngine(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      logger.warn("socket_unauthorized_missing_token");
      next(new Error("Unauthorized"));
      return;
    }
    try {
      const payload = verifyJwt(token);
      socket.data.userId = payload.userId;
      next();
    } catch (_error) {
      logger.warn("socket_unauthorized_invalid_token");
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    logger.info("socket_connected", { socketId: socket.id, userId: socket.data.userId });
    socket.join(socket.data.userId);
    socket.emit("ready");
  });

  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(requestLogger);

  void startSearchIndexService().catch((error) => {
    logger.error("search_index_start_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  void warmSymbolSearchCache().then(({ warmed, failed }) => {
    logger.info("symbol_search_precache_complete", { warmed, failed });
  });

  setInterval(() => {
    void warmSymbolSearchCache().then(({ warmed, failed }) => {
      logger.info("symbol_search_precache_refresh", { warmed, failed });
    });
  }, 5 * 60 * 1000).unref();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(getLogoQueue())],
    serverAdapter,
  });
  app.use("/admin/queues", serverAdapter.getRouter());

  const portfolioController = createPortfolioController();

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // ── Logo coverage & tail elimination endpoints ───────────────────────
  app.get("/api/logo-coverage", async (_req, res) => {
    const report = await getFullCoverageReport();
    res.json(report);
  });

  app.post("/api/logo-tail-elimination", async (_req, res) => {
    const result = await runTailEliminationOnce();
    res.json(result);
  });

  app.post("/api/logo-orchestrator/start", (_req, res) => {
    if (isOrchestratorRunning()) {
      res.json({ status: "already_running" });
      return;
    }
    void startTailOrchestrator();
    res.json({ status: "started" });
  });

  app.post("/api/logo-orchestrator/stop", (_req, res) => {
    stopTailOrchestrator();
    res.json({ status: "stopped" });
  });

  // ── Scaling orchestrator endpoints ─────────────────────────────────────
  app.post("/api/scaling/start", (_req, res) => {
    if (isScalingOrchestratorRunning()) {
      res.json({ status: "already_running" });
      return;
    }
    void startScalingOrchestrator();
    res.json({ status: "started" });
  });

  app.post("/api/scaling/stop", (_req, res) => {
    stopScalingOrchestrator();
    res.json({ status: "stopped" });
  });

  app.get("/api/scaling/report", async (_req, res) => {
    const report = await getLiveScalingReport();
    res.json(report);
  });

  app.get("/api/scaling/status", async (_req, res) => {
    const status = await getScalingStatus();
    res.json(status);
  });

  app.post("/api/scaling/expand", async (_req, res) => {
    const report = await runExpansionOnce();
    res.json(report);
  });

  app.post("/api/scaling/sync", async (_req, res) => {
    const result = await runSyncOnce();
    res.json(result);
  });

  app.get("/api/scaling/expansion-stats", async (_req, res) => {
    const stats = await getExpansionStats();
    res.json(stats);
  });

  app.get("/api/scaling/shard-stats", async (_req, res) => {
    const stats = await getShardStats("app:logo");
    res.json(stats);
  });

  app.get("/api/metrics", async (_req, res) => {
    const queue = getLogoQueue();
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    const now = Date.now();
    const elapsedMs = Math.max(1, now - lastMetricsSampleAt);
    const completedDelta = Math.max(0, completed - lastCompletedCount);
    const processingRatePerMin = Number(((completedDelta * 60000) / elapsedMs).toFixed(2));
    const settled = completed + failed;
    const successRate = settled > 0 ? Number(((completed / settled) * 100).toFixed(2)) : 100;
    const failureRate = settled > 0 ? Number(((failed / settled) * 100).toFixed(2)) : 0;

    lastCompletedCount = completed;
    lastMetricsSampleAt = now;

    res.json({
      ...getMetricsSnapshot(),
      queueDepth: {
        logoEnrichment: {
          waiting,
          active,
          delayed,
          total: waiting + active + delayed,
        },
      },
      queueProcessing: {
        logoEnrichment: {
          completed,
          failed,
          processingRatePerMin,
          successRate,
          failureRate,
        },
      },
    });
  });

  app.get("/metrics", async (_req, res) => {
    const queue = getLogoQueue();
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    const metrics = getMetricsSnapshot();
    const queueLag = Math.round(metrics.queueLatency.logoEnrichment?.avgLatencyMs ?? 0);
    const settled = completed + failed;
    const successRate = settled > 0 ? Number(((completed / settled) * 100).toFixed(2)) : 100;
    const failureRate = settled > 0 ? Number(((failed / settled) * 100).toFixed(2)) : 0;

    let redisMemoryUsage = 0;
    try {
      const info = await redisClient.info("memory");
      const match = info.match(/used_memory:(\d+)/);
      redisMemoryUsage = match ? Number(match[1]) : 0;
    } catch {
      redisMemoryUsage = 0;
    }

    const lines: string[] = [];
    lines.push("# HELP queue_depth Current queue depth (waiting + active + delayed)");
    lines.push("# TYPE queue_depth gauge");
    lines.push(`queue_depth{queue=\"logo_enrichment\"} ${waiting + active + delayed}`);
    lines.push("# HELP queue_lag Average queue latency in milliseconds");
    lines.push("# TYPE queue_lag gauge");
    lines.push(`queue_lag{queue=\"logo_enrichment\"} ${queueLag}`);
    lines.push("# HELP queue_lag_seconds Average queue latency in seconds");
    lines.push("# TYPE queue_lag_seconds gauge");
    lines.push(`queue_lag_seconds{queue=\"logo_enrichment\"} ${(queueLag / 1000).toFixed(3)}`);
    lines.push("# HELP worker_throughput_completed Total completed queue jobs");
    lines.push("# TYPE worker_throughput_completed counter");
    lines.push(`worker_throughput_completed{queue=\"logo_enrichment\"} ${completed}`);
    lines.push("# HELP worker_throughput_failed Total failed queue jobs");
    lines.push("# TYPE worker_throughput_failed counter");
    lines.push(`worker_throughput_failed{queue=\"logo_enrichment\"} ${failed}`);
    lines.push("# HELP queue_success_rate Queue success rate percentage");
    lines.push("# TYPE queue_success_rate gauge");
    lines.push(`queue_success_rate{queue=\"logo_enrichment\"} ${successRate}`);
    lines.push("# HELP worker_success_rate Worker success rate percentage");
    lines.push("# TYPE worker_success_rate gauge");
    lines.push(`worker_success_rate{queue=\"logo_enrichment\"} ${successRate}`);
    lines.push("# HELP queue_failure_rate Queue failure rate percentage");
    lines.push("# TYPE queue_failure_rate gauge");
    lines.push(`queue_failure_rate{queue=\"logo_enrichment\"} ${failureRate}`);
    lines.push("# HELP redis_memory_usage Redis used memory in bytes");
    lines.push("# TYPE redis_memory_usage gauge");
    lines.push(`redis_memory_usage ${redisMemoryUsage}`);
    lines.push("# HELP api_latency API average latency in milliseconds");
    lines.push("# TYPE api_latency gauge");

    lines.push("# HELP real_icon_accuracy Percentage of real non-fallback icons served");
    lines.push("# TYPE real_icon_accuracy gauge");
    lines.push(`real_icon_accuracy ${metrics.iconAccuracy.realIconAccuracy}`);
    lines.push("# HELP fallback_ratio Percentage of fallback icons served");
    lines.push("# TYPE fallback_ratio gauge");
    lines.push(`fallback_ratio ${metrics.iconAccuracy.fallbackUsageRate}`);

    for (const [route, stats] of Object.entries(metrics.apiLatency)) {
      const routeLabel = route.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
      lines.push(`api_latency{route=\"${routeLabel}\"} ${stats.avgMs}`);
    }

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(`${lines.join("\n")}\n`);
  });

  app.use("/api", apiLimiter);

  app.post("/api/upload-url", verifyToken, portfolioController.generateUploadUrl);
  app.get("/api/search", verifyToken, symbolController.search);

  app.use("/api/auth", authRoutes);
  app.use("/api/sim", createSimulationRoutes(engine));
  app.use("/api/simulation", createSimulationRoutes(engine));
  app.use("/api/live", createLiveMarketRoutes());
  app.use("/api/portfolio", createPortfolioRoutes());
  app.use("/api/trade", createTradeRoutes(engine));
  app.use("/api/symbols", createSymbolRoutes());
  app.use("/api/alerts", createAlertsRoutes());
  app.use("/api/datafeed", createDatafeedRoutes());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, httpServer };
}
