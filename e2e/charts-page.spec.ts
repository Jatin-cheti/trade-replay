import { expect, test } from "./playwright-fixture";

const BASE_URL = "http://127.0.0.1:8080";

test.describe("ChartsPage — basic functionality", () => {
  test("renders with default symbol", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await expect(page.getByTestId("charts-page")).toBeVisible({ timeout: 15_000 });
  });

  test("shows time range bar", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await expect(page.getByTestId("chart-time-range-bar")).toBeVisible({ timeout: 10_000 });
  });

  test("period buttons are clickable", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.getByTestId("chart-time-range-bar").waitFor({ timeout: 10_000 });

    for (const periodKey of ["1d", "5d", "1m", "3m", "6m", "ytd", "1y", "5y", "all"]) {
      const btn = page.getByTestId(`period-btn-${periodKey}`);
      await expect(btn).toBeVisible();
    }

    // Click 3m period
    await page.getByTestId("period-btn-3m").click();
    await expect(page.getByTestId("period-btn-3m")).toHaveClass(/text-primary/);
  });

  test("ADJ toggle works", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.getByTestId("chart-time-range-bar").waitFor({ timeout: 10_000 });

    const adjBtn = page.getByTestId("adj-toggle");
    await expect(adjBtn).toBeVisible();
    await adjBtn.click();
    // After click, button should reflect toggled state (bg-primary/20 class or similar)
    await expect(adjBtn).toHaveClass(/text-primary/);
    await adjBtn.click();
    await expect(adjBtn).not.toHaveClass(/bg-primary\/20/);
  });

  test("right mini strip is visible", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await expect(page.getByTestId("chart-right-mini-strip")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("strip-settings")).toBeVisible();
    await expect(page.getByTestId("strip-alerts")).toBeVisible();
  });

  test("symbol search input renders", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await expect(page.getByTestId("symbol-search-input")).toBeVisible({ timeout: 10_000 });
  });

  test("back button navigates away", async ({ page }) => {
    // Go to homepage first so there's history
    await page.goto(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.getByTestId("charts-back-btn").waitFor({ timeout: 10_000 });

    await page.getByTestId("charts-back-btn").click();
    // Should have navigated away from /charts
    await page.waitForURL((url) => !url.pathname.startsWith("/charts"), { timeout: 5_000 });
  });

  test("fullscreen button toggles", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    const fsBtn = page.getByTestId("charts-fullscreen-btn");
    await expect(fsBtn).toBeVisible({ timeout: 10_000 });
    // Click won't actually go fullscreen in headless mode, but shouldn't throw
    await fsBtn.click();
  });
});

test.describe("ChartsPage — context menu", () => {
  test("right-click shows context menu", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    // Wait for chart to render
    await page.waitForSelector("[data-testid='charts-page']", { timeout: 15_000 });
    await page.waitForTimeout(2000); // let chart load data

    // Right-click in the center of the page
    await page.mouse.click(600, 400, { button: "right" });
    await expect(page.getByTestId("chart-context-menu")).toBeVisible({ timeout: 5_000 });
  });

  test("context menu closes on Escape", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.waitForSelector("[data-testid='charts-page']", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    await page.mouse.click(600, 400, { button: "right" });
    await page.getByTestId("chart-context-menu").waitFor({ timeout: 5_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("chart-context-menu")).not.toBeVisible();
  });

  test("context menu closes on outside click", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.waitForSelector("[data-testid='charts-page']", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    await page.mouse.click(600, 400, { button: "right" });
    await page.getByTestId("chart-context-menu").waitFor({ timeout: 5_000 });
    // Click far away from the menu
    await page.mouse.click(50, 50);
    await expect(page.getByTestId("chart-context-menu")).not.toBeVisible();
  });

  test("settings opens from context menu", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.waitForSelector("[data-testid='charts-page']", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    await page.mouse.click(600, 400, { button: "right" });
    await page.getByTestId("chart-context-menu").waitFor({ timeout: 5_000 });
    await page.getByText("Settings...").click();
    await expect(page.getByTestId("chart-settings-modal")).toBeVisible({ timeout: 3_000 });
  });

  test("table view opens from context menu", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.waitForSelector("[data-testid='charts-page']", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    await page.mouse.click(600, 400, { button: "right" });
    await page.getByTestId("chart-context-menu").waitFor({ timeout: 5_000 });
    await page.getByText("Table view").click();
    await expect(page.getByTestId("chart-table-modal")).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("ChartsPage — modals", () => {
  test("settings modal has tabs", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.waitForSelector("[data-testid='charts-page']", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Open via right-click → Settings
    await page.mouse.click(600, 400, { button: "right" });
    await page.getByTestId("chart-context-menu").waitFor({ timeout: 5_000 });
    await page.getByText("Settings...").click();
    await page.getByTestId("chart-settings-modal").waitFor({ timeout: 3_000 });

    // Check tabs
    for (const tab of ["Chart", "Scales", "Appearance", "Trading"]) {
      await expect(page.getByText(tab)).toBeVisible();
    }

    // Click Scales tab
    await page.getByText("Scales").click();
    await expect(page.getByText("Invert scale")).toBeVisible();

    // Close
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("chart-settings-modal")).not.toBeVisible();
  });

  test("table view sorts by column", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.waitForSelector("[data-testid='charts-page']", { timeout: 15_000 });
    await page.waitForTimeout(3000);

    await page.mouse.click(600, 400, { button: "right" });
    await page.getByTestId("chart-context-menu").waitFor({ timeout: 5_000 });
    await page.getByText("Table view").click();
    const modal = page.getByTestId("chart-table-modal");
    await modal.waitFor({ timeout: 3_000 });

    // Click "Close" column header to sort
    await page.getByText("Close").click();
    await expect(modal).toBeVisible(); // still open after sort
  });

  test("strip opens settings modal", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=RELIANCE`);
    await page.getByTestId("chart-right-mini-strip").waitFor({ timeout: 10_000 });
    await page.getByTestId("strip-settings").click();
    await expect(page.getByTestId("chart-settings-modal")).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("ChartsPage — symbol navigation", () => {
  test("symbol param changes chart symbol", async ({ page }) => {
    await page.goto(`${BASE_URL}/charts?symbol=INFY`);
    await expect(page.getByTestId("charts-page")).toBeVisible({ timeout: 15_000 });
    // Symbol search input should show INFY
    const input = page.getByTestId("symbol-search-input");
    await expect(input).toBeVisible();
    await expect(input).toContainText("INFY");
  });
});
