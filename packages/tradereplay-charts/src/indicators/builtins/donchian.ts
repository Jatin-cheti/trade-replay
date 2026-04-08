import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, rollingExtrema } from './_helpers.ts';

export function computeDonchianValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  period: number,
): { upper: (number | null)[]; lower: (number | null)[]; mid: (number | null)[] } {
  const upper = rollingExtrema(high, period, true);
  const lower = rollingExtrema(low, period, false);
  const n = high.length;
  const mid: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const u = upper[i];
    const l = lower[i];
    if (u != null && l != null) mid[i] = (u + l) / 2;
  }
  return { upper, lower, mid };
}

export const donchianDef: IndicatorDefinition = {
  id: 'donchian',
  name: 'Donchian Channels',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [
    { name: 'upper', seriesType: 'Line', pane: 'overlay', color: '#2ecc71', lineWidth: 1 },
    { name: 'lower', seriesType: 'Line', pane: 'overlay', color: '#e74c3c', lineWidth: 1 },
    { name: 'mid', seriesType: 'Line', pane: 'overlay', color: '#95a5a6', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 20, 20, 1);
    const { upper, lower, mid } = computeDonchianValues(ctx.high, ctx.low, period);
    return { outputs: [upper, lower, mid] };
  },
};
