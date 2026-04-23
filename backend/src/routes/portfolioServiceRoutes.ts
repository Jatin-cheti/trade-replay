import { Router } from "express";
import { getPortfolioServicePortfolio, getPortfolioServicePositions, getPortfolioServicePnl, getPortfolioServiceTrades, postPortfolioServiceTrade } from "../clients/portfolioService.client";
import { verifyToken } from "../middlewares/verifyToken";
import { AppError } from "../utils/appError";
import { AuthenticatedRequest } from "../types/auth";

function requireUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AppError(401, "MISSING_TOKEN", "Missing token");
  }
  return userId;
}

export function createPortfolioServiceRoutes() {
  const router = Router();

  router.use(verifyToken);

  router.get("/portfolio", async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      res.json(await getPortfolioServicePortfolio(userId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/positions", async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      res.json(await getPortfolioServicePositions(userId, status));
    } catch (error) {
      next(error);
    }
  });

  router.get("/pnl", async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      res.json(await getPortfolioServicePnl(userId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/trades", async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      res.json(await getPortfolioServiceTrades(userId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/trade", async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      const { symbol, type, quantity, price } = req.body as {
        symbol?: string;
        type?: "BUY" | "SELL";
        quantity?: number;
        price?: number;
      };

      const safeQuantity = typeof quantity === "number" && Number.isFinite(quantity) ? quantity : undefined;
      const safePrice = typeof price === "number" && Number.isFinite(price) ? price : undefined;

      if (!symbol || !type || safeQuantity === undefined || safePrice === undefined) {
        next(new AppError(400, "INVALID_PORTFOLIO_TRADE", "Invalid portfolio trade payload"));
        return;
      }

      res.status(201).json(await postPortfolioServiceTrade({
        userId,
        symbol,
        type,
        quantity: safeQuantity,
        price: safePrice,
      }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}