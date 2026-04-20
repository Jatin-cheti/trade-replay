import type { IndicatorDefinition, IndicatorComputeContext, IndicatorResult } from '../types.ts';

/**
 * Compute an N-period RSI (Wilder's Relative Strength Index).
 *
 * Algorithm:
 *   1. Compute per-bar change = close[i] - close[i-1].
 *   2. Seed: avgGain = mean of first `period` positive changes,
 *            avgLoss = mean of first `period` negative changes (absolute value).
 *      The seed bar is at index `period` (requires `period + 1` non-null closes).
 *   3. Wilder smooth: avgGain[i] = (avgGain[i-1] * (period-1) + gain[i]) / period.
 *   4. RSI = 100 - (100 / (1 + avgGain / avgLoss)).
 *      When avgLoss === 0 → RSI = 100 (all gains period).
 */
export function computeRsiValues(
  close: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = close.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period < 1 || n < period + 1) return out;

  // Collect non-null closes in order with their original indices.
  const nonNull: Array<{ i: number; v: number }> = [];
  for (let i = 0; i < n; i++) {
    const v = close[i];
    if (v != null) nonNull.push({ i, v });
  }

  if (nonNull.length < period + 1) return out;

  // Seed: average gain/loss over first `period` intervals.
  let avgGain = 0;
  let avgLoss = 0;
  for (let j = 1; j <= period; j++) {
    const delta = nonNull[j].v - nonNull[j - 1].v;
    if (delta > 0) avgGain += delta;
    else avgLoss -= delta; // abs
  }
  avgGain /= period;
  avgLoss /= period;

  const firstRsiBarOrigIdx = nonNull[period].i;
  out[firstRsiBarOrigIdx] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder smooth for subsequent bars.
  for (let j = period + 1; j < nonNull.length; j++) {
    const delta = nonNull[j].v - nonNull[j - 1].v;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[nonNull[j].i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

export const rsiDef: IndicatorDefinition = {
  id: 'rsi',
  name: 'Relative Strength Index',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 100, step: 1 },
  ],
  outputs: [
    { name: 'rsi', seriesType: 'Line', pane: 'subpane', color: '#e84393', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const period = Math.max(2, Math.round(ctx.params.period ?? 14));
    return { outputs: [computeRsiValues(ctx.close, period)] };
  },
};
