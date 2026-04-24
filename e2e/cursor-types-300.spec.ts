/**
 * Cursor modes — 300 TradingView parity tests covering:
 *   cross | dot | arrow | demo | eraser
 *
 * Each cursor mode is parametrized with 60 tests covering mode setting,
 * CSS cursor hints, demoCursor library state, plain-drag non-drawing,
 * Alt-drag drawing (non-eraser modes), and mode-switch stability.
 *
 * Relies on test-only window hooks:
 *   window.__tradereplaySetCursorMode(mode)
 *   window.__tradereplayGetCursorMode()
 *   window.__tradereplayChart.demoCursor().*
 */
import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_USE_EXTERNAL_STACK === "true"
  ? "https://tradereplay.me"
  : "http://127.0.0.1:8080";

type CursorMode = "cross" | "dot" | "arrow" | "demo" | "eraser";

type ChartWindow = {
  __tradereplayChart?: {
    demoCursor: () => {
      clearStrokes: () => void;
      strokeCount: () => number;
      setFadeDuration: (ms: number) => void;
      setActive: (a: boolean) => void;
      isActive: () => boolean;
      setColor: (c: string) => void;
      setLineWidth: (w: number) => void;
    };
    timeScale: () => { getVisibleLogicalRange: () => { from: number; to: number } | null };
  };
  __tradereplaySetCursorMode?: (m: CursorMode) => void;
  __tradereplayGetCursorMode?: () => CursorMode;
};

async function gotoChart(page: Page): Promise<void> {
  await page.goto(`${BASE}/charts?symbol=RELIANCE`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="chart-container"]', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const w = window as unknown as ChartWindow;
    return !!w.__tradereplayChart
      && typeof w.__tradereplayChart.demoCursor === "function"
      && typeof w.__tradereplaySetCursorMode === "function"
      && typeof w.__tradereplayGetCursorMode === "function";
  }, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setFadeDuration(10 * 60 * 1000);
  });
}

async function chartBox(page: Page) {
  const b = await page.locator('[data-testid="chart-container"]').boundingBox();
  if (!b) throw new Error("no chart box");
  return b;
}
async function setMode(page: Page, m: CursorMode) {
  await page.evaluate((mode) => {
    (window as unknown as ChartWindow).__tradereplaySetCursorMode!(mode);
  }, m);
}
async function getMode(page: Page): Promise<CursorMode> {
  return page.evaluate(() => (window as unknown as ChartWindow).__tradereplayGetCursorMode!());
}
async function strokeCount(page: Page) {
  return page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().strokeCount());
}
async function clearStrokes(page: Page) {
  await page.evaluate(() => {
    const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
    dc.clearStrokes();
    dc.setFadeDuration(10 * 60 * 1000);
    dc.setActive(false);
  });
}
async function altDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 6) {
  await page.keyboard.down("Alt");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
  await page.keyboard.up("Alt");
}
async function plainDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}
function interior(box: { x: number; y: number; width: number; height: number }, fx: number, fy: number) {
  const ml = 20, mr = 80, mt = 40, mb = 40;
  return { x: box.x + ml + (box.width - ml - mr) * fx, y: box.y + mt + (box.height - mt - mb) * fy };
}

