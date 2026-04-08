import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls, rollingEma } from './_helpers.ts';

export function computeTrixValues(close: readonly (number | null)[], period: number): (number | null)[] {
  const e1 = rollingEma(close, period);
  const e2 = rollingEma(e1, period);
  const e3 = rollingEma(e2, period);
  const n = close.length;
  const out = nulls(n);
  for (let i = 1; i < n; i++) {
    const c = e3[i];
    const p = e3[i - 1];
    if (c == null || p == null || p === 0) continue;
    out[i] = ((c - p) / p) * 100;
  }
  return out;
}

export const trixDef: IndicatorDefinition = {
  id: 'trix',
  name: 'TRIX',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 15, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'trix', seriesType: 'Line', pane: 'subpane', color: '#8e44ad', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 15, 15, 1);
    return { outputs: [computeTrixValues(ctx.close, period)] };
  },
};
