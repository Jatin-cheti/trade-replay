import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, computeAtr } from './_helpers.ts';

export function computeAtrValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  period: number,
): (number | null)[] {
  return computeAtr(high, low, close, period);
}

export const atrDef: IndicatorDefinition = {
  id: 'atr',
  name: 'Average True Range',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'atr', seriesType: 'Line', pane: 'subpane', color: '#16a085', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 14, 14, 1);
    return { outputs: [computeAtrValues(ctx.high, ctx.low, ctx.close, period)] };
  },
};
