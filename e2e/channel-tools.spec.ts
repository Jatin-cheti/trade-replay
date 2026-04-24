/**
 * TV-parity Phase F: Channel tools (4 variants).
 *
 * Scenarios per channel (× 4 channels = 12 tests):
 *  1. Drawing is created with correct variant and has the expected anchor count.
 *  2. Floating toolbar appears on selection, color swatch updates drawing.
 *  3. Floating toolbar thickness cycles update the drawing.
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

interface ChannelCase {
  variant: string;
  testId: string;
  anchors: number;
}

const CASES: ChannelCase[] = [
  { variant: "channel", testId: "tool-parallel-channel", anchors: 2 },
  { variant: "regressionTrend", testId: "tool-regression-trend", anchors: 2 },
  { variant: "flatTopBottom", testId: "tool-flat-top-bottom", anchors: 2 },
  { variant: "disjointChannel", testId: "tool-disjoint-channel", anchors: 4 },
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

async function drawChannel(page: Page, c: ChannelCase): Promise<string> {
  await pickTool(page, c.testId);
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  const h = box.height;
  // Click anchors across a comfortable region of the chart.
  // For 2-anchor channels, (0.30, 0.60) → (0.70, 0.40) — a slight diagonal.
  // For 4-anchor (disjointChannel), pick two well-separated pairs.
  const p1 = { x: box.x + plotW * 0.30, y: box.y + h * 0.60 };
  const p2 = { x: box.x + plotW * 0.70, y: box.y + h * 0.40 };
  if (c.anchors > 2) {
    // Non-click-click variants (>=3 anchors on line-family) commit via a
    // click-drag between two points (pointerdown → move → pointerup).
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i += 1) {
      const t = i / 6;
      await page.mouse.move(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
  } else {
    await clickAt(page, p1.x, p1.y);
    await clickAt(page, p2.x, p2.y);
    await page.waitForTimeout(150);
  }
  const id = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.getLatestDrawingId?.() ?? null,
  );
  if (!id) throw new Error(`no drawing id after channel draw (${c.variant})`);
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

for (const c of CASES) {
  test.describe(`Channel tools Phase F — ${c.variant}`, () => {
    test(`drawing created with correct variant and ${c.anchors} anchors`, async ({ page }) => {
      await gotoCharts(page);
      const id = await drawChannel(page, c);
      const d = await getDrawing(page, id);
      expect(d?.variant).toBe(c.variant);
      expect(d?.anchors?.length).toBe(c.anchors);
    });

    test("floating toolbar appears on selection and color swatch updates drawing", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawChannel(page, c);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      await page.getByTestId("floating-toolbar-color").click();
      await expect(page.getByTestId("floating-toolbar-color-panel")).toBeVisible();
      await page.getByTestId("floating-toolbar-color-2962ff").click();
      await page.waitForTimeout(80);
      const d = await getDrawing(page, id);
      expect(d?.options?.color?.toLowerCase()).toBe("#2962ff");
    });

    test("floating toolbar thickness button cycles options.thickness", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawChannel(page, c);
      await selectDrawing(page, id);
      const before = await getDrawing(page, id);
      await page.getByTestId("floating-toolbar-thickness").click();
      await page.waitForTimeout(80);
      const after = await getDrawing(page, id);
      expect(after?.options?.thickness).not.toBe(before?.options?.thickness);
    });
  });
}
