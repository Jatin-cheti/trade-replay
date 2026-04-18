import express from "express";
import cors from "cors";
import helmet from "helmet";
import symbolRoutes from "./routes/symbol.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "asset-service" });
  });

  app.use("/api/symbols", symbolRoutes);
  app.use("/api/assets", symbolRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[asset-service] Error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
