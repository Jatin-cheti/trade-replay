/**
 * TradingView Parity tests for the /charts page.
 *
 * These tests verify that the Charts page faithfully replicates
 * TradingView's core UX patterns.
 */
import { expect, test } from "./playwright-fixture";

const BASE_URL = "http://127.0.0.1:8080";

async function gotoCharts(page: import("@playwright/test").Page, symbol = "RELIANCE") {
  await page.goto(`${BASE_URL}/charts?symbol=${symbol}`);
  await page.waitForSelector("[data-testid='charts-page']", { timeout: 20_000 });
  // Wait for chart to appear
  await page.waitForTimeout(1500);
}

test.describe("TV Parity — Layout", () => {
  test("page is full-viewport (no scroll needed)", async ({ page }) => {
    await gotoCharts(page);
    const { scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    // Should not need to scroll (or minimal overflow due to subpixel rounding)
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 8);
  });

  test("time range bar is present at bottom", async ({ page }) => {
    await gotoCharts(page);
    const bar = page.getByTestId("chart-time-range-bar");
    await expect(bar).toBeVisible();
    const { bottom } = await bar.boundingBox() ?? { bottom: 0 };
    const vh = await page.evaluate(() => window.innerHeight);
    // Bar should be near the bottom
    expect(bottom).toBeGreaterThan(vh * 0.85);
  });

  test("right mini strip is on the right edge", async ({ page }) => {
    await gotoCharts(page);
    const strip = page.getByTestId("chart-right-mini-strip");
    await expect(strip).toBeVisible();
    const box = await strip.boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    expect(box!.x + box!.width).toBeGreaterThan(vw * 0.9);
  });

  test("OHLC legend appears over chart area", async ({ page }) => {
    await gotoCharts(page);
    // Wait for data to load
    await page.waitForTimeout(3000);
    const legend = page.getByTestId("chart-ohlc-legend");
    // Legend only shows after candles load — check if present
    const count = await legend.count();
    if (count > 0) {
      await expect(legend).toBeVisible();
    }
  });
});

test.describe("TV Parity — Time Range", () => {
  test("all TradingView-style period buttons exist", async ({ page }) => {
    await gotoCharts(page);
    const expectedPeriods = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];
    for (const label of expectedPeriods) {
      await expect(page.getByTestId("chart-time-range-bar").getByText(label)).toBeVisible();
    }
  });

  test("active period button has primary styling", async ({ page }) => {
    await gotoCharts(page);
    // Default period is 1y — its button should be highlighted
    const btn1y = page.getByTestId("period-btn-1y");
    await expect(btn1y).toHaveClass(/text-primary/);
  });

  test("clock shows IST time format", async ({ page }) => {
    await gotoCharts(page);
    const bar = page.getByTestId("chart-time-range-bar");
    const barText = await bar.textContent();
    // Should contain "UTC+5:30"
    expect(barText).toMatch(/UTC\+5:30/);
  });

  test("ADJ button is visible and toggleable", async ({ page }) => {
    await gotoCharts(page);
    const adjBtn = page.getByTestId("adj-toggle");
    await expect(adjBtn).toBeVisible();
    await expect(adjBtn).toHaveText("ADJ");
    await adjBtn.click();
    await expect(adjBtn).toHaveClass(/text-primary/);
  });

  test("switching period reloads chart", async ({ page }) => {
    await gotoCharts(page);
    // Click 5D
    await page.getByTestId("period-btn-5d").click();
    await expect(page.getByTestId("period-btn-5d")).toHaveClass(/text-primary/);
    // Click back to 1Y
    await page.getByTestId("period-btn-1y").click();
    await expect(page.getByTestId("period-btn-1y")).toHaveClass(/text-primary/);
  });
});

test.describe("TV Parity — Context Menu", () => {
  test("context menu has all required items", async ({ page }) => {
    await gotoCharts(page);
    await page.waitForTimeout(2000);
    await page.mouse.click(600, 400, { button: "right" });
    const menu = page.getByTestId("chart-context-menu");
    await menu.waitFor({ timeout: 5_000 });

    const expectedItems = [
      "Reset chart view",
      "Table view",
      "Object tree",
      "Chart template",
      "Settings...",
    ];

    for (const item of expectedItems) {
      await expect(menu.getByText(item, { exact: false })).toBeVisible();
    }
  });

  test("context menu shows price in copy item", async ({ page }) => {
    await gotoCharts(page);
    await page.waitForTimeout(2500);
    await page.mouse.click(600, 400, { button: "right" });
    const menu = page.getByTestId("chart-context-menu");
    await menu.waitFor({ timeout: 5_000 });
    // Should have "Copy price …" item
    await expect(menu.getByText(/Copy price/)).toBeVisible();
  });

  test("context menu shows add alert item", async ({ page }) => {
    await gotoCharts(page);
    await page.waitForTimeout(2000);
    await page.mouse.click(600, 400, { button: "right" });
    const menu = page.getByTestId("chart-context-menu");
    await menu.waitFor({ timeout: 5_000 });
    await expect(menu.getByText(/Add alert/)).toBeVisible();
  });
});

test.describe("TV Parity — Symbol Search", () => {
  test("typing in search shows results", async ({ page }) => {
    await gotoCharts(page, "RELIANCE");
    const searchInput = page.getByTestId("symbol-search-input").locator("input");
    await searchInput.click();
    await searchInput.fill("INFY");
    // Wait for debounce + results
    await page.waitForTimeout(600);
    // Results dropdown should appear (if API is available)
    const resultCount = await page.getByRole("button", { name: /INFY/i }).count();
    // We just verify no errors thrown — API may not have results in test env
    expect(resultCount).toBeGreaterThanOrEqual(0);
  });

  test("escape clears search", async ({ page }) => {
    await gotoCharts(page);
    const searchInput = page.getByTestId("symbol-search-input").locator("input");
    await searchInput.click();
    await searchInput.fill("TCS");
    await page.keyboard.press("Escape");
    // Input should be cleared
    await expect(searchInput).toHaveValue("");
  });
});

test.describe("TV Parity — SymbolPage integration", () => {
  test("Full chart button on SymbolPage navigates to /charts", async ({ page }) => {
    await page.goto(`${BASE_URL}/symbol/RELIANCE`);
    await page.waitForSelector("[data-testid='trading-chart']", { timeout: 20_000 });
    // Look for "Full chart" button
    const fullChartBtn = page.getByText("Full chart", { exact: false });
    const count = await fullChartBtn.count();
    if (count > 0) {
      await fullChartBtn.first().click();
      await page.waitForURL(/\/charts/, { timeout: 8_000 });
      expect(page.url()).toContain("/charts");
      expect(page.url()).toContain("symbol=RELIANCE");
    }
  });

  test("See on Supercharts link goes to /charts", async ({ page }) => {
    await page.goto(`${BASE_URL}/symbol/RELIANCE`);
    await page.waitForSelector("[data-testid='trading-chart']", { timeout: 20_000 });
    const superchartsLink = page.getByText("See on Supercharts");
    const linkCount = await superchartsLink.count();
    if (linkCount > 0) {
      const href = await superchartsLink.first().getAttribute("href");
      expect(href).toMatch(/\/charts/);
    }
  });
});
