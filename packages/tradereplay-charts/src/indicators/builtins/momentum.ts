import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeMomentumValues(close: readonly (number | null)[], period: number): (number | null)[] {
  const n = close.length;
  const out = nulls(n);
  for (let i = period; i < n; i++) {
    const c = close[i];
    const p = close[i - period];
    if (c != null && p != null) out[i] = c - p;
  }
  return out;
}

export const momentumDef: IndicatorDefinition = {
  id: 'momentum',
  name: 'Momentum',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 10, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'momentum', seriesType: 'Line', pane: 'subpane', color: '#e84393', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 10, 10, 1);
    return { outputs: [computeMomentumValues(ctx.close, period)] };
  },
};
