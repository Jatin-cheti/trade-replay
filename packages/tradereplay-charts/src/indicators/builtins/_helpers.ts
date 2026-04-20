import { computeEmaValues } from './ema.ts';
import { computeSmaValues } from './sma.ts';

export type Num = number | null;

export function nulls(n: number): Num[] {
  return new Array(n).fill(null);
}

export function clampInt(v: number, fallback: number, min = 1): number {
  const n = Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(min, n);
}

export function mapTypicalPrice(
  high: readonly Num[],
  low: readonly Num[],
  close: readonly Num[],
): Num[] {
  const n = close.length;
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    if (h != null && l != null && c != null) out[i] = (h + l + c) / 3;
  }
  return out;
}

export function computeTrueRange(
  high: readonly Num[],
  low: readonly Num[],
  close: readonly Num[],
): Num[] {
  const n = close.length;
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    if (h == null || l == null) continue;
    if (i === 0 || close[i - 1] == null) {
      out[i] = h - l;
      continue;
    }
    const pc = close[i - 1]!;
    out[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  return out;
}

export function computeAtr(
  high: readonly Num[],
  low: readonly Num[],
  close: readonly Num[],
  period: number,
): Num[] {
  const tr = computeTrueRange(high, low, close);
  return computeEmaValues(tr, period, 1 / period);
}

export function rollingExtrema(
  values: readonly Num[],
  period: number,
  pickMax: boolean,
): Num[] {
  const n = values.length;
  const out = nulls(n);
  if (period < 1) return out;

  for (let i = period - 1; i < n; i++) {
    let best: number | null = null;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v == null) continue;
      valid++;
      if (best == null) best = v;
      else best = pickMax ? Math.max(best, v) : Math.min(best, v);
    }
    if (valid === period) out[i] = best;
  }

  return out;
}

export function rollingStdDev(values: readonly Num[], period: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  if (period < 1 || n < period) return out;

  let sum = 0;
  let sumSq = 0;
  let valid = 0;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v != null) {
      sum += v;
      sumSq += v * v;
      valid++;
    }

    if (i >= period) {
      const old = values[i - period];
      if (old != null) {
        sum -= old;
        sumSq -= old * old;
        valid--;
      }
    }

    if (i >= period - 1 && valid === period) {
      const mean = sum / period;
      const variance = Math.max(0, sumSq / period - mean * mean);
      out[i] = Math.sqrt(variance);
    }
  }

  return out;
}

export function rollingSum(values: readonly Num[], period: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  if (period < 1 || n < period) return out;

  let sum = 0;
  let valid = 0;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v != null) {
      sum += v;
      valid++;
    }

    if (i >= period) {
      const old = values[i - period];
      if (old != null) {
        sum -= old;
        valid--;
      }
    }

    if (i >= period - 1 && valid === period) out[i] = sum;
  }

  return out;
}

export function rollingSma(values: readonly Num[], period: number): Num[] {
  return computeSmaValues(values, period);
}

export function rollingEma(values: readonly Num[], period: number, k?: number): Num[] {
  return computeEmaValues(values, period, k);
}

export function firstValid(values: readonly Num[]): number {
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) return i;
  }
  return -1;
}
