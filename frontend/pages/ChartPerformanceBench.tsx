import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createTradingChart } from '@/services/chart/chartEngine';
import { listIndicators } from '@tradereplay/charts';

type BenchSample = {
  durationMs: number;
  barCount: number;
  indicatorCount: number;
};

type BenchResult = {
  bars: number;
  indicators: number;
  seed: number;
  initialSetDataMs: number;
  indicatorAttachMs: number;
  recomputeCount: number;
  recomputeTotalMs: number;
  recomputeAvgMs: number;
  recomputeMaxMs: number;
  wheelRenderCount: number;
  wheelAvgRenderMs: number;
  wheelMaxRenderMs: number;
  panRenderCount: number;
  panAvgRenderMs: number;
  panMaxRenderMs: number;
};

type BenchmarkDebugState = {
  ready: boolean;
  initial?: BenchResult;
  clearSamples: () => void;
  getRenderSummary: () => { count: number; avgMs: number; maxMs: number };
  getRecomputeSummary: () => { count: number; avgMs: number; maxMs: number };
  getRenderSamples: () => number[];
  getRecomputeSamples: () => number[];
};

interface SyntheticRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const indicatorIds = [
  'sma', 'ema', 'rsi', 'macd', 'wma', 'vwap', 'bbands', 'atr', 'supertrend', 'stochastic',
  'cci', 'roc', 'momentum', 'mfi', 'adx', 'aroon', 'trix', 'ultimate', 'dpo', 'keltner',
].filter((id) => listIndicators().some((indicator) => indicator.id === id));

function makeSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeSyntheticRows(count: number, seed: number): SyntheticRow[] {
  const rand = makeSeededRandom(seed);
  const rows: SyntheticRow[] = [];
  let price = 100;
  const startTime = 1_700_000_000;

  for (let i = 0; i < count; i += 1) {
    const trend = Math.sin(i / 130) * 0.08 + Math.cos(i / 55) * 0.03;
    const drift = (rand() - 0.49) * 0.8 + trend;
    const open = price;
    const close = Math.max(1, open * (1 + drift * 0.01));
    const range = Math.max(0.18, open * (0.004 + rand() * 0.006));
    const high = Math.max(open, close) + range * (0.35 + rand() * 0.4);
    const low = Math.min(open, close) - range * (0.35 + rand() * 0.4);
    const volume = Math.floor(120_000 + rand() * 620_000 + i * 7);

    rows.push({
      time: startTime + i * 60,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume,
    });

    price = close;
  }

  return rows;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number {
  return values.length ? Math.max(...values) : 0;
}

export default function ChartPerformanceBench() {
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const [status, setStatus] = useState('initializing');
  const [result, setResult] = useState<BenchResult | null>(null);

  const bars = Math.max(1000, Number(searchParams.get('bars') ?? '10000') || 10000);
  const indicators = Math.max(1, Math.min(indicatorIds.length, Number(searchParams.get('indicators') ?? '20') || 20));
  const seed = Number(searchParams.get('seed') ?? '1337') || 1337;

  const rows = useMemo(() => makeSyntheticRows(bars, seed), [bars, seed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let chart: ReturnType<typeof createTradingChart> | null = null;

    const renderSamples: BenchSample[] = [];
    const recomputeSamples: BenchSample[] = [];
    const debugState: BenchmarkDebugState = {
      ready: false,
      clearSamples() {
        renderSamples.length = 0;
        recomputeSamples.length = 0;
      },
      getRenderSummary() {
        return {
          count: renderSamples.length,
          avgMs: average(renderSamples.map((sample) => sample.durationMs)),
          maxMs: max(renderSamples.map((sample) => sample.durationMs)),
        };
      },
      getRecomputeSummary() {
        return {
          count: recomputeSamples.length,
          avgMs: average(recomputeSamples.map((sample) => sample.durationMs)),
          maxMs: max(recomputeSamples.map((sample) => sample.durationMs)),
        };
      },
      getRenderSamples() {
        return renderSamples.map((sample) => sample.durationMs);
      },
      getRecomputeSamples() {
        return recomputeSamples.map((sample) => sample.durationMs);
      },
    };

    (window as Window & { __chartBenchmarkState?: BenchmarkDebugState; __TRADEREPLAY_CHART_DEBUG__?: unknown }).__chartBenchmarkState = debugState;
    (window as Window & { __TRADEREPLAY_CHART_DEBUG__?: unknown }).__TRADEREPLAY_CHART_DEBUG__ = {
      onRecomputeEnd: (payload: BenchSample) => {
        recomputeSamples.push(payload);
      },
      onRenderEnd: (payload: BenchSample) => {
        renderSamples.push(payload);
      },
    };

    const waitFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    void (async () => {
      setStatus('creating chart');
      chart = createTradingChart(container);
      chartRef.current = chart;

      const source = chart.addSeries('Candlestick', {
        visible: true,
        upColor: '#3ee187',
        downColor: '#ff7275',
        borderUpColor: '#3ee187',
        borderDownColor: '#ff7275',
        wickUpColor: '#83e8bb',
        wickDownColor: '#ff8d8f',
      });

      setStatus('loading data');
      const setDataStart = performance.now();
      source.setData(rows);
      const initialSetDataMs = performance.now() - setDataStart;

      setStatus('attaching indicators');
      const attachStart = performance.now();
      for (let i = 0; i < indicators; i += 1) {
        const id = indicatorIds[i % indicatorIds.length];
        chart.addIndicator(id);
      }
      const indicatorAttachMs = performance.now() - attachStart;

      await waitFrame();
      await waitFrame();

      if (cancelled) return;

      const recomputeTotalMs = recomputeSamples.reduce((sum, sample) => sum + sample.durationMs, 0);
      const recomputeCount = recomputeSamples.length;
      const initialResult: BenchResult = {
        bars,
        indicators,
        seed,
        initialSetDataMs,
        indicatorAttachMs,
        recomputeCount,
        recomputeTotalMs,
        recomputeAvgMs: recomputeCount ? recomputeTotalMs / recomputeCount : 0,
        recomputeMaxMs: max(recomputeSamples.map((sample) => sample.durationMs)),
        wheelRenderCount: 0,
        wheelAvgRenderMs: 0,
        wheelMaxRenderMs: 0,
        panRenderCount: 0,
        panAvgRenderMs: 0,
        panMaxRenderMs: 0,
      };

      setResult(initialResult);
      debugState.ready = true;
      debugState.initial = initialResult;
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
      debugState.ready = false;
      chart?.remove();
      chartRef.current = null;
      delete (window as Window & { __chartBenchmarkState?: BenchmarkDebugState }).__chartBenchmarkState;
      delete (window as Window & { __TRADEREPLAY_CHART_DEBUG__?: unknown }).__TRADEREPLAY_CHART_DEBUG__;
    };
  }, [bars, indicators, rows, seed]);

  useEffect(() => {
    document.title = 'Chart Performance Benchmark';
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,209,255,0.18),_transparent_32%),linear-gradient(180deg,#08111f_0%,#050b15_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-6">
        <header className="rounded-2xl border border-cyan-400/20 bg-slate-950/70 px-4 py-3 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/70">Benchmark</p>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Canvas2D chart load test</h1>
            </div>
            <div className="text-sm text-slate-300">
              <span className="mr-4">Bars: {bars.toLocaleString()}</span>
              <span className="mr-4">Indicators: {indicators}</span>
              <span>Status: {status}</span>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="relative overflow-hidden rounded-3xl border border-cyan-400/15 bg-slate-950/80 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div ref={containerRef} className="h-[72vh] min-h-[720px] w-full" data-testid="benchmark-chart-root" />
          </section>

          <aside className="rounded-3xl border border-cyan-400/15 bg-slate-950/72 p-4 text-sm shadow-[0_24px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <h2 className="mb-3 font-semibold text-cyan-100">Initial results</h2>
            {result ? (
              <div className="space-y-3 text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p>Set data: {result.initialSetDataMs.toFixed(1)} ms</p>
                  <p>Attach indicators: {result.indicatorAttachMs.toFixed(1)} ms</p>
                  <p>Recomputes: {result.recomputeCount} calls</p>
                  <p>Recompute avg: {result.recomputeAvgMs.toFixed(1)} ms</p>
                  <p>Recompute max: {result.recomputeMaxMs.toFixed(1)} ms</p>
                </div>
                <p className="text-slate-400">Use the Playwright benchmark script to run wheel and pan bursts. This page exposes timing hooks on `window.__chartBenchmarkState`.</p>
              </div>
            ) : (
              <p className="text-slate-400">Preparing chart...</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
