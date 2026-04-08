import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, mapTypicalPrice, rollingSma } from './_helpers.ts';

export function computeCciValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const tp = mapTypicalPrice(high, low, close);
  const sma = rollingSma(tp, period);
  const n = close.length;
  const out: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    const mean = sma[i];
    if (mean == null || tp[i] == null) continue;
    let md = 0;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = tp[j];
      if (v == null) {
        valid = -1;
        break;
      }
      md += Math.abs(v - mean);
      valid++;
    }
    if (valid !== period) continue;
    md /= period;
    out[i] = md === 0 ? 0 : (tp[i]! - mean) / (0.015 * md);
  }

  return out;
}

export const cciDef: IndicatorDefinition = {
  id: 'cci',
  name: 'Commodity Channel Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'cci', seriesType: 'Line', pane: 'subpane', color: '#00cec9', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 20, 20, 1);
    return { outputs: [computeCciValues(ctx.high, ctx.low, ctx.close, period)] };
  },
};
