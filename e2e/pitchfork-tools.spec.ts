/**
 * TV-parity Phase G: Pitchfork tools (4 variants).
 *
 * Pitchfork variants are wizard-mode drawings (family='fib', 3 anchors) that
 * require three sequential clicks to commit.
 *
 * Scenarios per variant (× 4 = 12 tests):
 *  1. Drawing is created with correct variant and 3 anchors.
 *  2. Floating toolbar appears on selection; color swatch updates drawing.
 *  3. Floating toolbar thickness cycles options.thickness.
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

interface PitchforkCase {
  variant: string;
  testId: string;
}

const CASES: PitchforkCase[] = [
  { variant: "pitchfork", testId: "tool-pitchfork" },
  { variant: "schiffPitchfork", testId: "tool-schiff-pitchfork" },
  { variant: "modifiedSchiffPitchfork", testId: "tool-modified-schiff-pitchfork" },
  { variant: "insidePitchfork", testId: "tool-inside-pitchfork" },
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
  await page.waitForTimeout(60);
}

async function drawPitchfork(page: Page, c: PitchforkCase): Promise<string> {
  await pickTool(page, c.testId);
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  const h = box.height;
  // Pitchforks are family='fib' with 3 anchors — not click-click and not
  // wizard. They commit on a single pointer drag (down → move → up), with
  // remaining anchors auto-filled.
  const p1 = { x: box.x + plotW * 0.30, y: box.y + h * 0.60 };
  const p2 = { x: box.x + plotW * 0.70, y: box.y + h * 0.35 };
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    const t = i / 6;
    await page.mouse.move(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
  const id = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.getLatestDrawingId?.() ?? null,
  );
  if (!id) throw new Error(`no drawing id after pitchfork draw (${c.variant})`);
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
  test.describe(`Pitchfork tools Phase G — ${c.variant}`, () => {
    test("drawing created with correct variant and 3 anchors", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawPitchfork(page, c);
      const d = await getDrawing(page, id);
      expect(d?.variant).toBe(c.variant);
      expect(d?.anchors?.length).toBe(3);
    });

    test("floating toolbar appears on selection and color swatch updates drawing", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawPitchfork(page, c);
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
      const id = await drawPitchfork(page, c);
      await selectDrawing(page, id);
      const before = await getDrawing(page, id);
      await page.getByTestId("floating-toolbar-thickness").click();
      await page.waitForTimeout(80);
      const after = await getDrawing(page, id);
      expect(after?.options?.thickness).not.toBe(before?.options?.thickness);
    });
  });
}
