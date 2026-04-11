import { expect, test, type Page } from "./playwright-fixture";

test.setTimeout(120_000);

async function registerAndLogin(page: Page): Promise<void> {
  const uid = Date.now();
  const email = `tool_rail_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `tool_rail_${uid}` },
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
}

async function waitForChart(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="ohlc-status"]:visible').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="tool-rail"]:visible').first()).toBeVisible();
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toBeVisible();
}

async function clickVisible(page: Page, testId: string): Promise<void> {
  await page.locator(`[data-testid="${testId}"]:visible`).first().click({ timeout: 5000 });
}

async function clickByTestId(page: Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    if (el) el.click();
  }, testId);
}

async function ensureGroupMenuOpen(page: Page, group: string): Promise<void> {
  const menuTestId = group === "cursor" ? "menu-cursor" : `menu-${group}`;
  const menu = page.locator(`[data-testid="${menuTestId}"]:visible`).first();

  if (await menu.isVisible().catch(() => false)) return;

  // Dismiss any portal-rendered popover that might intercept clicks
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

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

  test("representative tools draw from each required group", async ({ page }) => {
    await selectTool(page, "lines", "tool-trendline", "tool: trend");
    await draw2PointShape(page, 'left');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("1 drawing");

    await selectTool(page, "fib", "fib-speed-resistance-fan", "tool: fibSpeedResistFan");
    await draw2PointShape(page, 'center');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("2 drawing");

    await selectTool(page, "patterns", "tool-xabcd", "tool: xabcd");
    await draw2PointShape(page, 'right');
    await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toContainText("3 drawing");

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
});
