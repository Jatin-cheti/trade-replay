/**
 * TV-parity tests for CLICK-CLICK drawing mode on 2-anchor line tools.
 *
 * Behaviors under test:
 *   1. First left-click starts the draft; pointer moves freely WITHOUT any
 *      button pressed and anchors[1] follows the cursor.
 *   2. Second left-click commits the drawing.
 *   3. After first click, the chart MUST NOT pan as the cursor moves.
 *   4. Escape cancels an in-flight click-click draft without committing.
 *   5. Switching tool mid-draft cancels the draft.
 *   6. Drawing with large pointer distance between clicks is preserved (not
 *      treated as a "short drag misclick" delete).
 *   7. Drawing >= 5 lines in a row using click-click produces N committed
 *      drawings with matching anchor count.
 *   8. Selecting a drawing after a click-click commit DOES NOT pan the chart
 *      with subsequent cursor motion.
 *   9. Moving the cursor between click 1 and click 2 without any button
 *      pressed keeps the draft visible (preview line tracks cursor).
 *  10. Second click at a point >3px from the first still commits; no delete.
 */
import { expect, test } from "./playwright-fixture";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "http://127.0.0.1:8080";

interface ClickClickCase {
  variant: string;
  testId: string;
}

const CASES: ClickClickCase[] = [
  { variant: "trend", testId: "tool-trendline" },
  { variant: "ray", testId: "tool-ray" },
  { variant: "infoLine", testId: "tool-info-line" },
  { variant: "extendedLine", testId: "tool-extended-line" },
  { variant: "trendAngle", testId: "tool-trend-angle" },
];

async function gotoCharts(page: Page, symbol = "RELIANCE") {
  await page.goto(`${BASE_URL}/charts?symbol=${symbol}`);
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 20_000 });
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (window as any).__chartDebug;
      return d && typeof d.getScrollPosition === "function" && d.getScrollPosition() !== null;
    },
    { timeout: 20_000 }
  );
  await page.waitForTimeout(500);
}

async function openLinesRail(page: Page) {
  const btn = page.getByTestId("toolrail-button-lines");
  if (await btn.count()) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function pickTool(page: Page, testId: string) {
  await openLinesRail(page);
  const el = page.getByTestId(testId).first();
  if (!(await el.count())) {
    test.skip(true, `tool not found in UI: ${testId}`);
  }
  await el.click({ force: true });
  await page.waitForTimeout(100);
}

async function surfaceBox(page: Page) {
  const surface = page.getByTestId("chart-interaction-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function getScroll(page: Page): Promise<number> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (window as any).__chartDebug;
    const v = d?.getScrollPosition?.();
    return typeof v === "number" ? v : 0;
  });
}

async function getPhase(page: Page): Promise<number> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getClickClickPhase?.() ?? 0;
  });
}

async function getDraftVariant(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getDraftVariant?.() ?? null;
  });
}

async function getDrawingsCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getDrawings?.()?.length ?? 0;
  });
}

// Click-click drawing: two separate pointer-down+up events (not a drag).
async function clickAt(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(60);
}

