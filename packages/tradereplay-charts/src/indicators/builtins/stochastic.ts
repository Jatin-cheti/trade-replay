import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, rollingSma } from './_helpers.ts';

export function computeStochasticValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  period: number,
  smoothD: number,
): { k: (number | null)[]; d: (number | null)[] } {
  const n = close.length;
  const k: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let hh: number | null = null;
    let ll: number | null = null;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const h = high[j];
      const l = low[j];
      if (h == null || l == null) {
        valid = -1;
        break;
      }
      valid++;
      hh = hh == null ? h : Math.max(hh, h);
      ll = ll == null ? l : Math.min(ll, l);
    }
    const c = close[i];
    if (valid !== period || hh == null || ll == null || c == null) continue;
    const range = hh - ll;
    k[i] = range === 0 ? 50 : ((c - ll) / range) * 100;
  }

  const d = rollingSma(k, smoothD);
  return { k, d };
}

export const stochasticDef: IndicatorDefinition = {
  id: 'stochastic',
  name: 'Stochastic Oscillator',
  inputs: [
    { name: 'period', label: '%K Period', type: 'number', default: 14, min: 1, max: 500, step: 1 },
    { name: 'smoothD', label: '%D Period', type: 'number', default: 3, min: 1, max: 100, step: 1 },
  ],
  outputs: [
    { name: 'k', seriesType: 'Line', pane: 'subpane', color: '#0984e3', lineWidth: 1 },
    { name: 'd', seriesType: 'Line', pane: 'subpane', color: '#fdcb6e', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 14, 14, 1);
    const smoothD = clampInt(ctx.params.smoothD ?? 3, 3, 1);
    const { k, d } = computeStochasticValues(ctx.high, ctx.low, ctx.close, period, smoothD);
    return { outputs: [k, d] };
  },
};
