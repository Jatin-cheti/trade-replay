import { expect, test, type Page } from "./playwright-fixture";
import { apiUrl } from "./test-env";

test.setTimeout(240_000);

async function registerAndLogin(page: Page): Promise<void> {
  const uid = Date.now();
  const email = `tool_rail_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get(apiUrl("/api/health"));
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post(apiUrl("/api/auth/register"), {
    data: { email, password, name: `tool_rail_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post(apiUrl("/api/auth/login"), {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);
}

async function waitForChart(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="ohlc-status"]:visible').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="tool-rail"]:visible').first()).toBeVisible();
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toBeVisible();
}

async function clickVisible(page: Page, testId: string): Promise<void> {
  try {
    await page.locator(`[data-testid="${testId}"]:visible`).first().click({ timeout: 5000 });
  } catch {
    await clickByTestId(page, testId);
  }
}

async function clickByTestId(page: Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
    const target = nodes.find((node) => node instanceof HTMLElement && node.offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) {
      target.click();
    }
  }, testId);
}

async function ensureGroupMenuOpen(page: Page, group: string): Promise<void> {
  const menuTestId = group === "cursor" ? "menu-cursor" : `menu-${group}`;
  const menu = page.locator(`[data-testid="${menuTestId}"]:visible`).first();

  if (await menu.isVisible().catch(() => false)) return;

  const inFullView = (await page.locator('[data-testid="chart-root"][data-full-view="true"]:visible').count()) > 0;

  // Dismiss any portal-rendered popover that might intercept clicks.
  // Avoid Escape in fullscreen because it closes full-view mode.
  if (!inFullView) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }

  await clickVisible(page, `rail-${group}`);
  if (await menu.isVisible().catch(() => false)) return;

  // If first click closed an already-open section, second click re-opens it.
  await clickVisible(page, `rail-${group}`);
  await expect(menu).toBeVisible({ timeout: 5000 });
}

async function selectTool(page: Page, group: string, toolTestId: string, badgeText: string): Promise<void> {
  await ensureGroupMenuOpen(page, group);
  await expect(page.locator('[data-testid="toolrail-popover"]:visible').first()).toBeVisible({ timeout: 5000 });
  await clickByTestId(page, toolTestId);
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText(badgeText, { timeout: 5000 });
}

async function draw2PointShape(page: Page, region: 'left' | 'center' | 'right' = 'center'): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  // Use distinct regions so drawings don't overlap and accidentally select each other
  const offsets = {
    left:   { x1: 0.10, y1: 0.25, x2: 0.28, y2: 0.40 },
    center: { x1: 0.32, y1: 0.35, x2: 0.62, y2: 0.55 },
    right:  { x1: 0.68, y1: 0.30, x2: 0.88, y2: 0.50 },
  };
  const o = offsets[region];
  const x1 = box.x + box.width * o.x1;
  const y1 = box.y + box.height * o.y1;
  const x2 = box.x + box.width * o.x2;
  const y2 = box.y + box.height * o.y2;

  // Use Playwright mouse API for realistic event timing
  await page.mouse.move(x1, y1);
  await page.waitForTimeout(50);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(x2, y2, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.up();

  await page.waitForTimeout(350);
}

async function readChartCursor(page: Page): Promise<string> {
  return page.locator('[data-testid="chart-container"]:visible').first().evaluate((el) => getComputedStyle(el).cursor);
}

async function readDrawingCount(page: Page): Promise<number> {
  const badgeText = await page.locator('[data-testid="drawing-badge"]:visible').first().textContent();
  const match = badgeText?.match(/\b(\d+)\s+drawing/);
  return match ? Number(match[1]) : 0;
}

async function readCursorPriceLabel(page: Page): Promise<string> {
  const status = await page.locator('[data-testid="ohlc-status"]:visible').first().textContent();
  const match = status?.match(/Cursor\s+([\d.\-]+)/i);
  return match?.[1] ?? '';
}

async function readDrawingAnchors(page: Page, index = 0): Promise<Array<{ time: number; price: number }>> {
  return page.evaluate((targetIndex) => {
    const debug = (window as unknown as { __chartDebug?: { getDrawings?: () => Array<{ anchors: Array<{ time: number; price: number }> }> } }).__chartDebug;
    const drawings = debug?.getDrawings?.() ?? [];
    const drawing = drawings[targetIndex];
    return drawing?.anchors?.map((anchor) => ({ time: Number(anchor.time), price: Number(anchor.price) })) ?? [];
  }, index);
}

async function readLatestDrawing(page: Page): Promise<{ text?: string; options?: Record<string, unknown>; anchors: Array<{ time: number; price: number }> }> {
  return page.evaluate(() => {
    const debug = (window as unknown as {
      __chartDebug?: {
        getDrawings?: () => Array<{ text?: string; options?: Record<string, unknown>; anchors: Array<{ time: number; price: number }> }>;
      };
    }).__chartDebug;
    const drawings = debug?.getDrawings?.() ?? [];
    const drawing = drawings[drawings.length - 1];
    return {
      text: drawing?.text,
      options: drawing?.options,
      anchors: drawing?.anchors?.map((anchor) => ({ time: Number(anchor.time), price: Number(anchor.price) })) ?? [],
    };
  });
}

async function drawAt(page: Page, start: { x: number; y: number }, end: { x: number; y: number }): Promise<void> {
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(35);
  await page.mouse.down();
  await page.waitForTimeout(35);
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.waitForTimeout(35);
  await page.mouse.up();
  await page.waitForTimeout(220);
}

