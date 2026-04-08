import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, computeTrueRange, nulls, rollingEma } from './_helpers.ts';

export function computeAdxValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  period: number,
): { plusDi: (number | null)[]; minusDi: (number | null)[]; adx: (number | null)[] } {
  const n = close.length;
  const plusDM = nulls(n);
  const minusDM = nulls(n);

  for (let i = 1; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const ph = high[i - 1];
    const pl = low[i - 1];
    if (h == null || l == null || ph == null || pl == null) continue;
    const up = h - ph;
    const down = pl - l;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
  }

  const tr = computeTrueRange(high, low, close);
  const smTr = rollingEma(tr, period, 1 / period);
  const smPlus = rollingEma(plusDM, period, 1 / period);
  const smMinus = rollingEma(minusDM, period, 1 / period);
  const plusDi = nulls(n);
  const minusDi = nulls(n);
  const dx = nulls(n);

  for (let i = 0; i < n; i++) {
    const t = smTr[i];
    const p = smPlus[i];
    const m = smMinus[i];
    if (t == null || p == null || m == null || t === 0) continue;
    plusDi[i] = (100 * p) / t;
    minusDi[i] = (100 * m) / t;
    const sum = plusDi[i]! + minusDi[i]!;
    if (sum !== 0) dx[i] = (100 * Math.abs(plusDi[i]! - minusDi[i]!)) / sum;
  }

  const adx = rollingEma(dx, period, 1 / period);
  return { plusDi, minusDi, adx };
}

export const adxDef: IndicatorDefinition = {
  id: 'adx',
  name: 'ADX',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
  outputs: [
    { name: 'plus_di', seriesType: 'Line', pane: 'subpane', color: '#2ecc71', lineWidth: 1 },
    { name: 'minus_di', seriesType: 'Line', pane: 'subpane', color: '#e74c3c', lineWidth: 1 },
    { name: 'adx', seriesType: 'Line', pane: 'subpane', color: '#f1c40f', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 14, 14, 1);
    const { plusDi, minusDi, adx } = computeAdxValues(ctx.high, ctx.low, ctx.close, period);
    return { outputs: [plusDi, minusDi, adx] };
  },
};
