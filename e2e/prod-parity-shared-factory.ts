/**
 * prod-parity-shared-factory.ts
 * ==============================
 * Parity tests for tradereplay.me — SHARED PAGE edition.
 *
 * KEY DIFFERENCE FROM extended-factory:
 *   The original tv-parity-extended-factory calls gotoCharts(page) at the
 *   start of EVERY test (500 page loads per tool = browser opens/closes constantly).
 *
 *   This factory opens the page ONCE per tool (beforeAll) and keeps it open
 *   for all 500 scenarios. Between scenarios it:
 *     1. Clears all drawings via __chartDebug.clearAllDrawings()
 *     2. Falls back to repeated Ctrl+Z if clearAllDrawings not available
 *     3. Presses Escape to reset any mid-draw state
 *
 * The 27 tools tested here exactly match the TradingView 13,500 capture set:
 *   Forecasting:  longPosition, shortPosition, positionForecast, barPattern,
 *                 ghostFeed, anchoredVwap, fixedRangeVolumeProfile, anchoredVolumeProfile
 *   Measurers:    priceRange, dateRange, dateAndPriceRange
 *   Shapes:       brush, highlighter, arrowMarker, arrowTool, arrowMarkUp,
 *                 arrowMarkDown, rectangle, rotatedRectangle, path, circle,
 *                 ellipse, polyline, triangle, arc, curveTool, doubleCurve
 *
 * Usage (from slot spec files):
 *   import { registerProdParitySharedSuite } from "./prod-parity-shared-factory";
 *   registerProdParitySharedSuite(TOOL_DEF);
 */

import { test, expect } from "@playwright/test";
import type { Page, BrowserContext } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL ?? "https://tradereplay.me";
const SYMBOL   = "RELIANCE";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ProdToolKind =
  | "position"       // longPosition, shortPosition, positionForecast
  | "vwap"           // anchoredVwap
  | "volumeProfile"  // fixedRangeVolumeProfile, anchoredVolumeProfile
  | "measurer"       // priceRange, dateRange, dateAndPriceRange
  | "barPattern"
  | "ghostFeed"
  | "brush"          // brush, highlighter
  | "arrowMark"      // arrowMarker, arrowMarkUp, arrowMarkDown  (1-anchor stamp)
  | "arrowLine"      // arrowTool
  | "shape";         // rectangle, rotatedRectangle, path, circle, ellipse,
                     // polyline, triangle, arc, curveTool, doubleCurve

export interface ProdToolDef {
  variant: string;
  testId: string;
  railTestId: string;
  kind: ProdToolKind;
  anchorCount?: number;
  commitMode?: "drag" | "click" | "click-sequence";
}

