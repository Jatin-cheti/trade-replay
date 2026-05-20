/**
 * Playwright config for deep TV behavioral research runs.
 * Headed mode required so TradingView JS toolbar loads fully.
 *
 * Usage:
 *   cd tradereplay
 *   npx playwright test e2e/tv-research-gap-tools.spec.ts \
 *     --config=e2e/playwright.tv-research.config.ts \
 *     --project=chromium --headed
 *
 * Single tool:
 *   npx playwright test e2e/tv-research-gap-tools.spec.ts \
 *     --config=e2e/playwright.tv-research.config.ts \
 *     --project=chromium --headed \
 *     --grep "\[RESEARCH\]\[longPosition\]"
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/tv-research-gap-tools*.spec.ts", "**/tv-research-gap-tools-pass3-icons.spec.ts"],
  timeout: 180_000,
  retries: 1,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "tv-research-output/run-report.json" }]],
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
    geolocation: { latitude: 28.6, longitude: 77.2 },
    permissions: ["geolocation"],
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    extraHTTPHeaders: { "Accept-Language": "en-IN,en;q=0.9" },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            "--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox",
            "--disable-dev-shm-usage", "--disable-web-security",
          ],
        },
      },
    },
  ],
});
