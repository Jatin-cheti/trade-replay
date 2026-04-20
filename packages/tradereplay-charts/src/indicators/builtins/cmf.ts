import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeCmfValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  volume: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = close.length;
  const mfv = nulls(n);
  const out = nulls(n);

  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    const v = volume[i];
    if (h == null || l == null || c == null || v == null || h === l) continue;
    const mfm = ((c - l) - (h - c)) / (h - l);
    mfv[i] = mfm * v;
  }

  for (let i = period - 1; i < n; i++) {
    let num = 0;
    let den = 0;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = volume[j];
      const m = mfv[j];
      if (v == null || m == null) {
        valid = -1;
        break;
      }
      num += m;
      den += v;
      valid++;
    }
    if (valid === period && den !== 0) out[i] = num / den;
  }

  return out;
}

export const cmfDef: IndicatorDefinition = {
  id: 'cmf',
  name: 'Chaikin Money Flow',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'cmf', seriesType: 'Line', pane: 'subpane', color: '#22a6b3', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 20, 20, 1);
    return { outputs: [computeCmfValues(ctx.high, ctx.low, ctx.close, ctx.volume, period)] };
  },
};
