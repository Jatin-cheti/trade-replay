import { defineConfig, devices } from "@playwright/test";

const useExternalStack = process.env.E2E_USE_EXTERNAL_STACK === "true";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  fullyParallel: false,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  webServer: useExternalStack
    ? undefined
    : [
      {
        command: "npm --prefix ..\\backend run dev",
        url: "http://localhost:4000/api/health",
        reuseExistingServer: false,
        timeout: 120_000,
      },
      {
        command: "npm --prefix ..\\frontend run dev",
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
      name: "mobile-iphone12",
      use: { ...devices["iPhone 12"] },
    },
    {
      name: "tablet-ipad",
      use: { ...devices["iPad"] },
    },
    {
      name: "laptop-1366",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "desktop-1920",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
