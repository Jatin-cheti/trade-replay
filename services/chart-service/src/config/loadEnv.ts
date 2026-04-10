import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deterministically load .env and .env.secrets from repo root.
 * Chart service uses this to ensure consistent env loading in subprocesses.
 */
export function loadEnv(): { envPath: string; secretsPath: string; envLoaded: boolean; secretsLoaded: boolean } {
  // Resolve from services/chart-service/src/config -> ../../../../ (repo root)
  const envPath = path.resolve(__dirname, "../../../../.env");
  const secretsPath = path.resolve(__dirname, "../../../../.env.secrets");

  let envLoaded = false;
  let secretsLoaded = false;

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    envLoaded = true;
  }

  if (fs.existsSync(secretsPath)) {
    dotenv.config({ path: secretsPath, override: true });
    secretsLoaded = true;
  }

  if (process.env.ENV_DEBUG === "true") {
    const loadedFiles = [];
    if (envLoaded) loadedFiles.push(`.env (${envPath})`);
    if (secretsLoaded) loadedFiles.push(`.env.secrets (${secretsPath})`);
    const count = Object.keys(process.env).filter((k) => !k.startsWith("_")).length;
    console.log(`[ENV] Chart Service: Loaded from: ${loadedFiles.join(", ")} | Total keys: ${count}`);
  }

  return { envPath, secretsPath, envLoaded, secretsLoaded };
}
