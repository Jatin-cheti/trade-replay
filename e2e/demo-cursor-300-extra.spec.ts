/**
 * Demo Cursor — 300 additional TradingView parity tests.
 * Builds on demo-cursor-200-parity.spec.ts; focuses on density, edges,
 * rapid-fire cycles, style combinatorics, and kinematic variations.
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
    getDimensions: () => { width: number; height: number; priceAxisWidth: number; timeAxisHeight: number };
  };
};

async function gotoChart(page: Page): Promise<void> {
  await page.goto(`${BASE}/charts?symbol=RELIANCE`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="chart-container"]', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const w = window as unknown as ChartWindow;
    return !!w.__tradereplayChart && typeof w.__tradereplayChart.demoCursor === "function";
  }, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const w = window as unknown as ChartWindow;
    w.__tradereplayChart!.demoCursor().setFadeDuration(10 * 60 * 1000);
  });
}

async function chartBox(page: Page) {
  const b = await page.locator('[data-testid="chart-container"]').boundingBox();
  if (!b) throw new Error("no chart box");
  return b;
}
async function strokeCount(page: Page) {
  return page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart?.demoCursor().strokeCount() ?? -1);
}
async function clearStrokes(page: Page) {
  await page.evaluate(() => {
    const dc = (window as unknown as ChartWindow).__tradereplayChart?.demoCursor();
    dc?.clearStrokes();
    dc?.setFadeDuration(10 * 60 * 1000);
    dc?.setActive(false);
    dc?.setColor("rgba(255,80,80,1)");
    dc?.setLineWidth(3);
  });
}
async function altDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  await page.keyboard.down("Alt");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
  await page.keyboard.up("Alt");
}
async function plainDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}
function interior(box: { x: number; y: number; width: number; height: number }, fx: number, fy: number) {
  const ml = 20, mr = 80, mt = 40, mb = 40;
  return { x: box.x + ml + (box.width - ml - mr) * fx, y: box.y + mt + (box.height - mt - mb) * fy };
}

// ───────────────────────────────────────────────────────────────────────────
// K. 50 Alt-drag positions (grid)
// ───────────────────────────────────────────────────────────────────────────
test.describe("K. Alt-drag position grid", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let i = 0; i < 50; i++) {
    const fx = 0.1 + (i % 10) * 0.08;
    const fy = 0.1 + Math.floor(i / 10) * 0.15;
    test(`K${String(i + 1).padStart(2, "0")}. alt-drag at (${fx.toFixed(2)}, ${fy.toFixed(2)}) → 1 stroke`, async () => {
      const box = await chartBox(page);
      await altDrag(page, interior(box, fx, fy), interior(box, fx + 0.08, fy + 0.05), 6);
      expect(await strokeCount(page)).toBe(1);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// L. 50 Alt-drag step-count variations (kinematics)
// ───────────────────────────────────────────────────────────────────────────
test.describe("L. Alt-drag step-count", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 24, 28, 32, 36, 40, 44, 48, 52,
                 56, 60, 66, 72, 80, 88, 96, 104, 112, 120, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
                 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  for (let i = 0; i < 50; i++) {
    const s = steps[i];
    test(`L${String(i + 1).padStart(2, "0")}. alt-drag steps=${s} → 1 stroke`, async () => {
      const box = await chartBox(page);
      await altDrag(page, interior(box, 0.3, 0.4), interior(box, 0.6, 0.55), s);
      expect(await strokeCount(page)).toBe(1);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// M. 30 rapid successive strokes — count must be exact
// ───────────────────────────────────────────────────────────────────────────
test.describe("M. Rapid successive strokes", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let n = 1; n <= 30; n++) {
    test(`M${String(n).padStart(2, "0")}. ${n} alt-drags → ${n} strokes`, async () => {
      const box = await chartBox(page);
      for (let i = 0; i < n; i++) {
        const fx = 0.2 + (i % 5) * 0.1;
        const fy = 0.2 + Math.floor(i / 5) * 0.1;
        await altDrag(page, interior(box, fx, fy), interior(box, fx + 0.05, fy + 0.05), 4);
      }
      expect(await strokeCount(page)).toBe(n);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// N. 30 color variations — each still produces 1 stroke
// ───────────────────────────────────────────────────────────────────────────
test.describe("N. Color variations", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  const colors = [
    "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000",
    "#888888", "#333333", "rgba(255,0,0,0.5)", "rgba(0,255,0,0.3)", "rgba(0,0,255,0.8)",
    "rgba(255,255,255,0.2)", "rgba(0,0,0,0.6)", "hsl(0,100%,50%)", "hsl(120,100%,50%)",
    "hsl(240,100%,50%)", "hsl(60,100%,50%)", "hsl(300,80%,40%)", "tomato", "navy", "orange",
    "purple", "gold", "teal", "coral", "crimson", "lime", "pink",
  ];
  for (let i = 0; i < 30; i++) {
    const c = colors[i];
    test(`N${String(i + 1).padStart(2, "0")}. setColor(${c}) then alt-drag → 1 stroke`, async () => {
      const box = await chartBox(page);
      await page.evaluate((color) => {
        (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setColor(color);
      }, c);
      await altDrag(page, interior(box, 0.3, 0.4), interior(box, 0.55, 0.5), 5);
      expect(await strokeCount(page)).toBe(1);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// O. 30 lineWidth variations
// ───────────────────────────────────────────────────────────────────────────
test.describe("O. lineWidth variations", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  const widths = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5,
                  6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40];
  for (let i = 0; i < 30; i++) {
    const w = widths[i];
    test(`O${String(i + 1).padStart(2, "0")}. setLineWidth(${w}) → 1 stroke`, async () => {
      const box = await chartBox(page);
      await page.evaluate((width) => {
        (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setLineWidth(width);
      }, w);
      await altDrag(page, interior(box, 0.3, 0.4), interior(box, 0.5, 0.5), 5);
      expect(await strokeCount(page)).toBe(1);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// P. 30 fade-duration variations
// ───────────────────────────────────────────────────────────────────────────
test.describe("P. fadeDuration variations", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  // Large values so stroke survives until we check count.
  const durations = [60_000, 90_000, 120_000, 150_000, 180_000, 210_000, 240_000, 270_000,
                     300_000, 360_000, 420_000, 480_000, 540_000, 600_000, 660_000, 720_000,
                     780_000, 840_000, 900_000, 960_000, 1_020_000, 1_080_000, 1_140_000,
                     1_200_000, 1_260_000, 1_320_000, 1_380_000, 1_440_000, 1_500_000, 1_560_000];
  for (let i = 0; i < 30; i++) {
    const d = durations[i];
    test(`P${String(i + 1).padStart(2, "0")}. setFadeDuration(${d}) → 1 stroke`, async () => {
      const box = await chartBox(page);
      await page.evaluate((dur) => {
        (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().setFadeDuration(dur);
      }, d);
      await altDrag(page, interior(box, 0.3, 0.4), interior(box, 0.5, 0.5), 5);
      expect(await strokeCount(page)).toBe(1);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Q. 30 clear+draw+clear cycles
// ───────────────────────────────────────────────────────────────────────────
test.describe("Q. Clear cycles", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let i = 0; i < 30; i++) {
    const n = (i % 5) + 1;
    test(`Q${String(i + 1).padStart(2, "0")}. draw ${n} strokes → clear → count=0`, async () => {
      const box = await chartBox(page);
      for (let k = 0; k < n; k++) {
        await altDrag(page, interior(box, 0.3 + k * 0.05, 0.4), interior(box, 0.4 + k * 0.05, 0.5), 4);
      }
      expect(await strokeCount(page)).toBe(n);
      await page.evaluate(() => (window as unknown as ChartWindow).__tradereplayChart!.demoCursor().clearStrokes());
      expect(await strokeCount(page)).toBe(0);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// R. 25 axis-exclusion edge cases — Alt in forbidden strips → 0 strokes
// ───────────────────────────────────────────────────────────────────────────
test.describe("R. Axis-exclusion edges", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  // R01-R15: time-axis strip (bottom). canvasH=479, timeAxis=28; y offsets in [456, 478]
  const timeOffsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 22, 26];
  for (let i = 0; i < 15; i++) {
    const dy = timeOffsets[i];
    test(`R${String(i + 1).padStart(2, "0")}. alt-drag inside time-axis (bottom - ${dy}px) → 0`, async () => {
      const box = await chartBox(page);
      const x = box.x + 120;
      const y = box.y + box.height - dy;
      await altDrag(page, { x, y }, { x: x + 40, y: y - 2 }, 4);
      expect(await strokeCount(page)).toBe(0);
    });
  }
  // R16-R25: price-axis strip (right). priceAxis=68; x offsets in [box.width-60, box.width-2]
  const priceOffsets = [1, 3, 5, 8, 12, 18, 24, 36, 48, 60];
  for (let i = 0; i < 10; i++) {
    const dx = priceOffsets[i];
    test(`R${String(i + 16).padStart(2, "0")}. alt-drag inside price-axis (right - ${dx}px) → 0`, async () => {
      const box = await chartBox(page);
      const x = box.x + box.width - dx;
      const y = box.y + box.height * 0.5;
      await altDrag(page, { x, y }, { x: x + 2, y: y + 20 }, 4);
      expect(await strokeCount(page)).toBe(0);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// S. 25 keyboard-only — Alt down/up without mouse drag → 0 strokes
// ───────────────────────────────────────────────────────────────────────────
test.describe("S. Alt keyboard without drag", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let i = 0; i < 25; i++) {
    test(`S${String(i + 1).padStart(2, "0")}. Alt down/up ${i + 1}x (no drag) → 0`, async () => {
      for (let k = 0; k <= (i % 5); k++) {
        await page.keyboard.down("Alt");
        await page.keyboard.up("Alt");
      }
      expect(await strokeCount(page)).toBe(0);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// T. 30 alt-click-without-drag → 1 stroke (single point)
// ───────────────────────────────────────────────────────────────────────────
test.describe("T. Alt click without drag", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); await gotoChart(page); });
  test.beforeEach(async () => { await clearStrokes(page); });
  test.afterAll(async () => { await page.close(); });

  for (let i = 0; i < 30; i++) {
    const fx = 0.15 + (i % 6) * 0.12;
    const fy = 0.15 + Math.floor(i / 6) * 0.14;
    test(`T${String(i + 1).padStart(2, "0")}. alt-click at (${fx.toFixed(2)},${fy.toFixed(2)}) → 1`, async () => {
      const box = await chartBox(page);
      const p = interior(box, fx, fy);
      await page.keyboard.down("Alt");
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.up();
      await page.keyboard.up("Alt");
      expect(await strokeCount(page)).toBe(1);
    });
  }
});

// Summary: K50 + L50 + M30 + N30 + O30 + P30 + Q30 + R25 + S25 + T30 = 310
// (≥300 as requested; 10-test buffer)
