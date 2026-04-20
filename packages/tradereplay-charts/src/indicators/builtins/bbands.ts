import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, rollingSma, rollingStdDev } from './_helpers.ts';

export function computeBbandsValues(values: readonly (number | null)[], period: number, mult: number): {
  basis: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const basis = rollingSma(values, period);
  const std = rollingStdDev(values, period);
  const n = values.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const b = basis[i];
    const s = std[i];
    if (b != null && s != null) {
      upper[i] = b + mult * s;
      lower[i] = b - mult * s;
    }
  }
  return { basis, upper, lower };
}

export const bbandsDef: IndicatorDefinition = {
  id: 'bbands',
  name: 'Bollinger Bands',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { name: 'mult', label: 'StdDev Mult', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [
    { name: 'basis', seriesType: 'Line', pane: 'overlay', color: '#f1c40f', lineWidth: 1 },
    { name: 'upper', seriesType: 'Line', pane: 'overlay', color: '#3498db', lineWidth: 1 },
    { name: 'lower', seriesType: 'Line', pane: 'overlay', color: '#3498db', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 20, 20, 1);
    const mult = Number.isFinite(ctx.params.mult) ? ctx.params.mult : 2;
    const { basis, upper, lower } = computeBbandsValues(ctx.close, period, mult);
    return { outputs: [basis, upper, lower] };
  },
};
