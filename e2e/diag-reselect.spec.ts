import { test, expect } from '@playwright/test';
const BASE_URL = process.env.E2E_TARGET_URL || 'https://tradereplay.me';

test('diag: pixel coords after drawing', async ({ page }) => {
  page.on('console', (msg) => console.log('[PAGE]', msg.text()));
  await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`, { waitUntil: 'load' });
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 25000 });
  await page.waitForFunction(() => (window as any).__chartDebug, { timeout: 25000 });
  await page.waitForTimeout(500);
  const box = (await page.getByTestId('chart-interaction-surface').boundingBox())!;
  const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
  console.log(`SURFACE x=${box.x} y=${box.y} w=${box.width} h=${box.height} cx=${cx} cy=${cy}`);
  await page.getByTestId('rail-lines').click({ force: true }); await page.waitForTimeout(150);
  await page.getByTestId('tool-trendline').first().click({ force: true }); await page.waitForTimeout(200);
  await page.mouse.move(cx - 22, cy - 6); await page.mouse.down();
  await page.mouse.move(cx + 22, cy + 6, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(400);

  // Now click at exactly cx,cy and report what __chartDebug + DOM state says.
  const probe = await page.evaluate(([clickX, clickY]) => {
    const dbg = (window as any).__chartDebug;
    const drawings = dbg?.getDrawings?.() ?? [];
    const drawing = drawings[drawings.length - 1];
    if (!drawing) return { error: 'no drawing' };
    const surfaceEl = document.querySelector("[data-testid='chart-interaction-surface']") as HTMLElement;
    const surfaceRect = surfaceEl.getBoundingClientRect();
    const canvases = surfaceEl.querySelectorAll('canvas');
    const canvasInfo = Array.from(canvases).map((c: any) => {
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, w: c.width, h: c.height };
    });
    const dim = dbg?.getAxisDimensions?.();
    // Try to call internal chart API: fall back to using infoLine helper as a probe
    // Use a temporary infoLine to get a 2-anchor measurement (won't work since drawing is trend)
    // Instead, use page.evaluate to get the chart instance from any global hook.
    // Compute via scrollPosition approximation — skip and rely on internal helper:
    return {
      drawing,
      surfaceRect,
      canvases: canvasInfo,
      dim,
      clickAt: { x: clickX, y: clickY },
      clickRelToSurface: { x: clickX - surfaceRect.left, y: clickY - surfaceRect.top },
    };
  }, [cx, cy]);
  console.log(`PROBE=${JSON.stringify(probe, null, 2)}`);

  // Now actually click
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);
  const sel = await page.evaluate(() => (window as any).__chartDebug?.getSelectedDrawingId?.());
  const pixelAnchors = await page.evaluate(() => (window as any).__chartDebug?.getDrawingPixelAnchors?.());
  console.log(`PIXEL_ANCHORS=${JSON.stringify(pixelAnchors)}`);
  console.log(`SELECTED=${sel}`);
  expect(true).toBe(true);
});
