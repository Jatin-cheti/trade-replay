import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, mapTypicalPrice, nulls } from './_helpers.ts';

export function computeMfiValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  volume: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = close.length;
  const out = nulls(n);
  const tp = mapTypicalPrice(high, low, close);
  const pos = nulls(n);
  const neg = nulls(n);

  for (let i = 1; i < n; i++) {
    const p = tp[i];
    const prev = tp[i - 1];
    const v = volume[i];
    if (p == null || prev == null || v == null) continue;
    const flow = p * v;
    if (p > prev) pos[i] = flow;
    else if (p < prev) neg[i] = flow;
  }

  for (let i = period; i < n; i++) {
    let pSum = 0;
    let nSum = 0;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (pos[j] == null && neg[j] == null) continue;
      pSum += pos[j] ?? 0;
      nSum += neg[j] ?? 0;
      valid++;
    }
    if (valid === 0) continue;
    out[i] = nSum === 0 ? 100 : 100 - 100 / (1 + pSum / nSum);
  }

  return out;
}

export const mfiDef: IndicatorDefinition = {
  id: 'mfi',
  name: 'Money Flow Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'mfi', seriesType: 'Line', pane: 'subpane', color: '#d63031', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 14, 14, 1);
    return { outputs: [computeMfiValues(ctx.high, ctx.low, ctx.close, ctx.volume, period)] };
  },
};
