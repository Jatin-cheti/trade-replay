/**
 * batch5.ts – Missing TradingView indicators computable from OHLCV data.
 *
 * Each definition follows the same IndicatorDefinition contract used by
 * batch2–4.  Pure functions, no external data feeds required.
 */

import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeSmaValues } from './sma.ts';
import { computeWmaValues } from './wma.ts';
import { computeRsiValues } from './rsi.ts';
import {
  clampInt,
  computeAtr,
  computeTrueRange,
  nulls,
  rollingSma,
  rollingExtrema,
  rollingStdDev,
  rollingSum,
  firstValid,
} from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

/* ══════════════════════════════════════════════════════════════════════════
 * ── Helpers ──────────────────────────────────────────────────────────── */

function diff(a: readonly Num[], b: readonly Num[]): Num[] {
  const n = a.length;
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    if (a[i] != null && b[i] != null) out[i] = a[i]! - b[i]!;
  }
  return out;
}

function add(a: readonly Num[], b: readonly Num[]): Num[] {
  const n = a.length;
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    if (a[i] != null && b[i] != null) out[i] = a[i]! + b[i]!;
  }
  return out;
}

function scale(a: readonly Num[], k: number): Num[] {
  return a.map((v) => (v != null ? v * k : null));
}

function absArr(a: readonly Num[]): Num[] {
  return a.map((v) => (v != null ? Math.abs(v) : null));
}

function cumulate(src: readonly Num[]): Num[] {
  const out = nulls(src.length);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] != null) {
      sum += src[i]!;
      out[i] = sum;
    }
  }
  return out;
}

function rocArr(src: readonly Num[], period: number): Num[] {
  const out = nulls(src.length);
  for (let i = period; i < src.length; i++) {
    if (src[i] != null && src[i - period] != null && src[i - period] !== 0)
      out[i] = ((src[i]! - src[i - period]!) / Math.abs(src[i - period]!)) * 100;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ── Indicators A–Z ──────────────────────────────────────────────────── */

/* 24-hour Volume — rolling sum of volume over 24 periods */
export const volume24hDef: IndicatorDefinition = {
  id: 'volume24h',
  name: '24-hour Volume',
  inputs: [{ name: 'period', label: 'Bars', type: 'number', default: 24, min: 1 }],
  outputs: [{ name: 'vol', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' }],
  compute: ({ volume, params }) => toResult(rollingSum(volume, clampInt(params.period, 24))),
};

/* Advance Decline Ratio — proxy: up-bar ratio in a rolling window */
export const advDeclineRatioDef: IndicatorDefinition = {
  id: 'advDeclineRatio',
  name: 'Advance Decline Ratio',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'ratio', seriesType: 'Line', pane: 'subpane', color: '#22c55e', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 14);
    const n = close.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      let adv = 0, dec = 0;
      for (let j = i - p + 1; j <= i; j++) {
        if (close[j] != null && close[j - 1] != null) {
          if (close[j]! > close[j - 1]!) adv++;
          else if (close[j]! < close[j - 1]!) dec++;
        }
      }
      out[i] = dec === 0 ? adv : adv / dec;
    }
    return toResult(out);
  },
};

/* Advance Decline Ratio (Bars) */
export const advDeclineRatioBarsDef: IndicatorDefinition = {
  id: 'advDeclineRatioBars',
  name: 'Advance/Decline Ratio (Bars)',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'ratio', seriesType: 'Histogram', pane: 'subpane', color: '#22c55e' }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 14);
    const n = close.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      let adv = 0, dec = 0;
      for (let j = i - p + 1; j <= i; j++) {
        if (close[j] != null && close[j - 1] != null) {
          if (close[j]! > close[j - 1]!) adv++;
          else if (close[j]! < close[j - 1]!) dec++;
        }
      }
      out[i] = dec === 0 ? adv : adv / dec;
    }
    return toResult(out);
  },
};

