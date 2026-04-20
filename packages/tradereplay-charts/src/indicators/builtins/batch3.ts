import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { clampInt, computeTrueRange, mapTypicalPrice, nulls, rollingExtrema, rollingSma, rollingSum } from './_helpers.ts';

type Num = number | null;

function computeTrimaValues(values: readonly Num[], period: number): Num[] {
  const p1 = Math.max(1, Math.ceil((period + 1) / 2));
  const p2 = Math.max(1, Math.floor((period + 1) / 2));
  return rollingSma(rollingSma(values, p1), p2);
}

function computeSmmaValues(values: readonly Num[], period: number): Num[] {
  const out = nulls(values.length);
  if (period < 1 || values.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i++) {
    const v = values[i];
    if (v == null) return out;
    seed += v;
  }

  out[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) {
    const cur = values[i];
    const prev = out[i - 1];
    if (cur == null || prev == null) continue;
    out[i] = (prev * (period - 1) + cur) / period;
  }

  return out;
}

function computeLinearRegression(values: readonly Num[], period: number): { slope: Num[]; intercept: Num[] } {
  const n = values.length;
  const slope = nulls(n);
  const intercept = nulls(n);
  const sumX = (period * (period - 1)) / 2;
  const sumXX = ((period - 1) * period * (2 * period - 1)) / 6;
  const denom = period * sumXX - sumX * sumX;
  if (denom === 0) return { slope, intercept };

  for (let i = period - 1; i < n; i++) {
    let sumY = 0;
    let sumXY = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) {
        valid = false;
        break;
      }
      sumY += v;
      sumXY += j * v;
    }
    if (!valid) continue;

    const s = (period * sumXY - sumX * sumY) / denom;
    const b = (sumY - s * sumX) / period;
    slope[i] = s;
    intercept[i] = b;
  }

  return { slope, intercept };
}

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

export const trimaDef: IndicatorDefinition = {
  id: 'trima',
  name: 'Triangular Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'trima', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 2 }],
  compute: ({ close, params }) => toResult(computeTrimaValues(close, clampInt(params.period, 20, 1))),
};

export const smmaDef: IndicatorDefinition = {
  id: 'smma',
  name: 'Smoothed Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'smma', seriesType: 'Line', pane: 'overlay', color: '#16a34a', lineWidth: 2 }],
  compute: ({ close, params }) => toResult(computeSmmaValues(close, clampInt(params.period, 14, 1))),
};

export const apoDef: IndicatorDefinition = {
  id: 'apo',
  name: 'Absolute Price Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 2 },
  ],
  outputs: [{ name: 'apo', seriesType: 'Line', pane: 'subpane', color: '#0284c7', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const fast = clampInt(params.fast, 12, 1);
    const slow = Math.max(fast + 1, clampInt(params.slow, 26, 2));
    const fastEma = computeEmaValues(close, fast);
    const slowEma = computeEmaValues(close, slow);
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (fastEma[i] == null || slowEma[i] == null) continue;
      out[i] = fastEma[i]! - slowEma[i]!;
    }
    return toResult(out);
  },
};

export const smiDef: IndicatorDefinition = {
  id: 'smi',
  name: 'Stochastic Momentum Index',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 2 },
    { name: 'smooth', label: 'Smooth', type: 'number', default: 3, min: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 3, min: 1 },
  ],
  outputs: [
    { name: 'smi', seriesType: 'Line', pane: 'subpane', color: '#0ea5e9', lineWidth: 2 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f59e0b', lineWidth: 1 },
  ],
  compute: ({ high, low, close, params }) => {
    const period = clampInt(params.period, 14, 2);
    const smooth = clampInt(params.smooth, 3, 1);
    const signalPeriod = clampInt(params.signal, 3, 1);
    const hh = rollingExtrema(high, period, true);
    const ll = rollingExtrema(low, period, false);
    const rel = nulls(close.length);
    const range = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (close[i] == null || hh[i] == null || ll[i] == null) continue;
      rel[i] = close[i]! - (hh[i]! + ll[i]!) / 2;
      range[i] = hh[i]! - ll[i]!;
    }

    const relSmooth = computeEmaValues(computeEmaValues(rel, smooth), smooth);
    const rangeSmooth = computeEmaValues(computeEmaValues(range, smooth), smooth);
    const smi = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (relSmooth[i] == null || rangeSmooth[i] == null || rangeSmooth[i] === 0) continue;
      smi[i] = (200 * relSmooth[i]!) / rangeSmooth[i]!;
    }
    const signal = computeEmaValues(smi, signalPeriod);
    return toResult(smi, signal);
  },
};

export const choppinessDef: IndicatorDefinition = {
  id: 'choppiness',
  name: 'Choppiness Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 2 }],
  outputs: [{ name: 'choppiness', seriesType: 'Line', pane: 'subpane', color: '#e11d48', lineWidth: 2 }],
  compute: ({ high, low, close, params }) => {
    const period = clampInt(params.period, 14, 2);
    const tr = computeTrueRange(high, low, close);
    const trSum = rollingSum(tr, period);
    const hh = rollingExtrema(high, period, true);
    const ll = rollingExtrema(low, period, false);
    const out = nulls(close.length);
    const denom = Math.log10(period);
    for (let i = 0; i < close.length; i++) {
      if (trSum[i] == null || hh[i] == null || ll[i] == null || hh[i] === ll[i]) continue;
      out[i] = (100 * Math.log10(trSum[i]! / (hh[i]! - ll[i]!))) / denom;
    }
    return toResult(out);
  },
};

