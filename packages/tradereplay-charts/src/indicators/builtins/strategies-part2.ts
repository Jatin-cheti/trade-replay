import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeSmaValues } from './sma.ts';
import { clampInt, computeAtr, computeTrueRange, nulls, rollingExtrema } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult { return { outputs }; }

function strategyDef(
  id: string, name: string,
  inputs: IndicatorDefinition['inputs'],
  compute: IndicatorDefinition['compute'],
): IndicatorDefinition {
  return { id, name, inputs, outputs: [{ name: 'signal', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }], compute };
}

const pivotReversalDef = strategyDef('strat_pivotReversal', 'Pivot Reversal Strategy',
  [{ name: 'bars', label: 'Left/Right Bars', type: 'number', default: 4, min: 1 }],
  ({ high, low, params }) => {
    const b = clampInt(params.bars, 4);
    const n = high.length;
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
      if (volume[i]! > avgVol[i]! * mult)
        out[i] = close[i]! > close[i - 1]! ? 1 : -1;
    }
    return toResult(out);
  },
);

export const strategiesPart2: IndicatorDefinition[] = [
  pivotReversalDef, meanReversionDef, momentumStrategyDef, williamsRStrategyDef,
  cciStrategyDef, adxStrategyDef, keltnerStrategyDef, donchianStrategyDef,
  emaCrossDef, insideBarDef, volumeBreakoutDef,
];
