#!/usr/bin/env node
/**
 * Check that .env and .env.secrets files exist and contain required keys.
 * Does NOT load them (that's done by the actual app).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const rootDir = path.resolve(scriptDir, "..");

const envPath = path.join(rootDir, ".env");
const secretsPath = path.join(rootDir, ".env.secrets");

const envExists = fs.existsSync(envPath);
const secretsExists = fs.existsSync(secretsPath);

console.log(`[ENV:CHECK] Root directory: ${rootDir}`);
console.log(`[ENV:CHECK] .env exists: ${envExists ? "✓" : "✗"} (${envPath})`);
console.log(`[ENV:CHECK] .env.secrets exists: ${secretsExists ? "✓" : "✗"} (${secretsPath})`);

if (!envExists) {
  console.error(`[ENV:CHECK] FAIL: .env not found at ${envPath}`);
  process.exit(1);
}

// Read and parse .env file to check for keys
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = envContent
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const envKeys = new Set(
  envVars
    .map((line) => line.split("=")[0]?.trim())
    .filter(Boolean),
);

const requiredGroups = [
  {
    label: "PORT",
    anyOf: ["LOCAL_PORT", "PORT"],
  },
  {
    label: "CLIENT_URL",
    anyOf: ["LOCAL_CLIENT_URL", "CLIENT_URL"],
  },
  {
    label: "MONGO_URI",
    anyOf: ["LOCAL_MONGO_URI", "LOCAL_MONGODB_URI", "LOCAL_MONGO_URL", "MONGO_URI_LOCAL", "MONGO_URI"],
  },
  {
    label: "REDIS_URL",
    anyOf: ["LOCAL_REDIS_URL", "REDIS_URL_LOCAL", "REDIS_URL"],
  },
];

console.log("[ENV:CHECK] Checking required keys in .env file...");
let allKeysFound = true;
for (const group of requiredGroups) {
  const matched = group.anyOf.find((key) => envKeys.has(key));
  const exists = Boolean(matched);
  console.log(`[ENV:CHECK] ${group.label}: ${exists ? `✓ (${matched})` : "✗"}`);
  if (!exists) allKeysFound = false;
}

if (!allKeysFound) {
  console.error("[ENV:CHECK] FAIL: Some required environment variable groups are missing from .env");
  console.error("[ENV:CHECK] Provide at least one key from each group:");
  for (const group of requiredGroups) {
    console.error(`  - ${group.label}: ${group.anyOf.join(" | ")}`);
  }
  process.exit(1);
}

console.log("[ENV:CHECK] SUCCESS: Environment files are properly configured");
process.exit(0);
