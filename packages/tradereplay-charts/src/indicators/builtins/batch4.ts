import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeWmaValues } from './wma.ts';
import { computeRsiValues } from './rsi.ts';
import { clampInt, computeTrueRange, nulls, rollingExtrema, rollingSma, rollingStdDev, rollingSum } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

function safeRange(high: readonly Num[], low: readonly Num[], index: number): number | null {
  const h = high[index];
  const l = low[index];
  if (h == null || l == null || h === l) return null;
  return h - l;
}

export const coppockCurveDef: IndicatorDefinition = {
  id: 'coppock_curve',
  name: 'Coppock Curve',
  inputs: [
    { name: 'roc1', label: 'ROC 1', type: 'number', default: 11, min: 1 },
    { name: 'roc2', label: 'ROC 2', type: 'number', default: 14, min: 1 },
    { name: 'wma', label: 'WMA', type: 'number', default: 10, min: 1 },
  ],
  outputs: [{ name: 'coppock', seriesType: 'Line', pane: 'subpane', color: '#3b82f6', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const roc1 = clampInt(params.roc1, 11, 1);
    const roc2 = clampInt(params.roc2, 14, 1);
    const wma = clampInt(params.wma, 10, 1);
    const rocSum = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (i < Math.max(roc1, roc2) || close[i] == null || close[i - roc1] == null || close[i - roc2] == null) continue;
      const a = ((close[i]! - close[i - roc1]!) / close[i - roc1]!) * 100;
      const b = ((close[i]! - close[i - roc2]!) / close[i - roc2]!) * 100;
      rocSum[i] = a + b;
    }
    return toResult(computeWmaValues(rocSum, wma));
  },
};

export const percentileRankDef: IndicatorDefinition = {
  id: 'percentile_rank',
  name: 'Percentile Rank',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 2 }],
  outputs: [{ name: 'rank', seriesType: 'Line', pane: 'subpane', color: '#10b981', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const period = clampInt(params.period, 20, 2);
    const out = nulls(close.length);
    for (let i = period - 1; i < close.length; i++) {
      const cur = close[i];
      if (cur == null) continue;
      let valid = 0;
      let less = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const v = close[j];
        if (v == null) continue;
        valid++;
        if (v <= cur) less++;
      }
      if (valid > 0) out[i] = (less / valid) * 100;
    }
    return toResult(out);
  },
};

export const normalizedAtrDef: IndicatorDefinition = {
  id: 'normalized_atr',
  name: 'Normalized ATR',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'natr', seriesType: 'Line', pane: 'subpane', color: '#f97316', lineWidth: 2 }],
  compute: ({ high, low, close, params }) => {
    const period = clampInt(params.period, 14, 1);
    const tr = computeTrueRange(high, low, close);
    const atr = rollingSma(tr, period);
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (atr[i] == null || close[i] == null || close[i] === 0) continue;
      out[i] = (atr[i]! / close[i]!) * 100;
    }
    return toResult(out);
  },
};

export const priceChannelWidthDef: IndicatorDefinition = {
  id: 'price_channel_width',
  name: 'Price Channel Width',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'width', seriesType: 'Line', pane: 'subpane', color: '#8b5cf6', lineWidth: 2 }],
  compute: ({ high, low, params }) => {
    const period = clampInt(params.period, 20, 1);
    const hh = rollingExtrema(high, period, true);
    const ll = rollingExtrema(low, period, false);
    const out = nulls(high.length);
    for (let i = 0; i < high.length; i++) {
      if (hh[i] == null || ll[i] == null || (hh[i]! + ll[i]!) === 0) continue;
      out[i] = ((hh[i]! - ll[i]!) / ((hh[i]! + ll[i]!) / 2)) * 100;
    }
    return toResult(out);
  },
};

export const closeLocationValueDef: IndicatorDefinition = {
  id: 'close_location_value',
  name: 'Close Location Value',
  inputs: [],
  outputs: [{ name: 'clv', seriesType: 'Line', pane: 'subpane', color: '#14b8a6', lineWidth: 2 }],
  compute: ({ high, low, close }) => {
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      const range = safeRange(high, low, i);
      if (range == null || close[i] == null) continue;
      out[i] = ((close[i]! - low[i]!) - (high[i]! - close[i]!)) / range;
    }
    return toResult(out);
  },
};

export const candleBodyDef: IndicatorDefinition = {
  id: 'candle_body',
  name: 'Candle Body',
  inputs: [],
  outputs: [{ name: 'body', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 2 }],
  compute: ({ open, close }) => {
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (open[i] == null || close[i] == null) continue;
      out[i] = close[i]! - open[i]!;
    }
    return toResult(out);
  },
};

