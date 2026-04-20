import { chromium } from 'playwright';

type BenchmarkState = {
  ready: boolean;
  initial?: {
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
  clearSamples: () => void;
  getRenderSummary: () => { count: number; avgMs: number; maxMs: number };
  getRecomputeSummary: () => { count: number; avgMs: number; maxMs: number };
};

const sizes = [10_000, 50_000, 100_000];
const indicators = 20;
const baseUrl = process.env.BENCH_BASE_URL ?? 'http://127.0.0.1:5173';
const route = '/__bench/chart-performance';

function format(value: number): string {
  return `${value.toFixed(1)} ms`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

async function waitForFrame(page: import('playwright').Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}

async function runBurst(page: import('playwright').Page, type: 'wheel' | 'pan'): Promise<{ count: number; avgMs: number; maxMs: number }> {
  await page.evaluate(() => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    state?.clearSamples();
  });

  const canvas = page.locator('[data-testid="benchmark-chart-root"] canvas').first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Benchmark canvas did not render');
  }

  const midX = box.x + box.width * 0.55;
  const midY = box.y + box.height * 0.42;
  await page.mouse.move(midX, midY);

  if (type === 'wheel') {
    for (let i = 0; i < 12; i += 1) {
      await page.mouse.wheel(0, i % 2 === 0 ? -220 : 180);
      await waitForFrame(page);
    }
  } else {
    await page.mouse.down();
    for (let i = 0; i < 14; i += 1) {
      await page.mouse.move(midX + i * 12, midY + Math.sin(i / 2) * 5);
      await waitForFrame(page);
    }
    await page.mouse.up();
  }

  await waitForFrame(page);
  await waitForFrame(page);

  return page.evaluate((phase) => {
    const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
    if (!state) {
      throw new Error('Benchmark state missing');
    }
    return phase === 'wheel' ? state.getRenderSummary() : state.getRenderSummary();
  }, type);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  console.log('Chart Performance Benchmark');
  console.log(`Base URL: ${baseUrl}`);
  console.log('');

  for (const bars of sizes) {
    const url = `${baseUrl}${route}?bars=${bars}&indicators=${indicators}&seed=1337`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState?.ready === true);
    await page.waitForLoadState('networkidle');
    await waitForFrame(page);
    await waitForFrame(page);

    const initial = await page.evaluate(() => {
      const state = (window as Window & { __chartBenchmarkState?: BenchmarkState }).__chartBenchmarkState;
      return state?.initial ?? null;
    });

    if (!initial) {
      throw new Error('Benchmark initial metrics were not produced');
    }

    const wheel = await runBurst(page, 'wheel');
    const pan = await runBurst(page, 'pan');

    console.log(`Bars: ${formatCount(bars)}`);
    console.log(`  initial setData: ${format(initial.initialSetDataMs)}`);
    console.log(`  indicator attach: ${format(initial.indicatorAttachMs)}`);
    console.log(`  indicator recomputes: ${initial.recomputeCount} calls / ${format(initial.recomputeTotalMs)}`);
    console.log(`  wheel burst render: ${wheel.count} frames / avg ${format(wheel.avgMs)} / max ${format(wheel.maxMs)}`);
    console.log(`  pan burst render:   ${pan.count} frames / avg ${format(pan.avgMs)} / max ${format(pan.maxMs)}`);
    console.log('');
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
