import type { IndicatorDefinition } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeRsiValues } from './rsi.ts';
import { computeAroonValues } from './aroon.ts';
import { clampInt, nulls, rollingSma } from './_helpers.ts';

type Num = number | null;

function highest(values: readonly Num[], from: number, to: number): number | null {
  let best: number | null = null;
  for (let i = from; i <= to; i++) {
    const v = values[i];
    if (v == null) return null;
    best = best == null ? v : Math.max(best, v);
  }
  return best;
}

function lowest(values: readonly Num[], from: number, to: number): number | null {
  let best: number | null = null;
  for (let i = from; i <= to; i++) {
    const v = values[i];
    if (v == null) return null;
    best = best == null ? v : Math.min(best, v);
  }
  return best;
}

function priceDiff(values: readonly Num[]): Num[] {
  const out = nulls(values.length);
  for (let i = 1; i < values.length; i++) {
    const cur = values[i], prev = values[i - 1];
    if (cur == null || prev == null) continue;
    out[i] = cur - prev;
  }
  return out;
}

export function computeStochRsiValues(close: readonly Num[], rsiPeriod: number, stochPeriod: number, smoothK: number, smoothD: number): { k: Num[]; d: Num[] } {
  const rsi = computeRsiValues(close, rsiPeriod);
  const raw = nulls(close.length);
  for (let i = stochPeriod - 1; i < close.length; i++) {
    const hi = highest(rsi, i - stochPeriod + 1, i);
    const lo = lowest(rsi, i - stochPeriod + 1, i);
    const rv = rsi[i];
    if (hi == null || lo == null || rv == null || hi === lo) continue;
    raw[i] = ((rv - lo) / (hi - lo)) * 100;
  }
  return { k: rollingSma(raw, smoothK), d: rollingSma(rollingSma(raw, smoothK), smoothD) };
}

export function computeRviValues(open: readonly Num[], high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): { rvi: Num[]; signal: Num[] } {
  const num = nulls(close.length);
  const den = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) continue;
    num[i] = close[i]! - open[i]!;
    den[i] = high[i]! - low[i]!;
  }
  const numSma = rollingSma(num, period);
  const denSma = rollingSma(den, period);
  const rvi = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (numSma[i] == null || denSma[i] == null || denSma[i] === 0) continue;
    rvi[i] = numSma[i]! / denSma[i]!;
  }
  return { rvi, signal: rollingSma(rvi, 4) };
}

export function computePpoValues(values: readonly Num[], fast: number, slow: number, signal: number): { ppo: Num[]; signalLine: Num[]; histogram: Num[] } {
  const fastEma = computeEmaValues(values, fast);
  const slowEma = computeEmaValues(values, slow);
  const ppo = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (fastEma[i] == null || slowEma[i] == null || slowEma[i] === 0) continue;
    ppo[i] = ((fastEma[i]! - slowEma[i]!) / slowEma[i]!) * 100;
  }
  const signalLine = computeEmaValues(ppo, signal);
  const histogram = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ppo[i] == null || signalLine[i] == null) continue;
    histogram[i] = ppo[i]! - signalLine[i]!;
  }
  return { ppo, signalLine, histogram };
}

export function computeTsiValues(values: readonly Num[], longPeriod: number, shortPeriod: number, signalPeriod: number): { tsi: Num[]; signal: Num[] } {
  const m = priceDiff(values);
  const absM = m.map((v) => (v == null ? null : Math.abs(v)));
  const ema2 = computeEmaValues(computeEmaValues(m, longPeriod), shortPeriod);
  const absEma2 = computeEmaValues(computeEmaValues(absM, longPeriod), shortPeriod);
  const tsi = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ema2[i] == null || absEma2[i] == null || absEma2[i] === 0) continue;
    tsi[i] = (100 * ema2[i]!) / absEma2[i]!;
  }
  return { tsi, signal: computeEmaValues(tsi, signalPeriod) };
}

