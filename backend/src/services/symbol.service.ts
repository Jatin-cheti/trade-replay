import crypto from "node:crypto";
import { FilterQuery, Types } from "mongoose";
import { SymbolDocument, SymbolModel } from "../models/Symbol";
import { env } from "../config/env";
import { resolveStaticIcon } from "../config/staticIconMap";
import { isRedisReady } from "../config/redis";
import { getOrSetCachedJsonWithLock } from "./cache.service";
import { enqueueSymbolLogoEnrichmentBatch } from "./logoQueue.service";
import { clusterScopedKey, stableHash } from "./redisKey.service";
import { recordSymbolIconResult, recordSymbolSearchLatency } from "./metrics.service";

type SymbolType = "stock" | "crypto" | "forex" | "index";
const SUPPORTED_TYPES: SymbolType[] = ["stock", "crypto", "forex", "index"];

function coerceSymbolType(value?: string): SymbolType | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (SUPPORTED_TYPES.includes(normalized as SymbolType)) {
    return normalized as SymbolType;
  }
  return undefined;
}

export interface SymbolRegistryItem {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: SymbolType;
  currency: string;
  iconUrl?: string;
  companyDomain?: string;
  s3Icon?: string;
  popularity: number;
  searchFrequency?: number;
  isFallback?: boolean;
  realIconUrl?: string;
  fallbackIconUrl?: string;
  displayIconUrl?: string;
}

