import { expect, test } from './playwright-fixture';

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
  getRenderSamples?: () => number[];
  getRecomputeSamples?: () => number[];
};

function secondWorstOrMax(values: number[], fallbackMax: number): number {
  if (values.length < 2) return fallbackMax;
  const sorted = values.slice().sort((a, b) => b - a);
  return sorted[1];
}

async function waitForFrame(page: Parameters<typeof test>[1] extends never ? never : import('@playwright/test').Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}

test('chart performance stays within loose frame budgets', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/__bench/chart-performance?bars=10000&indicators=20&seed=1337');
  await page.waitForFunction(() => (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState?.ready === true);
  await waitForFrame(page);
  await waitForFrame(page);

  const initial = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.initial ?? null;
  });

  expect(initial).toBeTruthy();
  expect(initial?.initialSetDataMs ?? 0).toBeGreaterThan(0);
  expect(initial?.indicatorAttachMs ?? 0).toBeGreaterThan(0);

  const canvas = page.locator('[data-testid="benchmark-chart-root"] canvas').first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const midX = box.x + box.width * 0.55;
  const midY = box.y + box.height * 0.42;
  await page.mouse.move(midX, midY);

  // Warm up input/render paths so measured bursts reflect steady-state interaction cost.
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, i % 2 === 0 ? -180 : 140);
    await waitForFrame(page);
  }

  await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    state?.clearSamples();
  });

  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, i % 2 === 0 ? -220 : 180);
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
  const wheelRecomputeSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRecomputeSummary() ?? { count: 0, avgMs: 0, maxMs: 0 };
  });
  const wheelEffectiveMax = secondWorstOrMax(wheelSamples, wheelSummary.maxMs);

  expect(wheelSummary.count).toBeGreaterThan(0);
  expect(wheelSummary.avgMs).toBeLessThan(40);
  expect(wheelEffectiveMax).toBeLessThan(120);
  expect(wheelRecomputeSummary.count).toBe(0);

  await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    state?.clearSamples();
  });

  await page.mouse.down();
  for (let i = 0; i < 14; i += 1) {
    await page.mouse.move(midX + i * 12, midY + Math.sin(i / 2) * 5);
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
  const panRecomputeSummary = await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    return state?.getRecomputeSummary() ?? { count: 0, avgMs: 0, maxMs: 0 };
  });
  const panEffectiveMax = secondWorstOrMax(panSamples, panSummary.maxMs);

  expect(panSummary.count).toBeGreaterThan(0);
  expect(panSummary.avgMs).toBeLessThan(40);
  expect(panEffectiveMax).toBeLessThan(120);
  expect(panRecomputeSummary.count).toBe(0);
});