export const candleBodyPercentDef: IndicatorDefinition = {
  id: 'candle_body_percent',
  name: 'Candle Body Percent',
  inputs: [],
  outputs: [{ name: 'bodyPct', seriesType: 'Line', pane: 'subpane', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ open, high, low, close }) => {
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      const range = safeRange(high, low, i);
      if (range == null || open[i] == null || close[i] == null) continue;
      out[i] = ((close[i]! - open[i]!) / range) * 100;
    }
    return toResult(out);
  },
};

export const upperWickDef: IndicatorDefinition = {
  id: 'upper_wick',
  name: 'Upper Wick',
  inputs: [],
  outputs: [{ name: 'upperWick', seriesType: 'Line', pane: 'subpane', color: '#06b6d4', lineWidth: 2 }],
  compute: ({ open, high, close }) => {
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (open[i] == null || high[i] == null || close[i] == null) continue;
      const bodyHigh = Math.max(open[i]!, close[i]!);
      out[i] = Math.max(0, high[i]! - bodyHigh);
    }
    return toResult(out);
  },
};

export const lowerWickDef: IndicatorDefinition = {
  id: 'lower_wick',
  name: 'Lower Wick',
  inputs: [],
  outputs: [{ name: 'lowerWick', seriesType: 'Line', pane: 'subpane', color: '#22c55e', lineWidth: 2 }],
  compute: ({ open, low, close }) => {
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (open[i] == null || low[i] == null || close[i] == null) continue;
      const bodyLow = Math.min(open[i]!, close[i]!);
      out[i] = Math.max(0, bodyLow - low[i]!);
    }
    return toResult(out);
  },
};

export const trueRangePercentDef: IndicatorDefinition = {
  id: 'true_range_percent',
  name: 'True Range Percent',
  inputs: [],
  outputs: [{ name: 'trPct', seriesType: 'Line', pane: 'subpane', color: '#6366f1', lineWidth: 2 }],
  compute: ({ high, low, close }) => {
    const tr = computeTrueRange(high, low, close);
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (tr[i] == null || close[i] == null || close[i] === 0) continue;
      out[i] = (tr[i]! / close[i]!) * 100;
    }
    return toResult(out);
  },
};

export const rollingHighDef: IndicatorDefinition = {
  id: 'rolling_high',
  name: 'Rolling High',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'high', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 }],
  compute: ({ high, params }) => {
    const period = clampInt(params.period, 20, 1);
    return toResult(rollingExtrema(high, period, true));
  },
};

export const rollingLowDef: IndicatorDefinition = {
  id: 'rolling_low',
  name: 'Rolling Low',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'low', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 1 }],
  compute: ({ low, params }) => {
    const period = clampInt(params.period, 20, 1);
    return toResult(rollingExtrema(low, period, false));
  },
};

export const volumeZScoreDef: IndicatorDefinition = {
  id: 'volume_zscore',
  name: 'Volume Z-Score',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 2 }],
  outputs: [{ name: 'vz', seriesType: 'Line', pane: 'subpane', color: '#a855f7', lineWidth: 2 }],
  compute: ({ volume, params }) => {
    const period = clampInt(params.period, 20, 2);
    const mean = rollingSma(volume, period);
    const stdev = rollingStdDev(volume, period);
    const out = nulls(volume.length);
    for (let i = 0; i < volume.length; i++) {
      if (volume[i] == null || mean[i] == null || stdev[i] == null || stdev[i] === 0) continue;
      out[i] = (volume[i]! - mean[i]!) / stdev[i]!;
    }
    return toResult(out);
  },
};

export const volumeSmaRatioDef: IndicatorDefinition = {
  id: 'volume_sma_ratio',
  name: 'Volume SMA Ratio',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'vsr', seriesType: 'Line', pane: 'subpane', color: '#f97316', lineWidth: 2 }],
  compute: ({ volume, params }) => {
    const period = clampInt(params.period, 20, 1);
    const mean = rollingSma(volume, period);
    const out = nulls(volume.length);
    for (let i = 0; i < volume.length; i++) {
      if (volume[i] == null || mean[i] == null || mean[i] === 0) continue;
      out[i] = volume[i]! / mean[i]!;
    }
    return toResult(out);
  },
};

