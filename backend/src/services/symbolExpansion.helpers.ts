import { GlobalSymbolMaster } from "../models/GlobalSymbolMaster";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// ── Types ────────────────────────────────────────────────────────────────

export interface RawSymbol {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  source: string;
  domain?: string;
  logoUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ExpansionResult {
  source: string;
  fetched: number;
  newInserted: number;
  existingSkipped: number;
  errors: number;
  durationMs: number;
}

export interface FullExpansionReport {
  totalBefore: number;
  totalAfter: number;
  netGain: number;
  sources: ExpansionResult[];
  totalDurationMs: number;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────

export const USER_AGENT = "tradereplay-symbol-expansion/2.0";
export const FETCH_TIMEOUT_MS = 30_000;

// ── FMP Circuit Breaker ──────────────────────────────────────────────────

let fmpCircuitOpen = false;
let fmpCircuitOpenedAt = 0;
const FMP_CIRCUIT_RESET_MS = 10 * 60 * 1000;

export function isFmpAvailable(): boolean {
  if (!fmpCircuitOpen) return true;
  if (Date.now() - fmpCircuitOpenedAt > FMP_CIRCUIT_RESET_MS) {
    fmpCircuitOpen = false;
    logger.info("fmp_circuit_reset", { message: "FMP circuit breaker reset, will retry" });
    return true;
  }
  return false;
}

export function tripFmpCircuit(error: unknown): void {
  if (!fmpCircuitOpen) {
    fmpCircuitOpen = true;
    fmpCircuitOpenedAt = Date.now();
    logger.warn("fmp_circuit_tripped", {
      message: "FMP unreachable — skipping remaining FMP sources this cycle",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function fmpSkippedResult(source: string): ExpansionResult {
  return { source, fetched: 0, newInserted: 0, existingSkipped: 0, errors: 0, durationMs: 0 };
}

export async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}_${url.split("?")[0]}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}_${url.split("?")[0]}`);
    return res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function fmpUrl(path: string): string {
  const key = env.FMP_API_KEY;
  if (!key) return "";
  const separator = path.includes("?") ? "&" : "?";
  return `https://financialmodelingprep.com${path}${separator}apikey=${encodeURIComponent(key)}`;
}

// ── Batch upsert helper ──────────────────────────────────────────────────

export const UPSERT_CHUNK_SIZE = 1000;

export async function upsertToGlobalMaster(symbols: RawSymbol[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < symbols.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + UPSERT_CHUNK_SIZE);
    const ops = chunk.map((s) => ({
      updateOne: {
        filter: { fullSymbol: s.fullSymbol },
        update: {
          $setOnInsert: {
            symbol: s.symbol,
            fullSymbol: s.fullSymbol,
            name: s.name,
            exchange: s.exchange,
            country: s.country,
            type: s.type,
            currency: s.currency,
            source: s.source,
            domain: s.domain || "",
            logoUrl: s.logoUrl || "",
            metadata: s.metadata || {},
            status: "active",
            firstSeenAt: new Date(),
          },
          $set: { lastSeenAt: new Date() },
        },
        upsert: true,
      },
    }));

    const result = await GlobalSymbolMaster.bulkWrite(ops, { ordered: false });
    inserted += result.upsertedCount;
    skipped += chunk.length - result.upsertedCount;

    if (i % 5000 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return { inserted, skipped };
}

// ── Country / Currency / Type helpers ────────────────────────────────────

const EXCHANGE_COUNTRY_MAP: Record<string, string> = {
  NYSE: "US", NASDAQ: "US", NYSEARCA: "US", AMEX: "US", BATS: "US", OTC: "US", CBOE: "US",
  NSE: "IN", BSE: "IN",
  LSE: "GB", LON: "GB",
  XETRA: "DE", FRA: "DE",
  EURONEXT: "EU", EPA: "FR", AMS: "NL", EBR: "BE", LIS: "PT",
  TSE: "JP", JPX: "JP",
  HKEX: "HK", HKG: "HK",
  ASX: "AU",
  TSX: "CA", TSXV: "CA",
  JSE: "ZA",
  KRX: "KR", KSC: "KR",
  SGX: "SG",
  SIX: "CH", SWX: "CH",
  BME: "ES", MCE: "ES",
  MIL: "IT", BIT: "IT",
  SAU: "SA",
  TAI: "TW", TWSE: "TW", TPE: "TW",
  SSE: "CN", SZSE: "CN", SHH: "CN", SHZ: "CN",
  MOEX: "RU", MCX: "RU",
  BIST: "TR", IST: "TR",
  SET: "TH",
  IDX: "ID", JKT: "ID",
  BURSA: "MY", KLSE: "MY",
  NZX: "NZ",
  BVMF: "BR", SAO: "BR",
  BCBA: "AR", BUE: "AR",
  EGX: "EG", CAI: "EG",
  BINANCE: "GLOBAL", COINBASE: "GLOBAL", KRAKEN: "GLOBAL",
  OKX: "GLOBAL", BYBIT: "GLOBAL", GATEIO: "GLOBAL", KUCOIN: "GLOBAL",
  MEXC: "GLOBAL", BITFINEX: "GLOBAL", HUOBI: "GLOBAL", CRYPTOCOM: "GLOBAL",
  FOREX: "GLOBAL", FX: "GLOBAL",
  CRYPTO: "GLOBAL", COMMODITY: "GLOBAL",
};

export function deriveCountry(exchange: string): string {
  return EXCHANGE_COUNTRY_MAP[exchange.toUpperCase()] || "GLOBAL";
}

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  US: "USD", IN: "INR", GB: "GBP", DE: "EUR", EU: "EUR", FR: "EUR", NL: "EUR",
  BE: "EUR", PT: "EUR", ES: "EUR", IT: "EUR", JP: "JPY", HK: "HKD",
  AU: "AUD", CA: "CAD", ZA: "ZAR", KR: "KRW", SG: "SGD", CH: "CHF",
  SA: "SAR", TW: "TWD", CN: "CNY", RU: "RUB", TR: "TRY", TH: "THB",
  ID: "IDR", MY: "MYR", NZ: "NZD", BR: "BRL", AR: "ARS", EG: "EGP",
  GLOBAL: "USD",
};

export function deriveCurrency(country: string): string {
  return COUNTRY_CURRENCY_MAP[country.toUpperCase()] || "USD";
}

export function inferType(fmpType: string | undefined, name: string, exchange: string): string {
  const t = (fmpType || "").toLowerCase();
  if (t === "etf" || t === "fund") return "etf";
  if (t === "crypto") return "crypto";
  if (exchange === "FOREX" || exchange === "FX") return "forex";
  if (exchange === "COMMODITY") return "commodity";
  if (name.toLowerCase().includes("index") || name.toLowerCase().includes("composite")) return "index";
  return "stock";
}

export function normalizeSymbolType(type: string): "stock" | "etf" | "crypto" | "forex" | "index" | "derivative" | "bond" | "economy" {
  const t = type.toLowerCase();
  if (t === "crypto") return "crypto";
  if (t === "forex") return "forex";
  if (t === "index") return "index";
  if (t === "etf" || t === "fund") return "etf";
  if (t === "derivative") return "derivative";
  if (t === "bond") return "bond";
  if (t === "economy") return "economy";
  return "stock";
}