export function computeDxValues(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): Num[] {
  const n = close.length;
  const plusDm = nulls(n), minusDm = nulls(n), tr = nulls(n);
  for (let i = 1; i < n; i++) {
    if (high[i] == null || low[i] == null || high[i - 1] == null || low[i - 1] == null || close[i - 1] == null) continue;
    const up = high[i]! - high[i - 1]!, down = low[i - 1]! - low[i]!;
    plusDm[i] = up > down && up > 0 ? up : 0;
    minusDm[i] = down > up && down > 0 ? down : 0;
    tr[i] = Math.max(high[i]! - low[i]!, Math.abs(high[i]! - close[i - 1]!), Math.abs(low[i]! - close[i - 1]!));
  }
  const smPlus = computeEmaValues(plusDm, period, 1 / period);
  const smMinus = computeEmaValues(minusDm, period, 1 / period);
  const smTr = computeEmaValues(tr, period, 1 / period);
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    if (smTr[i] == null || smTr[i] === 0 || smPlus[i] == null || smMinus[i] == null) continue;
    const pdi = (100 * smPlus[i]!) / smTr[i]!;
    const mdi = (100 * smMinus[i]!) / smTr[i]!;
    const sum = pdi + mdi;
    if (sum === 0) continue;
    out[i] = (100 * Math.abs(pdi - mdi)) / sum;
  }
  return out;
}

export function computeCrsiValues(close: readonly Num[], rsiPeriod: number, streakPeriod: number, rankPeriod: number): Num[] {
  const n = close.length;
  const streak = nulls(n);
  let cur = 0;
  for (let i = 1; i < n; i++) {
    if (close[i] == null || close[i - 1] == null) continue;
    if (close[i]! > close[i - 1]!) cur = cur >= 0 ? cur + 1 : 1;
    else if (close[i]! < close[i - 1]!) cur = cur <= 0 ? cur - 1 : -1;
    else cur = 0;
    streak[i] = cur;
  }
  const rsiClose = computeRsiValues(close, rsiPeriod);
  const rsiStreak = computeRsiValues(streak, streakPeriod);
  const roc1 = nulls(n);
  for (let i = 1; i < n; i++) {
    if (close[i] == null || close[i - 1] == null || close[i - 1] === 0) continue;
    roc1[i] = ((close[i]! - close[i - 1]!) / close[i - 1]!) * 100;
  }
  const rank = nulls(n);
  for (let i = rankPeriod; i < n; i++) {
    const v = roc1[i];
    if (v == null) continue;
    let less = 0, valid = 0;
    for (let j = i - rankPeriod; j < i; j++) {
      if (roc1[j] == null) continue;
      valid++;
      if (roc1[j]! < v) less++;
    }
    if (valid > 0) rank[i] = (less / valid) * 100;
  }
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    if (rsiClose[i] == null || rsiStreak[i] == null || rank[i] == null) continue;
    out[i] = (rsiClose[i]! + rsiStreak[i]! + rank[i]!) / 3;
  }
  return out;
}

export function computeElderRayValues(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): { bull: Num[]; bear: Num[] } {
  const ema = computeEmaValues(close, period);
  const bull = nulls(close.length), bear = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (ema[i] == null || high[i] == null || low[i] == null) continue;
    bull[i] = high[i]! - ema[i]!;
    bear[i] = low[i]! - ema[i]!;
  }
  return { bull, bear };
}

export function computeCmoValues(close: readonly Num[], period: number): Num[] {
  const out = nulls(close.length);
  for (let i = period; i < close.length; i++) {
    let up = 0, down = 0, valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (close[j] == null || close[j - 1] == null) { valid = false; break; }
      const diff = close[j]! - close[j - 1]!;
      if (diff > 0) up += diff; else down += Math.abs(diff);
    }
    if (!valid || up + down === 0) continue;
    out[i] = (100 * (up - down)) / (up + down);
  }
  return out;
}

export function computeFisherValues(high: readonly Num[], low: readonly Num[], period: number): { fisher: Num[]; signal: Num[] } {
  const median = nulls(high.length);
  for (let i = 0; i < high.length; i++) {
    if (high[i] == null || low[i] == null) continue;
    median[i] = (high[i]! + low[i]!) / 2;
  }
  const fisher = nulls(high.length), signal = nulls(high.length);
  let prevValue = 0, prevFisher = 0;
  for (let i = period - 1; i < high.length; i++) {
    const hi = highest(median, i - period + 1, i);
    const lo = lowest(median, i - period + 1, i);
    const cur = median[i];
    if (hi == null || lo == null || cur == null || hi === lo) continue;
    const x = 0.33 * 2 * ((cur - lo) / (hi - lo) - 0.5) + 0.67 * prevValue;
    const value = Math.max(-0.999, Math.min(0.999, x));
    const f = 0.5 * Math.log((1 + value) / (1 - value)) + 0.5 * prevFisher;
    fisher[i] = f; signal[i] = prevFisher;
    prevValue = value; prevFisher = f;
  }
  return { fisher, signal };
}

