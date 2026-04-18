import { expect, test } from "./playwright-fixture";
import { installSymbolSearchMock } from "./helpers/mockSymbolSearch";
import { apiUrl } from "./test-env";

async function clickByTestId(page: import("@playwright/test").Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
    const target = nodes.find((node) => node instanceof HTMLElement && node.offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) {
      target.click();
    }
  }, testId);
}

async function clickVisible(page: import("@playwright/test").Page, testId: string): Promise<void> {
  try {
    await page.getByTestId(testId).click({ timeout: 5000 });
  } catch {
    await clickByTestId(page, testId);
  }
}

test("live market loads and supports live symbol selection", async ({ page }) => {
  const uid = Date.now();
  const email = `live_market_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get(apiUrl("/api/health"));
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post(apiUrl("/api/auth/register"), {
    data: { email, password, name: `live_market_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post(apiUrl("/api/auth/login"), {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();
  await installSymbolSearchMock(page);

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);

  await page.goto("/live-market");
  await expect(page.getByRole("heading", { name: "Live Market" })).toBeVisible();
  await expect(page.getByTestId("live-market-active-symbol")).toBeVisible();
  await expect(page.getByTestId("live-market-price")).toBeVisible();

  await clickVisible(page, "live-market-symbol-trigger");
  await expect
    .poll(async () => page.locator('[data-testid="symbol-search-modal"]:visible').count(), { timeout: 10000 })
    .toBeGreaterThan(0);
  await page.getByTestId("symbol-category-stocks").click();
  await page.getByTestId("symbol-search-input").fill("AAPL");

  await expect
    .poll(async () => page.locator('[data-testid="symbol-result-row"]').count())
    .toBeGreaterThan(0);

  const aaplRow = page.locator('[data-testid="symbol-result-row"][data-symbol="AAPL"]').first();
  await expect(aaplRow).toBeVisible();
  await aaplRow.click();

  await expect
    .poll(async () => page.locator('[data-testid="symbol-search-modal"]:visible').count(), { timeout: 10000 })
    .toBe(0);
  await expect(page.getByTestId("live-market-active-symbol")).toContainText("AAPL");

  await expect(page.getByTestId("live-market-price")).toBeVisible();
});
