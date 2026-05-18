import type { IndicatorDefinition } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeWmaValues } from './wma.ts';
import { clampInt, nulls } from './_helpers.ts';

type Num = number | null;

export function computeDemaValues(values: readonly Num[], period: number): Num[] {
  const ema1 = computeEmaValues(values, period);
  const ema2 = computeEmaValues(ema1, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ema1[i] == null || ema2[i] == null) continue;
    out[i] = 2 * ema1[i]! - ema2[i]!;
  }
  return out;
}

export function computeTemaValues(values: readonly Num[], period: number): Num[] {
  const ema1 = computeEmaValues(values, period);
  const ema2 = computeEmaValues(ema1, period);
  const ema3 = computeEmaValues(ema2, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ema1[i] == null || ema2[i] == null || ema3[i] == null) continue;
    out[i] = 3 * ema1[i]! - 3 * ema2[i]! + ema3[i]!;
  }
  return out;
}

export function computeHmaValues(values: readonly Num[], period: number): Num[] {
  const half = Math.max(1, Math.round(period / 2));
  const root = Math.max(1, Math.round(Math.sqrt(period)));
  const wmaHalf = computeWmaValues(values, half);
  const wmaFull = computeWmaValues(values, period);
  const raw = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (wmaHalf[i] == null || wmaFull[i] == null) continue;
    raw[i] = 2 * wmaHalf[i]! - wmaFull[i]!;
  }
  return computeWmaValues(raw, root);
}

export function computeZlemaValues(values: readonly Num[], period: number): Num[] {
  const lag = Math.max(1, Math.floor((period - 1) / 2));
  const adjusted = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    const cur = values[i];
    if (cur == null) continue;
    if (i >= lag && values[i - lag] != null) adjusted[i] = cur + (cur - values[i - lag]!);
    else adjusted[i] = cur;
  }
  return computeEmaValues(adjusted, period);
}

export function computeKamaValues(values: readonly Num[], erPeriod: number, fast: number, slow: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  const fastSc = 2 / (fast + 1);
  const slowSc = 2 / (slow + 1);
  let prev: number | null = null;

  for (let i = 0; i < n; i++) {
    const cur = values[i];
    if (cur == null) continue;
    if (i < erPeriod || values[i - erPeriod] == null) { prev = cur; continue; }

    let volatility = 0;
    let valid = true;
    for (let j = i - erPeriod + 1; j <= i; j++) {
      if (values[j] == null || values[j - 1] == null) { valid = false; break; }
      volatility += Math.abs(values[j]! - values[j - 1]!);
    }
    if (!valid || volatility === 0) continue;

    const change = Math.abs(cur - values[i - erPeriod]!);
    const er = change / volatility;
    const sc = Math.pow(er * (fastSc - slowSc) + slowSc, 2);
    prev = prev == null ? cur : prev + sc * (cur - prev);
    out[i] = prev;
  }
  return out;
}

export function computeAlmaValues(values: readonly Num[], period: number, sigma: number, offset: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights: number[] = [];
  let wSum = 0;
  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - m) * (i - m)) / (2 * s * s));
    weights.push(w);
    wSum += w;
  }
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) { valid = false; break; }
      sum += v * weights[j];
    }
    if (valid) out[i] = sum / wSum;
  }
  return out;
}

export function computeLsmaValues(values: readonly Num[], period: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  const sumX = (period * (period - 1)) / 2;
  const sumXX = ((period - 1) * period * (2 * period - 1)) / 6;
  const denom = period * sumXX - sumX * sumX;
  for (let i = period - 1; i < n; i++) {
    let sumY = 0, sumXY = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) { valid = false; break; }
      sumY += v;
      sumXY += j * v;
    }
    if (!valid) continue;
    const slope = (period * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / period;
    out[i] = intercept + slope * (period - 1);
  }
  return out;
}

const periodInput = (def = 20) => ({ name: 'period', label: 'Period', type: 'number' as const, default: def, min: 1, max: 500, step: 1 });

export const hmaDef: IndicatorDefinition = {
  id: 'hma', name: 'Hull Moving Average',
  inputs: [periodInput(20)],
  outputs: [{ name: 'hma', seriesType: 'Line', pane: 'overlay', color: '#f8c471', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeHmaValues(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1))] }; },
};

export const demaDef: IndicatorDefinition = {
  id: 'dema', name: 'Double Exponential Moving Average',
  inputs: [periodInput(20)],
  outputs: [{ name: 'dema', seriesType: 'Line', pane: 'overlay', color: '#f39c12', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeDemaValues(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1))] }; },
};

export const temaDef: IndicatorDefinition = {
  id: 'tema', name: 'Triple Exponential Moving Average',
  inputs: [periodInput(20)],
  outputs: [{ name: 'tema', seriesType: 'Line', pane: 'overlay', color: '#eb984e', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeTemaValues(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1))] }; },
};

export const zlemaDef: IndicatorDefinition = {
  id: 'zlema', name: 'Zero Lag EMA',
  inputs: [periodInput(20)],
  outputs: [{ name: 'zlema', seriesType: 'Line', pane: 'overlay', color: '#d35400', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeZlemaValues(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1))] }; },
};

export const kamaDef: IndicatorDefinition = {
  id: 'kama', name: 'Kaufman Adaptive Moving Average',
  inputs: [
    { name: 'period', label: 'ER Period', type: 'number', default: 10, min: 1, max: 200, step: 1 },
    { name: 'fast', label: 'Fast', type: 'number', default: 2, min: 1, max: 50, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 30, min: 2, max: 200, step: 1 },
  ],
  outputs: [{ name: 'kama', seriesType: 'Line', pane: 'overlay', color: '#af7ac5', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeKamaValues(ctx.close, clampInt(ctx.params.period ?? 10, 10, 1), clampInt(ctx.params.fast ?? 2, 2, 1), clampInt(ctx.params.slow ?? 30, 30, 2))] };
  },
};

export const almaDef: IndicatorDefinition = {
  id: 'alma', name: 'Arnaud Legoux Moving Average',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 9, min: 1, max: 200, step: 1 },
    { name: 'sigma', label: 'Sigma', type: 'number', default: 6, min: 1, max: 20, step: 1 },
    { name: 'offset', label: 'Offset', type: 'number', default: 0.85, min: 0, max: 1, step: 0.01 },
  ],
  outputs: [{ name: 'alma', seriesType: 'Line', pane: 'overlay', color: '#7dcea0', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeAlmaValues(ctx.close, clampInt(ctx.params.period ?? 9, 9, 1), Math.max(1, Number(ctx.params.sigma ?? 6)), Math.max(0, Math.min(1, Number(ctx.params.offset ?? 0.85))))] };
  },
};

export const lsmaDef: IndicatorDefinition = {
  id: 'lsma', name: 'Linear Regression Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 25, min: 2, max: 500, step: 1 }],
  outputs: [{ name: 'lsma', seriesType: 'Line', pane: 'overlay', color: '#58d68d', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeLsmaValues(ctx.close, clampInt(ctx.params.period ?? 25, 25, 2))] }; },
};