export const ulcerIndexDef: IndicatorDefinition = {
  id: 'ulcer_index',
  name: 'Ulcer Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 2 }],
  outputs: [{ name: 'ulcer', seriesType: 'Line', pane: 'subpane', color: '#8b5cf6', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const period = clampInt(params.period, 14, 2);
    const hh = rollingExtrema(close, period, true);
    const ddSq = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (close[i] == null || hh[i] == null || hh[i] === 0) continue;
      const dd = ((close[i]! - hh[i]!) / hh[i]!) * 100;
      ddSq[i] = dd * dd;
    }
    const meanDdSq = rollingSma(ddSq, period);
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (meanDdSq[i] == null) continue;
      out[i] = Math.sqrt(meanDdSq[i]!);
    }
    return toResult(out);
  },
};

export const massIndexDef: IndicatorDefinition = {
  id: 'mass_index',
  name: 'Mass Index',
  inputs: [
    { name: 'ema', label: 'EMA Period', type: 'number', default: 9, min: 1 },
    { name: 'sum', label: 'Sum Period', type: 'number', default: 25, min: 2 },
  ],
  outputs: [{ name: 'mass', seriesType: 'Line', pane: 'subpane', color: '#7c3aed', lineWidth: 2 }],
  compute: ({ high, low, params }) => {
    const emaPeriod = clampInt(params.ema, 9, 1);
    const sumPeriod = clampInt(params.sum, 25, 2);
    const range = nulls(high.length);
    for (let i = 0; i < high.length; i++) {
      if (high[i] == null || low[i] == null) continue;
      range[i] = high[i]! - low[i]!;
    }
    const ema1 = computeEmaValues(range, emaPeriod);
    const ema2 = computeEmaValues(ema1, emaPeriod);
    const ratio = nulls(high.length);
    for (let i = 0; i < high.length; i++) {
      if (ema1[i] == null || ema2[i] == null || ema2[i] === 0) continue;
      ratio[i] = ema1[i]! / ema2[i]!;
    }
    return toResult(rollingSum(ratio, sumPeriod));
  },
};

export const qstickDef: IndicatorDefinition = {
  id: 'qstick',
  name: 'Qstick',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 8, min: 1 }],
  outputs: [{ name: 'qstick', seriesType: 'Line', pane: 'subpane', color: '#14b8a6', lineWidth: 2 }],
  compute: ({ open, close, params }) => {
    const period = clampInt(params.period, 8, 1);
    const body = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (open[i] == null || close[i] == null) continue;
      body[i] = close[i]! - open[i]!;
    }
    return toResult(rollingSma(body, period));
  },
};

export const relativeVolumeDef: IndicatorDefinition = {
  id: 'relative_volume',
  name: 'Relative Volume',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'rvol', seriesType: 'Line', pane: 'subpane', color: '#f97316', lineWidth: 2 }],
  compute: ({ volume, params }) => {
    const period = clampInt(params.period, 20, 1);
    const baseline = rollingSma(volume, period);
    const out = nulls(volume.length);
    for (let i = 0; i < volume.length; i++) {
      if (volume[i] == null || baseline[i] == null || baseline[i] === 0) continue;
      out[i] = volume[i]! / baseline[i]!;
    }
    return toResult(out);
  },
};

export const balanceOfPowerDef: IndicatorDefinition = {
  id: 'balance_of_power',
  name: 'Balance Of Power',
  inputs: [],
  outputs: [{ name: 'bop', seriesType: 'Line', pane: 'subpane', color: '#ef4444', lineWidth: 2 }],
  compute: ({ open, high, low, close }) => {
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) continue;
      const den = high[i]! - low[i]!;
      if (den === 0) continue;
      out[i] = (close[i]! - open[i]!) / den;
    }
    return toResult(out);
  },
};

export const emvOscDef: IndicatorDefinition = {
  id: 'emv_osc',
  name: 'Ease Of Movement Oscillator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'emv', seriesType: 'Line', pane: 'subpane', color: '#6366f1', lineWidth: 2 }],
  compute: ({ high, low, volume, params }) => {
    const period = clampInt(params.period, 14, 1);
    const raw = nulls(high.length);
    for (let i = 1; i < high.length; i++) {
      if (high[i] == null || low[i] == null || high[i - 1] == null || low[i - 1] == null || volume[i] == null || volume[i] === 0) continue;
      const midMove = (high[i]! + low[i]!) / 2 - (high[i - 1]! + low[i - 1]!) / 2;
      const boxRatio = volume[i]! / Math.max(high[i]! - low[i]!, 1e-9);
      raw[i] = (midMove / boxRatio) * 100000;
    }
    return toResult(computeEmaValues(raw, period));
  },
};