export const rangeSmaRatioDef: IndicatorDefinition = {
  id: 'range_sma_ratio',
  name: 'Range SMA Ratio',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'rsr', seriesType: 'Line', pane: 'subpane', color: '#0ea5e9', lineWidth: 2 }],
  compute: ({ high, low, params }) => {
    const period = clampInt(params.period, 20, 1);
    const ranges = nulls(high.length);
    for (let i = 0; i < high.length; i++) {
      if (high[i] == null || low[i] == null) continue;
      ranges[i] = high[i]! - low[i]!;
    }
    const mean = rollingSma(ranges, period);
    const out = nulls(high.length);
    for (let i = 0; i < high.length; i++) {
      if (ranges[i] == null || mean[i] == null || mean[i] === 0) continue;
      out[i] = ranges[i]! / mean[i]!;
    }
    return toResult(out);
  },
};

export const cumulativeVolumeDeltaDef: IndicatorDefinition = {
  id: 'cumulative_volume_delta',
  name: 'Cumulative Volume Delta',
  inputs: [],
  outputs: [{ name: 'cvd', seriesType: 'Line', pane: 'subpane', color: '#dc2626', lineWidth: 2 }],
  compute: ({ open, close, volume }) => {
    const out = nulls(close.length);
    let sum = 0;
    for (let i = 0; i < close.length; i++) {
      if (open[i] == null || close[i] == null || volume[i] == null) continue;
      const direction = close[i]! >= open[i]! ? 1 : -1;
      sum += direction * volume[i]!;
      out[i] = sum;
    }
    return toResult(out);
  },
};

export const rollingReturnDef: IndicatorDefinition = {
  id: 'rolling_return',
  name: 'Rolling Return',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'return', seriesType: 'Line', pane: 'subpane', color: '#22c55e', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const period = clampInt(params.period, 20, 1);
    const out = nulls(close.length);
    for (let i = period; i < close.length; i++) {
      if (close[i] == null || close[i - period] == null || close[i - period] === 0) continue;
      out[i] = ((close[i]! - close[i - period]!) / close[i - period]!) * 100;
    }
    return toResult(out);
  },
};

export const logReturnDef: IndicatorDefinition = {
  id: 'log_return',
  name: 'Log Return',
  inputs: [],
  outputs: [{ name: 'logReturn', seriesType: 'Line', pane: 'subpane', color: '#84cc16', lineWidth: 2 }],
  compute: ({ close }) => {
    const out = nulls(close.length);
    for (let i = 1; i < close.length; i++) {
      if (close[i] == null || close[i - 1] == null || close[i - 1] === 0) continue;
      out[i] = Math.log(close[i]! / close[i - 1]!);
    }
    return toResult(out);
  },
};

export const volatilityEmaDef: IndicatorDefinition = {
  id: 'volatility_ema',
  name: 'Volatility EMA',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'volEma', seriesType: 'Line', pane: 'subpane', color: '#7c3aed', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const period = clampInt(params.period, 14, 1);
    const out = nulls(close.length);
    const absReturns = nulls(close.length);
    for (let i = 1; i < close.length; i++) {
      if (close[i] == null || close[i - 1] == null || close[i - 1] === 0) continue;
      absReturns[i] = Math.abs((close[i]! - close[i - 1]!) / close[i - 1]!) * 100;
    }
    return toResult(computeEmaValues(absReturns, period));
  },
};

export const breakoutStrengthDef: IndicatorDefinition = {
  id: 'breakout_strength',
  name: 'Breakout Strength',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'breakout', seriesType: 'Line', pane: 'subpane', color: '#e11d48', lineWidth: 2 }],
  compute: ({ high, low, close, params }) => {
    const period = clampInt(params.period, 20, 1);
    const hh = rollingExtrema(high, period, true);
    const ll = rollingExtrema(low, period, false);
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (close[i] == null || hh[i] == null || ll[i] == null || hh[i] === ll[i]) continue;
      out[i] = ((close[i]! - ll[i]!) / (hh[i]! - ll[i]!)) * 100;
    }
    return toResult(out);
  },
};

export const trendStrengthDef: IndicatorDefinition = {
  id: 'trend_strength',
  name: 'Trend Strength',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 2 },
  ],
  outputs: [{ name: 'trend', seriesType: 'Line', pane: 'subpane', color: '#06b6d4', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const fast = clampInt(params.fast, 12, 1);
    const slow = Math.max(fast + 1, clampInt(params.slow, 26, 2));
    const fastEma = computeEmaValues(close, fast);
    const slowEma = computeEmaValues(close, slow);
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (fastEma[i] == null || slowEma[i] == null || close[i] == null || close[i] === 0) continue;
      out[i] = ((fastEma[i]! - slowEma[i]!) / close[i]!) * 100;
    }
    return toResult(out);
  },
};
