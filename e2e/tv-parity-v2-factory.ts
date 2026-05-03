/**
 * TV-Parity Comprehensive V2 Factory — 500 tests per tool.
 *
 * Tests TradingView-parity UI/UX features including:
 *   A. Draw + Variant Assertions (60)
 *   B. Floating Toolbar — Color picker (60)
 *   C. Floating Toolbar — Thickness cycling (40)
 *   D. Floating Toolbar — Style cycling (40)
 *   E. Floating Toolbar — Actions (lock, visible, duplicate, delete, settings) (60)
 *   F. Selection & Deselect (40)
 *   G. Keyboard shortcuts (Escape, Delete, Backspace, Ctrl+Z) (50)
 *   H. Undo/Redo sequences (50)
 *   I. Persistence (pan, zoom) (40)
 *   J. Multi-drawing (30)
 *   K. Edge cases (30)
 *
 * Total: 500 tests per tool.
 *
 * Usage:
 *   import { registerV2ToolSuite } from "./tv-parity-v2-factory";
 *   registerV2ToolSuite({ variant: "trend", testId: "tool-trendline" });
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "https://tradereplay.me";
const SYMBOL = "RELIANCE";

// TradingView palette — must match FloatingDrawingToolbar.tsx COLOR_PALETTE
const TV_PALETTE = [
  "#2962ff", "#2196f3", "#00bcd4", "#00e676",
  "#ffd600", "#ff9100", "#f23645", "#e91e63",
  "#9c27b0", "#ffffff", "#9e9e9e", "#000000",
];

const THICKNESS_CYCLE = [1, 2, 3, 4];
const STYLE_CYCLE: Array<"solid" | "dashed" | "dotted"> = ["solid", "dashed", "dotted"];

export type ToolDefV2 = {
  /** Variant string returned by __chartDebug.getActiveVariant() */
  variant: string;
  /** data-testid of the toolbar button */
  testId: string;
  /** Optional rail testId (defaults to "rail-lines") */
  railTestId?: string;
  /** Expected anchor count after draw (defaults to 2) */
  anchorCount?: number;
  /**
   * Commit mode:
   *  - "drag"           — mouse-down → move → up (default)
   *  - "click"          — single click (hline, vline, crossLine, horizontalRay)
   *  - "click-sequence" — N clicks placed sequentially (patterns, channels, elliott)
   */
  commitMode?: "drag" | "click" | "click-sequence";
  /**
   * Rendered geometry shape for selection offset calculation.
   * Defaults to "segment".
   */
  selectionGeometry?: "segment" | "horizontal" | "vertical" | "cross" | "horizontalRay";
};