export function computeKdjValues(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number, smoothK: number, smoothD: number): { k: Num[]; d: Num[]; j: Num[] } {
  const rsv = nulls(close.length);
  for (let i = period - 1; i < close.length; i++) {
    const hi = highest(high, i - period + 1, i);
    const lo = lowest(low, i - period + 1, i);
    const c = close[i];
    if (hi == null || lo == null || c == null || hi === lo) continue;
    rsv[i] = ((c - lo) / (hi - lo)) * 100;
  }
  const k = rollingSma(rsv, smoothK);
  const d = rollingSma(k, smoothD);
  const j = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (k[i] == null || d[i] == null) continue;
    j[i] = 3 * k[i]! - 2 * d[i]!;
  }
  return { k, d, j };
}

// ── Indicator definitions ──────────────────────────────────────────────────

export const stochRsiDef: IndicatorDefinition = {
  id: 'stoch_rsi', name: 'Stochastic RSI',
  inputs: [
    { name: 'rsi', label: 'RSI Period', type: 'number', default: 14, min: 1, max: 200, step: 1 },
    { name: 'stoch', label: 'Stoch Period', type: 'number', default: 14, min: 1, max: 200, step: 1 },
    { name: 'k', label: 'K Smoothing', type: 'number', default: 3, min: 1, max: 20, step: 1 },
    { name: 'd', label: 'D Smoothing', type: 'number', default: 3, min: 1, max: 20, step: 1 },
  ],
  outputs: [
    { name: 'k', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 },
    { name: 'd', seriesType: 'Line', pane: 'subpane', color: '#ff9f43', lineWidth: 1 },
  ],
  compute(ctx) {
    const { k, d } = computeStochRsiValues(ctx.close, clampInt(ctx.params.rsi ?? 14, 14, 1), clampInt(ctx.params.stoch ?? 14, 14, 1), clampInt(ctx.params.k ?? 3, 3, 1), clampInt(ctx.params.d ?? 3, 3, 1));
    return { outputs: [k, d] };
  },
};

export const rviDef: IndicatorDefinition = {
  id: 'rvi', name: 'Relative Vigor Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 10, min: 1, max: 200, step: 1 }],
  outputs: [
    { name: 'rvi', seriesType: 'Line', pane: 'subpane', color: '#5dade2', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 },
  ],
  compute(ctx) {
    const { rvi, signal } = computeRviValues(ctx.open, ctx.high, ctx.low, ctx.close, clampInt(ctx.params.period ?? 10, 10, 1));
    return { outputs: [rvi, signal] };
  },
};

export const ppoDef: IndicatorDefinition = {
  id: 'ppo', name: 'Percentage Price Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1, max: 200, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 1, max: 200, step: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { name: 'ppo', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#ff9f43', lineWidth: 1 },
    { name: 'histogram', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(0,209,255,0.45)', base: 0 },
  ],
  compute(ctx) {
    const { ppo, signalLine, histogram } = computePpoValues(ctx.close, clampInt(ctx.params.fast ?? 12, 12, 1), clampInt(ctx.params.slow ?? 26, 26, 1), clampInt(ctx.params.signal ?? 9, 9, 1));
    return { outputs: [ppo, signalLine, histogram] };
  },
};

export const pvoDef: IndicatorDefinition = {
  id: 'pvo', name: 'Percentage Volume Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1, max: 200, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 1, max: 200, step: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { name: 'pvo', seriesType: 'Line', pane: 'subpane', color: '#2ecc71', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 },
    { name: 'histogram', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(46,204,113,0.45)', base: 0 },
  ],
  compute(ctx) {
    const { ppo, signalLine, histogram } = computePpoValues(ctx.volume, clampInt(ctx.params.fast ?? 12, 12, 1), clampInt(ctx.params.slow ?? 26, 26, 1), clampInt(ctx.params.signal ?? 9, 9, 1));
    return { outputs: [ppo, signalLine, histogram] };
  },
};

