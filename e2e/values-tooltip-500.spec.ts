/**
 * Values-tooltip 500 TradingView-parity tests (mobile / touch).
 *
 * Mirrors TradingView's "Values tooltip on long press" toggle in the cursor
 * panel. Long-pressing the chart for 450 ms shows a floating panel with
 * Date/O/H/L/C/Vol/Change/Change%/Cursor-price; finger drag updates it in
 * place; touchend dismisses; second finger or pre-fire drag cancels.
 *
 * Mechanism: dispatches raw CDP Input.dispatchTouchEvent so we get a real
 * touch hold (Playwright touchscreen.tap is one-shot and can't long-press).
 *
 * Run via:
 *   E2E_USE_EXTERNAL_STACK=true E2E_TARGET_URL=https://tradereplay.me \
 *   npx playwright test -c e2e/playwright.config.ts --project=mobile-iphone12 \
 *   e2e/values-tooltip-500.spec.ts
 */
import { test, expect } from "@playwright/test";
import type { CDPSession, Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "https://tradereplay.me";
const SYMBOL = "RELIANCE";

const TOOLTIP = '[data-testid="values-tooltip"]';
const SURFACE = '[data-testid="chart-interaction-surface"]';
const CURSOR_OPEN = '[data-testid="rail-cursor"]';
const TOGGLE = '[data-testid="cursor-values-tooltip-toggle"]';

type CursorMode = "arrow" | "cross" | "dot" | "demo" | "eraser";
const CURSOR_MODES: CursorMode[] = ["arrow", "cross", "dot", "demo", "eraser"];

async function gotoCharts(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("chart-values-tooltip", "true");
      window.localStorage.removeItem("chart-keep-drawing");
      window.localStorage.removeItem("chart-lock-all");
    } catch {
      /* ignore */
    }
  });
  await page.goto(`${BASE_URL}/charts?symbol=${SYMBOL}`, { waitUntil: "load" });
  // The default period may return "No data" off-hours / weekends; promote to
  // a wider window that always has data, then wait for the chart surface.
  for (const period of ["1m", "1y", "5y", "all"]) {
    if (await page.locator(SURFACE).count()) break;
    const btn = page.locator(`[data-testid="period-btn-${period}"]`).first();
    if (await btn.count()) {
      await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
    }
  }
  await page.waitForSelector(SURFACE, { timeout: 60_000 });
  await page.waitForFunction(
    () => (window as unknown as { __chartDebug?: { getScrollPosition?: () => number | null } })
      .__chartDebug?.getScrollPosition?.() !== null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(400);
}

async function surfaceBox(page: Page) {
  const box = await page.locator(SURFACE).boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function setCursorMode(page: Page, mode: CursorMode) {
  // Open cursor menu, click the cursor variant, close.
  const opener = page.locator(CURSOR_OPEN).first();
  if (await opener.count()) {
    await opener.click({ force: true }).catch(() => {});
    await page.waitForTimeout(100);
  }
  const item = page.locator(`[data-testid="cursor-${mode}"]`).first();
  if (await item.count()) {
    await item.click({ force: true }).catch(() => {});
    await page.waitForTimeout(80);
  }
  // collapse menu
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(60);
}

async function setValuesTooltip(page: Page, enabled: boolean) {
  await page.evaluate((v: boolean) => {
    try { window.localStorage.setItem("chart-values-tooltip", v ? "true" : "false"); } catch { /* ignore */ }
  }, enabled);
  // Reflect at runtime via toggle button if currently rendered.
  const opener = page.locator(CURSOR_OPEN).first();
  if (await opener.count()) {
    await opener.click({ force: true }).catch(() => {});
    await page.waitForTimeout(80);
    const toggle = page.locator(TOGGLE).first();
    if (await toggle.count()) {
      const checked = await toggle.locator('button[role="switch"]').first().getAttribute("aria-checked").catch(() => "false");
      const isOn = checked === "true";
      if (isOn !== enabled) {
        await toggle.locator('button[role="switch"]').first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(60);
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(40);
  }
}

async function clearDrawings(page: Page) {
  await page.evaluate(() => {
    const dbg = (window as unknown as { __chartDebug?: { clearDrawingsFast?: () => number } }).__chartDebug;
    dbg?.clearDrawingsFast?.();
  });
  await page.waitForTimeout(40);
}

async function addSyntheticDrawings(page: Page, count: number) {
  if (count <= 0) return;
  await page.evaluate((n: number) => {
    const dbg = (window as unknown as {
      __chartDebug?: { addSyntheticDrawings?: (c: number, v?: string) => number };
    }).__chartDebug;
    dbg?.addSyntheticDrawings?.(n, "trend");
  }, count);
  await page.waitForTimeout(60);
}

// ── CDP touch helpers (real long-press) ─────────────────────────────────────

async function touchStart(cdp: CDPSession, x: number, y: number, id = 1) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id, force: 1, radiusX: 6, radiusY: 6 }],
  });
}

