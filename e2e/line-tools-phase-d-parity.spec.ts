/**
 * TV-parity Phase D: interaction behaviors for 5 anchor-2 line tools.
 *
 * Scenarios per tool (× 5 tools = 25 tests):
 *  1. keyboard Delete removes the selected drawing AND hides the floating toolbar
 *  2. hover over the line body sets hoveredDrawingId (toolbar stays absent until selected)
 *  3. dragging anchor[0] moves the drawing's first endpoint (and toolbar re-anchors)
 *  4. dragging anchor[1] moves the drawing's second endpoint (and toolbar re-anchors)
 *  5. magnet/snap mode persists across reload (localStorage-backed)
 *
 * Runs against prod via E2E_TARGET_URL=https://tradereplay.me.
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

interface ToolCase {
  variant: string;
  testId: string;
}

const CASES: ToolCase[] = [
  { variant: "trend", testId: "tool-trendline" },
  { variant: "ray", testId: "tool-ray" },
  { variant: "infoLine", testId: "tool-info-line" },
  { variant: "extendedLine", testId: "tool-extended-line" },
  { variant: "trendAngle", testId: "tool-trend-angle" },
];

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
  await page.waitForTimeout(400);
}

async function openLinesRail(page: Page) {
  const btn = page.getByTestId("toolrail-button-lines");
  if (await btn.count()) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(100);
  }
}

async function pickTool(page: Page, testId: string) {
  await openLinesRail(page);
  const el = page.getByTestId(testId).first();
  if (!(await el.count())) test.skip(true, `tool not found: ${testId}`);
  await el.click({ force: true });
  await page.waitForTimeout(60);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function clickAt(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(40);
}

async function drawLine(page: Page, testId: string): Promise<string> {
  await pickTool(page, testId);
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  const x1 = box.x + plotW * 0.30;
  const y1 = box.y + box.height * 0.50;
  const x2 = box.x + plotW * 0.70;
  const y2 = box.y + box.height * 0.35;
  await clickAt(page, x1, y1);
  await clickAt(page, x2, y2);
  await page.waitForTimeout(150);
  const id = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.getLatestDrawingId?.() ?? null,
  );
  if (!id) throw new Error("no drawing id after draw");
  return id as string;
}

async function selectDrawing(page: Page, id: string | null) {
  await page.evaluate((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.forceSelectDrawing?.(d);
  }, id);
  await page.waitForTimeout(80);
}

async function getDrawing(page: Page, id: string) {
  return await page.evaluate((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr = (window as any).__chartDebug?.getDrawings?.() || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arr.find((x: any) => x.id === d) || null;
  }, id);
}

async function getProjectedAnchors(page: Page, id: string): Promise<{ x: number; y: number }[]> {
  const res = await page.evaluate((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (window as any).__chartDebug?.getProjectedAnchors?.(d);
    return r ? r.anchors : null;
  }, id);
  if (!res) throw new Error("no projected anchors");
  return res as { x: number; y: number }[];
}

async function getToolbarState(page: Page) {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getFloatingToolbarState?.() ?? null;
  });
}

for (const c of CASES) {
  test.describe(`Line tools Phase D — ${c.variant}`, () => {
    test("keyboard Delete removes selected drawing and hides floating toolbar", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      // focus the body so the keyboard listener fires
      await page.locator("body").click({ position: { x: 5, y: 5 } });
      // re-select since body click cleared selection
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      const after = await page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__chartDebug?.getDrawings?.() || [],
      );
      expect((after as Array<{ id: string }>).find((d) => d.id === id)).toBeUndefined();
      await expect(page.getByTestId("floating-drawing-toolbar")).toHaveCount(0);
    });

    test("hover over line body sets hoveredDrawingId without forcing selection", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      // Clear selection first
      await selectDrawing(page, null);
      await page.waitForTimeout(100);
      const hoveredBefore = await page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__chartDebug?.getHoveredDrawingId?.() ?? null,
      );
      expect(hoveredBefore).toBeNull();
      // Move mouse to midpoint of the line
      const [a, b] = await getProjectedAnchors(page, id);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      await page.mouse.move(mx + 50, my + 50);
      await page.waitForTimeout(60);
      await page.mouse.move(mx, my);
      await page.waitForTimeout(150);
      // Hover should set hoveredDrawingId (or be near it — allow for small hit misses on steep angles)
      const hovered = await page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__chartDebug?.getHoveredDrawingId?.() ?? null,
      );
      expect(hovered).toBe(id);
      // Floating toolbar should NOT appear for hover-only (requires selection)
      await expect(page.getByTestId("floating-drawing-toolbar")).toHaveCount(0);
    });

    test("dragging anchor[0] moves first endpoint and toolbar re-anchors", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const before = await getDrawing(page, id);
      const beforeToolbar = await getToolbarState(page);
      const anchors = await getProjectedAnchors(page, id);
      const start = anchors[0];
      const dx = 40;
      const dy = -30;
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 4 });
      await page.mouse.move(start.x + dx, start.y + dy, { steps: 4 });
      await page.waitForTimeout(60);
      await page.mouse.up();
      await page.waitForTimeout(160);
      const after = await getDrawing(page, id);
      const afterToolbar = await getToolbarState(page);
      // Anchor 0 should have moved (either price or time differs)
      const a0Before = before.anchors[0];
      const a0After = after.anchors[0];
      const moved =
        Math.abs((a0Before.time as number) - (a0After.time as number)) > 0.0001 ||
        Math.abs(a0Before.price - a0After.price) > 0.0001;
      expect(moved).toBe(true);
      // Toolbar still visible and repositioned
      expect(afterToolbar?.visible).toBe(true);
      expect(afterToolbar?.drawingId).toBe(id);
      expect(
        Math.abs((afterToolbar?.centerX ?? 0) - (beforeToolbar?.centerX ?? 0)) +
          Math.abs((afterToolbar?.centerY ?? 0) - (beforeToolbar?.centerY ?? 0)),
      ).toBeGreaterThan(1);
    });

    test("dragging anchor[1] moves second endpoint and toolbar re-anchors", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const before = await getDrawing(page, id);
      const beforeToolbar = await getToolbarState(page);
      const anchors = await getProjectedAnchors(page, id);
      const start = anchors[1];
      const dx = -40;
      const dy = 30;
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 4 });
      await page.mouse.move(start.x + dx, start.y + dy, { steps: 4 });
      await page.waitForTimeout(60);
      await page.mouse.up();
      await page.waitForTimeout(160);
      const after = await getDrawing(page, id);
      const afterToolbar = await getToolbarState(page);
      const a1Before = before.anchors[1];
      const a1After = after.anchors[1];
      const moved =
        Math.abs((a1Before.time as number) - (a1After.time as number)) > 0.0001 ||
        Math.abs(a1Before.price - a1After.price) > 0.0001;
      expect(moved).toBe(true);
      expect(afterToolbar?.visible).toBe(true);
      expect(afterToolbar?.drawingId).toBe(id);
      expect(
        Math.abs((afterToolbar?.centerX ?? 0) - (beforeToolbar?.centerX ?? 0)) +
          Math.abs((afterToolbar?.centerY ?? 0) - (beforeToolbar?.centerY ?? 0)),
      ).toBeGreaterThan(1);
    });

    test("magnet mode persists via localStorage and is reflected in __chartDebug.getMagnetMode", async ({ page }) => {
      await gotoCharts(page);
      // Ensure a drawing exists so toolbar tests remain relevant for this tool
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      // Set magnet mode ON via localStorage and reload
      await page.evaluate(() => window.localStorage.setItem("chart-magnet-mode", "true"));
      await page.reload();
      await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 20_000 });
      await page.waitForFunction(
        () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = (window as any).__chartDebug;
          return d && typeof d.getMagnetMode === "function";
        },
        { timeout: 20_000 }
      );
      const on = await page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__chartDebug?.getMagnetMode?.(),
      );
      expect(on).toBe(true);
      // Flip OFF and reload
      await page.evaluate(() => window.localStorage.setItem("chart-magnet-mode", "false"));
      await page.reload();
      await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 20_000 });
      await page.waitForFunction(
        () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = (window as any).__chartDebug;
          return d && typeof d.getMagnetMode === "function";
        },
        { timeout: 20_000 }
      );
      const off = await page.evaluate(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__chartDebug?.getMagnetMode?.(),
      );
      expect(off).toBe(false);
    });
  });
}
