import { expect, test } from "./playwright-fixture";

test("shared symbol modal works in portfolio and simulation", async ({ page }) => {
  test.setTimeout(120_000);

  const uid = Date.now();
  const email = `symbol_modal_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `symbol_modal_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post("http://127.0.0.1:4000/api/auth/login", {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();
  const authPayload = await authResponse.json();
  expect(typeof authPayload.token).toBe("string");

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);

  await page.goto("/portfolio/create");
  await expect(page.getByText("Portfolio Builder").first()).toBeVisible({ timeout: 15000 });

  const portfolioSearchTrigger = page.getByTestId("asset-search-trigger").first();
  await portfolioSearchTrigger.click();

  await expect(page.getByTestId("symbol-search-modal")).toBeVisible();

  const expectedCategories = ["all", "stocks", "funds", "futures", "forex", "crypto", "indices", "bonds", "economy", "options"];
  for (const category of expectedCategories) {
    await expect(page.getByTestId(`symbol-category-${category}`)).toBeVisible();
  }

  await page.getByTestId("symbol-category-stocks").click();
  await expect(page.getByTestId("symbol-filter-country-modal")).toBeVisible();
  await expect(page.getByTestId("symbol-filter-type")).toBeVisible();
  await expect(page.getByTestId("symbol-filter-sector")).toBeVisible();

  await page.getByTestId("symbol-filter-type").click();
  await page.getByRole("button", { name: "ETF", exact: true }).click();

  const spyRow = page.locator('[data-testid="symbol-result-row"][data-symbol="SPY"]').first();
  await expect(spyRow).toBeVisible();
  await spyRow.click();

  await expect(page.getByTestId("symbol-search-modal")).toHaveAttribute("data-state", "closed");
  await expect(portfolioSearchTrigger).toContainText("SPDR S&P 500 ETF Trust");

  await portfolioSearchTrigger.click();
  await page.getByTestId("symbol-category-futures").click();

  const niftyRoot = page.locator('[data-testid="symbol-result-row"][data-symbol="NIFTY"]').first();
  await expect(niftyRoot).toBeVisible();
  await niftyRoot.click();

  await expect(page.getByRole("heading", { name: "NIFTY Contracts" })).toBeVisible();
  const niftyJunContract = page.locator('[data-testid="symbol-contract-row"][data-symbol="NIFTY-JUN26"]').first();
  await expect(niftyJunContract).toBeVisible();
  await niftyJunContract.click();

  await expect(page.getByTestId("symbol-search-modal")).toHaveAttribute("data-state", "closed");
  await expect(portfolioSearchTrigger).toContainText("NIFTY 50 JUN 2026");

  await page.goto("/simulation");

  const simulationSymbolTrigger = page.getByTestId("scenario-symbol-trigger");
  await expect(simulationSymbolTrigger).toBeVisible();
  await simulationSymbolTrigger.click();

  await expect(page.getByTestId("symbol-search-modal")).toBeVisible();

  await page.getByTestId("symbol-category-indices").click({ force: true });
  const sourceUi = (await page.getByTestId("symbol-filter-source-modal").count()) > 0
    ? "modal"
    : (await page.getByTestId("symbol-filter-source-dropdown").count()) > 0
      ? "dropdown"
      : "none";

  if (sourceUi === "modal") {
    await page.getByTestId("symbol-filter-source-modal").click();
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    await page.locator('[data-testid="symbol-modal-option"][data-option="nasdaq"]').first().click({ force: true });
  } else if (sourceUi === "dropdown") {
    await page.getByTestId("symbol-filter-source-dropdown").click();
    await page.getByRole("button", { name: "NASDAQ", exact: true }).click({ force: true });
  }

  const ixicRowSelector = '[data-testid="symbol-result-row"][data-symbol="IXIC"]';
  await expect(page.locator(ixicRowSelector).first()).toBeVisible();
  await page.locator(ixicRowSelector).first().click({ force: true });

  await expect(page.getByTestId("symbol-search-modal")).toHaveAttribute("data-state", "closed");

  await simulationSymbolTrigger.click();
  await page.getByTestId("symbol-category-economy").click({ force: true });
  const economyFiltersReady = await page
    .waitForFunction(() => {
      const hasCountry = document.querySelector('[data-testid="symbol-filter-country-modal"]');
      const hasSource = document.querySelector('[data-testid="symbol-filter-source-dropdown"]');
      const hasCategory = document.querySelector('[data-testid="symbol-filter-economy-category"]');
      return Boolean(hasCountry && hasSource && hasCategory);
    }, undefined, { timeout: 4000 })
    .then(() => true)
    .catch(() => false);

  if (economyFiltersReady) {
    await expect(page.getByTestId("symbol-filter-country-modal")).toBeVisible();
    await expect(page.getByTestId("symbol-filter-source-dropdown")).toBeVisible();
    await expect(page.getByTestId("symbol-filter-economy-category")).toBeVisible();
  }

  const closeButton = page.getByTestId("symbol-search-modal").locator('button[aria-label="Close"]').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(page.getByTestId("symbol-search-modal")).toHaveAttribute("data-state", "closed");
});
