/**
 * strategies.ts – TradingView strategy implementations.
 *
 * Each strategy computes buy (+1) / sell (-1) signals as a histogram.
 * They combine existing indicator logic to generate signals.
 */

import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeSmaValues } from './sma.ts';
import { computeRsiValues } from './rsi.ts';
import {
  clampInt,
  computeAtr,
  computeTrueRange,
  nulls,
  rollingSma,
  rollingStdDev,
  rollingExtrema,
} from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

function strategyDef(
  id: string,
  name: string,
  inputs: IndicatorDefinition['inputs'],
  compute: IndicatorDefinition['compute'],
): IndicatorDefinition {
  return {
    id,
    name,
    inputs,
    outputs: [{ name: 'signal', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
    compute,
  };
}

/* Bollinger Bands Strategy */
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
      const upper = sma[i]! + mult * sd[i]!;
      const lower = sma[i]! - mult * sd[i]!;
      if (close[i]! < lower) out[i] = 1;
      else if (close[i]! > upper) out[i] = -1;
    }
    return toResult(out);
  },
);

/* Channel Breakout Strategy */
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

/* MACD Strategy */
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

/* Moving Average Cross Strategy */
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

/* RSI Strategy */
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

/* Stochastic Strategy */
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

/* Supertrend Strategy */
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

/* Ichimoku Cloud Strategy */
const ichimokuStrategyDef = strategyDef('strat_ichimoku', 'Ichimoku Cloud Strategy',
  [
    { name: 'tenkan', label: 'Tenkan', type: 'number', default: 9, min: 1 },
    { name: 'kijun', label: 'Kijun', type: 'number', default: 26, min: 1 },
  ],
  ({ high, low, close, params }) => {
    const t = clampInt(params.tenkan, 9);
    const k = clampInt(params.kijun, 26);
    const n = close.length;
    const tenkan = nulls(n), kijun = nulls(n);
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

/* Aroon Strategy */
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

/* Parabolic SAR Strategy */
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

/* ATR Trailing Stop Strategy */
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
      const c = close[i]!;
      const a = atr[i]! * mult;
      const prevLong: boolean = isLong;
      if (isLong) { stop = Math.max(stop, c - a); if (c < stop) { isLong = false; stop = c + a; } }
      else { stop = Math.min(stop, c + a); if (c > stop) { isLong = true; stop = c - a; } }
      if (isLong !== prevLong) out[i] = isLong ? 1 : -1;
    }
    return toResult(out);
  },
);

/* Pivot Reversal Strategy */
const pivotReversalDef = strategyDef('strat_pivotReversal', 'Pivot Reversal Strategy',
  [{ name: 'bars', label: 'Left/Right Bars', type: 'number', default: 4, min: 1 }],
  ({ high, low, close, params }) => {
    const b = clampInt(params.bars, 4);
    const n = close.length;
    const out = nulls(n);
    for (let i = b; i < n - b; i++) {
      let isPivotHigh = true, isPivotLow = true;
      for (let j = 1; j <= b; j++) {
        if (high[i - j] == null || high[i + j] == null || high[i] == null) { isPivotHigh = false; break; }
        if (high[i - j]! >= high[i]! || high[i + j]! >= high[i]!) isPivotHigh = false;
        if (low[i - j] == null || low[i + j] == null || low[i] == null) { isPivotLow = false; break; }
        if (low[i - j]! <= low[i]! || low[i + j]! <= low[i]!) isPivotLow = false;
      }
      if (isPivotHigh) out[i + b] = -1;
      if (isPivotLow) out[i + b] = 1;
    }
    return toResult(out);
  },
);

