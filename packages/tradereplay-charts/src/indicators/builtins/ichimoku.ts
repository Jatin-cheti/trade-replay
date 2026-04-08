import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeIchimokuValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  conv: number,
  base: number,
  spanBPeriod: number,
  displacement: number,
): {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
} {
  const n = close.length;
  const tenkan = nulls(n);
  const kijun = nulls(n);
  const senkouA = nulls(n);
  const senkouB = nulls(n);
  const chikou = nulls(n);

  const calcMid = (i: number, p: number): number | null => {
    if (i < p - 1) return null;
    let hh: number | null = null;
    let ll: number | null = null;
    for (let j = i - p + 1; j <= i; j++) {
      const h = high[j];
      const l = low[j];
      if (h == null || l == null) return null;
      hh = hh == null ? h : Math.max(hh, h);
      ll = ll == null ? l : Math.min(ll, l);
    }
    return hh == null || ll == null ? null : (hh + ll) / 2;
  };

  for (let i = 0; i < n; i++) {
    tenkan[i] = calcMid(i, conv);
    kijun[i] = calcMid(i, base);
    const spanB = calcMid(i, spanBPeriod);
    if (spanB != null && i + displacement < n) senkouB[i + displacement] = spanB;
    if (tenkan[i] != null && kijun[i] != null && i + displacement < n) {
      senkouA[i + displacement] = (tenkan[i]! + kijun[i]!) / 2;
    }
    if (close[i] != null && i - displacement >= 0) chikou[i - displacement] = close[i];
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

export const ichimokuDef: IndicatorDefinition = {
  id: 'ichimoku',
  name: 'Ichimoku Cloud',
  inputs: [
    { name: 'conv', label: 'Conversion', type: 'number', default: 9, min: 1, max: 500, step: 1 },
    { name: 'base', label: 'Base', type: 'number', default: 26, min: 1, max: 500, step: 1 },
    { name: 'spanB', label: 'Span B', type: 'number', default: 52, min: 1, max: 500, step: 1 },
    { name: 'disp', label: 'Displacement', type: 'number', default: 26, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { name: 'tenkan', seriesType: 'Line', pane: 'overlay', color: '#f39c12', lineWidth: 1 },
    { name: 'kijun', seriesType: 'Line', pane: 'overlay', color: '#2980b9', lineWidth: 1 },
    { name: 'senkou_a', seriesType: 'Line', pane: 'overlay', color: '#27ae60', lineWidth: 1 },
    { name: 'senkou_b', seriesType: 'Line', pane: 'overlay', color: '#c0392b', lineWidth: 1 },
    { name: 'chikou', seriesType: 'Line', pane: 'overlay', color: '#8e44ad', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const conv = clampInt(ctx.params.conv ?? 9, 9, 1);
    const base = clampInt(ctx.params.base ?? 26, 26, 1);
    const spanB = clampInt(ctx.params.spanB ?? 52, 52, 1);
    const disp = clampInt(ctx.params.disp ?? 26, 26, 1);
    const { tenkan, kijun, senkouA, senkouB, chikou } = computeIchimokuValues(
      ctx.high,
      ctx.low,
      ctx.close,
      conv,
      base,
      spanB,
      disp,
    );
    return { outputs: [tenkan, kijun, senkouA, senkouB, chikou] };
  },
};
