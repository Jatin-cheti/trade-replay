import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeSmaValues } from './sma.ts';
import { computeRsiValues } from './rsi.ts';
import { clampInt, nulls, rollingStdDev } from './_helpers.ts';

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

function rocArr(src: readonly Num[], period: number): Num[] {
  const out = nulls(src.length);
  for (let i = period; i < src.length; i++) {
    if (src[i] != null && src[i - period] != null && src[i - period] !== 0)
      out[i] = ((src[i]! - src[i - period]!) / Math.abs(src[i - period]!)) * 100;
  }
  return out;
}

export const advDeclineRatioDef: IndicatorDefinition = {
  id: 'advDeclineRatio', name: 'Advance Decline Ratio',
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

export const advDeclineRatioBarsDef: IndicatorDefinition = {
  id: 'advDeclineRatioBars', name: 'Advance/Decline Ratio (Bars)',
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

export const avgDailyRangeDef: IndicatorDefinition = {
  id: 'avgDailyRange', name: 'Average Daily Range',
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

export const bollingerBarsDef: IndicatorDefinition = {
  id: 'bollingerBars', name: 'Bollinger Bars',
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

export const chopZoneDef: IndicatorDefinition = {
  id: 'chopZone', name: 'Chop Zone',
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
      out[i] = Math.atan2(emaV[i]! - emaV[i - 1]!, 1) * (180 / Math.PI);
    }
    return toResult(out);
  },
};

export const correlationCoeffDef: IndicatorDefinition = {
  id: 'correlationCoeff', name: 'Correlation Coefficient',
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
      const den = Math.sqrt((cnt * sx2 - sx * sx) * (cnt * sy2 - sy * sy));
      out[i] = den === 0 ? 0 : (cnt * sxy - sx * sy) / den;
    }
    return toResult(out);
  },
};

export const klingerOscDef: IndicatorDefinition = {
  id: 'klingerOsc', name: 'Klinger Oscillator',
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
      vf[i] = volume[i]! * Math.abs(2 * dm / (dm || 1) - 1) * trend;
    }
    const ko = diff(computeEmaValues(vf, fast), computeEmaValues(vf, slow));
    return toResult(ko, computeEmaValues(ko, sig));
  },
};

export const knowSureThingDef: IndicatorDefinition = {
  id: 'knowSureThing', name: 'Know Sure Thing',
  inputs: [{ name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1 }],
  outputs: [
    { name: 'kst', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 1 },
  ],
  compute: ({ close, params }) => {
    const sig = clampInt(params.signal, 9);
    const sma10 = computeSmaValues(rocArr(close, 10), 10);
    const sma10b = computeSmaValues(rocArr(close, 15), 10);
    const sma10c = computeSmaValues(rocArr(close, 20), 10);
    const sma15 = computeSmaValues(rocArr(close, 30), 15);
    const n = close.length;
    const kst = nulls(n);
    for (let i = 0; i < n; i++) {
      if (sma10[i] != null && sma10b[i] != null && sma10c[i] != null && sma15[i] != null)
        kst[i] = sma10[i]! + sma10b[i]! * 2 + sma10c[i]! * 3 + sma15[i]! * 4;
    }
    return toResult(kst, computeSmaValues(kst, sig));
  },
};

export const performanceDef: IndicatorDefinition = {
  id: 'performance', name: 'Performance',
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

export const priceMomentumOscDef: IndicatorDefinition = {
  id: 'priceMomentumOsc', name: 'Price Momentum Oscillator',
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
    const pmo = computeEmaValues(scale(computeEmaValues(roc1, fast), 10), slow);
    return toResult(pmo, computeEmaValues(pmo, sig));
  },
};

export const pringsSpecialKDef: IndicatorDefinition = {
  id: 'pringsSpecialK', name: "Pring's Special K",
  inputs: [],
  outputs: [{ name: 'spk', seriesType: 'Line', pane: 'subpane', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ close }) => {
    const rocs = [10, 15, 20, 30, 40, 65, 75, 100, 195, 265, 390, 530];
    const smas = [10, 10, 10, 15, 50, 65, 75, 100, 130, 130, 130, 195];
    const weights = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
    const n = close.length;
    const out = nulls(n);
    const components = rocs.map((r, idx) => computeSmaValues(rocArr(close, r), smas[idx]));
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

export const rankCorrelationDef: IndicatorDefinition = {
  id: 'rankCorrelation', name: 'Rank Correlation Index',
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
      for (let r = 0; r < vals.length; r++) { const d = r - vals[r].idx; dSq += d * d; }
      out[i] = (1 - (6 * dSq) / (p * (p * p - 1))) * 100;
    }
    return toResult(out);
  },
};

export const rciRibbonDef: IndicatorDefinition = {
  id: 'rciRibbon', name: 'RCI Ribbon',
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

export const relativeVolatilityIndexDef: IndicatorDefinition = {
  id: 'relativeVolatilityIndex', name: 'Relative Volatility Index',
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

export const robBookerKnoxvilleDef: IndicatorDefinition = {
  id: 'robBookerKnoxville', name: 'Rob Booker - Knoxville Divergence',
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

export const robBookerReversalDef: IndicatorDefinition = {
  id: 'robBookerReversal', name: 'Rob Booker - Reversal',
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

export const rsiDivergenceDef: IndicatorDefinition = {
  id: 'rsiDivergence', name: 'RSI Divergence Indicator',
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

export const smiErgodicDef: IndicatorDefinition = {
  id: 'smiErgodic', name: 'SMI Ergodic Indicator',
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

export const smiErgodicOscDef: IndicatorDefinition = {
  id: 'smiErgodicOsc', name: 'SMI Ergodic Oscillator',
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
    return toResult(diff(erg, computeEmaValues(erg, sig)));
  },
};

export const woodiesCciDef: IndicatorDefinition = {
  id: 'woodiesCci', name: 'Woodies CCI',
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
