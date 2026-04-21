import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { listScreenerAssets, getScreenerStats, fastSearchAssets, getSymbolDetail, getScreenerMeta } from "../services/screener.service.js";

const listSchema = z.object({
  type: z.string().default("stocks"),
  q: z.string().optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().default("priorityScore"),
  order: z.enum(["asc", "desc"]).default("desc"),
  marketCountries: z.string().optional(),
  exchanges: z.string().optional(),
  sectors: z.string().optional(),
  sector: z.string().optional(), // legacy singular alias
  analystRatings: z.string().optional(),
  analystRating: z.string().optional(), // legacy singular alias
  primaryListing: z.coerce.boolean().optional(),
  // Range filters — all optional min/max pairs
  marketCapMin: z.coerce.number().optional(),
  marketCapMax: z.coerce.number().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  volumeMin: z.coerce.number().optional(),
  volumeMax: z.coerce.number().optional(),
  peMin: z.coerce.number().optional(),
  peMax: z.coerce.number().optional(),
  epsDilTtmMin: z.coerce.number().optional(),
  epsDilTtmMax: z.coerce.number().optional(),
  betaMin: z.coerce.number().optional(),
  betaMax: z.coerce.number().optional(),
  changePercentMin: z.coerce.number().optional(),
  changePercentMax: z.coerce.number().optional(),
  divYieldPercentMin: z.coerce.number().optional(),
  divYieldPercentMax: z.coerce.number().optional(),
  epsDilGrowthMin: z.coerce.number().optional(),
  epsDilGrowthMax: z.coerce.number().optional(),
  perfPercentMin: z.coerce.number().optional(),
  perfPercentMax: z.coerce.number().optional(),
  revenueGrowthMin: z.coerce.number().optional(),
  revenueGrowthMax: z.coerce.number().optional(),
  pegMin: z.coerce.number().optional(),
  pegMax: z.coerce.number().optional(),
  roeMin: z.coerce.number().optional(),
  roeMax: z.coerce.number().optional(),
});

function csv(s?: string): string[] {
  return s ? s.split(",").map((v) => v.trim()).filter(Boolean) : [];
}

const RANGE_KEYS = ["marketCap", "price", "volume", "pe", "epsDilTtm", "beta", "changePercent", "divYieldPercent", "epsDilGrowth", "perfPercent", "revenueGrowth", "peg", "roe"];

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const p = listSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json({ error: "Invalid params", details: p.error.issues }); return; }
    const d = p.data;
    // Build ranges object from all *Min/*Max params
    const ranges: Record<string, { min?: number; max?: number }> = {};
    for (const key of RANGE_KEYS) {
      const min = (d as Record<string, unknown>)[`${key}Min`] as number | undefined;
      const max = (d as Record<string, unknown>)[`${key}Max`] as number | undefined;
      if (min !== undefined || max !== undefined) ranges[key] = { min, max };
    }
    const result = await listScreenerAssets({
      type: d.type, query: d.q || d.query, countries: csv(d.marketCountries),
      exchanges: csv(d.exchanges),
      sectors: csv(d.sectors).length > 0 ? csv(d.sectors) : csv(d.sector),
      analystRatings: csv(d.analystRatings).length > 0 ? csv(d.analystRatings) : csv(d.analystRating),
      primaryOnly: d.primaryListing || false,
      ranges,
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

export async function meta(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await getScreenerMeta()); } catch (err) { next(err); }
}
