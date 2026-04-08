import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeWilliamsRValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = close.length;
  const out = nulls(n);
  for (let i = period - 1; i < n; i++) {
    let hh: number | null = null;
    let ll: number | null = null;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const h = high[j];
      const l = low[j];
      if (h == null || l == null) {
        valid = -1;
        break;
      }
      valid++;
      hh = hh == null ? h : Math.max(hh, h);
      ll = ll == null ? l : Math.min(ll, l);
    }
    const c = close[i];
    if (valid !== period || hh == null || ll == null || c == null) continue;
    const range = hh - ll;
    out[i] = range === 0 ? 0 : ((hh - c) / range) * -100;
  }
  return out;
}

export const williamsRDef: IndicatorDefinition = {
  id: 'williams_r',
  name: 'Williams %R',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'williams_r', seriesType: 'Line', pane: 'subpane', color: '#2d3436', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 14, 14, 1);
    return { outputs: [computeWilliamsRValues(ctx.high, ctx.low, ctx.close, period)] };
  },
};
