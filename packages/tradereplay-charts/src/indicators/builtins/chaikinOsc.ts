import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls, rollingEma } from './_helpers.ts';

export function computeChaikinOscValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  volume: readonly (number | null)[],
  fast: number,
  slow: number,
): (number | null)[] {
  const n = close.length;
  const adl = nulls(n);
  let cumul = 0;
  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    const v = volume[i];
    if (h == null || l == null || c == null || v == null || h === l) continue;
    const mfm = ((c - l) - (h - c)) / (h - l);
    cumul += mfm * v;
    adl[i] = cumul;
  }

  const eFast = rollingEma(adl, fast);
  const eSlow = rollingEma(adl, slow);
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    const f = eFast[i];
    const s = eSlow[i];
    if (f != null && s != null) out[i] = f - s;
  }
  return out;
}

export const chaikinOscDef: IndicatorDefinition = {
  id: 'chaikin_osc',
  name: 'Chaikin Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 3, min: 1, max: 200, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 10, min: 1, max: 200, step: 1 },
  ],
  outputs: [{ name: 'chaikin_osc', seriesType: 'Line', pane: 'subpane', color: '#00a8ff', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const fast = clampInt(ctx.params.fast ?? 3, 3, 1);
    const slow = clampInt(ctx.params.slow ?? 10, 10, 1);
    return { outputs: [computeChaikinOscValues(ctx.high, ctx.low, ctx.close, ctx.volume, fast, slow)] };
  },
};
