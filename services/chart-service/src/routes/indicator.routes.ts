import { Router } from "express";
import { computeIndicatorsController, getPresetsController } from "../controllers/indicator.controller";

export function createIndicatorRouter(): Router {
  const router = Router();
  router.post("/indicators/compute", computeIndicatorsController);
  router.get("/indicators/presets", getPresetsController);
  return router;
}
