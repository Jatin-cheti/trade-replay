/**
 * Core types for the indicator framework.
 *
 * Indicators are pure functions: given OHLCV arrays aligned to the shared
 * TimeIndex they produce one or more output series (also aligned to that
 * same TimeIndex, with `null` for bars where the indicator has no value due
 * to look-back requirements).
 */

/** Opaque indicator identifier used in the registry (e.g. 'sma', 'rsi'). */
export type IndicatorId = string;

/** Opaque identifier for a live indicator instance on a specific chart. */
export type IndicatorInstanceId = string;

/** Seconds-since-epoch timestamp — mirrors the type in createChart.ts. */
export type UTCTimestamp = number;

// ─── Input parameter spec ─────────────────────────────────────────────────────

export interface IndicatorInputSpec {
  /** Programmatic key — used as key in `params` record. */
  name: string;
  /** Human-readable label for future UI. */
  label: string;
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

// ─── Output series spec ───────────────────────────────────────────────────────

export type IndicatorSeriesType = 'Line' | 'Histogram';
export type IndicatorPanePlacement = 'overlay' | 'subpane';

export interface IndicatorOutputSpec {
  /** Programmatic name for this output series (e.g. 'macd', 'signal'). */
  name: string;
  seriesType: IndicatorSeriesType;
  /** 'overlay' → rendered in main price pane; 'subpane' → own pane below. */
  pane: IndicatorPanePlacement;
  color: string;
  lineWidth?: number;
  /** Zero line for Histogram series. Defaults to 0. */
  base?: number;
}

// ─── Compute context & result ─────────────────────────────────────────────────

/**
 * Passed to `IndicatorDefinition.compute()`.
 *
 * All arrays are aligned to the same TimeIndex: `times[i]`, `close[i]`, etc.
 * correspond to the same bar.  A `null` entry means data is missing for that
 * bar (sparse series or calendar gap).
 */
export interface IndicatorComputeContext {
  times: readonly UTCTimestamp[];
  open: readonly (number | null)[];
  high: readonly (number | null)[];
  low: readonly (number | null)[];
  close: readonly (number | null)[];
  volume: readonly (number | null)[];
  /** Resolved parameter values (key = IndicatorInputSpec.name). */
  params: Record<string, number>;
}

/**
 * One entry per `IndicatorDefinition.outputs` spec.
 * Each value is either a number or `null` (look-back period not yet satisfied).
 * Must be the same length as `ctx.times`.
 */
export type IndicatorOutputSeries = (number | null)[];

export interface IndicatorResult {
  /** Parallel to `IndicatorDefinition.outputs`. */
  outputs: IndicatorOutputSeries[];
}

// ─── Indicator definition ─────────────────────────────────────────────────────

export interface IndicatorDefinition {
  id: IndicatorId;
  /** Human-readable name (e.g. 'Simple Moving Average'). */
  name: string;
  inputs: IndicatorInputSpec[];
  outputs: IndicatorOutputSpec[];
  compute(ctx: IndicatorComputeContext): IndicatorResult;
}
