import crypto from "node:crypto";
import { FilterQuery, Types } from "mongoose";
import { SymbolDocument, SymbolModel } from "../models/Symbol";
import { env } from "../config/env";

export type SymbolType = "stock" | "etf" | "crypto" | "forex" | "index" | "derivative";
export const SUPPORTED_TYPES: SymbolType[] = ["stock", "etf", "crypto", "forex", "index", "derivative"];
export const CACHE_TTL_SECONDS = 45;
export const SEARCH_PRECACHE_QUERIES = ["re", "hdfc", "btc", "a", "t", "USD", "EUR", "NASDAQ", "NSE"];

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  INDIA: "IN",
  INDIAN: "IN",
  USA: "US",
  UNITEDSTATES: "US",
  UNITEDSTATESOFAMERICA: "US",
  UK: "GB",
  UNITEDKINGDOM: "GB",
  ENGLAND: "GB",
};

const COUNTRY_CODE_ALIASES: Record<string, string[]> = {
  IN: ["IN", "INDIA"],
  US: ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"],
  GB: ["GB", "UK", "UNITED KINGDOM", "ENGLAND"],
  AE: ["AE", "UAE", "UNITED ARAB EMIRATES"],
};

const COUNTRY_CODE_EXCHANGES: Record<string, string[]> = {
  IN: ["NSE", "BSE"],
  US: ["NASDAQ", "NYSE", "AMEX"],
  GB: ["LSE"],
  JP: ["TYO"],
  DE: ["FRA"],
  CA: ["TSX"],
  AU: ["ASX"],
};

export type StableCursor = {
  createdAt: Date;
  _id: Types.ObjectId;
};

export type CursorDecodeResult =
  | { ok: true; cursor?: StableCursor }
  | { ok: false };

export function coerceSymbolType(value?: string): SymbolType | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (SUPPORTED_TYPES.includes(normalized as SymbolType)) {
    return normalized as SymbolType;
  }
  return undefined;
}

export function normalizeQuery(query: string): string {
  return query.trim();
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCountryToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function canonicalCountryCode(value?: string): string | undefined {
  if (!value) return undefined;
  const token = normalizeCountryToken(value);
  if (!token) return undefined;
  if (token.length === 2) return token;
  return COUNTRY_NAME_TO_CODE[token] ?? token;
}

export function buildCountryFilterInput(country?: string): { code: string; aliases: string[]; exchanges: string[] } | undefined {
  const code = canonicalCountryCode(country);
  if (!code) return undefined;

  const aliases = Array.from(new Set([
    code,
    ...(COUNTRY_CODE_ALIASES[code] ?? []),
  ])).map((entry) => entry.toUpperCase());

  const exchanges = Array.from(new Set(COUNTRY_CODE_EXCHANGES[code] ?? [])).map((entry) => entry.toUpperCase());
  return { code, aliases, exchanges };
}

export function matchesCountryFlexible(
  symbolCountry: string | undefined,
  symbolExchange: string | undefined,
  requestedCountry?: string,
): boolean {
  if (!requestedCountry || requestedCountry.toLowerCase() === "all") return true;
  const normalized = buildCountryFilterInput(requestedCountry);
  if (!normalized) return true;

  const country = String(symbolCountry || "").toUpperCase().trim();
  const exchange = String(symbolExchange || "").toUpperCase().trim();

  if (normalized.aliases.includes(country)) return true;
  if (normalized.exchanges.includes(exchange)) return true;
  return false;
}

export function buildFilter(params: { query: string; type?: string; country?: string }): FilterQuery<SymbolDocument> {
  const andConditions: FilterQuery<SymbolDocument>[] = [];
  const q = normalizeQuery(params.query);

  if (q) {
    andConditions.push({
      $or: [
      { symbol: { $regex: `^${escapeRegex(q)}`, $options: "i" } },
      { name: { $regex: escapeRegex(q), $options: "i" } },
      { fullSymbol: { $regex: escapeRegex(q), $options: "i" } },
      ],
    });
  }

  if (params.type) {
    const type = coerceSymbolType(params.type);
    if (type) {
      andConditions.push({ type });
    }
  }

  const countryFilter = buildCountryFilterInput(params.country);
  if (countryFilter) {
    const countryOrExchange: FilterQuery<SymbolDocument>[] = [
      { country: { $in: countryFilter.aliases } },
    ];
    if (countryFilter.exchanges.length > 0) {
      countryOrExchange.push({ exchange: { $in: countryFilter.exchanges } });
    }
    andConditions.push({ $or: countryOrExchange });
  }

  if (andConditions.length === 0) {
    return {};
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  const filter: FilterQuery<SymbolDocument> = { $and: andConditions };

  return filter;
}

export function fallbackSymbolIconUrl(exchange: string): string {
  const exchangeDomain = exchange ? `${exchange.toLowerCase()}.com` : "example.com";
  return `https://www.google.com/s2/favicons?domain=${exchangeDomain}&sz=128`;
}

export function toTypeLabel(type: string): string {
  if (type === "stock") return "Stock";
  if (type === "etf") return "ETF";
  if (type === "crypto") return "Crypto";
  if (type === "forex") return "Forex";
  if (type === "index") return "Index";
  if (type === "derivative") return "Derivative";
  return type;
}

function signCursorPayload(payload: string): string {
  return crypto
    .createHmac("sha256", env.CURSOR_SIGNING_SECRET)
    .update(payload)
    .digest("base64url");
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function encodeCursor(cursor: { createdAt: Date; _id: Types.ObjectId | string }): string {
  const payload = Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      _id: String(cursor._id),
    }),
    "utf8",
  ).toString("base64url");

  const signature = signCursorPayload(payload);
  return `${payload}.${signature}`;
}

export function decodeCursor(raw?: string): CursorDecodeResult {
  if (!raw) return { ok: true, cursor: undefined };

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return { ok: false };
  }

  const expectedSignature = signCursorPayload(payload);
  if (!safeEquals(signature, expectedSignature)) {
    return { ok: false };
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { createdAt?: string; _id?: string };
    if (!parsed.createdAt || !parsed._id || !Types.ObjectId.isValid(parsed._id)) {
      return { ok: false };
    }

    const createdAt = new Date(parsed.createdAt);
    if (!Number.isFinite(createdAt.getTime())) {
      return { ok: false };
    }

    return {
      ok: true,
      cursor: {
        createdAt,
        _id: new Types.ObjectId(parsed._id),
      },
    };
  } catch {
    return { ok: false };
  }
}

export async function resolveCursorAnchor(cursor?: StableCursor): Promise<StableCursor | undefined> {
  if (!cursor) return undefined;

  const row = await SymbolModel.findById(cursor._id)
    .select({ createdAt: 1 })
    .lean<{ _id: Types.ObjectId; createdAt?: Date } | null>();

  if (!row?.createdAt || !Number.isFinite(new Date(row.createdAt).getTime())) {
    throw new Error("INVALID_CURSOR_TOKEN");
  }

  return {
    _id: row._id,
    createdAt: new Date(row.createdAt),
  };
}