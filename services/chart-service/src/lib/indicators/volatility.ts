import { sma } from "./moving-averages";

export function atr(high: number[], low: number[], close: number[], period: number): number[] {
  const tr = close.map((_, i) => {
    if (i === 0) {
      return high[i] - low[i];
    }
    return Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1]),
    );
  });
  return sma(tr, period);
}

export function standardDeviation(values: number[], period: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN);
  for (let i = period - 1; i < values.length; i += 1) {
    const w = values.slice(i - period + 1, i + 1);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    const variance = w.reduce((a, b) => a + ((b - mean) ** 2), 0) / w.length;
    out[i] = Math.sqrt(variance);
  }
  return out;
}
