import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

async function gotoCharts(page: Page, symbol = "RELIANCE") {
  await page.goto(`${BASE_URL}/charts?symbol=${symbol}`);
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 20_000 });
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (window as any).__chartDebug;
      return d && typeof d.getScrollPosition === "function" && d.getScrollPosition() !== null;
    },
    { timeout: 20_000 }
  );
  await page.evaluate(() => (window as any).__chartDebug?.clearAllDrawings?.());
  await page.waitForTimeout(250);
}

async function openLinesRail(page: Page) {
  const btn = page.getByTestId("toolrail-button-lines");
  if (await btn.count()) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(100);
  }
}

async function pickInfoLine(page: Page) {
  await openLinesRail(page);
  const tool = page.getByTestId("tool-info-line").first();
  if (!(await tool.count())) test.skip(true, "Info Line tool not found");
  await tool.click({ force: true });
  await page.waitForTimeout(80);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no chart interaction surface");
  return box;
}

async function dragBetween(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

async function drawInfoLine(page: Page): Promise<string> {
  const box = await surfaceBox(page);
  const yBase = box.y + box.height * 0.58;
  await pickInfoLine(page);
  await dragBetween(
    page,
    box.x + box.width * 0.35,
    yBase + 42,
    box.x + box.width * 0.65,
    yBase - 34
  );
  const id = await page.waitForFunction(() => (window as any).__chartDebug?.getLatestDrawingId?.(), null, { timeout: 8_000 });
  return String(await id.jsonValue());
}

async function getMetrics(page: Page, id?: string) {
  return page.evaluate((drawingId) => (window as any).__chartDebug?.getInfoLineMetrics?.(drawingId), id ?? null);
}

function expectFormattedMetricLines(metrics: any) {
  expect(metrics).toBeTruthy();
  expect(metrics.line1).toMatch(/^[\u25B2\u25BC\u25C6] \d[\d,]*\.\d{2} \(\d[\d,]*\.\d{2}%\), \d[\d,]*$/);
  expect(metrics.line1).not.toContain("ticks");
  expect(metrics.line2).toMatch(/^\d[\d,]* bars \(\d[\d,]*d\), distance: \d[\d,]* px$/);
  expect(metrics.line3).toMatch(/^\u2220 [+\u2212]?\d[\d,]*\.\d{2}\u00B0$/);
  expect(metrics.displayLines).toEqual([metrics.line1, metrics.line2, metrics.line3]);
  expect(metrics.panelText).toBe(`${metrics.line1}\n${metrics.line2}\n${metrics.line3}`);
  for (const value of [
    metrics.priceChangeText,
    metrics.percentChangeText,
    metrics.ticksText,
    metrics.barsText,
    metrics.daysText,
    metrics.distanceText,
    metrics.angleText,
    metrics.panelText,
  ]) {
    expect(String(value)).not.toMatch(/null|undefined|NaN/i);
  }
}

test.describe("Info Line Phase 3 metrics", () => {
  test("floating metric panel exposes TradingView-shaped price, percent, time, distance, and angle rows", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawInfoLine(page);
    const metrics = await getMetrics(page, id);

    expectFormattedMetricLines(metrics);
    expect(metrics.priceChangeText).toMatch(/^\d[\d,]*\.\d{2}$/);
    expect(metrics.percentChangeText).toMatch(/^\d[\d,]*\.\d{2}%$/);
    expect(metrics.distanceText).toMatch(/^\d[\d,]*$/);
    expect(metrics.angleText).toMatch(/^[+\u2212]?\d[\d,]*\.\d{2}\u00B0$/);
  });

  test("offscreen anchors still produce finite formatted metric rows", async ({ page }) => {
    await gotoCharts(page);
    const visibleId = await drawInfoLine(page);
    const offscreenId = await page.evaluate((sourceId) => {
      const debug = (window as any).__chartDebug;
      const source = debug?.getDrawingById?.(sourceId);
      if (!source?.anchors?.length) return null;
      const [a, b] = source.anchors;
      const day = 86_400;
      return (window as any).__tradereplayAddDrawing?.("infoLine", [
        { time: Number(a.time) - 365 * day, price: Number(a.price) * 0.8 },
        { time: Number(b.time) + 365 * day, price: Number(b.price) * 1.2 },
      ]);
    }, visibleId);

    expect(offscreenId).toBeTruthy();
    const metrics = await getMetrics(page, String(offscreenId));
    expectFormattedMetricLines(metrics);
    expect(Number.isFinite(metrics.distPx)).toBe(true);
    expect(Number.isFinite(metrics.angleDeg)).toBe(true);
  });

  test("metrics remain available after endpoint edit, deselect, and reselect", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawInfoLine(page);
    const anchors = await page.evaluate((drawingId) => (window as any).__chartDebug?.getDrawingPixelAnchors?.(drawingId), id);
    expect(anchors?.anchors?.length).toBeGreaterThanOrEqual(2);
    const endpoint = anchors.anchors[1];

    await page.evaluate((drawingId) => (window as any).__chartDebug?.forceSelectDrawing?.(drawingId), id);
    await dragBetween(page, endpoint.x, endpoint.y, endpoint.x + 28, endpoint.y - 18);
    expectFormattedMetricLines(await getMetrics(page, id));

    await page.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
    expectFormattedMetricLines(await getMetrics(page, id));

    await page.evaluate((drawingId) => (window as any).__chartDebug?.forceSelectDrawing?.(drawingId), id);
    expectFormattedMetricLines(await getMetrics(page, id));
  });
});
