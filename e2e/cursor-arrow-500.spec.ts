/**
 * Arrow cursor — 500 TradingView browser differentiation tests.
 * TV reference: default pointer/arrow cursor (standard OS arrow, no custom SVG).
 *
 * A (001-100) mode set/get round-trips
 * B (001-100) overlay CSS cursor matches /default|auto/
 * C (001-100) plain drag → 0 strokes  (pan only)
 * D (001-100) alt-drag  → 1 stroke    (demo stroke extension)
 * E (001-100) compound / integration  (N strokes, clearStrokes, mode-switches, range)
 *
 * Run:
 *   npx playwright test e2e/cursor-arrow-500.spec.ts \
 *     --project=chromium --config=e2e/playwright.local-preview.config.ts
 */
import { expect, test, type Page } from "@playwright/test";

const BASE =
  process.env.E2E_USE_EXTERNAL_STACK === "true"
    ? "https://tradereplay.me"
    : "http://127.0.0.1:8080";

type CursorMode = "cross" | "dot" | "arrow" | "demo" | "eraser";

type CW = {
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
    timeScale: () => {
      getVisibleLogicalRange: () => { from: number; to: number } | null;
    };
  };
  __tradereplaySetCursorMode?: (m: CursorMode) => void;
  __tradereplayGetCursorMode?: () => CursorMode;
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function gotoChart(page: Page): Promise<void> {
  await page.goto(`${BASE}/charts?symbol=RELIANCE`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('[data-testid="chart-container"]', {
    timeout: 90_000,
  });
  await page.waitForFunction(
    () => {
      const w = window as unknown as CW;
      return (
        !!w.__tradereplayChart &&
        typeof w.__tradereplayChart.demoCursor === "function" &&
        typeof w.__tradereplaySetCursorMode === "function" &&
        typeof w.__tradereplayGetCursorMode === "function"
      );
    },
    { timeout: 60_000 }
  );
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    (window as unknown as CW).__tradereplayChart!
      .demoCursor()
      .setFadeDuration(10 * 60 * 1000);
  });
}

async function chartBox(page: Page) {
  const b = await page
    .locator('[data-testid="chart-container"]')
    .boundingBox();
  if (!b) throw new Error("chart-container not found");
  return b;
}

function ib(
  box: { x: number; y: number; width: number; height: number },
  fx: number,
  fy: number
) {
  const ml = 20, mr = 90, mt = 40, mb = 50;
  return {
    x: box.x + ml + (box.width - ml - mr) * Math.max(0, Math.min(1, fx)),
    y: box.y + mt + (box.height - mt - mb) * Math.max(0, Math.min(1, fy)),
  };
}

async function setMode(page: Page, m: CursorMode) {
  await page.evaluate(
    (mode) => (window as unknown as CW).__tradereplaySetCursorMode!(mode),
    m
  );
  await page.waitForFunction(
    (expected) => (window as unknown as CW).__tradereplayGetCursorMode!() === expected,
    m,
    { timeout: 5000 }
  );
}

async function getMode(page: Page): Promise<CursorMode> {
  return page.evaluate(
    () => (window as unknown as CW).__tradereplayGetCursorMode!()
  );
}

async function sc(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as CW).__tradereplayChart!.demoCursor().strokeCount()
  );
}

async function clr(page: Page): Promise<void> {
  await page.evaluate(() => {
    const dc = (window as unknown as CW).__tradereplayChart!.demoCursor();
    dc.clearStrokes();
    dc.setFadeDuration(10 * 60 * 1000);
  });
}

async function altDrag(
  page: Page,
  a: { x: number; y: number },
  b: { x: number; y: number },
  steps = 6
) {
  await page.keyboard.down("Alt");
  try {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps });
    await page.mouse.up();
  } finally {
    await page.keyboard.up("Alt");
  }
}

async function plainDrag(
  page: Page,
  a: { x: number; y: number },
  b: { x: number; y: number },
  steps = 8
) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
}

async function overlayCursor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const c = document.querySelector(
      'canvas[aria-label="chart-drawing-overlay"]'
    ) as HTMLCanvasElement | null;
    return c ? getComputedStyle(c).cursor : "";
  });
}

async function vr(
  page: Page
): Promise<{ from: number; to: number } | null> {
  return page.evaluate(
    () =>
      (window as unknown as CW).__tradereplayChart
        ?.timeScale()
        .getVisibleLogicalRange() ?? null
  );
}

// ── suite ─────────────────────────────────────────────────────────────────────

const MODE: CursorMode = "arrow";
const CSS_RE = /default|auto/;
const OTHER: CursorMode[] = ["cross", "dot", "demo", "eraser"];

