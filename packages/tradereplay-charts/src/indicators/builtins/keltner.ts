import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, computeAtr, rollingEma } from './_helpers.ts';

export function computeKeltnerValues(
  close: readonly (number | null)[],
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  period: number,
  mult: number,
): { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const middle = rollingEma(close, period);
  const atr = computeAtr(high, low, close, period);
  const n = close.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const m = middle[i];
    const a = atr[i];
    if (m != null && a != null) {
      upper[i] = m + mult * a;
      lower[i] = m - mult * a;
    }
  }
  return { middle, upper, lower };
}

export const keltnerDef: IndicatorDefinition = {
  id: 'keltner',
  name: 'Keltner Channels',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { name: 'mult', label: 'ATR Mult', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [
    { name: 'middle', seriesType: 'Line', pane: 'overlay', color: '#9b59b6', lineWidth: 1 },
    { name: 'upper', seriesType: 'Line', pane: 'overlay', color: '#8e44ad', lineWidth: 1 },
    { name: 'lower', seriesType: 'Line', pane: 'overlay', color: '#8e44ad', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 20, 20, 1);
    const mult = Number.isFinite(ctx.params.mult) ? ctx.params.mult : 2;
    const { middle, upper, lower } = computeKeltnerValues(ctx.close, ctx.high, ctx.low, period, mult);
    return { outputs: [middle, upper, lower] };
  },
};
