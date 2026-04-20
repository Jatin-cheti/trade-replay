#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const envPath = path.join(rootDir, ".env");
const secretsPath = path.join(rootDir, ".env.secrets");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    process.env[key] = value;
  }
}

loadEnvFile(envPath);
loadEnvFile(secretsPath);

const isTestMode = process.env.NODE_ENV === "test" || process.env.E2E === "1";
const autoStartInfra = (process.env.DEV_AUTO_START_INFRA ?? "true") === "true";
const kafkaEnabled = (process.env.KAFKA_ENABLED ?? process.env.LOCAL_KAFKA_ENABLED ?? "false") === "true";

function parseHostPort(rawUrl, fallbackPort) {
  if (!rawUrl) return { host: "127.0.0.1", port: fallbackPort };
  try {
    const u = new URL(rawUrl);
    return {
      host: u.hostname || "127.0.0.1",
      port: Number(u.port || fallbackPort),
    };
  } catch {
    return { host: "127.0.0.1", port: fallbackPort };
  }
}

const mongoUri = process.env.MONGODB_URI
  ?? process.env.MONGO_URI
  ?? process.env.LOCAL_MONGO_URL
  ?? process.env.LOCAL_MONGODB_URI
  ?? process.env.LOCAL_MONGO_URI
  ?? "mongodb://127.0.0.1:27017/tradereplay";

const redisUri = process.env.REDIS_URL
  ?? process.env.LOCAL_REDIS_URL
  ?? "redis://127.0.0.1:6379";

const kafkaBroker = (process.env.KAFKA_BROKER
  ?? process.env.KAFKA_BROKERS
  ?? process.env.LOCAL_KAFKA_BROKERS
  ?? "localhost:19092").split(",")[0].trim();

const mongoTarget = parseHostPort(mongoUri, 27017);
const redisTarget = parseHostPort(redisUri, 6379);

function parseBrokerHostPort(broker) {
  const [host, rawPort] = broker.split(":");
  return { host: host || "127.0.0.1", port: Number(rawPort || "19092") };
}

const kafkaTarget = parseBrokerHostPort(kafkaBroker);

function pingPort(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

async function waitForPort(host, port, label, timeoutMs = 60000) {
  const started = Date.now();
  while ((Date.now() - started) < timeoutMs) {
    if (await pingPort(host, port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(`[infra] ${label} not reachable at ${host}:${port} after ${timeoutMs}ms`);
  return false;
}

function hasDocker() {
  const docker = spawnSync("docker", ["--version"], { stdio: "pipe", shell: true });
  if (docker.status !== 0) return false;
  const daemon = spawnSync("docker", ["info"], { stdio: "pipe", shell: true });
  return daemon.status === 0;
}

function runComposeUp(services) {
  const cmd = ["compose", "up", "-d", ...services];
  console.log(`[infra] Running: docker ${cmd.join(" ")}`);
  const result = spawnSync("docker", cmd, {
    stdio: "inherit",
    cwd: rootDir,
    shell: true,
  });
  return result.status === 0;
}

(async () => {
  const mongoUp = await pingPort(mongoTarget.host, mongoTarget.port);
  const redisUp = await pingPort(redisTarget.host, redisTarget.port);
  const kafkaUp = kafkaEnabled ? await pingPort(kafkaTarget.host, kafkaTarget.port) : true;

  if (mongoUp && redisUp && kafkaUp) {
    console.log("[infra] All required infra endpoints are reachable.");
    process.exit(0);
  }

  if (!autoStartInfra) {
    if (isTestMode) {
      console.warn("[infra] DEV_AUTO_START_INFRA=false in test mode; relying on memory/mock fallbacks.");
      process.exit(0);
    }
    console.error("[infra] Required infra is down and auto-start is disabled.");
    console.error("[infra] Start infra manually: docker compose up -d mongodb redis kafka");
    process.exit(1);
  }

  if (hasDocker()) {
    const services = ["mongodb", "redis"];
    if (kafkaEnabled) services.push("kafka");
    const started = runComposeUp(services);
    if (!started) {
      if (isTestMode) {
        console.warn("[infra] Docker compose start failed in test mode; using memory/mock fallbacks.");
        process.exit(0);
      }
      console.error("[infra] Docker compose failed. Please run docker compose manually and retry.");
      process.exit(1);
    }

    const waiters = [
      waitForPort(mongoTarget.host, mongoTarget.port, "MongoDB"),
      waitForPort(redisTarget.host, redisTarget.port, "Redis"),
    ];
    if (kafkaEnabled) {
      waiters.push(waitForPort(kafkaTarget.host, kafkaTarget.port, "Kafka", 90000));
    }

    const statuses = await Promise.all(waiters);
    if (statuses.every(Boolean)) {
      console.log("[infra] Infra is ready.");
      process.exit(0);
    }

    if (isTestMode) {
      console.warn("[infra] Infra did not become ready in time; using memory/mock fallbacks for test mode.");
      process.exit(0);
    }

    console.error("[infra] Infra failed readiness checks in dev mode.");
    process.exit(1);
  }

  if (isTestMode) {
    console.warn("[infra] Docker is unavailable in test mode; using memory/mock fallbacks.");
    process.exit(0);
  }

  console.error("[infra] Docker is unavailable, so Mongo/Redis cannot be auto-started.");
  console.error("[infra] Install/start Docker, then run: docker compose up -d mongodb redis kafka");
  process.exit(1);
})();
