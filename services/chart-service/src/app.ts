import express from "express";
import { authMiddleware } from "./middleware/auth.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { rateLimitMiddleware } from "./middleware/rateLimit.middleware";
import { createChartRouter } from "./routes/chart.routes";
import { createHealthRouter } from "./routes/health.routes";
import { createIndicatorRouter } from "./routes/indicator.routes";
import { createLegacyRouter } from "./routes/legacy.routes";

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.use(createHealthRouter());
  app.use(authMiddleware);
  app.use(rateLimitMiddleware);
  app.use(createLegacyRouter());

  app.use("/api/chart", createChartRouter());
  app.use("/api/chart", createIndicatorRouter());

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  app.use(errorMiddleware);
  return app;
}
