import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node ..\\..\\..\\backend\\bootstrap-dev.js",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        E2E: "1",
        E2E_USE_MEMORY_MONGO: "true",
        E2E_USE_MOCK_REDIS: "true",
        KAFKA_ENABLED: "false",
        LOGO_SERVICE_ENABLED: "false",
        CHART_SERVICE_ENABLED: "true",
        CHART_SERVICE_AUTH_ENABLED: "true",
        CHART_SERVICE_AUTH_TOKEN: "dev-internal-token",
        DEV_AUTO_START_INFRA: "true",
      },
    },
    {
      command: "npm --prefix ..\\..\\..\\services\\chart-service run dev",
      url: "http://localhost:4010/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        E2E: "1",
        CHART_SERVICE_AUTH_ENABLED: "true",
        CHART_SERVICE_AUTH_TOKEN: "dev-internal-token",
        KAFKA_ENABLED: "false",
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
  ],
});
