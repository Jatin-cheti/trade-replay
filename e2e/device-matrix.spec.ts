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

  // Chart container or canvas should be visible
  const chart = page.locator("canvas, [data-testid='chart-container'], .tv-lightweight-charts");
  await expect(chart.first()).toBeVisible({ timeout: 20_000 });
});
