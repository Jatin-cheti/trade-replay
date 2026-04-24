/**
 * Demo Cursor TradingView-Parity Playwright Spec
 *
 * Runs against production (E2E_USE_EXTERNAL_STACK=true) or local dev.
 * Verifies the brush/demonstration tool matches TradingView's contract:
 *
 *   1. Plain click+drag (no Alt)        → chart pans, NO stroke is drawn
 *   2. Alt+click+drag                   → stroke IS drawn (count goes up)
 *   3. Alt release mid-drag             → stroke is finalized (no new strokes after move)
 *   4. Multiple Alt drags               → strokeCount grows by exactly 1 per gesture
 *   5. setActive(true) + plain click    → still NO stroke (active is cosmetic)
 *   6. setActive(true) + Alt drag       → stroke drawn
 *   7. Alt+click on price-axis (right)  → NO stroke (outside chart area)
 *
 * These cover the user-reported bug ("our drawing works without pressing ALT")
 * and the follow-up correction ("Alt must be pressed and held").
 */
import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_USE_EXTERNAL_STACK === "true"
  ? "https://tradereplay.me"
  : "http://127.0.0.1:8080";

async function gotoChart(page: Page, symbol = "RELIANCE") {
  await page.goto(`${BASE}/charts?symbol=${symbol}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="charts-page"]', { timeout: 30_000 });
  await page.waitForSelector('[data-testid="chart-container"]', { timeout: 30_000 });
  // Wait until the test-hook chart is registered and has a demoCursor API.
  await page.waitForFunction(() => {
    const w = window as unknown as { __tradereplayChart?: { demoCursor?: () => unknown } };
    return !!w.__tradereplayChart && typeof w.__tradereplayChart.demoCursor === "function";
  }, { timeout: 20_000 });
  // Allow candles to load so the chart is interactable
  await page.waitForTimeout(2000);
}

async function strokeCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __tradereplayChart?: { demoCursor?: () => { strokeCount: () => number } };
    };
    return w.__tradereplayChart?.demoCursor?.().strokeCount() ?? -1;
  });
}

async function clearStrokes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __tradereplayChart?: { demoCursor?: () => { clearStrokes: () => void } };
    };
    w.__tradereplayChart?.demoCursor?.().clearStrokes();
  });
}

async function visibleRangeFrom(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __tradereplayChart?: {
        timeScale: () => { getVisibleLogicalRange: () => { from: number; to: number } | null };
      };
    };
    const r = w.__tradereplayChart?.timeScale().getVisibleLogicalRange();
    return r ? Math.round(r.from * 1000) / 1000 : null;
  });
}

async function chartBox(page: Page) {
  const locator = page.locator('[data-testid="chart-container"]');
  const box = await locator.boundingBox();
  if (!box) throw new Error("chart-container has no bounding box");
  return box;
}

async function plainDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

async function altDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  await page.keyboard.down("Alt");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
  await page.keyboard.up("Alt");
}

test.describe("Demo Cursor — TradingView parity on prod", () => {
  test.beforeEach(async ({ page }) => {
    await gotoChart(page);
    await clearStrokes(page);
  });

  test("1. Plain click+drag does NOT draw a stroke (pans instead)", async ({ page }) => {
    const box = await chartBox(page);
    const rangeBefore = await visibleRangeFrom(page);
    const before = await strokeCount(page);
    await plainDrag(
      page,
      { x: box.x + box.width * 0.4, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.2, y: box.y + box.height * 0.5 },
      15,
    );
    const after = await strokeCount(page);
    const rangeAfter = await visibleRangeFrom(page);
    expect(after, "plain drag must not add strokes").toBe(before);
    // Pan should have moved the visible range
    if (rangeBefore !== null && rangeAfter !== null) {
      expect(rangeAfter, "plain drag should have panned time range").not.toBe(rangeBefore);
    }
  });

  test("2. Alt+click+drag DOES draw exactly one stroke", async ({ page }) => {
    const box = await chartBox(page);
    const before = await strokeCount(page);
    await altDrag(
      page,
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.4 },
      { x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 },
      20,
    );
    const after = await strokeCount(page);
    expect(after - before).toBe(1);
  });

  test("3. Alt release mid-drag finalizes stroke (no new strokes from further moves)", async ({ page }) => {
    const box = await chartBox(page);
    const before = await strokeCount(page);
    const startX = box.x + box.width * 0.3;
    const startY = box.y + box.height * 0.5;
    await page.keyboard.down("Alt");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 20, { steps: 10 });
    // release alt mid-drag
    await page.keyboard.up("Alt");
    // continue moving — should not create or extend stroke further
    await page.mouse.move(startX + 150, startY + 60, { steps: 10 });
    await page.mouse.up();
    const after = await strokeCount(page);
    expect(after - before).toBe(1);
  });

  test("4. Three Alt gestures produce exactly three strokes", async ({ page }) => {
    const box = await chartBox(page);
    const before = await strokeCount(page);
    for (let i = 0; i < 3; i++) {
      const y = box.y + box.height * (0.3 + i * 0.15);
      await altDrag(
        page,
        { x: box.x + box.width * 0.25, y },
        { x: box.x + box.width * 0.5, y: y + 20 },
        10,
      );
    }
    const after = await strokeCount(page);
    expect(after - before).toBe(3);
  });

  test("5. setActive(true) alone does NOT enable plain-click drawing", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as {
        __tradereplayChart?: { demoCursor?: () => { setActive: (b: boolean) => void } };
      };
      w.__tradereplayChart?.demoCursor?.().setActive(true);
    });
    const box = await chartBox(page);
    const before = await strokeCount(page);
    await plainDrag(
      page,
      { x: box.x + box.width * 0.4, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.6, y: box.y + box.height * 0.5 },
      10,
    );
    const after = await strokeCount(page);
    expect(after, "setActive(true) must not grant plain-click draw").toBe(before);
  });

  test("6. setActive(true) + Alt+drag still draws", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as {
        __tradereplayChart?: { demoCursor?: () => { setActive: (b: boolean) => void } };
      };
      w.__tradereplayChart?.demoCursor?.().setActive(true);
    });
    const box = await chartBox(page);
    const before = await strokeCount(page);
    await altDrag(
      page,
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
      10,
    );
    const after = await strokeCount(page);
    expect(after - before).toBe(1);
  });

  test("7. Alt+click on the price axis (far-right) does NOT start a stroke", async ({ page }) => {
    const box = await chartBox(page);
    const before = await strokeCount(page);
    // Price scale lives in rightmost ~60px — go well inside it (5px from edge)
    await altDrag(
      page,
      { x: box.x + box.width - 5, y: box.y + box.height * 0.5 },
      { x: box.x + box.width - 5, y: box.y + box.height * 0.7 },
      5,
    );
    const after = await strokeCount(page);
    expect(after, "alt-drag on price-axis must not draw").toBe(before);
  });
});
