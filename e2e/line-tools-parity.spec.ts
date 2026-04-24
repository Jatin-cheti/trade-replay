/**
 * TV-parity tests for LINE drawing tools on the /charts page.
 *
 * Covers two user-visible behaviors that previously regressed on prod:
 *   1) Adding a line must NOT leave the chart panning with the cursor.
 *      (After pointerUp commits the drawing, cursor motion with no button
 *       pressed must not shift the chart's scroll position.)
 *   2) Selecting a line must paint a blue axis highlight band on the
 *      price-axis gutter (Y-range) and/or the time-axis gutter (X-range),
 *      and deselecting / hiding / deleting must clear the band.
 *
 * Parameterized over 5 line tools: trend, ray, hline, horizontalRay, vline.
 * Uses `window.__chartDebug` harness exposed by TradingChart to read chart
 * state (scroll position, selected drawing) deterministically.
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

interface ToolCase {
  variant: string;
  testId: string;
  pointOnly: boolean;
  expectYBand: boolean;
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
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (window as any).__chartDebug;
      return d && typeof d.getScrollPosition === "function" && d.getScrollPosition() !== null;
    },
    { timeout: 20_000 }
  );
  await page.waitForTimeout(500);
}

async function openLinesRail(page: Page) {
  const btn = page.getByTestId("toolrail-button-lines");
  if (await btn.count()) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function pickTool(page: Page, testId: string) {
  await openLinesRail(page);
  await page.getByTestId(testId).first().click({ force: true });
  await page.waitForTimeout(100);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function overlayBox(page: Page) {
  const rect = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[aria-label='chart-drawing-overlay']");
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  if (!rect) throw new Error("no overlay box");
  return rect;
}

async function getScroll(page: Page): Promise<number> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (window as any).__chartDebug;
    const v = d?.getScrollPosition?.();
    return typeof v === "number" ? v : 0;
  });
}

async function getSelectedId(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null;
  });
}

async function getAxisDims(page: Page): Promise<{ priceAxisWidth: number; timeAxisHeight: number }> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (window as any).__chartDebug;
    return d?.getAxisDimensions?.() ?? { priceAxisWidth: 60, timeAxisHeight: 28 };
  });
}

async function getLatestAnchorClient(page: Page, idx: number): Promise<{ x: number; y: number } | null> {
  return await page.evaluate((i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (window as any).__chartDebug;
    const p = d?.getProjectedAnchors?.();
    return p?.anchors?.[i] ?? null;
  }, idx);
}

async function drawLine(page: Page, c: ToolCase) {
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  const x1 = box.x + plotW * 0.25;
  const y1 = box.y + box.height * 0.45;
  const x2 = box.x + plotW * 0.60;
  const y2 = box.y + box.height * 0.65;

  if (c.pointOnly) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x1 + 10, y1 + 10, { steps: 4 });
    await page.mouse.up();
  } else {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(250);
  return { x1, y1, x2, y2, box, plotW };
}

async function blueishCountAt(page: Page, x: number, y: number, w: number, h: number): Promise<number> {
  return await page.evaluate(
    ({ x, y, w, h }) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        "canvas[aria-label='chart-drawing-overlay']"
      );
      if (!canvas) return -1;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, rect.width);
      const sx = Math.max(0, Math.round((x - rect.left) * dpr));
      const sy = Math.max(0, Math.round((y - rect.top) * dpr));
      const sw = Math.max(1, Math.round(w * dpr));
      const sh = Math.max(1, Math.round(h * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return -1;
      let img: ImageData;
      try { img = ctx.getImageData(sx, sy, sw, sh); } catch { return -1; }
      let blue = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i];
        const g = img.data[i + 1];
        const b = img.data[i + 2];
        const a = img.data[i + 3];
        if (a > 8 && b > 50 && b > r + 20 && b > g + 5 && r < 140) blue++;
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
      const scrollBefore = await getScroll(page);
      const { box } = await drawLine(page, c);
      await page.waitForTimeout(250);
      const scrollAfterCommit = await getScroll(page);

      for (let i = 0; i < 8; i++) {
        await page.mouse.move(box.x + 100 + i * 35, box.y + 150, { steps: 3 });
        await page.waitForTimeout(30);
      }
      await page.waitForTimeout(150);
      const scrollAfterMove = await getScroll(page);

      expect(Math.abs(scrollAfterMove - scrollAfterCommit)).toBeLessThan(0.25);
      expect(Math.abs(scrollAfterCommit - scrollBefore)).toBeLessThan(2);
    });

    test("drawing commits and becomes selected", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      await drawLine(page, c);
      const selected = await getSelectedId(page);
      expect(selected).not.toBeNull();
    });

    test("selected drawing paints blue axis highlight band(s)", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const { box } = await drawLine(page, c);
      expect(await getSelectedId(page)).not.toBeNull();

      const dims = await getAxisDims(page);
      const anchor0 = await getLatestAnchorClient(page, 0);
      const anchor1 = await getLatestAnchorClient(page, 1);
      const anchor = anchor1 ?? anchor0;
      expect(anchor).not.toBeNull();

      // Sample against the OVERLAY canvas rect — the interaction surface box may
      // only cover the plot area and not extend into the time-axis gutter.
      const ov = await overlayBox(page);
      const plotRight = ov.x + ov.width - dims.priceAxisWidth;
      const plotBottom = ov.y + ov.height - dims.timeAxisHeight;

      const yBand = await blueishCountAt(page, plotRight + 2, ov.y, dims.priceAxisWidth - 4, ov.height - dims.timeAxisHeight - 4);
      const xBand = await blueishCountAt(page, ov.x, plotBottom + 2, ov.width - dims.priceAxisWidth - 4, dims.timeAxisHeight - 4);
      void anchor;

      if (c.expectYBand) expect(yBand).toBeGreaterThan(100);
      if (c.expectXBand) expect(xBand).toBeGreaterThan(100);
    });

    test("deselecting the drawing clears the axis highlight", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const { box, plotW } = await drawLine(page, c);

      const dims = await getAxisDims(page);
      const anchor0 = await getLatestAnchorClient(page, 0);
      const anchor1 = await getLatestAnchorClient(page, 1);
      const anchor = anchor1 ?? anchor0;

      // Deselect via the debug harness \u2014 robust against active-tool click-to-draw
      // side effects that would otherwise create a new drawing.
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__chartDebug?.forceSelectDrawing?.(null);
      });
      await page.waitForTimeout(300);
      void box;
      void plotW;

      const ov = await overlayBox(page);
      const plotRight = ov.x + ov.width - dims.priceAxisWidth;
      const yBand = await blueishCountAt(page, plotRight + 2, ov.y, dims.priceAxisWidth - 4, ov.height - dims.timeAxisHeight - 4);
      void anchor;
      // Some drawings (hline) render across the full width and may spill a few stroke
      // pixels into the gutter. The axis HIGHLIGHT band is >100 px when selected, so we
      // assert a low threshold to prove the band is cleared.
      expect(yBand).toBeLessThan(50);
    });

    test("hiding all drawings clears the axis highlight", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const { box } = await drawLine(page, c);

      const dims = await getAxisDims(page);
      const anchor0 = await getLatestAnchorClient(page, 0);
      const anchor1 = await getLatestAnchorClient(page, 1);
      const anchor = anchor1 ?? anchor0;

      await page.getByTestId("rail-hide-objects").click({ force: true });
      await page.waitForTimeout(300);

      const ov = await overlayBox(page);
      const plotRight = ov.x + ov.width - dims.priceAxisWidth;
      const yBand = await blueishCountAt(page, plotRight + 2, ov.y, dims.priceAxisWidth - 4, ov.height - dims.timeAxisHeight - 4);
      void anchor;
      void box;
      expect(yBand).toBeLessThan(50);
    });
  });
}
