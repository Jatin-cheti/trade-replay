/**
 * device-matrix.spec.ts — Cross-device visual validation.
 *
 * Validates that the screener, symbol page, and live-market pages
 * render without horizontal scroll / layout overflow across:
 *   - Mobile (iPhone 12)
 *   - Tablet (iPad)
 *   - Laptop (1366×768)
 *   - Desktop (1920×1080)
 *
 * Run against the external production stack:
 *   E2E_USE_EXTERNAL_STACK=true PLAYWRIGHT_BASE_URL=https://<host> npx playwright test device-matrix
 */

import { test, expect } from "@playwright/test";

async function waitForChartRender(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const candidate = document.querySelector("[data-testid='chart-canvas'], canvas[aria-label='chart-drawing-overlay'], .tv-lightweight-charts canvas");
      if (!candidate) return false;

      const ownBars = candidate.getAttribute("data-bar-count");
      const hostBars = candidate.closest("[data-bar-count]")?.getAttribute("data-bar-count");
      const bars = Number.parseInt(ownBars ?? hostBars ?? "0", 10);
      if (Number.isFinite(bars) && bars > 0) return true;

      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    },
    { timeout: 20_000 },
  );
}

const ROUTES = [
  { name: "home", path: "/" },
  { name: "screener", path: "/screener" },
  { name: "symbol-nvda", path: "/symbol/NVDA" },
  { name: "live-market", path: "/live-market" },
];

for (const route of ROUTES) {
  test(`${route.name} — no horizontal overflow`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait for main content to appear (not a blank spinner)
    await expect(page.locator("body")).not.toBeEmpty();

    // No horizontal scrollbar: scrollWidth should equal clientWidth
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow, `Horizontal overflow on ${route.path}`).toBe(false);
  });
}

test("screener — loads rows on all viewports", async ({ page }) => {
  await page.goto("/screener", { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Allow lazy data load
  const rows = page.locator('[data-testid="screener-row"]');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  const count = await rows.count();
  expect(count, "Screener must render at least 1 row").toBeGreaterThan(0);
});

test("screener — result count visible", async ({ page }) => {
  await page.goto("/screener", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const resultCount = page.locator('[data-testid="screener-result-count"]');
  await expect(resultCount).toBeVisible({ timeout: 15_000 });

  const text = await resultCount.textContent();
  expect(text).toMatch(/\d+/);
});

test("symbol page — chart renders", async ({ page }) => {
  await page.goto("/symbol/NVDA", { waitUntil: "domcontentloaded", timeout: 30_000 });

  await waitForChartRender(page);
});