/* Auto Fib Retracement — uses highest high / lowest low of lookback */
export const autoFibRetracementDef: IndicatorDefinition = {
  id: 'autoFibRetracement',
  name: 'Auto Fib Retracement',
  inputs: [{ name: 'lookback', label: 'Lookback', type: 'number', default: 100, min: 10 }],
  outputs: [
    { name: 'fib0', seriesType: 'Line', pane: 'overlay', color: '#64748b', lineWidth: 1 },
    { name: 'fib236', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 'fib382', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 1 },
    { name: 'fib50', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
    { name: 'fib618', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 1 },
    { name: 'fib100', seriesType: 'Line', pane: 'overlay', color: '#64748b', lineWidth: 1 },
  ],
  compute: ({ high, low, params }) => {
    const lb = clampInt(params.lookback, 100, 10);
    const n = high.length;
    const f0 = nulls(n), f236 = nulls(n), f382 = nulls(n), f50 = nulls(n), f618 = nulls(n), f100 = nulls(n);
    for (let i = lb; i < n; i++) {
      let hh: number | null = null, ll: number | null = null;
      for (let j = i - lb; j <= i; j++) {
        if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
        if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
      }
      if (hh == null || ll == null) continue;
      const r = hh - ll;
      f0[i] = hh; f236[i] = hh - r * 0.236; f382[i] = hh - r * 0.382;
      f50[i] = hh - r * 0.5; f618[i] = hh - r * 0.618; f100[i] = ll;
    }
    return toResult(f0, f236, f382, f50, f618, f100);
  },
};

/* Auto Fib Extension */
export const autoFibExtensionDef: IndicatorDefinition = {
  id: 'autoFibExtension',
  name: 'Auto Fib Extension',
  inputs: [{ name: 'lookback', label: 'Lookback', type: 'number', default: 100, min: 10 }],
  outputs: [
    { name: 'fib1', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 1 },
    { name: 'fib1272', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 1 },
    { name: 'fib1618', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ high, low, params }) => {
    const lb = clampInt(params.lookback, 100, 10);
    const n = high.length;
    const f1 = nulls(n), f1272 = nulls(n), f1618 = nulls(n);
    for (let i = lb; i < n; i++) {
      let hh: number | null = null, ll: number | null = null;
      for (let j = i - lb; j <= i; j++) {
        if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
        if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
      }
      if (hh == null || ll == null) continue;
      const r = hh - ll;
      f1[i] = hh; f1272[i] = hh + r * 0.272; f1618[i] = hh + r * 0.618;
    }
    return toResult(f1, f1272, f1618);
  },
};

/* Auto Pitchfork — median line approximation */
export const autoPitchforkDef: IndicatorDefinition = {
  id: 'autoPitchfork',
  name: 'Auto Pitchfork',
  inputs: [{ name: 'lookback', label: 'Lookback', type: 'number', default: 50, min: 5 }],
  outputs: [
    { name: 'median', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 2 },
    { name: 'upper', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 'lower', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
  ],
  compute: ({ high, low, close, params }) => {
    const lb = clampInt(params.lookback, 50, 5);
    const n = close.length;
    const med = nulls(n), upper = nulls(n), lower = nulls(n);
    for (let i = lb; i < n; i++) {
      let hh: number | null = null, ll: number | null = null;
      for (let j = i - lb; j <= i; j++) {
        if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
        if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
      }
      if (hh == null || ll == null || close[i] == null) continue;
      const m = (hh + ll) / 2;
      const spread = (hh - ll) / 2;
      med[i] = m; upper[i] = m + spread; lower[i] = m - spread;
    }
    return toResult(med, upper, lower);
  },
};

/* Auto Trendlines — rolling regression line */
export const autoTrendlinesDef: IndicatorDefinition = {
  id: 'autoTrendlines',
  name: 'Auto Trendlines',
  inputs: [{ name: 'lookback', label: 'Lookback', type: 'number', default: 50, min: 5 }],
  outputs: [{ name: 'trend', seriesType: 'Line', pane: 'overlay', color: '#f97316', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const lb = clampInt(params.lookback, 50, 5);
    const n = close.length;
    const out = nulls(n);
    for (let i = lb - 1; i < n; i++) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, cnt = 0;
      for (let j = 0; j < lb; j++) {
        const v = close[i - lb + 1 + j];
        if (v == null) continue;
        sumX += j; sumY += v; sumXY += j * v; sumX2 += j * j; cnt++;
      }
      if (cnt < 2) continue;
      const slope = (cnt * sumXY - sumX * sumY) / (cnt * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / cnt;
      out[i] = intercept + slope * (lb - 1);
    }
    return toResult(out);
  },
};

/* Average Daily Range */
export const avgDailyRangeDef: IndicatorDefinition = {
  id: 'avgDailyRange',
  name: 'Average Daily Range',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'adr', seriesType: 'Line', pane: 'subpane', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ high, low, params }) => {
    const p = clampInt(params.period, 14);
    const n = high.length;
    const ranges = nulls(n);
    for (let i = 0; i < n; i++) {
      if (high[i] != null && low[i] != null) ranges[i] = high[i]! - low[i]!;
    }
    return toResult(computeSmaValues(ranges, p));
  },
};

/* BBTrend — Bollinger Bands trend via bandwidth difference */
export const bbTrendDef: IndicatorDefinition = {
  id: 'bbTrend',
  name: 'BBTrend',
  inputs: [
    { name: 'shortLen', label: 'Short', type: 'number', default: 20, min: 2 },
    { name: 'longLen', label: 'Long', type: 'number', default: 50, min: 2 },
    { name: 'mult', label: 'StdDev', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  outputs: [{ name: 'bbtrend', seriesType: 'Histogram', pane: 'subpane', color: '#3b82f6' }],
  compute: ({ close, params }) => {
    const s = clampInt(params.shortLen, 20, 2);
    const l = clampInt(params.longLen, 50, 2);
    const mult = params.mult ?? 2;
    const shortBw = rollingStdDev(close, s);
    const longBw = rollingStdDev(close, l);
    return toResult(diff(scale(shortBw, mult), scale(longBw, mult)));
  },
};

/* Bollinger Bars — close position within BB as histogram */
export const bollingerBarsDef: IndicatorDefinition = {
  id: 'bollingerBars',
  name: 'Bollinger Bars',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 2 },
    { name: 'mult', label: 'StdDev', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  outputs: [{ name: 'bbars', seriesType: 'Histogram', pane: 'subpane', color: '#a78bfa' }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 20, 2);
    const mult = params.mult ?? 2;
    const sma = computeSmaValues(close, p);
    const sd = rollingStdDev(close, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (close[i] != null && sma[i] != null && sd[i] != null && sd[i] !== 0)
        out[i] = (close[i]! - sma[i]!) / (sd[i]! * mult);
    }
    return toResult(out);
  },
};

/* Chande Kroll Stop */
export const chandeKrollStopDef: IndicatorDefinition = {
  id: 'chandeKrollStop',
  name: 'Chande Kroll Stop',
  inputs: [
    { name: 'atrLen', label: 'ATR Length', type: 'number', default: 10, min: 1 },
    { name: 'atrMult', label: 'ATR Mult', type: 'number', default: 1, min: 0.1, step: 0.1 },
    { name: 'stopLen', label: 'Stop Length', type: 'number', default: 9, min: 1 },
  ],
  outputs: [
    { name: 'stopLong', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
    { name: 'stopShort', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ high, low, close, params }) => {
    const atrLen = clampInt(params.atrLen, 10);
    const mult = params.atrMult ?? 1;
    const stopLen = clampInt(params.stopLen, 9);
    const n = close.length;
    const atrVals = computeAtr(high, low, close, atrLen);
    const firstStop = nulls(n);
    const lowStop = nulls(n);
    for (let i = 0; i < n; i++) {
      if (high[i] != null && atrVals[i] != null) firstStop[i] = high[i]! - mult * atrVals[i]!;
      if (low[i] != null && atrVals[i] != null) lowStop[i] = low[i]! + mult * atrVals[i]!;
    }
    return toResult(rollingExtrema(firstStop, stopLen, true), rollingExtrema(lowStop, stopLen, false));
  },
};

/* Chandelier Exit */
export const chandelierExitDef: IndicatorDefinition = {
  id: 'chandelierExit',
  name: 'Chandelier Exit',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 22, min: 1 },
    { name: 'mult', label: 'ATR Mult', type: 'number', default: 3, min: 0.1, step: 0.1 },
  ],
  outputs: [
    { name: 'long', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
    { name: 'short', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ high, low, close, params }) => {
    const p = clampInt(params.period, 22);
    const mult = params.mult ?? 3;
    const atrVals = computeAtr(high, low, close, p);
    const hh = rollingExtrema(high, p, true);
    const ll = rollingExtrema(low, p, false);
    const n = close.length;
    const longExit = nulls(n), shortExit = nulls(n);
    for (let i = 0; i < n; i++) {
      if (hh[i] != null && atrVals[i] != null) longExit[i] = hh[i]! - mult * atrVals[i]!;
      if (ll[i] != null && atrVals[i] != null) shortExit[i] = ll[i]! + mult * atrVals[i]!;
    }
    return toResult(longExit, shortExit);
  },
};

/* Chop Zone */
export const chopZoneDef: IndicatorDefinition = {
  id: 'chopZone',
  name: 'Chop Zone',
  inputs: [
    { name: 'emaLen', label: 'EMA Length', type: 'number', default: 34, min: 1 },
    { name: 'atrLen', label: 'ATR Length', type: 'number', default: 1, min: 1 },
  ],
  outputs: [{ name: 'zone', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
  compute: ({ high, low, close, params }) => {
    const emaLen = clampInt(params.emaLen, 34);
    const n = close.length;
    const emaV = computeEmaValues(close, emaLen);
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (close[i] == null || emaV[i] == null || emaV[i - 1] == null || high[i] == null || low[i] == null) continue;
      const range = high[i]! - low[i]!;
      if (range === 0) continue;
      const angle = Math.atan2(emaV[i]! - emaV[i - 1]!, 1) * (180 / Math.PI);
      out[i] = angle;
    }
    return toResult(out);
  },
};

/* Correlation Coefficient */
export const correlationCoeffDef: IndicatorDefinition = {
  id: 'correlationCoeff',
  name: 'Correlation Coefficient',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 2 }],
  outputs: [{ name: 'corr', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 }],
  compute: ({ close, volume, params }) => {
    const p = clampInt(params.period, 20, 2);
    const n = close.length;
    const out = nulls(n);
    for (let i = p - 1; i < n; i++) {
      let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0, cnt = 0;
      for (let j = i - p + 1; j <= i; j++) {
        if (close[j] == null || volume[j] == null) continue;
        const x = close[j]!, y = volume[j]!;
        sx += x; sy += y; sxy += x * y; sx2 += x * x; sy2 += y * y; cnt++;
      }
      if (cnt < 2) continue;
      const num = cnt * sxy - sx * sy;
      const den = Math.sqrt((cnt * sx2 - sx * sx) * (cnt * sy2 - sy * sy));
      out[i] = den === 0 ? 0 : num / den;
    }
    return toResult(out);
  },
};

/* Cumulative Volume Index */
export const cumulativeVolumeIndexDef: IndicatorDefinition = {
  id: 'cumulativeVolumeIndex',
  name: 'Cumulative Volume Index',
  inputs: [],
  outputs: [{ name: 'cvi', seriesType: 'Line', pane: 'subpane', color: '#8b5cf6', lineWidth: 2 }],
  compute: ({ close, volume }) => {
    const n = close.length;
    const out = nulls(n);
    let cum = 0;
    for (let i = 1; i < n; i++) {
      if (close[i] == null || close[i - 1] == null || volume[i] == null) continue;
      cum += close[i]! > close[i - 1]! ? volume[i]! : close[i]! < close[i - 1]! ? -volume[i]! : 0;
      out[i] = cum;
    }
    return toResult(out);
  },
};

/* Klinger Oscillator */
export const klingerOscDef: IndicatorDefinition = {
  id: 'klingerOsc',
  name: 'Klinger Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 34, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 55, min: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 13, min: 1 },
  ],
  outputs: [
    { name: 'klinger', seriesType: 'Line', pane: 'subpane', color: '#22c55e', lineWidth: 2 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ high, low, close, volume, params }) => {
    const fast = clampInt(params.fast, 34);
    const slow = clampInt(params.slow, 55);
    const sig = clampInt(params.signal, 13);
    const n = close.length;
    const vf = nulls(n);
    for (let i = 1; i < n; i++) {
      if (high[i] == null || low[i] == null || close[i] == null || volume[i] == null) continue;
      const hlc = high[i]! + low[i]! + close[i]!;
      const prevHlc = (high[i - 1] ?? 0) + (low[i - 1] ?? 0) + (close[i - 1] ?? 0);
      const trend = hlc >= prevHlc ? 1 : -1;
      const dm = high[i]! - low[i]!;
      const cm = i > 0 ? dm : dm;
      vf[i] = volume[i]! * Math.abs(2 * dm / (cm || 1) - 1) * trend;
    }
    const emaFast = computeEmaValues(vf, fast);
    const emaSlow = computeEmaValues(vf, slow);
    const ko = diff(emaFast, emaSlow);
    const sigLine = computeEmaValues(ko, sig);
    return toResult(ko, sigLine);
  },
};

