import { Request, Response, NextFunction } from "express";
import { searchSymbols, getSymbolByTicker } from "../services/symbol-search.service.js";
import { getCatalogStats, listSymbols } from "../services/symbol-catalog.service.js";

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q || req.query.query || "");
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await searchSymbols({ query: q, type, country, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getByTicker(req: Request, res: Response, next: NextFunction) {
  try {
    const ticker = String(req.params.ticker);
    const doc = await getSymbolByTicker(ticker);
    if (!doc) { res.status(404).json({ error: "Symbol not found" }); return; }
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await listSymbols({ type, country, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function catalog(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getCatalogStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
