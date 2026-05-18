import type { IndicatorComputeContext, IndicatorDefinition } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { clampInt, nulls, rollingSma, rollingStdDev } from './_helpers.ts';

type Num = number | null;

export function computeBollingerPctB(values: readonly Num[], period: number, mult: number): Num[] {
  const basis = rollingSma(values, period);
  const std = rollingStdDev(values, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (basis[i] == null || std[i] == null || values[i] == null) continue;
    const upper = basis[i]! + mult * std[i]!;
    const lower = basis[i]! - mult * std[i]!;
    if (upper === lower) continue;
    out[i] = (values[i]! - lower) / (upper - lower);
  }
  return out;
}

export function computeBollingerBandwidth(values: readonly Num[], period: number, mult: number): Num[] {
  const basis = rollingSma(values, period);
  const std = rollingStdDev(values, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (basis[i] == null || std[i] == null || basis[i] === 0) continue;
    const upper = basis[i]! + mult * std[i]!;
    const lower = basis[i]! - mult * std[i]!;
    out[i] = ((upper - lower) / basis[i]!) * 100;
  }
  return out;
}

export function computeChaikinVolatility(high: readonly Num[], low: readonly Num[], period: number, diffPeriod: number): Num[] {
  const hl = nulls(high.length);
  for (let i = 0; i < high.length; i++) {
    if (high[i] == null || low[i] == null) continue;
    hl[i] = high[i]! - low[i]!;
  }
  const ema = computeEmaValues(hl, period);
  const out = nulls(high.length);
  for (let i = diffPeriod; i < high.length; i++) {
    if (ema[i] == null || ema[i - diffPeriod] == null || ema[i - diffPeriod] === 0) continue;
    out[i] = ((ema[i]! - ema[i - diffPeriod]!) / ema[i - diffPeriod]!) * 100;
  }
  return out;
}

export function computeVariance(values: readonly Num[], period: number): Num[] {
  const std = rollingStdDev(values, period);
  return std.map((v) => (v == null ? null : v * v));
}

export function computeAdl(high: readonly Num[], low: readonly Num[], close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let acc = 0;
  for (let i = 0; i < close.length; i++) {
    if (high[i] == null || low[i] == null || close[i] == null || volume[i] == null || high[i] === low[i]) {
      out[i] = i === 0 ? 0 : out[i - 1];
      continue;
    }
    const mfm = ((close[i]! - low[i]!) - (high[i]! - close[i]!)) / (high[i]! - low[i]!);
    acc += mfm * volume[i]!;
    out[i] = acc;
  }
  return out;
}

export function computeForceIndex(close: readonly Num[], volume: readonly Num[], period: number): Num[] {
  const raw = nulls(close.length);
  for (let i = 1; i < close.length; i++) {
    if (close[i] == null || close[i - 1] == null || volume[i] == null) continue;
    raw[i] = (close[i]! - close[i - 1]!) * volume[i]!;
  }
  return computeEmaValues(raw, period);
}

export function computeEom(high: readonly Num[], low: readonly Num[], volume: readonly Num[], period: number): Num[] {
  const raw = nulls(high.length);
  for (let i = 1; i < high.length; i++) {
    if (high[i] == null || low[i] == null || high[i - 1] == null || low[i - 1] == null || volume[i] == null || volume[i] === 0) continue;
    const distance = ((high[i]! + low[i]!) / 2) - ((high[i - 1]! + low[i - 1]!) / 2);
    const boxRatio = (volume[i]! / 100000000) / Math.max(1e-9, high[i]! - low[i]!);
    raw[i] = distance / boxRatio;
  }
  return rollingSma(raw, period);
}

export function computeNvi(close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let idx = 1000;
  if (close.length > 0) out[0] = idx;
  for (let i = 1; i < close.length; i++) {
    out[i] = idx;
    if (close[i] == null || close[i - 1] == null || volume[i] == null || volume[i - 1] == null || close[i - 1] === 0) continue;
    if (volume[i]! < volume[i - 1]!) idx += idx * ((close[i]! - close[i - 1]!) / close[i - 1]!);
    out[i] = idx;
  }
  return out;
}

export function computePvi(close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let idx = 1000;
  if (close.length > 0) out[0] = idx;
  for (let i = 1; i < close.length; i++) {
    out[i] = idx;
    if (close[i] == null || close[i - 1] == null || volume[i] == null || volume[i - 1] == null || close[i - 1] === 0) continue;
    if (volume[i]! > volume[i - 1]!) idx += idx * ((close[i]! - close[i - 1]!) / close[i - 1]!);
    out[i] = idx;
  }
  return out;
}

export function computeVpt(close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let acc = 0;
  if (close.length > 0) out[0] = 0;
  for (let i = 1; i < close.length; i++) {
    if (close[i] == null || close[i - 1] == null || volume[i] == null || close[i - 1] === 0) {
      out[i] = acc;
      continue;
    }
    acc += volume[i]! * ((close[i]! - close[i - 1]!) / close[i - 1]!);
    out[i] = acc;
  }
  return out;
}

