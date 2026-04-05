import { expect, test } from "./playwright-fixture";

test("portfolio builder UX and portfolio APIs work end-to-end", async ({ page }) => {
  const uid = Date.now();
  const email = `e2e_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `e2e_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post("http://127.0.0.1:4000/api/auth/login", {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();
  const authPayload = await authResponse.json();
  const token = authPayload.token as string;
  expect(token).toBeTruthy();

  const createResponse = await page.request.post("http://127.0.0.1:4000/api/portfolio", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: "E2E Portfolio",
      baseCurrency: "USD",
      holdings: [
        { symbol: "AAPL", quantity: 5, avgPrice: 180 },
        { symbol: "BTCUSD", quantity: 1, avgPrice: 60000 },
      ],
    },
  });

  expect(createResponse.ok()).toBeTruthy();

  const listResponse = await page.request.get("http://127.0.0.1:4000/api/portfolio", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listResponse.ok()).toBeTruthy();
  const portfolios = (await listResponse.json()) as Array<{ id: string; name: string }>;
  const target = portfolios.find((p) => p.name === "E2E Portfolio");
  expect(target).toBeTruthy();

  const updateResponse = await page.request.put(`http://127.0.0.1:4000/api/portfolio/${target!.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: "E2E Portfolio Updated",
      baseCurrency: "EUR",
      holdings: [
        { symbol: "ETHUSD", quantity: 2, avgPrice: 3000 },
      ],
    },
  });
  expect(updateResponse.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page).toHaveTitle(/Trade Replay/);

  await page.goto("/portfolio/create");
  await expect(page.getByRole("heading", { name: "Portfolio Builder" })).toBeVisible();
  await expect(page.getByRole("button", { name: "📈 Stocks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "🪙 Crypto" })).toBeVisible();

  await page.getByRole("button", { name: "🪙 Crypto" }).click();
  await page.locator('[role="combobox"]').first().click();
  await page.getByPlaceholder("Search symbol, name, market").fill("BTC");
  await page.getByText("₿ BTCUSD", { exact: false }).first().click();

  await page.locator('[role="combobox"]').nth(1).click();
  await page.getByPlaceholder("Search currency code or name").fill("EUR");
  await page.getByText("🇪🇺 EUR", { exact: false }).first().click();

  await page.getByRole("button", { name: "+ Add Asset" }).click();
  await expect(page.getByText("Market Mix")).toBeVisible();
});