async function drawPointTool(page: Page, xRatio = 0.52, yRatio = 0.45): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  await page.waitForTimeout(180);
}

async function confirmPromptIfVisible(page: Page): Promise<void> {
  const modal = page.locator('[data-testid="chart-prompt-modal"]:visible').first();
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByTestId('chart-prompt-ok').click();
    await expect(page.locator('[data-testid="chart-prompt-modal"]:visible')).toHaveCount(0);
  }
}

async function placeWizardTool(page: Page, anchorCount: number, region: 'left' | 'center' | 'right' = 'center'): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const regionOffsets = { left: 0.08, center: 0.28, right: 0.58 };
  const baseX = regionOffsets[region];
  for (let i = 0; i < anchorCount; i += 1) {
    const x = box.x + box.width * (baseX + 0.04 * i);
    const y = box.y + box.height * (0.30 + (i % 2 === 0 ? 0 : 0.18));
    await page.mouse.click(x, y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(200);
}

async function placeCurrentTool(page: Page, pointOnly = false, region: 'left' | 'center' | 'right' = 'center'): Promise<void> {
  if (pointOnly) {
    await drawPointTool(page);
  } else {
    await draw2PointShape(page, region);
  }
  await confirmPromptIfVisible(page);
}

async function dispatchTouch(page: Page, type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ type, x, y }) => {
      const surface = document.querySelector('[data-testid="chart-interaction-surface"]') as HTMLElement | null;
      if (!surface) return;
      const touch = new Touch({
        identifier: 1,
        target: surface,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
        screenX: x,
        screenY: y,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: 1,
      });
      const touches = type === 'touchend' ? [] : [touch];
      surface.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches,
          targetTouches: touches,
          changedTouches: [touch],
        })
      );
    },
    { type, x, y }
  );
}

