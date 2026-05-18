/** Playwright config for app-regression run against our chart engine. */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/tv-app-regression.spec.ts"],
  outputDir: "tv-capture-output/_pw-output-app-reg",
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
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
