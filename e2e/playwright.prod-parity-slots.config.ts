import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for prod-parity-slot{A,B,C}.spec.ts
 * ======================================================
 * 3 browsers run in parallel (each launched as a separate process by the
 * orchestrator). Each process runs ONE slot spec with workers=1 so the
 * same browser window stays open for all 500 tests per tool.
 *
 * Key settings:
 *  - workers: 1          → single worker per process = single persistent browser
 *  - fullyParallel: false → tests run serially within each slot (shared-page pattern)
 *  - timeout: 90_000     → 90s per test (undo/redo N=10 can be slow)
 *  - retries: 1          → one retry for flaky network scenarios
 *
 * Usage (orchestrator launches 3 separate processes):
 *   npx playwright test e2e/prod-parity-slotA.spec.ts --config=e2e/playwright.prod-parity-slots.config.ts
 *   npx playwright test e2e/prod-parity-slotB.spec.ts --config=e2e/playwright.prod-parity-slots.config.ts
 *   npx playwright test e2e/prod-parity-slotC.spec.ts --config=e2e/playwright.prod-parity-slots.config.ts
 */
export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  retries: 1,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: "prod-parity-slots-results.json" }],
  ],
  use: {
    baseURL: process.env.E2E_TARGET_URL ?? "https://tradereplay.me",
    headless: false,      // headed — browser stays visible for all 500 tests
    trace: "off",
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
      },
    },
  ],
});
