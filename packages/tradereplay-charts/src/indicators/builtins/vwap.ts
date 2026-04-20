import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { mapTypicalPrice, nulls } from './_helpers.ts';

export function computeVwapValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  volume: readonly (number | null)[],
): (number | null)[] {
  const n = close.length;
  const out = nulls(n);
  const tp = mapTypicalPrice(high, low, close);

  let cumulPV = 0;
  let cumulV = 0;
  for (let i = 0; i < n; i++) {
    const p = tp[i];
    const v = volume[i];
    if (p == null || v == null) continue;
    cumulPV += p * v;
    cumulV += v;
    if (cumulV > 0) out[i] = cumulPV / cumulV;
  }
  return out;
}

export const vwapDef: IndicatorDefinition = {
  id: 'vwap',
  name: 'Volume Weighted Average Price',
  inputs: [],
  outputs: [{ name: 'vwap', seriesType: 'Line', pane: 'overlay', color: '#1abc9c', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    return { outputs: [computeVwapValues(ctx.high, ctx.low, ctx.close, ctx.volume)] };
  },
};
