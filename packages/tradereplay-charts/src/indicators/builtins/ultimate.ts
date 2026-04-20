import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls } from './_helpers.ts';

export function computeUltimateOscillatorValues(
  high: readonly (number | null)[],
  low: readonly (number | null)[],
  close: readonly (number | null)[],
  shortP: number,
  midP: number,
  longP: number,
): (number | null)[] {
  const n = close.length;
  const bp = nulls(n);
  const tr = nulls(n);
  const out = nulls(n);

  for (let i = 0; i < n; i++) {
    const h = high[i];
    const l = low[i];
    const c = close[i];
    if (h == null || l == null || c == null) continue;
    const pc = i === 0 || close[i - 1] == null ? c : close[i - 1]!;
    const minLow = Math.min(l, pc);
    const maxHigh = Math.max(h, pc);
    bp[i] = c - minLow;
    tr[i] = maxHigh - minLow;
  }

  for (let i = longP - 1; i < n; i++) {
    const calcRatio = (p: number): number | null => {
      let sBp = 0;
      let sTr = 0;
      for (let j = i - p + 1; j <= i; j++) {
        const b = bp[j];
        const t = tr[j];
        if (b == null || t == null) return null;
        sBp += b;
        sTr += t;
      }
      if (sTr === 0) return 0;
      return sBp / sTr;
    };
    const r1 = calcRatio(shortP);
    const r2 = calcRatio(midP);
    const r3 = calcRatio(longP);
    if (r1 == null || r2 == null || r3 == null) continue;
    out[i] = 100 * ((4 * r1 + 2 * r2 + r3) / 7);
  }

  return out;
}

export const ultimateDef: IndicatorDefinition = {
  id: 'ultimate',
  name: 'Ultimate Oscillator',
  inputs: [
    { name: 'short', label: 'Short', type: 'number', default: 7, min: 1, max: 200, step: 1 },
    { name: 'mid', label: 'Mid', type: 'number', default: 14, min: 1, max: 200, step: 1 },
    { name: 'long', label: 'Long', type: 'number', default: 28, min: 1, max: 200, step: 1 },
  ],
  outputs: [{ name: 'ultimate', seriesType: 'Line', pane: 'subpane', color: '#e67e22', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const shortP = clampInt(ctx.params.short ?? 7, 7, 1);
    const midP = clampInt(ctx.params.mid ?? 14, 14, 1);
    const longP = clampInt(ctx.params.long ?? 28, 28, 1);
    return { outputs: [computeUltimateOscillatorValues(ctx.high, ctx.low, ctx.close, shortP, midP, longP)] };
  },
};
