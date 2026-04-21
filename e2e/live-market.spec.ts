import { expect, test } from "./playwright-fixture";
import { installSymbolSearchMock } from "./helpers/mockSymbolSearch";

test("live market loads and supports live symbol selection", async ({ page }) => {
  const uid = Date.now();
  const email = `live_market_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `live_market_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post("http://127.0.0.1:4000/api/auth/login", {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();
  await installSymbolSearchMock(page);

  const authPayload = await authResponse.json();
  await page.goto("/login");
  await page.evaluate((t) => { window.localStorage.setItem("sim_token", t); }, authPayload.token as string);
  await page.goto("/homepage");
  await expect(page).toHaveURL(/homepage|\/$/);

  await page.goto("/live-market");
  await expect(page.getByRole("heading", { name: "Live Market" })).toBeVisible();
  await expect(page.getByTestId("live-market-active-symbol")).toBeVisible();
  await expect(page.getByTestId("live-market-price")).toBeVisible();

  await page.getByTestId("live-market-symbol-trigger").click();
  await expect(page.getByTestId("symbol-search-modal")).toBeVisible();
  await page.getByTestId("symbol-category-stocks").click();
  await page.getByTestId("symbol-search-input").fill("AAPL");

  await expect
    .poll(async () => page.locator('[data-testid="symbol-result-row"]').count())
    .toBeGreaterThan(0);

  const aaplRow = page.locator('[data-testid="symbol-result-row"][data-symbol="AAPL"]').first();
  await expect(aaplRow).toBeVisible();
  await aaplRow.click();

  await expect(page.getByTestId("symbol-search-modal")).toHaveAttribute("data-state", "closed");
  await expect(page.getByTestId("live-market-active-symbol")).toContainText("AAPL");

  await expect(page.getByTestId("live-market-price")).toBeVisible();
});
