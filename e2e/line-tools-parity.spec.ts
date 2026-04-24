/**
 * TV-parity tests for LINE drawing tools on the /charts page.
 *
 * Covers two user-visible behaviors that previously regressed on prod:
 *   1) Adding a line must NOT leave the chart panning with the cursor.
 *      (After pointerUp commits the drawing, cursor motion with no button
 *       pressed must not scroll the time-axis.)
 *   2) Selecting a line must paint a blue axis highlight band on the
 *      price-axis gutter (Y-range) and/or the time-axis gutter (X-range),
 *      and deselecting / hiding / deleting must clear the band.
 *
 * Parameterized over 5 line tools: trend, ray, hline, horizontalRay, vline.
 * Each tool runs the same behavior matrix, so this file scales with tools
 * rather than with copy-pasted test cases.
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

interface ToolCase {
  variant: string;
  testId: string;
  /** true = single-anchor tool (hline, vline, crossLine) */
  pointOnly: boolean;
  /** expect price-axis band visible */
  expectYBand: boolean;
  /** expect time-axis band visible */
  expectXBand: boolean;
}

const CASES: ToolCase[] = [
  { variant: "trend", testId: "tool-trendline", pointOnly: false, expectYBand: true, expectXBand: true },
  { variant: "ray", testId: "tool-ray", pointOnly: false, expectYBand: true, expectXBand: true },
  { variant: "hline", testId: "tool-horizontal-line", pointOnly: true, expectYBand: true, expectXBand: false },
  { variant: "horizontalRay", testId: "tool-horizontal-ray", pointOnly: false, expectYBand: true, expectXBand: true },
  { variant: "vline", testId: "tool-vertical-line", pointOnly: true, expectYBand: false, expectXBand: true },
];

async function gotoCharts(page: Page, symbol = "RELIANCE") {
  await page.goto(`${BASE_URL}/charts?symbol=${symbol}`);
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 20_000 });
  await page.waitForTimeout(2000);
}

async function openLinesRail(page: Page) {
  // The lines rail opens via its toolbar-button testid
  const btn = page.getByTestId("toolrail-button-lines");
  if (await btn.count()) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(200);
  }
}

async function pickTool(page: Page, testId: string) {
  await openLinesRail(page);
  const btn = page.getByTestId(testId).first();
  await btn.click({ force: true });
  await page.waitForTimeout(100);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  await expect(surface).toBeVisible();
  const box = await surface.boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function drawLine(page: Page, c: ToolCase) {
  const box = await surfaceBox(page);
  // Keep well inside the plot area, away from price-axis gutter.
  const plotW = box.width - 70;
  const x1 = box.x + plotW * 0.25;
  const y1 = box.y + box.height * 0.45;
  const x2 = box.x + plotW * 0.65;
  const y2 = box.y + box.height * 0.65;

  if (c.pointOnly) {
    // Drag a small distance so the single-click threshold doesn't remove it.
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x1 + 8, y1 + 8, { steps: 4 });
    await page.mouse.up();
  } else {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(200);
  return { x1, y1, x2, y2, box, plotW };
}

// Sample a 20×1 column of pixels at `x` on the overlay canvas, return the count
// of pixels that are "blueish" (our highlight uses rgba(33,150,243, ~0.22)).
async function blueishCountAt(page: Page, x: number, y: number, w: number, h: number): Promise<number> {
  return await page.evaluate(
    ({ x, y, w, h }) => {
      const canvas = document.querySelector(
        "[data-testid='chart-interaction-surface'] canvas:last-of-type"
      ) as HTMLCanvasElement | null;
      if (!canvas) return -1;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, rect.width);
      const sx = Math.max(0, Math.round((x - rect.left) * dpr));
      const sy = Math.max(0, Math.round((y - rect.top) * dpr));
      const sw = Math.max(1, Math.round(w * dpr));
      const sh = Math.max(1, Math.round(h * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return -1;
      const img = ctx.getImageData(sx, sy, sw, sh);
      let blue = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i];
        const g = img.data[i + 1];
        const b = img.data[i + 2];
        const a = img.data[i + 3];
        if (a > 10 && b > 120 && b > r + 20 && b > g + 10 && r < 160) blue++;
      }
      return blue;
    },
    { x, y, w, h }
  );
}

for (const c of CASES) {
  test.describe(`Line tool parity — ${c.variant}`, () => {
    test("drawing the line does not leave chart panning with cursor (no-click move)", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const { box } = await drawLine(page, c);

      // Record the time-axis label text before moving.
      const readRightEdgeTime = async () =>
        await page.evaluate(() => {
          const canvases = document.querySelectorAll(
            "[data-testid='chart-interaction-surface'] canvas"
          );
          return canvases.length ? canvases[0].toDataURL().slice(-64) : "";
        });

      const before = await readRightEdgeTime();
      // Move cursor across the plot with NO button pressed — this must NOT pan.
      for (let i = 0; i < 6; i++) {
        await page.mouse.move(box.x + 100 + i * 40, box.y + 150, { steps: 3 });
        await page.waitForTimeout(40);
      }
      const after = await readRightEdgeTime();
      // The candle canvas fingerprint should be stable (no pan happened).
      expect(after).toBe(before);
    });

    test("selected drawing paints blue axis highlight band(s)", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const { x2, y2, box, plotW } = await drawLine(page, c);

      // The drawing is auto-selected after commit. Sample the axis gutters.
      // Price-axis gutter is on the right (last ~60px).
      const yBand = await blueishCountAt(page, box.x + plotW + 5, y2 - 2, 50, 6);
      // Time-axis gutter is at the bottom (last ~28px).
      const xBand = await blueishCountAt(page, x2 - 2, box.y + box.height - 22, 6, 18);

      if (c.expectYBand) expect(yBand).toBeGreaterThan(0);
      if (c.expectXBand) expect(xBand).toBeGreaterThan(0);
    });

    test("deselecting the drawing clears the axis highlight", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const { box, plotW, y2 } = await drawLine(page, c);

      // Click an empty spot far from the drawing to deselect.
      await page.mouse.click(box.x + plotW * 0.9, box.y + 30);
      await page.waitForTimeout(300);

      const yBand = await blueishCountAt(page, box.x + plotW + 5, y2 - 2, 50, 6);
      expect(yBand).toBe(0);
    });

    test("hiding all drawings clears the axis highlight", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const { box, plotW, y2 } = await drawLine(page, c);

      // Click the "hide all drawings" rail button.
      const hideBtn = page.getByTestId("rail-hide-objects");
      await hideBtn.click({ force: true });
      await page.waitForTimeout(200);

      const yBand = await blueishCountAt(page, box.x + plotW + 5, y2 - 2, 50, 6);
      expect(yBand).toBe(0);
    });
  });
}
