/**
 * playwright.tv-deep-parity-slots.config.ts
 * ─────────────────────────────────────────
 * Playwright config for the NEW 13,500-scenario deep-parity test suite
 * running on tradingview.com (Browsers 4 / 5 / 6 — Slots D / E / F).
 *
 * Key differences from prod-parity config:
 *  - baseURL points at tradingview.com (not tradereplay.me)
 *  - No auth / login step needed (TV is publicly accessible)
 *  - Same headed, sequential (workers:1) approach for stability
 *  - Timeout 120s per test (TV can be slower to load)
 *  - Each slot spec is targeted individually by the orchestrator via --grep
 */

import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

export default defineConfig({
  testDir: path.resolve(__dirname),
  // Each slot runs ONE spec file; the orchestrator passes the file directly.
  // This config covers all three slots.
  testMatch: [
    "**/tv-deep-parity-slotD.spec.ts",
    "**/tv-deep-parity-slotE.spec.ts",
    "**/tv-deep-parity-slotF.spec.ts",
  ],

  // Must be sequential — we share a single page per tool suite
  workers: 1,
  fullyParallel: false,

  timeout: 120_000,
  retries: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "tv-deep-parity-results.json" }],
  ],

  use: {
    baseURL: "https://in.tradingview.com",
    headless: false,                     // headed so we can visually verify
    viewport: { width: 1440, height: 900 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    actionTimeout: 15_000,
    navigationTimeout: 50_000,
    trace: "off",                        // traces are large; disable by default
    video: "off",
    screenshot: "only-on-failure",
    // No storageState — TV tests run unauthenticated
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