export function computeVortex(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): { viPlus: Num[]; viMinus: Num[] } {
  const n = close.length;
  const tr = nulls(n);
  const vmPlus = nulls(n);
  const vmMinus = nulls(n);

  for (let i = 1; i < n; i++) {
    if (high[i] == null || low[i] == null || high[i - 1] == null || low[i - 1] == null || close[i - 1] == null) continue;
    tr[i] = Math.max(high[i]! - low[i]!, Math.abs(high[i]! - close[i - 1]!), Math.abs(low[i]! - close[i - 1]!));
    vmPlus[i] = Math.abs(high[i]! - low[i - 1]!);
    vmMinus[i] = Math.abs(low[i]! - high[i - 1]!);
  }

  const trSum = rollingSma(tr, period).map((v) => (v == null ? null : v * period));
  const vpSum = rollingSma(vmPlus, period).map((v) => (v == null ? null : v * period));
  const vmSum = rollingSma(vmMinus, period).map((v) => (v == null ? null : v * period));
  const viPlus = nulls(n);
  const viMinus = nulls(n);

  for (let i = 0; i < n; i++) {
    if (trSum[i] == null || trSum[i] === 0 || vpSum[i] == null || vmSum[i] == null) continue;
    viPlus[i] = vpSum[i]! / trSum[i]!;
    viMinus[i] = vmSum[i]! / trSum[i]!;
  }

  return { viPlus, viMinus };
}

function lineDef(id: string, name: string, color: string, compute: (ctx: IndicatorComputeContext) => Num[]): IndicatorDefinition {
  return {
    id,
    name,
    inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
    outputs: [{ name: id, seriesType: 'Line', pane: 'subpane', color, lineWidth: 1 }],
    compute(ctx) { return { outputs: [compute(ctx)] }; },
  };
}

export const bollingerPercentBDef: IndicatorDefinition = {
  id: 'bollinger_percent_b', name: 'Bollinger %B',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [{ name: 'pct_b', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeBollingerPctB(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1), Math.max(0.1, Number(ctx.params.mult ?? 2)))] };
  },
};

export const bollingerBandwidthDef: IndicatorDefinition = {
  id: 'bollinger_bandwidth', name: 'Bollinger Bandwidth',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [{ name: 'bandwidth', seriesType: 'Line', pane: 'subpane', color: '#1abc9c', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeBollingerBandwidth(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1), Math.max(0.1, Number(ctx.params.mult ?? 2)))] };
  },
};

export const chaikinVolatilityDef: IndicatorDefinition = {
  id: 'chaikin_volatility', name: 'Chaikin Volatility',
  inputs: [
    { name: 'period', label: 'EMA Period', type: 'number', default: 10, min: 1, max: 200, step: 1 },
    { name: 'diff', label: 'Diff Period', type: 'number', default: 10, min: 1, max: 200, step: 1 },
  ],
  outputs: [{ name: 'chaikin_volatility', seriesType: 'Line', pane: 'subpane', color: '#f39c12', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeChaikinVolatility(ctx.high, ctx.low, clampInt(ctx.params.period ?? 10, 10, 1), clampInt(ctx.params.diff ?? 10, 10, 1))] };
  },
};

export const stddevDef = lineDef('stddev', 'Standard Deviation', '#3498db', (ctx) =>
  rollingStdDev(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1)));

export const varianceDef = lineDef('variance', 'Variance', '#5dade2', (ctx) =>
  computeVariance(ctx.close, clampInt(ctx.params.period ?? 20, 20, 1)));

export const adlDef: IndicatorDefinition = {
  id: 'adl', name: 'Accumulation Distribution Line',
  inputs: [],
  outputs: [{ name: 'adl', seriesType: 'Line', pane: 'subpane', color: '#2ecc71', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeAdl(ctx.high, ctx.low, ctx.close, ctx.volume)] }; },
};

export const forceIndexDef: IndicatorDefinition = {
  id: 'force_index', name: 'Force Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 13, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'force_index', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(52,152,219,0.45)', base: 0 }],
  compute(ctx) { return { outputs: [computeForceIndex(ctx.close, ctx.volume, clampInt(ctx.params.period ?? 13, 13, 1))] }; },
};

export const eomDef: IndicatorDefinition = {
  id: 'eom', name: 'Ease of Movement',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'eom', seriesType: 'Line', pane: 'subpane', color: '#af7ac5', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeEom(ctx.high, ctx.low, ctx.volume, clampInt(ctx.params.period ?? 14, 14, 1))] }; },
};

export const nviDef: IndicatorDefinition = {
  id: 'nvi', name: 'Negative Volume Index',
  inputs: [],
  outputs: [{ name: 'nvi', seriesType: 'Line', pane: 'subpane', color: '#1abc9c', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeNvi(ctx.close, ctx.volume)] }; },
};

export const pviDef: IndicatorDefinition = {
  id: 'pvi', name: 'Positive Volume Index',
  inputs: [],
  outputs: [{ name: 'pvi', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computePvi(ctx.close, ctx.volume)] }; },
};

export const vptDef: IndicatorDefinition = {
  id: 'vpt', name: 'Volume Price Trend',
  inputs: [],
  outputs: [{ name: 'vpt', seriesType: 'Line', pane: 'subpane', color: '#52be80', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeVpt(ctx.close, ctx.volume)] }; },
};

export const vortexDef: IndicatorDefinition = {
  id: 'vortex', name: 'Vortex Indicator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
  outputs: [
    { name: 'vi_plus', seriesType: 'Line', pane: 'subpane', color: '#2ecc71', lineWidth: 1 },
    { name: 'vi_minus', seriesType: 'Line', pane: 'subpane', color: '#e74c3c', lineWidth: 1 },
  ],
  compute(ctx) {
    const { viPlus, viMinus } = computeVortex(ctx.high, ctx.low, ctx.close, clampInt(ctx.params.period ?? 14, 14, 1));
    return { outputs: [viPlus, viMinus] };
  },
};
