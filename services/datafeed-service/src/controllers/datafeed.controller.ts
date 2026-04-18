import { Request, Response, NextFunction } from "express";
import { getConfig } from "../services/config.js";
import { resolveSymbol, searchSymbols } from "../services/symbols.service.js";
import { getHistoricalBars } from "../services/history.service.js";

export async function config(_req: Request, res: Response) {
  res.json(getConfig());
}

export async function serverTime(_req: Request, res: Response) {
  res.json({ time: Math.floor(Date.now() / 1000) });
}

export async function symbols(req: Request, res: Response) {
  const sym = typeof req.query.symbol === "string" ? req.query.symbol : "";
  if (!sym) { res.status(400).json({ s: "error", errmsg: "symbol param required" }); return; }
  const info = await resolveSymbol(sym);
  if (!info) { res.status(404).json({ s: "error", errmsg: "Symbol not found" }); return; }
  res.json(info);
}

export async function search(req: Request, res: Response) {
  const query = typeof req.query.query === "string" ? req.query.query : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 30;
  res.json(await searchSymbols(query, type, limit));
}

export async function history(req: Request, res: Response) {
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
  const resolution = typeof req.query.resolution === "string" ? req.query.resolution : "D";
  const from = typeof req.query.from === "string" ? parseInt(req.query.from, 10) : 0;
  const to = typeof req.query.to === "string" ? parseInt(req.query.to, 10) : Math.floor(Date.now() / 1000);
  if (!symbol) { res.json({ s: "error", errmsg: "symbol required" }); return; }
  res.json(await getHistoricalBars(symbol, resolution, from, to));
}

export async function marks(_req: Request, res: Response) { res.json([]); }
export async function timescaleMarks(_req: Request, res: Response) { res.json([]); }
