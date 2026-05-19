import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeSmaValues } from './sma.ts';
import { computeRsiValues } from './rsi.ts';
import { clampInt, computeAtr, nulls, rollingSma, rollingStdDev, rollingExtrema } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult { return { outputs }; }

function strategyDef(
  id: string, name: string,
  inputs: IndicatorDefinition['inputs'],
  compute: IndicatorDefinition['compute'],
): IndicatorDefinition {
  return { id, name, inputs, outputs: [{ name: 'signal', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }], compute };
}

const bbStrategyDef = strategyDef('strat_bollingerBands', 'Bollinger Bands Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 2 },
    { name: 'mult', label: 'StdDev', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  ({ close, params }) => {
    const p = clampInt(params.period, 20, 2);
    const mult = params.mult ?? 2;
    const sma = computeSmaValues(close, p);
    const sd = rollingStdDev(close, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (!close[i] || !sma[i] || !sd[i]) continue;
      if (close[i]! < sma[i]! - mult * sd[i]!) out[i] = 1;
      else if (close[i]! > sma[i]! + mult * sd[i]!) out[i] = -1;
    }
    return toResult(out);
  },
);

const channelBreakoutDef = strategyDef('strat_channelBreakout', 'Channel Breakout Strategy',
  [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20);
    const hh = rollingExtrema(high, p, true);
    const ll = rollingExtrema(low, p, false);
    const n = close.length;
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!close[i] || !hh[i - 1] || !ll[i - 1]) continue;
      if (close[i]! > hh[i - 1]!) out[i] = 1;
      else if (close[i]! < ll[i - 1]!) out[i] = -1;
    }
    return toResult(out);
  },
);

const macdStrategyDef = strategyDef('strat_macd', 'MACD Strategy',
  [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1 },
  ],
  ({ close, params }) => {
    const fast = clampInt(params.fast, 12);
    const slow = clampInt(params.slow, 26);
    const sig = clampInt(params.signal, 9);
    const emaF = computeEmaValues(close, fast);
    const emaS = computeEmaValues(close, slow);
    const n = close.length;
    const macdLine = nulls(n);
    for (let i = 0; i < n; i++) {
      if (emaF[i] != null && emaS[i] != null) macdLine[i] = emaF[i]! - emaS[i]!;
    }
    const signalLine = computeEmaValues(macdLine, sig);
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!macdLine[i] || !signalLine[i] || !macdLine[i - 1] || !signalLine[i - 1]) continue;
      const prev = macdLine[i - 1]! - signalLine[i - 1]!;
      const curr = macdLine[i]! - signalLine[i]!;
      if (prev < 0 && curr >= 0) out[i] = 1;
      else if (prev > 0 && curr <= 0) out[i] = -1;
    }
    return toResult(out);
  },
);

const maCrossStrategyDef = strategyDef('strat_movingAverageCross', 'Moving Average Cross',
  [
    { name: 'fast', label: 'Fast', type: 'number', default: 9, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 21, min: 1 },
  ],
  ({ close, params }) => {
    const f = clampInt(params.fast, 9);
    const s = clampInt(params.slow, 21);
    const fast = computeSmaValues(close, f);
    const slow = computeSmaValues(close, s);
    const n = close.length;
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!fast[i] || !slow[i] || !fast[i - 1] || !slow[i - 1]) continue;
      if (fast[i - 1]! < slow[i - 1]! && fast[i]! >= slow[i]!) out[i] = 1;
      else if (fast[i - 1]! > slow[i - 1]! && fast[i]! <= slow[i]!) out[i] = -1;
    }
    return toResult(out);
  },
);

const rsiStrategyDef = strategyDef('strat_rsi', 'RSI Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 1 },
    { name: 'overbought', label: 'Overbought', type: 'number', default: 70, min: 50 },
    { name: 'oversold', label: 'Oversold', type: 'number', default: 30, min: 1 },
  ],
  ({ close, params }) => {
    const p = clampInt(params.period, 14);
    const ob = params.overbought ?? 70;
    const os = params.oversold ?? 30;
    const rsi = computeRsiValues(close, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!rsi[i] || !rsi[i - 1]) continue;
      if (rsi[i - 1]! < os && rsi[i]! >= os) out[i] = 1;
      else if (rsi[i - 1]! > ob && rsi[i]! <= ob) out[i] = -1;
    }
    return toResult(out);
  },
);

const stochStrategyDef = strategyDef('strat_stochastic', 'Stochastic Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 1 },
    { name: 'overbought', label: 'Overbought', type: 'number', default: 80, min: 50 },
    { name: 'oversold', label: 'Oversold', type: 'number', default: 20, min: 1 },
  ],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 14);
    const ob = params.overbought ?? 80;
    const os = params.oversold ?? 20;
    const n = close.length;
    const k = nulls(n);
    for (let i = p - 1; i < n; i++) {
      let hh: number | null = null, ll: number | null = null;
      for (let j = i - p + 1; j <= i; j++) {
        if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
        if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
      }
      if (hh != null && ll != null && hh !== ll && close[i] != null)
        k[i] = ((close[i]! - ll) / (hh - ll)) * 100;
    }
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!k[i] || !k[i - 1]) continue;
      if (k[i - 1]! < os && k[i]! >= os) out[i] = 1;
      else if (k[i - 1]! > ob && k[i]! <= ob) out[i] = -1;
    }
    return toResult(out);
  },
);

