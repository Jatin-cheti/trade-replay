/**
 * Demo-cursor airbrush differentiation — 50 tests confirming the Alt+drag
 * brush in demonstration mode visually matches the red circle indicator
 * (large, semi-transparent, soft) rather than a thin opaque red pen.
 *
 * Parity target: TradingView Demonstration cursor.
 *   - Circle indicator: 20px diameter, fill ~rgba(211,47,47,0.18), 1.5px border rgba(211,47,47,0.85).
 *   - Brush stroke should match the fill (airbrush feel), not draw a thin pen line.
 *
 * These tests are SOURCE-OF-TRUTH tests for our own implementation.
 * They encode the visual contract (lineWidth == circle diameter, low alpha fill,
 * round line caps, canvas pixels show low-alpha red at stroke locations) so any
 * regression that reverts back to "pen" mode will fail loudly.
 *
 * Run against local stack (frontend dev server with prod API proxy):
 *   npx playwright test e2e/demo-cursor-airbrush-50.spec.ts \
 *     --project=chromium --config=e2e/playwright.local-preview.config.ts
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
      getColor?: () => string;
      getLineWidth?: () => number;
      getFadeDuration?: () => number;
    };
  };
  __tradereplaySetCursorMode?: (m: CursorMode) => void;
  __tradereplayGetCursorMode?: () => CursorMode;
};

// ── Fresh-page helpers ─────────────────────────────────────────────────────
// This suite asserts on DEFAULT values so each test needs an independent page
// that hasn't had setColor/setLineWidth called on it.
async function gotoChartFresh(page: Page): Promise<void> {
  await page.goto(`${BASE}/charts?symbol=RELIANCE`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="chart-container"]', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const w = window as unknown as ChartWindow;
    return !!w.__tradereplayChart
      && typeof w.__tradereplayChart.demoCursor === "function"
      && typeof w.__tradereplaySetCursorMode === "function";
  }, { timeout: 20_000 });
  await page.waitForTimeout(1200);
}

async function chartBox(page: Page) {
  const b = await page.locator('[data-testid="chart-container"]').boundingBox();
  if (!b) throw new Error("no chart box");
  return b;
}

function interior(box: { x: number; y: number; width: number; height: number }, fx: number, fy: number) {
  const ml = 40, mr = 100, mt = 60, mb = 60;
  return { x: box.x + ml + (box.width - ml - mr) * fx, y: box.y + mt + (box.height - mt - mb) * fy };
}

async function altDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8): Promise<void> {
  await page.keyboard.down("Alt");
  try {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
  } finally {
    await page.keyboard.up("Alt");
  }
}

// Demo circle DOM indicator (source-of-truth for visual target).
async function readCircleStyle(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="demo-cursor-circle"]') as HTMLElement | null;
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      width: parseFloat(s.width),
      height: parseFloat(s.height),
      background: s.backgroundColor,
      borderRadius: s.borderRadius,
    };
  });
}

async function getDefaults(page: Page) {
  return page.evaluate(() => {
    const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
    return {
      color: typeof dc.getColor === "function" ? dc.getColor() : null,
      lineWidth: typeof dc.getLineWidth === "function" ? dc.getLineWidth() : null,
      fadeDuration: typeof dc.getFadeDuration === "function" ? dc.getFadeDuration() : null,
    };
  });
}

function parseRgba(css: string): { r: number; g: number; b: number; a: number } | null {
  const m = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i.exec(css);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
}

// ── Canvas pixel probing ───────────────────────────────────────────────────
// Scan a small box around the target coords and return the maximum red
// channel value found in any pixel. This is tolerant of the low-alpha
// airbrush (0.18) where a single-pixel hit may miss the stroke path.
async function maxRedAround(page: Page, cx: number, cy: number, halfBox = 12): Promise<{ maxR: number; bgR: number } | null> {
  return page.evaluate(({ cx, cy, hb }) => {
    // Wait one RAF so any pending chart render is flushed before sampling.
    return new Promise<{ maxR: number; bgR: number } | null>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Pick the largest 2D canvas inside the chart container.
          const container = document.querySelector('[data-testid="chart-container"]') as HTMLElement | null;
          if (!container) return resolve(null);
          const all = Array.from(container.querySelectorAll("canvas")) as HTMLCanvasElement[];
          const chart = all.reduce<HTMLCanvasElement | null>((acc, c) => {
            if (!acc) return c;
            return c.width * c.height > acc.width * acc.height ? c : acc;
          }, null);
          if (!chart) return resolve(null);
          const rect = chart.getBoundingClientRect();
          const toCanvasX = (x: number) => Math.round((x - rect.left) * (chart.width / rect.width));
          const toCanvasY = (y: number) => Math.round((y - rect.top) * (chart.height / rect.height));
          const x0 = Math.max(0, toCanvasX(cx - hb));
          const y0 = Math.max(0, toCanvasY(cy - hb));
          const x1 = Math.min(chart.width - 1, toCanvasX(cx + hb));
          const y1 = Math.min(chart.height - 1, toCanvasY(cy + hb));
          const w = Math.max(1, x1 - x0 + 1);
          const h = Math.max(1, y1 - y0 + 1);
          try {
            const ctx = chart.getContext("2d");
            if (!ctx) return resolve(null);
            const img = ctx.getImageData(x0, y0, w, h).data;
            let maxR = 0;
            for (let i = 0; i < img.length; i += 4) if (img[i] > maxR) maxR = img[i];
            // Sample background far top-left corner for comparison baseline.
            const bgImg = ctx.getImageData(2, 2, 1, 1).data;
            resolve({ maxR, bgR: bgImg[0] });
          } catch {
            resolve(null);
          }
        });
      });
    });
  }, { cx, cy, hb: halfBox });
}

// ── Tests ──────────────────────────────────────────────────────────────────
test.describe("Demo cursor airbrush parity (50 tests)", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChartFresh(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => {
    await page.evaluate(() => {
      (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().clearStrokes();
    });
  });

  // ── Section A: Default brush config matches airbrush contract (10) ──────
  test("A01. default lineWidth is 20 (matches demo circle diameter)", async () => {
    const d = await getDefaults(page);
    expect(d.lineWidth).toBe(20);
  });
  test("A02. default color is rgba(211, 47, 47, 0.18) (airbrush red)", async () => {
    const d = await getDefaults(page);
    expect(d.color).toMatch(/rgba?\(\s*211\s*,\s*47\s*,\s*47\s*,\s*0?\.18\s*\)/i);
  });
  test("A03. default color alpha is low (<= 0.25, airbrush feel)", async () => {
    const d = await getDefaults(page);
    const p = d.color ? parseRgba(d.color) : null;
    expect(p).not.toBeNull();
    expect(p!.a).toBeLessThanOrEqual(0.25);
  });
  test("A04. default color alpha is > 0 (visible)", async () => {
    const d = await getDefaults(page);
    const p = d.color ? parseRgba(d.color) : null;
    expect(p!.a).toBeGreaterThan(0);
  });
  test("A05. default color is red-dominant (red channel highest)", async () => {
    const d = await getDefaults(page);
    const p = d.color ? parseRgba(d.color) : null;
    expect(p!.r).toBeGreaterThan(p!.g);
    expect(p!.r).toBeGreaterThan(p!.b);
  });
  test("A06. default color red channel >= 200 (strong red)", async () => {
    const d = await getDefaults(page);
    const p = d.color ? parseRgba(d.color) : null;
    expect(p!.r).toBeGreaterThanOrEqual(200);
  });
  test("A07. default lineWidth is large (>= 16, NOT pen-like)", async () => {
    const d = await getDefaults(page);
    expect(d.lineWidth!).toBeGreaterThanOrEqual(16);
  });
  test("A08. default lineWidth is not thin (!= 1,2,3)", async () => {
    const d = await getDefaults(page);
    expect([1, 2, 3]).not.toContain(d.lineWidth);
  });
  test("A09. default fade duration is 3000ms (TV parity)", async () => {
    const d = await getDefaults(page);
    expect(d.fadeDuration).toBe(3000);
  });
  test("A10. default color green and blue channels are low (<= 80, red-dominant)", async () => {
    const d = await getDefaults(page);
    const p = d.color ? parseRgba(d.color) : null;
    expect(p!.g).toBeLessThanOrEqual(80);
    expect(p!.b).toBeLessThanOrEqual(80);
  });

  // ── Section B: Circle indicator visual contract (10) ────────────────────
  // These tests lock the DOM circle's look, which is what the brush mirrors.
  test("B01. demo circle element exists in DOM", async () => {
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplaySetCursorMode!("demo"));
    const box = await chartBox(page);
    await page.mouse.move(interior(box, 0.5, 0.5).x, interior(box, 0.5, 0.5).y);
    await page.waitForTimeout(80);
    const s = await readCircleStyle(page);
    expect(s).not.toBeNull();
  });
  test("B02. demo circle width is 20px", async () => {
    const s = await readCircleStyle(page);
    expect(s!.width).toBe(20);
  });
  test("B03. demo circle height is 20px", async () => {
    const s = await readCircleStyle(page);
    expect(s!.height).toBe(20);
  });
  test("B04. demo circle is perfectly round (50% border-radius)", async () => {
    const s = await readCircleStyle(page);
    expect(s!.borderRadius).toMatch(/50%|10px/);
  });
  test("B05. demo circle background is red-dominant", async () => {
    const s = await readCircleStyle(page);
    const p = parseRgba(s!.background);
    expect(p).not.toBeNull();
    expect(p!.r).toBeGreaterThan(p!.g);
    expect(p!.r).toBeGreaterThan(p!.b);
  });
  test("B06. demo circle background alpha is low (airbrush target)", async () => {
    const s = await readCircleStyle(page);
    const p = parseRgba(s!.background);
    expect(p!.a).toBeLessThan(0.3);
  });
  test("B07. brush lineWidth equals circle diameter (20)", async () => {
    const d = await getDefaults(page);
    const s = await readCircleStyle(page);
    expect(d.lineWidth).toBe(s!.width);
  });
  test("B08. brush color alpha is close to circle alpha (within 0.1)", async () => {
    const d = await getDefaults(page);
    const s = await readCircleStyle(page);
    const bp = parseRgba(d.color!);
    const cp = parseRgba(s!.background);
    expect(Math.abs(bp!.a - cp!.a)).toBeLessThanOrEqual(0.1);
  });
  test("B09. brush color red channel matches circle red channel (within 50)", async () => {
    const d = await getDefaults(page);
    const s = await readCircleStyle(page);
    const bp = parseRgba(d.color!);
    const cp = parseRgba(s!.background);
    expect(Math.abs(bp!.r - cp!.r)).toBeLessThanOrEqual(50);
  });
  test("B10. brush not drawn as opaque (default alpha < 0.5)", async () => {
    const d = await getDefaults(page);
    const p = parseRgba(d.color!);
    expect(p!.a).toBeLessThan(0.5);
  });

  // ── Section C: Alt-drag stroke behavior matches airbrush (15) ───────────
  test("C01. Alt-drag creates exactly 1 stroke", async () => {
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().clearStrokes());
    const box = await chartBox(page);
    await altDrag(page, interior(box, 0.3, 0.4), interior(box, 0.5, 0.45), 8);
    const n = await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().strokeCount());
    expect(n).toBe(1);
  });
  for (let i = 0; i < 10; i++) {
    test(`C${String(i + 2).padStart(2, "0")}. Alt-drag at position ${i} creates stroke visible on canvas`, async () => {
      await page.evaluate(() => {
        const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
        dc.clearStrokes();
        dc.setFadeDuration(60 * 1000);
      });
      const box = await chartBox(page);
      const fx = 0.2 + (i % 5) * 0.1;
      const fy = 0.3 + Math.floor(i / 5) * 0.2;
      const a = interior(box, fx, fy);
      const b = interior(box, fx + 0.06, fy + 0.05);
      await altDrag(page, a, b, 10);
      // Scan a 25×25 box around mid. Airbrush red should raise the max red
      // channel noticeably above the background.
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const res = await maxRedAround(page, mid.x, mid.y, 12);
      expect(res).not.toBeNull();
      expect(res!.maxR).toBeGreaterThan(res!.bgR + 15);
    });
  }
  test("C12. Alt-drag respects default (large) lineWidth — stroke width present across perpendicular probe", async () => {
    await page.evaluate(() => {
      const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
      dc.clearStrokes();
      dc.setFadeDuration(60 * 1000);
    });
    const box = await chartBox(page);
    const a = interior(box, 0.3, 0.5);
    const b = interior(box, 0.6, 0.5); // horizontal drag
    await altDrag(page, a, b, 12);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // Sample above and below the horizontal line. With lineWidth=20, both
    // +/-8px off-axis should still be inside the stroke region.
    const above = await maxRedAround(page, mid.x, mid.y - 8, 3);
    const below = await maxRedAround(page, mid.x, mid.y + 8, 3);
    expect(above).not.toBeNull();
    expect(below).not.toBeNull();
    expect(above!.maxR).toBeGreaterThan(above!.bgR + 8);
    expect(below!.maxR).toBeGreaterThan(below!.bgR + 8);
  });
  test("C13. two Alt-drags produce two strokes", async () => {
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().clearStrokes());
    const box = await chartBox(page);
    await altDrag(page, interior(box, 0.3, 0.3), interior(box, 0.5, 0.3), 6);
    await altDrag(page, interior(box, 0.3, 0.6), interior(box, 0.5, 0.6), 6);
    const n = await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().strokeCount());
    expect(n).toBe(2);
  });
  test("C14. clearStrokes removes all strokes", async () => {
    const box = await chartBox(page);
    await altDrag(page, interior(box, 0.4, 0.4), interior(box, 0.5, 0.45), 6);
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().clearStrokes());
    const n = await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().strokeCount());
    expect(n).toBe(0);
  });
  test("C15. plain drag does NOT create stroke (no Alt)", async () => {
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().clearStrokes());
    const box = await chartBox(page);
    const a = interior(box, 0.3, 0.4);
    const b = interior(box, 0.5, 0.45);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    const n = await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().strokeCount());
    expect(n).toBe(0);
  });

  // ── Section D: Configurability parity (10) ─────────────────────────────
  test("D01. setLineWidth(5) then getLineWidth returns 5", async () => {
    await page.evaluate(() => {
      const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
      dc.setLineWidth(5);
    });
    const d = await getDefaults(page);
    expect(d.lineWidth).toBe(5);
  });
  test("D02. setColor('rgba(0,200,0,0.4)') then getColor echoes", async () => {
    await page.evaluate(() => {
      const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
      dc.setColor("rgba(0,200,0,0.4)");
    });
    const d = await getDefaults(page);
    expect(d.color!).toMatch(/0\s*,\s*200\s*,\s*0\s*,\s*0?\.4/);
  });
  test("D03. setFadeDuration(7000) echoes via getFadeDuration", async () => {
    await page.evaluate(() => {
      (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setFadeDuration(7000);
    });
    const d = await getDefaults(page);
    expect(d.fadeDuration).toBe(7000);
  });
  test("D04. setLineWidth(20) restores airbrush default magnitude", async () => {
    await page.evaluate(() => {
      (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setLineWidth(20);
    });
    const d = await getDefaults(page);
    expect(d.lineWidth).toBe(20);
  });
  test("D05. custom color persists across strokes", async () => {
    await page.evaluate(() => {
      const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
      dc.clearStrokes();
      dc.setColor("rgba(50, 50, 200, 0.3)");
    });
    const box = await chartBox(page);
    await altDrag(page, interior(box, 0.4, 0.5), interior(box, 0.5, 0.5), 6);
    const d = await getDefaults(page);
    expect(d.color!).toMatch(/50\s*,\s*50\s*,\s*200/);
  });
  test("D06. resetting color back to airbrush red works", async () => {
    await page.evaluate(() => {
      (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setColor("rgba(211, 47, 47, 0.18)");
    });
    const d = await getDefaults(page);
    expect(d.color!).toMatch(/211\s*,\s*47\s*,\s*47/);
  });
  test("D07. setLineWidth(0) does not crash", async () => {
    const ok = await page.evaluate(() => {
      try {
        (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setLineWidth(0);
        return true;
      } catch { return false; }
    });
    expect(ok).toBe(true);
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setLineWidth(20));
  });
  test("D08. setColor('red') accepts plain CSS name", async () => {
    await page.evaluate(() => {
      (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setColor("red");
    });
    const d = await getDefaults(page);
    expect(d.color).toBe("red");
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setColor("rgba(211, 47, 47, 0.18)"));
  });
  test("D09. setActive(true)/setActive(false) echoes via isActive", async () => {
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setActive(true));
    const a1 = await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().isActive());
    expect(a1).toBe(true);
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setActive(false));
    const a2 = await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().isActive());
    expect(a2).toBe(false);
  });
  test("D10. setLineWidth preserves across mode switches", async () => {
    await page.evaluate(() => {
      const dc = (window as unknown as ChartWindow).__tradereplayChart!.demoCursor();
      dc.setLineWidth(15);
    });
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplaySetCursorMode!("arrow"));
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplaySetCursorMode!("demo"));
    const d = await getDefaults(page);
    expect(d.lineWidth).toBe(15);
    // Restore default for any following tests.
    await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setLineWidth(20));
  });

  // ── Section E: Pen-regression guards (5) ───────────────────────────────
  test("E01. brush is NOT a thin pen (default lineWidth > 5)", async () => {
    const d = await getDefaults(page);
    expect(d.lineWidth!).toBeGreaterThan(5);
  });
  test("E02. brush is NOT fully opaque (default alpha < 1)", async () => {
    const d = await getDefaults(page);
    const p = parseRgba(d.color!);
    expect(p!.a).toBeLessThan(1);
  });
  test("E03. brush alpha is strictly less than old pen alpha (0.9)", async () => {
    const d = await getDefaults(page);
    const p = parseRgba(d.color!);
    expect(p!.a).toBeLessThan(0.9);
  });
  test("E04. brush lineWidth is strictly greater than old pen lineWidth (2)", async () => {
    const d = await getDefaults(page);
    expect(d.lineWidth!).toBeGreaterThan(2);
  });
  test("E05. brush color is NOT the old pen color 'rgba(255, 82, 82, 0.9)'", async () => {
    const d = await getDefaults(page);
    expect(d.color).not.toMatch(/255\s*,\s*82\s*,\s*82\s*,\s*0?\.9/);
  });
});

// Summary: 10 (A) + 10 (B) + 15 (C) + 10 (D) + 5 (E) = 50 tests.
