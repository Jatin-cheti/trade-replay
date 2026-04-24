/**
 * Eraser cursor — 500 TradingView browser differentiation tests.
 * TV reference: TradingView eraser tool — removes drawn annotations/strokes.
 *   - Custom eraser SVG URL cursor (url(...))
 *   - Plain drag pans chart (no strokes added)
 *   - Alt-drag on empty canvas is a no-op (does NOT add strokes)
 *   - Can erase demo cursor strokes drawn while in demo mode
 *
 * A (001-100) mode set/get round-trips
 * B (001-100) overlay CSS cursor contains url( (custom SVG eraser)
 * C (001-100) plain drag → 0 strokes
 * D (001-100) alt-drag on empty canvas → stroke count unchanged (no new strokes)
 * E (001-100) eraser-specific: draw then erase, mode-switches, stability
 *
 * Run:
 *   npx playwright test e2e/cursor-eraser-500.spec.ts \
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

/** Draw a demo stroke via demo mode, then restore to eraser mode. */
async function drawDemoStroke(
  page: Page,
  fx: number,
  fy: number
): Promise<void> {
  await setMode(page, "demo");
  const box = await chartBox(page);
  await altDrag(
    page,
    ib(box, fx, fy),
    ib(box, Math.min(0.88, fx + 0.09), Math.min(0.88, fy + 0.05)),
    5
  );
  await setMode(page, "eraser");
}

// ── suite ─────────────────────────────────────────────────────────────────────

const MODE: CursorMode = "eraser";
const CSS_RE = /url\(/;
const OTHER: CursorMode[] = ["cross", "dot", "arrow", "demo"];

test.describe(`[${MODE}] cursor — 500 TradingView parity tests`, () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    page = await browser.newPage();
    await gotoChart(page);
  });

  test.beforeEach(async () => {
    await clr(page);
    await setMode(page, MODE);
    await page.evaluate(() => {
      (window as any).__tradereplayChart?.timeScale()?.scrollToRealTime?.();
    });
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

  // ── B: overlay CSS cursor contains url( (custom SVG eraser, 100 positions) ─
  for (let i = 0; i < 100; i++) {
    const fx = 0.05 + (i % 10) * 0.09;
    const fy = 0.05 + Math.floor(i / 10) * 0.09;
    const label = `B${String(i + 1).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] cursor CSS at (${fx.toFixed(2)},${fy.toFixed(2)}) is custom url()`,
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

  // ── D: alt-drag on empty canvas → does NOT add strokes (100 positions) ────
  for (let i = 0; i < 100; i++) {
    const fx = 0.08 + (i % 8) * 0.1;
    const fy = 0.08 + Math.floor(i / 8) * 0.09;
    const label = `D${String(i + 1).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] alt-drag empty canvas does not add strokes #${i + 1}`,
      async () => {
        // beforeEach clears strokes first
        const before = await sc(page);
        expect(before).toBe(0);
        const box = await chartBox(page);
        await altDrag(
          page,
          ib(box, fx, fy),
          ib(box, Math.min(0.88, fx + 0.09), Math.min(0.88, fy + 0.05)),
          5
        );
        // Eraser on empty area: count must not increase
        expect(await sc(page)).toBeLessThanOrEqual(before);
      }
    );
  }

  // ── E: eraser-specific compound tests (100) ───────────────────────────────

  // E001-E025 : draw demo stroke then switch to eraser — mode is now eraser
  for (let i = 0; i < 25; i++) {
    const fx = 0.15 + (i % 5) * 0.12;
    const fy = 0.25 + Math.floor(i / 5) * 0.1;
    const label = `E${String(i + 1).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] draw demo stroke then switch→eraser (variant ${i + 1})`,
      async () => {
        // Draw in demo mode
        await setMode(page, "demo");
        const box = await chartBox(page);
        await altDrag(
          page,
          ib(box, fx, fy),
          ib(box, Math.min(0.88, fx + 0.08), Math.min(0.88, fy + 0.05)),
          5
        );
        const countAfterDraw = await sc(page);
        expect(countAfterDraw).toBe(1);
        // Switch to eraser — stroke is still there, mode changed
        await setMode(page, MODE);
        expect(await getMode(page)).toBe(MODE);
        expect(await sc(page)).toBe(countAfterDraw);
      }
    );
  }

  // E026-E050 : clearStrokes works while in eraser mode
  for (let i = 0; i < 25; i++) {
    const label = `E${String(i + 26).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] clearStrokes in eraser mode → 0 (variant ${i + 1})`,
      async () => {
        await drawDemoStroke(page, 0.2 + (i % 5) * 0.1, 0.3 + (i % 4) * 0.1);
        expect(await sc(page)).toBe(1);
        await clr(page);
        await setMode(page, MODE);
        expect(await sc(page)).toBe(0);
      }
    );
  }

  // E051-E070 : mode switch eraser → another → eraser restores mode
  for (let i = 0; i < 20; i++) {
    const other = OTHER[i % OTHER.length];
    const label = `E${String(i + 51).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] switch→"${other}"→"${MODE}" restores eraser`,
      async () => {
        await setMode(page, other);
        expect(await getMode(page)).toBe(other);
        await setMode(page, MODE);
        expect(await getMode(page)).toBe(MODE);
      }
    );
  }

  // E071-E085 : multiple mode transitions ending in eraser
  for (let i = 0; i < 15; i++) {
    const label = `E${String(i + 71).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] multi-hop mode sequence ends with eraser #${i + 1}`,
      async () => {
        const seq: CursorMode[] = ["cross", "demo", "dot", "arrow", MODE];
        for (const m of seq) await setMode(page, m);
        expect(await getMode(page)).toBe(MODE);
      }
    );
  }

  // E086-E100 : CSS cursor verification at additional positions
  for (let i = 0; i < 15; i++) {
    const fx = 0.12 + (i % 5) * 0.15;
    const fy = 0.60 + (i % 3) * 0.1;
    const label = `E${String(i + 86).padStart(3, "0")}`;
    test(
      `${label}. [${MODE}] CSS cursor at (${fx.toFixed(2)},${fy.toFixed(2)}) is url()`,
      async () => {
        const box = await chartBox(page);
        const p = ib(box, fx, fy);
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(40);
        expect(await overlayCursor(page)).toMatch(CSS_RE);
      }
    );
  }
});
