import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeAroonValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  period: number,
): { up: (number | null)[]; down: (number | null)[] } {
  const n = high.length;
  const up = nulls(n);
  const down = nulls(n);

  for (let i = period - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    let hhIndex = -1;
    let llIndex = -1;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const h = high[j];
      const l = low[j];
      if (h == null || l == null) {
        valid = -1;
        break;
      }
      valid++;
      if (h >= hh) {
        hh = h;
        hhIndex = j;
      }
      if (l <= ll) {
        ll = l;
        llIndex = j;
      }
    }
    if (valid !== period) continue;
    up[i] = ((period - (i - hhIndex)) / period) * 100;
    down[i] = ((period - (i - llIndex)) / period) * 100;
  }

  return { up, down };
}

export const aroonDef: IndicatorDefinition = {
  id: 'aroon',
  name: 'Aroon',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 25, min: 2, max: 500, step: 1 }],
  outputs: [
    { name: 'up', seriesType: 'Line', pane: 'subpane', color: '#27ae60', lineWidth: 1 },
    { name: 'down', seriesType: 'Line', pane: 'subpane', color: '#c0392b', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 25, 25, 2);
    const { up, down } = computeAroonValues(ctx.high, ctx.low, period);
    return { outputs: [up, down] };
  },
};
