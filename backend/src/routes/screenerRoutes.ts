import { Router } from "express";
import { fastSearch, filterOptions, list, meta, stats, symbolDetail } from "../controllers/screenerController";

export function createScreenerRoutes() {
  const router = Router();

  // All screener routes are PUBLIC (no auth required)
  router.get("/meta", meta);
  router.get("/stats", stats);
  router.get("/list", list);
  router.get("/filters", filterOptions);
  router.get("/search", fastSearch);
  router.get("/symbol/:symbol", symbolDetail);

  return router;
}
