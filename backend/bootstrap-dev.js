#!/usr/bin/env node
/**
 * Wrapper script to ensure .env is loaded before starting backend dev server.
 * Used by Playwright webServer to guarantee env vars in subprocess.
 */
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env and .env.secrets deterministically
// Resolve paths from __dirname to avoid relative path issues in subprocess
const envPath = path.resolve(__dirname, "../.env");
const secretsPath = path.resolve(__dirname, "../.env.secrets");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}
if (fs.existsSync(secretsPath)) {
  dotenv.config({ path: secretsPath, override: true });
}

const ensureInfraScript = path.resolve(__dirname, "../scripts/dev/ensure-infra.js");
const ensureInfra = spawnSync(process.execPath, [ensureInfraScript], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  env: process.env,
  shell: false,
});

if ((ensureInfra.status ?? 1) !== 0) {
  console.warn("[bootstrap] Infra bootstrap failed. Falling back to in-memory test infra mode.");
  process.env.E2E = process.env.E2E ?? "1";
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
  process.env.E2E_USE_MEMORY_MONGO = process.env.E2E_USE_MEMORY_MONGO ?? "true";
  process.env.E2E_USE_MOCK_REDIS = process.env.E2E_USE_MOCK_REDIS ?? "true";
  process.env.LOGO_SERVICE_ENABLED = process.env.LOGO_SERVICE_ENABLED ?? "false";
  process.env.KAFKA_ENABLED = process.env.KAFKA_ENABLED ?? "false";
}

// Spawn the actual backend with inherited env
// Use npm.cmd on Windows, npm on Unix  
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const backend = spawn(npmCmd, ["run", "dev"], {
  cwd: __dirname,
  stdio: "inherit",
  env: process.env,
  shell: true,
});

backend.on("exit", (code) => {
  process.exit(code ?? 0);
});