/* Mean Reversion Strategy */
const meanReversionDef = strategyDef('strat_meanReversion', 'Mean Reversion Strategy',
  [
    { name: 'period', label: 'SMA Period', type: 'number', default: 20, min: 2 },
    { name: 'threshold', label: 'Threshold %', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  ({ close, params }) => {
    const p = clampInt(params.period, 20, 2);
    const thresh = (params.threshold ?? 2) / 100;
    const sma = computeSmaValues(close, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (!close[i] || !sma[i]) continue;
      const dev = (close[i]! - sma[i]!) / sma[i]!;
      if (dev < -thresh) out[i] = 1;
      else if (dev > thresh) out[i] = -1;
    }
    return toResult(out);
  },
);

/* Momentum Strategy */
const momentumStrategyDef = strategyDef('strat_momentum', 'Momentum Strategy',
  [{ name: 'period', label: 'Period', type: 'number', default: 10, min: 1 }],
  ({ close, params }) => {
    const p = clampInt(params.period, 10);
    const n = close.length;
    const out = nulls(n);
    for (let i = p + 1; i < n; i++) {
      if (!close[i] || !close[i - p] || !close[i - 1] || !close[i - p - 1]) continue;
      const mom = close[i]! - close[i - p]!;
      const prevMom = close[i - 1]! - close[i - p - 1]!;
      if (prevMom < 0 && mom >= 0) out[i] = 1;
      else if (prevMom > 0 && mom <= 0) out[i] = -1;
    }
    return toResult(out);
  },
);

/* Williams %R Strategy */
const williamsRStrategyDef = strategyDef('strat_williamsR', 'Williams %R Strategy',
  [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 14);
    const n = close.length;
    const wr = nulls(n);
    for (let i = p - 1; i < n; i++) {
      let hh: number | null = null, ll: number | null = null;
      for (let j = i - p + 1; j <= i; j++) {
        if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
        if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
      }
      if (hh != null && ll != null && hh !== ll && close[i] != null)
        wr[i] = ((hh - close[i]!) / (hh - ll)) * -100;
    }
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!wr[i] || !wr[i - 1]) continue;
      if (wr[i - 1]! < -80 && wr[i]! >= -80) out[i] = 1;
      else if (wr[i - 1]! > -20 && wr[i]! <= -20) out[i] = -1;
    }
    return toResult(out);
  },
);

/* CCI Strategy */
const cciStrategyDef = strategyDef('strat_cci', 'CCI Strategy',
  [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20);
    const n = close.length;
    const tp: Num[] = [];
    for (let i = 0; i < n; i++) {
      if (high[i] != null && low[i] != null && close[i] != null)
        tp.push((high[i]! + low[i]! + close[i]!) / 3);
      else tp.push(null);
    }
    const sma = computeSmaValues(tp, p);
    const cci = nulls(n);
    for (let i = p - 1; i < n; i++) {
      if (!sma[i] || !tp[i]) continue;
      let mad = 0, cnt = 0;
      for (let j = i - p + 1; j <= i; j++) { if (tp[j] != null) { mad += Math.abs(tp[j]! - sma[i]!); cnt++; } }
      if (cnt > 0 && mad > 0) cci[i] = (tp[i]! - sma[i]!) / (0.015 * mad / cnt);
    }
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!cci[i] || !cci[i - 1]) continue;
      if (cci[i - 1]! < -100 && cci[i]! >= -100) out[i] = 1;
      else if (cci[i - 1]! > 100 && cci[i]! <= 100) out[i] = -1;
    }
    return toResult(out);
  },
);

/* ADX Strategy */
const adxStrategyDef = strategyDef('strat_adx', 'ADX Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 1 },
    { name: 'threshold', label: 'Threshold', type: 'number', default: 25, min: 1 },
  ],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 14);
    const thresh = params.threshold ?? 25;
    const n = close.length;
    const tr = computeTrueRange(high, low, close);
    const plusDm = nulls(n), minusDm = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!high[i] || !low[i] || !high[i - 1] || !low[i - 1]) continue;
      const upMove = high[i]! - high[i - 1]!;
      const dnMove = low[i - 1]! - low[i]!;
      plusDm[i] = upMove > dnMove && upMove > 0 ? upMove : 0;
      minusDm[i] = dnMove > upMove && dnMove > 0 ? dnMove : 0;
    }
    const smTr = computeEmaValues(tr, p);
    const smPlus = computeEmaValues(plusDm, p);
    const smMinus = computeEmaValues(minusDm, p);
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (!smTr[i] || !smPlus[i] || !smMinus[i] || smTr[i] === 0) continue;
      const diPlus = (smPlus[i]! / smTr[i]!) * 100;
      const diMinus = (smMinus[i]! / smTr[i]!) * 100;
      const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus || 1) * 100;
      if (dx > thresh && diPlus > diMinus) out[i] = 1;
      else if (dx > thresh && diMinus > diPlus) out[i] = -1;
    }
    return toResult(out);
  },
);

