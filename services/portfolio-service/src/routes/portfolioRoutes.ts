import { Router } from "express";
import { portfolioController } from "../controllers/portfolioController";

export function createPortfolioRoutes() {
  const router = Router();

  router.get("/portfolio", portfolioController.getPortfolioCurrent);
  router.get("/portfolio/:userId", portfolioController.getPortfolioByUser);
  router.post("/trade", portfolioController.postTrade);
  router.get("/positions", portfolioController.getPositions);
  router.get("/pnl", portfolioController.getPnl);
  router.get("/trades", portfolioController.getTrades);

  return router;
}
