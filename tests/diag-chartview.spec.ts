import { test, expect } from '@playwright/test';

test('screener chart view — verify charts visible on prod', async ({ page }) => {
  test.setTimeout(120000);

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[page-${msg.type()}]`, msg.text());
    }
  });

  // Force bypass CDN cache
  await page.goto('https://tradereplay.me/screener/stocks?_=' + Date.now(), {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(4000);

  // Switch to chart view
  const chartBtn = page.getByRole('button', { name: /chart/i }).first();
  await chartBtn.click().catch(() => {});
  await page.waitForSelector('[data-testid="screener-chart-card"]', { timeout: 30000 });
  await page.waitForTimeout(6000); // wait for LWC + data fetch

  const info = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="screener-chart-card"]'));
    const samples = cards.slice(0, 3).map((card) => {
      const c = card as HTMLElement;
      const cardRect = c.getBoundingClientRect();
      // Chart area is the last child (the `relative flex-1 min-h-0` div)
      const chartArea = c.children[c.children.length - 1] as HTMLElement;
      const caRect = chartArea.getBoundingClientRect();

      // Find the LWC container inside wrapper
      // Structure: chartArea > wrapper(absolute inset-0) > lwc container (100% x 100%)
      const wrapper = chartArea.querySelector(':scope > div.absolute') as HTMLElement | null;
      const lwc = wrapper?.querySelector(':scope > div') as HTMLElement | null;
      const canvases = Array.from(chartArea.querySelectorAll('canvas')) as HTMLCanvasElement[];
      const canvasInfo = canvases.map((cv) => ({
        w: cv.getBoundingClientRect().width,
        h: cv.getBoundingClientRect().height,
        sw: cv.style.width,
        sh: cv.style.height,
        drawW: cv.width,
        drawH: cv.height,
      }));

      return {
        cardW: cardRect.width,
        cardH: cardRect.height,
        chartAreaW: caRect.width,
        chartAreaH: caRect.height,
        chartAreaClientH: chartArea.clientHeight,
        wrapper: wrapper
          ? {
              clientH: wrapper.clientHeight,
              pos: getComputedStyle(wrapper).position,
              h: wrapper.getBoundingClientRect().height,
            }
          : null,
        lwc: lwc
          ? {
              clientH: lwc.clientHeight,
              pos: getComputedStyle(lwc).position,
              styleH: lwc.style.height,
              h: lwc.getBoundingClientRect().height,
            }
          : null,
        canvasCount: canvases.length,
        canvasInfo,
      };
    });
    return { cardCount: cards.length, samples };
  });

  console.log('[diag] chart view DOM info:');
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'test-results/chartview-prod.png', fullPage: false });

  // Assertions: at least one card, and canvases must have non-zero height
  expect(info.cardCount).toBeGreaterThan(0);
  expect(info.samples.length).toBeGreaterThan(0);
  const first = info.samples[0];
  expect(first.chartAreaClientH).toBeGreaterThan(50);
  expect(first.wrapper?.h ?? 0).toBeGreaterThan(50);
  expect(first.canvasCount).toBeGreaterThan(0);
  // Critical: canvas rendered height must be > 0
  expect(first.canvasInfo[0].h).toBeGreaterThan(20);
});
