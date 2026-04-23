import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { createLiveMarketController } from "../controllers/liveMarketController";

export function createLiveMarketRoutes() {
  const router = Router();
  const controller = createLiveMarketController();

  // Public endpoints — no auth required
  router.get("/snapshot/public", controller.publicSnapshotGet);
  router.post("/snapshot/public", controller.publicSnapshotPost);
  router.get("/candles", controller.candles);

  // Auth-required endpoints
  router.use(verifyToken);
  router.get("/quotes", controller.quotes);
  router.post("/snapshot", controller.snapshot);
  router.post("/snapshot/ingest", controller.ingestSnapshot);

  return router;
}
