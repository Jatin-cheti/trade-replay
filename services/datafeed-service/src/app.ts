import express from "express";
import cors from "cors";
import helmet from "helmet";
import datafeedRoutes from "./routes/datafeed.routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true, service: "datafeed-service" }));
  app.use("/api/datafeed", datafeedRoutes);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[datafeed-service] Error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
