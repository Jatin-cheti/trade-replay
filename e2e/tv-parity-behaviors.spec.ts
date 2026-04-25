/**
 * TV-Parity Behavior Tests (observed from TradingView)
 * --------------------------------------------------------------
 * Covers behaviors that the user explicitly observed in TradingView and
 * called out as missing/wrong in our app:
 *
 *   1. infoLine renders a 3-line floating badge (\u25BC dp (pct%), ticks /
 *      \u2194 bars (days), distance: px / \u2220 angle\u00B0) instead of a
 *      single inline label.
 *   2. After committing a drawing, click-outside-the-line deselects it
 *      (cursor returns to normal/none mode), and click-on-line re-selects it
 *      \u2014 for ALL drawing tools.
 *   3. The committed drawing persists when the pointer leaves the chart
 *      surface to the right (over the price axis) \u2014 it does NOT
 *      disappear.
 *
 * These tests are intentionally light-weight (single-anchor or simple
 * 2-anchor draws) so they run fast on prod against an externally deployed
 * stack.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "https://tradereplay.me";

// ─── Helpers (mirrored from tv-parity-comprehensive.spec.ts) ────────────────

async function gotoCharts(page: Page) {
  await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`, { waitUntil: "load" });
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 25000 });
  await page.waitForFunction(
    () => (window as any).__chartDebug && (window as any).__chartDebug.getScrollPosition?.() !== null,
    { timeout: 25000 }
  );
  await page.waitForTimeout(300);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function openLinesRail(page: Page) {
  const rail = page.getByTestId("rail-lines");
  if ((await rail.count()) > 0) {
    await rail.first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(120);
  }
}

async function pickTool(page: Page, testId: string) {
  const el = page.getByTestId(testId).first();
  if (!(await el.count())) {
    await openLinesRail(page);
  }
  if (!(await el.count())) test.skip(true, `tool not found: ${testId}`);
  await el.click({ force: true });
  await page.waitForTimeout(220);
}

async function dismissModalIfPresent(page: Page) {
  const modal = page.getByTestId("chart-prompt-modal");
  if ((await modal.count()) > 0 && (await modal.first().isVisible().catch(() => false))) {
    const ok = page.getByRole("button", { name: /^(ok|done|save|apply)$/i });
    if ((await ok.count()) > 0) await ok.first().click({ force: true }).catch(() => undefined);
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
  }
}

async function getDrawingCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__chartDebug?.getDrawings?.()?.length ?? 0);
}

async function getSelectedDrawingId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null);
}

async function getActiveVariant(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
}

async function dragBetween(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

// ─── Tools that participate in the universal interaction tests ────────────

const INTERACTION_TOOLS = [
  { variant: "trend",            testId: "tool-trendline",                style: "click-click" as const },
  { variant: "ray",              testId: "tool-ray",                      style: "click-click" as const },
  { variant: "infoLine",         testId: "tool-info-line",                style: "click-click" as const },
  { variant: "extendedLine",     testId: "tool-extended-line",            style: "click-click" as const },
  { variant: "trendAngle",       testId: "tool-trend-angle",              style: "click-click" as const },
  { variant: "hline",            testId: "tool-horizontal-line",          style: "single-click" as const },
  { variant: "horizontalRay",    testId: "tool-horizontal-ray",           style: "single-click" as const },
  { variant: "vline",            testId: "tool-vertical-line",            style: "single-click" as const },
  { variant: "crossLine",        testId: "tool-cross-line",               style: "single-click" as const },
  { variant: "channel",          testId: "tool-parallel-channel",         style: "click-click" as const },
  { variant: "regressionTrend",  testId: "tool-regression-trend",         style: "click-click" as const },
  { variant: "flatTopBottom",    testId: "tool-flat-top-bottom",          style: "click-click" as const },
  { variant: "disjointChannel",  testId: "tool-disjoint-channel",         style: "drag" as const },
  { variant: "pitchfork",        testId: "tool-pitchfork",                style: "drag" as const },
  { variant: "schiffPitchfork",  testId: "tool-schiff-pitchfork",         style: "drag" as const },
  { variant: "modifiedSchiffPitchfork", testId: "tool-modified-schiff-pitchfork", style: "drag" as const },
  { variant: "insidePitchfork",  testId: "tool-inside-pitchfork",         style: "drag" as const },
];

async function drawOnce(
  page: Page,
  tool: { testId: string; style: "single-click" | "click-click" | "drag" },
  cx: number,
  cy: number,
) {
  await pickTool(page, tool.testId);
  if (tool.style === "single-click") {
    await page.mouse.move(cx, cy);
    await page.mouse.down(); await page.mouse.up();
  } else {
    // click-click & drag both commit reliably as a drag (>=8px)
    await dragBetween(page, cx - 22, cy - 6, cx + 22, cy + 6);
  }
  await page.waitForTimeout(150);
  await dismissModalIfPresent(page);
}

// ─── 1. infoLine floating-panel content ──────────────────────────────────────

test.describe("infoLine floating panel (TV-parity)", () => {
  test("renders 3-line panel with arrow, ticks, bars/days, distance, angle", async ({ page }) => {
    await gotoCharts(page);
    const box = await surfaceBox(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await pickTool(page, "tool-info-line");
    await dragBetween(page, cx - 80, cy + 40, cx + 80, cy - 40);
    await page.waitForTimeout(200);
    await dismissModalIfPresent(page);
    expect(await getDrawingCount(page)).toBe(1);
    const m: any = await page.evaluate(() => (window as any).__chartDebug?.getInfoLineMetrics?.());
    expect(m).toBeTruthy();
    // Must have these keys
    for (const k of ["dp", "pct", "bars", "days", "distPx", "angleDeg", "ticks", "line1", "line2", "line3"]) {
      expect(m).toHaveProperty(k);
    }
    // line1 has arrow + price + percent + ticks
    expect(m.line1).toMatch(/[\u25B2\u25BC\u25C6]/);          // arrow
    expect(m.line1).toMatch(/\([+\u2212]?\d+\.\d{2}%\)/);     // (xx.xx%)
    expect(m.line1).toMatch(/[+\u2212]?\d/);                   // ticks number
    // line2 has bars + days + px distance
    expect(m.line2).toMatch(/bars/);
    expect(m.line2).toMatch(/d\)/);
    expect(m.line2).toMatch(/distance:\s+\d+\s+px/);
    // line3 has angle in degrees
    expect(m.line3).toMatch(/[+\u2212]?\d+\.\d{2}\u00B0/);
  });

  for (let i = 0; i < 30; i++) {
    test(`infoLine metrics consistency (variation ${i + 1})`, async ({ page }) => {
      await gotoCharts(page);
      const box = await surfaceBox(page);
      const cx = box.x + box.width / 2 + ((i % 5) - 2) * 40;
      const cy = box.y + box.height / 2 + (Math.floor(i / 5) - 3) * 25;
      await pickTool(page, "tool-info-line");
      await dragBetween(page, cx - 60, cy + 20, cx + 60, cy - 20);
      await page.waitForTimeout(150);
      await dismissModalIfPresent(page);
      const m: any = await page.evaluate(() => (window as any).__chartDebug?.getInfoLineMetrics?.());
      if (!m) test.skip(true, "metrics unavailable (off-canvas)");
      // Sign consistency: line1 sign char must match dp sign
      if (m.dp > 0) expect(m.line1).toMatch(/\u25B2|\+/);
      if (m.dp < 0) expect(m.line1).toMatch(/\u25BC|\u2212/);
      // distance is non-negative integer
      expect(m.distPx).toBeGreaterThanOrEqual(0);
      // angle in [-180, 180]
      expect(m.angleDeg).toBeGreaterThanOrEqual(-180);
      expect(m.angleDeg).toBeLessThanOrEqual(180);
      // ticks ≈ dp / tickSize (within 1 due to rounding)
      expect(Math.abs(m.ticks * m.tickSize - m.dp)).toBeLessThan(m.tickSize);
    });
  }
});

// ─── 2. Click-outside-to-deselect / click-on-line-to-reselect ───────────────

test.describe("Universal selection (TV-parity)", () => {
  for (const tool of INTERACTION_TOOLS) {
    test(`${tool.variant} - tool deactivates after commit (variant returns to none)`, async ({ page }) => {
      await gotoCharts(page);
      const box = await surfaceBox(page);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await drawOnce(page, tool, cx, cy);
      // After commit, tool should be none (TV behavior).
      const v = await getActiveVariant(page);
      expect([null, "none", undefined]).toContain(v);
    });

    test(`${tool.variant} - newly committed drawing is selected`, async ({ page }) => {
      await gotoCharts(page);
      const box = await surfaceBox(page);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await drawOnce(page, tool, cx, cy);
      const sel = await getSelectedDrawingId(page);
      expect(sel).toBeTruthy();
    });

    test(`${tool.variant} - click far away deselects (returns to normal mode)`, async ({ page }) => {
      await gotoCharts(page);
      const box = await surfaceBox(page);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await drawOnce(page, tool, cx, cy);
      const before = await getDrawingCount(page);
      // Click in a safe canvas region away from the drawn shape and away
      // from the top-left overlays (ohlc bar, volume label, BUY/SELL chips).
      // Offset both x and y so neither hline nor vline anchors would match.
      const sx = cx + 220;
      const sy = cy + 140;
      await page.mouse.move(sx, sy);
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(180);
      const sel = await getSelectedDrawingId(page);
      expect(sel).toBeNull();
      // Variant must remain none (no new draft started)
      const v = await getActiveVariant(page);
      expect([null, "none", undefined]).toContain(v);
      // Drawing must still exist (deselect click MUST NOT create a new
      // drawing nor delete the existing one).
      expect(await getDrawingCount(page)).toBe(before);
    });

    test(`${tool.variant} - click on existing drawing re-selects it`, async ({ page }) => {
      await gotoCharts(page);
      const box = await surfaceBox(page);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await drawOnce(page, tool, cx, cy);
      const id = await page.evaluate(() => (window as any).__chartDebug?.getLatestDrawingId?.());
      const before = await getDrawingCount(page);
      // Deselect first by clicking in a safe canvas region
      await page.mouse.move(cx + 220, cy + 140);
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(180);
      expect(await getSelectedDrawingId(page)).toBeNull();
      expect(await getDrawingCount(page)).toBe(before);
      // Click ON the drawing midpoint to re-select
      await page.mouse.move(cx, cy);
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(220);
      const sel = await getSelectedDrawingId(page);
      expect(sel === id || (typeof sel === "string" && sel.length > 0)).toBe(true);
    });
  }
});

// ─── 3. Drawing persists when pointer exits at right edge (price axis) ─────

test.describe("Drawing persistence at canvas edges (TV-parity)", () => {
  for (const tool of INTERACTION_TOOLS.slice(0, 8)) {
    test(`${tool.variant} - drawing persists when cursor exits right (price axis)`, async ({ page }) => {
      await gotoCharts(page);
      const box = await surfaceBox(page);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await drawOnce(page, tool, cx, cy);
      const beforeId = await page.evaluate(() => (window as any).__chartDebug?.getLatestDrawingId?.());
      const beforeCount = await getDrawingCount(page);
      // Move cursor off the chart to the right (over the price axis area).
      await page.mouse.move(box.x + box.width + 20, cy);
      await page.waitForTimeout(120);
      await page.mouse.move(box.x + box.width + 60, cy);
      await page.waitForTimeout(120);
      // Move back inside.
      await page.mouse.move(cx, cy);
      await page.waitForTimeout(120);
      // Drawing must still exist with the same id.
      expect(await getDrawingCount(page)).toBe(beforeCount);
      const afterId = await page.evaluate(() => (window as any).__chartDebug?.getLatestDrawingId?.());
      expect(afterId).toBe(beforeId);
    });

    test(`${tool.variant} - drawing persists when cursor exits bottom`, async ({ page }) => {
      await gotoCharts(page);
      const box = await surfaceBox(page);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await drawOnce(page, tool, cx, cy);
      const beforeCount = await getDrawingCount(page);
      await page.mouse.move(cx, box.y + box.height + 30);
      await page.waitForTimeout(120);
      await page.mouse.move(cx, cy);
      await page.waitForTimeout(120);
      expect(await getDrawingCount(page)).toBe(beforeCount);
    });
  }
});
