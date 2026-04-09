import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import rateLimit from "express-rate-limit";
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { env } from "./config/env";
import { redisPublisher, redisSubscriber } from "./config/redis";
import { verifyJwt } from "./utils/jwt";
import { logger } from "./utils/logger";
import authRoutes from "./routes/authRoutes";
import { createSimulationRoutes } from "./routes/simulationRoutes";
import { createLiveMarketRoutes } from "./routes/liveMarketRoutes";
import { createPortfolioRoutes } from "./routes/portfolioRoutes";
import { createTradeRoutes } from "./routes/tradeRoutes";
import { createSymbolRoutes } from "./routes/symbolRoutes";
import { createChartRoutes } from "./routes/chartRoutes";
import { verifyToken } from "./middlewares/verifyToken";
import { createPortfolioController } from "./controllers/portfolioController";
import { SimulationEngine } from "./services/simulationEngine";
import { getLogoQueue } from "./services/logoQueue.service";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { requestLogger } from "./middlewares/requestLogger";

export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health" || req.path.startsWith("/auth/"),
  });

  const allowedOrigins = Array.from(new Set([env.CLIENT_URL, ...env.CLIENT_URLS]));
  const corsOrigin: cors.CorsOptions["origin"] = (origin, callback) => {
    const isLocalhostOrigin =
      typeof origin === "string" && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

    // Allow non-browser requests (curl, server-to-server) and known browser origins.
    if (!origin || isLocalhostOrigin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  };

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
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

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(helmet());
  app.use(express.json());
  app.use(requestLogger);
  app.use("/api", apiLimiter);

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

  app.post("/api/upload-url", verifyToken, portfolioController.generateUploadUrl);

  app.use("/api/auth", authRoutes);
  app.use("/api/sim", createSimulationRoutes(engine));
  app.use("/api/simulation", createSimulationRoutes(engine));
  app.use("/api/live", createLiveMarketRoutes());
  app.use("/api/portfolio", createPortfolioRoutes());
  app.use("/api/trade", createTradeRoutes(engine));
  app.use("/api/symbols", createSymbolRoutes());
  app.use("/api/chart", createChartRoutes());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, httpServer };
}
