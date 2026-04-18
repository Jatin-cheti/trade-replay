import { Router } from "express";
import {
  getCandlesController,
  getRealtimeController,
  getSymbolsController,
  postMultiController,
} from "../controllers/chart.controller";
import { getHealth } from "../controllers/health.controller";

export function createChartRouter(): Router {
  const router = Router();
  router.get("/health", getHealth);
  router.get("/candles", getCandlesController);
  router.get("/symbols", getSymbolsController);
  router.get("/realtime/:symbol", getRealtimeController);
  router.post("/multi", postMultiController);
  return router;
}
