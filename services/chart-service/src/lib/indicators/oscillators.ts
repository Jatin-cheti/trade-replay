import { ema } from "./moving-averages";

export function rsi(values: number[], period: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN);
  if (values.length < 2 || period <= 0) {
    return out;
  }
  const gains = Array.from({ length: values.length }, () => 0);
  const losses = Array.from({ length: values.length }, () => 0);
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    gains[i] = Math.max(d, 0);
    losses[i] = Math.max(-d, 0);
  }
  const avgGain = ema(gains, period);
  const avgLoss = ema(losses, period);
  for (let i = 0; i < values.length; i += 1) {
    if (!Number.isFinite(avgGain[i]) || !Number.isFinite(avgLoss[i])) {
      continue;
    }
    if (avgLoss[i] === 0) {
      out[i] = 100;
      continue;
    }
    const rs = avgGain[i] / avgLoss[i];
    out[i] = 100 - (100 / (1 + rs));
  }
  return out;
}

export function stochastic(high: number[], low: number[], close: number[], period: number): number[] {
  const out = Array.from({ length: close.length }, () => Number.NaN);
  for (let i = period - 1; i < close.length; i += 1) {
    const h = Math.max(...high.slice(i - period + 1, i + 1));
    const l = Math.min(...low.slice(i - period + 1, i + 1));
    out[i] = h === l ? 0 : ((close[i] - l) / (h - l)) * 100;
  }
  return out;
}

export function cci(high: number[], low: number[], close: number[], period: number): number[] {
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const out = Array.from({ length: tp.length }, () => Number.NaN);
  for (let i = period - 1; i < tp.length; i += 1) {
    const w = tp.slice(i - period + 1, i + 1);
    const ma = w.reduce((a, b) => a + b, 0) / period;
    const md = w.reduce((a, b) => a + Math.abs(b - ma), 0) / period;
    out[i] = md === 0 ? 0 : (tp[i] - ma) / (0.015 * md);
  }
  return out;
}

export function williamsR(high: number[], low: number[], close: number[], period: number): number[] {
  const out = Array.from({ length: close.length }, () => Number.NaN);
  for (let i = period - 1; i < close.length; i += 1) {
    const h = Math.max(...high.slice(i - period + 1, i + 1));
    const l = Math.min(...low.slice(i - period + 1, i + 1));
    out[i] = h === l ? 0 : ((h - close[i]) / (h - l)) * -100;
  }
  return out;
}
