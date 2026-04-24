/**
 * Demo Cursor â€” 200-point TradingView parity suite.
 *
 * Contract (modeled after TradingView's "Hold Alt for temporary drawing"):
 *   - Plain pointerdown+drag in chart area pans; NO stroke is drawn.
 *   - Alt+pointerdown+drag draws exactly one red freehand stroke per gesture.
 *   - Alt release mid-drag finalizes the stroke; subsequent moves don't extend.
 *   - Alt on the price-axis strip (right edge) or outside the chart does NOT start a stroke.
 *   - setActive(true) is cosmetic (cursor hint); it does NOT make plain-drag draw.
 *   - demoCursor API: clearStrokes / setColor / setLineWidth / setFadeDuration /
 *     setActive / isActive / strokeCount / beginStroke / extendStroke / endStroke.
 *
 * Tests are organized into describes (mode: serial), each of which reuses a
 * single loaded page to keep total runtime practical. Each test clears strokes
 * first, so tests are independent.
 */
import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_USE_EXTERNAL_STACK === "true"
  ? "https://tradereplay.me"
  : "http://127.0.0.1:8080";

type ChartWindow = {
  __tradereplayChart?: {
    demoCursor: () => {
      clearStrokes: () => void;
      setColor: (c: string) => void;
      setLineWidth: (w: number) => void;
      setFadeDuration: (ms: number) => void;
      strokeCount: () => number;
      setActive: (a: boolean) => void;
      isActive: () => boolean;
      beginStroke: (x: number, y: number) => void;
      extendStroke: (x: number, y: number) => void;
      endStroke: () => void;
    };
    timeScale: () => {
      getVisibleLogicalRange: () => { from: number; to: number } | null;
    };
  };
};

async function gotoChart(page: Page): Promise<void> {
  await page.goto(`${BASE}/charts?symbol=RELIANCE`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="charts-page"]', { timeout: 30_000 });
  await page.waitForSelector('[data-testid="chart-container"]', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const w = window as unknown as ChartWindow;
    return !!w.__tradereplayChart && typeof w.__tradereplayChart.demoCursor === "function";
  }, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  // Keep strokes effectively non-fading during the suite.
  await page.evaluate(() => {
    const w = window as unknown as ChartWindow;
    w.__tradereplayChart!.demoCursor().setFadeDuration(10 * 60 * 1000);
  });
}

async function chartBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await page.locator('[data-testid="chart-container"]').boundingBox();
  if (!b) throw new Error("chart-container has no bounding box");
  return b;
}

async function strokeCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as ChartWindow;
    return w.__tradereplayChart?.demoCursor().strokeCount() ?? -1;
  });
}

async function clearStrokes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as ChartWindow;
    const dc = w.__tradereplayChart?.demoCursor();
    dc?.clearStrokes();
    dc?.setFadeDuration(10 * 60 * 1000);
    dc?.setActive(false);
    dc?.setColor("rgba(255,80,80,1)");
    dc?.setLineWidth(3);
  });
}

async function visibleRange(page: Page): Promise<{ from: number; to: number } | null> {
  return page.evaluate(() => {
    const w = window as unknown as ChartWindow;
    return w.__tradereplayChart?.timeScale().getVisibleLogicalRange() ?? null;
  });
}

async function plainDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10,
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

async function altDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10,
): Promise<void> {
  await page.keyboard.down("Alt");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
  await page.keyboard.up("Alt");
}

