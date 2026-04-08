import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls, rollingSma } from './_helpers.ts';

export function computeDpoValues(close: readonly (number | null)[], period: number): (number | null)[] {
  const n = close.length;
  const sma = rollingSma(close, period);
  const out = nulls(n);
  const shift = Math.floor(period / 2) + 1;
  for (let i = period - 1; i < n; i++) {
    const shifted = i - shift;
    if (shifted < 0) continue;
    const c = close[shifted];
    const s = sma[i];
    if (c != null && s != null) out[i] = c - s;
  }
  return out;
}

export const dpoDef: IndicatorDefinition = {
  id: 'dpo',
  name: 'Detrended Price Oscillator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 500, step: 1 }],
  outputs: [{ name: 'dpo', seriesType: 'Line', pane: 'subpane', color: '#9c88ff', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 20, 20, 2);
    return { outputs: [computeDpoValues(ctx.close, period)] };
  },
};
