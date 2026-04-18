import { expect, test, type Page } from './playwright-fixture';

type TickBurstResult = {
  ticks: number;
  updates: number;
  appends: number;
  renderCount: number;
  recomputeCount: number;
  incrementalCount: number;
  fallbackCount: number;
  fullRecomputeCount: number;
  setDataCount: number;
  outOfOrderInsertCount: number;
};

type BenchmarkState = {
  ready: boolean;
  initial?: {
    initialSetDataMs: number;
    indicatorAttachMs: number;
    recomputeCount: number;
    recomputeTotalMs: number;
    recomputeAvgMs: number;
    recomputeMaxMs: number;
  };
  clearSamples: () => void;
  getRenderSummary: () => { count: number; avgMs: number; maxMs: number };
  getRecomputeSummary: () => { count: number; avgMs: number; maxMs: number };
  getMutationSummary: () => {
    total: number;
    setDataCount: number;
    updateCount: number;
    appendCount: number;
    replaceCount: number;
    outOfOrderInsertCount: number;
  };
  getIncrementalSummary: () => { count: number; fallbackCount: number; avgFallbackPerCall: number };
  getFullRecomputeSummary: () => { count: number; workerCount: number; mainThreadCount: number };
  getRenderSamples: () => number[];
  getRecomputeSamples: () => number[];
  runTickBurst: (opts?: { ticks?: number; appendEvery?: number; frameStride?: number }) => Promise<TickBurstResult>;
};

function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

function secondWorstOrMax(values: number[], fallbackMax: number): number {
  if (values.length < 2) return fallbackMax;
  const sorted = values.slice().sort((a, b) => b - a);
  return sorted[1];
}

async function waitForFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}

async function openBenchmark(page: Page, query = 'bars=10000&indicators=20&seed=1337'): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`/__bench/chart-performance?${query}`);
  await page.waitForFunction(() => (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState?.ready === true);
  await waitForFrame(page);
  await waitForFrame(page);
}

test('phase2 perf: wheel and pan stay within interaction frame budgets', async ({ page }) => {
  await openBenchmark(page);

  const initial = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.initial ?? null;
  });

  expect(initial).toBeTruthy();
  expect(initial?.initialSetDataMs ?? 0).toBeGreaterThan(0);
  expect(initial?.initialSetDataMs ?? 0).toBeLessThan(3_500);
  expect(initial?.indicatorAttachMs ?? 0).toBeGreaterThan(0);
  expect(initial?.indicatorAttachMs ?? 0).toBeLessThan(4_000);

  const canvas = page.locator('[data-testid="benchmark-chart-root"] canvas').first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const midX = box.x + box.width * 0.55;
  const midY = box.y + box.height * 0.42;
  await page.mouse.move(midX, midY);

  for (let i = 0; i < 5; i += 1) {
    await page.mouse.wheel(0, i % 2 === 0 ? -180 : 150);
    await waitForFrame(page);
  }

  await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    state?.clearSamples();
  });

  for (let i = 0; i < 16; i += 1) {
    await page.mouse.wheel(0, i % 2 === 0 ? -240 : 200);
    await waitForFrame(page);
  }

  await waitForFrame(page);
  const wheelSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRenderSummary() ?? { count: 0, avgMs: 0, maxMs: 0 };
  });
  const wheelSamples = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRenderSamples?.() ?? [];
  });
  const wheelRecompute = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRecomputeSummary() ?? { count: 0, avgMs: 0, maxMs: 0 };
  });
  const wheelP95 = p95(wheelSamples);
  const wheelEffectiveMax = secondWorstOrMax(wheelSamples, wheelSummary.maxMs);

  expect(wheelSummary.count).toBeGreaterThan(10);
  expect(wheelSummary.avgMs).toBeLessThan(34);
  expect(wheelP95).toBeLessThan(64);
  expect(wheelEffectiveMax).toBeLessThan(120);
  expect(wheelRecompute.count).toBe(0);

  await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    state?.clearSamples();
  });

  await page.mouse.down();
  for (let i = 0; i < 20; i += 1) {
    await page.mouse.move(midX + i * 11, midY + Math.sin(i / 2.2) * 8);
    await waitForFrame(page);
  }
  await page.mouse.up();
  await waitForFrame(page);

  const panSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRenderSummary() ?? { count: 0, avgMs: 0, maxMs: 0 };
  });
  const panSamples = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRenderSamples?.() ?? [];
  });
  const panRecompute = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRecomputeSummary() ?? { count: 0, avgMs: 0, maxMs: 0 };
  });
  const panP95 = p95(panSamples);
  const panEffectiveMax = secondWorstOrMax(panSamples, panSummary.maxMs);

  expect(panSummary.count).toBeGreaterThan(10);
  expect(panSummary.avgMs).toBeLessThan(36);
  expect(panP95).toBeLessThan(70);
  expect(panEffectiveMax).toBeLessThan(125);
  expect(panRecompute.count).toBe(0);
});

test('phase2 realtime: tick bursts stay incremental and avoid full reset paths', async ({ page }) => {
  await openBenchmark(page, 'bars=10000&indicators=20&seed=1337');

  await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    state?.clearSamples();
  });

  const burst = await page.evaluate(async () => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    if (!state) return null;
    return state.runTickBurst({ ticks: 1_200, appendEvery: 5, frameStride: 10 });
  });

  expect(burst).toBeTruthy();
  expect(burst?.ticks ?? 0).toBe(1_200);
  expect((burst?.updates ?? 0) + (burst?.appends ?? 0)).toBe(1_200);
  expect(burst?.setDataCount ?? 999).toBe(0);
  expect(burst?.outOfOrderInsertCount ?? 999).toBe(0);
  expect(burst?.incrementalCount ?? 0).toBeGreaterThan(20);
  expect(burst?.fullRecomputeCount ?? 999).toBeLessThanOrEqual(1);
  expect((burst?.fallbackCount ?? 9999) / Math.max(1, burst?.incrementalCount ?? 1)).toBeLessThan(0.15);
  expect(burst?.renderCount ?? 0).toBeGreaterThan(20);

  const burstRenderSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRenderSummary() ?? { count: 0, avgMs: 0, maxMs: 0 };
  });
  const burstRenderSamples = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRenderSamples?.() ?? [];
  });
  const burstP95 = p95(burstRenderSamples);
  const burstFps = burstRenderSummary.avgMs > 0 ? 1000 / burstRenderSummary.avgMs : 0;

  expect(burstRenderSummary.count).toBeGreaterThan(20);
  expect(burstRenderSummary.avgMs).toBeLessThan(16);
  expect(burstFps).toBeGreaterThanOrEqual(55);
  expect(burstP95).toBeLessThan(32);

  const mutationSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getMutationSummary() ?? null;
  });
  const incrementalSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getIncrementalSummary() ?? null;
  });
  const fullRecomputeSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getFullRecomputeSummary() ?? null;
  });

  expect(mutationSummary).toBeTruthy();
  expect(mutationSummary?.setDataCount ?? 999).toBe(0);
  expect(mutationSummary?.outOfOrderInsertCount ?? 999).toBe(0);
  expect(mutationSummary?.updateCount ?? 0).toBeGreaterThanOrEqual(1_100);

  expect(incrementalSummary).toBeTruthy();
  expect(incrementalSummary?.count ?? 0).toBeGreaterThan(20);
  expect(incrementalSummary?.avgFallbackPerCall ?? 999).toBeLessThan(0.2);

  expect(fullRecomputeSummary).toBeTruthy();
  expect(fullRecomputeSummary?.count ?? 999).toBeLessThanOrEqual(1);
});
