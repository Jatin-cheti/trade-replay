import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

/** Smoothed Moving Average (Wilder's) — equivalent to EMA with k = 1/period */
function smma(src: readonly Num[], period: number): Num[] {
  const n = src.length;
  const out = nulls(n);
  if (period < 1 || n === 0) return out;

  // seed with SMA of first `period` valid values
  let sum = 0;
  let count = 0;
  let seeded = false;
  let prev = 0;

  for (let i = 0; i < n; i++) {
    const v = src[i];
    if (v == null) continue;
    if (!seeded) {
      sum += v;
      count++;
      if (count === period) {
        prev = sum / period;
        out[i] = prev;
        seeded = true;
      }
    } else {
      prev = (prev * (period - 1) + v) / period;
      out[i] = prev;
    }
  }
  return out;
}

/** Shift array forward by `offset` bars (fill leading with null) */
function shiftForward(src: Num[], offset: number): Num[] {
  const n = src.length;
  const out = nulls(n);
  for (let i = 0; i < n - offset; i++) {
    out[i + offset] = src[i];
  }
  return out;
}

/* ── Fractals ─────────────────────────────────────────────────────────── */

export const fractalDef: IndicatorDefinition = {
  id: 'fractal',
  name: 'Fractals',
  inputs: [
    { name: 'period', label: 'Bars', type: 'number', default: 2, min: 1, max: 10, step: 1 },
  ],
  outputs: [
    { name: 'up', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 2 },
    { name: 'down', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 2 },
  ],
  compute({ high, low, params }) {
    const n = high.length;
    const bars = clampInt(params.period, 2, 1);
    const up = nulls(n);
    const down = nulls(n);

    for (let i = bars; i < n - bars; i++) {
      const h = high[i];
      const l = low[i];
      if (h == null || l == null) continue;

      let isUp = true;
      let isDown = true;

      for (let j = 1; j <= bars; j++) {
        const hb = high[i - j];
        const ha = high[i + j];
        const lb = low[i - j];
        const la = low[i + j];

        if (hb == null || ha == null) isUp = false;
        else if (h < hb || h < ha) isUp = false;

        if (lb == null || la == null) isDown = false;
        else if (l > lb || l > la) isDown = false;
      }

      if (isUp) up[i] = h;
      if (isDown) down[i] = l;
    }

    return toResult(up, down);
  },
};

/* ── Williams Alligator ──────────────────────────────────────────────── */

export const alligatorDef: IndicatorDefinition = {
  id: 'alligator',
  name: 'Williams Alligator',
  inputs: [
    { name: 'jawLen', label: 'Jaw Length', type: 'number', default: 13, min: 1 },
    { name: 'jawOff', label: 'Jaw Offset', type: 'number', default: 8, min: 0 },
    { name: 'teethLen', label: 'Teeth Length', type: 'number', default: 8, min: 1 },
    { name: 'teethOff', label: 'Teeth Offset', type: 'number', default: 5, min: 0 },
    { name: 'lipsLen', label: 'Lips Length', type: 'number', default: 5, min: 1 },
    { name: 'lipsOff', label: 'Lips Offset', type: 'number', default: 3, min: 0 },
  ],
  outputs: [
    { name: 'jaw', seriesType: 'Line', pane: 'overlay', color: '#3b82f6', lineWidth: 1 },
    { name: 'teeth', seriesType: 'Line', pane: 'overlay', color: '#ef4444', lineWidth: 1 },
    { name: 'lips', seriesType: 'Line', pane: 'overlay', color: '#22c55e', lineWidth: 1 },
  ],
  compute({ high, low, params }) {
    const n = high.length;
    const median = nulls(n);
    for (let i = 0; i < n; i++) {
      const h = high[i];
      const l = low[i];
      if (h != null && l != null) median[i] = (h + l) / 2;
    }

    const jaw = shiftForward(smma(median, clampInt(params.jawLen, 13)), clampInt(params.jawOff, 8, 0));
    const teeth = shiftForward(smma(median, clampInt(params.teethLen, 8)), clampInt(params.teethOff, 5, 0));
    const lips = shiftForward(smma(median, clampInt(params.lipsLen, 5)), clampInt(params.lipsOff, 3, 0));

    return toResult(jaw, teeth, lips);
  },
};

/* ── Gator Oscillator ────────────────────────────────────────────────── */

export const gatorDef: IndicatorDefinition = {
  id: 'gator',
  name: 'Gator Oscillator',
  inputs: [
    { name: 'jawLen', label: 'Jaw Length', type: 'number', default: 13, min: 1 },
    { name: 'jawOff', label: 'Jaw Offset', type: 'number', default: 8, min: 0 },
    { name: 'teethLen', label: 'Teeth Length', type: 'number', default: 8, min: 1 },
    { name: 'teethOff', label: 'Teeth Offset', type: 'number', default: 5, min: 0 },
    { name: 'lipsLen', label: 'Lips Length', type: 'number', default: 5, min: 1 },
    { name: 'lipsOff', label: 'Lips Offset', type: 'number', default: 3, min: 0 },
  ],
  outputs: [
    { name: 'upper', seriesType: 'Histogram', pane: 'subpane', color: '#22c55e' },
    { name: 'lower', seriesType: 'Histogram', pane: 'subpane', color: '#ef4444' },
  ],
  compute({ high, low, params }) {
    const n = high.length;
    const median = nulls(n);
    for (let i = 0; i < n; i++) {
      const h = high[i];
      const l = low[i];
      if (h != null && l != null) median[i] = (h + l) / 2;
    }

    const jaw = shiftForward(smma(median, clampInt(params.jawLen, 13)), clampInt(params.jawOff, 8, 0));
    const teeth = shiftForward(smma(median, clampInt(params.teethLen, 8)), clampInt(params.teethOff, 5, 0));
    const lips = shiftForward(smma(median, clampInt(params.lipsLen, 5)), clampInt(params.lipsOff, 3, 0));

    const upper = nulls(n);
    const lower = nulls(n);

    for (let i = 0; i < n; i++) {
      if (jaw[i] != null && teeth[i] != null)
        upper[i] = Math.abs(jaw[i]! - teeth[i]!);
      if (teeth[i] != null && lips[i] != null)
        lower[i] = -Math.abs(teeth[i]! - lips[i]!);
    }

    return toResult(upper, lower);
  },
};

/* ── Market Facilitation Index (Williams) ────────────────────────────── */

export const mfiWilliamsDef: IndicatorDefinition = {
  id: 'mfi_williams',
  name: 'Market Facilitation Index',
  inputs: [],
  outputs: [
    { name: 'mfi', seriesType: 'Histogram', pane: 'subpane', color: '#a78bfa' },
  ],
  compute({ high, low, volume }) {
    const n = high.length;
    const out = nulls(n);

    for (let i = 0; i < n; i++) {
      const h = high[i];
      const l = low[i];
      const v = volume[i];
      if (h == null || l == null || v == null || v === 0) continue;
      out[i] = (h - l) / v;
    }

    return toResult(out);
  },
};
