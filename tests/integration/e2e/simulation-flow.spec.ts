import { expect, test } from "./playwright-fixture";
import { installSymbolSearchMock } from "./helpers/mockSymbolSearch";

async function expectSymbolModalClosed(page: import("@playwright/test").Page): Promise<void> {
  await expect
    .poll(async () => {
      const modal = page.getByTestId("symbol-search-modal");
      const count = await modal.count();
      if (count === 0) return "removed";
      return (await modal.first().getAttribute("data-state")) ?? "open";
    })
    .toMatch(/removed|closed/);
}

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
  await installSymbolSearchMock(page);

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

  await page.getByTestId("symbol-category-funds").click();
  await page.getByTestId("symbol-search-input").fill("SPY");
  await expect
    .poll(async () => page.locator('[data-testid="symbol-result-row"]').count())
    .toBeGreaterThan(0);

  const spyRow = page.locator('[data-testid="symbol-result-row"][data-symbol="SPY"]').first();
  await expect(spyRow).toBeVisible();
  await spyRow.click();

  await expectSymbolModalClosed(page);
  await expect(portfolioSearchTrigger).toContainText("SPDR S&P 500 ETF Trust");

  await portfolioSearchTrigger.click();
  await page.getByTestId("symbol-category-futures").click();
  await page.getByTestId("symbol-search-input").fill("NIFTY");

  const niftyRoot = page.locator('[data-testid="symbol-result-row"][data-symbol="NIFTY"]').first();
  await expect(niftyRoot).toBeVisible();
  await niftyRoot.click();

  await expect(page.getByRole("heading", { name: "NIFTY Contracts" })).toBeVisible();
  const niftyJunContract = page.locator('[data-testid="symbol-contract-row"][data-symbol="NIFTY-JUN26"]').first();
  await expect(niftyJunContract).toBeVisible();
  await niftyJunContract.click();

  await expectSymbolModalClosed(page);
  await expect(portfolioSearchTrigger).toContainText("NIFTY 50 JUN 2026");

  await page.goto("/simulation");

  const simulationSymbolTrigger = page.getByTestId("scenario-symbol-trigger");
  await expect(simulationSymbolTrigger).toBeVisible();
  await simulationSymbolTrigger.click();

  await expect(page.getByTestId("symbol-search-modal")).toBeVisible();

  await page.getByTestId("symbol-category-indices").click({ force: true });
  await page.getByTestId("symbol-search-input").fill("IXIC");
  await expect
    .poll(async () => page.locator('[data-testid="symbol-result-row"]').count())
    .toBeGreaterThan(0);

  const ixicRowSelector = '[data-testid="symbol-result-row"][data-symbol="IXIC"]';
  await expect(page.locator(ixicRowSelector).first()).toBeVisible();
  await page.locator(ixicRowSelector).first().evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
    }
  });

  await expectSymbolModalClosed(page);

  await simulationSymbolTrigger.click();
  await page.getByTestId("symbol-category-economy").click({ force: true });
  await page.getByTestId("symbol-search-input").fill("CPI");
  const economyRow = page.locator('[data-testid="symbol-result-row"][data-symbol="CPI_US"]').first();
  await expect(economyRow).toBeVisible();

  const closeButton = page.getByTestId("symbol-search-modal").locator('button[aria-label="Close"]').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expectSymbolModalClosed(page);
});
