/**
 * Playwright config for the EXTRAS capture run (icons, magnet, zoom in/out, scale).
 * Designed to run in parallel with the main forecasting/brushes captures and
 * with the tv-parity sweep. Each grep'd browser is fully serial within itself.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/tv-capture-icons-magnet-zoom-scale.spec.ts"],
  outputDir: "tv-capture-output/_pw-output-extras",
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: [["line"]],
  use: {
    trace: "off",
    video: "off",
    screenshot: "off",
    actionTimeout: 8_000,
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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
