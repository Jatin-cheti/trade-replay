import { defineConfig, devices } from "@playwright/test";

const e2eUseMockRedis = process.env.E2E_USE_MOCK_REDIS ?? "false";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  outputDir: "test-results/e2e",
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/html", open: "never" }],
    ["json", { outputFile: "test-results/e2e-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:8080",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm --prefix ..\\..\\..\\backend run dev",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        E2E_USE_MOCK_REDIS: e2eUseMockRedis,
        KAFKA_ENABLED: "false",
        LOGO_ENRICHMENT_ENABLED: "false",
      },
    },
    {
      command: "npm --prefix ..\\..\\..\\frontend run dev",
      url: "http://localhost:8080",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