const supertrendStrategyDef = strategyDef('strat_supertrend', 'Supertrend Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 10, min: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 3, min: 0.1, step: 0.1 },
  ],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 10);
    const mult = params.mult ?? 3;
    const atrVals = computeAtr(high, low, close, p);
    const n = close.length;
    const out = nulls(n);
    const upper = nulls(n), lower = nulls(n);
    let trend = 1;
    for (let i = p; i < n; i++) {
      if (!close[i] || !high[i] || !low[i] || !atrVals[i]) continue;
      const mid = (high[i]! + low[i]!) / 2;
      const newUpper = mid + mult * atrVals[i]!;
      const newLower = mid - mult * atrVals[i]!;
      upper[i] = (upper[i - 1] != null && newUpper < upper[i - 1]!) ? upper[i - 1]! : newUpper;
      lower[i] = (lower[i - 1] != null && newLower > lower[i - 1]!) ? lower[i - 1]! : newLower;
      const prevTrend = trend;
      if (close[i]! > (upper[i] ?? 0)) trend = 1;
      else if (close[i]! < (lower[i] ?? 0)) trend = -1;
      if (trend !== prevTrend) out[i] = trend;
    }
    return toResult(out);
  },
);

const ichimokuStrategyDef = strategyDef('strat_ichimoku', 'Ichimoku Cloud Strategy',
  [
    { name: 'tenkan', label: 'Tenkan', type: 'number', default: 9, min: 1 },
    { name: 'kijun', label: 'Kijun', type: 'number', default: 26, min: 1 },
  ],
  ({ high, low, close, params }) => {
    const t = clampInt(params.tenkan, 9);
    const k = clampInt(params.kijun, 26);
    const n = close.length;
    const calcHL = (p: number): Num[] => {
      const r = nulls(n);
      for (let i = p - 1; i < n; i++) {
        let hh: number | null = null, ll: number | null = null;
        for (let j = i - p + 1; j <= i; j++) {
          if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
          if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
        }
        if (hh != null && ll != null) r[i] = (hh + ll) / 2;
      }
      return r;
    };
    const tk = calcHL(t), kj = calcHL(k);
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!tk[i] || !kj[i] || !tk[i - 1] || !kj[i - 1]) continue;
      if (tk[i - 1]! < kj[i - 1]! && tk[i]! >= kj[i]!) out[i] = 1;
      else if (tk[i - 1]! > kj[i - 1]! && tk[i]! <= kj[i]!) out[i] = -1;
    }
    return toResult(out);
  },
);

const aroonStrategyDef = strategyDef('strat_aroon', 'Aroon Strategy',
  [{ name: 'period', label: 'Period', type: 'number', default: 25, min: 1 }],
  ({ high, low, params }) => {
    const p = clampInt(params.period, 25);
    const n = high.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      let highIdx = i, lowIdx = i;
      for (let j = i - p; j <= i; j++) {
        if (high[j] != null && (high[highIdx] == null || high[j]! >= high[highIdx]!)) highIdx = j;
        if (low[j] != null && (low[lowIdx] == null || low[j]! <= low[lowIdx]!)) lowIdx = j;
      }
      const aroonUp = ((p - (i - highIdx)) / p) * 100;
      const aroonDn = ((p - (i - lowIdx)) / p) * 100;
      if (aroonUp > 70 && aroonDn < 30) out[i] = 1;
      else if (aroonDn > 70 && aroonUp < 30) out[i] = -1;
    }
    return toResult(out);
  },
);

const psarStrategyDef = strategyDef('strat_parabolicSar', 'Parabolic SAR Strategy',
  [
    { name: 'step', label: 'Step', type: 'number', default: 0.02, min: 0.001, step: 0.001 },
    { name: 'max', label: 'Max', type: 'number', default: 0.2, min: 0.01, step: 0.01 },
  ],
  ({ high, low, close, params }) => {
    const step = params.step ?? 0.02;
    const max = params.max ?? 0.2;
    const n = close.length;
    const out = nulls(n);
    if (n < 2) return toResult(out);
    let isLong = close[1] != null && close[0] != null ? close[1]! > close[0]! : true;
    let sar = isLong ? (low[0] ?? 0) : (high[0] ?? 0);
    let ep = isLong ? (high[0] ?? 0) : (low[0] ?? 0);
    let af = step;
    for (let i = 1; i < n; i++) {
      const h = high[i] ?? 0, l = low[i] ?? 0;
      sar = sar + af * (ep - sar);
      if (isLong) {
        if (l < sar) { isLong = false; sar = ep; ep = l; af = step; out[i] = -1; }
        else { if (h > ep) { ep = h; af = Math.min(af + step, max); } }
      } else {
        if (h > sar) { isLong = true; sar = ep; ep = h; af = step; out[i] = 1; }
        else { if (l < ep) { ep = l; af = Math.min(af + step, max); } }
      }
    }
    return toResult(out);
  },
);

const atrTrailingDef = strategyDef('strat_atrTrailing', 'ATR Trailing Stop Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 14);
    const mult = params.mult ?? 2;
    const atr = computeAtr(high, low, close, p);
    const n = close.length;
    const out = nulls(n);
    let stop = 0, isLong = true;
    for (let i = p; i < n; i++) {
      if (!close[i] || !atr[i]) continue;
      const c = close[i]!, a = atr[i]! * mult;
      const prevLong: boolean = isLong;
      if (isLong) { stop = Math.max(stop, c - a); if (c < stop) { isLong = false; stop = c + a; } }
      else { stop = Math.min(stop, c + a); if (c > stop) { isLong = true; stop = c - a; } }
      if (isLong !== prevLong) out[i] = isLong ? 1 : -1;
    }
    return toResult(out);
  },
);

export const strategiesPart1: IndicatorDefinition[] = [
  bbStrategyDef, channelBreakoutDef, macdStrategyDef, maCrossStrategyDef,
  rsiStrategyDef, stochStrategyDef, supertrendStrategyDef, ichimokuStrategyDef,
  aroonStrategyDef, psarStrategyDef, atrTrailingDef,
];
