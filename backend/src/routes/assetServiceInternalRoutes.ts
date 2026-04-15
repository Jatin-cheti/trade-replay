import { Router, type Request, type Response, type NextFunction } from "express";
import { env } from "../config/env";
import { createAssetServiceInternalController } from "../controllers/assetServiceInternalController";
import { AppError } from "../utils/appError";

function verifyInternalServiceToken(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header("x-internal-service-token") || "";
  if (!provided || provided !== env.ASSET_SERVICE_INTERNAL_TOKEN) {
    next(new AppError(401, "INVALID_INTERNAL_SERVICE_TOKEN", "Invalid internal service token"));
    return;
  }

  next();
}

export function createAssetServiceInternalRoutes() {
  const router = Router();
  const controller = createAssetServiceInternalController();

  router.get("/health", controller.health);
  router.get("/health/snapshot", controller.snapshotHealth);
  router.use(verifyInternalServiceToken);
  router.post("/candles", controller.candles);
  router.post("/quotes", controller.quotes);
  router.post("/snapshot", controller.snapshot);
  router.post("/snapshot/ingest", controller.ingestSnapshot);

  return router;
}
