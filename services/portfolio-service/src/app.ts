import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createPortfolioRoutes } from "./routes/portfolioRoutes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: "*" }));
  app.use(helmet());
  app.use(compression());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "portfolio-service" });
  });

  app.use("/", createPortfolioRoutes());

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal error",
    });
  });

  return app;
}
