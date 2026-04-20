import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { mapTypicalPrice, nulls, rollingSma } from './_helpers.ts';

export function computeAwesomeValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
): (number | null)[] {
  const n = close.length;
  const mid = mapTypicalPrice(high, low, close);
  const sma5 = rollingSma(mid, 5);
  const sma34 = rollingSma(mid, 34);
  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    const a = sma5[i];
    const b = sma34[i];
    if (a != null && b != null) out[i] = a - b;
  }
  return out;
}

export const awesomeDef: IndicatorDefinition = {
  id: 'awesome',
  name: 'Awesome Oscillator',
  inputs: [],
  outputs: [{ name: 'ao', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(22,160,133,0.5)', base: 0 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    return { outputs: [computeAwesomeValues(ctx.high, ctx.low, ctx.close)] };
  },
};
