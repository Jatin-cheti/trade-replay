/**
 * Playwright config for TradingView capture runs.
 *
 * This config targets live TradingView — NO local dev server is started.
 * Run against chromium in headed mode so TV's JS-heavy toolbar loads properly.
 *
 * Usage:
 *   cd tradereplay
 *   npx playwright test e2e/tv-capture-forecasting-volume-measurers.spec.ts \
 *     --config=e2e/playwright.tv-capture.config.ts \
 *     --project=chromium --headed --timeout=90000
 *
 * Notes:
 *   - Set E2E_TV_SLOW=1 to add 500ms extra delay between actions (helps on
 *     slow connections or when TV throttles requests).
 *   - Screenshots are saved under e2e/tv-references/<tool>/ and
 *     e2e/tv-capture-output/<tool>/.
 *   - Each test is retried once on failure (network hiccup tolerance).
 *   - Workers=1 so TV's rate-limiter is not hit.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/tv-capture-forecasting-volume-measurers.spec.ts"],
  timeout: 90_000,           // TV chart can be slow to load
  retries: 1,                // retry once on flaky network
  fullyParallel: false,
  workers: 1,                // single worker — don't hammer TV's servers
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "tv-capture-output/run-report.json" },
    ],
  ],
  use: {
    // No baseURL — tests navigate directly to TV_URL
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    // Accept cookies/geolocation so TV dialogs are minimized
    geolocation: { latitude: 28.6, longitude: 77.2 },
    permissions: ["geolocation"],
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    // Extra HTTP headers to appear as a real browser
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en;q=0.9",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Launch with GPU disabled for stability on CI
        launchOptions: {
          args: [
            "--disable-gpu",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
          ],
        },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
