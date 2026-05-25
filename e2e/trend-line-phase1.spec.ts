/**
 * Trend Line implementation Phase 1.
 *
 * Scope is intentionally narrow: selection, body drag, endpoint handles,
 * handle hit-testing/alignment, and the verified TradingView toolbar inventory
 * model for the Trend Line only.
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";
const TREND_TOOLBAR_CONTROLS = [
  "templates",
  "line-tool-color",
  "text-color",
  "line-tool-width",
  "style",
  "settings",
  "add-alert",
  "lock",
  "remove",
  "more",
] as const;

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
    { timeout: 20_000 },
  );
  await page.evaluate(() => (window as any).__chartDebug?.clearDrawingsFast?.());
  await page.waitForTimeout(300);
}

async function openLinesRail(page: Page) {
  const btn = page.getByTestId("toolrail-button-lines");
  if (await btn.count()) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(100);
  }
}

async function pickTrendLine(page: Page) {
  await openLinesRail(page);
  await page.getByTestId("tool-trendline").first().click({ force: true });
  await page.waitForTimeout(80);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("chart interaction surface is not visible");
  return box;
}

async function clickAt(page: Page, point: Point) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(70);
}

async function dragBy(page: Page, start: Point, dx: number, dy: number) {
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(40);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 5 });
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(180);
}

async function drawTrendLine(page: Page): Promise<string> {
  await pickTrendLine(page);
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  await clickAt(page, { x: box.x + plotW * 0.32, y: box.y + box.height * 0.56 });
  await clickAt(page, { x: box.x + plotW * 0.68, y: box.y + box.height * 0.38 });
  await page.waitForTimeout(200);
  const id = await page.evaluate(() => (window as any).__chartDebug?.getLatestDrawingId?.() ?? null);
  if (!id) throw new Error("no trend line drawing id after draw");
  return id as string;
}

async function getSelectedId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null);
}

async function selectDrawing(page: Page, id: string | null) {
  await page.evaluate((drawingId) => (window as any).__chartDebug?.forceSelectDrawing?.(drawingId), id);
  await page.waitForTimeout(90);
}

async function getProjectedAnchors(page: Page, id: string): Promise<Point[]> {
  const result = await page.evaluate((drawingId) => {
    const projected = (window as any).__chartDebug?.getProjectedAnchors?.(drawingId);
    return projected?.anchors ?? null;
  }, id);
  if (!result) throw new Error("projected anchors not available");
  return result as Point[];
}

async function getHandleState(page: Page, id: string): Promise<HandleState> {
  const state = await page.evaluate((drawingId) => (window as any).__chartDebug?.getDrawingHandleState?.(drawingId) ?? null, id);
  if (!state) throw new Error("handle state not available");
  return state as HandleState;
}

async function getDrawing(page: Page, id: string) {
  return page.evaluate((drawingId) => {
    const drawings = (window as any).__chartDebug?.getDrawings?.() ?? [];
    return drawings.find((drawing: { id: string }) => drawing.id === drawingId) ?? null;
  }, id);
}

async function getToolbarState(page: Page) {
  return page.evaluate(() => (window as any).__chartDebug?.getFloatingToolbarState?.() ?? null);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function expectHandlesAlignedToAnchors(page: Page, id: string) {
  const anchors = await getProjectedAnchors(page, id);
  const state = await getHandleState(page, id);
  expect(state.visible).toBe(true);
  expect(state.handles).toHaveLength(2);
  for (const handle of state.handles) {
    const anchor = anchors[handle.anchorIndex];
    expect(anchor).toBeTruthy();
    expect(distance(handle, anchor)).toBeLessThan(1.5);
  }
}

test.describe("Trend Line Phase 1", () => {
  test("selects by body, deselects, and reselects by body", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendLine(page);
    const anchors = await getProjectedAnchors(page, id);

    await selectDrawing(page, null);
    expect(await getSelectedId(page)).toBeNull();

    await clickAt(page, midpoint(anchors[0], anchors[1]));
    expect(await getSelectedId(page)).toBe(id);
    await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();

    const box = await surfaceBox(page);
    await clickAt(page, { x: box.x + 20, y: box.y + 20 });
    expect(await getSelectedId(page)).toBeNull();

    await clickAt(page, midpoint(anchors[0], anchors[1]));
    expect(await getSelectedId(page)).toBe(id);
  });

  test("body drag preserves line shape and moves both endpoints together", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendLine(page);
    await selectDrawing(page, id);
    const before = await getProjectedAnchors(page, id);
    const start = midpoint(before[0], before[1]);

    await dragBy(page, start, 54, -32);

    const after = await getProjectedAnchors(page, id);
    const delta0 = { x: after[0].x - before[0].x, y: after[0].y - before[0].y };
    const delta1 = { x: after[1].x - before[1].x, y: after[1].y - before[1].y };
    expect(Math.hypot(delta0.x, delta0.y)).toBeGreaterThan(20);
    expect(Math.hypot(delta1.x, delta1.y)).toBeGreaterThan(20);
    expect(Math.abs(delta0.x - delta1.x)).toBeLessThan(8);
    expect(Math.abs(delta0.y - delta1.y)).toBeLessThan(8);
    await expectHandlesAlignedToAnchors(page, id);
  });

  test("endpoint handle drag updates only the targeted endpoint", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendLine(page);
    await selectDrawing(page, id);
    const before = await getProjectedAnchors(page, id);
    const handleState = await getHandleState(page, id);
    const target = handleState.handles.find((handle) => handle.anchorIndex === 1);
    expect(target).toBeTruthy();

    await expectHandlesAlignedToAnchors(page, id);
    await dragBy(page, target!, -48, 36);

    const after = await getProjectedAnchors(page, id);
    expect(distance(before[1], after[1])).toBeGreaterThan(20);
    expect(distance(before[0], after[0])).toBeLessThan(8);
    await expectHandlesAlignedToAnchors(page, id);
  });

  test("selected state exposes endpoint handles and deselected state hides them", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendLine(page);
    await selectDrawing(page, id);

    const selected = await getHandleState(page, id);
    expect(selected.visible).toBe(true);
    expect(selected.handles.map((handle) => `${handle.role}:${handle.anchorIndex}`)).toEqual(["endpoint:0", "endpoint:1"]);

    await selectDrawing(page, null);
    const deselected = await getHandleState(page, id);
    expect(deselected.visible).toBe(false);
    expect(deselected.handles).toHaveLength(0);
  });

  test("handle coordinates stay aligned after pan and zoom", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendLine(page);
    await selectDrawing(page, id);
    await expectHandlesAlignedToAnchors(page, id);

    await page.evaluate(() => {
      const debug = (window as any).__chartDebug;
      const current = debug?.getScrollPosition?.() ?? 0;
      debug?.scrollToPosition?.(current - 30);
    });
    await page.waitForTimeout(250);
    await expectHandlesAlignedToAnchors(page, id);

    const box = await surfaceBox(page);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Control");
    await page.waitForTimeout(350);
    await expectHandlesAlignedToAnchors(page, id);
  });

  test("toolbar inventory model exposes only verified Trend Line controls", async ({ page }) => {
    await gotoCharts(page);
    const id = await drawTrendLine(page);
    await selectDrawing(page, id);

    const toolbarState = await getToolbarState(page);
    expect(toolbarState?.visible).toBe(true);
    expect(toolbarState?.drawingId).toBe(id);
    expect(toolbarState?.controls).toEqual([...TREND_TOOLBAR_CONTROLS]);

    const toolbar = page.getByTestId("floating-drawing-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute("data-verified-controls", TREND_TOOLBAR_CONTROLS.join(" "));
    for (const control of TREND_TOOLBAR_CONTROLS) {
      await expect(toolbar.locator(`[data-name="${control}"]`)).toHaveCount(1);
    }

    const drawing = await getDrawing(page, id);
    expect(drawing?.variant).toBe("trend");
  });
});
