import { SymbolModel } from "../models/Symbol.js";
import { SUPPORTED_RESOLUTIONS } from "./config.js";

function sessionByExchange(exchange: string): string {
  const e = (exchange || "").toUpperCase();
  if (e === "NSE" || e === "BSE") return "0915-1530:12345";
  if (e === "NASDAQ" || e === "NYSE") return "0930-1600:12345";
  if (e === "LSE") return "0800-1630:12345";
  return "24x7";
}

function timezoneByExchange(exchange: string): string {
  const e = (exchange || "").toUpperCase();
  if (e === "NSE" || e === "BSE") return "Asia/Kolkata";
  if (e === "NASDAQ" || e === "NYSE") return "America/New_York";
  if (e === "LSE") return "Europe/London";
  return "Etc/UTC";
}

function resolveLogoUrl(iconUrl?: string, s3Icon?: string): string {
  const blocked = (u?: string) => !u || u.includes("medic-data.s3.eu-north-1.amazonaws.com") || u.includes("dl142w45levth.cloudfront.net");
  if (iconUrl && !blocked(iconUrl)) return iconUrl;
  if (s3Icon && !blocked(s3Icon)) return s3Icon;
  return "";
}

export async function resolveSymbol(symbolName: string) {
  const upper = symbolName.trim().toUpperCase();
  const query = upper.includes(":") ? { fullSymbol: upper } : { symbol: upper };

  const doc = await SymbolModel.findOne(query)
    .select("symbol fullSymbol name exchange type currency iconUrl s3Icon")
    .sort({ priorityScore: -1 })
    .lean() as Record<string, string> | null;

  if (!doc) return null;

  return {
    symbol: doc.fullSymbol,
    full_name: `${doc.exchange}:${doc.symbol}`,
    description: doc.name,
    exchange: doc.exchange,
    listed_exchange: doc.exchange,
    type: doc.type,
    currency_code: doc.currency || "USD",
    session: sessionByExchange(doc.exchange),
    timezone: timezoneByExchange(doc.exchange),
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    logo_urls: resolveLogoUrl(doc.iconUrl, doc.s3Icon) ? [resolveLogoUrl(doc.iconUrl, doc.s3Icon)] : [],
  };
}

export async function searchSymbols(query: string, type: string, limit: number) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter: Record<string, unknown> = {
    $or: [
      { symbol: { $regex: `^${escaped}`, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
    ],
  };
  if (type) filter.type = type;

  const docs = await SymbolModel.find(filter)
    .sort({ priorityScore: -1 })
    .limit(Math.min(limit, 50))
    .select("symbol fullSymbol name exchange type iconUrl s3Icon")
    .lean() as Record<string, string>[];

  return docs.map((d) => ({
    symbol: d.fullSymbol,
    full_name: `${d.exchange}:${d.symbol}`,
    description: d.name,
    exchange: d.exchange,
    type: d.type,
    logo_urls: resolveLogoUrl(d.iconUrl, d.s3Icon) ? [resolveLogoUrl(d.iconUrl, d.s3Icon)] : [],
  }));
}