/* Know Sure Thing */
export const knowSureThingDef: IndicatorDefinition = {
  id: 'knowSureThing',
  name: 'Know Sure Thing',
  inputs: [{ name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1 }],
  outputs: [
    { name: 'kst', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ close, params }) => {
    const sig = clampInt(params.signal, 9);
    const roc10 = rocArr(close, 10);
    const roc15 = rocArr(close, 15);
    const roc20 = rocArr(close, 20);
    const roc30 = rocArr(close, 30);
    const sma10 = computeSmaValues(roc10, 10);
    const sma10b = computeSmaValues(roc15, 10);
    const sma10c = computeSmaValues(roc20, 10);
    const sma15 = computeSmaValues(roc30, 15);
    const n = close.length;
    const kst = nulls(n);
    for (let i = 0; i < n; i++) {
      if (sma10[i] != null && sma10b[i] != null && sma10c[i] != null && sma15[i] != null)
        kst[i] = sma10[i]! + sma10b[i]! * 2 + sma10c[i]! * 3 + sma15[i]! * 4;
    }
    return toResult(kst, computeSmaValues(kst, sig));
  },
};

/* Linear Regression Channel */
export const linearRegChannelDef: IndicatorDefinition = {
  id: 'linearRegChannel',
  name: 'Linear Regression Channel',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 100, min: 5 },
    { name: 'mult', label: 'StdDev', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  outputs: [
    { name: 'mid', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 2 },
    { name: 'upper', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 'lower', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
  ],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 100, 5);
    const mult = params.mult ?? 2;
    const n = close.length;
    const mid = nulls(n), upper = nulls(n), lower = nulls(n);
    for (let i = p - 1; i < n; i++) {
      let sx = 0, sy = 0, sxy = 0, sx2 = 0, cnt = 0;
      for (let j = 0; j < p; j++) {
        const v = close[i - p + 1 + j];
        if (v == null) continue;
        sx += j; sy += v; sxy += j * v; sx2 += j * j; cnt++;
      }
      if (cnt < 2) continue;
      const slope = (cnt * sxy - sx * sy) / (cnt * sx2 - sx * sx);
      const intercept = (sy - slope * sx) / cnt;
      const regVal = intercept + slope * (p - 1);
      let sumSqDev = 0;
      for (let j = 0; j < p; j++) {
        const v = close[i - p + 1 + j];
        if (v == null) continue;
        const dev = v - (intercept + slope * j);
        sumSqDev += dev * dev;
      }
      const stdDev = Math.sqrt(sumSqDev / cnt);
      mid[i] = regVal;
      upper[i] = regVal + mult * stdDev;
      lower[i] = regVal - mult * stdDev;
    }
    return toResult(mid, upper, lower);
  },
};

