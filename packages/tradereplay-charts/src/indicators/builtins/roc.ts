import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeRocValues(close: readonly (number | null)[], period: number): (number | null)[] {
  const n = close.length;
  const out = nulls(n);
  for (let i = period; i < n; i++) {
    const curr = close[i];
    const prev = close[i - period];
    if (curr == null || prev == null || prev === 0) continue;
    out[i] = ((curr - prev) / prev) * 100;
  }
  return out;
}

export const rocDef: IndicatorDefinition = {
  id: 'roc',
  name: 'Rate of Change',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 12, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'roc', seriesType: 'Line', pane: 'subpane', color: '#6c5ce7', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 12, 12, 1);
    return { outputs: [computeRocValues(ctx.close, period)] };
  },
};
