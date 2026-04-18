import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { listScreenerAssets, getScreenerStats, fastSearchAssets, getSymbolDetail } from "../services/screener.service.js";

const listSchema = z.object({
  type: z.string().default("stocks"),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().default("marketCap"),
  order: z.enum(["asc", "desc"]).default("desc"),
  marketCountries: z.string().optional(),
  exchanges: z.string().optional(),
  sectors: z.string().optional(),
  primaryListing: z.coerce.boolean().optional(),
  marketCapMin: z.coerce.number().optional(),
  marketCapMax: z.coerce.number().optional(),
});

function csv(s?: string): string[] {
  return s ? s.split(",").map((v) => v.trim()).filter(Boolean) : [];
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const p = listSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json({ error: "Invalid params", details: p.error.issues }); return; }
    const d = p.data;
    const result = await listScreenerAssets({
      type: d.type, query: d.q, countries: csv(d.marketCountries),
      exchanges: csv(d.exchanges), sectors: csv(d.sectors),
      primaryOnly: d.primaryListing || false,
      marketCapMin: d.marketCapMin, marketCapMax: d.marketCapMax,
      sort: d.sort, order: d.order, limit: d.limit, offset: d.offset,
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function stats(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await getScreenerStats()); } catch (err) { next(err); }
}

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    res.json(await fastSearchAssets(q, limit));
  } catch (err) { next(err); }
}

export async function symbol(req: Request, res: Response, next: NextFunction) {
  try {
    const sym = decodeURIComponent(String(req.params.symbol));
    const doc = await getSymbolDetail(sym);
    if (!doc) { res.status(404).json({ error: "Symbol not found" }); return; }
    res.json(doc);
  } catch (err) { next(err); }
}