/* MA Cross */
export const maCrossDef: IndicatorDefinition = {
  id: 'maCross',
  name: 'MA Cross',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 9, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 21, min: 1 },
  ],
  outputs: [
    { name: 'fast', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 2 },
    { name: 'slow', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 2 },
  ],
  compute: ({ close, params }) => {
    const f = clampInt(params.fast, 9);
    const s = clampInt(params.slow, 21);
    return toResult(computeSmaValues(close, f), computeSmaValues(close, s));
  },
};

/* McGinley Dynamic */
export const mcginleyDynamicDef: IndicatorDefinition = {
  id: 'mcginleyDynamic',
  name: 'McGinley Dynamic',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'md', seriesType: 'Line', pane: 'overlay', color: '#8b5cf6', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 14);
    const n = close.length;
    const out = nulls(n);
    const start = firstValid(close);
    if (start < 0) return toResult(out);
    let md = close[start]!;
    out[start] = md;
    for (let i = start + 1; i < n; i++) {
      const c = close[i];
      if (c == null) continue;
      const ratio = c / md;
      md += (c - md) / (p * Math.pow(ratio, 4));
      out[i] = md;
    }
    return toResult(out);
  },
};

/* Moving Average Ribbon */
export const maRibbonDef: IndicatorDefinition = {
  id: 'maRibbon',
  name: 'Moving Average Ribbon',
  inputs: [
    { name: 'start', label: 'Start', type: 'number', default: 20, min: 1 },
    { name: 'step', label: 'Step', type: 'number', default: 10, min: 1 },
  ],
  outputs: [
    { name: 'ma1', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
    { name: 'ma2', seriesType: 'Line', pane: 'overlay', color: '#10b981', lineWidth: 1 },
    { name: 'ma3', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 1 },
    { name: 'ma4', seriesType: 'Line', pane: 'overlay', color: '#8b5cf6', lineWidth: 1 },
    { name: 'ma5', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 'ma6', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 1 },
  ],
  compute: ({ close, params }) => {
    const st = clampInt(params.start, 20);
    const step = clampInt(params.step, 10);
    return toResult(
      computeEmaValues(close, st),
      computeEmaValues(close, st + step),
      computeEmaValues(close, st + step * 2),
      computeEmaValues(close, st + step * 3),
      computeEmaValues(close, st + step * 4),
      computeEmaValues(close, st + step * 5),
    );
  },
};

/* Net Volume */
export const netVolumeDef: IndicatorDefinition = {
  id: 'netVolume',
  name: 'Net Volume',
  inputs: [],
  outputs: [{ name: 'nv', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' }],
  compute: ({ close, volume }) => {
    const n = close.length;
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (close[i] == null || close[i - 1] == null || volume[i] == null) continue;
      out[i] = close[i]! >= close[i - 1]! ? volume[i]! : -volume[i]!;
    }
    return toResult(out);
  },
};

/* Performance — cumulative % return from first bar */
export const performanceDef: IndicatorDefinition = {
  id: 'performance',
  name: 'Performance',
  inputs: [],
  outputs: [{ name: 'perf', seriesType: 'Line', pane: 'subpane', color: '#22c55e', lineWidth: 2 }],
  compute: ({ close }) => {
    const n = close.length;
    const out = nulls(n);
    const base = close.find((v) => v != null);
    if (base == null || base === 0) return toResult(out);
    for (let i = 0; i < n; i++) {
      if (close[i] != null) out[i] = ((close[i]! - base) / base) * 100;
    }
    return toResult(out);
  },
};

/* Pivot Points High Low */
export const pivotHighLowDef: IndicatorDefinition = {
  id: 'pivotHighLow',
  name: 'Pivot Points High Low',
  inputs: [
    { name: 'leftBars', label: 'Left Bars', type: 'number', default: 5, min: 1 },
    { name: 'rightBars', label: 'Right Bars', type: 'number', default: 5, min: 1 },
  ],
  outputs: [
    { name: 'pivotHigh', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 2 },
    { name: 'pivotLow', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 2 },
  ],
  compute: ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5);
    const rb = clampInt(params.rightBars, 5);
    const n = high.length;
    const ph = nulls(n), pl = nulls(n);
    for (let i = lb; i < n - rb; i++) {
      const h = high[i], l = low[i];
      if (h == null || l == null) continue;
      let isHigh = true, isLow = true;
      for (let j = 1; j <= lb; j++) {
        if (high[i - j] == null || high[i - j]! >= h) isHigh = false;
        if (low[i - j] == null || low[i - j]! <= l) isLow = false;
      }
      for (let j = 1; j <= rb; j++) {
        if (high[i + j] == null || high[i + j]! >= h) isHigh = false;
        if (low[i + j] == null || low[i + j]! <= l) isLow = false;
      }
      if (isHigh) ph[i] = h;
      if (isLow) pl[i] = l;
    }
    return toResult(ph, pl);
  },
};

