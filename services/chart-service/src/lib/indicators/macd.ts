import { ema } from "./moving-averages";

export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(values: number[], fast: number, slow: number, signalPeriod: number): MacdResult {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);
  const macdLine = values.map((_, i) => {
    if (!Number.isFinite(fastLine[i]) || !Number.isFinite(slowLine[i])) {
      return Number.NaN;
    }
    return fastLine[i] - slowLine[i];
  });
  const signal = ema(macdLine.map((v) => Number.isFinite(v) ? v : 0), signalPeriod);
  const histogram = macdLine.map((v, i) => Number.isFinite(v) && Number.isFinite(signal[i]) ? v - signal[i] : Number.NaN);
  return { macd: macdLine, signal, histogram };
}
