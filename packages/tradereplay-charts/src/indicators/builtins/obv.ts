import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { nulls } from './_helpers.ts';

export function computeObvValues(close: readonly (number | null)[], volume: readonly (number | null)[]): (number | null)[] {
  const n = close.length;
  const out = nulls(n);
  let obv = 0;
  for (let i = 1; i < n; i++) {
    const c = close[i];
    const p = close[i - 1];
    const v = volume[i];
    if (c == null || p == null || v == null) continue;
    if (c > p) obv += v;
    else if (c < p) obv -= v;
    out[i] = obv;
  }
  return out;
}

export const obvDef: IndicatorDefinition = {
  id: 'obv',
  name: 'On Balance Volume',
  inputs: [],
  outputs: [{ name: 'obv', seriesType: 'Line', pane: 'subpane', color: '#6ab04c', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    return { outputs: [computeObvValues(ctx.close, ctx.volume)] };
  },
};