/* Price Momentum Oscillator */
export const priceMomentumOscDef: IndicatorDefinition = {
  id: 'priceMomentumOsc',
  name: 'Price Momentum Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 35, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 20, min: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 10, min: 1 },
  ],
  outputs: [
    { name: 'pmo', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ close, params }) => {
    const fast = clampInt(params.fast, 35);
    const slow = clampInt(params.slow, 20);
    const sig = clampInt(params.signal, 10);
    const n = close.length;
    const roc1 = nulls(n);
    for (let i = 1; i < n; i++) {
      if (close[i] != null && close[i - 1] != null && close[i - 1] !== 0)
        roc1[i] = ((close[i]! - close[i - 1]!) / close[i - 1]!) * 100;
    }
    const smoothed1 = computeEmaValues(roc1, fast);
    const pmo = computeEmaValues(scale(smoothed1, 10), slow);
    return toResult(pmo, computeEmaValues(pmo, sig));
  },
};

/* Pring's Special K */
export const pringsSpecialKDef: IndicatorDefinition = {
  id: 'pringsSpecialK',
  name: "Pring's Special K",
  inputs: [],
  outputs: [{ name: 'spk', seriesType: 'Line', pane: 'subpane', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ close }) => {
    const rocs = [10, 15, 20, 30, 40, 65, 75, 100, 195, 265, 390, 530];
    const smas = [10, 10, 10, 15, 50, 65, 75, 100, 130, 130, 130, 195];
    const weights = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
    const n = close.length;
    const out = nulls(n);
    const components: Num[][] = rocs.map((r, idx) =>
      computeSmaValues(rocArr(close, r), smas[idx]),
    );
    for (let i = 0; i < n; i++) {
      let sum = 0, valid = true;
      for (let c = 0; c < components.length; c++) {
        if (components[c][i] == null) { valid = false; break; }
        sum += components[c][i]! * weights[c];
      }
      if (valid) out[i] = sum;
    }
    return toResult(out);
  },
};

/* Rank Correlation Index (Spearman) */
export const rankCorrelationDef: IndicatorDefinition = {
  id: 'rankCorrelation',
  name: 'Rank Correlation Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 2 }],
  outputs: [{ name: 'rci', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 14, 2);
    const n = close.length;
    const out = nulls(n);
    for (let i = p - 1; i < n; i++) {
      const vals: { val: number; idx: number }[] = [];
      for (let j = 0; j < p; j++) {
        if (close[i - p + 1 + j] != null) vals.push({ val: close[i - p + 1 + j]!, idx: j });
      }
      if (vals.length < p) continue;
      vals.sort((a, b) => a.val - b.val);
      let dSq = 0;
      for (let r = 0; r < vals.length; r++) {
        const d = r - vals[r].idx;
        dSq += d * d;
      }
      out[i] = (1 - (6 * dSq) / (p * (p * p - 1))) * 100;
    }
    return toResult(out);
  },
};

/* RCI Ribbon */
export const rciRibbonDef: IndicatorDefinition = {
  id: 'rciRibbon',
  name: 'RCI Ribbon',
  inputs: [
    { name: 'short', label: 'Short', type: 'number', default: 9, min: 2 },
    { name: 'mid', label: 'Mid', type: 'number', default: 26, min: 2 },
    { name: 'long', label: 'Long', type: 'number', default: 52, min: 2 },
  ],
  outputs: [
    { name: 'short', seriesType: 'Line', pane: 'subpane', color: '#22c55e', lineWidth: 1 },
    { name: 'mid', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 1 },
    { name: 'long', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ close, params }) => {
    const rci = (period: number): Num[] => {
      const p = clampInt(period, 14, 2);
      const n = close.length;
      const o = nulls(n);
      for (let i = p - 1; i < n; i++) {
        const vals: { val: number; idx: number }[] = [];
        for (let j = 0; j < p; j++) {
          if (close[i - p + 1 + j] != null) vals.push({ val: close[i - p + 1 + j]!, idx: j });
        }
        if (vals.length < p) continue;
        vals.sort((a, b) => a.val - b.val);
        let dSq = 0;
        for (let r = 0; r < vals.length; r++) { dSq += (r - vals[r].idx) ** 2; }
        o[i] = (1 - (6 * dSq) / (p * (p * p - 1))) * 100;
      }
      return o;
    };
    return toResult(rci(params.short ?? 9), rci(params.mid ?? 26), rci(params.long ?? 52));
  },
};

/* Relative Volatility Index */
export const relativeVolatilityIndexDef: IndicatorDefinition = {
  id: 'relativeVolatilityIndex',
  name: 'Relative Volatility Index',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 10, min: 1 },
    { name: 'smoothing', label: 'Smoothing', type: 'number', default: 14, min: 1 },
  ],
  outputs: [{ name: 'rvix', seriesType: 'Line', pane: 'subpane', color: '#8b5cf6', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 10);
    const sm = clampInt(params.smoothing, 14);
    const sd = rollingStdDev(close, p);
    const n = close.length;
    const up = nulls(n), dn = nulls(n);
    for (let i = 1; i < n; i++) {
      if (close[i] == null || close[i - 1] == null || sd[i] == null) continue;
      if (close[i]! > close[i - 1]!) { up[i] = sd[i]; dn[i] = 0; }
      else { up[i] = 0; dn[i] = sd[i]; }
    }
    const emaUp = computeEmaValues(up, sm);
    const emaDn = computeEmaValues(dn, sm);
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (emaUp[i] != null && emaDn[i] != null) {
        const sum = emaUp[i]! + emaDn[i]!;
        out[i] = sum === 0 ? 50 : (emaUp[i]! / sum) * 100;
      }
    }
    return toResult(out);
  },
};