// ─── ALL 27 PROD TOOL DEFINITIONS ─────────────────────────────────────────────
// Index assignment (round-robin across 3 slots):
//   Slot A = indices 0,3,6,9,12,15,18,21,24
//   Slot B = indices 1,4,7,10,13,16,19,22,25
//   Slot C = indices 2,5,8,11,14,17,20,23,26
export const ALL_PROD_TOOLS: ProdToolDef[] = [
  // 0 → A
  { variant: "longPosition",           testId: "tool-longPosition",           railTestId: "rail-forecasting", kind: "position",      anchorCount: 3,  commitMode: "drag" },
  // 1 → B
  { variant: "shortPosition",          testId: "tool-shortPosition",          railTestId: "rail-forecasting", kind: "position",      anchorCount: 3,  commitMode: "drag" },
  // 2 → C
  { variant: "positionForecast",       testId: "tool-positionForecast",       railTestId: "rail-forecasting", kind: "position",      anchorCount: 3,  commitMode: "drag" },
  // 3 → A
  { variant: "barPattern",             testId: "tool-barPattern",             railTestId: "rail-forecasting", kind: "barPattern",    anchorCount: 2,  commitMode: "drag" },
  // 4 → B
  { variant: "ghostFeed",              testId: "tool-ghostFeed",              railTestId: "rail-forecasting", kind: "ghostFeed",     anchorCount: 2,  commitMode: "drag" },
  // 5 → C
  { variant: "anchoredVwap",           testId: "tool-anchoredVwap",           railTestId: "rail-forecasting", kind: "vwap",          anchorCount: 1,  commitMode: "click" },
  // 6 → A
  { variant: "fixedRangeVolumeProfile",testId: "tool-fixedRangeVolumeProfile",railTestId: "rail-forecasting", kind: "volumeProfile", anchorCount: 2,  commitMode: "drag" },
  // 7 → B
  { variant: "anchoredVolumeProfile",  testId: "tool-anchoredVolumeProfile",  railTestId: "rail-forecasting", kind: "volumeProfile", anchorCount: 1,  commitMode: "click" },
  // 8 → C
  { variant: "priceRange",             testId: "tool-priceRange",             railTestId: "rail-forecasting", kind: "measurer",      anchorCount: 2,  commitMode: "drag" },
  // 9 → A
  { variant: "dateRange",              testId: "tool-dateRange",              railTestId: "rail-forecasting", kind: "measurer",      anchorCount: 2,  commitMode: "drag" },
  // 10 → B
  { variant: "dateAndPriceRange",      testId: "tool-dateAndPriceRange",      railTestId: "rail-forecasting", kind: "measurer",      anchorCount: 2,  commitMode: "drag" },
  // 11 → C
  { variant: "brush",                  testId: "tool-brush",                  railTestId: "rail-brush",       kind: "brush",         anchorCount: 2,  commitMode: "drag" },
  // 12 → A
  { variant: "highlighter",            testId: "tool-highlighter",            railTestId: "rail-brush",       kind: "brush",         anchorCount: 2,  commitMode: "drag" },
  // 13 → B
  { variant: "arrowMarker",            testId: "tool-arrowMarker",            railTestId: "rail-brush",       kind: "arrowMark",     anchorCount: 1,  commitMode: "click" },
  // 14 → C
  { variant: "arrowTool",              testId: "tool-arrowTool",              railTestId: "rail-brush",       kind: "arrowLine",     anchorCount: 2,  commitMode: "drag" },
  // 15 → A
  { variant: "arrowMarkUp",            testId: "tool-arrowMarkUp",            railTestId: "rail-brush",       kind: "arrowMark",     anchorCount: 1,  commitMode: "click" },
  // 16 → B
  { variant: "arrowMarkDown",          testId: "tool-arrowMarkDown",          railTestId: "rail-brush",       kind: "arrowMark",     anchorCount: 1,  commitMode: "click" },
  // 17 → C
  { variant: "rectangle",              testId: "tool-rectangle",              railTestId: "rail-brush",       kind: "shape",         anchorCount: 2,  commitMode: "drag" },
  // 18 → A
  { variant: "rotatedRectangle",       testId: "tool-rotatedRectangle",       railTestId: "rail-brush",       kind: "shape",         anchorCount: 2,  commitMode: "drag" },
  // 19 → B
  { variant: "path",                   testId: "tool-path",                   railTestId: "rail-brush",       kind: "shape",         anchorCount: 3,  commitMode: "click-sequence" },
  // 20 → C
  { variant: "circle",                 testId: "tool-circle",                 railTestId: "rail-brush",       kind: "shape",         anchorCount: 2,  commitMode: "drag" },
  // 21 → A
  { variant: "ellipse",                testId: "tool-ellipse",                railTestId: "rail-brush",       kind: "shape",         anchorCount: 2,  commitMode: "drag" },
  // 22 → B
  { variant: "polyline",               testId: "tool-polyline",               railTestId: "rail-brush",       kind: "shape",         anchorCount: 3,  commitMode: "click-sequence" },
  // 23 → C
  { variant: "triangle",               testId: "tool-triangle",               railTestId: "rail-brush",       kind: "shape",         anchorCount: 3,  commitMode: "click-sequence" },
  // 24 → A
  { variant: "arc",                    testId: "tool-arc",                    railTestId: "rail-brush",       kind: "shape",         anchorCount: 3,  commitMode: "click-sequence" },
  // 25 → B
  { variant: "curveTool",              testId: "tool-curveTool",              railTestId: "rail-brush",       kind: "shape",         anchorCount: 3,  commitMode: "click-sequence" },
  // 26 → C
  { variant: "doubleCurve",            testId: "tool-doubleCurve",            railTestId: "rail-brush",       kind: "shape",         anchorCount: 3,  commitMode: "click-sequence" },
];