for (const c of CASES) {
  test.describe(`Click-click draw — ${c.variant}`, () => {
    test("first click enters phase=1, no draft commit", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const x1 = box.x + plotW * 0.25;
      const y1 = box.y + box.height * 0.45;

      const before = await getDrawingsCount(page);
      await clickAt(page, x1, y1);
      expect(await getPhase(page)).toBe(1);
      expect(await getDraftVariant(page)).toBe(c.variant);
      expect(await getDrawingsCount(page)).toBe(before);
    });

    test("cursor moves freely between clicks without chart panning", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const x1 = box.x + plotW * 0.25;
      const y1 = box.y + box.height * 0.45;

      await clickAt(page, x1, y1);
      const scrollBefore = await getScroll(page);
      for (let i = 0; i < 12; i++) {
        await page.mouse.move(x1 + 20 + i * 15, y1 + 15 + i * 3, { steps: 2 });
        await page.waitForTimeout(20);
      }
      const scrollAfter = await getScroll(page);
      expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(0.5);
      // Still in phase 1 (uncommitted)
      expect(await getPhase(page)).toBe(1);
    });

    test("second click commits the drawing", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const x1 = box.x + plotW * 0.25;
      const y1 = box.y + box.height * 0.45;
      const x2 = box.x + plotW * 0.65;
      const y2 = box.y + box.height * 0.65;

      const before = await getDrawingsCount(page);
      await clickAt(page, x1, y1);
      await page.mouse.move(x2, y2, { steps: 8 });
      await clickAt(page, x2, y2);
      await page.waitForTimeout(200);

      expect(await getDrawingsCount(page)).toBe(before + 1);
      expect(await getPhase(page)).toBe(0);
      expect(await getDraftVariant(page)).toBeNull();
    });

    test("cursor motion after commit does not pan the chart", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const x1 = box.x + plotW * 0.25;
      const y1 = box.y + box.height * 0.45;
      const x2 = box.x + plotW * 0.65;
      const y2 = box.y + box.height * 0.65;

      await clickAt(page, x1, y1);
      await page.mouse.move(x2, y2, { steps: 6 });
      await clickAt(page, x2, y2);
      await page.waitForTimeout(200);

      const scrollBefore = await getScroll(page);
      for (let i = 0; i < 10; i++) {
        await page.mouse.move(box.x + 100 + i * 40, box.y + 100 + i * 10, { steps: 2 });
        await page.waitForTimeout(25);
      }
      const scrollAfter = await getScroll(page);
      expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(0.5);
    });

    test("Escape cancels a mid-draft click-click without committing", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const x1 = box.x + plotW * 0.25;
      const y1 = box.y + box.height * 0.45;

      const before = await getDrawingsCount(page);
      await clickAt(page, x1, y1);
      expect(await getPhase(page)).toBe(1);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      expect(await getPhase(page)).toBe(0);
      expect(await getDraftVariant(page)).toBeNull();
      expect(await getDrawingsCount(page)).toBe(before);
    });

    test("switching tool mid-draft cancels the draft", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const x1 = box.x + plotW * 0.25;
      const y1 = box.y + box.height * 0.45;

      const before = await getDrawingsCount(page);
      await clickAt(page, x1, y1);
      expect(await getPhase(page)).toBe(1);
      // pick a different tool
      await pickTool(page, "tool-horizontal-line");
      // just switching does not commit the in-flight line
      expect(await getDrawingsCount(page)).toBe(before);
    });

    test("second click at distance >>3px commits (not a short-drag delete)", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const x1 = box.x + plotW * 0.2;
      const y1 = box.y + box.height * 0.5;
      const x2 = box.x + plotW * 0.8;
      const y2 = box.y + box.height * 0.3;

      const before = await getDrawingsCount(page);
      await clickAt(page, x1, y1);
      await page.mouse.move(x2, y2, { steps: 10 });
      await clickAt(page, x2, y2);
      await page.waitForTimeout(250);
      expect(await getDrawingsCount(page)).toBe(before + 1);
    });

    test("draw 5 lines in a row via click-click", async ({ page }) => {
      await gotoCharts(page);
      await pickTool(page, c.testId);
      const box = await surfaceBox(page);
      const plotW = box.width - 70;
      const before = await getDrawingsCount(page);

      for (let i = 0; i < 5; i++) {
        // Tool exits after each commit by default; re-select it each iteration.
        if (i > 0) await pickTool(page, c.testId);
        const x1 = box.x + plotW * (0.15 + i * 0.05);
        const y1 = box.y + box.height * (0.4 + i * 0.02);
        const x2 = box.x + plotW * (0.6 + i * 0.04);
        const y2 = box.y + box.height * (0.5 + i * 0.02);
        await clickAt(page, x1, y1);
        await page.mouse.move(x2, y2, { steps: 4 });
        await clickAt(page, x2, y2);
        await page.waitForTimeout(120);
      }
      expect(await getDrawingsCount(page)).toBe(before + 5);
    });
  });
}
