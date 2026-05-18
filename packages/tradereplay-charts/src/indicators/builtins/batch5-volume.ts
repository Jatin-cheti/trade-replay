import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeSmaValues } from './sma.ts';
import { clampInt, nulls, rollingSum } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult { return { outputs }; }

export const volume24hDef: IndicatorDefinition = {
  id: 'volume24h', name: '24-hour Volume',
  inputs: [{ name: 'period', label: 'Bars', type: 'number', default: 24, min: 1 }],
  outputs: [{ name: 'vol', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' }],
  compute: ({ volume, params }) => toResult(rollingSum(volume, clampInt(params.period, 24))),
};

export const cumulativeVolumeIndexDef: IndicatorDefinition = {
  id: 'cumulativeVolumeIndex', name: 'Cumulative Volume Index',
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

export const netVolumeDef: IndicatorDefinition = {
  id: 'netVolume', name: 'Net Volume',
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

export const twapDef: IndicatorDefinition = {
  id: 'twap', name: 'Time Weighted Average Price',
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

export const tradingSessionsDef: IndicatorDefinition = {
  id: 'tradingSessions', name: 'Trading Sessions',
  inputs: [],
  outputs: [{ name: 'session', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

export const visibleAvgPriceDef: IndicatorDefinition = {
  id: 'visibleAvgPrice', name: 'Visible Average Price',
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

export const volumeDef: IndicatorDefinition = {
  id: 'volume', name: 'Volume',
  inputs: [],
  outputs: [{ name: 'vol', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' }],
  compute: ({ volume }) => toResult([...volume] as Num[]),
};

export const volumeDeltaDef: IndicatorDefinition = {
  id: 'volumeDelta', name: 'Volume Delta',
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

export const vwmaDef: IndicatorDefinition = {
  id: 'vwma', name: 'Volume Weighted Moving Average',
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

export const vwapAutoAnchoredDef: IndicatorDefinition = {
  id: 'vwapAutoAnchored', name: 'VWAP Auto Anchored',
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

export const moonPhasesDef: IndicatorDefinition = {
  id: 'moonPhases', name: 'Moon Phases',
  inputs: [],
  outputs: [{ name: 'phase', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

export const multiTimePeriodDef: IndicatorDefinition = {
  id: 'multiTimePeriod', name: 'Multi-Time Period Charts',
  inputs: [],
  outputs: [{ name: 'mtf', seriesType: 'Line', pane: 'subpane', color: '#64748b' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

export const openInterestDef: IndicatorDefinition = {
  id: 'openInterest', name: 'Open Interest',
  inputs: [],
  outputs: [{ name: 'oi', seriesType: 'Line', pane: 'subpane', color: '#8b5cf6' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

export const priceTargetDef: IndicatorDefinition = {
  id: 'priceTarget', name: 'Price Target',
  inputs: [],
  outputs: [{ name: 'target', seriesType: 'Line', pane: 'overlay', color: '#22c55e' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

export const seasonalityDef: IndicatorDefinition = {
  id: 'seasonality', name: 'Seasonality',
  inputs: [],
  outputs: [{ name: 'seasonal', seriesType: 'Line', pane: 'subpane', color: '#06b6d4' }],
  compute: ({ close }) => toResult(nulls(close.length)),
};

export const technicalRatingsDef: IndicatorDefinition = {
  id: 'technicalRatings', name: 'Technical Ratings',
  inputs: [],
  outputs: [{ name: 'rating', seriesType: 'Histogram', pane: 'subpane', color: '#3b82f6' }],
  compute: ({ close }) => {
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

export const relativeVolumeAtTimeDef: IndicatorDefinition = {
  id: 'relativeVolumeAtTime', name: 'Relative Volume at Time',
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