test.describe(`[${MODE}] cursor — 500 TradingView parity tests`, () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    page = await browser.newPage();
    await gotoChart(page);
  });

  test.beforeEach(async () => {
    await setMode(page, MODE);
    await clr(page);
    await page.evaluate(() => {
      const ts = (window as any).__tradereplayChart?.timeScale();
      ts?.scrollToPosition?.(0, true); // instant scroll to right edge, no animation
    });
    await page.waitForTimeout(80);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── A: mode set/get round-trips (100) ────────────────────────────────────
  for (let i = 0; i < 100; i++) {
    const label = `A${String(i + 1).padStart(3, "0")}`;
    test(`${label}. [${MODE}] set/get round-trip #${i + 1}`, async () => {
      await setMode(page, MODE);
      expect(await getMode(page)).toBe(MODE);
    });
  }

  // ── B: overlay CSS cursor matches default|auto (100 positions) ────────────
  for (let i = 0; i < 100; i++) {
    const fx = 0.05 + (i % 10) * 0.09;
    const fy = 0.05 + Math.floor(i / 10) * 0.09;
    const label = `B${String(i + 1).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] cursor CSS at (${fx.toFixed(2)},${fy.toFixed(2)}) is default/auto`,
      async () => {
        const box = await chartBox(page);
        const p = ib(box, fx, fy);
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(40);
        expect(await overlayCursor(page)).toMatch(CSS_RE);
      }
    );
  }

  // ── C: plain drag → 0 strokes (100 drag vectors) ─────────────────────────
  for (let i = 0; i < 100; i++) {
    const fx = 0.08 + (i % 8) * 0.09;
    const fy = 0.18 + Math.floor(i / 8) * 0.07;
    const dirs = [
      [0.14, 0],
      [-0.1, 0],
      [0, 0.08],
      [0, -0.06],
      [0.1, 0.06],
      [-0.08, -0.05],
      [0.12, -0.04],
      [-0.06, 0.07],
    ];
    const [dx, dy] = dirs[i % dirs.length];
    const label = `C${String(i + 1).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] plain drag (Δfx=${dx},Δfy=${dy}) → 0 strokes #${i + 1}`,
      async () => {
        const box = await chartBox(page);
        await plainDrag(
          page,
          ib(box, fx, fy),
          ib(
            box,
            Math.min(0.92, Math.max(0.04, fx + dx)),
            Math.min(0.92, Math.max(0.04, fy + dy))
          ),
          7
        );
        expect(await sc(page)).toBe(0);
      }
    );
  }

  // ── D: alt-drag → exactly 1 stroke (100 positions) ───────────────────────
  for (let i = 0; i < 100; i++) {
    const fx = 0.08 + (i % 8) * 0.1;
    const fy = 0.08 + Math.floor(i / 8) * 0.09;
    const label = `D${String(i + 1).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] alt-drag from (${fx.toFixed(2)},${fy.toFixed(2)}) → 1 stroke`,
      async () => {
        const box = await chartBox(page);
        await altDrag(
          page,
          ib(box, fx, fy),
          ib(box, Math.min(0.88, fx + 0.09), Math.min(0.88, fy + 0.05)),
          5
        );
        expect(await sc(page)).toBe(1);
      }
    );
  }

  // ── E: compound / integration (100) ──────────────────────────────────────

  // E001-E020 : N consecutive alt-drags → N strokes
  for (let i = 0; i < 20; i++) {
    const n = (i % 5) + 1;
    const v = Math.floor(i / 5) + 1;
    const label = `E${String(i + 1).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] ${n} alt-drags → ${n} strokes (variant ${v})`,
      async () => {
        const box = await chartBox(page);
        for (let j = 0; j < n; j++) {
          await altDrag(
            page,
            ib(box, 0.10 + j * 0.12, 0.40),
            ib(box, 0.17 + j * 0.12, 0.46),
            5
          );
        }
        expect(await sc(page)).toBe(n);
      }
    );
  }

  // E021-E040 : clearStrokes after drawing → count = 0
  for (let i = 0; i < 20; i++) {
    const label = `E${String(i + 21).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] clearStrokes after drawing → 0 (variant ${i + 1})`,
      async () => {
        const box = await chartBox(page);
        await altDrag(
          page,
          ib(box, 0.22, 0.32 + i * 0.01),
          ib(box, 0.30, 0.38 + i * 0.01),
          5
        );
        expect(await sc(page)).toBeGreaterThan(0);
        await clr(page);
        expect(await sc(page)).toBe(0);
      }
    );
  }

  // E041-E060 : switch to another mode and back restores MODE
  for (let i = 0; i < 20; i++) {
    const other = OTHER[i % OTHER.length];
    const label = `E${String(i + 41).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] switch→"${other}"→"${MODE}" restores mode`,
      async () => {
        await setMode(page, other);
        expect(await getMode(page)).toBe(other);
        await setMode(page, MODE);
        expect(await getMode(page)).toBe(MODE);
      }
    );
  }

  // E061-E080 : alt-drag does NOT shift visible range
  for (let i = 0; i < 20; i++) {
    const label = `E${String(i + 61).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] alt-drag does not shift visible range #${i + 1}`,
      async () => {
        const r0 = await vr(page);
        const box = await chartBox(page);
        await altDrag(
          page,
          ib(box, 0.38 + (i % 5) * 0.06, 0.50),
          ib(box, 0.20 + (i % 5) * 0.04, 0.50),
          8
        );
        const r1 = await vr(page);
        if (r0 && r1) {
          expect(Math.abs(r1.from - r0.from)).toBeLessThan(2.5);
        }
      }
    );
  }

  // E081-E100 : plain drag DOES shift visible range
  for (let i = 0; i < 20; i++) {
    const label = `E${String(i + 81).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] plain drag shifts visible range #${i + 1}`,
      async () => {
        const r0 = await vr(page);
        const box = await chartBox(page);
        await plainDrag(
          page,
          ib(box, 0.55 + (i % 3) * 0.05, 0.50),
          ib(box, 0.25 + (i % 3) * 0.05, 0.50),
          10
        );
        const r1 = await vr(page);
        if (r0 && r1) {
          expect(Math.abs(r1.from - r0.from)).toBeGreaterThan(0.02);
        }
      }
    );
  }
});
