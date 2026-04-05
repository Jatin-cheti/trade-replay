import { expect, test } from "./playwright-fixture";

test("chart platform types, tools, and object actions", async ({ page }) => {
  const uid = Date.now();
  const email = `chart_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `chart_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post("http://127.0.0.1:4000/api/auth/login", {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();
  const authPayload = await authResponse.json();
  const token = authPayload?.token as string;
  expect(token).toBeTruthy();

  await page.goto("/");
  await page.evaluate((nextToken) => {
    window.localStorage.setItem("sim_token", nextToken);
  }, token);
  await page.reload();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/dashboard/);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");

  await expect(page.getByText("Chart Type", { exact: true }).first()).toBeVisible();

  const quickChartTypes = ["chart-type-candlestick", "chart-type-line", "chart-type-area"];
  const dropdownTypes = [
    "baseline",
    "histogram",
    "bar",
    "ohlc",
    "heikinAshi",
    "hollowCandles",
    "stepLine",
    "rangeArea",
    "mountainArea",
    "volumeCandles",
    "volumeLine",
  ];

  const clickByTestId = async (testId: string) => {
    await page.evaluate((id) => {
      const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
      const target =
        nodes.find((node) => node instanceof HTMLElement && node.offsetParent !== null) ??
        nodes[0];
      if (target instanceof HTMLElement) {
        target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }, testId);
  };

  for (const testId of quickChartTypes) {
    await clickByTestId(testId);
  }

  for (const type of dropdownTypes) {
    await page.locator('[data-testid="chart-type-dropdown"]:visible').first().selectOption(type);
  }

  await clickByTestId("chart-type-candlestick");

  await clickByTestId("tool-trend");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: trend");

  await clickByTestId("tool-group-text");
  await clickByTestId("tool-anchoredText");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: anchoredText");

  await clickByTestId("tool-magnet");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: on");

  await clickByTestId("chart-undo");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: anchoredText");

  await clickByTestId("chart-redo");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: on");

  await clickByTestId("chart-clear");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("0 drawings");
});
