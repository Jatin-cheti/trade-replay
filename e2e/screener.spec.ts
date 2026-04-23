import { expect, test } from "./playwright-fixture";

/**
 * Screener E2E test suite.
 *
 * Covers:
 *  1. Initial load — stocks table renders rows and shows a result count
 *  2. Quick-country toggle — India button filters to ~2 500 India results
 *  3. Global reset — Global button restores the full universe count
 *  4. Column sort — clicking a numeric header reverses sort direction indicator
 *  5. Row click → symbol page — first row navigates to /symbol/:sym
 *  6. Symbol page chart visible — the chart area is present on the symbol page
 *  7. Browser back — returns to screener with previous filter intact
 *  8. Symbol search hit — entering "RELIANCE" in the search box narrows rows
 *  9. Symbol search miss — entering a nonsense query yields 0 results gracefully
 * 10. ETF tab — switching to ETFs loads a non-empty table
 */

const SCREENER_URL = "/screener/stocks";

test.describe("Screener page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SCREENER_URL);
    // Wait for the result count to be populated (data loaded)
    await expect(page.getByTestId("screener-result-count")).toBeVisible({ timeout: 55_000 });
  });

  /* ── 1. Initial load ── */
  test("shows stock rows on initial load", async ({ page }) => {
    const rows = page.getByTestId("screener-row");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    // At least 10 rows visible in the virtual list
    await expect
      .poll(() => rows.count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(10);
    // Result count shows a positive number
    const countText = await page.getByTestId("screener-result-count").textContent();
    expect(Number(countText?.replace(/,/g, ""))).toBeGreaterThan(0);
  });

  /* ── 2. India quick-country filter ── */
  test("India quick-country toggle narrows results", async ({ page }) => {
    const countBefore = Number(
      (await page.getByTestId("screener-result-count").textContent())?.replace(/,/g, "") ?? "0",
    );
    expect(countBefore).toBeGreaterThan(5_000); // global stock universe

    await page.getByTestId("screener-country-IN").click();
    // Wait for count to change
    await expect
      .poll(
        async () =>
          Number((await page.getByTestId("screener-result-count").textContent())?.replace(/,/g, "") ?? "0"),
        { timeout: 15_000 },
      )
      .toBeLessThan(countBefore);

    const countAfter = Number(
      (await page.getByTestId("screener-result-count").textContent())?.replace(/,/g, "") ?? "0",
    );
    // India has roughly 2 000–5 000 stocks
    expect(countAfter).toBeGreaterThan(500);
    expect(countAfter).toBeLessThan(10_000);
  });

  /* ── 3. Global reset ── */
  test("Global quick-country restores full universe", async ({ page }) => {
    // First apply India filter
    await page.getByTestId("screener-country-IN").click();
    await expect
      .poll(async () => page.getByTestId("screener-result-count").textContent(), { timeout: 10_000 })
      .toMatch(/^\d/);

    const indiaCount = Number(
      (await page.getByTestId("screener-result-count").textContent())?.replace(/,/g, "") ?? "0",
    );

    // Reset to global
    await page.getByTestId("screener-country-global").click();
    await expect
      .poll(
        async () =>
          Number((await page.getByTestId("screener-result-count").textContent())?.replace(/,/g, "") ?? "0"),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(indiaCount);
  });

  /* ── 4. Column sort ── */
  test("clicking a column header changes sort indicator", async ({ page }) => {
    // Market Cap header button — look for it by title attribute
    const mktCapBtn = page.locator('button[title="Sort by Market Cap"]');
    await expect(mktCapBtn).toBeVisible({ timeout: 10_000 });

    // Market cap is the default sort (descending). First click toggles to ascending → TrendingUp
    await mktCapBtn.click();
    await expect(page.locator(".lucide-trending-up")).toBeVisible({ timeout: 5_000 });

    // Second click — toggles back to descending → TrendingDown
    await mktCapBtn.click();
    await expect(page.locator(".lucide-trending-down")).toBeVisible({ timeout: 5_000 });
  });

  /* ── 5. Row click → symbol page ── */
  test("clicking a row navigates to the symbol page", async ({ page }) => {
    const firstRow = page.getByTestId("screener-row").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    const symbolAttr = await firstRow.getAttribute("data-symbol");
    expect(symbolAttr).toBeTruthy();

    await firstRow.click();
    await expect(page).toHaveURL(/\/symbol\//i, { timeout: 10_000 });
  });

  /* ── 6. Symbol page chart visible ── */
  test("symbol page has a chart area", async ({ page }) => {
    const firstRow = page.getByTestId("screener-row").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/symbol\//i, { timeout: 10_000 });

    // The chart should be mounted — look for the chart canvas or chart container
    const chart = page
      .locator("canvas, [class*='chart'], [class*='Chart'], [data-testid*='chart']")
      .first();
    await expect(chart).toBeVisible({ timeout: 20_000 });
  });

  /* ── 7. Browser back returns to screener ── */
  test("browser back returns to screener after symbol navigation", async ({ page }) => {
    // Apply India filter first so we can verify URL param is preserved
    await page.getByTestId("screener-country-IN").click();
    await expect
      .poll(async () => page.url(), { timeout: 10_000 })
      .toContain("marketCountries");

    const firstRow = page.getByTestId("screener-row").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/symbol\//i, { timeout: 10_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/screener\/stocks/i, { timeout: 10_000 });
    // Filter should be re-applied via URL params
    expect(page.url()).toContain("marketCountries");
  });

  /* ── 8. Symbol search hit ── */
  test("search input filters rows to matching symbols", async ({ page }) => {
    const searchInput = page.getByTestId("screener-search-input");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill("RELIANCE");

    // Row count should drop and visible rows should relate to RELIANCE
    await expect
      .poll(
        async () => {
          const rows = page.getByTestId("screener-row");
          const count = await rows.count();
          if (count === 0) return 0;
          const sym = await rows.first().getAttribute("data-symbol");
          return sym?.toUpperCase().includes("RELIANCE") ? count : -1;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
  });

  /* ── 9. Symbol search miss ── */
  test("nonsense search query returns no rows gracefully", async ({ page }) => {
    const searchInput = page.getByTestId("screener-search-input");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill("XYZXYZXYZ_NO_MATCH_9999");

    await expect
      .poll(async () => page.getByTestId("screener-row").count(), { timeout: 15_000 })
      .toBe(0);

    // Page should not crash — heading / toolbar still present
    await expect(page.locator("text=Screener").first()).toBeVisible();
  });

  /* ── 10. ETF tab ── */
  test("switching to ETFs loads a non-empty table", async ({ page }) => {
    // Navigate to ETF screener via URL
    await page.goto("/screener/etfs");
    await expect(page.getByTestId("screener-result-count")).toBeVisible({ timeout: 35_000 });
    const count = Number(
      (await page.getByTestId("screener-result-count").textContent())?.replace(/,/g, "") ?? "0",
    );
    expect(count).toBeGreaterThan(0);

    const rows = page.getByTestId("screener-row");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  });
});
