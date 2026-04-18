import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { createChartController } from "../controllers/chartController";

export function createChartRoutes() {
  const router = Router();
  const controller = createChartController();

  router.use(verifyToken);
  router.post("/compute/indicators", controller.computeIndicators);
  router.post("/transform", controller.transform);
  router.post("/bundle", controller.bundle);

  return router;
}
