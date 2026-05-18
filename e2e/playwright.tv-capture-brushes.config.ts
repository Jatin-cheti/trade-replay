/**
 * Playwright config for the BRUSHES / ARROWS / SHAPES TV capture run.
 * Runs in PARALLEL with the forecasting/volume/measurers capture.
 * Uses a separate test-output dir + run-report path so the two runs do not
 * collide. Each run still has workers=1 internally to avoid hammering TV.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/tv-capture-brushes-arrows-shapes.spec.ts"],
  outputDir: "tv-capture-output/_pw-output-brushes",
  timeout: 90_000,
  retries: 1,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "tv-capture-output/run-report-brushes.json" },
    ],
  ],
  use: {
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    geolocation: { latitude: 28.6, longitude: 77.2 },
    permissions: ["geolocation"],
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
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
  ],
});