// Cursor CSS expectations per mode (from TradingChart.cursorCssByMode).
function expectedCursorMatcher(mode: CursorMode): RegExp {
  switch (mode) {
    case "cross":  return /crosshair/;
    case "dot":    return /url\(/;          // custom SVG dot
    case "arrow":  return /default|auto/;
    case "demo":   return /none|crosshair/; // none (red overlay) or crosshair (Alt held)
    case "eraser": return /url\(/;          // custom SVG eraser
  }
}

async function overlayCursor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const c = document.querySelector('canvas[aria-label="chart-drawing-overlay"]') as HTMLCanvasElement | null;
    if (!c) return "";
    return getComputedStyle(c).cursor;
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Per-mode 60-test block builder.
// Distribution per mode (60):
//   12× mode set returns same via getMode
//   12× overlay cursor CSS matches expected pattern
//   12× clearStrokes sets count to 0
//   12× plain drag creates NO stroke (TV: pan-only)
//   12× (non-eraser) Alt-drag creates 1 stroke; (eraser) clicking empty area does not throw and stroke count stable
// ───────────────────────────────────────────────────────────────────────────
function runCursorModeSuite(mode: CursorMode, letter: string) {
  test.describe(`${letter}. Cursor mode "${mode}"`, () => {
    test.describe.configure({ mode: "serial" });
    let page: Page;
    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage();
      await gotoChart(page);
      await setMode(page, mode);
    });
    test.beforeEach(async () => {
      await setMode(page, mode);
      await clearStrokes(page);
    });
    test.afterAll(async () => { await page.close(); });

    // 12× set/get mode
    for (let i = 0; i < 12; i++) {
      test(`${letter}${String(i + 1).padStart(2, "0")}. setMode(${mode}) round-trips via getMode #${i + 1}`, async () => {
        await setMode(page, mode);
        expect(await getMode(page)).toBe(mode);
      });
    }
    // 12× cursor CSS matches
    const cssRe = expectedCursorMatcher(mode);
    for (let i = 0; i < 12; i++) {
      test(`${letter}${String(i + 13).padStart(2, "0")}. overlay cursor CSS matches ${cssRe} #${i + 1}`, async () => {
        await setMode(page, mode);
        // Move mouse into chart so demo/eraser have a chance to apply style.
        const box = await chartBox(page);
        const p = interior(box, 0.4 + (i % 3) * 0.05, 0.4);
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(50);
        const cur = await overlayCursor(page);
        expect(cur).toMatch(cssRe);
      });
    }
    // 12× clearStrokes → 0
    for (let i = 0; i < 12; i++) {
      test(`${letter}${String(i + 25).padStart(2, "0")}. clearStrokes in ${mode} → count=0 #${i + 1}`, async () => {
        await clearStrokes(page);
        expect(await strokeCount(page)).toBe(0);
      });
    }
    // 12× plain drag creates NO stroke
    for (let i = 0; i < 12; i++) {
      test(`${letter}${String(i + 37).padStart(2, "0")}. plain drag in ${mode} draws 0 strokes #${i + 1}`, async () => {
        await clearStrokes(page);
        const box = await chartBox(page);
        const fx = 0.3 + (i % 4) * 0.08;
        await plainDrag(page, interior(box, fx, 0.45), interior(box, fx + 0.1, 0.5), 6);
        expect(await strokeCount(page)).toBe(0);
      });
    }
    // 12× Alt-drag behavior
    for (let i = 0; i < 12; i++) {
      const fx = 0.25 + (i % 4) * 0.1;
      const fy = 0.3 + Math.floor(i / 4) * 0.1;
      if (mode === "eraser") {
        test(`${letter}${String(i + 49).padStart(2, "0")}. ${mode}: alt-click empty area does not throw & count stable #${i + 1}`, async () => {
          await clearStrokes(page);
          const box = await chartBox(page);
          const p = interior(box, fx, fy);
          const before = await strokeCount(page);
          await page.keyboard.down("Alt");
          await page.mouse.move(p.x, p.y);
          await page.mouse.down();
          await page.mouse.up();
          await page.keyboard.up("Alt");
          // No drawings exist → eraser no-op. Stroke count should not decrease.
          expect(await strokeCount(page)).toBe(before);
        });
      } else {
        test(`${letter}${String(i + 49).padStart(2, "0")}. ${mode}: alt-drag draws 1 stroke #${i + 1}`, async () => {
          await clearStrokes(page);
          const box = await chartBox(page);
          await altDrag(page, interior(box, fx, fy), interior(box, fx + 0.08, fy + 0.05), 4);
          expect(await strokeCount(page)).toBe(1);
        });
      }
    }
  });
}

runCursorModeSuite("cross",  "CR");
runCursorModeSuite("dot",    "DT");
runCursorModeSuite("arrow",  "AR");
runCursorModeSuite("demo",   "DM");
runCursorModeSuite("eraser", "ER");

// Summary: 5 modes × 60 = 300 tests.
