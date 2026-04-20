import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computePivotValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  period: number,
): { pp: (number | null)[]; r1: (number | null)[]; s1: (number | null)[]; r2: (number | null)[]; s2: (number | null)[] } {
  const n = close.length;
  const pp = nulls(n);
  const r1 = nulls(n);
  const s1 = nulls(n);
  const r2 = nulls(n);
  const s2 = nulls(n);

  for (let i = period - 1; i < n; i++) {
    let hh: number | null = null;
    let ll: number | null = null;
    let c: number | null = null;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const h = high[j];
      const l = low[j];
      const cl = close[j];
      if (h == null || l == null || cl == null) {
        valid = -1;
        break;
      }
      valid++;
      hh = hh == null ? h : Math.max(hh, h);
      ll = ll == null ? l : Math.min(ll, l);
      c = cl;
    }
    if (valid !== period || hh == null || ll == null || c == null) continue;
    const p = (hh + ll + c) / 3;
    pp[i] = p;
    r1[i] = 2 * p - ll;
    s1[i] = 2 * p - hh;
    r2[i] = p + (hh - ll);
    s2[i] = p - (hh - ll);
  }

  return { pp, r1, s1, r2, s2 };
}

export const pivotDef: IndicatorDefinition = {
  id: 'pivot',
  name: 'Pivot Points (Rolling Classic)',
  inputs: [{ name: 'period', label: 'Rolling Period', type: 'number', default: 24, min: 2, max: 500, step: 1 }],
  outputs: [
    { name: 'pp', seriesType: 'Line', pane: 'overlay', color: '#f5cd79', lineWidth: 1 },
    { name: 'r1', seriesType: 'Line', pane: 'overlay', color: '#ff6b6b', lineWidth: 1 },
    { name: 's1', seriesType: 'Line', pane: 'overlay', color: '#1dd1a1', lineWidth: 1 },
    { name: 'r2', seriesType: 'Line', pane: 'overlay', color: '#ee5253', lineWidth: 1 },
    { name: 's2', seriesType: 'Line', pane: 'overlay', color: '#10ac84', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 24, 24, 2);
    const { pp, r1, s1, r2, s2 } = computePivotValues(ctx.high, ctx.low, ctx.close, period);
    return { outputs: [pp, r1, s1, r2, s2] };
  },
};
