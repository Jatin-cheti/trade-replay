import type { IndicatorDefinition, IndicatorComputeContext, IndicatorResult } from '../types.ts';

/**
 * Compute an N-period Exponential Moving Average of `values`.
 *
 * Uses the standard EMA formula:
 *   EMA[i] = value[i] * k + EMA[i-1] * (1 - k),   k = 2 / (period + 1)
 *
 * The seed value is the simple mean of the first `period` non-null values.
 * Bars before the seed are `null`.
 *
 * @param values  Input series (may contain nulls for missing bars).
 * @param period  Look-back period (≥ 1).
 * @param k       Optional smoothing factor override (Wilder uses 1/period).
 *
 * **Gap handling**: when a null is encountered after the seed, the last valid
 * EMA value is carried forward.  This keeps subsequent bars connected to the
 * indicator rather than producing a null gap.  Consumers that prefer true
 * nulls during gaps should post-process the output.
 */
export function computeEmaValues(
  values: readonly (number | null)[],
  period: number,
  k?: number,
): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period < 1 || n === 0) return out;

  const multiplier = k ?? (2 / (period + 1));

  // Seed the EMA with the SMA of the first `period` non-null values.
  let seedSum = 0;
  let seedCount = 0;
  let seedBarIdx = -1;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v == null) continue;
    seedSum += v;
    seedCount++;
    if (seedCount === period) {
      seedBarIdx = i;
      break;
    }
  }

  if (seedBarIdx < 0) return out; // Not enough non-null data

  let ema = seedSum / period;
  out[seedBarIdx] = ema;

  for (let i = seedBarIdx + 1; i < n; i++) {
    const v = values[i];
    if (v == null) {
      out[i] = ema; // carry forward through gaps
    } else {
      ema = v * multiplier + ema * (1 - multiplier);
      out[i] = ema;
    }
  }

  return out;
}

export const emaDef: IndicatorDefinition = {
  id: 'ema',
  name: 'Exponential Moving Average',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { name: 'ema', seriesType: 'Line', pane: 'overlay', color: '#a29bfe', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = Math.max(1, Math.round(ctx.params.period ?? 20));
    return { outputs: [computeEmaValues(ctx.close, period)] };
  },
};
