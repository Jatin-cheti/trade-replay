import type { IndicatorInstanceId, UTCTimestamp } from '../types';

export interface IndicatorComputeWindow {
  start: number;
  end: number;
}

export interface IndicatorWorkerSource {
  times: UTCTimestamp[];
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

export interface IndicatorWorkerInstance {
  instanceId: IndicatorInstanceId;
  indicatorId: string;
  params: Record<string, number>;
  outputCount: number;
}

export interface IndicatorWorkerRequest {
  requestId: number;
  source: IndicatorWorkerSource;
  window: IndicatorComputeWindow;
  instances: IndicatorWorkerInstance[];
}

export interface IndicatorWorkerResultItem {
  instanceId: IndicatorInstanceId;
  outputs: (number | null)[][];
}

export interface IndicatorWorkerResponse {
  requestId: number;
  window: IndicatorComputeWindow;
  results: IndicatorWorkerResultItem[];
  /** Actual compute duration (ms) inside the worker, for perf telemetry. */
  durationMs?: number;
  error?: string;
}
