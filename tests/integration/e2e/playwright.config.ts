import { defineConfig, devices } from "@playwright/test";

function resolvePort(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);
    return parsed.port || fallback;
  } catch {
    return fallback;
  }
}

const E2E_API_BASE_URL = (process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4100").replace(/\/+$/, "");
const E2E_CHART_SERVICE_BASE_URL = (process.env.E2E_CHART_SERVICE_BASE_URL ?? "http://127.0.0.1:4110").replace(/\/+$/, "");
const E2E_UI_BASE_URL = (process.env.E2E_UI_BASE_URL ?? "http://127.0.0.1:8180").replace(/\/+$/, "");

const E2E_API_PORT = process.env.E2E_API_PORT ?? resolvePort(E2E_API_BASE_URL, "4100");
const E2E_CHART_SERVICE_PORT = process.env.E2E_CHART_SERVICE_PORT ?? resolvePort(E2E_CHART_SERVICE_BASE_URL, "4110");
const E2E_UI_PORT = process.env.E2E_UI_PORT ?? resolvePort(E2E_UI_BASE_URL, "8180");

process.env.E2E_API_BASE_URL = E2E_API_BASE_URL;
process.env.E2E_CHART_SERVICE_BASE_URL = E2E_CHART_SERVICE_BASE_URL;
process.env.E2E_UI_BASE_URL = E2E_UI_BASE_URL;

export default defineConfig({
  testDir: ".",
  testIgnore: ["playwright.config.ts"],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: E2E_UI_BASE_URL,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node ..\\..\\..\\backend\\bootstrap-dev.js",
      url: `${E2E_API_BASE_URL}/api/health`,
      reuseExistingServer: process.env.REUSE_SERVER === "1",
      timeout: 180_000,
      env: {
        NODE_ENV: "test",
        APP_ENV: "local",
        E2E: "1",
        PORT: E2E_API_PORT,
        CLIENT_URL: E2E_UI_BASE_URL,
        CLIENT_URLS: E2E_UI_BASE_URL,
        E2E_USE_MEMORY_MONGO: "true",
        E2E_USE_MOCK_REDIS: "true",
        KAFKA_ENABLED: "false",
        LOGO_SERVICE_ENABLED: "false",
        CHART_SERVICE_ENABLED: "true",
        CHART_SERVICE_URL: E2E_CHART_SERVICE_BASE_URL,
        CHART_SERVICE_AUTH_ENABLED: "true",
        CHART_SERVICE_AUTH_TOKEN: "dev-internal-token",
        DEV_AUTO_START_INFRA: "false",
      },
    },
    {
      command: "npm --prefix ..\\..\\..\\services\\chart-service run dev",
      url: `${E2E_CHART_SERVICE_BASE_URL}/health`,
      reuseExistingServer: process.env.REUSE_SERVER === "1",
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        E2E: "1",
        CHART_SERVICE_PORT: E2E_CHART_SERVICE_PORT,
        CHART_SERVICE_AUTH_ENABLED: "true",
        CHART_SERVICE_AUTH_TOKEN: "dev-internal-token",
        KAFKA_ENABLED: "false",
        REDIS_ENABLED: "false",
      },
    },
    {
      command: `npm --prefix ..\\..\\..\\frontend run dev -- --host 127.0.0.1 --port ${E2E_UI_PORT}`,
      url: E2E_UI_BASE_URL,
      reuseExistingServer: process.env.REUSE_SERVER === "1",
      timeout: 120_000,
      env: {
        DEV_VITE_API_URL: `${E2E_API_BASE_URL}/api`,
        VITE_DEV_API_URL: `${E2E_API_BASE_URL}/api`,
        VITE_API_URL: `${E2E_API_BASE_URL}/api`,
      },
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
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "tablet-safari",
      use: { ...devices["iPad (gen 7)"] },
    },
  ],
});
