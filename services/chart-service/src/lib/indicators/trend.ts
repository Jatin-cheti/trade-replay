import { atr } from "./volatility";

export function adx(high: number[], low: number[], close: number[], period: number): number[] {
  const out = Array.from({ length: close.length }, () => Number.NaN);
  const plusDm = Array.from({ length: close.length }, () => 0);
  const minusDm = Array.from({ length: close.length }, () => 0);
  for (let i = 1; i < close.length; i += 1) {
    const up = high[i] - high[i - 1];
    const down = low[i - 1] - low[i];
    plusDm[i] = up > down && up > 0 ? up : 0;
    minusDm[i] = down > up && down > 0 ? down : 0;
  }
  const tr = atr(high, low, close, period);
  for (let i = 0; i < close.length; i += 1) {
    if (!Number.isFinite(tr[i]) || tr[i] === 0 || i < period) {
      continue;
    }
    const plus = (100 * plusDm.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)) / (tr[i] * period);
    const minus = (100 * minusDm.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)) / (tr[i] * period);
    out[i] = (100 * Math.abs(plus - minus)) / Math.max(plus + minus, 1e-9);
  }
  return out;
}

export function aroon(high: number[], low: number[], period: number): { up: number[]; down: number[] } {
  const up = Array.from({ length: high.length }, () => Number.NaN);
  const down = Array.from({ length: low.length }, () => Number.NaN);
  for (let i = period - 1; i < high.length; i += 1) {
    const hs = high.slice(i - period + 1, i + 1);
    const ls = low.slice(i - period + 1, i + 1);
    const hh = hs.lastIndexOf(Math.max(...hs));
    const ll = ls.lastIndexOf(Math.min(...ls));
    up[i] = ((period - 1 - (period - 1 - hh)) / (period - 1)) * 100;
    down[i] = ((period - 1 - (period - 1 - ll)) / (period - 1)) * 100;
  }
  return { up, down };
}

export function supertrend(high: number[], low: number[], close: number[], period: number, mult: number): number[] {
  const out = Array.from({ length: close.length }, () => Number.NaN);
  const tr = atr(high, low, close, period);
  let prev = Number.NaN;
  for (let i = 0; i < close.length; i += 1) {
    if (!Number.isFinite(tr[i])) {
      continue;
    }
    const base = (high[i] + low[i]) / 2;
    const upper = base + (mult * tr[i]);
    const lower = base - (mult * tr[i]);
    if (!Number.isFinite(prev)) {
      prev = close[i] <= upper ? upper : lower;
    } else {
      prev = close[i] > prev ? Math.max(lower, prev) : Math.min(upper, prev);
    }
    out[i] = prev;
  }
  return out;
}
