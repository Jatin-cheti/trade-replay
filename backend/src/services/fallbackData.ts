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
  const basePrice = Math.max(5, (seed % 400) + (symbol.includes("USD") ? 1 : 20));
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
