import { rsi } from "./oscillators";

export function obv(close: number[], volume: number[]): number[] {
  const out = Array.from({ length: close.length }, () => 0);
  for (let i = 1; i < close.length; i += 1) {
    const dir = close[i] > close[i - 1] ? 1 : close[i] < close[i - 1] ? -1 : 0;
    out[i] = out[i - 1] + (dir * volume[i]);
  }
  return out;
}

export function vwap(high: number[], low: number[], close: number[], volume: number[]): number[] {
  const out = Array.from({ length: close.length }, () => Number.NaN);
  let pv = 0;
  let vv = 0;
  for (let i = 0; i < close.length; i += 1) {
    const tp = (high[i] + low[i] + close[i]) / 3;
    pv += tp * volume[i];
    vv += volume[i];
    out[i] = vv === 0 ? Number.NaN : pv / vv;
  }
  return out;
}

export function cmf(high: number[], low: number[], close: number[], volume: number[], period: number): number[] {
  const out = Array.from({ length: close.length }, () => Number.NaN);
  const mfv = close.map((c, i) => {
    const range = high[i] - low[i];
    if (range === 0) {
      return 0;
    }
    const mfm = ((c - low[i]) - (high[i] - c)) / range;
    return mfm * volume[i];
  });

  for (let i = period - 1; i < close.length; i += 1) {
    const v = volume.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    const m = mfv.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    out[i] = v === 0 ? 0 : m / v;
  }
  return out;
}

export function mfi(high: number[], low: number[], close: number[], volume: number[], period: number): number[] {
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const flow = tp.map((v, i) => v * volume[i]);
  const positive = Array.from({ length: tp.length }, () => 0);
  const negative = Array.from({ length: tp.length }, () => 0);
  for (let i = 1; i < tp.length; i += 1) {
    if (tp[i] >= tp[i - 1]) {
      positive[i] = flow[i];
    } else {
      negative[i] = flow[i];
    }
  }
  const ratio = positive.map((_, i) => {
    if (i < period) {
      return Number.NaN;
    }
    const p = positive.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    const n = negative.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    return n === 0 ? 100 : p / n;
  });
  return ratio.map((r) => Number.isFinite(r) ? 100 - (100 / (1 + r)) : Number.NaN);
}

export function volumeRsi(volume: number[], period: number): number[] {
  return rsi(volume, period);
}
