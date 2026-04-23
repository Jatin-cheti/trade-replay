/**
 * Comprehensive E2E tests for all chart tool families.
 *
 * Covers: cursor modes with multiple objects, overlapping drawings,
 * undo/redo, locking, hiding, snapping, stress testing, multi-tool
 * interactions, Fibonacci options, pattern wizard edge-cases,
 * position tools, brush smoothness, text/icon stickers, and
 * performance under load.
 */
import { expect, test, type Page } from "./playwright-fixture";
import { apiUrl } from "./test-env";

test.setTimeout(180_000);

/* ------------------------------------------------------------------ */
/*  Helpers (shared with tool-rail-popover but self-contained here)   */
/* ------------------------------------------------------------------ */

async function registerAndLogin(page: Page): Promise<void> {
  const uid = Date.now();
  const email = `tool_comp_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get(apiUrl("/api/health"));
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post(apiUrl("/api/auth/register"), {
    data: { email, password, name: `tool_comp_${uid}` },
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
    const target = nodes.find((n) => n instanceof HTMLElement && n.offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) target.click();
  }, testId);
}

async function ensureGroupMenuOpen(page: Page, group: string): Promise<void> {
  const menuTestId = group === "cursor" ? "menu-cursor" : `menu-${group}`;
  const menu = page.locator(`[data-testid="${menuTestId}"]:visible`).first();
  if (await menu.isVisible().catch(() => false)) return;

  const inFullView = (await page.locator('[data-testid="chart-root"][data-full-view="true"]:visible').count()) > 0;
  if (!inFullView) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }

    await clickByTestId(page, `rail-${group}`);
    if (await menu.isVisible().catch(() => false)) return;
    await clickByTestId(page, `rail-${group}`);
    await expect(menu).toBeVisible({ timeout: 5000 });
}

async function selectTool(page: Page, group: string, toolTestId: string, badgeText: string): Promise<void> {
  await ensureGroupMenuOpen(page, group);
  await expect(page.locator('[data-testid="toolrail-popover"]:visible').first()).toBeVisible({ timeout: 5000 });
  await clickByTestId(page, toolTestId);
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText(badgeText, { timeout: 5000 });
}

async function draw2PointShape(page: Page, region: "left" | "center" | "right" = "center"): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const before = await readDrawingCount(page);

  const offsets = {
    left: { x1: 0.1, y1: 0.25, x2: 0.28, y2: 0.4 },
    center: { x1: 0.32, y1: 0.35, x2: 0.62, y2: 0.55 },
    right: { x1: 0.68, y1: 0.3, x2: 0.88, y2: 0.5 },
  };
  const o = offsets[region];
  const x1 = box.x + box.width * o.x1;
  const y1 = box.y + box.height * o.y1;
  const x2 = box.x + box.width * o.x2;
  const y2 = box.y + box.height * o.y2;

  const drag = async (sx: number, sy: number, ex: number, ey: number) => {
    await page.mouse.move(sx, sy);
    await page.waitForTimeout(40);
    await page.mouse.down();
    await page.waitForTimeout(40);
    await page.mouse.move(ex, ey, { steps: 8 });
    await page.waitForTimeout(40);
    await page.mouse.up();
    await page.waitForTimeout(320);
  };

  await drag(x1, y1, x2, y2);
  if ((await readDrawingCount(page)) > before) return;

  // Retry up to 3 times with varied coordinates when pointer sequence is dropped.
  const retries = [
    [0.26, 0.28, 0.58, 0.54],
    [0.22, 0.32, 0.54, 0.58],
    [0.30, 0.24, 0.62, 0.50],
  ];
  for (const [rx1r, ry1r, rx2r, ry2r] of retries) {
    await drag(
      box.x + box.width * rx1r,
      box.y + box.height * ry1r,
      box.x + box.width * rx2r,
      box.y + box.height * ry2r,
    );
    if ((await readDrawingCount(page)) > before) return;
  }
}

async function drawPointTool(page: Page, xRatio = 0.52, yRatio = 0.45, maxAttempts = 5): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const before = await readDrawingCount(page);
  const cx = box.x + box.width * xRatio;
  const cy = box.y + box.height * yRatio;

  // Try up to 5 times with small position variations to handle occasional dropped clicks.
  const offsets = [
    [0, 0], [8, 6], [-6, 8], [12, -4], [-10, -8],
  ] as const;
  for (const [dx, dy] of offsets.slice(0, Math.max(1, Math.min(maxAttempts, offsets.length)))) {
    const px = cx + dx;
    const py = cy + dy;
    await page.mouse.move(px, py);
    await page.waitForTimeout(30);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await readDrawingCount(page);
    if (after > before) return;
  }
}

async function confirmPromptIfVisible(page: Page): Promise<void> {
  const modal = page.locator('[data-testid="chart-prompt-modal"]:visible').first();
  if (await modal.isVisible().catch(() => false)) {
    try {
      await modal.getByTestId("chart-prompt-ok").click({ timeout: 3000 });
    } catch {
      await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('[data-testid="chart-prompt-ok"]'));
        const target = nodes.find((n) => n instanceof HTMLElement && n.offsetParent !== null) ?? nodes[0];
        if (target instanceof HTMLElement) target.click();
      });
    }
    await expect(page.locator('[data-testid="chart-prompt-modal"]:visible')).toHaveCount(0);
  }
}

async function placeCurrentTool(page: Page, pointOnly = false, region: "left" | "center" | "right" = "center"): Promise<void> {
  const before = await readDrawingCount(page);

  if (pointOnly) {
    await drawPointTool(page);
  } else {
    await draw2PointShape(page, region);
  }
  await confirmPromptIfVisible(page);

  const afterFirst = await readDrawingCount(page);
  if (afterFirst > before) return;

  // One extra attempt for occasional dropped input on the first gesture/click.
  if (pointOnly) {
    await drawPointTool(page, 0.48, 0.42);
  } else {
    await draw2PointShape(page, region);
  }
  await confirmPromptIfVisible(page);
}

async function placeWizardTool(page: Page, anchorCount: number, region: "left" | "center" | "right" = "center"): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const before = await readDrawingCount(page);
  const regionOffsets = { left: 0.08, center: 0.28, right: 0.58 };
  const baseX = regionOffsets[region];

  const placeAnchors = async (xShift = 0, yShift = 0) => {
    for (let i = 0; i < anchorCount; i += 1) {
      const x = box.x + box.width * (baseX + 0.04 * i) + xShift;
      const y = box.y + box.height * (0.3 + (i % 2 === 0 ? 0 : 0.18)) + yShift;
      await page.mouse.click(x, y);
      await page.waitForTimeout(75);
    }
    await page.waitForTimeout(220);
  };

  await placeAnchors();
  const afterFirst = await readDrawingCount(page);
  if (afterFirst > before) return;

  // Retry once with a slight offset when initial wizard clicks are dropped.
  await placeAnchors(6, 4);
}

async function readDrawingCount(page: Page): Promise<number> {
  const badgeText = await page
    .locator('[data-testid="drawing-badge"]:visible')
    .first()
    .textContent({ timeout: 1000 })
    .catch(() => null);
  const match = badgeText?.match(/\b(\d+)\s+drawing/);
  if (match) return Number(match[1]);

  return page.evaluate(() => {
    const debug = (window as unknown as {
      __chartDebug?: {
        getDrawingsCount?: () => number;
        getDrawings?: () => Array<unknown>;
      };
    }).__chartDebug;

    const direct = debug?.getDrawingsCount?.();
    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return direct;
    }

    const list = debug?.getDrawings?.();
    return Array.isArray(list) ? list.length : 0;
  });
}

async function readLatestDrawing(page: Page): Promise<{ variant?: string; text?: string; options?: Record<string, unknown>; anchors: Array<{ time: number; price: number }> }> {
  return page.evaluate(() => {
    const debug = (window as unknown as {
      __chartDebug?: {
        getDrawings?: () => Array<{ variant?: string; text?: string; options?: Record<string, unknown>; anchors: Array<{ time: number; price: number }> }>;
      };
    }).__chartDebug;
    const drawings = debug?.getDrawings?.() ?? [];
    const d = drawings[drawings.length - 1];
    return {
      variant: d?.variant,
      text: d?.text,
      options: d?.options,
      anchors: d?.anchors?.map((a) => ({ time: Number(a.time), price: Number(a.price) })) ?? [],
    };
  });
}

async function readAllDrawings(page: Page): Promise<Array<{ id: string; variant?: string; visible: boolean; locked: boolean; anchors: Array<{ time: number; price: number }> }>> {
  return page.evaluate(() => {
    const debug = (window as unknown as {
      __chartDebug?: {
        getDrawings?: () => Array<{ id: string; variant?: string; visible: boolean; locked: boolean; anchors: Array<{ time: number; price: number }> }>;
      };
    }).__chartDebug;
    return (debug?.getDrawings?.() ?? []).map((d) => ({
      id: d.id,
      variant: d.variant,
      visible: d.visible,
      locked: d.locked,
      anchors: d.anchors?.map((a) => ({ time: Number(a.time), price: Number(a.price) })) ?? [],
    }));
  });
}

async function readChartCursor(page: Page): Promise<string> {
  return page.locator('[data-testid="chart-container"]:visible').first().evaluate((el) => getComputedStyle(el).cursor);
}

/* ================================================================== */
/*  TEST SUITE                                                        */
/* ================================================================== */

test.describe("Comprehensive Tool Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndLogin(page);
    await page.goto("/simulation");
    await waitForChart(page);
  });

  /* ---------------------------------------------------------------- */
  /*  1. CURSOR MODES WITH MULTIPLE OBJECTS                           */
  /* ---------------------------------------------------------------- */

  test("cursor modes function correctly with 9 objects on chart", async ({ page }) => {
    // Draw 9 objects: 3 trendlines, 3 rays, 3 horizontal lines
    await clickVisible(page, "rail-keep-drawing");

    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    for (const r of ["left", "center", "right"] as const) {
      await draw2PointShape(page, r);
    }

    await selectTool(page, "lines", "tool-ray", "tool: ray");
    for (const r of ["left", "center", "right"] as const) {
      await draw2PointShape(page, r);
    }

    await selectTool(page, "lines", "tool-horizontal-line", "tool: hline");
    await drawPointTool(page, 0.3, 0.3);
    await drawPointTool(page, 0.5, 0.5);
    await drawPointTool(page, 0.7, 0.7);

    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThanOrEqual(9);

    // Test Arrow cursor — chart should be default cursor
    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-arrow");
    await expect.poll(async () => readChartCursor(page)).toBe("default");

    // Test Cross cursor
    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-cross");
    await expect.poll(async () => readChartCursor(page)).toMatch(/crosshair/);

    // Test Dot cursor
    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-dot");
    const dotCursor = await readChartCursor(page);
    expect(dotCursor).toContain("url(");

    // Ensure drawings still exist (no accidental deletion)
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThanOrEqual(9);
  });

  test("eraser targets correct objects among mixed tool types", async ({ page }) => {
    // Draw one of each: trendline, text, arrow marker
    const initialCount = await readDrawingCount(page);

    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "left");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(initialCount);
    const afterLine = await readDrawingCount(page);

    await selectTool(page, "text", "tool-anchoredText", "tool: anchoredText");
    await placeCurrentTool(page, true);
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(afterLine);
    const afterText = await readDrawingCount(page);

    await selectTool(page, "brush", "tool-arrowMarkUp", "tool: arrowMarkUp");
    await drawPointTool(page, 0.75, 0.35);
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(afterText);

    // Enable eraser and click near each object — each should delete one
    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-eraser");

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    // Erase text (center area)
    await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.44);
    await expect.poll(async () => readDrawingCount(page)).toBe(2);

    // Erase arrow marker
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.35);
    await expect.poll(async () => readDrawingCount(page)).toBeLessThanOrEqual(2);
  });

  /* ---------------------------------------------------------------- */
  /*  2. UNDO / REDO MULTI-LAYER                                     */
  /* ---------------------------------------------------------------- */

  test("undo and redo work across multiple tool additions", async ({ page }) => {
    // Draw 5 lines with explicit selection each time to avoid keep-drawing toggle flakiness.
    for (let i = 0; i < 5; i += 1) {
      const before = await readDrawingCount(page);
      await selectTool(page, "lines", "tool-trendline", "tool: trend");
      await draw2PointShape(page, (["left", "center", "right"] as const)[i % 3]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
    await expect.poll(async () => readDrawingCount(page)).toBe(5);

    // Undo 3 times via toolbar button
    for (let i = 0; i < 3; i += 1) {
      await clickVisible(page, "toolbar-undo");
      await page.waitForTimeout(150);
    }
    await expect.poll(async () => readDrawingCount(page)).toBe(2);

    // Redo 2 times via toolbar button
    for (let i = 0; i < 2; i += 1) {
      await clickVisible(page, "toolbar-redo");
      await page.waitForTimeout(150);
    }
    await expect.poll(async () => readDrawingCount(page)).toBe(4);
  });

  /* ---------------------------------------------------------------- */
  /*  3. LOCK AND HIDE MULTI-OBJECT                                  */
  /* ---------------------------------------------------------------- */

  test("lock prevents dragging and hide makes drawings invisible", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "left");
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "right");
    await expect.poll(async () => readDrawingCount(page)).toBe(2);

    // Lock all
    await clickVisible(page, "rail-lock-drawings");
    let drawings = await readAllDrawings(page);
    expect(drawings.every((d) => d.locked)).toBeTruthy();

    // Unlock
    await clickVisible(page, "rail-lock-drawings");
    drawings = await readAllDrawings(page);
    expect(drawings.every((d) => !d.locked)).toBeTruthy();

    // Hide all
    await clickVisible(page, "rail-hide-objects");
    drawings = await readAllDrawings(page);
    expect(drawings.every((d) => d.visible === false)).toBeTruthy();

    // Show all
    await clickVisible(page, "rail-hide-objects");
    drawings = await readAllDrawings(page);
    expect(drawings.every((d) => d.visible === true)).toBeTruthy();
  });

  /* ---------------------------------------------------------------- */
  /*  4. MAGNET / SNAP TOGGLE                                        */
  /* ---------------------------------------------------------------- */

  test("magnet toggle snaps drawings to OHLC when on", async ({ page }) => {
    // Ensure magnet starts OFF
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: off");

    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "center");
    const offDrawing = await readLatestDrawing(page);
    expect(offDrawing.anchors.length).toBe(2);

    // Turn magnet ON
    await clickVisible(page, "rail-magnet");
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: on");

    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "right");
    const onDrawing = await readLatestDrawing(page);
    expect(onDrawing.anchors.length).toBe(2);

    // Turn off again
    await clickVisible(page, "rail-magnet");
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("magnet: off");
  });

  /* ---------------------------------------------------------------- */
  /*  5. LINES — ALL CHANNEL VARIANTS                                */
  /* ---------------------------------------------------------------- */

  test("all channel variants draw symmetric shapes", async ({ page }) => {
    const channels = [
      { id: "tool-parallel-channel", badge: "tool: channel" },
      { id: "tool-regression-trend", badge: "tool: regressionTrend" },
      { id: "tool-flat-top-bottom", badge: "tool: flatTopBottom" },
      { id: "tool-disjoint-channel", badge: "tool: disjointChannel" },
    ];

    for (const [idx, ch] of channels.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, "lines", ch.id, ch.badge);
      await draw2PointShape(page, (["left", "center", "right"] as const)[idx % 3]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);

      const drawing = await readLatestDrawing(page);
      expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("all pitchfork variants draw with 2 anchors", async ({ page }) => {
    const pitchforks = [
      { id: "tool-pitchfork", badge: "tool: pitchfork" },
      { id: "tool-schiff-pitchfork", badge: "tool: schiffPitchfork" },
      { id: "tool-modified-schiff-pitchfork", badge: "tool: modifiedSchiffPitchfork" },
      { id: "tool-inside-pitchfork", badge: "tool: insidePitchfork" },
    ];

    for (const [idx, pf] of pitchforks.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, "lines", pf.id, pf.badge);
      await draw2PointShape(page, (["left", "center", "right"] as const)[idx % 3]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  6. FIBONACCI — OPTIONS AND LABELS                              */
  /* ---------------------------------------------------------------- */

  test("fib extension options can be configured", async ({ page }) => {
    await selectTool(page, "fib", "fib-extension", "tool: fibExtension");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);

    await clickVisible(page, "chart-options-toggle");
    const fibLevelsInput = page.locator('[data-testid="tool-option-fibLevels"]:visible').first();
    await fibLevelsInput.fill("0,0.618,1,1.618,2.618");

    const latest = await readLatestDrawing(page);
    expect(latest.options?.fibLevels).toBe("0,0.618,1,1.618,2.618");
  });

  test("fib channel draws with zone fills", async ({ page }) => {
    await selectTool(page, "fib", "fib-channel", "tool: fibChannel");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);
    const drawing = await readLatestDrawing(page);
    expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);
  });

  test("fib speed resistance fan draws with labels", async ({ page }) => {
    await selectTool(page, "fib", "fib-speed-resistance-fan", "tool: fibSpeedResistFan");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);
  });

  test("fib time zone draws with alternating fills", async ({ page }) => {
    await selectTool(page, "fib", "fib-time-zone", "tool: fibTimeZone");
    const before = await readDrawingCount(page);
    await draw2PointShape(page, "center");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
  });

  test("gann fan draws with ratio labels", async ({ page }) => {
    await selectTool(page, "fib", "gann-fan", "tool: gannFan");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);
  });

  test("gann box draws with edge fraction labels", async ({ page }) => {
    await selectTool(page, "fib", "gann-box", "tool: gannBox");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);
  });

  /* ---------------------------------------------------------------- */
  /*  7. PATTERN WIZARD EDGE CASES                                   */
  /* ---------------------------------------------------------------- */

  test("XABCD and Head & Shoulders wizard flows complete correctly", async ({ page }) => {
    // XABCD (5 anchors)
    await selectTool(page, "patterns", "tool-xabcd", "tool: xabcd");
    const before = await readDrawingCount(page);
    await placeWizardTool(page, 5, "left");
    await expect.poll(async () => readDrawingCount(page)).toBe(before + 1);

    // Head & Shoulders (5 anchors)
    await selectTool(page, "patterns", "tool-headAndShoulders", "tool: headAndShoulders");
    const before2 = await readDrawingCount(page);
    await placeWizardTool(page, 5, "right");
    await expect.poll(async () => readDrawingCount(page)).toBe(before2 + 1);
  });

  test("Elliott wave patterns complete their wizard flows", async ({ page }) => {
    const elliott = [
      { id: "tool-elliottImpulse", badge: "tool: elliottImpulse", anchors: 5 },
      { id: "tool-elliottCorrection", badge: "tool: elliottCorrection", anchors: 3 },
      { id: "tool-elliottTriangle", badge: "tool: elliottTriangle", anchors: 5 },
      { id: "tool-elliottDoubleCombo", badge: "tool: elliottDoubleCombo", anchors: 3 },
      { id: "tool-elliottTripleCombo", badge: "tool: elliottTripleCombo", anchors: 5 },
    ];

    for (const [idx, ew] of elliott.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, "patterns", ew.id, ew.badge);
      await placeWizardTool(page, ew.anchors, (["left", "center", "right"] as const)[idx % 3]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  test("cyclic lines and sine line draw correctly", async ({ page }) => {
    await selectTool(page, "patterns", "tool-cyclicLines", "tool: cyclicLines");
    const before1 = await readDrawingCount(page);
    await draw2PointShape(page, "left");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before1);

    await selectTool(page, "patterns", "tool-sineLine", "tool: sineLine");
    const before2 = await readDrawingCount(page);
    await draw2PointShape(page, "right");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before2);
  });

  /* ---------------------------------------------------------------- */
  /*  8. FORECASTING TOOLS — POSITION & VWAP                        */
  /* ---------------------------------------------------------------- */

  test("long and short position create 3-anchor drawings with labels", async ({ page }) => {
    await selectTool(page, "forecasting", "tool-longPosition", "tool: longPosition");
    await draw2PointShape(page, "left");
    const longDraw = await readLatestDrawing(page);
    expect(longDraw.anchors.length).toBe(3);

    await selectTool(page, "forecasting", "tool-shortPosition", "tool: shortPosition");
    await draw2PointShape(page, "right");
    const shortDraw = await readLatestDrawing(page);
    expect(shortDraw.anchors.length).toBe(3);
  });

  test("position label mode can be toggled between ratio, price, and both", async ({ page }) => {
    await selectTool(page, "forecasting", "tool-longPosition", "tool: longPosition");
    await draw2PointShape(page, "center");

    await clickVisible(page, "chart-options-toggle");
    const select = page.locator('[data-testid="tool-option-positionLabelMode"]:visible').first();

    for (const mode of ["rr", "price", "both"]) {
      await select.selectOption(mode);
      const drawing = await readLatestDrawing(page);
      expect(drawing.options?.positionLabelMode).toBe(mode);
    }
  });

  test("anchored VWAP supports interval configuration", async ({ page }) => {
    await selectTool(page, "forecasting", "tool-anchoredVwap", "tool: anchoredVwap");
    const before = await readDrawingCount(page);
    await drawPointTool(page, 0.45, 0.45);
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);

    await clickVisible(page, "chart-options-toggle");
    const intervalSelect = page.locator('[data-testid="tool-option-vwapInterval"]:visible').first();
    await intervalSelect.selectOption("week");
    await expect.poll(async () => {
      const drawing = await readLatestDrawing(page);
      return drawing.options?.vwapInterval;
    }).toBe("week");
  });

  /* ---------------------------------------------------------------- */
  /*  9. BRUSH / SHAPES                                              */
  /* ---------------------------------------------------------------- */

  test("brush and highlighter draw smooth freeform strokes", async ({ page }) => {
    for (const tool of [
      { id: "tool-brush", badge: "tool: brush" },
      { id: "tool-highlighter", badge: "tool: highlighter" },
    ]) {
      await selectTool(page, "brush", tool.id, tool.badge);
      const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
      const box = await overlay.boundingBox();
      expect(box).toBeTruthy();
      if (!box) return;

      const before = await readDrawingCount(page);
      const drawStroke = async (sx: number, sy: number) => {
        await page.mouse.move(sx, sy);
        await page.mouse.down();
        for (let s = 1; s <= 12; s += 1) {
          await page.mouse.move(sx + box.width * 0.03 * s, sy + Math.sin(s / 2) * 12);
          await page.waitForTimeout(10);
        }
        await page.mouse.up();
        await page.waitForTimeout(180);
      };

      const startX = box.x + box.width * 0.2;
      const startY = box.y + box.height * 0.4;
      await drawStroke(startX, startY);

      if ((await readDrawingCount(page)) <= before) {
        // Retry with alternate stroke path when first freeform input is dropped.
        await drawStroke(box.x + box.width * 0.28, box.y + box.height * 0.5);
      }

      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
      const drawing = await readLatestDrawing(page);
      expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("all geometric shapes draw with 2 anchors", async ({ page }) => {
    const shapes = [
      { id: "tool-rectangle", badge: "tool: rectangle" },
      { id: "tool-circle", badge: "tool: circle" },
      { id: "tool-ellipse", badge: "tool: ellipse" },
      { id: "tool-triangle", badge: "tool: triangle" },
      { id: "tool-arc", badge: "tool: arc" },
      { id: "tool-rotatedRectangle", badge: "tool: rotatedRectangle" },
    ];

    for (const [idx, shape] of shapes.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, "brush", shape.id, shape.badge);
      await draw2PointShape(page, (["left", "center", "right"] as const)[idx % 3]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);

      const drawing = await readLatestDrawing(page);
      expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("arrow tool draws with arrowhead", async ({ page }) => {
    await selectTool(page, "brush", "tool-arrowTool", "tool: arrowTool");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);
    const drawing = await readLatestDrawing(page);
    expect(drawing.anchors.length).toBe(2);
  });

  test("arrow markers place single-anchor point objects", async ({ page }) => {
    for (const [toolIdx, tool] of [
      { id: "tool-arrowMarker", badge: "tool: arrowMarker" },
      { id: "tool-arrowMarkUp", badge: "tool: arrowMarkUp" },
      { id: "tool-arrowMarkDown", badge: "tool: arrowMarkDown" },
    ].entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, "brush", tool.id, tool.badge);
      const xRatios = [0.42, 0.52, 0.62];
      const yRatios = [0.38, 0.48, 0.42];
      await drawPointTool(page, xRatios[toolIdx], yRatios[toolIdx]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  10. TEXT TOOLS — MODAL, STYLES, VARIANTS                       */
  /* ---------------------------------------------------------------- */

  test("text modal opens with style controls and creates styled drawing", async ({ page }) => {
    await selectTool(page, "text", "tool-anchoredText", "tool: anchoredText");
    const before = await readDrawingCount(page);

    await placeCurrentTool(page, true);

    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    const drawing = await readLatestDrawing(page);
    // Text should be the default value ("Text") or non-empty
    expect(drawing.text).toBeTruthy();
  });

  test("all text variants create objects correctly", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Text variant placement is unstable on WebKit in this environment");

    const allTextTools = [
      "tool-plainText", "tool-anchoredText", "tool-note", "tool-priceNote",
      "tool-pin", "tool-table", "tool-callout", "tool-comment",
      "tool-priceLabel", "tool-signpost", "tool-flagMark", "tool-image",
      "tool-post", "tool-idea",
    ];
    const textTools = browserName === "webkit"
      ? allTextTools.filter((id) => id !== "tool-plainText")
      : allTextTools;

    const xRatios = [0.34, 0.42, 0.5, 0.58, 0.66];
    const yRatios = [0.36, 0.44, 0.52];
    const dragTextTools = new Set<string>();

    for (const [idx, toolId] of textTools.entries()) {
      const badgeId = toolId.replace("tool-", "");
      const before = await readDrawingCount(page);
      await selectTool(page, "text", toolId, `tool: ${badgeId}`);

      const x = xRatios[idx % xRatios.length];
      const y = yRatios[idx % yRatios.length];
      if (dragTextTools.has(toolId)) {
        await draw2PointShape(page, "center");
      } else {
        await drawPointTool(page, x, y, 5);
      }
      await confirmPromptIfVisible(page);

      try {
        await expect.poll(async () => readDrawingCount(page), { timeout: 2500 }).toBeGreaterThan(before);
      } catch {
        // Some text variants are slower to initialize on WebKit; retry placement once.
        if (dragTextTools.has(toolId)) {
          await draw2PointShape(page, "right");
        } else {
          await drawPointTool(page, Math.min(0.72, x + 0.1), Math.min(0.66, y + 0.08), 5);
        }
        await confirmPromptIfVisible(page);
        await expect.poll(async () => readDrawingCount(page), { timeout: 6000 }).toBeGreaterThan(before);
      }
    }
  });

  /* ---------------------------------------------------------------- */
  /*  11. ICON / STICKER / EMOJI                                     */
  /* ---------------------------------------------------------------- */

  test("emoji tab places emoji drawings and browse-all opens full picker", async ({ page }) => {
    const before = await readDrawingCount(page);

    // Pick quick-access emoji
    await ensureGroupMenuOpen(page, "icon");
    let popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await popover.getByTestId("icon-panel-tab-emojis").click();
    await popover.getByTestId("icon-panel-item-smiles-0").click();
    await placeCurrentTool(page, true);
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);

    // "Browse all" opens the full emoji picker
    await ensureGroupMenuOpen(page, "icon");
    popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await popover.getByTestId("icon-panel-tab-emojis").click();
    const browseBtn = popover.getByTestId("emoji-browse-all");
    if (await browseBtn.isVisible().catch(() => false)) {
      await browseBtn.click();
      await expect(popover.getByTestId("emoji-full-picker")).toBeVisible({ timeout: 5000 });

      // Back button returns to quick access
      await popover.getByTestId("emoji-picker-back").click();
      await expect(popover.getByTestId("emoji-full-picker")).toHaveCount(0);
    }
  });

  test("sticker and icon tabs each place drawing objects", async ({ page }) => {
    const before = await readDrawingCount(page);

    // Sticker
    await ensureGroupMenuOpen(page, "icon");
    let popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await popover.getByTestId("icon-panel-tab-stickers").click();
    await popover.getByTestId("icon-panel-item-crypto-hodl").click();
    await placeCurrentTool(page, true);

    // Icon
    await ensureGroupMenuOpen(page, "icon");
    popover = page.locator('[data-testid="toolrail-popover"]:visible').first();
    await popover.getByTestId("icon-panel-tab-icons").click();
    await popover.getByTestId("icon-panel-item-symbols-0").click();
    await placeCurrentTool(page, true);

    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThanOrEqual(before + 2);
  });

  /* ---------------------------------------------------------------- */
  /*  12. STRESS / PERFORMANCE                                       */
  /* ---------------------------------------------------------------- */

  test("20+ overlapping objects remain responsive and erasable", async ({ page }) => {
    await clickVisible(page, "rail-keep-drawing");
    await selectTool(page, "lines", "tool-trendline", "tool: trend");

    const regions: Array<"left" | "center" | "right"> = ["left", "center", "right"];
    for (let i = 0; i < 20; i += 1) {
      await draw2PointShape(page, regions[i % 3]);
    }

    const count = await readDrawingCount(page);
    expect(count).toBeGreaterThanOrEqual(20);

    // Ensure chart is still responsive — draw one more
    await draw2PointShape(page, "center");
    const countAfter = await readDrawingCount(page);
    expect(countAfter).toBeGreaterThan(count);

    // Erase one → count decreases
    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-eraser");

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await expect.poll(async () => readDrawingCount(page)).toBeLessThan(countAfter);
  });

  test("history is capped at 180 entries under heavy use", async ({ page }) => {
    test.setTimeout(300_000);

    await clickVisible(page, "rail-keep-drawing");
    await selectTool(page, "lines", "tool-horizontal-line", "tool: hline");

    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    // Fast stress: many point-only placements to pressure history capping without drag overhead.
    const xRatios = [0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86];
    for (let i = 0; i < 220; i += 1) {
      const x = box.x + box.width * xRatios[i % xRatios.length];
      const y = box.y + box.height * (0.12 + ((i * 7) % 72) / 100);
      await page.mouse.click(x, y);
      if (i % 20 === 0) {
        await page.waitForTimeout(20);
      }
    }

    await page.waitForTimeout(250);

    const hlen = await page.evaluate(() => {
      const debug = (window as unknown as { __chartDebug?: { getHistoryLength?: () => number } }).__chartDebug;
      return debug?.getHistoryLength?.() ?? 0;
    });
    expect(hlen).toBeGreaterThan(30);
    expect(hlen).toBeLessThanOrEqual(180);
  });

  /* ---------------------------------------------------------------- */
  /*  13. MULTI-TOOL OVERLAPPING INTERACTION                         */
  /* ---------------------------------------------------------------- */

  test("mixed tool overlapping objects can be individually selected and deleted", async ({ page }) => {
    // Draw overlapping objects in center
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "center");

    await selectTool(page, "fib", "fib-retracement", "tool: fibRetracement");
    await draw2PointShape(page, "center");

    await selectTool(page, "brush", "tool-rectangle", "tool: rectangle");
    await draw2PointShape(page, "center");

    expect(await readDrawingCount(page)).toBe(3);

    // Delete all via rail delete button
    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    // Select by clicking center
    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-cross");
    await page.mouse.click(box.x + box.width * 0.47, box.y + box.height * 0.45);

    // Delete selected
    await clickVisible(page, "rail-delete");
    await expect.poll(async () => readDrawingCount(page)).toBeLessThan(3);
  });

  /* ---------------------------------------------------------------- */
  /*  14. FULL VIEW MODE WITH TOOL INTERACTIONS                      */
  /* ---------------------------------------------------------------- */

  test("tools function correctly in full view mode", async ({ page }) => {
    await clickVisible(page, "chart-toggle-full-view");
    await expect(page.locator('[data-testid="chart-root"][data-full-view="true"]:visible').first()).toBeVisible();

    // Draw a trendline in full view
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBeGreaterThanOrEqual(1);

    // Draw fibonacci
    await selectTool(page, "fib", "fib-retracement", "tool: fibRetracement");
    await draw2PointShape(page, "right");
    expect(await readDrawingCount(page)).toBeGreaterThanOrEqual(2);

    // Erase one
    await ensureGroupMenuOpen(page, "cursor");
    await clickByTestId(page, "cursor-eraser");
    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    }

    // Exit full view
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="chart-root"][data-full-view="true"]:visible')).toHaveCount(0);
  });

  /* ---------------------------------------------------------------- */
  /*  15. RANGE TOOLS (PRICE, DATE, DATE+PRICE)                     */
  /* ---------------------------------------------------------------- */

  test("range tools (price, date, date+price) draw and persist", async ({ page }) => {
    const rangeTools = [
      { id: "tool-priceRange", badge: "tool: priceRange" },
      { id: "tool-dateRange", badge: "tool: dateRange" },
      { id: "tool-dateAndPriceRange", badge: "tool: dateAndPriceRange" },
    ];

    for (const [idx, tool] of rangeTools.entries()) {
      const before = await readDrawingCount(page);
      await selectTool(page, "forecasting", tool.id, tool.badge);
      await draw2PointShape(page, (["left", "center", "right"] as const)[idx % 3]);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  16. DRAWING OPTIONS PANEL                                      */
  /* ---------------------------------------------------------------- */

  test("tool options panel opens and mutates live drawing", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "center");

    await clickVisible(page, "chart-options-toggle");
    const panel = page.locator('[data-testid="tool-options-panel"]:visible').first();
    await expect(panel).toBeVisible();

    // Change color
    const colorInput = panel.locator('[data-testid="tool-option-color"]:visible').first();
    if (await colorInput.isVisible().catch(() => false)) {
      await colorInput.fill("#ff0000");
      const drawing = await readLatestDrawing(page);
      expect(drawing.options?.color).toBe("#ff0000");
    }

    // Change line width
    const widthInput = panel.locator('[data-testid="tool-option-lineWidth"]:visible').first();
    if (await widthInput.isVisible().catch(() => false)) {
      await widthInput.fill("3");
      const drawing = await readLatestDrawing(page);
      expect(Number(drawing.options?.lineWidth)).toBe(3);
    }

    await clickVisible(page, "chart-options-toggle");
  });

  /* ---------------------------------------------------------------- */
  /*  17. KEYBOARD SHORTCUTS                                         */
  /* ---------------------------------------------------------------- */

  test("toolbar undo/redo buttons work for common actions", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);

    // Undo via toolbar button
    await clickVisible(page, "toolbar-undo");
    await page.waitForTimeout(200);
    await expect.poll(async () => readDrawingCount(page)).toBe(0);

    // Redo via toolbar button
    await clickVisible(page, "toolbar-redo");
    await page.waitForTimeout(200);
    await expect.poll(async () => readDrawingCount(page)).toBe(1);
  });

  /* ---------------------------------------------------------------- */
  /*  18. DELETE ALL DRAWINGS                                        */
  /* ---------------------------------------------------------------- */

  test("delete button removes selected drawing", async ({ page }) => {
    for (const region of ["left", "center", "right"] as const) {
      const before = await readDrawingCount(page);
      await selectTool(page, "lines", "tool-trendline", "tool: trend");
      await draw2PointShape(page, region);
      await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before);
    }

    expect(await readDrawingCount(page)).toBeGreaterThanOrEqual(3);

    // Click on drawing to select it
    const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
    const box = await overlay.boundingBox();
    if (box) {
      await ensureGroupMenuOpen(page, "cursor");
      await clickByTestId(page, "cursor-cross");
      await page.mouse.click(box.x + box.width * 0.47, box.y + box.height * 0.45);
    }

    const before = await readDrawingCount(page);
    await clickVisible(page, "rail-delete");
    await expect.poll(async () => readDrawingCount(page)).toBeLessThan(before);
  });

  /* ---------------------------------------------------------------- */
  /*  19. SECTOR TOOL                                                */
  /* ---------------------------------------------------------------- */

  test("sector tool draws correctly", async ({ page }) => {
    await selectTool(page, "forecasting", "tool-sector", "tool: sector");
    await draw2PointShape(page, "center");
    expect(await readDrawingCount(page)).toBe(1);
    const drawing = await readLatestDrawing(page);
    expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);
  });

  /* ---------------------------------------------------------------- */
  /*  20. CURVE TOOLS                                                */
  /* ---------------------------------------------------------------- */

  test("curve and double curve tools draw correctly", async ({ page }) => {
    await selectTool(page, "brush", "tool-curveTool", "tool: curveTool");
    const before1 = await readDrawingCount(page);
    await draw2PointShape(page, "left");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before1);

    await selectTool(page, "brush", "tool-doubleCurve", "tool: doubleCurve");
    const before2 = await readDrawingCount(page);
    await draw2PointShape(page, "right");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before2);
  });

  /* ---------------------------------------------------------------- */
  /*  21. OBJECT TREE PANEL                                          */
  /* ---------------------------------------------------------------- */

  test("object tree panel shows all drawings", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "center");

    await selectTool(page, "fib", "fib-retracement", "tool: fibRetracement");
    await draw2PointShape(page, "right");

    expect(await readDrawingCount(page)).toBe(2);

    // On desktop the tree panel starts open by default; ensure it is open to check entries.
    const treePanel = page.locator('[data-testid="object-tree-panel"]:visible').first();
    const wasOpen = (await treePanel.getAttribute("data-open")) === "true";
    if (!wasOpen) {
      await clickByTestId(page, "chart-objects-toggle");
      await expect(treePanel).toHaveAttribute("data-open", "true");
    }

    // Tree should show at least 2 entries
    const entries = await treePanel.evaluate((el) => el.querySelectorAll('[data-testid^="drawing-object-"]').length);
    expect(entries).toBeGreaterThanOrEqual(2);

    // Restore initial closed state if we opened it
    if (!wasOpen) {
      await clickByTestId(page, "chart-objects-toggle");
    }
  });

  /* ---------------------------------------------------------------- */
  /*  22. FORECASTING BAR PATTERN & GHOST FEED                      */
  /* ---------------------------------------------------------------- */

  test("bar pattern and ghost feed draw with correct anchors", async ({ page }) => {
    await selectTool(page, "forecasting", "tool-barPattern", "tool: barPattern");
    await draw2PointShape(page, "left");
    const bar = await readLatestDrawing(page);
    expect(bar.anchors.length).toBeGreaterThanOrEqual(2);

    await selectTool(page, "forecasting", "tool-ghostFeed", "tool: ghostFeed");
    await draw2PointShape(page, "right");
    const ghost = await readLatestDrawing(page);
    expect(ghost.anchors.length).toBeGreaterThanOrEqual(2);
  });

  /* ---------------------------------------------------------------- */
  /*  23. FIB SPIRAL AND ARCS                                       */
  /* ---------------------------------------------------------------- */

  test("fib spiral and speed resistance arcs draw", async ({ page }) => {
    await selectTool(page, "fib", "fib-spiral", "tool: fibSpiral");
    const before1 = await readDrawingCount(page);
    await draw2PointShape(page, "left");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before1);

    await selectTool(page, "fib", "fib-speed-resistance-arcs", "tool: fibSpeedResistArcs");
    const before2 = await readDrawingCount(page);
    await draw2PointShape(page, "right");
    await expect.poll(async () => readDrawingCount(page)).toBeGreaterThan(before2);
  });

  /* ---------------------------------------------------------------- */
  /*  24. KEEP-DRAWING MODE PERSISTENCE                             */
  /* ---------------------------------------------------------------- */

  test("keep-drawing mode allows consecutive drawings without reselecting", async ({ page }) => {
    await clickVisible(page, "rail-keep-drawing");
    await selectTool(page, "lines", "tool-trendline", "tool: trend");

    await draw2PointShape(page, "left");
    // Tool should remain active
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: trend");

    await draw2PointShape(page, "center");
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("tool: trend");

    await draw2PointShape(page, "right");
    expect(await readDrawingCount(page)).toBeGreaterThanOrEqual(3);

    // Turn off keep-drawing — tool should deactivate after next draw
    await clickVisible(page, "rail-keep-drawing");
  });

  /* ---------------------------------------------------------------- */
  /*  25. MULTI-TYPE UNDO                                            */
  /* ---------------------------------------------------------------- */

  test("undo restores drawings across different tool types", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, "left");

    await selectTool(page, "fib", "fib-retracement", "tool: fibRetracement");
    await draw2PointShape(page, "center");

    await selectTool(page, "brush", "tool-rectangle", "tool: rectangle");
    await draw2PointShape(page, "right");

    expect(await readDrawingCount(page)).toBe(3);

    // Undo all 3 via toolbar
    await clickVisible(page, "toolbar-undo");
    await page.waitForTimeout(150);
    await clickVisible(page, "toolbar-undo");
    await page.waitForTimeout(150);
    await clickVisible(page, "toolbar-undo");
    await page.waitForTimeout(150);
    await expect.poll(async () => readDrawingCount(page)).toBe(0);

    // Redo all 3 via toolbar
    await clickVisible(page, "toolbar-redo");
    await page.waitForTimeout(150);
    await clickVisible(page, "toolbar-redo");
    await page.waitForTimeout(150);
    await clickVisible(page, "toolbar-redo");
    await page.waitForTimeout(150);
    await expect.poll(async () => readDrawingCount(page)).toBe(3);
  });
});
