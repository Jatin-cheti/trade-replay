import { Router } from "express";
import { list, stats, symbolDetail, filterOptions } from "../controllers/screenerController";

export function createScreenerRoutes() {
  const router = Router();

  // All screener routes are PUBLIC (no auth required)
  router.get("/stats", stats);
  router.get("/list", list);
  router.get("/filters", filterOptions);
  router.get("/symbol/:fullSymbol", symbolDetail);

  return router;
}