/* Keltner Channel Strategy */
const keltnerStrategyDef = strategyDef('strat_keltnerChannel', 'Keltner Channel Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1 },
    { name: 'mult', label: 'ATR Mult', type: 'number', default: 2, min: 0.1, step: 0.1 },
  ],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20);
    const mult = params.mult ?? 2;
    const ema = computeEmaValues(close, p);
    const atr = computeAtr(high, low, close, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      if (!close[i] || !ema[i] || !atr[i]) continue;
      if (close[i]! < ema[i]! - mult * atr[i]!) out[i] = 1;
      else if (close[i]! > ema[i]! + mult * atr[i]!) out[i] = -1;
    }
    return toResult(out);
  },
);

/* Donchian Channel Strategy */
const donchianStrategyDef = strategyDef('strat_donchianChannel', 'Donchian Channel Strategy',
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

/* EMA Cross Strategy */
const emaCrossDef = strategyDef('strat_emaCross', 'EMA Cross Strategy',
  [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 1 },
  ],
  ({ close, params }) => {
    const f = clampInt(params.fast, 12);
    const s = clampInt(params.slow, 26);
    const fast = computeEmaValues(close, f);
    const slow = computeEmaValues(close, s);
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

/* Inside Bar Strategy */
const insideBarDef = strategyDef('strat_insideBar', 'Inside Bar Strategy', [],
  ({ open, high, low, close }) => {
    const n = close.length;
    const out = nulls(n);
    for (let i = 2; i < n; i++) {
      if (!high[i] || !low[i] || !high[i - 1] || !low[i - 1] || !close[i]) continue;
      if (high[i - 1]! <= high[i - 2]! && low[i - 1]! >= low[i - 2]!) {
        if (close[i]! > high[i - 1]!) out[i] = 1;
        else if (close[i]! < low[i - 1]!) out[i] = -1;
      }
    }
    return toResult(out);
  },
);

/* Volume Breakout Strategy */
const volumeBreakoutDef = strategyDef('strat_volumeBreakout', 'Volume Breakout Strategy',
  [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 2 },
    { name: 'mult', label: 'Vol Mult', type: 'number', default: 2, min: 1, step: 0.1 },
  ],
  ({ close, volume, params }) => {
    const p = clampInt(params.period, 20, 2);
    const mult = params.mult ?? 2;
    const avgVol = computeSmaValues(volume, p);
    const n = close.length;
    const out = nulls(n);
    for (let i = 1; i < n; i++) {
      if (!close[i] || !close[i - 1] || !volume[i] || !avgVol[i]) continue;
      if (volume[i]! > avgVol[i]! * mult) {
        out[i] = close[i]! > close[i - 1]! ? 1 : -1;
      }
    }
    return toResult(out);
  },
);

export const allStrategies: IndicatorDefinition[] = [
  bbStrategyDef,
  channelBreakoutDef,
  macdStrategyDef,
  maCrossStrategyDef,
  rsiStrategyDef,
  stochStrategyDef,
  supertrendStrategyDef,
  ichimokuStrategyDef,
  aroonStrategyDef,
  psarStrategyDef,
  atrTrailingDef,
  pivotReversalDef,
  meanReversionDef,
  momentumStrategyDef,
  williamsRStrategyDef,
  cciStrategyDef,
  adxStrategyDef,
  keltnerStrategyDef,
  donchianStrategyDef,
  emaCrossDef,
  insideBarDef,
  volumeBreakoutDef,
];
