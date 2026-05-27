import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

type Point = { x: number; y: number };
type HandleState = {
  drawingId: string;
  variant: string;
  visible: boolean;
  handles: Array<{ role: string; anchorIndex: number; x: number; y: number }>;
};

async function gotoCharts(page: Page, symbol = "RELIANCE") {
  await page.goto(`${BASE_URL}/charts?symbol=${symbol}`);
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 20_000 });
  await page.waitForFunction(
    () => {
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

async function pickTrendAngle(page: Page) {
  await openLinesRail(page);
  const tool = page.getByTestId("tool-trend-angle").first();
  if (!(await tool.count())) test.skip(true, "Trend Angle tool not found");
  await tool.click({ force: true });
  await page.waitForTimeout(80);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no chart interaction surface");
  return box;
}

async function clickAt(page: Page, point: Point) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function dragBetween(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(140);
}

async function drawTrendAngle(page: Page): Promise<string> {
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  await pickTrendAngle(page);
  await clickAt(page, { x: box.x + plotW * 0.34, y: box.y + box.height * 0.58 });
  await clickAt(page, { x: box.x + plotW * 0.66, y: box.y + box.height * 0.34 });
  const handle = await page.waitForFunction(() => (window as any).__chartDebug?.getLatestDrawingId?.(), null, { timeout: 8_000 });
  return String(await handle.jsonValue());
}

async function selectDrawing(page: Page, id: string | null) {
  await page.evaluate((drawingId) => (window as any).__chartDebug?.forceSelectDrawing?.(drawingId), id);
  await page.waitForTimeout(100);
}

async function getMetrics(page: Page, id: string) {
  return page.evaluate((drawingId) => (window as any).__chartDebug?.getTrendAngleMetrics?.(drawingId), id);
}

async function getProjectedAnchors(page: Page, id: string): Promise<Point[]> {
  const result = await page.evaluate((drawingId) => (window as any).__chartDebug?.getProjectedAnchors?.(drawingId)?.anchors ?? null, id);
  if (!result) throw new Error("projected anchors not available");
  return result as Point[];
}

async function getHandleState(page: Page, id: string): Promise<HandleState> {
  const result = await page.evaluate((drawingId) => (window as any).__chartDebug?.getDrawingHandleState?.(drawingId), id);
  if (!result) throw new Error("handle state not available");
  return result as HandleState;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function expectTrendAngleMetrics(metrics: any) {
  expect(metrics).toBeTruthy();
  expect(Number.isFinite(metrics.angleDeg)).toBe(true);
  expect(Number.isFinite(metrics.lengthPx)).toBe(true);
  expect(Number.isFinite(metrics.arcRadius)).toBe(true);
  expect(metrics.angleText).toMatch(/^[+\u2212]?\d[\d,]*\.\d{2}\u00B0$/);
  expect(metrics.displayText).toBe(metrics.angleText);
  expect(metrics.renderedStart).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  expect(metrics.renderedEnd).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  expect(metrics.referenceStart.y).toBeCloseTo(metrics.renderedStart.y, 4);
  expect(metrics.referenceEnd.y).toBeCloseTo(metrics.renderedStart.y, 4);
  expect(metrics.referenceEnd.x).toBeGreaterThan(metrics.referenceStart.x);
  expect(metrics.label.text).toBe(metrics.angleText);
  for (const value of [metrics.angleText, metrics.displayText]) {
    expect(String(value)).not.toMatch(/null|undefined|NaN/i);
  }
}

async function expectHandlesAlignedToRenderedEndpoints(page: Page, id: string) {
  const anchors = await getProjectedAnchors(page, id);
  const state = await getHandleState(page, id);
  expect(state.visible).toBe(true);
  expect(state.handles.map((handle) => `${handle.role}:${handle.anchorIndex}`)).toEqual(["endpoint:0", "endpoint:1"]);
  for (const handle of state.handles) {
    const anchor = anchors[handle.anchorIndex];
    expect(anchor).toBeTruthy();
    expect(distance(handle, anchor)).toBeLessThan(1.5);
  }
}

test.describe("Trend Angle Phase 4 helper", () => {
  test("angle helper exposes stable angle label, dashed reference, and rendered endpoints", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendAngle(page);
    await selectDrawing(page, id);

    expectTrendAngleMetrics(await getMetrics(page, id));
    await expectHandlesAlignedToRenderedEndpoints(page, id);
  });

  test("selected endpoint handles hide on deselect and return on reselect", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendAngle(page);
    await selectDrawing(page, id);
    await expectHandlesAlignedToRenderedEndpoints(page, id);

    await selectDrawing(page, null);
    const deselected = await getHandleState(page, id);
    expect(deselected.visible).toBe(false);
    expect(deselected.handles).toHaveLength(0);

    await selectDrawing(page, id);
    await expectHandlesAlignedToRenderedEndpoints(page, id);
    expectTrendAngleMetrics(await getMetrics(page, id));
  });

  test("angle metric remains available after endpoint edit", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendAngle(page);
    await selectDrawing(page, id);
    const before = await getMetrics(page, id);
    const handles = await getHandleState(page, id);
    const endpoint = handles.handles.find((handle) => handle.anchorIndex === 1);
    expect(endpoint).toBeTruthy();

    await dragBetween(page, endpoint!.x, endpoint!.y, endpoint!.x - 44, endpoint!.y + 52);
    const after = await getMetrics(page, id);
    expectTrendAngleMetrics(after);
    expect(
      distance(after.renderedEnd, before.renderedEnd) +
        Math.abs(after.lengthPx - before.lengthPx)
    ).toBeGreaterThan(4);
  });

  test("handle coordinates stay aligned after pan and zoom", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendAngle(page);
    await selectDrawing(page, id);
    await expectHandlesAlignedToRenderedEndpoints(page, id);

    await page.evaluate(() => {
      const debug = (window as any).__chartDebug;
      const current = debug?.getScrollPosition?.() ?? 0;
      debug?.scrollToPosition?.(current - 30);
    });
    await page.waitForTimeout(250);
    await expectHandlesAlignedToRenderedEndpoints(page, id);

    const box = await surfaceBox(page);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Control");
    await page.waitForTimeout(350);
    await expectHandlesAlignedToRenderedEndpoints(page, id);
    expectTrendAngleMetrics(await getMetrics(page, id));
  });

  test("offscreen anchors still produce finite angle metric rows", async ({ page }) => {
    await gotoCharts(page);
    const visibleId = await drawTrendAngle(page);
    const offscreenId = await page.evaluate((sourceId) => {
      const debug = (window as any).__chartDebug;
      const source = debug?.getDrawingById?.(sourceId);
      if (!source?.anchors?.length) return null;
      const [a, b] = source.anchors;
      const day = 86_400;
      return (window as any).__tradereplayAddDrawing?.("trendAngle", [
        { time: Number(a.time) - 365 * day, price: Number(a.price) * 0.8 },
        { time: Number(b.time) + 365 * day, price: Number(b.price) * 1.2 },
      ]);
    }, visibleId);

    expect(offscreenId).toBeTruthy();
    expectTrendAngleMetrics(await getMetrics(page, String(offscreenId)));
  });
});