/* Rob Booker — Intraday Pivot Points */
export const robBookerPivotsDef: IndicatorDefinition = {
  id: 'robBookerPivots',
  name: 'Rob Booker - Intraday Pivot Points',
  inputs: [],
  outputs: [
    { name: 'pivot', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 1 },
    { name: 'r1', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 's1', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
  ],
  compute: ({ high, low, close }) => {
    const n = close.length;
    const pv = nulls(n), r1 = nulls(n), s1 = nulls(n);
    for (let i = 1; i < n; i++) {
      const h = high[i - 1], l = low[i - 1], c = close[i - 1];
      if (h == null || l == null || c == null) continue;
      const pp = (h + l + c) / 3;
      pv[i] = pp; r1[i] = 2 * pp - l; s1[i] = 2 * pp - h;
    }
    return toResult(pv, r1, s1);
  },
};

/* Rob Booker — Knoxville Divergence */
export const robBookerKnoxvilleDef: IndicatorDefinition = {
  id: 'robBookerKnoxville',
  name: 'Rob Booker - Knoxville Divergence',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'kd', seriesType: 'Histogram', pane: 'subpane', color: '#ef4444' }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 14);
    const mom = nulls(close.length);
    for (let i = p; i < close.length; i++) {
      if (close[i] != null && close[i - p] != null) mom[i] = close[i]! - close[i - p]!;
    }
    const rsiVals = computeRsiValues(close, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (mom[i] != null && rsiVals[i] != null) out[i] = mom[i]! * (rsiVals[i]! - 50) / 50;
    }
    return toResult(out);
  },
};

/* Rob Booker — Missed Pivot Points */
export const robBookerMissedPivotsDef: IndicatorDefinition = {
  id: 'robBookerMissedPivots',
  name: 'Rob Booker - Missed Pivot Points',
  inputs: [],
  outputs: [
    { name: 'pivot', seriesType: 'Line', pane: 'overlay', color: '#a78bfa', lineWidth: 1 },
    { name: 'r1', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 's1', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
  ],
  compute: ({ high, low, close }) => {
    const n = close.length;
    const pv = nulls(n), r1 = nulls(n), s1 = nulls(n);
    for (let i = 2; i < n; i++) {
      const h = high[i - 2], l = low[i - 2], c = close[i - 2];
      if (h == null || l == null || c == null) continue;
      const pp = (h + l + c) / 3;
      pv[i] = pp; r1[i] = 2 * pp - l; s1[i] = 2 * pp - h;
    }
    return toResult(pv, r1, s1);
  },
};

/* Rob Booker — Reversal */
export const robBookerReversalDef: IndicatorDefinition = {
  id: 'robBookerReversal',
  name: 'Rob Booker - Reversal',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'rev', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 14);
    const rsiVals = computeRsiValues(close, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (rsiVals[i] != null && rsiVals[i - 1] != null) {
        if (rsiVals[i - 1]! < 30 && rsiVals[i]! >= 30) out[i] = 1;
        else if (rsiVals[i - 1]! > 70 && rsiVals[i]! <= 70) out[i] = -1;
      }
    }
    return toResult(out);
  },
};

/* Rob Booker — Ziv Ghost Pivots */
export const robBookerZivGhostDef: IndicatorDefinition = {
  id: 'robBookerZivGhost',
  name: 'Rob Booker - Ziv Ghost Pivots',
  inputs: [{ name: 'lookback', label: 'Lookback', type: 'number', default: 5, min: 1 }],
  outputs: [
    { name: 'ghostHigh', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 'ghostLow', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
  ],
  compute: ({ high, low, params }) => {
    const lb = clampInt(params.lookback, 5);
    return toResult(rollingExtrema(high, lb, true), rollingExtrema(low, lb, false));
  },
};

/* RSI Divergence Indicator */
export const rsiDivergenceDef: IndicatorDefinition = {
  id: 'rsiDivergence',
  name: 'RSI Divergence Indicator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [
    { name: 'rsi', seriesType: 'Line', pane: 'subpane', color: '#8b5cf6', lineWidth: 2 },
    { name: 'divergence', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' },
  ],
  compute: ({ close, params }) => {
    const p = clampInt(params.period, 14);
    const rsiVals = computeRsiValues(close, p);
    const n = close.length;
    const div = nulls(n);
    for (let i = p + 1; i < n; i++) {
      if (close[i] == null || close[i - 1] == null || rsiVals[i] == null || rsiVals[i - 1] == null) continue;
      const priceUp = close[i]! > close[i - 1]!;
      const rsiUp = rsiVals[i]! > rsiVals[i - 1]!;
      if (priceUp && !rsiUp) div[i] = -1;
      else if (!priceUp && rsiUp) div[i] = 1;
    }
    return toResult(rsiVals, div);
  },
};

/* SMI Ergodic Indicator */
export const smiErgodicDef: IndicatorDefinition = {
  id: 'smiErgodic',
  name: 'SMI Ergodic Indicator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 5, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 20, min: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 5, min: 1 },
  ],
  outputs: [
    { name: 'ergodic', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ close, params }) => {
    const fast = clampInt(params.fast, 5);
    const slow = clampInt(params.slow, 20);
    const sig = clampInt(params.signal, 5);
    const n = close.length;
    const pc = nulls(n), apc = nulls(n);
    for (let i = 1; i < n; i++) {
      if (close[i] != null && close[i - 1] != null) {
        pc[i] = close[i]! - close[i - 1]!;
        apc[i] = Math.abs(close[i]! - close[i - 1]!);
      }
    }
    const dblSmPC = computeEmaValues(computeEmaValues(pc, fast), slow);
    const dblSmAPC = computeEmaValues(computeEmaValues(apc, fast), slow);
    const erg = nulls(n);
    for (let i = 0; i < n; i++) {
      if (dblSmPC[i] != null && dblSmAPC[i] != null && dblSmAPC[i] !== 0)
        erg[i] = (dblSmPC[i]! / dblSmAPC[i]!) * 100;
    }
    return toResult(erg, computeEmaValues(erg, sig));
  },
};

