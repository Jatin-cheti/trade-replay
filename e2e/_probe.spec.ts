import { expect, test } from '@playwright/test';
test('probe canvas metrics', async ({ page }) => {
  await page.goto('https://tradereplay.me/charts?symbol=RELIANCE', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=chart-container]');
  await page.waitForFunction(() => !!(window as any).__tradereplayChart);
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const container = document.querySelector('[data-testid=chart-container]') as HTMLElement;
    const cbox = container.getBoundingClientRect();
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const kbox = canvas?.getBoundingClientRect();
    const dims = (window as any).__tradereplayChart.getDimensions?.();
    return { cbox: { x: cbox.x, y: cbox.y, w: cbox.width, h: cbox.height }, kbox: kbox && { x: kbox.x, y: kbox.y, w: kbox.width, h: kbox.height }, dims, dpr: devicePixelRatio };
  });
  console.log('METRICS:', JSON.stringify(info, null, 2));
});
