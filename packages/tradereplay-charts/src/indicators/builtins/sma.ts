import type { IndicatorDefinition, IndicatorComputeContext, IndicatorResult } from '../types.ts';

/** Compute an N-period Simple Moving Average of `values`. */
export function computeSmaValues(
  values: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period < 1 || n < period) return out;

  let sum = 0;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v != null) {
      sum += v;
      validCount++;
    }

    if (i >= period) {
      const old = values[i - period];
      if (old != null) {
        sum -= old;
        validCount--;
      }
    }

    if (i >= period - 1 && validCount === period) {
      out[i] = sum / period;
    }
  }

  return out;
}

export const smaDef: IndicatorDefinition = {
  id: 'sma',
  name: 'Simple Moving Average',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { name: 'sma', seriesType: 'Line', pane: 'overlay', color: '#f7b731', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = Math.max(1, Math.round(ctx.params.period ?? 20));
    return { outputs: [computeSmaValues(ctx.close, period)] };
  },
};