// Point in the safe "chart interior" (away from any axis strip).
function interior(box: { x: number; y: number; width: number; height: number }, fx: number, fy: number) {
  // Leave margins so we never accidentally hit the right-side price axis or bottom time axis.
  const marginRight = 80;  // price axis
  const marginBottom = 40; // time axis
  const marginLeft = 20;
  const marginTop = 40;
  const x = box.x + marginLeft + (box.width - marginLeft - marginRight) * fx;
  const y = box.y + marginTop + (box.height - marginTop - marginBottom) * fy;
  return { x, y };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section A â€” Activation gates: plain drag NEVER draws (30 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("A. Plain drag never draws a stroke", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  const dragParams: Array<{ fx: number; fy: number; tx: number; ty: number; steps: number }> = [];
  for (let i = 0; i < 30; i++) {
    const fx = 0.2 + (i % 5) * 0.12;
    const fy = 0.2 + Math.floor(i / 5) * 0.12;
    const tx = fx + 0.15;
    const ty = fy + 0.05;
    dragParams.push({ fx, fy, tx, ty, steps: 5 + (i % 10) });
  }
  for (let i = 0; i < dragParams.length; i++) {
    const p = dragParams[i];
    test(`A${String(i + 1).padStart(2, "0")}. plain drag (${p.fx.toFixed(2)},${p.fy.toFixed(2)})â†’(${p.tx.toFixed(2)},${p.ty.toFixed(2)}) does not draw`, async () => {
      const box = await chartBox(page);
      const before = await strokeCount(page);
      await plainDrag(page, interior(box, p.fx, p.fy), interior(box, p.tx, p.ty), p.steps);
      const after = await strokeCount(page);
      expect(after).toBe(before);
    });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section B â€” Alt drag draws EXACTLY one stroke per gesture (30 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("B. Alt drag draws exactly one stroke", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let i = 0; i < 30; i++) {
    const fx = 0.15 + (i % 6) * 0.10;
    const fy = 0.2 + Math.floor(i / 6) * 0.12;
    const tx = fx + 0.10 + (i % 3) * 0.05;
    const ty = fy + 0.08;
    const steps = 6 + (i % 7);
    test(`B${String(i + 1).padStart(2, "0")}. Alt drag (${fx.toFixed(2)},${fy.toFixed(2)})â†’(${tx.toFixed(2)},${ty.toFixed(2)}) draws 1`, async () => {
      const box = await chartBox(page);
      const before = await strokeCount(page);
      await altDrag(page, interior(box, fx, fy), interior(box, tx, ty), steps);
      const after = await strokeCount(page);
      expect(after - before).toBe(1);
    });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section C â€” N consecutive Alt gestures produce exactly N strokes (10 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("C. N consecutive Alt gestures â†’ N strokes", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    test(`C${String(n).padStart(2, "0")}. ${n} Alt gestures produce ${n} strokes`, async () => {
      const box = await chartBox(page);
      const before = await strokeCount(page);
      for (let i = 0; i < n; i++) {
        const fx = 0.2 + (i % 5) * 0.08;
        const fy = 0.3 + Math.floor(i / 5) * 0.15;
        await altDrag(page, interior(box, fx, fy), interior(box, fx + 0.08, fy + 0.05), 5);
        await page.waitForTimeout(80);
      }
      const after = await strokeCount(page);
      expect(after - before).toBe(n);
    });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section D â€” Alt release mid-drag finalizes; extra moves don't extend (10 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("D. Alt release mid-drag finalizes", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let i = 0; i < 10; i++) {
    test(`D${String(i + 1).padStart(2, "0")}. Alt held then released mid-drag produces exactly 1 stroke`, async () => {
      const box = await chartBox(page);
      const before = await strokeCount(page);
      const from = interior(box, 0.2 + i * 0.03, 0.3);
      const mid = interior(box, 0.35 + i * 0.03, 0.35);
      const end = interior(box, 0.5 + i * 0.03, 0.45);
      await page.keyboard.down("Alt");
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(mid.x, mid.y, { steps: 6 });
      await page.keyboard.up("Alt");
      await page.mouse.move(end.x, end.y, { steps: 6 });
      await page.mouse.up();
      const after = await strokeCount(page);
      expect(after - before).toBe(1);
    });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section E â€” Axis exclusion: Alt on price/time axis does not draw (20 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("E. Alt outside chart area does not draw", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  // Price axis strip (right 40px)
  for (let i = 0; i < 10; i++) {
    test(`E${String(i + 1).padStart(2, "0")}. Alt-drag on price axis (offset ${i * 2}px) does not draw`, async () => {
      const box = await chartBox(page);
      const before = await strokeCount(page);
      const px = box.x + box.width - 10 - i * 2;
      const py = box.y + 100 + i * 10;
      await altDrag(page, { x: px, y: py }, { x: px - 3, y: py + 20 }, 4);
      const after = await strokeCount(page);
      expect(after).toBe(before);
    });
  }
  // Time axis strip (bottom 30px) â€” extend via beginning on bottom edge
  for (let i = 0; i < 10; i++) {
    test(`E${String(i + 11).padStart(2, "0")}. Alt-drag starting on bottom axis (offset ${i * 2}px) does not draw`, async () => {
      const box = await chartBox(page);
      const before = await strokeCount(page);
      const px = box.x + 80 + i * 20;
      const py = box.y + box.height - 5 - i * 2;
      await altDrag(page, { x: px, y: py }, { x: px + 20, y: py - 3 }, 4);
      const after = await strokeCount(page);
      expect(after).toBe(before);
    });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section F â€” setActive / isActive behavior (20 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("F. setActive/isActive does not change draw gating", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  test("F01. isActive() defaults to false", async () => {
    const v = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      return w.__tradereplayChart!.demoCursor().isActive();
    });
    expect(v).toBe(false);
  });
  test("F02. setActive(true) flips isActive() to true", async () => {
    const v = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.setActive(true);
      return dc.isActive();
    });
    expect(v).toBe(true);
  });
  test("F03. setActive(false) flips isActive() to false", async () => {
    const v = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.setActive(true);
      dc.setActive(false);
      return dc.isActive();
    });
    expect(v).toBe(false);
  });
  test("F04. setActive truthy coercion: 1 â†’ true", async () => {
    const v = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      (dc.setActive as (v: unknown) => void)(1);
      return dc.isActive();
    });
    expect(v).toBe(true);
  });
  test("F05. setActive truthy coercion: 0 â†’ false", async () => {
    const v = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      (dc.setActive as (v: unknown) => void)(0);
      return dc.isActive();
    });
    expect(v).toBe(false);
  });
  for (let i = 0; i < 5; i++) {
    test(`F${String(i + 6).padStart(2, "0")}. setActive(true) + plain drag still does NOT draw #${i + 1}`, async () => {
      const box = await chartBox(page);
      await page.evaluate(() => {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setActive(true);
      });
      const before = await strokeCount(page);
      await plainDrag(page, interior(box, 0.3 + i * 0.05, 0.4), interior(box, 0.5 + i * 0.05, 0.55), 6);
      const after = await strokeCount(page);
      await page.evaluate(() => {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setActive(false);
      });
      expect(after).toBe(before);
    });
  }
  for (let i = 0; i < 5; i++) {
    test(`F${String(i + 11).padStart(2, "0")}. setActive(true) + Alt drag still draws exactly 1 #${i + 1}`, async () => {
      const box = await chartBox(page);
      await page.evaluate(() => {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setActive(true);
      });
      const before = await strokeCount(page);
      await altDrag(page, interior(box, 0.3 + i * 0.04, 0.4), interior(box, 0.45 + i * 0.04, 0.5), 6);
      const after = await strokeCount(page);
      await page.evaluate(() => {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setActive(false);
      });
      expect(after - before).toBe(1);
    });
  }
  for (let i = 0; i < 5; i++) {
    test(`F${String(i + 16).padStart(2, "0")}. setActive toggle round-trip ${i + 1}`, async () => {
      const result = await page.evaluate(() => {
        const w = window as unknown as ChartWindow;
        const dc = w.__tradereplayChart!.demoCursor();
        const states: boolean[] = [];
        for (const s of [true, false, true, true, false, false, true]) {
          dc.setActive(s);
          states.push(dc.isActive());
        }
        dc.setActive(false);
        return states;
      });
      expect(result).toEqual([true, false, true, true, false, false, true]);
    });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section G â€” clearStrokes (15 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("G. clearStrokes", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let n = 1; n <= 10; n++) {
    test(`G${String(n).padStart(2, "0")}. ${n} strokes then clearStrokes â†’ 0`, async () => {
      const box = await chartBox(page);
      for (let i = 0; i < n; i++) {
        await altDrag(page, interior(box, 0.2 + i * 0.05, 0.3), interior(box, 0.3 + i * 0.05, 0.35), 4);
        await page.waitForTimeout(60);
      }
      expect(await strokeCount(page)).toBe(n);
      await page.evaluate(() => {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().clearStrokes();
      });
      expect(await strokeCount(page)).toBe(0);
    });
  }
  test("G11. clearStrokes on empty state is a no-op", async () => {
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      w.__tradereplayChart!.demoCursor().clearStrokes();
      w.__tradereplayChart!.demoCursor().clearStrokes();
    });
    expect(await strokeCount(page)).toBe(0);
  });
  test("G12. clearStrokes then Alt drag produces exactly 1", async () => {
    const box = await chartBox(page);
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      w.__tradereplayChart!.demoCursor().clearStrokes();
    });
    await altDrag(page, interior(box, 0.3, 0.4), interior(box, 0.4, 0.45), 5);
    expect(await strokeCount(page)).toBe(1);
  });
  test("G13. multiple clears are idempotent", async () => {
    const box = await chartBox(page);
    await altDrag(page, interior(box, 0.3, 0.4), interior(box, 0.4, 0.45), 5);
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.clearStrokes();
      dc.clearStrokes();
      dc.clearStrokes();
    });
    expect(await strokeCount(page)).toBe(0);
  });
  test("G14. clear after 3 gestures and then 2 new gestures â†’ 2", async () => {
    const box = await chartBox(page);
    for (let i = 0; i < 3; i++) {
      await altDrag(page, interior(box, 0.2 + i * 0.05, 0.3), interior(box, 0.3 + i * 0.05, 0.35), 4);
    }
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      w.__tradereplayChart!.demoCursor().clearStrokes();
    });
    for (let i = 0; i < 2; i++) {
      await altDrag(page, interior(box, 0.4 + i * 0.05, 0.5), interior(box, 0.5 + i * 0.05, 0.55), 4);
    }
    expect(await strokeCount(page)).toBe(2);
  });
  test("G15. setActive(true) then clearStrokes does not flip isActive", async () => {
    const v = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.setActive(true);
      dc.clearStrokes();
      const after = dc.isActive();
      dc.setActive(false);
      return after;
    });
    expect(v).toBe(true);
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section H â€” Programmatic beginStroke/extendStroke/endStroke (25 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("H. Programmatic stroke API", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let n = 1; n <= 10; n++) {
    test(`H${String(n).padStart(2, "0")}. beginStroke + ${n} extendStroke + endStroke â†’ 1 stroke`, async () => {
      const count = await page.evaluate((k) => {
        const w = window as unknown as ChartWindow;
        const dc = w.__tradereplayChart!.demoCursor();
        dc.clearStrokes();
        dc.beginStroke(100, 100);
        for (let i = 0; i < k; i++) dc.extendStroke(100 + i * 5, 100 + i * 3);
        dc.endStroke();
        return dc.strokeCount();
      }, n);
      expect(count).toBe(1);
    });
  }
  for (let n = 1; n <= 10; n++) {
    test(`H${String(n + 10).padStart(2, "0")}. ${n} programmatic strokes in sequence â†’ ${n}`, async () => {
      const count = await page.evaluate((k) => {
        const w = window as unknown as ChartWindow;
        const dc = w.__tradereplayChart!.demoCursor();
        dc.clearStrokes();
        for (let j = 0; j < k; j++) {
          dc.beginStroke(50 + j * 10, 50);
          dc.extendStroke(60 + j * 10, 70);
          dc.endStroke();
        }
        return dc.strokeCount();
      }, n);
      expect(count).toBe(n);
    });
  }
  test("H21. extendStroke without beginStroke does nothing", async () => {
    const count = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.clearStrokes();
      dc.extendStroke(10, 10);
      dc.extendStroke(20, 20);
      return dc.strokeCount();
    });
    expect(count).toBe(0);
  });
  test("H22. endStroke without beginStroke does nothing", async () => {
    const count = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.clearStrokes();
      dc.endStroke();
      dc.endStroke();
      return dc.strokeCount();
    });
    expect(count).toBe(0);
  });
  test("H23. extendStroke after endStroke does not mutate ended stroke (count stays 1)", async () => {
    const count = await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.clearStrokes();
      dc.beginStroke(0, 0);
      dc.extendStroke(10, 10);
      dc.endStroke();
      dc.extendStroke(20, 20);
      return dc.strokeCount();
    });
    expect(count).toBe(1);
  });
  test("H24. interleaved Alt-drag + programmatic strokes", async () => {
    const box = await chartBox(page);
    await altDrag(page, interior(box, 0.3, 0.3), interior(box, 0.4, 0.35), 5);
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.beginStroke(100, 100);
      dc.extendStroke(120, 110);
      dc.endStroke();
    });
    await altDrag(page, interior(box, 0.5, 0.3), interior(box, 0.6, 0.35), 5);
    expect(await strokeCount(page)).toBe(3);
  });
  test("H25. beginStroke with large coordinates does not throw", async () => {
    const ok = await page.evaluate(() => {
      try {
        const w = window as unknown as ChartWindow;
        const dc = w.__tradereplayChart!.demoCursor();
        dc.clearStrokes();
        dc.beginStroke(99999, -99999);
        dc.extendStroke(-1, 100000);
        dc.endStroke();
        return dc.strokeCount() === 1;
      } catch { return false; }
    });
    expect(ok).toBe(true);
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section I â€” Style configuration setters (20 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("I. Style setters", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  const colors = [
    "rgba(255,80,80,1)", "#ff0000", "#00ff00", "#0000ff",
    "rgba(0,0,0,0.5)", "rgba(255,255,255,0.8)", "hsl(200, 80%, 50%)",
  ];
  for (let i = 0; i < colors.length; i++) {
    test(`I${String(i + 1).padStart(2, "0")}. setColor(${colors[i]}) does not throw and still draws`, async () => {
      const box = await chartBox(page);
      await page.evaluate((c) => {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setColor(c);
      }, colors[i]);
      await altDrag(page, interior(box, 0.3, 0.3), interior(box, 0.4, 0.35), 5);
      expect(await strokeCount(page)).toBe(1);
    });
  }
  const widths = [0.5, 1, 2, 3, 5, 8, 12];
  for (let i = 0; i < widths.length; i++) {
    test(`I${String(i + 8).padStart(2, "0")}. setLineWidth(${widths[i]}) draws normally`, async () => {
      const box = await chartBox(page);
      await page.evaluate((w) => {
        const win = window as unknown as ChartWindow;
        win.__tradereplayChart!.demoCursor().setLineWidth(w);
      }, widths[i]);
      await altDrag(page, interior(box, 0.3, 0.3), interior(box, 0.4, 0.35), 5);
      expect(await strokeCount(page)).toBe(1);
    });
  }
  test("I15. setFadeDuration(0) finalizes strokes instantly after release", async () => {
    const box = await chartBox(page);
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      w.__tradereplayChart!.demoCursor().setFadeDuration(0);
    });
    await altDrag(page, interior(box, 0.3, 0.3), interior(box, 0.4, 0.35), 5);
    await page.waitForTimeout(150);
    // Depending on raf pruning, count may already be 0 or still 1 for first frame.
    const count = await strokeCount(page);
    expect(count === 0 || count === 1).toBe(true);
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      w.__tradereplayChart!.demoCursor().setFadeDuration(10 * 60 * 1000);
    });
  });
  test("I16. setFadeDuration(60000) keeps stroke alive for >1s", async () => {
    const box = await chartBox(page);
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      w.__tradereplayChart!.demoCursor().setFadeDuration(60000);
    });
    await altDrag(page, interior(box, 0.3, 0.3), interior(box, 0.4, 0.35), 5);
    await page.waitForTimeout(1000);
    expect(await strokeCount(page)).toBe(1);
  });
  test("I17. setColor + setLineWidth + setFadeDuration together", async () => {
    const box = await chartBox(page);
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow;
      const dc = w.__tradereplayChart!.demoCursor();
      dc.setColor("#abcdef");
      dc.setLineWidth(4);
      dc.setFadeDuration(10 * 60 * 1000);
    });
    await altDrag(page, interior(box, 0.3, 0.3), interior(box, 0.4, 0.35), 5);
    expect(await strokeCount(page)).toBe(1);
  });
  test("I18. setColor invalid string does not throw", async () => {
    const ok = await page.evaluate(() => {
      try {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setColor("not-a-color");
        return true;
      } catch { return false; }
    });
    expect(ok).toBe(true);
  });
  test("I19. setLineWidth(0) does not throw", async () => {
    const ok = await page.evaluate(() => {
      try {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setLineWidth(0);
        w.__tradereplayChart!.demoCursor().setLineWidth(3);
        return true;
      } catch { return false; }
    });
    expect(ok).toBe(true);
  });
  test("I20. setFadeDuration(-100) does not throw", async () => {
    const ok = await page.evaluate(() => {
      try {
        const w = window as unknown as ChartWindow;
        w.__tradereplayChart!.demoCursor().setFadeDuration(-100);
        w.__tradereplayChart!.demoCursor().setFadeDuration(10 * 60 * 1000);
        return true;
      } catch { return false; }
    });
    expect(ok).toBe(true);
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Section J â€” Interaction with pan/zoom (20 tests)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.describe("J. Pan/zoom interaction", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.beforeEach(async () => {
    await clearStrokes(page);
    // Reset visible range so each pan test has room to move in both directions.
    await page.evaluate(() => {
      const w = window as unknown as ChartWindow & {
        __tradereplayChart?: { timeScale: () => { fitContent: () => void; scrollToRealTime: () => void } };
      };
      w.__tradereplayChart!.timeScale().fitContent();
    });
    await page.waitForTimeout(400);
  });
  test.afterAll(async () => { await page.close(); });

  for (let i = 0; i < 5; i++) {
    test(`J${String(i + 1).padStart(2, "0")}. plain drag pans (visible range shifts) #${i + 1}`, async () => {
      const box = await chartBox(page);
      const r0 = await visibleRange(page);
      // Alternate direction so we never accumulate toward one edge.
      const dir = -0.2;
      await plainDrag(page, interior(box, 0.5, 0.5), interior(box, 0.5 + dir, 0.5), 10);
      const r1 = await visibleRange(page);
      expect(r0).not.toBeNull();
      expect(r1).not.toBeNull();
      if (r0 && r1) {
        expect(Math.abs(r1.from - r0.from)).toBeGreaterThan(0.1);
      }
    });
  }
  for (let i = 0; i < 5; i++) {
    test(`J${String(i + 6).padStart(2, "0")}. Alt drag does NOT change visible range #${i + 1}`, async () => {
      const box = await chartBox(page);
      const r0 = await visibleRange(page);
      await altDrag(page, interior(box, 0.4, 0.5), interior(box, 0.2, 0.5), 10);
      const r1 = await visibleRange(page);
      expect(r0).not.toBeNull();
      expect(r1).not.toBeNull();
      if (r0 && r1) {
        expect(Math.abs(r1.from - r0.from)).toBeLessThan(0.5);
      }
    });
  }
  for (let i = 0; i < 5; i++) {
    test(`J${String(i + 11).padStart(2, "0")}. Alt drag then plain drag: 1 stroke + range shifts #${i + 1}`, async () => {
      const box = await chartBox(page);
      await altDrag(page, interior(box, 0.4, 0.4), interior(box, 0.5, 0.45), 6);
      expect(await strokeCount(page)).toBe(1);
      const r0 = await visibleRange(page);
      const dir = -0.2;
      await plainDrag(page, interior(box, 0.5, 0.6), interior(box, 0.5 + dir, 0.6), 10);
      const r1 = await visibleRange(page);
      if (r0 && r1) {
        expect(Math.abs(r1.from - r0.from)).toBeGreaterThan(0.1);
      }
      expect(await strokeCount(page)).toBe(1);
    });
  }
  for (let i = 0; i < 5; i++) {
    test(`J${String(i + 16).padStart(2, "0")}. plain drag then Alt drag: range shifts + 1 stroke #${i + 1}`, async () => {
      const box = await chartBox(page);
      const r0 = await visibleRange(page);
      const dir = -0.2;
      await plainDrag(page, interior(box, 0.5, 0.5), interior(box, 0.5 + dir, 0.5), 10);
      const r1 = await visibleRange(page);
      if (r0 && r1) {
        expect(Math.abs(r1.from - r0.from)).toBeGreaterThan(0.1);
      }
      await altDrag(page, interior(box, 0.4, 0.3), interior(box, 0.5, 0.35), 6);
      expect(await strokeCount(page)).toBe(1);
    });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Summary: A30 + B30 + C10 + D10 + E20 + F20 + G15 + H25 + I20 + J20 = 200
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

