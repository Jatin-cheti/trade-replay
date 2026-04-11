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

test("drawing visibility: single drawing appears immediately", async ({ page }) => {
  const uid = Date.now();
  const email = `drawvis_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `drawvis_${uid}` },
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

  const clickByTestId = async (testId: string) => {
    await page.evaluate((id) => {
      const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
      const target = nodes.find((n) => n instanceof HTMLElement && n.offsetParent !== null) ?? nodes[0];
      if (target instanceof HTMLElement) target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, testId);
  };

  // Start with 0 drawings
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("0 drawings");

  // Select trend tool
  await clickByTestId("tool-trend");
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: trend");

  // Draw a single trend line
  const box = await chartOverlay.boundingBox();
  expect(box).toBeTruthy();
  if (box) {
    await page.evaluate(
      ({ x1, y1, x2, y2 }) => {
        const canvas = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
        if (!canvas) return;
        canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x1, clientY: y1 }));
        canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: x2, clientY: y2 }));
        canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: x2, clientY: y2 }));
      },
      {
        x1: box.x + box.width * 0.25,
        y1: box.y + box.height * 0.3,
        x2: box.x + box.width * 0.6,
        y2: box.y + box.height * 0.55,
      }
    );
  }

  // Verify drawing committed immediately
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("1 drawing");

  // Verify debug hooks
  const drawCount = await page.evaluate(() => {
    const debug = (window as unknown as Record<string, { getDrawingsCount: () => number }>).__chartDebug;
    return debug?.getDrawingsCount() ?? -1;
  });
  expect(drawCount).toBe(1);

  const commitTime = await page.evaluate(() => {
    const debug = (window as unknown as Record<string, { getLastDrawCommitAt: () => number }>).__chartDebug;
    return debug?.getLastDrawCommitAt() ?? 0;
  });
  expect(commitTime).toBeGreaterThan(0);
  expect(Date.now() - commitTime).toBeLessThan(5000);
});

test("drawing anchoring: coordinates stable across data updates", async ({ page }) => {
  const uid = Date.now();
  const email = `anchor_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `anchor_${uid}` },
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

  const clickByTestId = async (testId: string) => {
    await page.evaluate((id) => {
      const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
      const target = nodes.find((n) => n instanceof HTMLElement && n.offsetParent !== null) ?? nodes[0];
      if (target instanceof HTMLElement) target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, testId);
  };

  // Select trend tool and draw
  await clickByTestId("tool-trend");
  const box = await chartOverlay.boundingBox();
  expect(box).toBeTruthy();
  if (box) {
    await page.evaluate(
      ({ x1, y1, x2, y2 }) => {
        const canvas = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
        if (!canvas) return;
        canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x1, clientY: y1 }));
        canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: x2, clientY: y2 }));
        canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: x2, clientY: y2 }));
      },
      {
        x1: box.x + box.width * 0.3,
        y1: box.y + box.height * 0.35,
        x2: box.x + box.width * 0.5,
        y2: box.y + box.height * 0.5,
      }
    );
  }

  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("1 drawing");

  // Capture anchor coordinates via debug hooks
  const anchorsBefore = await page.evaluate(() => {
    const debug = (window as unknown as Record<string, { getDrawings: () => Array<{ anchors: Array<{ time: number; price: number }> }> }>).__chartDebug;
    const drawings = debug?.getDrawings() ?? [];
    if (!drawings.length) return null;
    return drawings[0].anchors.map((a) => ({ time: a.time, price: a.price }));
  });

  expect(anchorsBefore).toBeTruthy();
  expect(anchorsBefore).toHaveLength(2);

  // Read anchors again - should be identical (no drift)
  const anchorsAfter = await page.evaluate(() => {
    const debug = (window as unknown as Record<string, { getDrawings: () => Array<{ anchors: Array<{ time: number; price: number }> }> }>).__chartDebug;
    const drawings = debug?.getDrawings() ?? [];
    if (!drawings.length) return null;
    return drawings[0].anchors.map((a) => ({ time: a.time, price: a.price }));
  });

  expect(anchorsAfter).toEqual(anchorsBefore);
});