export const volatilityRatioDef: IndicatorDefinition = {
  id: 'volatility_ratio',
  name: 'Volatility Ratio',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1 }],
  outputs: [{ name: 'vr', seriesType: 'Line', pane: 'subpane', color: '#a855f7', lineWidth: 2 }],
  compute: ({ high, low, close, params }) => {
    const period = clampInt(params.period, 14, 1);
    const tr = computeTrueRange(high, low, close);
    const atr = computeEmaValues(tr, period, 1 / period);
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (tr[i] == null || atr[i] == null || atr[i] === 0) continue;
      out[i] = tr[i]! / atr[i]!;
    }
    return toResult(out);
  },
};

export const linearRegSlopeDef: IndicatorDefinition = {
  id: 'linear_reg_slope',
  name: 'Linear Regression Slope',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 2 }],
  outputs: [{ name: 'slope', seriesType: 'Line', pane: 'subpane', color: '#06b6d4', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const period = clampInt(params.period, 20, 2);
    return toResult(computeLinearRegression(close, period).slope);
  },
};

export const linearRegInterceptDef: IndicatorDefinition = {
  id: 'linear_reg_intercept',
  name: 'Linear Regression Intercept',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 2 }],
  outputs: [{ name: 'intercept', seriesType: 'Line', pane: 'overlay', color: '#f43f5e', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const period = clampInt(params.period, 20, 2);
    return toResult(computeLinearRegression(close, period).intercept);
  },
};

export const linearRegAngleDef: IndicatorDefinition = {
  id: 'linear_reg_angle',
  name: 'Linear Regression Angle',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 2 }],
  outputs: [{ name: 'angle', seriesType: 'Line', pane: 'subpane', color: '#0d9488', lineWidth: 2 }],
  compute: ({ close, params }) => {
    const period = clampInt(params.period, 20, 2);
    const slope = computeLinearRegression(close, period).slope;
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (slope[i] == null) continue;
      out[i] = (Math.atan(slope[i]!) * 180) / Math.PI;
    }
    return toResult(out);
  },
};

export const priceChannelMidDef: IndicatorDefinition = {
  id: 'price_channel_mid',
  name: 'Price Channel Midline',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'mid', seriesType: 'Line', pane: 'overlay', color: '#84cc16', lineWidth: 2 }],
  compute: ({ high, low, params }) => {
    const period = clampInt(params.period, 20, 1);
    const hh = rollingExtrema(high, period, true);
    const ll = rollingExtrema(low, period, false);
    const out = nulls(high.length);
    for (let i = 0; i < high.length; i++) {
      if (hh[i] == null || ll[i] == null) continue;
      out[i] = (hh[i]! + ll[i]!) / 2;
    }
    return toResult(out);
  },
};

export const medianPriceDef: IndicatorDefinition = {
  id: 'median_price',
  name: 'Median Price',
  inputs: [],
  outputs: [{ name: 'median', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 }],
  compute: ({ high, low }) => {
    const out = nulls(high.length);
    for (let i = 0; i < high.length; i++) {
      if (high[i] == null || low[i] == null) continue;
      out[i] = (high[i]! + low[i]!) / 2;
    }
    return toResult(out);
  },
};

export const typicalPriceDef: IndicatorDefinition = {
  id: 'typical_price',
  name: 'Typical Price',
  inputs: [],
  outputs: [{ name: 'typical', seriesType: 'Line', pane: 'overlay', color: '#10b981', lineWidth: 1 }],
  compute: ({ high, low, close }) => toResult(mapTypicalPrice(high, low, close)),
};

export const weightedCloseDef: IndicatorDefinition = {
  id: 'weighted_close',
  name: 'Weighted Close',
  inputs: [],
  outputs: [{ name: 'weightedClose', seriesType: 'Line', pane: 'overlay', color: '#059669', lineWidth: 1 }],
  compute: ({ high, low, close }) => {
    const out = nulls(close.length);
    for (let i = 0; i < close.length; i++) {
      if (high[i] == null || low[i] == null || close[i] == null) continue;
      out[i] = (high[i]! + low[i]! + 2 * close[i]!) / 4;
    }
    return toResult(out);
  },
};

export const volumeOscillatorDef: IndicatorDefinition = {
  id: 'volume_oscillator',
  name: 'Volume Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 14, min: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 28, min: 2 },
  ],
  outputs: [{ name: 'vo', seriesType: 'Line', pane: 'subpane', color: '#f59e0b', lineWidth: 2 }],
  compute: ({ volume, params }) => {
    const fast = clampInt(params.fast, 14, 1);
    const slow = Math.max(fast + 1, clampInt(params.slow, 28, 2));
    const fastEma = computeEmaValues(volume, fast);
    const slowEma = computeEmaValues(volume, slow);
    const out = nulls(volume.length);
    for (let i = 0; i < volume.length; i++) {
      if (fastEma[i] == null || slowEma[i] == null || slowEma[i] === 0) continue;
      out[i] = ((fastEma[i]! - slowEma[i]!) / slowEma[i]!) * 100;
    }
    return toResult(out);
  },
};
