import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { createLiveMarketController } from "../controllers/liveMarketController";

export function createLiveMarketRoutes() {
  const router = Router();
  const controller = createLiveMarketController();

  router.use(verifyToken);
  router.get("/candles", controller.candles);
  router.get("/quotes", controller.quotes);

  return router;
}