async function touchMove(cdp: CDPSession, x: number, y: number, id = 1) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y, id, force: 1, radiusX: 6, radiusY: 6 }],
  });
}

async function touchEnd(cdp: CDPSession) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function twoFingerStart(cdp: CDPSession, x1: number, y1: number, x2: number, y2: number) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x1, y: y1, id: 1, force: 1, radiusX: 6, radiusY: 6 },
      { x: x2, y: y2, id: 2, force: 1, radiusX: 6, radiusY: 6 },
    ],
  });
}

async function longPress(cdp: CDPSession, x: number, y: number, holdMs = 600) {
  await touchStart(cdp, x, y);
  await new Promise((r) => setTimeout(r, holdMs));
}

async function isTooltipVisible(page: Page) {
  return page.locator(TOOLTIP).isVisible().catch(() => false);
}

async function waitForTooltip(page: Page, timeoutMs = 2000): Promise<boolean> {
  try {
    await page.waitForSelector(TOOLTIP, { state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function waitForTooltipGone(page: Page, timeoutMs = 1500): Promise<boolean> {
  try {
    await page.waitForSelector(TOOLTIP, { state: "hidden", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function tooltipBox(page: Page) {
  return page.locator(TOOLTIP).first().boundingBox();
}

// Position grids (fractions of surface w/h, with margin so we don't hit axis)
function gridPositions(box: { x: number; y: number; width: number; height: number }, cols: number, rows: number) {
  const out: Array<{ x: number; y: number }> = [];
  // margin: 0.10 left / 0.78 right (avoid right axis), 0.12 / 0.85 vertical
  const xL = box.x + box.width * 0.10;
  const xR = box.x + box.width * 0.78;
  const yT = box.y + box.height * 0.12;
  const yB = box.y + box.height * 0.85;
  const sx = (xR - xL) / Math.max(1, cols - 1);
  const sy = (yB - yT) / Math.max(1, rows - 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: xL + sx * c, y: yT + sy * r });
    }
  }
  return out;
}

// ── Suite ────────────────────────────────────────────────────────────────────

test.describe("[values-tooltip] 500 TradingView-parity tests", () => {
  // NOTE: do NOT use `mode: serial` — under serial, a single failure skips
  // every remaining test in the suite, and we need full 500/500 visibility.
  test.describe.configure({ retries: 1 });
  let page: Page;
  let cdp: CDPSession;

  test.beforeAll(async ({ playwright }) => {
    test.setTimeout(180_000);
    // Desktop chart layout (mobile route hides the chart-interaction-surface
    // and routes to a fullscreen-only flow), but with hasTouch=true so the
    // chart's onTouch* handlers (which drive the values tooltip) fire.
    const browser = await playwright.chromium.launch();
    const ctx = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1366, height: 820 },
      deviceScaleFactor: 2,
    });
    page = await ctx.newPage();
    cdp = await page.context().newCDPSession(page);
    await gotoCharts(page);
    await setValuesTooltip(page, true);
  });

  test.beforeEach(async () => {
    test.setTimeout(45_000);
    // reset touches
    try { await touchEnd(cdp); } catch { /* ignore */ }
    await clearDrawings(page);
    await page.waitForTimeout(40);
  });

  test.afterAll(async () => {
    try { await touchEnd(cdp); } catch { /* ignore */ }
    await page.close();
  });

  // ── A: basic fire (100) — long-press at grid positions, tooltip appears, dismisses on end ──
  // 10x10 = 100
  test.describe("A. Basic fire (100)", () => {
    for (let i = 0; i < 100; i++) {
      const label = `A${String(i + 1).padStart(3, "0")}`;
      test(`${label}. long-press fires + dismisses on touchend`, async () => {
        const box = await surfaceBox(page);
        const grid = gridPositions(box, 10, 10);
        const { x, y } = grid[i];
        await longPress(cdp, x, y, 600);
        const shown = await waitForTooltip(page, 2000);
        await touchEnd(cdp);
        expect(shown, `tooltip should appear after long-press at (${x.toFixed(0)},${y.toFixed(0)})`).toBe(true);
        const gone = await waitForTooltipGone(page, 1500);
        expect(gone, "tooltip should dismiss on touchend").toBe(true);
      });
    }
  });

  // ── B: drag-update after fire (100) — tooltip stays visible and updates while finger drags ──
  test.describe("B. Drag-update after fire (100)", () => {
    for (let i = 0; i < 100; i++) {
      const label = `B${String(i + 1).padStart(3, "0")}`;
      test(`${label}. tooltip persists on finger drag after fire`, async () => {
        const box = await surfaceBox(page);
        const grid = gridPositions(box, 10, 10);
        const { x, y } = grid[i];
        // angle of drag varies per index for coverage
        const ang = (i * 17) % 360;
        const rad = (ang * Math.PI) / 180;
        const dx = Math.cos(rad) * 50;
        const dy = Math.sin(rad) * 30;
        const tx = Math.max(box.x + 20, Math.min(box.x + box.width - 20, x + dx));
        const ty = Math.max(box.y + 20, Math.min(box.y + box.height - 20, y + dy));

        await longPress(cdp, x, y, 550);
        const shown = await waitForTooltip(page, 2000);
        expect(shown, "tooltip should appear before drag").toBe(true);

        await touchMove(cdp, tx, ty);
        await page.waitForTimeout(120);
        const stillVisible = await isTooltipVisible(page);
        await touchEnd(cdp);

        expect(stillVisible, "tooltip should stay visible during drag-after-fire").toBe(true);
        expect(await waitForTooltipGone(page, 1500)).toBe(true);
      });
    }
  });

  // ── C: early-drag cancels (50) — drag >12px before timer fires, no tooltip ──
  test.describe("C. Early-drag cancels (50)", () => {
    for (let i = 0; i < 50; i++) {
      const label = `C${String(i + 1).padStart(3, "0")}`;
      test(`${label}. early drag (>12px in <450ms) cancels long-press`, async () => {
        const box = await surfaceBox(page);
        const grid = gridPositions(box, 10, 5);
        const { x, y } = grid[i];
        await touchStart(cdp, x, y);
        // small idle, then a definite drag in well under 450ms
        await page.waitForTimeout(100);
        await touchMove(cdp, x + 30, y + 8);
        await page.waitForTimeout(60);
        await touchMove(cdp, x + 60, y + 12);
        await page.waitForTimeout(500); // wait past the original 450ms threshold
        const shown = await isTooltipVisible(page);
        await touchEnd(cdp);
        expect(shown, "tooltip must NOT appear when finger dragged >12px before fire").toBe(false);
      });
    }
  });

  // ── D: two-finger cancels (50) — second touch arrives during pre-fire window, no tooltip ──
  test.describe("D. Two-finger cancels (50)", () => {
    for (let i = 0; i < 50; i++) {
      const label = `D${String(i + 1).padStart(3, "0")}`;
      test(`${label}. second finger during pre-fire cancels long-press`, async () => {
        const box = await surfaceBox(page);
        const grid = gridPositions(box, 10, 5);
        const { x, y } = grid[i];
        // first finger
        await touchStart(cdp, x, y, 1);
        await page.waitForTimeout(150);
        // add second finger before 450ms timer
        await twoFingerStart(cdp, x, y, x + 80, y + 40);
        await page.waitForTimeout(500);
        const shown = await isTooltipVisible(page);
        await touchEnd(cdp);
        expect(shown, "tooltip must NOT appear when a second finger lands during pre-fire").toBe(false);
      });
    }
  });

  // ── E: toggle off → no tooltip (50) ───────────────────────────────────────
  test.describe("E. Toggle off (50)", () => {
    test.beforeAll(async () => {
      await setValuesTooltip(page, false);
    });
    test.afterAll(async () => {
      await setValuesTooltip(page, true);
    });
    for (let i = 0; i < 50; i++) {
      const label = `E${String(i + 1).padStart(3, "0")}`;
      test(`${label}. long-press shows nothing when toggle is off`, async () => {
        const box = await surfaceBox(page);
        const grid = gridPositions(box, 10, 5);
        const { x, y } = grid[i];
        await longPress(cdp, x, y, 600);
        const shown = await isTooltipVisible(page);
        await touchEnd(cdp);
        expect(shown, "tooltip must NOT appear when feature toggled off").toBe(false);
      });
    }
  });

  // ── F: cursor-mode parity (50) — 5 modes × 10 positions ───────────────────
  test.describe("F. Cursor-mode parity (50)", () => {
    for (let i = 0; i < 50; i++) {
      const mode = CURSOR_MODES[i % CURSOR_MODES.length];
      const slot = Math.floor(i / CURSOR_MODES.length);
      const label = `F${String(i + 1).padStart(3, "0")}`;
      test(`${label}. mode=${mode} long-press still fires (slot=${slot})`, async () => {
        await setCursorMode(page, mode);
        const box = await surfaceBox(page);
        const grid = gridPositions(box, 10, 1);
        const { x, y } = grid[slot];
        await longPress(cdp, x, y, 600);
        const shown = await waitForTooltip(page, 2000);
        await touchEnd(cdp);
        // Restore to cross for subsequent suites
        await setCursorMode(page, "cross");
        expect(shown, `tooltip should fire in cursorMode=${mode}`).toBe(true);
      });
    }
  });

  // ── G: auto-flip near edges (50) — verify tooltip stays on screen ──────────
  test.describe("G. Auto-flip near edges (50)", () => {
    // 10 corners/edges × 5 hold variants = 50
    const corners: Array<[number, number]> = [
      [0.06, 0.10], [0.94, 0.10], [0.06, 0.92], [0.94, 0.92],
      [0.50, 0.06], [0.50, 0.95], [0.06, 0.50], [0.94, 0.50],
      [0.20, 0.10], [0.80, 0.92],
    ];
    for (let i = 0; i < 50; i++) {
      const [fx, fy] = corners[i % corners.length];
      const label = `G${String(i + 1).padStart(3, "0")}`;
      test(`${label}. tooltip stays inside viewport at (fx=${fx},fy=${fy})`, async () => {
        const box = await surfaceBox(page);
        const x = box.x + box.width * fx;
        const y = box.y + box.height * fy;
        await longPress(cdp, x, y, 600);
        const shown = await waitForTooltip(page, 2000);
        const tb = shown ? await tooltipBox(page) : null;
        await touchEnd(cdp);
        expect(shown, "tooltip should fire near edge").toBe(true);
        if (tb) {
          // tooltip must lie within the chart container (with 2px slack).
          expect(tb.x).toBeGreaterThanOrEqual(box.x - 2);
          expect(tb.y).toBeGreaterThanOrEqual(box.y - 2);
          expect(tb.x + tb.width).toBeLessThanOrEqual(box.x + box.width + 2);
          expect(tb.y + tb.height).toBeLessThanOrEqual(box.y + box.height + 2);
        }
      });
    }
  });

  // ── H: with N drawings on chart (50) — 10 cases each at N=0,5,10,20,30 ────
  test.describe("H. With N drawings (50)", () => {
    const stages: number[] = [0, 5, 10, 20, 30];
    for (let i = 0; i < 50; i++) {
      const N = stages[i % stages.length];
      const slot = Math.floor(i / stages.length);
      const label = `H${String(i + 1).padStart(3, "0")}`;
      test(`${label}. fires with N=${N} drawings (slot=${slot})`, async () => {
        await clearDrawings(page);
        await addSyntheticDrawings(page, N);
        const box = await surfaceBox(page);
        const grid = gridPositions(box, 10, 1);
        const { x, y } = grid[slot];
        await longPress(cdp, x, y, 600);
        const shown = await waitForTooltip(page, 2200);
        await touchEnd(cdp);
        await clearDrawings(page);
        expect(shown, `tooltip should fire with ${N} drawings`).toBe(true);
        expect(await waitForTooltipGone(page, 1500)).toBe(true);
      });
    }
  });
});
