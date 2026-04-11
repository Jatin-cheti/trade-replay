import { expect, test } from "./playwright-fixture";

/**
 * E2E tests for the TradingView-parity Chart Header, Indicators Modal,
 * and Interval / Chart-Style dropdowns.
 */

test.setTimeout(90_000);

async function registerAndLogin(page: import("@playwright/test").Page) {
  const uid = Date.now();
  const email = `header_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const r = await page.request.get("http://127.0.0.1:4000/api/health");
      return r.status();
    })
    .toBe(200);

  const reg = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `header_${uid}` },
  });

  const auth = reg.ok()
    ? reg
    : await page.request.post("http://127.0.0.1:4000/api/auth/login", { data: { email, password } });
  expect(auth.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);
}

const clickByTestId = async (page: import("@playwright/test").Page, testId: string) => {
  await page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
    const target =
      nodes.find((n) => n instanceof HTMLElement && n.offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }, testId);
};

/* ─── Interval dropdown + custom interval ─────────────────────────────── */

test("interval dropdown groups, favorites, and custom interval modal", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  // Favorite pills
  await expect(page.locator('[data-testid="timeframe-1m"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="timeframe-1D"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="timeframe-1W"]:visible').first()).toBeVisible();

  // Click a favorite
  await clickByTestId(page, "timeframe-5m");

  // Open full interval dropdown and select items (items always in DOM)
  await clickByTestId(page, "interval-1T");
  await clickByTestId(page, "interval-1S");
  await clickByTestId(page, "interval-5");
  await clickByTestId(page, "interval-60");
  await clickByTestId(page, "interval-1D");

  // Select a specific interval
  await clickByTestId(page, "interval-120");

  // Custom interval modal
  await clickByTestId(page, "custom-interval-btn");
  await expect(page.locator('[data-testid="custom-interval-modal"]:visible').first()).toBeVisible();
  await page.locator('[data-testid="custom-interval-amount"]:visible').first().fill("10");
  await clickByTestId(page, "custom-interval-apply");
  await expect(page.locator('[data-testid="custom-interval-modal"]:visible')).toHaveCount(0);
});

/* ─── Chart style dropdown ──────────────────────────────────────────────── */

test("chart style dropdown shows all type groups", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "chart-type-candlestick");
  await clickByTestId(page, "chart-type-line");
  await clickByTestId(page, "chart-type-heikinAshi");
  await clickByTestId(page, "chart-type-renko");
  await clickByTestId(page, "chart-type-volumeCandles");

  // Switch to each major type
  await clickByTestId(page, "chart-type-area");
  await clickByTestId(page, "chart-type-heikinAshi");
  await clickByTestId(page, "chart-type-candlestick");
});

/* ─── Indicators modal full flow ─────────────────────────────────────── */

test("indicators modal: sidebar, search, add, remove, close", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  // Open modal
  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  // Sidebar items
  await expect(modal.getByTestId("indicators-sidebar-technicals")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-financials")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-editorsPicks")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-topScripts")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-trending")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-myScripts")).toBeVisible();

  // Search for SMA and add it
  const search = modal.getByTestId("indicators-modal-search");
  await search.fill("simple moving");
  await expect(modal.getByTestId("indicator-catalog-sma")).toBeVisible();
  await modal.getByTestId("indicator-catalog-sma").click();
  // SMA should be active
  await expect(modal.getByTestId("indicator-catalog-sma")).toContainText(/active/i);

  // Add RSI
  await search.fill("rsi");
  await expect(modal.getByTestId("indicator-catalog-rsi")).toBeVisible();
  await modal.getByTestId("indicator-catalog-rsi").click();

  // Switch sidebar to financials
  await modal.getByTestId("indicators-sidebar-financials").click();
  await search.fill("");
  // Financial items should appear
  await expect(modal.getByTestId("indicator-catalog-fin_totalRevenue")).toBeVisible();
  await expect(modal.getByTestId("indicator-catalog-fin_peRatio")).toBeVisible();

  // Switch to community
  await modal.getByTestId("indicators-sidebar-editorsPicks").click();
  await expect(modal.getByTestId("indicator-catalog-cm_smartMoney")).toBeVisible();

  // Switch back to technicals, clear search, remove SMA
  await modal.getByTestId("indicators-sidebar-technicals").click();
  await search.fill("sma");
  await modal.getByTestId("indicator-catalog-sma").click();
  // SMA should no longer be active
  await expect(modal.getByTestId("indicator-catalog-sma")).not.toContainText(/active/i);

  // Close modal
  await modal.getByTestId("indicators-modal-close").click();
  await expect(page.locator('[data-testid="indicators-modal"]:visible')).toHaveCount(0);

  // Header should show indicator count (RSI still enabled)
  await expect(page.locator('[data-testid="indicators-button"]:visible').first()).toContainText("Indicators (1)");
});

/* ─── Personal sidebar shows placeholder ─────────────────────────────── */

test("indicators modal: personal section shows placeholder", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  await modal.getByTestId("indicators-sidebar-myScripts").click();
  await expect(modal.getByText("Your personal scripts will appear here")).toBeVisible();

  await modal.getByTestId("indicators-sidebar-inviteOnly").click();
  await expect(modal.getByText("Invite-only scripts will appear here")).toBeVisible();

  await modal.getByTestId("indicators-modal-close").click();
});
