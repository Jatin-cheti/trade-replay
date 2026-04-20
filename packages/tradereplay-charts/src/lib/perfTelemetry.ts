/**
 * perfTelemetry.ts — opt-in chart render/compute perf instrumentation.
 *
 * Enabled at runtime by setting `window.__TRADEREPLAY_PERF_DEBUG__ = true`
 * in the browser console, OR at chart creation via `{ perfDebug: true }`.
 *
 * Output format (one log line per 5 s):
 *   [PERF_DEBUG] chart telemetry — render avg=4.21ms p95=12.30ms  |  overlay avg=0.82ms p95=2.10ms  |  indicatorCompute avg=18.70ms p95=28.40ms
 */

const FLUSH_INTERVAL_MS = 5_000;
const MAX_SAMPLES = 200;

class PerfBucket {
  private samples: number[] = [];

  record(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  stats(): { count: number; avg: number; p95: number; max: number } {
    const n = this.samples.length;
    if (n === 0) return { count: 0, avg: 0, p95: 0, max: 0 };
    const sorted = this.samples.slice().sort((a, b) => a - b);
    const p95Idx = Math.min(n - 1, Math.floor(n * 0.95));
    const sum = this.samples.reduce((s, v) => s + v, 0);
    return {
      count: n,
      avg: sum / n,
      p95: sorted[p95Idx],
      max: sorted[n - 1],
    };
  }

  reset(): void {
    this.samples = [];
  }
}

export class PerfTelemetry {
  private buckets = new Map<string, PerfBucket>();
  private lastFlushAt = 0;

  record(metric: string, durationMs: number): void {
    let bucket = this.buckets.get(metric);
    if (!bucket) {
      bucket = new PerfBucket();
      this.buckets.set(metric, bucket);
    }
    bucket.record(durationMs);
    this.maybeFlush();
  }

  /** Force an immediate flush (ignores the 5 s throttle). */
  flush(): void {
    const chunks: string[] = [];
    for (const [metric, bucket] of this.buckets) {
      const s = bucket.stats();
      if (s.count === 0) continue;
      chunks.push(
        `${metric} avg=${s.avg.toFixed(2)}ms p95=${s.p95.toFixed(2)}ms max=${s.max.toFixed(2)}ms (n=${s.count})`,
      );
    }
    if (chunks.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[PERF_DEBUG] chart telemetry — ${chunks.join('  |  ')}`);
    }
    this.lastFlushAt = Date.now();
  }

  private maybeFlush(): void {
    const now = Date.now();
    if (now - this.lastFlushAt >= FLUSH_INTERVAL_MS) {
      this.flush();
    }
  }
}

// ── Singleton resolution ───────────────────────────────────────────────────────
//
// A single PerfTelemetry instance is shared across all chart instances on the page.
// This lets the overlay renderer (TradingChart.tsx) call record() on the same object
// that the chart engine (createChart.ts) uses.

type PerfDebugGlobal = typeof globalThis & {
  __TRADEREPLAY_PERF_DEBUG__?: boolean;
  __TRADEREPLAY_PERF_TELEMETRY__?: PerfTelemetry;
};

/** Returns the shared PerfTelemetry if PERF_DEBUG is enabled, otherwise null. */
export function getGlobalPerfTelemetry(): PerfTelemetry | null {
  const g = globalThis as PerfDebugGlobal;
  if (!g.__TRADEREPLAY_PERF_DEBUG__) return null;
  if (!g.__TRADEREPLAY_PERF_TELEMETRY__) {
    g.__TRADEREPLAY_PERF_TELEMETRY__ = new PerfTelemetry();
  }
  return g.__TRADEREPLAY_PERF_TELEMETRY__;
}

/** Install a PerfTelemetry instance (called at chart creation when perfDebug:true). */
export function enableGlobalPerfTelemetry(): PerfTelemetry {
  const g = globalThis as PerfDebugGlobal;
  g.__TRADEREPLAY_PERF_DEBUG__ = true;
  if (!g.__TRADEREPLAY_PERF_TELEMETRY__) {
    g.__TRADEREPLAY_PERF_TELEMETRY__ = new PerfTelemetry();
  }
  return g.__TRADEREPLAY_PERF_TELEMETRY__;
}
