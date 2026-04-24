/**
 * TV-parity tests for the FLOATING DRAWING TOOLBAR.
 *
 * Behaviors under test (per tool):
 *   1. Toolbar appears near a selected drawing (visible=true, has buttons).
 *   2. Toolbar disappears when selection is cleared.
 *   3. Color swatch opens palette; picking a color updates the drawing
 *      `options.color` without losing selection.
 *   4. Thickness button cycles the drawing's `options.thickness` 1→2→3→4→1.
 *   5. Style button cycles the drawing's `options.style`
 *      solid → dashed → dotted → solid.
 *   6. Lock button toggles `drawing.locked`.
 *   7. Visibility button toggles `drawing.visible`.
 *   8. Delete button removes the drawing and hides the toolbar.
 *   9. Duplicate produces a second drawing of the same variant.
 *  10. Toolbar re-anchors after panning/zooming (centerX shifts).
 *
 * Covers 5 anchor-2 line tools × 10 scenarios = 50 tests.
 * Runs against prod via E2E_TARGET_URL.
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
    await page.waitForTimeout(120);
  }
}

async function pickTool(page: Page, testId: string) {
  await openLinesRail(page);
  const el = page.getByTestId(testId).first();
  if (!(await el.count())) test.skip(true, `tool not found: ${testId}`);
  await el.click({ force: true });
  await page.waitForTimeout(80);
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
  await page.waitForTimeout(50);
}

/** Draw a two-anchor line and return its drawing id. */
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
  const id = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getLatestDrawingId?.() ?? null;
  });
  if (!id) throw new Error("no drawing id after draw");
  return id as string;
}

async function selectDrawing(page: Page, id: string) {
  await page.evaluate((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.forceSelectDrawing?.(d);
  }, id);
  await page.waitForTimeout(100);
}

async function getDrawing(page: Page, id: string) {
  return await page.evaluate((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr = (window as any).__chartDebug?.getDrawings?.() || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arr.find((x: any) => x.id === d) || null;
  }, id);
}

async function getToolbarState(page: Page) {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getFloatingToolbarState?.() ?? null;
  });
}

for (const c of CASES) {
  test.describe(`Floating toolbar — ${c.variant}`, () => {
    test("appears on selection", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const state = await getToolbarState(page);
      expect(state?.visible).toBe(true);
      expect(state?.drawingId).toBe(id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
    });

    test("hides on deselect", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      await selectDrawing(page, null as unknown as string);
      await page.waitForTimeout(100);
      await expect(page.getByTestId("floating-drawing-toolbar")).toHaveCount(0);
    });

    test("color picker updates drawing.options.color", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      await page.getByTestId("floating-toolbar-color").click();
      await expect(page.getByTestId("floating-toolbar-color-panel")).toBeVisible();
      // Pick red (#f23645 per palette)
      await page.getByTestId("floating-toolbar-color-f23645").click();
      await page.waitForTimeout(80);
      const d = await getDrawing(page, id);
      expect(d?.options?.color?.toLowerCase()).toBe("#f23645");
    });

    test("thickness cycles 1→2→3→4→1", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const before = await getDrawing(page, id);
      const start = before?.options?.thickness ?? 1;
      await page.getByTestId("floating-toolbar-thickness").click();
      await page.waitForTimeout(40);
      const after = await getDrawing(page, id);
      expect(after?.options?.thickness).not.toBe(start);
      // Cycle back to start after 4 clicks (cycle length 4).
      for (let i = 0; i < 3; i++) {
        await page.getByTestId("floating-toolbar-thickness").click();
        await page.waitForTimeout(25);
      }
      const full = await getDrawing(page, id);
      expect(full?.options?.thickness).toBe(start);
    });

    test("style cycles solid→dashed→dotted→solid", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const seen = new Set<string>();
      for (let i = 0; i < 4; i++) {
        const d = await getDrawing(page, id);
        seen.add(d?.options?.style);
        await page.getByTestId("floating-toolbar-style").click();
        await page.waitForTimeout(30);
      }
      // Should have seen all three styles at least.
      expect(seen.has("solid")).toBe(true);
      expect(seen.has("dashed")).toBe(true);
      expect(seen.has("dotted")).toBe(true);
    });

    test("lock button toggles drawing.locked", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const before = await getDrawing(page, id);
      expect(before?.locked).toBeFalsy();
      await page.getByTestId("floating-toolbar-lock").click();
      await page.waitForTimeout(60);
      const after = await getDrawing(page, id);
      expect(after?.locked).toBe(true);
      await page.getByTestId("floating-toolbar-lock").click();
      await page.waitForTimeout(60);
      const back = await getDrawing(page, id);
      expect(back?.locked).toBe(false);
    });

    test("visibility button toggles drawing.visible", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const before = await getDrawing(page, id);
      expect(before?.visible !== false).toBe(true);
      await page.getByTestId("floating-toolbar-visible").click();
      await page.waitForTimeout(60);
      const hidden = await getDrawing(page, id);
      expect(hidden?.visible).toBe(false);
      await page.getByTestId("floating-toolbar-visible").click();
      await page.waitForTimeout(60);
      const back = await getDrawing(page, id);
      expect(back?.visible).toBe(true);
    });

    test("delete button removes drawing", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      await page.getByTestId("floating-toolbar-delete").click();
      await page.waitForTimeout(100);
      const found = await getDrawing(page, id);
      expect(found).toBeNull();
      await expect(page.getByTestId("floating-drawing-toolbar")).toHaveCount(0);
    });

    test("duplicate produces a second drawing of the same variant", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const before = await page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (window as any).__chartDebug?.getDrawings?.()?.length ?? 0
      );
      await page.getByTestId("floating-toolbar-duplicate").click();
      await page.waitForTimeout(100);
      const after = await page.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => (window as any).__chartDebug?.getDrawings?.() ?? []
      );
      expect(after.length).toBe(before + 1);
      // New drawing is same variant.
      const variants = new Set(after.map((d: { variant: string }) => d.variant));
      expect(variants.has(c.variant)).toBe(true);
    });

    test("toolbar re-anchors after panning chart", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      const before = await getToolbarState(page);
      expect(before?.visible).toBe(true);
      // Pan chart by scrolling the time scale.
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (window as any).__chartDebug;
        if (!d?.scrollToPosition) return;
        const p = d.getScrollPosition?.() ?? 0;
        d.scrollToPosition(p - 40);
      });
      await page.waitForTimeout(200);
      const after = await getToolbarState(page);
      expect(after?.visible).toBe(true);
      // Center moved by at least a few pixels.
      expect(Math.abs((after?.centerX ?? 0) - (before?.centerX ?? 0))).toBeGreaterThan(2);
    });
  });
}
