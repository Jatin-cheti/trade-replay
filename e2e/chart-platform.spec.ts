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

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");

  const chartOverlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  await expect(chartOverlay).toBeVisible();

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
    "renko",
    "rangeBars",
    "lineBreak",
    "kagi",
    "pointFigure",
    "brick",
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

  const box = await chartOverlay.boundingBox();
  expect(box).toBeTruthy();
  if (box) {
    await page.evaluate(
      ({ x1, y1, x2, y2 }) => {
        const canvas = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
        if (!canvas) return;
        canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: x1, clientY: y1 }));
        canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: x2, clientY: y2 }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: x2, clientY: y2 }));
      },
      {
        x1: box.x + box.width * 0.3,
        y1: box.y + box.height * 0.35,
        x2: box.x + box.width * 0.55,
        y2: box.y + box.height * 0.52,
      }
    );
  }
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText(/drawing/);

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
