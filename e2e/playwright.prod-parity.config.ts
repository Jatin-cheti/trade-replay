import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for running TV-parity 500-test suites against
 * the production deployment at https://tradereplay.me.
 *
 * Usage:
 *   Set E2E_PROD_TOKEN to a valid JWT before running.
 *   See seed-pixel-diff-baselines-prod.ps1 for the full batch workflow.
 */
export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "https://tradereplay.me",
    trace: "on-first-retry",
    // no storageState – token injected via E2E_PROD_TOKEN env var in factory
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
