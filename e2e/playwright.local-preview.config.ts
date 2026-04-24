import { defineConfig, devices } from "@playwright/test";

// Config that runs tests against a local Vite dev server whose /api
// is proxied to the production backend at api.tradereplay.me.
// Used when the Vercel auto-deploy is stuck and we need to exercise
// freshly-built frontend code (which contains new test hooks).
export default defineConfig({
  testDir: ".",
  timeout: 180_000,
  fullyParallel: false,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm --prefix ..\\frontend run dev",
      url: "http://localhost:8080",
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        VITE_API_URL: "https://api.tradereplay.me",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
