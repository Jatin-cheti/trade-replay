import { Router } from "express";
import { optionalToken } from "../middlewares/optionalToken";
import { createDatafeedController } from "../services/datafeed.service";

/**
 * TradingView UDF Datafeed routes.
 * Most endpoints are public (no auth required) so the charting library
 * can make direct browser requests. Search and history are also public
 * but will personalize results when an auth token is present.
 */
export function createDatafeedRoutes(): Router {
  const router = Router();
  const controller = createDatafeedController();

  // Public endpoints — no auth required
  router.get("/config",          controller.config);
  router.get("/server_time",     controller.serverTime);
  router.get("/symbols",         controller.symbols);
  router.get("/history",         controller.history);
  router.get("/marks",           controller.marks);
  router.get("/timescale_marks", controller.timescaleMarks);

  // Optional auth — returns personalized search if token present
  router.get("/search", optionalToken, controller.search);

  return router;
}