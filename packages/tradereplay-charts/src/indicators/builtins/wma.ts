import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeWmaValues(values: readonly (number | null)[], period: number): (number | null)[] {
  const n = values.length;
  const out = nulls(n);
  if (period < 1 || n < period) return out;
  const denom = (period * (period + 1)) / 2;

  for (let i = period - 1; i < n; i++) {
    let weighted = 0;
    let valid = 0;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) {
        valid = -1;
        break;
      }
      weighted += v * (j + 1);
      valid++;
    }
    if (valid === period) out[i] = weighted / denom;
  }

  return out;
}

export const wmaDef: IndicatorDefinition = {
  id: 'wma',
  name: 'Weighted Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'wma', seriesType: 'Line', pane: 'overlay', color: '#f39c12', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 20, 20, 1);
    return { outputs: [computeWmaValues(ctx.close, period)] };
  },
};
