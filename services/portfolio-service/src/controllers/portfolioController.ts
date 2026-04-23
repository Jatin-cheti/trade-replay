import { Request, Response } from "express";
import { z } from "zod";
import { applyTrade, getPnl, getPortfolio, getPositions, getTradeHistory } from "../services/portfolioEngine.service";
import { emitPortfolioSnapshot } from "../config/kafka";

const tradeSchema = z.object({
  userId: z.string().min(1),
  symbol: z.string().min(1),
  type: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
  price: z.number().positive(),
  occurredAt: z.string().datetime().optional(),
});

function resolveUserId(req: Request): string {
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
    return headerUserId.trim();
  }

  const queryUserId = req.query.userId;
  if (typeof queryUserId === "string" && queryUserId.trim().length > 0) {
    return queryUserId.trim();
  }

  throw new Error("Missing userId. Use x-user-id header or userId query param.");
}

export const portfolioController = {
  getPortfolioCurrent: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const portfolio = await getPortfolio(userId);
      res.json(portfolio);
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Portfolio fetch failed" });
    }
  },

  getPortfolioByUser: async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.userId);
      const portfolio = await getPortfolio(userId);
      res.json(portfolio);
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Portfolio fetch failed" });
    }
  },

  postTrade: async (req: Request, res: Response) => {
    const parsed = tradeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid trade payload", issues: parsed.error.flatten() });
      return;
    }

    try {
      const tradeResult = await applyTrade({
        userId: parsed.data.userId,
        symbol: parsed.data.symbol,
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        price: parsed.data.price,
        source: "api",
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      });

      await emitPortfolioSnapshot({
        userId: parsed.data.userId,
        totalValue: tradeResult.snapshot.totalValue,
        realizedPnl: tradeResult.snapshot.realizedPnl,
        unrealizedPnl: tradeResult.snapshot.unrealizedPnl,
        timestamp: Date.now(),
      });

      res.status(201).json({
        success: true,
        tradeId: tradeResult.tradeId,
        snapshot: tradeResult.snapshot,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Trade failed" });
    }
  },

  getPositions: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const status = req.query.status === "OPEN" || req.query.status === "CLOSED"
        ? req.query.status
        : undefined;

      const positions = await getPositions(userId, status);
      res.json({ success: true, positions });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Positions fetch failed" });
    }
  },

  getPnl: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const pnl = await getPnl(userId);
      res.json({ success: true, pnl });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : "PnL fetch failed" });
    }
  },

  getTrades: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const trades = await getTradeHistory(userId);
      res.json({ success: true, trades });
    } catch (error) {
      res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Trade history fetch failed" });
    }
  },
};