/* SMI Ergodic Oscillator */
export const smiErgodicOscDef: IndicatorDefinition = {
  id: 'smiErgodicOsc',
  name: 'SMI Ergodic Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 5, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 20, min: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 5, min: 1 },
  ],
  outputs: [{ name: 'osc', seriesType: 'Histogram', pane: 'subpane', color: '#22c55e' }],
  compute: ({ close, params }) => {
    const fast = clampInt(params.fast, 5);
    const slow = clampInt(params.slow, 20);
    const sig = clampInt(params.signal, 5);
    const n = close.length;
    const pc = nulls(n), apc = nulls(n);
    for (let i = 1; i < n; i++) {
      if (close[i] != null && close[i - 1] != null) {
        pc[i] = close[i]! - close[i - 1]!;
        apc[i] = Math.abs(close[i]! - close[i - 1]!);
      }
    }
    const dblSmPC = computeEmaValues(computeEmaValues(pc, fast), slow);
    const dblSmAPC = computeEmaValues(computeEmaValues(apc, fast), slow);
    const erg = nulls(n);
    for (let i = 0; i < n; i++) {
      if (dblSmPC[i] != null && dblSmAPC[i] != null && dblSmAPC[i] !== 0)
        erg[i] = (dblSmPC[i]! / dblSmAPC[i]!) * 100;
    }
    const sigLine = computeEmaValues(erg, sig);
    return toResult(diff(erg, sigLine));
  },
};

/* Time Weighted Average Price (TWAP) */
export const twapDef: IndicatorDefinition = {
  id: 'twap',
  name: 'Time Weighted Average Price',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'twap', seriesType: 'Line', pane: 'overlay', color: '#06b6d4', lineWidth: 2 }],
  compute: ({ open, high, low, close, params }) => {
    const p = clampInt(params.period, 20);
    const n = close.length;
    const tp = nulls(n);
    for (let i = 0; i < n; i++) {
      if (open[i] != null && high[i] != null && low[i] != null && close[i] != null)
        tp[i] = (open[i]! + high[i]! + low[i]! + close[i]!) / 4;
    }
    return toResult(computeSmaValues(tp, p));
  },
};

/* Trading Sessions — indicator marks Asian/London/NY (simplified) */
export const tradingSessionsDef: IndicatorDefinition = {
  id: 'tradingSessions',
  name: 'Trading Sessions',
  inputs: [],
  outputs: [{ name: 'session', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

/* Visible Average Price */
export const visibleAvgPriceDef: IndicatorDefinition = {
  id: 'visibleAvgPrice',
  name: 'Visible Average Price',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 50, min: 1 }],
  outputs: [{ name: 'vap', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ high, low, close, params }) => {
    const p = clampInt(params.period, 50);
    const n = close.length;
    const tp = nulls(n);
    for (let i = 0; i < n; i++) {
      if (high[i] != null && low[i] != null && close[i] != null)
        tp[i] = (high[i]! + low[i]! + close[i]!) / 3;
    }
    return toResult(computeSmaValues(tp, p));
  },
};

/* Volatility Stop */
export const volatilityStopDef: IndicatorDefinition = {
  id: 'volatilityStop',
  name: 'Volatility Stop',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  outputs: [
    { name: 'stop', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 2 },
  ],
  compute: ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20);
    const mult = params.mult ?? 2;
    const atrVals = computeAtr(high, low, close, p);
    const n = close.length;
    const out = nulls(n);
    let isLong = true;
    let stop = 0;
    for (let i = p; i < n; i++) {
      if (close[i] == null || atrVals[i] == null) continue;
      const c = close[i]!;
      const a = atrVals[i]! * mult;
      if (isLong) {
        const ns = c - a;
        stop = Math.max(stop, ns);
        if (c < stop) { isLong = false; stop = c + a; }
      } else {
        const ns = c + a;
        stop = Math.min(stop, ns);
        if (c > stop) { isLong = true; stop = c - a; }
      }
      out[i] = stop;
    }
    return toResult(out);
  },
};

