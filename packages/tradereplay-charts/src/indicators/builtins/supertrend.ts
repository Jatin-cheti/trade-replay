import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, computeAtr, nulls } from './_helpers.ts';

export function computeSupertrendValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  period: number,
  mult: number,
): { line: (number | null)[]; direction: (number | null)[] } {
  const n = close.length;
  const atr = computeAtr(high, low, close, period);
  const line = nulls(n);
  const direction = nulls(n);
  const fub = nulls(n);
  const flb = nulls(n);

  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    const a = atr[i];
    if (h == null || l == null || c == null || a == null) continue;

    const hl2 = (h + l) / 2;
    const bub = hl2 + mult * a;
    const blb = hl2 - mult * a;

    if (i === 0 || fub[i - 1] == null || flb[i - 1] == null || close[i - 1] == null) {
      fub[i] = bub;
      flb[i] = blb;
      direction[i] = 1;
      line[i] = flb[i];
      continue;
    }

    const prevFub = fub[i - 1]!;
    const prevFlb = flb[i - 1]!;
    const prevClose = close[i - 1]!;

    fub[i] = bub < prevFub || prevClose > prevFub ? bub : prevFub;
    flb[i] = blb > prevFlb || prevClose < prevFlb ? blb : prevFlb;

    const prevDir = direction[i - 1] == null ? 1 : direction[i - 1]!;
    const dir = c > fub[i]! ? 1 : c < flb[i]! ? -1 : prevDir;
    direction[i] = dir;
    line[i] = dir > 0 ? flb[i] : fub[i];
  }

  return { line, direction };
}

export const supertrendDef: IndicatorDefinition = {
  id: 'supertrend',
  name: 'Supertrend',
  inputs: [
    { name: 'period', label: 'ATR Period', type: 'number', default: 10, min: 1, max: 500, step: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 3, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [
    { name: 'line', seriesType: 'Line', pane: 'overlay', color: '#00b894', lineWidth: 1 },
    { name: 'direction', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(0,184,148,0.45)', base: 0 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = clampInt(ctx.params.period ?? 10, 10, 1);
    const mult = Number.isFinite(ctx.params.mult) ? ctx.params.mult : 3;
    const { line, direction } = computeSupertrendValues(ctx.high, ctx.low, ctx.close, period, mult);
    return { outputs: [line, direction] };
  },
};
