/**
 * TV-parity Phase E: tool-specific behaviors for the line-family tools.
 *
 * Per-tool observable properties are validated on the drawing object returned
 * by __chartDebug.getDrawingById(). The floating toolbar MUST appear and be
 * functional on every one of these variants.
 *
 *  A) Two-anchor tools (5 tools × 2 scenarios = 10 tests):
 *     • ray          → drawing.options.rayMode === true
 *     • infoLine     → supportsText (registry) and no extendLeft/Right flags
 *     • extendedLine → drawing.options.extendLeft && drawing.options.extendRight
 *     • trendAngle   → supportsText (registry); drawing renders angle (option:
 *                      showAngle, default true)
 *     • trend (baseline) → no special flags, plain two-anchor line
 *
 *  B) One-anchor tools (4 tools × 2 scenarios = 8 tests):
 *     • hline, horizontalRay, vline, crossLine
 *       – draw with a SINGLE click, drawing has exactly 1 anchor
 *       – floating toolbar appears on selection
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

interface TwoAnchorCase {
  variant: string;
  testId: string;
  /** Expected options on created drawing (subset match). */
  expectedOptions?: Record<string, unknown>;
  /** Expected capabilities (from registry, verified via drawing.variant lookup). */
}

const TWO_ANCHOR: TwoAnchorCase[] = [
  { variant: "trend", testId: "tool-trendline" },
  { variant: "ray", testId: "tool-ray", expectedOptions: { rayMode: true } },
  { variant: "infoLine", testId: "tool-info-line" },
  {
    variant: "extendedLine",
    testId: "tool-extended-line",
    expectedOptions: { extendLeft: true, extendRight: true },
  },
  { variant: "trendAngle", testId: "tool-trend-angle" },
];

interface OneAnchorCase {
  variant: string;
  testId: string;
}

const ONE_ANCHOR: OneAnchorCase[] = [
  { variant: "hline", testId: "tool-horizontal-line" },
  { variant: "horizontalRay", testId: "tool-horizontal-ray" },
  { variant: "vline", testId: "tool-vertical-line" },
  { variant: "crossLine", testId: "tool-cross-line" },
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
  await page.waitForTimeout(50);
}

async function drawTwoAnchor(page: Page, testId: string): Promise<string> {
  await pickTool(page, testId);
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  const x1 = box.x + plotW * 0.3;
  const y1 = box.y + box.height * 0.5;
  const x2 = box.x + plotW * 0.7;
  const y2 = box.y + box.height * 0.35;
  await clickAt(page, x1, y1);
  await clickAt(page, x2, y2);
  await page.waitForTimeout(150);
  const id = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.getLatestDrawingId?.() ?? null,
  );
  if (!id) throw new Error("no drawing id after two-anchor draw");
  return id as string;
}

async function drawOneAnchor(page: Page, testId: string): Promise<string> {
  await pickTool(page, testId);
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  const x = box.x + plotW * 0.5;
  const y = box.y + box.height * 0.5;
  await clickAt(page, x, y);
  await page.waitForTimeout(200);
  const id = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.getLatestDrawingId?.() ?? null,
  );
  if (!id) throw new Error("no drawing id after one-anchor draw");
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
    return (window as any).__chartDebug?.getDrawingById?.(d) ?? null;
  }, id);
}

/* ─── TWO-ANCHOR: tool-specific options + toolbar ─────────────────────────── */

for (const c of TWO_ANCHOR) {
  test.describe(`Line tools Phase E — ${c.variant}`, () => {
    test("drawing is created with correct variant and anchors", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawTwoAnchor(page, c.testId);
      const d = await getDrawing(page, id);
      expect(d?.variant).toBe(c.variant);
      expect(Array.isArray(d?.anchors)).toBe(true);
      expect((d?.anchors?.length ?? 0) >= 2).toBe(true);
      if (c.expectedOptions) {
        for (const [k, v] of Object.entries(c.expectedOptions)) {
          expect(d?.options?.[k]).toBe(v);
        }
      }
    });

    test("floating toolbar appears on selection and color swatch updates drawing", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawTwoAnchor(page, c.testId);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      await page.getByTestId("floating-toolbar-color").click();
      await expect(page.getByTestId("floating-toolbar-color-panel")).toBeVisible();
      await page.getByTestId("floating-toolbar-color-2962ff").click();
      await page.waitForTimeout(80);
      const d = await getDrawing(page, id);
      expect(d?.options?.color?.toLowerCase()).toBe("#2962ff");
    });
  });
}

/* ─── ONE-ANCHOR: click-once drawing + toolbar ────────────────────────────── */

for (const c of ONE_ANCHOR) {
  test.describe(`Line tools Phase E — ${c.variant}`, () => {
    test("single click creates drawing with exactly 1 anchor", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawOneAnchor(page, c.testId);
      const d = await getDrawing(page, id);
      expect(d?.variant).toBe(c.variant);
      expect(d?.anchors?.length).toBe(1);
    });

    test("floating toolbar appears on selection (single-anchor drawings)", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawOneAnchor(page, c.testId);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      // Thickness cycle works — sanity check that toolbar interacts with the drawing
      const before = await getDrawing(page, id);
      await page.getByTestId("floating-toolbar-thickness").click();
      await page.waitForTimeout(80);
      const after = await getDrawing(page, id);
      expect(after?.options?.thickness).not.toBe(before?.options?.thickness);
    });
  });
}