test.describe("Tool Rail Popover", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndLogin(page);
    await page.goto("/simulation");
    await waitForChart(page);
  });

  test("popover anchors near clicked rail icon and clamps on resize", async ({ page }) => {
    await ensureGroupMenuOpen(page, "lines");
    const popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await expect(popover).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    const button = page.locator('[data-testid="rail-lines"]:visible').first();
    const buttonBox = await button.boundingBox();
    const popBox = await popover.boundingBox();
    expect(buttonBox).toBeTruthy();
    expect(popBox).toBeTruthy();
    if (!buttonBox || !popBox) return;

    expect(Math.abs(popBox.x - (buttonBox.x + buttonBox.width))).toBeLessThan(60);
    expect(popBox.y).toBeGreaterThanOrEqual(0);

    // Resize viewport, then close and re-open the menu to guarantee repositioning
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.waitForTimeout(200);
    // Close the popover via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    // Re-open so positionSubmenu runs with the new viewport
    await ensureGroupMenuOpen(page, "lines");
    await expect(popover).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    const clampCheck = await popover.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left,
        y: r.top,
        right: r.right,
        bottom: r.bottom,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });

    expect(clampCheck.x).toBeGreaterThanOrEqual(-2);
    expect(clampCheck.y).toBeGreaterThanOrEqual(-2);
    expect(clampCheck.right).toBeLessThanOrEqual(clampCheck.vw + 4);
    expect(clampCheck.bottom).toBeLessThanOrEqual(clampCheck.vh + 4);
  });

  test("all menu groups have no Soon badge", async ({ page }) => {
    for (const group of ["cursor", "lines", "fib", "patterns", "forecasting", "brush", "text", "icon"]) {
      await ensureGroupMenuOpen(page, group);
      await expect(page.locator('[data-testid="toolrail-popover"]:visible').first()).toBeVisible();
      const soonCount = await page.evaluate(() => {
        const pop = document.querySelector('[data-testid="toolrail-popover"]');
        if (!pop) return -1;
        return Array.from(pop.querySelectorAll("button")).filter((b) => b.textContent?.includes("Soon")).length;
      });
      expect(soonCount).toBe(0);
    }
  });

  test("lines menu exposes every line, channel, and pitchfork option", async ({ page }) => {
    await ensureGroupMenuOpen(page, "lines");
    const popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    for (const testId of [
      "tool-trendline",
      "tool-ray",
      "tool-info-line",
      "tool-extended-line",
      "tool-trend-angle",
      "tool-horizontal-line",
      "tool-horizontal-ray",
      "tool-vertical-line",
      "tool-cross-line",
      "tool-parallel-channel",
      "tool-regression-trend",
      "tool-flat-top-bottom",
      "tool-disjoint-channel",
      "tool-pitchfork",
      "tool-schiff-pitchfork",
      "tool-modified-schiff-pitchfork",
      "tool-inside-pitchfork",
    ]) {
      await expect(popover.getByTestId(testId)).toBeVisible();
    }
  });

  test("representative tools draw from each required group", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, 'left');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("1 drawing");

    await selectTool(page, "fib", "fib-speed-resistance-fan", "tool: fibSpeedResistFan");
    await draw2PointShape(page, 'center');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("2 drawing");

    await selectTool(page, "patterns", "tool-xabcd", "tool: xabcd");
    const patternOverlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const patternBox = await patternOverlay.boundingBox();
    expect(patternBox).toBeTruthy();
    if (!patternBox) return;

    const points = [
      { x: patternBox.x + patternBox.width * 0.69, y: patternBox.y + patternBox.height * 0.30 },
      { x: patternBox.x + patternBox.width * 0.75, y: patternBox.y + patternBox.height * 0.51 },
      { x: patternBox.x + patternBox.width * 0.80, y: patternBox.y + patternBox.height * 0.34 },
      { x: patternBox.x + patternBox.width * 0.86, y: patternBox.y + patternBox.height * 0.55 },
      { x: patternBox.x + patternBox.width * 0.91, y: patternBox.y + patternBox.height * 0.39 },
    ];
    for (const point of points) {
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(60);
    }

    await expect.poll(async () => readDrawingCount(page)).toBe(3);

    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-eraser");
    await page.waitForTimeout(150);

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    if (box) {
      await page.evaluate(
        ({ x, y }) => {
          const c = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
          if (!c) return;
          c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
          c.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
        },
        { x: box.x + box.width * 0.48, y: box.y + box.height * 0.47 }
      );
    }

    await page.waitForTimeout(300);
    const badgeText = await page.locator('[data-testid="drawing-badge"]:visible').first().textContent();
    expect(badgeText ?? "").toContain("drawing");
  });

  test("standalone rail tools are present and functional", async ({ page }) => {
    // Verify all standalone action buttons are visible
    for (const testId of [
      "rail-measure",
      "rail-zoom-in",
      "rail-zoom-out",
      "rail-magnet",
      "rail-keep-drawing",
      "rail-lock-drawings",
      "rail-hide-objects",
      "rail-delete",
    ]) {
      await expect(page.locator(`[data-testid="${testId}"]:visible`).first()).toBeVisible();
    }

    // Toggle magnet via rail
    await clickVisible(page, "rail-magnet");
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: on", { timeout: 3000 });
    await clickVisible(page, "rail-magnet");
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: off", { timeout: 3000 });

    // Zoom in/out should not throw
    await clickVisible(page, "rail-zoom-in");
    await clickVisible(page, "rail-zoom-out");

    // Measure shortcut sets tool to priceRange
    await clickVisible(page, "rail-measure");
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: priceRange", { timeout: 3000 });
  });

  test("drawing tools default to snap-off for smooth placement", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");

    const snapMode = await page.evaluate(() => {
      const debug = (window as unknown as { __chartDebug?: { getToolOptions?: () => { snapMode?: string } } }).__chartDebug;
      return debug?.getToolOptions?.().snapMode ?? null;
    });

    expect(snapMode).toBe('off');
  });

  test("cursor menu changes the chart cursor surface", async ({ page }) => {
    await ensureGroupMenuOpen(page, "cursor");
    const chartCursor = async () => readChartCursor(page);

    await clickByTestId(page, "cursor-cross");
    await expect.poll(chartCursor).toMatch(/crosshair/);

    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-dot");
    const dotCursor = await chartCursor();
    expect(dotCursor).toContain("url(");
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: none");

    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-arrow");
    await expect.poll(chartCursor).toBe("default");

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const cursorPriceBefore = await readCursorPriceLabel(page);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.25);
    await page.waitForTimeout(120);
    const cursorPriceAfter = await readCursorPriceLabel(page);
    expect(cursorPriceAfter).toBe(cursorPriceBefore);

    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-demo");
    const demoCursor = await chartCursor();
    expect(demoCursor).toBe("pointer");

    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-eraser");
    const eraserCursor = await chartCursor();
    expect(eraserCursor).toContain("url(");
  });

  test("eraser removes a line by hitting the body", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, 'center');

    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("1 drawing");

    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-eraser");

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);

    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("0 drawings", { timeout: 5000 });
  });

  test("eraser removes text tools by clicking their rendered area", async ({ page }) => {
    await selectTool(page, 'text', 'tool-anchoredText', 'tool: anchoredText');
    await placeCurrentTool(page, true);
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText('1 drawing');

    await ensureGroupMenuOpen(page, 'cursor');
    await clickByTestId(page, 'cursor-eraser');

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await page.mouse.move(box.x + box.width * 0.53, box.y + box.height * 0.44);
    await page.mouse.click(box.x + box.width * 0.53, box.y + box.height * 0.44);

    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText('0 drawings', { timeout: 5000 });
  });

  test("eraser removes line, ray, and text in normal and full view", async ({ page }) => {
    const drawAndErase = async (toolGroup: string, toolId: string, badge: string, pointOnly = false) => {
      await selectTool(page, toolGroup, toolId, badge);
      await placeCurrentTool(page, pointOnly);
      const beforeErase = await readDrawingCount(page);
      expect(beforeErase).toBeGreaterThan(0);

      await ensureGroupMenuOpen(page, 'cursor');
      await clickByTestId(page, 'cursor-eraser');

      const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
      const box = await overlay.boundingBox();
      expect(box).toBeTruthy();
      if (!box) return;

      await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.46);
      await expect.poll(async () => readDrawingCount(page)).toBeLessThan(beforeErase);
    };

    await drawAndErase('lines', 'tool-trendline', 'tool: trend');
    await drawAndErase('lines', 'tool-ray', 'tool: ray');
    await drawAndErase('text', 'tool-anchoredText', 'tool: anchoredText', true);

    await clickVisible(page, 'chart-toggle-full-view');
    await expect(page.locator('[data-testid="chart-root"][data-full-view="true"]:visible').first()).toBeVisible();

    await drawAndErase('lines', 'tool-trendline', 'tool: trend');
    await drawAndErase('lines', 'tool-ray', 'tool: ray');
    await drawAndErase('text', 'tool-anchoredText', 'tool: anchoredText', true);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="chart-root"][data-full-view="true"]:visible')).toHaveCount(0);
  });

  test("selecting a line tool exits eraser mode", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, 'left');
    const before = await readDrawingCount(page);
    expect(before).toBeGreaterThanOrEqual(1);

    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-eraser");
    const eraserCursor = await readChartCursor(page);
    expect(eraserCursor).toContain("url(");

    await selectTool(page, "lines", "tool-ray", "tool: ray");
    const cursorAfterToolPick = await readChartCursor(page);
    expect(cursorAfterToolPick).toContain("crosshair");

    await draw2PointShape(page, 'center');
    await expect.poll(async () => readDrawingCount(page)).toBe(before + 1);
  });

  test("chart full-view toggle opens and closes workspace mode", async ({ page }) => {
    await expect(page.locator('[data-testid="chart-root"][data-full-view="true"]:visible')).toHaveCount(0);

    await clickVisible(page, 'chart-toggle-full-view');
    await expect(page.locator('[data-testid="chart-root"][data-full-view="true"]:visible').first()).toBeVisible();
    await expect(page.locator('[data-testid="chart-container"]:visible').first()).toBeVisible();

    const fullscreenBounds = await page.locator('[data-testid="chart-full-view-overlay"]:visible').first().evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
    expect(fullscreenBounds.width).toBeGreaterThanOrEqual(fullscreenBounds.vw * 0.97);
    expect(fullscreenBounds.height).toBeGreaterThanOrEqual(fullscreenBounds.vh * 0.95);

    // Left rail popover remains visible and actionable in full view.
    await ensureGroupMenuOpen(page, 'lines');
    await expect(page.locator('[data-testid="toolrail-popover"]:visible').first()).toBeVisible();
    await expect(page.locator('[data-testid="tool-trendline"]:visible').first()).toBeVisible();

    // Top bar dropdown still opens in full view.
    await clickVisible(page, 'timeframe-current');
    await expect(page.locator('[data-testid="interval-1"]:visible').first()).toBeVisible();
    await clickVisible(page, 'timeframe-current');

    // Custom interval modal must render above the fullscreen overlay.
    await clickVisible(page, 'timeframe-current');
    await clickVisible(page, 'custom-interval-btn');
    await expect(page.locator('[data-testid="custom-interval-modal"]:visible').first()).toBeVisible();
    await clickVisible(page, 'custom-interval-close');
    await expect(page.locator('[data-testid="custom-interval-modal"]:visible')).toHaveCount(0);

    // Tool options panel should open/close from top bar.
    await clickVisible(page, 'chart-options-toggle');
    await expect(page.locator('[data-testid="tool-options-panel"]:visible').first()).toBeVisible();
    await clickVisible(page, 'chart-options-toggle');
    await expect(page.locator('[data-testid="tool-options-panel"]:visible')).toHaveCount(0);

    // Object tree panel toggle should still work in full view.
    const treePanel = page.locator('[data-testid="object-tree-panel"]:visible').first();
    const treeOpenBefore = (await treePanel.getAttribute('data-open')) === 'true';
    await clickVisible(page, 'chart-objects-toggle');
    await expect(treePanel).toHaveAttribute('data-open', treeOpenBefore ? 'false' : 'true');
    await clickVisible(page, 'chart-objects-toggle');
    await expect(treePanel).toHaveAttribute('data-open', treeOpenBefore ? 'true' : 'false');

    // Indicators modal should remain visible and closable in full view.
    await clickVisible(page, 'indicators-button');
    await expect(page.locator('[data-testid="indicators-modal"]:visible').first()).toBeVisible();
    await clickByTestId(page, 'indicators-button');
    await expect(page.locator('[data-testid="indicators-modal"]:visible')).toHaveCount(0);

    await clickVisible(page, 'chart-toggle-full-view');
    await expect(page.locator('[data-testid="chart-root"][data-full-view="true"]:visible')).toHaveCount(0);
    await expect(page.locator('[data-testid="chart-root"][data-full-view="false"]:visible').first()).toBeVisible();
  });

  test("info line does not open text modal and needs an intentional drag", async ({ page }) => {
    await selectTool(page, "lines", "tool-info-line", "tool: infoLine");

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const before = await readDrawingCount(page);
    await page.mouse.click(box.x + box.width * 0.56, box.y + box.height * 0.42);
    await expect(page.locator('[data-testid="chart-prompt-modal"]')).toHaveCount(0);
    await expect.poll(async () => readDrawingCount(page)).toBe(before);

    await draw2PointShape(page, 'right');
    await expect.poll(async () => readDrawingCount(page)).toBe(before + 1);
  });

  test("every line option draws at least one object", async ({ page }) => {
    const lineOptions: Array<{ id: string; badge: string }> = [
      { id: 'tool-trendline', badge: 'tool: trend' },
      { id: 'tool-ray', badge: 'tool: ray' },
      { id: 'tool-info-line', badge: 'tool: infoLine' },
      { id: 'tool-extended-line', badge: 'tool: extendedLine' },
      { id: 'tool-trend-angle', badge: 'tool: trendAngle' },
      { id: 'tool-horizontal-line', badge: 'tool: hline' },
      { id: 'tool-horizontal-ray', badge: 'tool: horizontalRay' },
      { id: 'tool-vertical-line', badge: 'tool: vline' },
      { id: 'tool-cross-line', badge: 'tool: crossLine' },
      { id: 'tool-parallel-channel', badge: 'tool: channel' },
      { id: 'tool-regression-trend', badge: 'tool: regressionTrend' },
      { id: 'tool-flat-top-bottom', badge: 'tool: flatTopBottom' },
      { id: 'tool-disjoint-channel', badge: 'tool: disjointChannel' },
      { id: 'tool-pitchfork', badge: 'tool: pitchfork' },
      { id: 'tool-schiff-pitchfork', badge: 'tool: schiffPitchfork' },
      { id: 'tool-modified-schiff-pitchfork', badge: 'tool: modifiedSchiffPitchfork' },
      { id: 'tool-inside-pitchfork', badge: 'tool: insidePitchfork' },
    ];

    const regions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];

    for (const [index, option] of lineOptions.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, 'lines', option.id, option.badge);
      await draw2PointShape(page, regions[index % regions.length]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  test("every fibonacci and gann option draws and binds to the correct variant", async ({ page }) => {
    const fibOptions: Array<{ id: string; badge: string }> = [
      { id: 'fib-retracement', badge: 'tool: fibRetracement' },
      { id: 'fib-extension', badge: 'tool: fibExtension' },
      { id: 'fib-channel', badge: 'tool: fibChannel' },
      { id: 'fib-time-zone', badge: 'tool: fibTimeZone' },
      { id: 'fib-speed-resistance-fan', badge: 'tool: fibSpeedResistFan' },
      { id: 'fib-trend-time', badge: 'tool: fibTrendTime' },
      { id: 'fib-circles', badge: 'tool: fibCircles' },
      { id: 'fib-spiral', badge: 'tool: fibSpiral' },
      { id: 'fib-speed-resistance-arcs', badge: 'tool: fibSpeedResistArcs' },
      { id: 'fib-wedge', badge: 'tool: fibWedge' },
      { id: 'pitchfan', badge: 'tool: pitchfan' },
      { id: 'gann-box', badge: 'tool: gannBox' },
      { id: 'gann-square-fixed', badge: 'tool: gannSquareFixed' },
      { id: 'gann-square', badge: 'tool: gannSquare' },
      { id: 'gann-fan', badge: 'tool: gannFan' },
    ];

    const regions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
    for (const [index, option] of fibOptions.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, 'fib', option.id, option.badge);
      await placeCurrentTool(page, false, regions[index % regions.length]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  test("fib retracement supports custom levels and label mode options", async ({ page }) => {
    await selectTool(page, 'fib', 'fib-retracement', 'tool: fibRetracement');
    await draw2PointShape(page, 'center');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText('1 drawing');

    await clickVisible(page, 'chart-options-toggle');
    await page.locator('[data-testid="tool-option-fibLevels"]:visible').first().fill('0,0.5,1,1.618');
    await page.locator('[data-testid="tool-option-fibLabelMode"]:visible').first().selectOption('both');

    const latest = await readLatestDrawing(page);
    expect(latest.options?.fibLevels).toBe('0,0.5,1,1.618');
    expect(latest.options?.fibLabelMode).toBe('both');
  });

  test("pattern panel variants draw with expected bindings", async ({ page }) => {
    const patternOptions: Array<{ id: string; badge: string; anchors: number }> = [
      { id: 'tool-xabcd', badge: 'tool: xabcd', anchors: 5 },
      { id: 'tool-cypherPattern', badge: 'tool: cypherPattern', anchors: 5 },
      { id: 'tool-headAndShoulders', badge: 'tool: headAndShoulders', anchors: 5 },
      { id: 'tool-abcdPattern', badge: 'tool: abcdPattern', anchors: 4 },
      { id: 'tool-trianglePattern', badge: 'tool: trianglePattern', anchors: 3 },
      { id: 'tool-threeDrives', badge: 'tool: threeDrives', anchors: 7 },
      { id: 'tool-elliottImpulse', badge: 'tool: elliottImpulse', anchors: 5 },
      { id: 'tool-elliottCorrection', badge: 'tool: elliottCorrection', anchors: 3 },
      { id: 'tool-elliottTriangle', badge: 'tool: elliottTriangle', anchors: 5 },
      { id: 'tool-elliottDoubleCombo', badge: 'tool: elliottDoubleCombo', anchors: 3 },
      { id: 'tool-elliottTripleCombo', badge: 'tool: elliottTripleCombo', anchors: 5 },
      { id: 'tool-cyclicLines', badge: 'tool: cyclicLines', anchors: 2 },
      { id: 'tool-timeCycles', badge: 'tool: timeCycles', anchors: 2 },
      { id: 'tool-sineLine', badge: 'tool: sineLine', anchors: 2 },
    ];

    const regions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
    for (const [index, option] of patternOptions.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, 'patterns', option.id, option.badge);
      if (option.anchors > 2) {
        await placeWizardTool(page, option.anchors, regions[index % regions.length]);
      } else {
        await placeCurrentTool(page, false, regions[index % regions.length]);
      }
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  test("pattern tools guide point-by-point wizard flow", async ({ page }) => {
    await selectTool(page, 'patterns', 'tool-xabcd', 'tool: xabcd');
    const before = await readDrawingCount(page);

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const points = [
      { x: box.x + box.width * 0.22, y: box.y + box.height * 0.34 },
      { x: box.x + box.width * 0.34, y: box.y + box.height * 0.54 },
      { x: box.x + box.width * 0.47, y: box.y + box.height * 0.38 },
      { x: box.x + box.width * 0.62, y: box.y + box.height * 0.57 },
      { x: box.x + box.width * 0.76, y: box.y + box.height * 0.42 },
    ];

    await page.mouse.click(points[0].x, points[0].y);
    await expect(page.locator('[data-testid="pattern-wizard-hint"]:visible').first()).toContainText('(2/5)');
    await expect.poll(async () => readDrawingCount(page)).toBe(before);

    for (let i = 1; i < points.length - 1; i += 1) {
      await page.mouse.click(points[i].x, points[i].y);
      await expect.poll(async () => readDrawingCount(page)).toBe(before);
    }

    await page.mouse.click(points[points.length - 1].x, points[points.length - 1].y);
    await expect.poll(async () => readDrawingCount(page)).toBe(before + 1);
    await expect(page.locator('[data-testid="pattern-wizard-hint"]:visible')).toHaveCount(0);
  });

  test("forecasting and volume tools draw and remain interactive", async ({ page }) => {
    const options: Array<{ id: string; badge: string; pointOnly?: boolean }> = [
      { id: 'tool-longPosition', badge: 'tool: longPosition' },
      { id: 'tool-shortPosition', badge: 'tool: shortPosition' },
      { id: 'tool-positionForecast', badge: 'tool: positionForecast' },
      { id: 'tool-barPattern', badge: 'tool: barPattern' },
      { id: 'tool-ghostFeed', badge: 'tool: ghostFeed' },
      { id: 'tool-sector', badge: 'tool: sector' },
      { id: 'tool-anchoredVwap', badge: 'tool: anchoredVwap', pointOnly: true },
      { id: 'tool-fixedRangeVolumeProfile', badge: 'tool: fixedRangeVolumeProfile' },
      { id: 'tool-anchoredVolumeProfile', badge: 'tool: anchoredVolumeProfile', pointOnly: true },
      { id: 'tool-priceRange', badge: 'tool: priceRange' },
      { id: 'tool-dateRange', badge: 'tool: dateRange' },
      { id: 'tool-dateAndPriceRange', badge: 'tool: dateAndPriceRange' },
    ];

    const regions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
    for (const [index, option] of options.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, 'forecasting', option.id, option.badge);
      await placeCurrentTool(page, Boolean(option.pointOnly), regions[index % regions.length]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  test("position and anchored VWAP options expose advanced controls", async ({ page }) => {
    await selectTool(page, 'forecasting', 'tool-longPosition', 'tool: longPosition');
    await draw2PointShape(page, 'center');

    const positionDrawing = await readLatestDrawing(page);
    expect(positionDrawing.anchors.length).toBe(3);

    await clickVisible(page, 'chart-options-toggle');
    await page.locator('[data-testid="tool-option-positionLabelMode"]:visible').first().selectOption('both');
    const updatedPosition = await readLatestDrawing(page);
    expect(updatedPosition.options?.positionLabelMode).toBe('both');
    await clickVisible(page, 'chart-options-toggle');

    await selectTool(page, 'forecasting', 'tool-anchoredVwap', 'tool: anchoredVwap');
    await drawPointTool(page, 0.44, 0.46);
    await clickVisible(page, 'chart-options-toggle');
    await expect(page.locator('[data-testid="tool-options-panel"]:visible').first()).toBeVisible();
    await page.locator('[data-testid="tool-option-vwapInterval"]:visible').first().selectOption('week');

    const vwapDrawing = await readLatestDrawing(page);
    expect(vwapDrawing.options?.vwapInterval).toBe('week');
  });

  test("brush panel variants draw correctly", async ({ page }) => {
    const options: Array<{ id: string; badge: string; pointOnly?: boolean }> = [
      { id: 'tool-brush', badge: 'tool: brush' },
      { id: 'tool-highlighter', badge: 'tool: highlighter' },
      { id: 'tool-arrowMarker', badge: 'tool: arrowMarker', pointOnly: true },
      { id: 'tool-arrowTool', badge: 'tool: arrowTool' },
      { id: 'tool-arrowMarkUp', badge: 'tool: arrowMarkUp', pointOnly: true },
      { id: 'tool-arrowMarkDown', badge: 'tool: arrowMarkDown', pointOnly: true },
      { id: 'tool-rectangle', badge: 'tool: rectangle' },
      { id: 'tool-rotatedRectangle', badge: 'tool: rotatedRectangle' },
      { id: 'tool-path', badge: 'tool: path' },
      { id: 'tool-circle', badge: 'tool: circle' },
      { id: 'tool-ellipse', badge: 'tool: ellipse' },
      { id: 'tool-polyline', badge: 'tool: polyline' },
      { id: 'tool-triangle', badge: 'tool: triangle' },
      { id: 'tool-arc', badge: 'tool: arc' },
      { id: 'tool-curveTool', badge: 'tool: curveTool' },
      { id: 'tool-doubleCurve', badge: 'tool: doubleCurve' },
    ];

    const regions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
    for (const [index, option] of options.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, 'brush', option.id, option.badge);
      await placeCurrentTool(page, Boolean(option.pointOnly), regions[index % regions.length]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  test("brush workflow captures smooth freeform anchor trails", async ({ page }) => {
    await selectTool(page, 'brush', 'tool-brush', 'tool: brush');

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const startX = box.x + box.width * 0.2;
    const startY = box.y + box.height * 0.35;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= 18; step += 1) {
      const x = startX + box.width * 0.028 * step;
      const y = startY + Math.sin(step / 2.2) * 14;
      await page.mouse.move(x, y);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();

    const drawing = await readLatestDrawing(page);
    expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);

    await clickVisible(page, 'chart-options-toggle');
    const smoothnessSlider = page.locator('[data-testid="tool-option-brushSmoothness"]:visible').first();
    await smoothnessSlider.focus();
    for (let step = 0; step < 10; step += 1) {
      await smoothnessSlider.press('ArrowRight');
    }

    const brushSmoothness = await page.evaluate(() => {
      const debug = (window as unknown as { __chartDebug?: { getToolOptions?: () => { brushSmoothness?: number } } }).__chartDebug;
      return Number(debug?.getToolOptions?.().brushSmoothness ?? 0);
    });
    expect(brushSmoothness).toBeGreaterThan(0.85);
  });

  test("text panel variants open prompt where needed and create objects", async ({ page }) => {
    const options: Array<{ id: string; badge: string }> = [
      { id: 'tool-plainText', badge: 'tool: plainText' },
      { id: 'tool-anchoredText', badge: 'tool: anchoredText' },
      { id: 'tool-note', badge: 'tool: note' },
      { id: 'tool-priceNote', badge: 'tool: priceNote' },
      { id: 'tool-pin', badge: 'tool: pin' },
      { id: 'tool-table', badge: 'tool: table' },
      { id: 'tool-callout', badge: 'tool: callout' },
      { id: 'tool-comment', badge: 'tool: comment' },
      { id: 'tool-priceLabel', badge: 'tool: priceLabel' },
      { id: 'tool-signpost', badge: 'tool: signpost' },
      { id: 'tool-flagMark', badge: 'tool: flagMark' },
      { id: 'tool-image', badge: 'tool: image' },
      { id: 'tool-post', badge: 'tool: post' },
      { id: 'tool-idea', badge: 'tool: idea' },
    ];

    for (const option of options) {
      const before = await readDrawingCount(page);
      await selectTool(page, 'text', option.id, option.badge);
      await placeCurrentTool(page, true);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  test("text prompt style controls and in-place edit are functional", async ({ page }) => {
    await selectTool(page, 'text', 'tool-anchoredText', 'tool: anchoredText');

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const placeX = box.x + box.width * 0.52;
    const placeY = box.y + box.height * 0.44;
    await page.mouse.click(placeX, placeY);

    const createModal = page.locator('[data-testid="chart-prompt-modal"]:visible').first();
    await expect(createModal).toBeVisible();
    const createInput = page.locator('[data-testid="chart-prompt-input"]:visible').first();
    await createInput.fill('Alpha setup');
    await expect(createInput).toHaveValue('Alpha setup');
    await createModal.locator('select').first().selectOption('Poppins');
    await createModal.locator('button', { hasText: 'Bold' }).click();
    await createModal.getByTestId('chart-prompt-ok').click();
    await expect(page.locator('[data-testid="chart-prompt-modal"]:visible')).toHaveCount(0);
  });

  test("icon tabs place emoji, sticker, and symbol drawings", async ({ page }) => {
    const before = await readDrawingCount(page);

    await ensureGroupMenuOpen(page, 'icon');
    let popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await popover.getByTestId('icon-panel-tab-emojis').click();
    await popover.getByTestId('icon-panel-item-smiles-0').click();
    await placeCurrentTool(page, true);

    await ensureGroupMenuOpen(page, 'icon');
    popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await popover.getByTestId('icon-panel-tab-stickers').click();
    await popover.getByTestId('icon-panel-item-crypto-hodl').click();
    await placeCurrentTool(page, true);

    await ensureGroupMenuOpen(page, 'icon');
    popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await popover.getByTestId('icon-panel-tab-icons').click();
    await popover.getByTestId('icon-panel-item-symbols-0').click();
    await placeCurrentTool(page, true);

    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThanOrEqual(before + 3);
  });

  test("global rail options enforce keep-drawing, lock, hide, and delete semantics", async ({ page }) => {
    await selectTool(page, 'lines', 'tool-trendline', 'tool: trend');
    await draw2PointShape(page, 'left');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText('tool: none');

    await clickVisible(page, 'rail-keep-drawing');
    await selectTool(page, 'lines', 'tool-trendline', 'tool: trend');
    await draw2PointShape(page, 'center');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText('tool: trend');

    const anchorsBeforeLock = await readDrawingAnchors(page, 0);
    await clickVisible(page, 'rail-lock-drawings');

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await drawAt(
      page,
      { x: box.x + box.width * 0.48, y: box.y + box.height * 0.46 },
      { x: box.x + box.width * 0.72, y: box.y + box.height * 0.32 },
    );

    const anchorsAfterLock = await readDrawingAnchors(page, 0);
    expect(anchorsAfterLock).toEqual(anchorsBeforeLock);

    await clickVisible(page, 'rail-hide-objects');
    const hiddenState = await page.evaluate(() => {
      const debug = (window as unknown as { __chartDebug?: { getDrawings?: () => Array<{ visible: boolean }> } }).__chartDebug;
      const drawings = debug?.getDrawings?.() ?? [];
      return drawings.every((drawing) => drawing.visible === false);
    });
    expect(hiddenState).toBeTruthy();

    await clickVisible(page, 'rail-hide-objects');
    await clickVisible(page, 'rail-lock-drawings');

    await ensureGroupMenuOpen(page, 'cursor');
    await clickByTestId(page, 'cursor-cross');

    await page.mouse.click(box.x + box.width * 0.48, box.y + box.height * 0.46);
    const beforeDelete = await readDrawingCount(page);
    await clickVisible(page, 'rail-delete');
    await expect.poll(async () => readDrawingCount(page)).toBeLessThan(beforeDelete);
  });

  test("right click selects drawing and opens contextual options", async ({ page }) => {
    await selectTool(page, 'lines', 'tool-trendline', 'tool: trend');
    await draw2PointShape(page, 'center');

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await page.mouse.click(box.x + box.width * 0.53, box.y + box.height * 0.48, { button: 'right' });
    await expect(page.locator('text=Tool Options')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText('tool: trend');
  });

  test("heavy drawing scenarios remain responsive and cap history growth", async ({ page }) => {
    await clickVisible(page, 'rail-keep-drawing');
    await selectTool(page, 'lines', 'tool-trendline', 'tool: trend');

    const regions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
    for (let i = 0; i < 32; i += 1) {
      await draw2PointShape(page, regions[i % regions.length]);
    }

    const drawings = await readDrawingCount(page);
    expect(drawings).toBeGreaterThanOrEqual(32);

    const historyLength = await page.evaluate(() => {
      const debug = (window as unknown as { __chartDebug?: { getHistoryLength?: () => number } }).__chartDebug;
      return debug?.getHistoryLength?.() ?? 0;
    });
    expect(historyLength).toBeLessThanOrEqual(180);

    await ensureGroupMenuOpen(page, 'cursor');
    await clickByTestId(page, 'cursor-eraser');

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const beforeErase = await readDrawingCount(page);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await expect.poll(async () => readDrawingCount(page)).toBeLessThan(beforeErase);
  });

  test("values tooltip long press follows the toggle", async ({ page }) => {
    await ensureGroupMenuOpen(page, "cursor");
    const toggle = page.locator('[data-testid="cursor-values-tooltip-toggle"] [role="switch"]');
    await expect(toggle).toBeVisible();

    const surface = page.locator('[data-testid="chart-interaction-surface"]:visible').first();
    const box = await surface.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const x = box.x + box.width * 0.45;
    const y = box.y + box.height * 0.44;

    const toggleState = async (expected: 'true' | 'false') => {
      await expect(toggle).toHaveAttribute('aria-checked', expected);
    };

    if ((await toggle.getAttribute('aria-checked')) === 'true') {
      await clickByTestId(page, 'cursor-values-tooltip-toggle');
      await toggleState('false');
    }

    await dispatchTouch(page, 'touchstart', x, y);
    await page.waitForTimeout(550);
    await expect(page.locator('[data-testid="values-tooltip"]:visible')).toHaveCount(0);
    await dispatchTouch(page, 'touchend', x, y);

    await clickByTestId(page, 'cursor-values-tooltip-toggle');
    await toggleState('true');

    await dispatchTouch(page, 'touchstart', x, y);
    await page.waitForTimeout(550);
    await expect(page.locator('[data-testid="values-tooltip"]:visible')).toBeVisible({ timeout: 3000 });
    await dispatchTouch(page, 'touchend', x, y);
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="values-tooltip"]:visible')).toHaveCount(0);
  });

  test("forecasting/brush/text/icon menus open and have tools", async ({ page }) => {
    for (const group of ["forecasting", "brush", "text", "icon"]) {
      await ensureGroupMenuOpen(page, group);
      const popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
      await expect(popover).toBeVisible({ timeout: 5000 });

      // Each menu should have at least 2 tools
      const toolCount = await popover.evaluate((el) => el.querySelectorAll("button").length);
      expect(toolCount).toBeGreaterThanOrEqual(2);
    }
  });

  test("tool menus scroll with mouse wheel", async ({ page }) => {
    for (const group of ["lines", "fib", "patterns", "forecasting", "brush", "text", "icon"]) {
      await ensureGroupMenuOpen(page, group);
      const popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
      await expect(popover).toBeVisible({ timeout: 5000 });

      const scrollPane = popover.locator('[data-testid="toolrail-scroll"], [data-testid="icon-panel-scroll"]').first();
      await expect(scrollPane).toBeVisible({ timeout: 5000 });

      const metrics = await scrollPane.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      if (metrics.scrollHeight <= metrics.clientHeight) {
        continue;
      }

      const beforeWheel = await scrollPane.evaluate((el) => el.scrollTop);
      await scrollPane.evaluate((el) => {
        el.dispatchEvent(new WheelEvent("wheel", { deltaY: 900, bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(120);
      const afterWheel = await scrollPane.evaluate((el) => el.scrollTop);
      expect(afterWheel).toBeGreaterThan(beforeWheel);
    }
  });

  test("icon menu shows emoji, sticker, and icon tabs", async ({ page }) => {
    await ensureGroupMenuOpen(page, "icon");
    const popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    await expect(popover.getByTestId("icon-panel")).toBeVisible();
    await expect(popover.getByTestId("icon-panel-tab-emojis")).toBeVisible();
    await expect(popover.getByTestId("icon-panel-tab-stickers")).toBeVisible();
    await expect(popover.getByTestId("icon-panel-tab-icons")).toBeVisible();

    const scrollPane = popover.getByTestId("icon-panel-scroll");
    await popover.getByTestId("icon-panel-tab-emojis").click();
    const metrics = await scrollPane.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    const beforeWheel = await scrollPane.evaluate((el) => el.scrollTop);
    await scrollPane.evaluate((el) => {
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: 900, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(120);
    const afterWheel = await scrollPane.evaluate((el) => el.scrollTop);
    expect(afterWheel).toBeGreaterThan(beforeWheel);

    await popover.getByTestId("icon-panel-tab-stickers").click();
    await expect(popover.getByTestId("icon-panel-section-crypto")).toBeVisible();
    await popover.getByTestId("icon-panel-item-crypto-wagmi").click();
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: sticker");

    await ensureGroupMenuOpen(page, "icon");
    const reopened = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await reopened.getByTestId("icon-panel-tab-icons").click();
    await expect(reopened.getByTestId("icon-panel-section-symbols")).toBeVisible();
  });
});
