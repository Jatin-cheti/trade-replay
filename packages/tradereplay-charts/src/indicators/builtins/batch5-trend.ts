import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeSmaValues } from './sma.ts';
import { clampInt, computeAtr, nulls, rollingExtrema, rollingStdDev, firstValid } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult { return { outputs }; }

function diff(a: readonly Num[], b: readonly Num[]): Num[] {
  const out = nulls(a.length);
  for (let i = 0; i < a.length; i++) {
    if (a[i] != null && b[i] != null) out[i] = a[i]! - b[i]!;
  }
  return out;
}

function scale(a: readonly Num[], k: number): Num[] {
  return a.map((v) => (v != null ? v * k : null));
}

export const autoFibRetracementDef: IndicatorDefinition = {
  id: 'autoFibRetracement', name: 'Auto Fib Retracement',
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

export const autoFibExtensionDef: IndicatorDefinition = {
  id: 'autoFibExtension', name: 'Auto Fib Extension',
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

export const autoPitchforkDef: IndicatorDefinition = {
  id: 'autoPitchfork', name: 'Auto Pitchfork',
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

export const autoTrendlinesDef: IndicatorDefinition = {
  id: 'autoTrendlines', name: 'Auto Trendlines',
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

export const bbTrendDef: IndicatorDefinition = {
  id: 'bbTrend', name: 'BBTrend',
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
    return toResult(diff(scale(rollingStdDev(close, s), mult), scale(rollingStdDev(close, l), mult)));
  },
};

export const chandeKrollStopDef: IndicatorDefinition = {
  id: 'chandeKrollStop', name: 'Chande Kroll Stop',
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
    const firstStop = nulls(n), lowStop = nulls(n);
    for (let i = 0; i < n; i++) {
      if (high[i] != null && atrVals[i] != null) firstStop[i] = high[i]! - mult * atrVals[i]!;
      if (low[i] != null && atrVals[i] != null) lowStop[i] = low[i]! + mult * atrVals[i]!;
    }
    return toResult(rollingExtrema(firstStop, stopLen, true), rollingExtrema(lowStop, stopLen, false));
  },
};

export const chandelierExitDef: IndicatorDefinition = {
  id: 'chandelierExit', name: 'Chandelier Exit',
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

export const linearRegChannelDef: IndicatorDefinition = {
  id: 'linearRegChannel', name: 'Linear Regression Channel',
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
      mid[i] = regVal; upper[i] = regVal + mult * stdDev; lower[i] = regVal - mult * stdDev;
    }
    return toResult(mid, upper, lower);
  },
};

export const maCrossDef: IndicatorDefinition = {
  id: 'maCross', name: 'MA Cross',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 9, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 21, min: 1 },
  ],
  outputs: [
    { name: 'fast', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 2 },
    { name: 'slow', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 2 },
  ],
  compute: ({ close, params }) =>
    toResult(computeSmaValues(close, clampInt(params.fast, 9)), computeSmaValues(close, clampInt(params.slow, 21))),
};

export const mcginleyDynamicDef: IndicatorDefinition = {
  id: 'mcginleyDynamic', name: 'McGinley Dynamic',
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
      md += (c - md) / (p * Math.pow(c / md, 4));
      out[i] = md;
    }
    return toResult(out);
  },
};

export const maRibbonDef: IndicatorDefinition = {
  id: 'maRibbon', name: 'Moving Average Ribbon',
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

export const pivotHighLowDef: IndicatorDefinition = {
  id: 'pivotHighLow', name: 'Pivot Points High Low',
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

export const robBookerPivotsDef: IndicatorDefinition = {
  id: 'robBookerPivots', name: 'Rob Booker - Intraday Pivot Points',
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

export const robBookerMissedPivotsDef: IndicatorDefinition = {
  id: 'robBookerMissedPivots', name: 'Rob Booker - Missed Pivot Points',
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

export const robBookerZivGhostDef: IndicatorDefinition = {
  id: 'robBookerZivGhost', name: 'Rob Booker - Ziv Ghost Pivots',
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

export const volatilityStopDef: IndicatorDefinition = {
  id: 'volatilityStop', name: 'Volatility Stop',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  outputs: [{ name: 'stop', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 2 }],
  compute: ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20);
    const mult = params.mult ?? 2;
    const atrVals = computeAtr(high, low, close, p);
    const n = close.length;
    const out = nulls(n);
    let isLong = true, stop = 0;
    for (let i = p; i < n; i++) {
      if (close[i] == null || atrVals[i] == null) continue;
      const c = close[i]!, a = atrVals[i]! * mult;
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

export const zigZagDef: IndicatorDefinition = {
  id: 'zigZag', name: 'Zig Zag',
  inputs: [{ name: 'deviation', label: 'Deviation %', type: 'number', default: 5, min: 0.1, step: 0.1 }],
  outputs: [{ name: 'zz', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ high, low, params }) => {
    const dev = (params.deviation ?? 5) / 100;
    const n = high.length;
    const out = nulls(n);
    if (n < 2) return toResult(out);
    let lastPivot = ((high[0] ?? 0) + (low[0] ?? 0)) / 2;
    let lastIdx = 0, isUp = true;
    out[0] = lastPivot;
    for (let i = 1; i < n; i++) {
      const h = high[i], l = low[i];
      if (h == null || l == null) continue;
      if (isUp) {
        if (h > lastPivot) { lastPivot = h; lastIdx = i; }
        if (l < lastPivot * (1 - dev)) { out[lastIdx] = lastPivot; lastPivot = l; lastIdx = i; isUp = false; }
      } else {
        if (l < lastPivot) { lastPivot = l; lastIdx = i; }
        if (h > lastPivot * (1 + dev)) { out[lastIdx] = lastPivot; lastPivot = h; lastIdx = i; isUp = true; }
      }
    }
    out[lastIdx] = lastPivot;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (out[i] != null) {
        if (prev >= 0 && i > prev + 1) {
          const start = out[prev]!, end = out[i]!;
          for (let j = prev + 1; j < i; j++)
            out[j] = start + (end - start) * ((j - prev) / (i - prev));
        }
        prev = i;
      }
    }
    return toResult(out);
  },
};