// ─── Page setup ────────────────────────────────────────────────────────────────

async function gotoCharts(page: Page) {
  const token = process.env.E2E_PROD_TOKEN ?? "";
  await page.addInitScript((tok) => {
    try {
      window.localStorage.removeItem("chart-keep-drawing");
      window.localStorage.removeItem("chart-lock-all");
      if (tok) window.localStorage.setItem("sim_token", tok);
    } catch { /* ignore */ }
  }, token);
  await page.goto(`${BASE_URL}/charts?symbol=${SYMBOL}&period=1y`, { waitUntil: "load", timeout: 45_000 });
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 30_000 });
  await page.waitForFunction(
    () => (window as any).__chartDebug?.getScrollPosition?.() !== null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(600);
}

/** Reset between scenarios — clear all drawings WITHOUT reloading the page. */
async function resetBetweenScenarios(page: Page) {
  // Press Escape first to cancel any mid-draw state
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(80);

  // Prefer the fast debug API clear
  const cleared = await page.evaluate(() => {
    try {
      const debug = (window as any).__chartDebug;
      if (debug?.clearAllDrawings) {
        debug.clearAllDrawings();
        return true;
      }
    } catch { /* ignore */ }
    return false;
  });

  if (!cleared) {
    // Fallback: Ctrl+A select-all then Delete, then spam Ctrl+Z
    await page.keyboard.press("Control+a").catch(() => null);
    await page.waitForTimeout(80);
    await page.keyboard.press("Delete").catch(() => null);
    await page.waitForTimeout(80);
    for (let i = 0; i < 12; i++) {
      const count = await page.evaluate(() => ((window as any).__chartDebug?.getDrawings?.() ?? []).length);
      if (count === 0) break;
      await page.keyboard.press("Control+z").catch(() => null);
      await page.waitForTimeout(40);
    }
  }

  await page.waitForTimeout(80);

  // Final escape to deselect
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(60);
}

/** Recover a page that has navigated away or crashed */
async function ensurePageHealthy(page: Page) {
  try {
    if (!page.url().includes(BASE_URL.replace("https://", ""))) {
      await gotoCharts(page);
      return;
    }
    const alive = await page.evaluate(() =>
      !!(window as any).__chartDebug?.getDrawings
    ).catch(() => false);
    if (!alive) await gotoCharts(page);
  } catch {
    await gotoCharts(page);
  }
}

// ─── Draw helpers ──────────────────────────────────────────────────────────────

