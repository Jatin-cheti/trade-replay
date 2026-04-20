import type { IndicatorDefinition, IndicatorComputeContext, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';

/**
 * Compute MACD (Moving Average Convergence/Divergence).
 *
 * Outputs (in order):
 *   0 — MACD line   = EMA(fast) − EMA(slow)
 *   1 — Signal line = EMA(signal) of MACD line
 *   2 — Histogram   = MACD line − Signal line
 *
 * Bars without a valid MACD or signal value are `null`.
 */
export function computeMacdValues(
  close: readonly (number | null)[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
} {
  const n = close.length;

  const fastEma = computeEmaValues(close, fastPeriod);
  const slowEma = computeEmaValues(close, slowPeriod);

  // MACD line is only valid where both EMAs are valid.
  const macdLine: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f != null && s != null) macdLine[i] = f - s;
  }

  // Signal is EMA of the MACD line values.
  const signalLine = computeEmaValues(macdLine, signalPeriod);

  // Histogram: valid only where both MACD line and signal are valid.
  const histogram: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const m = macdLine[i];
    const s = signalLine[i];
    if (m != null && s != null) histogram[i] = m - s;
  }

  return { macdLine, signalLine, histogram };
}

export const macdDef: IndicatorDefinition = {
  id: 'macd',
  name: 'MACD',
  inputs: [
    { name: 'fast',   label: 'Fast Period',   type: 'number', default: 12, min: 1, max: 200, step: 1 },
    { name: 'slow',   label: 'Slow Period',   type: 'number', default: 26, min: 1, max: 200, step: 1 },
    { name: 'signal', label: 'Signal Period', type: 'number', default: 9,  min: 1, max: 200, step: 1 },
  ],
  outputs: [
    {
      name: 'macd',
      seriesType: 'Line',
      pane: 'subpane',
      color: '#00d1ff',
      lineWidth: 1,
    },
    {
      name: 'signal',
      seriesType: 'Line',
      pane: 'subpane',
      color: '#ff9f43',
      lineWidth: 1,
    },
    {
      name: 'histogram',
      seriesType: 'Histogram',
      pane: 'subpane',
      color: 'rgba(0,209,255,0.5)',
      base: 0,
    },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const fast   = Math.max(1, Math.round(ctx.params.fast   ?? 12));
    const slow   = Math.max(1, Math.round(ctx.params.slow   ?? 26));
    const signal = Math.max(1, Math.round(ctx.params.signal ?? 9));
    const { macdLine, signalLine, histogram } = computeMacdValues(
      ctx.close, fast, slow, signal,
    );
    return { outputs: [macdLine, signalLine, histogram] };
  },
};
