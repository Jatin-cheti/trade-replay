/**
 * profiles.ts – TradingView-style Volume/Market Profile implementations.
 *
 * Since true volume-at-price requires tick data, these provide
 * OHLCV-based approximations that overlay on the chart.
 */

import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeSmaValues } from './sma.ts';
import { clampInt, nulls, rollingSum } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

/* Volume Profile Fixed Range — distribution histogram proxy */
export const volumeProfileFRDef: IndicatorDefinition = {
  id: 'prof_volumeProfileFR',
  name: 'Volume Profile Fixed Range',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 50, min: 5 }],
  outputs: [
    { name: 'va', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 2 },
  ],
  compute: ({ high, low, close, volume, params }) => {
    const p = clampInt(params.period, 50, 5);
    const n = close.length;
    const out = nulls(n);
    for (let i = p - 1; i < n; i++) {
      let sumVP = 0, sumV = 0;
      for (let j = i - p + 1; j <= i; j++) {
        if (high[j] != null && low[j] != null && close[j] != null && volume[j] != null) {
          const tp = (high[j]! + low[j]! + close[j]!) / 3;
          sumVP += tp * volume[j]!;
          sumV += volume[j]!;
        }
      }
      out[i] = sumV > 0 ? sumVP / sumV : null;
    }
    return toResult(out);
  },
};

/* Volume Profile Visible Range */
export const volumeProfileVRDef: IndicatorDefinition = {
  id: 'prof_volumeProfileVR',
  name: 'Volume Profile Visible Range',
  inputs: [],
  outputs: [
    { name: 'vwap', seriesType: 'Line', pane: 'overlay', color: '#8b5cf6', lineWidth: 2 },
  ],
  compute: ({ high, low, close, volume }) => {
    const n = close.length;
    const out = nulls(n);
    let sumTV = 0, sumV = 0;
    for (let i = 0; i < n; i++) {
      if (high[i] == null || low[i] == null || close[i] == null || volume[i] == null) continue;
      const tp = (high[i]! + low[i]! + close[i]!) / 3;
      sumTV += tp * volume[i]!;
      sumV += volume[i]!;
      out[i] = sumV > 0 ? sumTV / sumV : null;
    }
    return toResult(out);
  },
};

/* Volume Profile Session */
export const volumeProfileSessionDef: IndicatorDefinition = {
  id: 'prof_volumeProfileSession',
  name: 'Volume Profile Session',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 24, min: 1 }],
  outputs: [
    { name: 'sessionVwap', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 2 },
  ],
  compute: ({ high, low, close, volume, params }) => {
    const p = clampInt(params.period, 24);
    const n = close.length;
    const out = nulls(n);
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - p + 1);
      let sv = 0, stv = 0;
      for (let j = start; j <= i; j++) {
        if (high[j] != null && low[j] != null && close[j] != null && volume[j] != null) {
          const tp = (high[j]! + low[j]! + close[j]!) / 3;
          stv += tp * volume[j]!;
          sv += volume[j]!;
        }
      }
      out[i] = sv > 0 ? stv / sv : null;
    }
    return toResult(out);
  },
};

/* Session Volume Profile */
export const sessionVolumeProfDef: IndicatorDefinition = {
  id: 'prof_sessionVolumeProfile',
  name: 'Session Volume Profile',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [
    { name: 'profile', seriesType: 'Histogram', pane: 'subpane', color: '#64748b' },
  ],
  compute: ({ volume, params }) => {
    const p = clampInt(params.period, 20);
    return toResult(rollingSum(volume, p));
  },
};

/* Time Price Opportunity (TPO) */
export const tpoDef: IndicatorDefinition = {
  id: 'prof_tpo',
  name: 'Time Price Opportunity',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 30, min: 5 }],
  outputs: [
    { name: 'poc', seriesType: 'Line', pane: 'overlay', color: '#f59e0b', lineWidth: 2 },
    { name: 'valueHigh', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 'valueLow', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
  ],
  compute: ({ high, low, close, params }) => {
    const p = clampInt(params.period, 30, 5);
    const n = close.length;
    const poc = nulls(n), vh = nulls(n), vl = nulls(n);
    for (let i = p - 1; i < n; i++) {
      let hh: number | null = null, ll: number | null = null;
      for (let j = i - p + 1; j <= i; j++) {
        if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
        if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
      }
      if (hh == null || ll == null) continue;
      poc[i] = (hh + ll) / 2;
      const range = hh - ll;
      vh[i] = hh - range * 0.3;
      vl[i] = ll + range * 0.3;
    }
    return toResult(poc, vh, vl);
  },
};

/* Periodic Volume Profile */
export const periodicVolProfDef: IndicatorDefinition = {
  id: 'prof_periodicVolumeProfile',
  name: 'Periodic Volume Profile',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1 }],
  outputs: [{ name: 'avgVol', seriesType: 'Histogram', pane: 'subpane', color: '#a78bfa' }],
  compute: ({ volume, params }) => {
    const p = clampInt(params.period, 20);
    return toResult(computeSmaValues(volume, p));
  },
};

/* Volume Footprint */
export const volumeFootprintDef: IndicatorDefinition = {
  id: 'prof_volumeFootprint',
  name: 'Volume Footprint',
  inputs: [],
  outputs: [
    { name: 'buyVol', seriesType: 'Histogram', pane: 'subpane', color: '#22c55e' },
    { name: 'sellVol', seriesType: 'Histogram', pane: 'subpane', color: '#ef4444' },
  ],
  compute: ({ open, close, volume }) => {
    const n = close.length;
    const buy = nulls(n), sell = nulls(n);
    for (let i = 0; i < n; i++) {
      if (open[i] == null || close[i] == null || volume[i] == null) continue;
      if (close[i]! >= open[i]!) { buy[i] = volume[i]; sell[i] = 0; }
      else { buy[i] = 0; sell[i] = -volume[i]!; }
    }
    return toResult(buy, sell);
  },
};

/* Anchored Volume Profile */
export const anchoredVolProfDef: IndicatorDefinition = {
  id: 'prof_anchoredVolumeProfile',
  name: 'Anchored Volume Profile',
  inputs: [{ name: 'anchor', label: 'Anchor Bar', type: 'number', default: 0, min: 0 }],
  outputs: [{ name: 'vwap', seriesType: 'Line', pane: 'overlay', color: '#06b6d4', lineWidth: 2 }],
  compute: ({ high, low, close, volume, params }) => {
    const anchor = clampInt(params.anchor, 0, 0);
    const n = close.length;
    const out = nulls(n);
    let stv = 0, sv = 0;
    for (let i = anchor; i < n; i++) {
      if (high[i] == null || low[i] == null || close[i] == null || volume[i] == null) continue;
      const tp = (high[i]! + low[i]! + close[i]!) / 3;
      stv += tp * volume[i]!;
      sv += volume[i]!;
      out[i] = sv > 0 ? stv / sv : null;
    }
    return toResult(out);
  },
};

export const allProfiles: IndicatorDefinition[] = [
  volumeProfileFRDef,
  volumeProfileVRDef,
  volumeProfileSessionDef,
  sessionVolumeProfDef,
  tpoDef,
  periodicVolProfDef,
  volumeFootprintDef,
  anchoredVolProfDef,
];
