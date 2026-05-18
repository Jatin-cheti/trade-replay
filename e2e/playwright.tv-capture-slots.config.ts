/**
 * playwright.tv-capture-slots.config.ts
 * =======================================
 * Playwright config for TV Capture slot specs (tv-capture-slot1/2/3.spec.ts).
 * Each slot spec runs in its own browser process via the orchestrator.
 * This config is intentionally single-worker (1 slot = 1 browser = 1 worker).
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/tv-capture-slot*.spec.ts"],

  // Each test (scenario) is given 90s. Long but needed for TV page interactions.
  timeout: 90_000,

  // Retry once on flake (TV modals, network hiccups)
  retries: 1,

  // Single worker — this config is for ONE slot at a time.
  // The orchestrator launches 3 separate playwright processes each targeting a different slot file.
  fullyParallel: false,
  workers: 1,

  reporter: [["line"], ["json", { outputFile: "tv-capture-results.json" }]],

  use: {
    trace: "on-first-retry",
    video: "off",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        geolocation: { latitude: 28.6, longitude: 77.2 },
        permissions: ["geolocation"],
        launchOptions: {
          args: [
            "--disable-web-security",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
    },
  ],
});