export const tsiDef: IndicatorDefinition = {
  id: 'tsi', name: 'True Strength Index',
  inputs: [
    { name: 'long', label: 'Long Period', type: 'number', default: 25, min: 1, max: 200, step: 1 },
    { name: 'short', label: 'Short Period', type: 'number', default: 13, min: 1, max: 200, step: 1 },
    { name: 'signal', label: 'Signal Period', type: 'number', default: 7, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { name: 'tsi', seriesType: 'Line', pane: 'subpane', color: '#af7ac5', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f7dc6f', lineWidth: 1 },
  ],
  compute(ctx) {
    const { tsi, signal } = computeTsiValues(ctx.close, clampInt(ctx.params.long ?? 25, 25, 1), clampInt(ctx.params.short ?? 13, 13, 1), clampInt(ctx.params.signal ?? 7, 7, 1));
    return { outputs: [tsi, signal] };
  },
};

export const dxDef: IndicatorDefinition = {
  id: 'dx', name: 'Directional Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'dx', seriesType: 'Line', pane: 'subpane', color: '#f1c40f', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeDxValues(ctx.high, ctx.low, ctx.close, clampInt(ctx.params.period ?? 14, 14, 1))] }; },
};

export const crsiDef: IndicatorDefinition = {
  id: 'crsi', name: 'Connors RSI',
  inputs: [
    { name: 'rsi', label: 'RSI Period', type: 'number', default: 3, min: 1, max: 50, step: 1 },
    { name: 'streak', label: 'Streak RSI Period', type: 'number', default: 2, min: 1, max: 50, step: 1 },
    { name: 'rank', label: 'Rank Period', type: 'number', default: 100, min: 2, max: 500, step: 1 },
  ],
  outputs: [{ name: 'crsi', seriesType: 'Line', pane: 'subpane', color: '#5dade2', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeCrsiValues(ctx.close, clampInt(ctx.params.rsi ?? 3, 3, 1), clampInt(ctx.params.streak ?? 2, 2, 1), clampInt(ctx.params.rank ?? 100, 100, 2))] }; },
};

export const elderRayDef: IndicatorDefinition = {
  id: 'elder_ray', name: 'Elder Ray',
  inputs: [{ name: 'period', label: 'EMA Period', type: 'number', default: 13, min: 1, max: 200, step: 1 }],
  outputs: [
    { name: 'bull', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(46,204,113,0.45)', base: 0 },
    { name: 'bear', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(231,76,60,0.45)', base: 0 },
  ],
  compute(ctx) {
    const { bull, bear } = computeElderRayValues(ctx.high, ctx.low, ctx.close, clampInt(ctx.params.period ?? 13, 13, 1));
    return { outputs: [bull, bear] };
  },
};

export const cmoDef: IndicatorDefinition = {
  id: 'cmo', name: 'Chande Momentum Oscillator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'cmo', seriesType: 'Line', pane: 'subpane', color: '#58d68d', lineWidth: 1 }],
  compute(ctx) { return { outputs: [computeCmoValues(ctx.close, clampInt(ctx.params.period ?? 14, 14, 1))] }; },
};

export const fisherDef: IndicatorDefinition = {
  id: 'fisher', name: 'Fisher Transform',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 10, min: 2, max: 200, step: 1 }],
  outputs: [
    { name: 'fisher', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f39c12', lineWidth: 1 },
  ],
  compute(ctx) {
    const { fisher, signal } = computeFisherValues(ctx.high, ctx.low, clampInt(ctx.params.period ?? 10, 10, 2));
    return { outputs: [fisher, signal] };
  },
};

export const kdjDef: IndicatorDefinition = {
  id: 'kdj', name: 'KDJ',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 9, min: 1, max: 200, step: 1 },
    { name: 'k', label: 'K Smooth', type: 'number', default: 3, min: 1, max: 20, step: 1 },
    { name: 'd', label: 'D Smooth', type: 'number', default: 3, min: 1, max: 20, step: 1 },
  ],
  outputs: [
    { name: 'k', seriesType: 'Line', pane: 'subpane', color: '#5dade2', lineWidth: 1 },
    { name: 'd', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 },
    { name: 'j', seriesType: 'Line', pane: 'subpane', color: '#af7ac5', lineWidth: 1 },
  ],
  compute(ctx) {
    const { k, d, j } = computeKdjValues(ctx.high, ctx.low, ctx.close, clampInt(ctx.params.period ?? 9, 9, 1), clampInt(ctx.params.k ?? 3, 3, 1), clampInt(ctx.params.d ?? 3, 3, 1));
    return { outputs: [k, d, j] };
  },
};

export const aroonOscillatorDef: IndicatorDefinition = {
  id: 'aroon_oscillator', name: 'Aroon Oscillator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 25, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'aroon_oscillator', seriesType: 'Line', pane: 'subpane', color: '#3498db', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 25, 25, 1);
    const { up, down } = computeAroonValues(ctx.high, ctx.low, p);
    const osc = nulls(ctx.close.length);
    for (let i = 0; i < osc.length; i++) {
      if (up[i] == null || down[i] == null) continue;
      osc[i] = up[i]! - down[i]!;
    }
    return { outputs: [osc] };
  },
};