export function registerV2ToolSuite(TOOL: ToolDefV2) {
  const RAIL = TOOL.railTestId ?? "rail-lines";
  const ANCHOR_COUNT = TOOL.anchorCount ?? 2;
  const COMMIT_MODE = TOOL.commitMode ?? "drag";
  const TAG = `[${TOOL.variant}][v2]`;

  // Half-span of the draw gesture — wider for multi-anchor click-sequence tools
  const SPAN = COMMIT_MODE === "click-sequence"
    ? Math.max(60, 18 * (ANCHOR_COUNT - 1))
    : 26;

  // ── Shared helpers ──────────────────────────────────────────────────────────

  async function gotoCharts(page: Page) {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("chart-keep-drawing", "true");
        window.localStorage.removeItem("chart-lock-all");
      } catch { /* ignore */ }
    });
    const targetUrl = `${BASE_URL}/charts?symbol=${SYMBOL}`;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        for (const period of ["1m", "1y", "5y", "all"]) {
          if (await page.locator("[data-testid='chart-interaction-surface']").count()) break;
          const btn = page.locator(`[data-testid='period-btn-${period}']`).first();
          if (await btn.count()) {
            await btn.dispatchEvent("click").catch(() => {});
            await page.waitForTimeout(2000);
          }
        }
        await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 30_000 });
        await page.waitForFunction(
          () => {
            const d = (window as any).__chartDebug;
            return d && typeof d.getScrollPosition === "function" && d.getScrollPosition() !== null;
          },
          { timeout: 30_000 },
        );
        await page.waitForTimeout(700);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const retryable = /ERR_CONNECTION|ECONNREFUSED|waitForSelector: Timeout|waitForFunction: Timeout|Navigation timeout/i.test(msg);
        if (!retryable || attempt === 4) throw err;
        await page.waitForTimeout(1000 * attempt);
      }
    }
  }

  async function surfaceBox(page: Page) {
    const box = await page.getByTestId("chart-interaction-surface").boundingBox();
    if (!box) throw new Error("no surface box");
    return box;
  }

  async function dismissModal(page: Page) {
    for (const id of ["chart-prompt-cancel", "chart-prompt-cancel-btn"]) {
      const el = page.getByTestId(id);
      if (await el.count()) {
        await el.first().click({ force: true });
        await page.waitForTimeout(80);
      }
    }
  }

  async function openRail(page: Page) {
    const rail = page.getByTestId(RAIL);
    if (await rail.count()) {
      await rail.first().click({ force: true });
      await page.waitForTimeout(150);
    }
  }

  async function pickToolBtn(page: Page) {
    await dismissModal(page);
    let btn = page.getByTestId(TOOL.testId).first();
    if (!(await btn.count())) {
      await openRail(page);
      btn = page.getByTestId(TOOL.testId).first();
    }
    if (!(await btn.count())) test.skip(true, `tool button not found: ${TOOL.testId}`);
    const before = await page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
    await btn.click({ force: true });
    await page.waitForFunction(
      (b) => { const v = (window as any).__chartDebug?.getActiveVariant?.(); return v === undefined || v !== b; },
      before, { timeout: 2500 },
    ).catch(() => page.waitForTimeout(200));
  }

  async function ensureToolActive(page: Page) {
    await pickToolBtn(page);
    for (let attempt = 0; attempt < 2; attempt++) {
      const v = await page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
      if (v === null || v === TOOL.variant) return;
      await pickToolBtn(page);
    }
  }

  async function drawTool(page: Page, x1: number, y1: number, x2: number, y2: number) {
    if (COMMIT_MODE === "click") {
      await page.mouse.click(x1, y1);
      await page.waitForTimeout(140);
      await dismissModal(page);
      return;
    }
    if (COMMIT_MODE === "click-sequence") {
      const N = Math.max(2, ANCHOR_COUNT);
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1);
        const px = x1 + (x2 - x1) * t;
        const internal = k > 0 && k < N - 1;
        const jitter = internal ? (k % 2 === 0 ? -8 : 8) : 0;
        const py = y1 + (y2 - y1) * t + jitter;
        await page.mouse.click(px, py);
        await page.waitForTimeout(70);
      }
      await page.waitForTimeout(160);
      await dismissModal(page);
      return;
    }
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(140);
    await dismissModal(page);
  }

  async function drawToolOnce(page: Page, x1: number, y1: number, x2: number, y2: number) {
    await ensureToolActive(page);
    await drawTool(page, x1, y1, x2, y2);
  }

  // Standard center + offset draw
  async function drawCenter(page: Page, ox = 0, oy = 0) {
    const box = await surfaceBox(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await drawToolOnce(page, cx + ox - SPAN, cy + oy, cx + ox + SPAN, cy + oy + 4);
  }

  // Grid offset for varied positions
  function gridOffset(i: number, cols = 7) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = (col - (cols - 1) / 2) * 42;
    const oy = (row - 1) * 22 - 20;
    return { ox, oy };
  }

  // Debug helpers
  async function getDrawingCount(page: Page) {
    return page.evaluate<number>(() => ((window as any).__chartDebug?.getDrawings?.() ?? []).length);
  }
  async function getLatestId(page: Page) {
    return page.evaluate<string | null>(() => (window as any).__chartDebug?.getLatestDrawingId?.() ?? null);
  }
  async function getSelectedId(page: Page) {
    return page.evaluate<string | null>(() => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null);
  }
  async function getDrawingOptions(page: Page, id?: string | null) {
    return page.evaluate<Record<string, unknown> | null>(
      (drawingId: string | null) => {
        const ds = (window as any).__chartDebug?.getDrawings?.() ?? [];
        const d = drawingId ? ds.find((x: any) => x.id === drawingId) : ds[ds.length - 1];
        return d?.options ?? null;
      },
      id ?? null,
    );
  }
  async function getDrawingById(page: Page, id: string) {
    return page.evaluate<any>(
      (drawingId: string) => ((window as any).__chartDebug?.getDrawings?.() ?? []).find((x: any) => x.id === drawingId) ?? null,
      id,
    );
  }

  // ── A. Draw + Variant Assertions [60] ──────────────────────────────────────

  test.describe(`${TAG} draw-variant`, () => {
    // A001-A020: variant = TOOL.variant after draw
    for (let i = 0; i < 20; i++) {
      test(`draw-variant #${String(i).padStart(3, "0")} - variant is "${TOOL.variant}"`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const drawings = await page.evaluate<any[]>(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
        const latest = drawings[drawings.length - 1];
        expect(latest?.variant).toBe(TOOL.variant);
      });
    }

    // A021-A040: anchor count = ANCHOR_COUNT after draw
    for (let i = 0; i < 20; i++) {
      test(`draw-variant #${String(i + 20).padStart(3, "0")} - anchor count is ${ANCHOR_COUNT}`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const drawings = await page.evaluate<any[]>(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
        const latest = drawings[drawings.length - 1];
        expect(latest?.anchors?.length).toBe(ANCHOR_COUNT);
      });
    }

    // A041-A060: drawing.options has color, thickness, style
    for (let i = 0; i < 20; i++) {
      test(`draw-variant #${String(i + 40).padStart(3, "0")} - options has color/thickness/style`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const opts = await getDrawingOptions(page);
        expect(opts).not.toBeNull();
        expect(typeof opts!.color).toBe("string");
        expect(typeof opts!.thickness).toBe("number");
        expect(["solid", "dashed", "dotted"]).toContain(opts!.style);
      });
    }
  });

  // ── B. Floating Toolbar — Color [60] ───────────────────────────────────────

  test.describe(`${TAG} toolbar-color`, () => {
    // B001-B010: color button opens panel with ≥12 swatches
    for (let i = 0; i < 10; i++) {
      test(`toolbar-color #${String(i).padStart(3, "0")} - color button opens panel`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-color").click({ force: true });
        await page.waitForTimeout(200);
        const panel = page.getByTestId("floating-toolbar-color-panel");
        await expect(panel).toBeVisible({ timeout: 2000 });
        const swatches = panel.locator("button");
        expect(await swatches.count()).toBeGreaterThanOrEqual(12);
      });
    }

    // B011-B020: select red (#f23645) → options.color = '#f23645'
    for (let i = 0; i < 10; i++) {
      test(`toolbar-color #${String(i + 10).padStart(3, "0")} - select red → options.color='#f23645'`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-color").click({ force: true });
        await page.waitForTimeout(200);
        await page.getByTestId("floating-toolbar-color-f23645").click({ force: true });
        await page.waitForTimeout(300);
        const opts = await getDrawingOptions(page, id);
        expect(opts?.color).toBe("#f23645");
      });
    }

    // B021-B030: select blue (#2962ff) → options.color = '#2962ff'
    for (let i = 0; i < 10; i++) {
      test(`toolbar-color #${String(i + 20).padStart(3, "0")} - select blue → options.color='#2962ff'`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-color").click({ force: true });
        await page.waitForTimeout(200);
        await page.getByTestId("floating-toolbar-color-2962ff").click({ force: true });
        await page.waitForTimeout(300);
        const opts = await getDrawingOptions(page, id);
        expect(opts?.color).toBe("#2962ff");
      });
    }

    // B031-B040: select green (#00e676) → options.color = '#00e676'
    for (let i = 0; i < 10; i++) {
      test(`toolbar-color #${String(i + 30).padStart(3, "0")} - select green → options.color='#00e676'`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-color").click({ force: true });
        await page.waitForTimeout(200);
        await page.getByTestId("floating-toolbar-color-00e676").click({ force: true });
        await page.waitForTimeout(300);
        const opts = await getDrawingOptions(page, id);
        expect(opts?.color).toBe("#00e676");
      });
    }

    // B041-B050: select yellow (#ffd600) → options.color = '#ffd600'
    for (let i = 0; i < 10; i++) {
      test(`toolbar-color #${String(i + 40).padStart(3, "0")} - select yellow → options.color='#ffd600'`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-color").click({ force: true });
        await page.waitForTimeout(200);
        await page.getByTestId("floating-toolbar-color-ffd600").click({ force: true });
        await page.waitForTimeout(300);
        const opts = await getDrawingOptions(page, id);
        expect(opts?.color).toBe("#ffd600");
      });
    }

    // B051-B060: color persists after deselect (options in store unchanged)
    for (let i = 0; i < 10; i++) {
      test(`toolbar-color #${String(i + 50).padStart(3, "0")} - color change persists after deselect`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const box = await surfaceBox(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-color").click({ force: true });
        await page.waitForTimeout(200);
        await page.getByTestId("floating-toolbar-color-f23645").click({ force: true });
        await page.waitForTimeout(300);
        // Deselect by clicking away
        await page.mouse.click(box.x + 40, box.y + 40);
        await page.waitForTimeout(200);
        const opts = await getDrawingOptions(page, id);
        expect(opts?.color).toBe("#f23645");
      });
    }
  });

  // ── C. Floating Toolbar — Thickness [40] ───────────────────────────────────

  test.describe(`${TAG} toolbar-thickness`, () => {
    // C001-C010: one click cycles thickness to next in [1,2,3,4]
    for (let i = 0; i < 10; i++) {
      test(`toolbar-thickness #${String(i).padStart(3, "0")} - one click cycles to next value`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const optsBefore = await getDrawingOptions(page, id);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-thickness").click({ force: true });
        await page.waitForTimeout(250);
        const optsAfter = await getDrawingOptions(page, id);
        const startIdx = THICKNESS_CYCLE.indexOf((optsBefore?.thickness as number) ?? 2);
        const expectedNext = THICKNESS_CYCLE[(startIdx + 1) % THICKNESS_CYCLE.length];
        expect(optsAfter?.thickness).toBe(expectedNext);
      });
    }

    // C011-C020: two clicks cycle 2 steps forward
    for (let i = 0; i < 10; i++) {
      test(`toolbar-thickness #${String(i + 10).padStart(3, "0")} - two clicks cycle 2 steps`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const optsBefore = await getDrawingOptions(page, id);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        const thicknessBtn = page.getByTestId("floating-toolbar-thickness");
        await thicknessBtn.click({ force: true });
        await page.waitForTimeout(120);
        await thicknessBtn.click({ force: true });
        await page.waitForTimeout(250);
        const optsAfter = await getDrawingOptions(page, id);
        const startIdx = THICKNESS_CYCLE.indexOf((optsBefore?.thickness as number) ?? 2);
        expect(optsAfter?.thickness).toBe(THICKNESS_CYCLE[(startIdx + 2) % THICKNESS_CYCLE.length]);
      });
    }

    // C021-C030: thickness persists after deselect
    for (let i = 0; i < 10; i++) {
      test(`toolbar-thickness #${String(i + 20).padStart(3, "0")} - thickness persists after deselect`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        const id = await getLatestId(page);
        const box = await surfaceBox(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-thickness").click({ force: true });
        await page.waitForTimeout(200);
        const savedThickness = (await getDrawingOptions(page, id))?.thickness;
        await page.mouse.click(box.x + 40, box.y + 40);
        await page.waitForTimeout(200);
        expect((await getDrawingOptions(page, id))?.thickness).toBe(savedThickness);
      });
    }

    // C031-C040: 4 clicks wraps back to original thickness
    for (let i = 0; i < 10; i++) {
      test(`toolbar-thickness #${String(i + 30).padStart(3, "0")} - 4 clicks wraps to original`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        const id = await getLatestId(page);
        const origThickness = (await getDrawingOptions(page, id))?.thickness;
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        const btn = page.getByTestId("floating-toolbar-thickness");
        for (let k = 0; k < 4; k++) {
          await btn.click({ force: true });
          await page.waitForTimeout(100);
        }
        expect((await getDrawingOptions(page, id))?.thickness).toBe(origThickness);
      });
    }
  });

  // ── D. Floating Toolbar — Style [40] ──────────────────────────────────────

  test.describe(`${TAG} toolbar-style`, () => {
    // D001-D010: one click cycles to next style
    for (let i = 0; i < 10; i++) {
      test(`toolbar-style #${String(i).padStart(3, "0")} - one click cycles to next style`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const optsBefore = await getDrawingOptions(page, id);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-style").click({ force: true });
        await page.waitForTimeout(250);
        const optsAfter = await getDrawingOptions(page, id);
        const startIdx = STYLE_CYCLE.indexOf((optsBefore?.style as "solid" | "dashed" | "dotted") ?? "solid");
        expect(optsAfter?.style).toBe(STYLE_CYCLE[(startIdx + 1) % STYLE_CYCLE.length]);
      });
    }

    // D011-D020: two clicks cycle 2 steps forward
    for (let i = 0; i < 10; i++) {
      test(`toolbar-style #${String(i + 10).padStart(3, "0")} - two clicks cycle 2 steps`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const optsBefore = await getDrawingOptions(page, id);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        const styleBtn = page.getByTestId("floating-toolbar-style");
        await styleBtn.click({ force: true });
        await page.waitForTimeout(100);
        await styleBtn.click({ force: true });
        await page.waitForTimeout(250);
        const optsAfter = await getDrawingOptions(page, id);
        const startIdx = STYLE_CYCLE.indexOf((optsBefore?.style as "solid" | "dashed" | "dotted") ?? "solid");
        expect(optsAfter?.style).toBe(STYLE_CYCLE[(startIdx + 2) % STYLE_CYCLE.length]);
      });
    }

    // D021-D030: style persists after deselect
    for (let i = 0; i < 10; i++) {
      test(`toolbar-style #${String(i + 20).padStart(3, "0")} - style persists after deselect`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        const id = await getLatestId(page);
        const box = await surfaceBox(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-style").click({ force: true });
        await page.waitForTimeout(200);
        const savedStyle = (await getDrawingOptions(page, id))?.style;
        await page.mouse.click(box.x + 40, box.y + 40);
        await page.waitForTimeout(200);
        expect((await getDrawingOptions(page, id))?.style).toBe(savedStyle);
      });
    }

    // D031-D040: 3 clicks wraps back to original style
    for (let i = 0; i < 10; i++) {
      test(`toolbar-style #${String(i + 30).padStart(3, "0")} - 3 clicks wraps to original style`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        const id = await getLatestId(page);
        const origStyle = (await getDrawingOptions(page, id))?.style;
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        const btn = page.getByTestId("floating-toolbar-style");
        for (let k = 0; k < 3; k++) {
          await btn.click({ force: true });
          await page.waitForTimeout(100);
        }
        expect((await getDrawingOptions(page, id))?.style).toBe(origStyle);
      });
    }
  });

  // ── E. Floating Toolbar — Actions [60] ────────────────────────────────────

  test.describe(`${TAG} toolbar-actions`, () => {
    // E001-E010: lock button toggles drawing.locked
    for (let i = 0; i < 10; i++) {
      test(`toolbar-actions #${String(i).padStart(3, "0")} - lock button toggles locked state`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const before = await getDrawingById(page, id!);
        const wasLocked = Boolean(before?.locked || before?.options?.locked);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-lock").click({ force: true });
        await page.waitForTimeout(300);
        const after = await getDrawingById(page, id!);
        const isNowLocked = Boolean(after?.locked || after?.options?.locked);
        expect(isNowLocked).toBe(!wasLocked);
      });
    }

    // E011-E020: visibility button toggles drawing.visible
    for (let i = 0; i < 10; i++) {
      test(`toolbar-actions #${String(i + 10).padStart(3, "0")} - visible button toggles visible state`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        const before = await getDrawingById(page, id!);
        const wasVisible = before?.visible !== false && before?.options?.visible !== false;
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-visible").click({ force: true });
        await page.waitForTimeout(300);
        const after = await getDrawingById(page, id!);
        const isNowVisible = after?.visible !== false && after?.options?.visible !== false;
        expect(isNowVisible).toBe(!wasVisible);
      });
    }

    // E021-E030: duplicate button adds drawing with same variant + new unique ID
    for (let i = 0; i < 10; i++) {
      test(`toolbar-actions #${String(i + 20).padStart(3, "0")} - duplicate creates same-variant drawing`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const originalId = await getLatestId(page);
        const countBefore = await getDrawingCount(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-duplicate").click({ force: true });
        await page.waitForTimeout(400);
        expect(await getDrawingCount(page)).toBe(countBefore + 1);
        const drawings = await page.evaluate<any[]>(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
        expect(drawings.every((d: any) => d.variant === TOOL.variant)).toBe(true);
        // All IDs unique
        const ids = drawings.map((d: any) => d.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.includes(originalId)).toBe(true);
      });
    }

    // E031-E040: duplicate then delete duplicate leaves 1 drawing
    for (let i = 0; i < 10; i++) {
      test(`toolbar-actions #${String(i + 30).padStart(3, "0")} - duplicate then delete leaves 1`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-duplicate").click({ force: true });
        await page.waitForTimeout(400);
        expect(await getDrawingCount(page)).toBe(2);
        // The newest drawing should now be selected
        const tb2 = page.getByTestId("floating-drawing-toolbar");
        await expect(tb2).toBeVisible({ timeout: 3000 });
        // Delete via keyboard
        await page.keyboard.press("Delete");
        await page.waitForTimeout(300);
        expect(await getDrawingCount(page)).toBe(1);
      });
    }

    // E041-E050: delete button removes the drawing (count goes to 0)
    for (let i = 0; i < 10; i++) {
      test(`toolbar-actions #${String(i + 40).padStart(3, "0")} - delete button removes drawing`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-delete").click({ force: true });
        await page.waitForTimeout(300);
        expect(await getDrawingCount(page)).toBe(0);
      });
    }

    // E051-E060: settings button opens ToolOptionsPanel
    for (let i = 0; i < 10; i++) {
      test(`toolbar-actions #${String(i + 50).padStart(3, "0")} - settings button opens options panel`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const tb = page.getByTestId("floating-drawing-toolbar");
        await expect(tb).toBeVisible({ timeout: 4000 });
        await page.getByTestId("floating-toolbar-settings").click({ force: true });
        await page.waitForTimeout(400);
        // ToolOptionsPanel should appear
        const panel = page.getByTestId("tool-options-panel");
        await expect(panel).toBeVisible({ timeout: 3000 });
        // Drawing still exists
        expect(await getDrawingCount(page)).toBeGreaterThanOrEqual(1);
      });
    }
  });

  // ── F. Selection & Deselect [40] ──────────────────────────────────────────

  test.describe(`${TAG} selection`, () => {
    // F001-F020: drawing is auto-selected after draw
    for (let i = 0; i < 20; i++) {
      test(`selection #${String(i).padStart(3, "0")} - auto-selected after draw`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        expect(await getSelectedId(page)).toBe(id);
      });
    }

    // F021-F040: clicking away deselects the drawing
    for (let i = 0; i < 20; i++) {
      test(`selection #${String(i + 20).padStart(3, "0")} - clicking away deselects`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        expect(await getSelectedId(page)).not.toBeNull();
        const box = await surfaceBox(page);
        await page.mouse.click(box.x + 50, box.y + 50);
        await page.waitForTimeout(200);
        expect(await getSelectedId(page)).toBeNull();
      });
    }
  });

  // ── G. Keyboard Operations [50] ───────────────────────────────────────────

  test.describe(`${TAG} keyboard`, () => {
    // G001-G010: Escape mid-draw cancels (no drawing committed)
    for (let i = 0; i < 10; i++) {
      test(`keyboard #${String(i).padStart(3, "0")} - Escape mid-draw cancels`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await ensureToolActive(page);
        if (COMMIT_MODE === "drag") {
          await page.mouse.move(cx - 20, cy);
          await page.mouse.down();
          await page.mouse.move(cx + 5, cy);
          await page.keyboard.press("Escape");
          await page.mouse.up();
        } else {
          await page.mouse.move(cx - 20, cy);
          await page.keyboard.press("Escape");
        }
        await page.waitForTimeout(200);
        expect(await getDrawingCount(page)).toBe(0);
      });
    }

    // G011-G020: Escape after draw deselects (drawing still exists)
    for (let i = 0; i < 10; i++) {
      test(`keyboard #${String(i + 10).padStart(3, "0")} - Escape post-draw deselects`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        expect(await getDrawingCount(page)).toBe(1);
        expect(await getSelectedId(page)).not.toBeNull();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
        expect(await getSelectedId(page)).toBeNull();
        expect(await getDrawingCount(page)).toBe(1);
      });
    }

    // G021-G030: Delete key removes selected drawing
    for (let i = 0; i < 10; i++) {
      test(`keyboard #${String(i + 20).padStart(3, "0")} - Delete key removes selected`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        expect(await getSelectedId(page)).not.toBeNull();
        await page.keyboard.press("Delete");
        await page.waitForTimeout(200);
        expect(await getDrawingCount(page)).toBe(0);
      });
    }

    // G031-G040: Backspace key removes selected drawing
    for (let i = 0; i < 10; i++) {
      test(`keyboard #${String(i + 30).padStart(3, "0")} - Backspace removes selected`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        expect(await getSelectedId(page)).not.toBeNull();
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(200);
        expect(await getDrawingCount(page)).toBe(0);
      });
    }

    // G041-G050: Ctrl+Z undoes the draw
    for (let i = 0; i < 10; i++) {
      test(`keyboard #${String(i + 40).padStart(3, "0")} - Ctrl+Z undoes draw`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        expect(await getDrawingCount(page)).toBe(1);
        await page.keyboard.press("Control+Z");
        await page.waitForTimeout(200);
        expect(await getDrawingCount(page)).toBe(0);
      });
    }
  });

  // ── H. Undo/Redo [50] ─────────────────────────────────────────────────────

  test.describe(`${TAG} undo-redo`, () => {
    for (let n = 1; n <= 5; n++) {
      for (let s = 0; s < 10; s++) {
        const idx = (n - 1) * 10 + s;
        test(`undo-redo #${String(idx).padStart(3, "0")} N=${n} seed=${s} - draw→undo→redo`, async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const colW = COMMIT_MODE === "click-sequence"
            ? Math.max(50, 24 * (ANCHOR_COUNT - 1))
            : 50;
          for (let k = 0; k < n; k++) {
            const ox = (k % 4 - 1.5) * colW + (s - 5) * 6;
            await ensureToolActive(page);
            await drawTool(page, cx + ox - SPAN, cy - 25, cx + ox + SPAN, cy - 21);
          }
          expect(await getDrawingCount(page)).toBe(n);
          for (let k = 0; k < n; k++) {
            await page.keyboard.press("Control+Z");
            await page.waitForTimeout(60);
          }
          expect(await getDrawingCount(page)).toBe(0);
          for (let k = 0; k < n; k++) {
            await page.keyboard.press("Control+Y");
            await page.waitForTimeout(60);
          }
          expect(await getDrawingCount(page)).toBe(n);
        });
      }
    }
  });

  // ── I. Persistence — Pan & Zoom [40] ──────────────────────────────────────

  test.describe(`${TAG} persistence`, () => {
    // I001-I020: drawing persists after horizontal pan
    for (let i = 0; i < 20; i++) {
      test(`persistence #${String(i).padStart(3, "0")} - drawing persists after pan`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await drawCenter(page);
        const id = await getLatestId(page);
        const panAmt = 60 + (i % 6) * 30;
        await page.mouse.move(cx, cy);
        for (let k = 0; k < Math.ceil(panAmt / 20); k++) {
          await page.mouse.wheel(20, 0);
          await page.waitForTimeout(10);
        }
        await page.waitForTimeout(150);
        const drawings = await page.evaluate<any[]>(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
        expect(drawings.find((d: any) => d.id === id)).toBeTruthy();
      });
    }

    // I021-I040: drawing persists after scroll-zoom
    for (let i = 0; i < 20; i++) {
      test(`persistence #${String(i + 20).padStart(3, "0")} - drawing persists after zoom`, async ({ page }) => {
        await gotoCharts(page);
        await drawCenter(page);
        const id = await getLatestId(page);
        const zoomAmt = (i % 4) + 1;
        for (let k = 0; k < zoomAmt; k++) {
          await page.mouse.wheel(0, -100);
          await page.waitForTimeout(80);
        }
        await page.waitForTimeout(150);
        const drawings = await page.evaluate<any[]>(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
        expect(drawings.find((d: any) => d.id === id)).toBeTruthy();
      });
    }
  });

  // ── J. Multi-drawing [30] ─────────────────────────────────────────────────

  test.describe(`${TAG} multi-drawing`, () => {
    for (let n = 2; n <= 31; n++) {
      test(`multi #${String(n).padStart(3, "0")} - ${n} drawings have unique IDs`, async ({ page }) => {
        await gotoCharts(page);
        const colW = COMMIT_MODE === "click-sequence" ? Math.max(42, 22 * (ANCHOR_COUNT - 1)) : 42;
        const cols = 5;
        const rowH = COMMIT_MODE === "click-sequence" ? 60 : 22;
        const halfSpan = COMMIT_MODE === "click-sequence" ? Math.max(14, 9 * (ANCHOR_COUNT - 1)) : 14;
        for (let k = 0; k < n; k++) {
          await page.evaluate(() => {
            const aside = document.querySelector('[data-testid="object-tree-panel"][data-open="true"]');
            if (aside) { const btn = aside.querySelector("button"); if (btn) (btn as HTMLButtonElement).click(); }
          });
          const box = await surfaceBox(page);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const col = k % cols;
          const row = Math.floor(k / cols);
          const ox = (col - (cols - 1) / 2) * colW;
          const oy = (row - Math.floor(n / cols / 2)) * rowH - 20;
          await page.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
          const before = await getDrawingCount(page);
          await ensureToolActive(page);
          await drawTool(page, cx + ox - halfSpan, cy + oy, cx + ox + halfSpan, cy + oy + 3);
          let retry = 0;
          while ((await getDrawingCount(page)) <= before && retry < 2) {
            retry++;
            const jitter = 6 * (retry + 1);
            await page.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
            await ensureToolActive(page);
            await drawTool(page, cx + ox - halfSpan + jitter, cy + oy + jitter, cx + ox + halfSpan + jitter, cy + oy + 3 + jitter);
          }
        }
        expect(await getDrawingCount(page)).toBe(n);
        const ids = await page.evaluate<string[]>(() => ((window as any).__chartDebug?.getDrawings?.() ?? []).map((d: any) => d.id));
        expect(new Set(ids).size).toBe(n);
      });
    }
  });

  // ── K. Edge Cases [30] ────────────────────────────────────────────────────

  test.describe(`${TAG} edge-cases`, () => {
    // K001-K010: draw near top edge commits a drawing
    for (let i = 0; i < 10; i++) {
      test(`edge-cases #${String(i).padStart(3, "0")} - draw near top edge commits`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const x1 = box.x + box.width * 0.3 + i * 8;
        const y1 = box.y + 28 + i * 2;
        const x2 = box.x + box.width * 0.65 + i * 8;
        const y2 = box.y + 34 + i * 2;
        const before = await getDrawingCount(page);
        await drawToolOnce(page, x1, y1, x2, y2);
        expect(await getDrawingCount(page)).toBe(before + 1);
      });
    }

    // K011-K020: draw near bottom edge commits a drawing
    for (let i = 0; i < 10; i++) {
      test(`edge-cases #${String(i + 10).padStart(3, "0")} - draw near bottom edge commits`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const x1 = box.x + box.width * 0.3 + i * 8;
        const y1 = box.y + box.height - 42 - i * 2;
        const x2 = box.x + box.width * 0.65 + i * 8;
        const y2 = box.y + box.height - 36 - i * 2;
        const before = await getDrawingCount(page);
        await drawToolOnce(page, x1, y1, x2, y2);
        expect(await getDrawingCount(page)).toBe(before + 1);
      });
    }

    // K021-K030: drawing has a unique non-empty ID
    for (let i = 0; i < 10; i++) {
      test(`edge-cases #${String(i + 20).padStart(3, "0")} - drawing has non-empty unique ID`, async ({ page }) => {
        await gotoCharts(page);
        const { ox, oy } = gridOffset(i);
        await drawCenter(page, ox, oy);
        const id = await getLatestId(page);
        expect(typeof id).toBe("string");
        expect((id as string).length).toBeGreaterThan(0);
        const drawings = await page.evaluate<any[]>(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
        // All IDs in store are unique
        const ids = drawings.map((d: any) => d.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    }
  });
}
