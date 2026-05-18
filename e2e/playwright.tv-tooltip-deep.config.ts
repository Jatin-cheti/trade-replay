/** Playwright config for TV deep tooltip-panel capture (3 parallel via grep). */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/tv-tooltip-panel-deep.spec.ts"],
  outputDir: "tv-capture-output/_pw-output-deep",
  timeout: 60_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: [["line"]],
  use: {
    trace: "off",
    video: "off",
    screenshot: "off",
    actionTimeout: 6_000,
    navigationTimeout: 45_000,
    geolocation: { latitude: 28.6, longitude: 77.2 },
    permissions: ["geolocation"],
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    extraHTTPHeaders: { "Accept-Language": "en-IN,en;q=0.9" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
