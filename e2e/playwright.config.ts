import { defineConfig, devices } from "@playwright/test";

const useExternalStack = process.env.E2E_USE_EXTERNAL_STACK === "true";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  fullyParallel: true,
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
  ],
});