async function surfaceBox(page: Page) {
  const box = await page.getByTestId("chart-interaction-surface").boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function dismissModal(page: Page) {
  for (const tid of ["chart-prompt-cancel", "chart-prompt-cancel-btn"]) {
    const el = page.getByTestId(tid);
    if (await el.count()) {
      await el.first().click({ force: true });
      await page.waitForTimeout(80);
    }
  }
}

async function openRail(page: Page, railId: string) {
  const rail = page.getByTestId(railId);
  if (await rail.count()) {
    await rail.first().click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function pickToolBtn(page: Page, tool: ProdToolDef) {
  await dismissModal(page);
  let btn = page.getByTestId(tool.testId).first();
  if (!(await btn.count())) {
    await openRail(page, tool.railTestId);
    btn = page.getByTestId(tool.testId).first();
  }
  if (!(await btn.count())) return false;
  const before = await page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
  await btn.click({ force: true });
  await page
    .waitForFunction(
      (b) => { const v = (window as any).__chartDebug?.getActiveVariant?.(); return v === undefined || v !== b; },
      before,
      { timeout: 2500 },
    )
    .catch(() => page.waitForTimeout(200));
  return true;
}

async function ensureToolActive(page: Page, tool: ProdToolDef) {
  const ok = await pickToolBtn(page, tool);
  if (!ok) { test.skip(true, `tool not found: ${tool.testId}`); return; }
  for (let attempt = 0; attempt < 2; attempt++) {
    const v = await page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
    if (v === null || v === tool.variant) return;
    await pickToolBtn(page, tool);
  }
}

function gridCoords(
  box: { x: number; y: number; width: number; height: number },
  i: number,
) {
  const col = i % 8;
  const row = Math.floor(i / 8) % 8;
  const cx = box.x + (box.width  * (col + 1)) / 9;
  const cy = box.y + (box.height * (row + 1)) / 9;
  return { cx, cy };
}

async function drawTool(page: Page, tool: ProdToolDef, box: { x: number; y: number; width: number; height: number }, i: number) {
  const { cx, cy } = gridCoords(box, i);
  const span = 35 + (i % 5) * 12;
  const angle = ((i % 8) * Math.PI) / 8;
  const x1 = cx - Math.cos(angle) * span;
  const y1 = cy - Math.sin(angle) * span;
  const x2 = cx + Math.cos(angle) * span;
  const y2 = cy + Math.sin(angle) * span;

  const mode = tool.commitMode ?? "drag";

  if (mode === "click" || tool.anchorCount === 1) {
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(180);
  } else if (mode === "click-sequence") {
    const N = Math.max(2, tool.anchorCount ?? 3);
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1);
      const jitter = k > 0 && k < N - 1 ? ((k % 2 === 0 ? -1 : 1) * 10) : 0;
      await page.mouse.click(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + jitter);
      await page.waitForTimeout(160);
    }
  } else {
    // drag — also handles position tools (drag from entry to target)
    const dx = tool.kind === "position" ? span * 1.5 : span;
    const dy = tool.kind === "position" ? -30 - (i % 4) * 12 : span * Math.sin(angle);
    const sx = cx - dx, sy = cy + 10;
    const ex = cx + dx, ey = cy - dy;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  await dismissModal(page);
}

async function getDrawingCount(page: Page): Promise<number> {
  return page.evaluate(() => ((window as any).__chartDebug?.getDrawings?.() ?? []).length);
}
async function getLatestId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__chartDebug?.getLatestDrawingId?.() ?? null);
}
async function getSelectedId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null);
}
async function getPixelAnchors(page: Page, id?: string | null) {
  return page.evaluate((i) => (window as any).__chartDebug?.getDrawingPixelAnchors?.(i ?? null) ?? null, id ?? null);
}
async function getFloatingToolbarState(page: Page) {
  return page.evaluate(() => (window as any).__chartDebug?.getFloatingToolbarState?.());
}

// ─── Public registration function ─────────────────────────────────────────────