export interface SymbolSearchResult {
  items: SymbolRegistryItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

type SymbolRegistryRow = SymbolRegistryItem & { _id: Types.ObjectId };

type StableCursor = {
  createdAt: Date;
  _id: Types.ObjectId;
};

type CursorDecodeResult =
  | { ok: true; cursor?: StableCursor }
  | { ok: false };

const CACHE_TTL_SECONDS = 60;
const SEARCH_PRECACHE_QUERIES = ["A", "S", "B", "N", "US", "IN", "BTC", "USD", "EUR", "NASDAQ", "NSE"];

function normalizeQuery(query: string): string {
  return query.trim();
}

function buildFilter(params: { query: string; type?: string; country?: string }): FilterQuery<SymbolDocument> {
  const filter: FilterQuery<SymbolDocument> = {};
  const q = normalizeQuery(params.query);

  if (q) {
    filter.$or = [
      { symbol: { $regex: `^${escapeRegex(q)}`, $options: "i" } },
      { name: { $regex: escapeRegex(q), $options: "i" } },
      { fullSymbol: { $regex: escapeRegex(q), $options: "i" } },
    ];
  }

  if (params.type) {
    const type = coerceSymbolType(params.type);
    if (type) {
      filter.type = type;
    }
  }

  if (params.country) {
    filter.country = params.country.toUpperCase();
  }

  return filter;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fallbackSymbolIconUrl(exchange: string): string {
  const exchangeDomain = exchange ? `${exchange.toLowerCase()}.com` : "example.com";
  return `https://www.google.com/s2/favicons?domain=${exchangeDomain}&sz=128`;
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

function encodeCursor(cursor: { createdAt: Date; _id: Types.ObjectId | string }): string {
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

function decodeCursor(raw?: string): CursorDecodeResult {
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

async function resolveCursorAnchor(cursor?: StableCursor): Promise<StableCursor | undefined> {
  if (!cursor) return undefined;

  // Always anchor pagination from DB-stored createdAt to avoid client/server clock skew effects.
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

export async function searchSymbols(params: {
  query: string;
  type?: string;
  country?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  skipLogoEnrichment?: boolean;
  disablePrefetch?: boolean;
  skipSearchFrequencyUpdate?: boolean;
  trackMetrics?: boolean;
}): Promise<SymbolSearchResult> {
  const startedAt = Date.now();
  const query = normalizeQuery(params.query);
  const limit = Math.max(1, Math.min(100, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);
  const decodedCursor = decodeCursor(params.cursor);
  if (!decodedCursor.ok) {
    throw new Error("INVALID_CURSOR_TOKEN");
  }
  const cursor = await resolveCursorAnchor(decodedCursor.cursor);

  const partition = stableHash(`${query.toLowerCase()}:${params.type ?? "all"}:${params.country ?? "all"}`);
  const cacheKey = clusterScopedKey(
    "app:symbols:search",
    partition,
    `${query.toLowerCase()}:${params.type ?? "all"}:${params.country ?? "all"}:${limit}:${params.cursor ?? `offset:${offset}`}`,
  );

  const response = await getOrSetCachedJsonWithLock<SymbolSearchResult>(cacheKey, CACHE_TTL_SECONDS, async () => {
    const baseFilter = buildFilter({ query, type: params.type, country: params.country });
    let filter: FilterQuery<SymbolDocument> = baseFilter;

    if (cursor) {
      const cursorWindow: FilterQuery<SymbolDocument> = {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            _id: { $lt: cursor._id },
          },
        ],
      };
      filter = { $and: [baseFilter, cursorWindow] };
    }

    const queryBuilder = SymbolModel.find(filter)
      .select({
        symbol: 1,
        fullSymbol: 1,
        name: 1,
        exchange: 1,
        country: 1,
        type: 1,
        currency: 1,
        iconUrl: 1,
        companyDomain: 1,
        s3Icon: 1,
        popularity: 1,
        searchFrequency: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<Array<SymbolRegistryRow & { createdAt: Date }>>();

    if (!cursor && offset > 0) {
      queryBuilder.skip(offset);
    }

    const rows = await queryBuilder;

    const hasMore = rows.length > limit;
    const pagedRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pagedRows[pagedRows.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
      : null;
    const paged: SymbolRegistryItem[] = pagedRows.map(({ _id: _unused, createdAt: _createdAt, ...rest }) => {
      const staticIcon = resolveStaticIcon(rest.symbol);
      const realIconUrl = rest.iconUrl || rest.s3Icon || staticIcon || "";
      const fallbackIconUrl = fallbackSymbolIconUrl(rest.exchange);
      const isFallback = !realIconUrl;
      const displayIconUrl = isFallback ? fallbackIconUrl : realIconUrl;
      return {
        ...rest,
        iconUrl: realIconUrl,
        realIconUrl,
        fallbackIconUrl,
        isFallback,
        displayIconUrl,
      };
    });

    return {
      items: paged,
      total: -1,
      limit,
      offset,
      hasMore,
      nextCursor,
    };
  });

  if (!params.skipLogoEnrichment && isRedisReady()) {
    enqueueSymbolLogoEnrichmentBatch(response.items.slice(0, 20));
  }

  if (response.items.length > 0 && !params.skipSearchFrequencyUpdate) {
    const ids = response.items.slice(0, 20).map((item) => item.fullSymbol);
    void SymbolModel.updateMany({ fullSymbol: { $in: ids } }, { $inc: { searchFrequency: 1 } }).catch(() => {
      // Search path should not fail on frequency update issues.
    });
  }

  if (response.nextCursor && !params.disablePrefetch) {
    const nextKey = clusterScopedKey(
      "app:symbols:search",
      partition,
      `${query.toLowerCase()}:${params.type ?? "all"}:${params.country ?? "all"}:${limit}:${response.nextCursor}`,
    );

    void getOrSetCachedJsonWithLock<SymbolSearchResult>(nextKey, CACHE_TTL_SECONDS, async () => {
      return searchSymbols({
        query,
        type: params.type,
        country: params.country,
        limit,
        cursor: response.nextCursor ?? undefined,
        skipLogoEnrichment: true,
        disablePrefetch: true,
        skipSearchFrequencyUpdate: true,
        trackMetrics: false,
      });
    }).catch(() => {
      // Prefetch must never fail user requests.
    });
  }

  if (params.trackMetrics !== false) {
    for (const item of response.items) {
      recordSymbolIconResult(Boolean(item.isFallback));
    }
    recordSymbolSearchLatency(Date.now() - startedAt);
  }
  return response;
}

export async function warmSymbolSearchCache(): Promise<{ warmed: number; failed: number }> {
  let warmed = 0;
  let failed = 0;

  await Promise.all(
    SEARCH_PRECACHE_QUERIES.map(async (query) => {
      try {
        await searchSymbols({
          query,
          limit: 40,
          skipLogoEnrichment: true,
          trackMetrics: false,
        });
        warmed += 1;
      } catch {
        failed += 1;
      }
    }),
  );

  return { warmed, failed };
}

export async function fetchSymbolFilters(type?: string): Promise<{
  countries: Array<{ value: string; label: string }>;
  types: Array<{ value: string; label: string }>;
}> {
  const filter: FilterQuery<SymbolDocument> = {};
  const resolvedType = coerceSymbolType(type);
  if (resolvedType) {
    filter.type = resolvedType;
  }

  const [countryRows, typeRows] = await Promise.all([
    SymbolModel.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    SymbolModel.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    countries: [{ value: "all", label: "All Countries" }, ...countryRows.map((row) => ({ value: row._id, label: row._id }))],
    types: [{ value: "all", label: "All Types" }, ...typeRows.map((row) => ({ value: row._id, label: toTypeLabel(row._id) }))],
  };
}

function toTypeLabel(type: string): string {
  if (type === "stock") return "Stock";
  if (type === "crypto") return "Crypto";
  if (type === "forex") return "Forex";
  if (type === "index") return "Index";
  return type;
}

export function mapCategoryToSymbolType(category?: string): SymbolType | undefined {
  if (!category) return undefined;
  const normalized = category.toLowerCase();
  if (normalized === "stocks" || normalized === "funds" || normalized === "bonds" || normalized === "options") return "stock";
  if (normalized === "crypto") return "crypto";
  if (normalized === "forex") return "forex";
  if (normalized === "indices" || normalized === "futures" || normalized === "economy") return "index";
  return undefined;
}

export function toAssetSearchItem(symbol: SymbolRegistryItem) {
  const category = symbol.type === "stock"
    ? "stocks"
    : symbol.type === "crypto"
      ? "crypto"
      : symbol.type === "forex"
        ? "forex"
        : "indices";

  const market = category === "stocks"
    ? "Stocks"
    : category === "crypto"
      ? "Crypto"
      : category === "forex"
        ? "Forex"
        : "Indices";

  const persistedIcon = symbol.realIconUrl || symbol.iconUrl || symbol.s3Icon || resolveStaticIcon(symbol.symbol) || "";
  const fallbackIconUrl = symbol.fallbackIconUrl || fallbackSymbolIconUrl(symbol.exchange);
  const isFallback = symbol.isFallback ?? !persistedIcon;
  const displayIconUrl = symbol.displayIconUrl || (isFallback ? fallbackIconUrl : persistedIcon);

  return {
    ticker: symbol.symbol,
    symbol: symbol.symbol,
    name: symbol.name,
    exchange: symbol.exchange,
    region: symbol.country,
    instrumentType: symbol.type,
    type: symbol.type,
    category,
    assetType: category,
    market,
    country: symbol.country,
    sector: "",
    exchangeType: symbol.type === "crypto" ? "cex" : "",
    icon: "",
    exchangeIcon: "",
    exchangeLogoUrl: "",
    iconUrl: persistedIcon,
    logoUrl: displayIconUrl,
    displayIconUrl,
    isFallback,
    source: "symbol-registry",
  };
}
