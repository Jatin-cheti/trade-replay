/**
 * Phase C — Text labels on 2-anchor line tools (TV parity).
 *
 * Verifies that clicking the floating toolbar's "T+" (add text) button:
 *   • Opens the ChartPromptModal.
 *   • Text-capable drawings (infoLine, trendAngle) edit their OWN `text`.
 *   • Non-text-capable drawings (trend, ray, extendedLine) create a separate
 *     `anchoredText` drawing at the line midpoint.
 *   • Cancel dismisses modal without creating drawings.
 *   • The created/edited text is visible in __chartDebug.getDrawings().
 *
 * 5 tools × 5 scenarios = 25 tests. Runs against prod.
 */
import { expect, type Page } from "@playwright/test";
import { test } from "./playwright-fixture";

const BASE = process.env.E2E_TARGET_URL ?? "https://tradereplay.me";

type Drawing = {
  id: string;
  variant: string;
  text?: string;
  anchors: Array<{ time: number; price: number }>;
};

type LineCase = {
  variant: string;
  testId: string;
  // Whether the drawing itself supports text (edits own text) or not (creates separate anchoredText)
  supportsText: boolean;
};

const CASES: LineCase[] = [
  { variant: "trend", testId: "tool-trendline", supportsText: false },
  { variant: "ray", testId: "tool-ray", supportsText: false },
  { variant: "infoLine", testId: "tool-info-line", supportsText: true },
  { variant: "extendedLine", testId: "tool-extended-line", supportsText: false },
  { variant: "trendAngle", testId: "tool-trend-angle", supportsText: true },
];

async function gotoCharts(page: Page) {
  await page.goto(`${BASE}/charts?symbol=RELIANCE`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 30_000 });
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => Boolean((window as any).__chartDebug?.getDrawings),
    null,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(500);
}

async function surfaceBox(page: Page) {
  const box = await page.getByTestId("chart-interaction-surface").boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function pickTool(page: Page, testId: string) {
  await page.getByTestId("toolrail-button-lines").click({ force: true });
  await page.waitForTimeout(150);
  await page.getByTestId(testId).click({ force: true });
  await page.waitForTimeout(100);
}

async function clickAt(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(50);
}

async function drawLine(page: Page, testId: string): Promise<string> {
  await pickTool(page, testId);
  const box = await surfaceBox(page);
  const plotW = box.width - 70;
  const x1 = box.x + plotW * 0.30;
  const y1 = box.y + box.height * 0.50;
  const x2 = box.x + plotW * 0.70;
  const y2 = box.y + box.height * 0.35;
  await clickAt(page, x1, y1);
  await clickAt(page, x2, y2);
  await page.waitForTimeout(150);
  const id = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getLatestDrawingId?.() ?? null;
  });
  if (!id) throw new Error("no drawing id after draw");
  return id as string;
}

async function selectDrawing(page: Page, id: string) {
  await page.evaluate((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__chartDebug?.forceSelectDrawing?.(d);
  }, id);
  await page.waitForTimeout(150);
}

async function getDrawings(page: Page): Promise<Drawing[]> {
  return (await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__chartDebug?.getDrawings?.() ?? [];
  })) as Drawing[];
}

for (const c of CASES) {
  test.describe(`Line text labels — ${c.variant}`, () => {
    test("add-text button opens prompt modal", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      await expect(page.getByTestId("floating-drawing-toolbar")).toBeVisible();
      await page.getByTestId("floating-toolbar-add-text").click();
      await expect(page.getByTestId("chart-prompt-modal")).toBeVisible();
      await expect(page.getByTestId("chart-prompt-input")).toBeVisible();
    });

    test("cancel prompt does not create or modify drawings", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      const before = await getDrawings(page);
      await selectDrawing(page, id);
      await page.getByTestId("floating-toolbar-add-text").click();
      await expect(page.getByTestId("chart-prompt-modal")).toBeVisible();
      await page.getByTestId("chart-prompt-cancel-btn").click();
      await expect(page.getByTestId("chart-prompt-modal")).toHaveCount(0);
      const after = await getDrawings(page);
      expect(after.length).toBe(before.length);
      const found = after.find((d) => d.id === id);
      expect(found?.text ?? "").toBe("");
    });

    test("submit text with OK button", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      const before = await getDrawings(page);
      await selectDrawing(page, id);
      await page.getByTestId("floating-toolbar-add-text").click();
      await expect(page.getByTestId("chart-prompt-modal")).toBeVisible();
      const input = page.getByTestId("chart-prompt-input");
      await input.fill("HELLO_TV_PARITY");
      await page.getByTestId("chart-prompt-ok").click();
      await expect(page.getByTestId("chart-prompt-modal")).toHaveCount(0);
      await page.waitForTimeout(200);
      const after = await getDrawings(page);
      if (c.supportsText) {
        // Drawing's own text should be updated.
        expect(after.length).toBe(before.length);
        const found = after.find((d) => d.id === id);
        expect(found?.text).toBe("HELLO_TV_PARITY");
      } else {
        // A separate anchoredText drawing was created.
        expect(after.length).toBe(before.length + 1);
        const textDrawings = after.filter((d) => d.variant === "anchoredText");
        expect(textDrawings.length).toBeGreaterThanOrEqual(1);
        const newest = textDrawings[textDrawings.length - 1];
        expect(newest.text).toBe("HELLO_TV_PARITY");
      }
    });

    test("submit text with Enter key", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      await selectDrawing(page, id);
      await page.getByTestId("floating-toolbar-add-text").click();
      await expect(page.getByTestId("chart-prompt-modal")).toBeVisible();
      const input = page.getByTestId("chart-prompt-input");
      await input.fill("ENTER_SUBMIT");
      await input.press("Enter");
      await expect(page.getByTestId("chart-prompt-modal")).toHaveCount(0);
      await page.waitForTimeout(200);
      const after = await getDrawings(page);
      const hasText =
        after.some((d) => d.id === id && d.text === "ENTER_SUBMIT") ||
        after.some((d) => d.variant === "anchoredText" && d.text === "ENTER_SUBMIT");
      expect(hasText).toBe(true);
    });

    test("Escape key dismisses prompt without saving", async ({ page }) => {
      await gotoCharts(page);
      const id = await drawLine(page, c.testId);
      const before = await getDrawings(page);
      await selectDrawing(page, id);
      await page.getByTestId("floating-toolbar-add-text").click();
      await expect(page.getByTestId("chart-prompt-modal")).toBeVisible();
      const input = page.getByTestId("chart-prompt-input");
      await input.fill("SHOULD_NOT_SAVE");
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("chart-prompt-modal")).toHaveCount(0);
      await page.waitForTimeout(150);
      const after = await getDrawings(page);
      expect(after.length).toBe(before.length);
      const text = after.find((d) => d.id === id)?.text ?? "";
      expect(text).not.toBe("SHOULD_NOT_SAVE");
    });
  });
}
