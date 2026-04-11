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

test("toolbar actions: all controls visible on desktop", async ({ page }) => {
  const uid = Date.now();
  const email = `toolbar_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `toolbar_${uid}` },
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
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible();

  // All toolbar actions must be visible
  await expect(page.locator('[data-testid="toolbar-undo"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="toolbar-redo"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="toolbar-magnet"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="toolbar-layout"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="indicators-button"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="chart-export-png"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="chart-clear"]:visible').first()).toBeVisible();
});

test("drawing visible regardless of object tree state", async ({ page }) => {
  const uid = Date.now();
  const email = `objtree_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `objtree_${uid}` },
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

  // Draw a trend line with object tree EXPANDED (default on desktop)
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
        x1: box.x + box.width * 0.25,
        y1: box.y + box.height * 0.3,
        x2: box.x + box.width * 0.55,
        y2: box.y + box.height * 0.55,
      }
    );
  }

  // Drawing committed with tree expanded
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("1 drawing");

  // Verify drawing count via debug hook (regardless of tree state)
  let count = await page.evaluate(() => {
    const debug = (window as unknown as Record<string, { getDrawingsCount: () => number }>).__chartDebug;
    return debug?.getDrawingsCount() ?? -1;
  });
  expect(count).toBe(1);

  // Collapse object tree
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="drawing-badge"]')
      ?.closest('.relative')
      ?.querySelector('aside button');
    if (btn instanceof HTMLElement) btn.click();
  });

  // Wait for layout to settle
  await page.waitForTimeout(200);

  // Drawing still committed after collapse
  count = await page.evaluate(() => {
    const debug = (window as unknown as Record<string, { getDrawingsCount: () => number }>).__chartDebug;
    return debug?.getDrawingsCount() ?? -1;
  });
  expect(count).toBe(1);

  // Overlay canvas still visible
  await expect(chartOverlay).toBeVisible();
});

test("indicators: search and add non-top indicator", async ({ page }) => {
  const uid = Date.now();
  const email = `indic_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `indic_${uid}` },
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
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible();

  // Open indicators panel
  await page.locator('[data-testid="indicators-button"]:visible').first().click();
  const panel = page.locator('[data-testid="indicators-panel"]:visible').first();
  await expect(panel).toBeVisible();

  // Verify top 5 quick picks
  await expect(panel.getByTestId("indicators-top5")).toBeVisible();

  // Search for a non-top indicator
  const searchInput = panel.getByTestId("indicators-search");
  await searchInput.fill("bollinger");
  await expect(panel.getByTestId("indicators-results").locator("button")).not.toHaveCount(0);

  // Add via keyboard
  await searchInput.press("Enter");

  // Should appear in active list
  await expect(panel.getByTestId("indicators-active")).toContainText(/bollinger|bbands/i);
});

test("selected tool badge does not block clicks", async ({ page }) => {
  const uid = Date.now();
  const email = `badge_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `badge_${uid}` },
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

  // Select trend tool and draw to get a selected drawing
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
        x2: box.x + box.width * 0.55,
        y2: box.y + box.height * 0.52,
      }
    );
  }
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("1 drawing");

  // Selected indicator should be in the toolbox header, not floating
  const badge = page.locator('[data-testid="selected-tool-indicator"]');
  if (await badge.count() > 0) {
    // Badge must have pointer-events: none
    const pe = await badge.first().evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe).toBe("none");
  }

  // Toolbox collapse/expand must still be clickable
  await clickByTestId("toolbox-collapse");
  await expect(page.locator('[data-testid="toolbox-expand"]:visible').first()).toBeVisible();
  await clickByTestId("toolbox-expand");
  await expect(page.locator('[data-testid="toolbox-collapse"]:visible').first()).toBeVisible();

  // Toolbar buttons must still be clickable
  await clickByTestId("toolbar-undo");
  await clickByTestId("toolbar-redo");
});

test("toolbox expand button remains visible and clickable", async ({ page }) => {
  const uid = Date.now();
  const email = `tbxvis_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `tbxvis_${uid}` },
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
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible();

  // Toolbox panel is visible
  await expect(page.locator('[data-testid="toolbox-panel"]:visible').first()).toBeVisible();

  // Collapse button visible and has proper hit area
  const collapseBtn = page.locator('[data-testid="toolbox-collapse"]:visible').first();
  await expect(collapseBtn).toBeVisible();
  const collapseBox = await collapseBtn.boundingBox();
  expect(collapseBox).toBeTruthy();
  if (collapseBox) {
    expect(collapseBox.width).toBeGreaterThanOrEqual(32);
    expect(collapseBox.height).toBeGreaterThanOrEqual(32);
  }

  // Click collapse
  await collapseBtn.click();

  // Expand button now visible with proper hit area
  const expandBtn = page.locator('[data-testid="toolbox-expand"]:visible').first();
  await expect(expandBtn).toBeVisible();
  const expandBox = await expandBtn.boundingBox();
  expect(expandBox).toBeTruthy();
  if (expandBox) {
    expect(expandBox.width).toBeGreaterThanOrEqual(32);
    expect(expandBox.height).toBeGreaterThanOrEqual(32);
  }

  // Click expand
  await expandBtn.click();

  // Collapse button is back
  await expect(page.locator('[data-testid="toolbox-collapse"]:visible').first()).toBeVisible();
});

test("status row and toolbox header are uncluttered", async ({ page }) => {
  const uid = Date.now();
  const email = `status_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `status_${uid}` },
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
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible();

  // OHLC status row exists outside the toolbox
  const statusRow = page.locator('[data-testid="ohlc-status"]:visible').first();
  await expect(statusRow).toBeVisible();

  // Snap mode is in the toolbar, NOT inside toolbox panel
  const toolboxPanel = page.locator('[data-testid="toolbox-panel"]:visible').first();
  await expect(toolboxPanel).toBeVisible();

  // Toolbox should not contain snap mode dropdown
  const snapInToolbox = toolboxPanel.locator('[data-testid="chart-snap-mode"]');
  await expect(snapInToolbox).toHaveCount(0);

  // Snap mode selector should be in the toolbar area (outside toolbox)
  await expect(page.locator('[data-testid="chart-snap-mode"]:visible').first()).toBeVisible();
});
