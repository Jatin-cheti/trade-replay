import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { createSymbolController } from "../controllers/symbolController";

export function createSymbolRoutes() {
  const router = Router();
  const controller = createSymbolController();

  // Public diagnostic endpoint
  router.get("/logo-audit", controller.logoAudit);

  router.use(verifyToken);
  router.get("/search", controller.search);
  router.get("/filters", controller.filters);
  router.post("/missing-logo", controller.reportMissingLogo);

  return router;
}