/* Volume (standalone) */
export const volumeDef: IndicatorDefinition = {
  id: 'volume',
  name: 'Volume',
  inputs: [],
  outputs: [{ name: 'vol', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' }],
  compute: ({ volume }) => toResult([...volume] as Num[]),
};

/* Volume Delta (per-bar) */
export const volumeDeltaDef: IndicatorDefinition = {
  id: 'volumeDelta',
  name: 'Volume Delta',
  inputs: [],
  outputs: [{ name: 'delta', seriesType: 'Histogram', pane: 'subpane', color: '#22c55e' }],
  compute: ({ open, close, volume }) => {
    const n = close.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (open[i] == null || close[i] == null || volume[i] == null) continue;
      out[i] = close[i]! >= open[i]! ? volume[i]! : -volume[i]!;
    }
    return toResult(out);
  },
};

/* Volume Weighted Moving Average */
export const vwmaDef: IndicatorDefinition = {
  id: 'vwma',
  name: 'Volume Weighted Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'vwma', seriesType: 'Line', pane: 'overlay', color: '#06b6d4', lineWidth: 2 }],
  compute: ({ close, volume, params }) => {
    const p = clampInt(params.period, 20);
    const n = close.length;
    const out = nulls(n);
    for (let i = p - 1; i < n; i++) {
      let sumCV = 0, sumV = 0, valid = 0;
      for (let j = i - p + 1; j <= i; j++) {
        if (close[j] != null && volume[j] != null) {
          sumCV += close[j]! * volume[j]!;
          sumV += volume[j]!;
          valid++;
        }
      }
      if (valid === p && sumV > 0) out[i] = sumCV / sumV;
    }
    return toResult(out);
  },
};

/* VWAP Auto Anchored */
export const vwapAutoAnchoredDef: IndicatorDefinition = {
  id: 'vwapAutoAnchored',
  name: 'VWAP Auto Anchored',
  inputs: [],
  outputs: [{ name: 'vwap', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 2 }],
  compute: ({ high, low, close, volume }) => {
    const n = close.length;
    const out = nulls(n);
    let cumTV = 0, cumV = 0;
    for (let i = 0; i < n; i++) {
      if (high[i] == null || low[i] == null || close[i] == null || volume[i] == null) continue;
      const tp = (high[i]! + low[i]! + close[i]!) / 3;
      cumTV += tp * volume[i]!;
      cumV += volume[i]!;
      out[i] = cumV > 0 ? cumTV / cumV : null;
    }
    return toResult(out);
  },
};

/* Woodies CCI */
export const woodiesCciDef: IndicatorDefinition = {
  id: 'woodiesCci',
  name: 'Woodies CCI',
  inputs: [
    { name: 'cciLen', label: 'CCI Length', type: 'number', default: 14, min: 1 },
    { name: 'tcci', label: 'TCCI Length', type: 'number', default: 6, min: 1 },
  ],
  outputs: [
    { name: 'cci', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 },
    { name: 'tcci', seriesType: 'Line', pane: 'subpane', color: '#f59e0b', lineWidth: 1 },
  ],
  compute: ({ high, low, close, params }) => {
    const cciLen = clampInt(params.cciLen, 14);
    const tcciLen = clampInt(params.tcci, 6);
    const n = close.length;
    const tp = nulls(n);
    for (let i = 0; i < n; i++) {
      if (high[i] != null && low[i] != null && close[i] != null)
        tp[i] = (high[i]! + low[i]! + close[i]!) / 3;
    }
    const calcCci = (src: Num[], p: number): Num[] => {
      const sma = computeSmaValues(src, p);
      const o = nulls(n);
      for (let i = p - 1; i < n; i++) {
        if (sma[i] == null || src[i] == null) continue;
        let mad = 0, cnt = 0;
        for (let j = i - p + 1; j <= i; j++) {
          if (src[j] != null && sma[i] != null) { mad += Math.abs(src[j]! - sma[i]!); cnt++; }
        }
        if (cnt > 0 && mad > 0) o[i] = (src[i]! - sma[i]!) / (0.015 * mad / cnt);
      }
      return o;
    };
    return toResult(calcCci(tp, cciLen), calcCci(tp, tcciLen));
  },
};

/* Zig Zag */
export const zigZagDef: IndicatorDefinition = {
  id: 'zigZag',
  name: 'Zig Zag',
  inputs: [{ name: 'deviation', label: 'Deviation %', type: 'number', default: 5, min: 0.1, step: 0.1 }],
  outputs: [{ name: 'zz', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ high, low, params }) => {
    const dev = (params.deviation ?? 5) / 100;
    const n = high.length;
    const out = nulls(n);
    if (n < 2) return toResult(out);
    let lastPivot = (high[0] ?? 0 + (low[0] ?? 0)) / 2;
    let lastIdx = 0;
    let isUp = true;
    out[0] = lastPivot;
    for (let i = 1; i < n; i++) {
      const h = high[i], l = low[i];
      if (h == null || l == null) continue;
      if (isUp) {
        if (h > lastPivot) { lastPivot = h; lastIdx = i; }
        if (l < lastPivot * (1 - dev)) {
          out[lastIdx] = lastPivot;
          lastPivot = l; lastIdx = i; isUp = false;
        }
      } else {
        if (l < lastPivot) { lastPivot = l; lastIdx = i; }
        if (h > lastPivot * (1 + dev)) {
          out[lastIdx] = lastPivot;
          lastPivot = h; lastIdx = i; isUp = true;
        }
      }
    }
    out[lastIdx] = lastPivot;
    // Interpolate between pivot points
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (out[i] != null) {
        if (prev >= 0 && i > prev + 1) {
          const start = out[prev]!;
          const end = out[i]!;
          for (let j = prev + 1; j < i; j++) {
            out[j] = start + (end - start) * ((j - prev) / (i - prev));
          }
        }
        prev = i;
      }
    }
    return toResult(out);
  },
};

/* Moon Phases (stub — requires astronomical data) */
export const moonPhasesDef: IndicatorDefinition = {
  id: 'moonPhases',
  name: 'Moon Phases',
  inputs: [],
  outputs: [{ name: 'phase', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

/* Multi-Time Period Charts (stub — requires multi-timeframe data) */
export const multiTimePeriodDef: IndicatorDefinition = {
  id: 'multiTimePeriod',
  name: 'Multi-Time Period Charts',
  inputs: [],
  outputs: [{ name: 'mtf', seriesType: 'Line', pane: 'subpane', color: '#64748b' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

/* Open Interest (stub — requires OI data feed) */
export const openInterestDef: IndicatorDefinition = {
  id: 'openInterest',
  name: 'Open Interest',
  inputs: [],
  outputs: [{ name: 'oi', seriesType: 'Line', pane: 'subpane', color: '#8b5cf6' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

/* Price Target (stub — requires analyst data) */
export const priceTargetDef: IndicatorDefinition = {
  id: 'priceTarget',
  name: 'Price Target',
  inputs: [],
  outputs: [{ name: 'target', seriesType: 'Line', pane: 'overlay', color: '#22c55e' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

/* Seasonality (stub — requires multi-year data analysis) */
export const seasonalityDef: IndicatorDefinition = {
  id: 'seasonality',
  name: 'Seasonality',
  inputs: [],
  outputs: [{ name: 'seasonal', seriesType: 'Line', pane: 'subpane', color: '#06b6d4' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

/* Technical Ratings (stub — composite score requires many indicators) */
export const technicalRatingsDef: IndicatorDefinition = {
  id: 'technicalRatings',
  name: 'Technical Ratings',
  inputs: [],
  outputs: [{ name: 'rating', seriesType: 'Histogram', pane: 'subpane', color: '#3b82f6' }],
  compute: ({ close }) => {
    // Simplified: use momentum proxy
    const n = close.length;
    const out = nulls(n);
    for (let i = 14; i < n; i++) {
      if (close[i] != null && close[i - 14] != null) {
        const change = close[i]! - close[i - 14]!;
        out[i] = change > 0 ? 1 : change < 0 ? -1 : 0;
      }
    }
    return toResult(out);
  },
};

/* Relative Volume at Time */
export const relativeVolumeAtTimeDef: IndicatorDefinition = {
  id: 'relativeVolumeAtTime',
  name: 'Relative Volume at Time',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'rvol', seriesType: 'Histogram', pane: 'subpane', color: '#8b5cf6' }],
  compute: ({ volume, params }) => {
    const p = clampInt(params.period, 20);
    const avgVol = computeSmaValues(volume, p);
    const n = volume.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (volume[i] != null && avgVol[i] != null && avgVol[i] !== 0)
        out[i] = volume[i]! / avgVol[i]!;
    }
    return toResult(out);
  },
};