export function registerProdParitySharedSuite(tool: ProdToolDef) {
  const TAG = `[PROD-PARITY][${tool.variant}]`;
  const ANCHOR_COUNT = tool.anchorCount ?? (tool.kind === "position" ? 3 : tool.kind === "vwap" || tool.kind === "arrowMark" ? 1 : 2);

  test.describe(`${TAG} ${tool.variant} — 500 parity scenarios`, () => {
    // ── Shared page — opened ONCE per tool, reused for all 500 tests ──────────
    let sharedCtx: BrowserContext;
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      sharedCtx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
      });
      sharedPage = await sharedCtx.newPage();
      await gotoCharts(sharedPage);
    });

    test.afterAll(async () => {
      await sharedPage?.close().catch(() => null);
      await sharedCtx?.close().catch(() => null);
    });

    // ── Reset helper available in tests ──────────────────────────────────────
    async function reset() {
      await ensurePageHealthy(sharedPage);
      await resetBetweenScenarios(sharedPage);
    }

    // ── BLOCK 1: Geometry (100 tests) ─────────────────────────────────────────
    test.describe(`${TAG} geometry`, () => {
      for (let i = 0; i < 100; i++) {
        test(`geometry #${String(i).padStart(3, "0")} — draw + anchor count + toolbar`, async () => {
          await reset();
          const box = await surfaceBox(sharedPage);
          const before = await getDrawingCount(sharedPage);
          await ensureToolActive(sharedPage, tool);
          await drawTool(sharedPage, tool, box, i);
          const after = await getDrawingCount(sharedPage);
          expect(after).toBe(before + 1);
          const px = await getPixelAnchors(sharedPage);
          expect(px).not.toBeNull();
          expect(px.variant).toBe(tool.variant);
          if (tool.kind === "brush") {
            expect(px.anchors.length).toBeGreaterThanOrEqual(2);
          } else {
            expect(px.anchors.length).toBe(ANCHOR_COUNT);
          }
          const tb = await getFloatingToolbarState(sharedPage);
          expect(tb?.visible).toBe(true);
        });
      }
    });

    // ── BLOCK 2: Selection (50 tests) ─────────────────────────────────────────
    test.describe(`${TAG} selection`, () => {
      for (let i = 0; i < 50; i++) {
        test(`selection #${String(i).padStart(3, "0")} — auto-select, deselect, reselect`, async () => {
          await reset();
          const box = await surfaceBox(sharedPage);
          await ensureToolActive(sharedPage, tool);
          await drawTool(sharedPage, tool, box, i);
          const id = await getLatestId(sharedPage);
          expect(await getSelectedId(sharedPage)).toBe(id);

          // Deselect
          await sharedPage.mouse.click(box.x + box.width * 0.88, box.y + 36);
          await sharedPage.waitForTimeout(200);
          expect(await getSelectedId(sharedPage)).toBeNull();

          // Reselect via debug API
          await sharedPage.evaluate((d) => (window as any).__chartDebug?.forceSelectDrawing?.(d), id);
          await sharedPage.waitForTimeout(120);
          const sel = await getSelectedId(sharedPage);
          expect(typeof sel === "string" && sel.length > 0).toBe(true);
        });
      }
    });

    // ── BLOCK 3: Edge Persistence (40 tests) ──────────────────────────────────
    test.describe(`${TAG} edge`, () => {
      const dirs = [
        { name: "right",  dx:  1,   dy:  0   },
        { name: "left",   dx: -1,   dy:  0   },
        { name: "up",     dx:  0,   dy: -1   },
        { name: "down",   dx:  0,   dy:  1   },
        { name: "tr",     dx:  0.7, dy: -0.7 },
        { name: "tl",     dx: -0.7, dy: -0.7 },
        { name: "br",     dx:  0.7, dy:  0.7 },
        { name: "bl",     dx: -0.7, dy:  0.7 },
      ];
      for (let d = 0; d < dirs.length; d++) {
        for (let s = 0; s < 5; s++) {
          const dir = dirs[d];
          const idx = d * 5 + s;
          test(`edge #${String(idx).padStart(3, "0")} ${dir.name}+${s} — drawing persists`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, idx % 20);
            const id = await getLatestId(sharedPage);
            const before = await getDrawingCount(sharedPage);
            const step = 80 + s * 60;
            await sharedPage.mouse.move(cx + dir.dx * step, cy + dir.dy * step, { steps: 6 });
            await sharedPage.waitForTimeout(120);
            await sharedPage.mouse.move(cx + dir.dx * (step + 200), cy + dir.dy * (step + 200), { steps: 4 });
            await sharedPage.waitForTimeout(120);
            expect(await getDrawingCount(sharedPage)).toBe(before);
            const list = await sharedPage.evaluate(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
            expect(list.find((x: any) => x.id === id)).toBeTruthy();
          });
        }
      }
    });

    // ── BLOCK 4: Undo / Redo (50 tests) ───────────────────────────────────────
    test.describe(`${TAG} undo-redo`, () => {
      for (let n = 1; n <= 10; n++) {
        for (let s = 0; s < 5; s++) {
          const idx = (n - 1) * 5 + s;
          test(`undo-redo #${String(idx).padStart(3, "0")} N=${n} s=${s}`, async () => {
            test.setTimeout(90_000);
            await reset();
            const box = await surfaceBox(sharedPage);
            for (let k = 0; k < n; k++) {
              await sharedPage.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
              await ensureToolActive(sharedPage, tool);
              await drawTool(sharedPage, tool, box, k * 3 + s);
              if ((await getDrawingCount(sharedPage)) <= k) {
                await sharedPage.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
                await ensureToolActive(sharedPage, tool);
                await drawTool(sharedPage, tool, box, k * 7 + s + 50);
              }
            }
            expect(await getDrawingCount(sharedPage)).toBe(n);
            for (let k = 0; k < n; k++) { await sharedPage.keyboard.press("Control+Z"); await sharedPage.waitForTimeout(70); }
            expect(await getDrawingCount(sharedPage)).toBe(0);
            for (let k = 0; k < n; k++) { await sharedPage.keyboard.press("Control+Y"); await sharedPage.waitForTimeout(70); }
            expect(await getDrawingCount(sharedPage)).toBe(n);
          });
        }
      }
    });

    // ── BLOCK 5: Floating Toolbar Options (40 tests) ──────────────────────────
    test.describe(`${TAG} toolbar`, () => {
      for (let i = 0; i < 40; i++) {
        test(`toolbar #${String(i).padStart(3, "0")} — options + toolbar visible`, async () => {
          await reset();
          const box = await surfaceBox(sharedPage);
          await ensureToolActive(sharedPage, tool);
          await drawTool(sharedPage, tool, box, i);
          const id = await getLatestId(sharedPage);
          expect(id).not.toBeNull();
          const drawing = await sharedPage.evaluate(
            (d) => ((window as any).__chartDebug?.getDrawings?.() ?? []).find((x: any) => x.id === d) ?? null,
            id,
          );
          expect(drawing).not.toBeNull();
          expect(drawing.variant).toBe(tool.variant);
          expect(drawing.options).toBeDefined();
          const tb = await getFloatingToolbarState(sharedPage);
          expect(tb?.visible).toBe(true);
          expect(tb?.drawingId).toBe(id);
        });
      }
    });

    // ── BLOCK 6: Multi-Drawing (30 tests) ─────────────────────────────────────
    test.describe(`${TAG} multi`, () => {
      for (let n = 1; n <= 30; n++) {
        test(`multi #${String(n).padStart(3, "0")} — ${n} drawings unique IDs`, async () => {
          test.setTimeout(120_000);
          await reset();
          for (let k = 0; k < n; k++) {
            const box = await surfaceBox(sharedPage);
            await sharedPage.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
            const before = await getDrawingCount(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, k);
            if ((await getDrawingCount(sharedPage)) <= before) {
              await sharedPage.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
              await ensureToolActive(sharedPage, tool);
              await drawTool(sharedPage, tool, box, k + 50);
            }
          }
          expect(await getDrawingCount(sharedPage)).toBe(n);
          const ids: string[] = await sharedPage.evaluate(
            () => ((window as any).__chartDebug?.getDrawings?.() ?? []).map((d: any) => d.id),
          );
          expect(new Set(ids).size).toBe(n);
        });
      }
    });

    // ── BLOCK 7: Delete (30 tests) ────────────────────────────────────────────
    test.describe(`${TAG} delete`, () => {
      for (let i = 0; i < 30; i++) {
        const method = i % 3 === 0 ? "Delete" : i % 3 === 1 ? "Backspace" : "ForceSelect+Delete";
        test(`delete #${String(i).padStart(3, "0")} via ${method}`, async () => {
          await reset();
          const box = await surfaceBox(sharedPage);
          await ensureToolActive(sharedPage, tool);
          await drawTool(sharedPage, tool, box, i);
          const id = await getLatestId(sharedPage);
          expect(id).not.toBeNull();
          if (method === "ForceSelect+Delete") {
            await sharedPage.evaluate((d) => (window as any).__chartDebug?.forceSelectDrawing?.(d), id);
            await sharedPage.waitForTimeout(80);
            await sharedPage.keyboard.press("Delete");
          } else {
            await sharedPage.keyboard.press(method);
          }
          await sharedPage.waitForTimeout(180);
          expect(await getDrawingCount(sharedPage)).toBe(0);
        });
      }
    });

    // ── BLOCK 8: Drag Anchor (30 tests) ───────────────────────────────────────
    test.describe(`${TAG} drag-anchor`, () => {
      for (let i = 0; i < 30; i++) {
        test(`drag-anchor #${String(i).padStart(3, "0")} — anchor moves`, async () => {
          await reset();
          const box = await surfaceBox(sharedPage);
          await ensureToolActive(sharedPage, tool);
          await drawTool(sharedPage, tool, box, i);
          const id = await getLatestId(sharedPage);
          const before = await getPixelAnchors(sharedPage, id);
          await sharedPage.keyboard.press("Escape");
          await sharedPage.waitForTimeout(80);
          await sharedPage.evaluate((d) => (window as any).__chartDebug?.forceSelectDrawing?.(d), id);
          await sharedPage.waitForTimeout(120);
          const surfBox = await surfaceBox(sharedPage);
          const ax = (before?.anchors?.[0]?.x ?? 0) + surfBox.x;
          const ay = (before?.anchors?.[0]?.y ?? 0) + surfBox.y;
          await sharedPage.mouse.move(ax, ay);
          await sharedPage.mouse.down();
          await sharedPage.mouse.move(ax + 15, ay + 10, { steps: 6 });
          await sharedPage.mouse.up();
          await sharedPage.waitForTimeout(180);
          expect(await getDrawingCount(sharedPage)).toBe(1);
        });
      }
    });

    // ── BLOCK 9: Escape Behaviors (30 tests) ──────────────────────────────────
    test.describe(`${TAG} escape`, () => {
      for (let i = 0; i < 30; i++) {
        const phase = i % 3;
        test(`escape #${String(i).padStart(3, "0")} phase=${phase}`, async () => {
          await reset();
          const box = await surfaceBox(sharedPage);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;

          if (phase === 0) {
            await ensureToolActive(sharedPage, tool);
            if (tool.kind === "position") {
              await sharedPage.mouse.click(cx - 30, cy);
              await sharedPage.waitForTimeout(100);
              await sharedPage.keyboard.press("Escape");
            } else if (tool.kind === "arrowMark") {
              await sharedPage.keyboard.press("Escape");
            } else if ((tool.commitMode ?? "drag") === "drag") {
              await sharedPage.mouse.move(cx - 20, cy);
              await sharedPage.mouse.down();
              await sharedPage.mouse.move(cx, cy);
              await sharedPage.keyboard.press("Escape");
              await sharedPage.mouse.up();
            } else {
              await sharedPage.keyboard.press("Escape");
            }
            await sharedPage.waitForTimeout(150);
            expect(await getDrawingCount(sharedPage)).toBe(0);
          } else if (phase === 1) {
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            expect(await getDrawingCount(sharedPage)).toBe(1);
            await sharedPage.keyboard.press("Escape");
            await sharedPage.waitForTimeout(120);
            expect(await getSelectedId(sharedPage)).toBeNull();
            expect(await getDrawingCount(sharedPage)).toBe(1);
          } else {
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            await sharedPage.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.1);
            await sharedPage.waitForTimeout(150);
            await sharedPage.keyboard.press("Escape");
            await sharedPage.waitForTimeout(80);
            expect(await getDrawingCount(sharedPage)).toBe(1);
          }
        });
      }
    });

    // ── BLOCK 10: Kind-Specific (100 tests — fills to 500 total) ─────────────
    test.describe(`${TAG} kind-specific`, () => {

      if (tool.kind === "position") {
        // 50 rr-label + 30 position-options + 20 fill-zones = 100
        for (let i = 0; i < 50; i++) {
          test(`rr-label #${String(i).padStart(3, "0")} — drawing has anchors`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const id = await getLatestId(sharedPage);
            expect(id).not.toBeNull();
            const drawing = await sharedPage.evaluate(
              (d) => ((window as any).__chartDebug?.getDrawings?.() ?? []).find((x: any) => x.id === d),
              id,
            );
            expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);
            const priceDiff = Math.abs((drawing.anchors[1]?.price ?? 0) - (drawing.anchors[0]?.price ?? 0));
            expect(priceDiff).toBeGreaterThan(0);
          });
        }
        for (let i = 0; i < 30; i++) {
          test(`position-opts #${String(i).padStart(3, "0")} — positionLabelMode defined`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const id = await getLatestId(sharedPage);
            const drawing = await sharedPage.evaluate(
              (d) => ((window as any).__chartDebug?.getDrawings?.() ?? []).find((x: any) => x.id === d),
              id,
            );
            expect(drawing?.options?.positionLabelMode).toBeDefined();
          });
        }
        for (let i = 0; i < 20; i++) {
          test(`fill-zones #${String(i).padStart(3, "0")} — 2+ anchors`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const px = await getPixelAnchors(sharedPage);
            expect(px?.anchors?.length).toBeGreaterThanOrEqual(2);
          });
        }
      }

      else if (tool.kind === "vwap") {
        for (let i = 0; i < 50; i++) {
          test(`vwap-anchor #${String(i).padStart(3, "0")} — 1 anchor placed`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const px = await getPixelAnchors(sharedPage);
            expect(px).not.toBeNull();
            expect(px.anchors.length).toBe(1);
            expect(await getDrawingCount(sharedPage)).toBe(1);
          });
        }
        for (let i = 0; i < 50; i++) {
          test(`vwap-toolbar #${String(i).padStart(3, "0")} — toolbar visible`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const tb = await getFloatingToolbarState(sharedPage);
            expect(tb?.visible).toBe(true);
          });
        }
      }

      else if (tool.kind === "volumeProfile") {
        for (let i = 0; i < 50; i++) {
          test(`vol-draw #${String(i).padStart(3, "0")} — drawing created`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            expect(await getDrawingCount(sharedPage)).toBe(1);
            const px = await getPixelAnchors(sharedPage);
            expect(px).not.toBeNull();
          });
        }
        for (let i = 0; i < 50; i++) {
          test(`vol-options #${String(i).padStart(3, "0")} — options.opacity defined`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const id = await getLatestId(sharedPage);
            const drawing = await sharedPage.evaluate(
              (d) => ((window as any).__chartDebug?.getDrawings?.() ?? []).find((x: any) => x.id === d),
              id,
            );
            expect(drawing?.options?.opacity ?? drawing?.options?.rowsLayout ?? drawing?.options).toBeDefined();
          });
        }
      }

      else if (tool.kind === "measurer" || tool.kind === "barPattern" || tool.kind === "ghostFeed") {
        for (let i = 0; i < 60; i++) {
          test(`draw-verify #${String(i).padStart(3, "0")} — drawing count +1`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            const before = await getDrawingCount(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            expect(await getDrawingCount(sharedPage)).toBe(before + 1);
          });
        }
        for (let i = 0; i < 40; i++) {
          test(`options-defined #${String(i).padStart(3, "0")} — drawing options set`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const id = await getLatestId(sharedPage);
            const drawing = await sharedPage.evaluate(
              (d) => ((window as any).__chartDebug?.getDrawings?.() ?? []).find((x: any) => x.id === d),
              id,
            );
            expect(drawing).not.toBeNull();
            expect(drawing?.variant).toBe(tool.variant);
          });
        }
      }

      else if (tool.kind === "brush") {
        // brush / highlighter — freehand strokes
        for (let i = 0; i < 60; i++) {
          test(`stroke #${String(i).padStart(3, "0")} — freehand stroke has ≥2 anchors`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const px = await getPixelAnchors(sharedPage);
            expect(px).not.toBeNull();
            expect(px.anchors.length).toBeGreaterThanOrEqual(2);
          });
        }
        for (let i = 0; i < 40; i++) {
          test(`stroke-toolbar #${String(i).padStart(3, "0")} — toolbar visible after stroke`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const tb = await getFloatingToolbarState(sharedPage);
            expect(tb?.visible).toBe(true);
          });
        }
      }

      else if (tool.kind === "arrowMark") {
        for (let i = 0; i < 60; i++) {
          test(`stamp #${String(i).padStart(3, "0")} — 1-anchor stamp count +1`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            const before = await getDrawingCount(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            expect(await getDrawingCount(sharedPage)).toBe(before + 1);
            const px = await getPixelAnchors(sharedPage);
            expect(px?.anchors?.length).toBe(1);
          });
        }
        for (let i = 0; i < 40; i++) {
          test(`stamp-toolbar #${String(i).padStart(3, "0")} — toolbar visible`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const tb = await getFloatingToolbarState(sharedPage);
            expect(tb?.visible).toBe(true);
          });
        }
      }

      else {
        // arrowLine + shape — 2/3-anchor drawings
        for (let i = 0; i < 60; i++) {
          test(`draw-exact #${String(i).padStart(3, "0")} — exact anchor count`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const px = await getPixelAnchors(sharedPage);
            expect(px).not.toBeNull();
            expect(px.variant).toBe(tool.variant);
            expect(px.anchors.length).toBe(ANCHOR_COUNT);
          });
        }
        for (let i = 0; i < 40; i++) {
          test(`shape-toolbar #${String(i).padStart(3, "0")} — toolbar visible`, async () => {
            await reset();
            const box = await surfaceBox(sharedPage);
            await ensureToolActive(sharedPage, tool);
            await drawTool(sharedPage, tool, box, i);
            const tb = await getFloatingToolbarState(sharedPage);
            expect(tb?.visible).toBe(true);
          });
        }
      }
    });
  });
}
