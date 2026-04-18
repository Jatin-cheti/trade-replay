import express from "express";
import cors from "cors";
import helmet from "helmet";
import simulationRoutes from "./routes/simulation.routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true, service: "simulation-service" }));
  app.use("/api/simulation", simulationRoutes);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode || 500;
    res.status(status).json({ error: status < 500 ? err.message : "Internal server error" });
  });
  return app;
}
