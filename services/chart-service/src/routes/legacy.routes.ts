import { Router } from "express";
import {
  bundleLegacyController,
  computeIndicatorsLegacyController,
  transformLegacyController,
} from "../controllers/legacy.controller";

export function createLegacyRouter(): Router {
  const router = Router();
  router.post("/compute/indicators", computeIndicatorsLegacyController);
  router.post("/transform", transformLegacyController);
  router.post("/bundle", bundleLegacyController);
  return router;
}
