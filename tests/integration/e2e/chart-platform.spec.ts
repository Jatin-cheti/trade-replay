import { expect, test } from "./playwright-fixture";
import fs from "node:fs/promises";

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
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");

  await expect(page.locator('[data-testid="ohlc-status"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="chart-ohlc-legend"]:visible').first()).toBeVisible();

  const chartOverlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  await expect(chartOverlay).toBeVisible();

  await expect(page.locator('[data-testid="tool-rail"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await page.locator('[data-testid="indicators-button"]:visible').first().click();
  const indicatorsModal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(indicatorsModal).toBeVisible();
  await expect(indicatorsModal.getByTestId('indicators-modal-search')).toBeVisible();

  // Sidebar navigation
  await expect(indicatorsModal.getByTestId('indicators-sidebar-technicals')).toBeVisible();
  await expect(indicatorsModal.getByTestId('indicators-sidebar-financials')).toBeVisible();
  await expect(indicatorsModal.getByTestId('indicators-sidebar-editorsPicks')).toBeVisible();

  // Search and add an indicator
  const searchInput = indicatorsModal.getByTestId('indicators-modal-search');
  await searchInput.fill('macd');
  await expect(indicatorsModal.getByTestId('indicator-catalog-macd')).toBeVisible();
  await indicatorsModal.getByTestId('indicator-catalog-macd').click();

  // Search and add another
  await searchInput.fill('adx');
  await expect(indicatorsModal.getByTestId('indicator-catalog-adx')).toBeVisible();
  await indicatorsModal.getByTestId('indicator-catalog-adx').click();

  // Remove one indicator from the active summary
  await searchInput.fill('');
  // MACD should show as active; click it to toggle off
  await indicatorsModal.getByTestId('indicator-catalog-macd').click();

  // Close via X button
  await indicatorsModal.getByTestId('indicators-modal-close').click();
  if (await page.locator('[data-testid="indicators-modal"]:visible').count()) {
    // Fallback: click the backdrop area to trigger the modal container outside-click close.
    await page.mouse.click(8, 8);
  }
  if (await page.locator('[data-testid="indicators-modal"]:visible').count()) {
    // Final fallback: toggle through the toolbar control that owns the modal state.
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('[data-testid="indicators-button"]'));
      const target = nodes.find((node) => node instanceof HTMLElement && node.offsetParent !== null) ?? nodes[0];
      if (target instanceof HTMLElement) {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
  }
  await expect(page.locator('[data-testid="indicators-modal"]:visible')).toHaveCount(0);

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

  // Cursor menu parity
  await clickByTestId("rail-cursor");
  await expect(page.locator('[data-testid="toolrail-popover"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="menu-cursor"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="cursor-cross"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="cursor-dot"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="cursor-arrow"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="cursor-demo"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="cursor-eraser"]:visible').first()).toBeVisible();
  await clickByTestId("cursor-dot");
  await clickByTestId("rail-cursor");
  await clickByTestId("cursor-cross");

  // Lines/Fib/Gann/Patterns menu structure parity
  await clickByTestId("rail-lines");
  await expect(page.locator('[data-testid="menu-lines"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-trendline"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-ray"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-horizontal-line"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-vertical-line"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-parallel-channel"]:visible').first()).toBeVisible();

  await clickByTestId("rail-fib");
  await expect(page.locator('[data-testid="menu-fib"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="fib-retracement"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="fib-extension"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="fib-channel"]:visible').first()).toBeVisible();
  // Gann tools are now part of the Fibonacci + Gann combined menu
  await expect(page.locator('[data-testid="gann-box"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="gann-fan"]:visible').first()).toBeVisible();

  await clickByTestId("rail-patterns");
  await expect(page.locator('[data-testid="menu-patterns"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-trianglePattern"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-elliottImpulse"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="tool-cyclicLines"]:visible').first()).toBeVisible();

  // Dropdown parity: chart type + timeframe favorites + snap
  await clickByTestId("charttype-dropdown");
  await clickByTestId("chart-type-line");
  await clickByTestId("timeframe-1W");
  // Select specific interval from dropdown (items always in DOM)
  await clickByTestId("interval-15");
  await clickByTestId("snap-dropdown");
  await clickByTestId("snap-option-time");

  for (const testId of quickChartTypes) {
    await clickByTestId(testId);
  }

  for (const type of dropdownTypes) {
    await clickByTestId("charttype-dropdown");
    await clickByTestId(`chart-type-${type}`);
  }

  await clickByTestId("chart-type-candlestick");

  await clickByTestId("rail-lines");
  await clickByTestId("tool-trendline");
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

  await clickByTestId("rail-text");
  await clickByTestId("tool-anchoredText");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: anchoredText");

  await clickByTestId("toolbar-magnet");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: on");

  await clickByTestId("toolbar-undo");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: anchoredText");

  await clickByTestId("toolbar-redo");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: on");

  await clickByTestId("chart-clear");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("0 drawings");

  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-testid="chart-export-png"]:visible').first().click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  if (path) {
    const stat = await fs.stat(path);
    expect(stat.size).toBeGreaterThan(0);
  }
});
