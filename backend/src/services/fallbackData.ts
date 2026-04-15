import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CandleData, ScenarioId } from "../types/shared";
import { FallbackFile } from "../types/service";

const fileByScenario: Record<ScenarioId, string> = {
  "2008-crash": "2008.json",
  "covid-2020": "covid.json",
  "dotcom-2000": "dotcom.json",
};

const cache = new Map<ScenarioId, FallbackFile>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadScenario(scenarioId: ScenarioId): FallbackFile {
  const cached = cache.get(scenarioId);
  if (cached) return cached;

  const fileName = fileByScenario[scenarioId];
  const directPath = path.resolve(__dirname, "../data", fileName);
  const sourcePath = path.resolve(__dirname, "../../src/data", fileName);
  const filePath = fs.existsSync(directPath) ? directPath : sourcePath;
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content) as FallbackFile;
  cache.set(scenarioId, parsed);
  return parsed;
}

export function getFallbackCandles(
  scenarioId: ScenarioId,
  symbol: string,
  startDate?: string,
  endDate?: string,
): CandleData[] {
  let candles: CandleData[] = [];

  if (fileByScenario[scenarioId]) {
    const data = loadScenario(scenarioId);
    candles = data.candlesBySymbol[symbol] ?? [];
  }

  if (!candles.length) {
    candles = generateSyntheticCandles(symbol, startDate, endDate);
  }

  return candles.filter((candle) => {
    if (startDate && candle.time < startDate) return false;
    if (endDate && candle.time > endDate) return false;
    return true;
  });
}

function generateSyntheticCandles(symbol: string, startDate?: string, endDate?: string): CandleData[] {
  const seed = symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const basePrice = getRealisticBasePrice(symbol, seed);
  const start = startDate ? new Date(startDate) : new Date("2021-01-04");
  const totalDays = 280;
  const candles: CandleData[] = [];
  let prevClose = basePrice;

  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const drift = ((seed % 9) - 4) * 0.0007;
    const wave = Math.sin((i + seed) / 16) * 0.012;
    const shock = Math.cos((i + seed) / 7) * 0.006;
    const move = drift + wave + shock;

    const open = prevClose;
    const close = Math.max(0.5, open * (1 + move));
    const spread = Math.max(open, close) * (0.006 + ((seed % 5) * 0.001));
    const high = Math.max(open, close) + spread;
    const low = Math.max(0.1, Math.min(open, close) - spread);

    candles.push({
      time: date.toISOString().split("T")[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(500000 + ((seed + i) % 2500000)),
    });

    prevClose = close;
  }

  return candles;
}

/* ── Realistic base price map for well-known symbols ── */
const REALISTIC_BASE: Record<string, number> = {
  // US Mega-caps
  AAPL: 228, MSFT: 420, GOOGL: 175, GOOG: 177, AMZN: 185, NVDA: 130,
  META: 510, TSLA: 245, BRK: 450, AVGO: 170, JPM: 195, V: 280,
  MA: 460, UNH: 540, HD: 340, PG: 160, JNJ: 155, COST: 730,
  NFLX: 650, ADBE: 530, CRM: 260, AMD: 155, INTC: 32, QCOM: 175,
  ORCL: 140, CSCO: 50, IBM: 180, DIS: 105, BA: 180, NKE: 95,
  MCD: 265, KO: 62, PEP: 170, WMT: 65, PYPL: 68, UBER: 72,
  SQ: 70, SNAP: 12, RIVN: 14, LCID: 4, PLTR: 22, COIN: 210,
  // India
  RELIANCE: 2950, TCS: 3900, INFY: 1500, HDFCBANK: 1650,
  ICICIBANK: 1050, SBIN: 780, ITC: 450, LT: 3500,
  HINDUNILVR: 2500, BHARTIARTL: 1400, WIPRO: 450, BAJFINANCE: 6700,
  // Crypto
  BTCUSDT: 62000, ETHUSDT: 3400, BNBUSDT: 580, SOLUSDT: 160,
  XRPUSDT: 0.52, ADAUSDT: 0.45, DOGEUSDT: 0.15, DOTUSDT: 7.2,
  AVAXUSDT: 35, MATICUSDT: 0.72, LINKUSDT: 14, LTCUSDT: 85,
  SHIBUSDT: 0.000025, UNIUSDT: 8.5, ATOMUSDT: 9.5,
  // Forex
  EURUSD: 1.085, GBPUSD: 1.27, USDJPY: 154, USDCHF: 0.88,
  AUDUSD: 0.66, USDCAD: 1.36, NZDUSD: 0.61, USDINR: 83.5,
  EURGBP: 0.855, EURJPY: 167, GBPJPY: 196,
  // Major ETFs
  SPY: 520, QQQ: 440, IWM: 210, VTI: 260, VOO: 480, DIA: 390,
  GLD: 215, SLV: 25, TLT: 95, AGG: 100, ARKK: 47,
  // Indices
  SPX: 5200, NDX: 18200, DJI: 39500, IXIC: 16400, RUT: 2100,
  VIX: 16, NIFTY50: 22000, SENSEX: 73000, FTSE100: 8100,
  N225: 38500, DAX: 18000,
  // Bonds (yields)
  US10Y: 4.4, US2Y: 4.9, US30Y: 4.6, US5Y: 4.5,
  GB10Y: 4.2, DE10Y: 2.5, JP10Y: 0.9, IN10Y: 7.1,
  // Commodities / Futures
  CL: 78, GC: 2350, SI: 28, NG: 2.3, ES: 5200,
  NQ: 18200, ZN: 110, HG: 4.3, ZC: 450, ZW: 580,
  // Economy
  DXY: 105, FEDFUNDS: 5.33,
};

function getRealisticBasePrice(symbol: string, seed: number): number {
  // Strip common suffixes/prefixes for matching
  const clean = symbol.replace(/[-.].*$/, "").replace(/^SYN-/, "").toUpperCase();
  if (REALISTIC_BASE[clean]) return REALISTIC_BASE[clean];

  // Try partial match (e.g., BTCUSD → BTC)
  for (const [key, price] of Object.entries(REALISTIC_BASE)) {
    if (clean.startsWith(key) && clean.length <= key.length + 4) return price;
  }

  // Fallback: heuristic based on symbol characteristics
  if (clean.includes("USD") || clean.includes("JPY") || clean.includes("EUR")) {
    return Math.max(0.5, (seed % 150) * 0.01 + 0.8); // forex-like
  }
  return Math.max(5, (seed % 400) + 20); // original fallback
}
