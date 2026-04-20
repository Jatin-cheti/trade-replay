import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { nulls } from './_helpers.ts';

export function computePsarValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  step: number,
  maxStep: number,
): (number | null)[] {
  const n = high.length;
  const out = nulls(n);
  if (n < 2) return out;

  let start = -1;
  for (let i = 0; i < n; i++) {
    if (high[i] != null && low[i] != null) {
      start = i;
      break;
    }
  }
  if (start < 0 || start + 1 >= n || high[start + 1] == null || low[start + 1] == null) return out;

  let rising = high[start + 1]! >= high[start]!;
  let af = step;
  let ep = rising ? high[start + 1]! : low[start + 1]!;
  let sar = rising ? low[start]! : high[start]!;
  out[start + 1] = sar;

  for (let i = start + 2; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const prevH = high[i - 1];
    const prevL = low[i - 1];
    if (h == null || l == null || prevH == null || prevL == null) continue;

    sar = sar + af * (ep - sar);
    if (rising) sar = Math.min(sar, prevL, low[i - 2] ?? prevL);
    else sar = Math.max(sar, prevH, high[i - 2] ?? prevH);

    if (rising && l < sar) {
      rising = false;
      sar = ep;
      ep = l;
      af = step;
    } else if (!rising && h > sar) {
      rising = true;
      sar = ep;
      ep = h;
      af = step;
    } else if (rising) {
      if (h > ep) {
        ep = h;
        af = Math.min(maxStep, af + step);
      }
    } else if (l < ep) {
      ep = l;
      af = Math.min(maxStep, af + step);
    }

    out[i] = sar;
  }

  return out;
}

export const psarDef: IndicatorDefinition = {
  id: 'psar',
  name: 'Parabolic SAR',
  inputs: [
    { name: 'step', label: 'Step', type: 'number', default: 0.02, min: 0.001, max: 1, step: 0.001 },
    { name: 'maxStep', label: 'Max Step', type: 'number', default: 0.2, min: 0.01, max: 2, step: 0.01 },
  ],
  outputs: [{ name: 'psar', seriesType: 'Line', pane: 'overlay', color: '#e17055', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const step = Number.isFinite(ctx.params.step) ? ctx.params.step : 0.02;
    const maxStep = Number.isFinite(ctx.params.maxStep) ? ctx.params.maxStep : 0.2;
    return { outputs: [computePsarValues(ctx.high, ctx.low, step, maxStep)] };
  },
};
