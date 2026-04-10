import net from "node:net";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");

if (!fs.existsSync(envPath)) {
  throw new Error("Missing environment file: .env");
}

dotenv.config({ path: envPath, override: false });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

const appEnv = (process.env.APP_ENV ?? "local").toLowerCase();

function modeEnv(baseName: string): string {
  const modeKey = `${baseName}_${appEnv.toUpperCase()}`;
  return process.env[modeKey] ?? process.env[baseName] ?? requiredEnv(modeKey);
}

const DEFAULT_BACKEND_URL = requiredEnv("BACKEND_URL");
const REDIS_URL = modeEnv("REDIS_URL");
const KAFKA_BROKER = modeEnv("KAFKA_BROKER");

type ValidationResult = {
  redis: boolean;
  kafka: boolean;
  backendHealth: boolean;
  queueWorking: boolean;
  cacheWorking: boolean;
  socketWorking: boolean;
  searchLatencyTarget: boolean;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: string, retries = 10, delayMs = 2000): Promise<any> {
  let lastError: unknown;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await wait(delayMs);
      }
    }
  }
  throw new Error(`Unable to fetch ${url}: ${String(lastError)}`);
}

function connectTcp(host: string, port: number, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve();
    });

    socket.setTimeout(timeoutMs);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`TCP timeout ${host}:${port}`));
    });
    socket.once("error", (error) => {
      reject(error);
    });
  });
}

function parseRedis(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || "6379"),
  };
}

async function redisPingAndCacheCheck(url: string): Promise<boolean> {
  const { host, port } = parseRedis(url);
  const key = `validate:cache:${Date.now()}`;

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        const pipeline = [
          "*1\r\n$4\r\nPING\r\n",
          `*3\r\n$3\r\nSET\r\n$${key.length}\r\n${key}\r\n$2\r\nOK\r\n`,
          `*2\r\n$3\r\nGET\r\n$${key.length}\r\n${key}\r\n`,
          `*2\r\n$3\r\nDEL\r\n$${key.length}\r\n${key}\r\n`,
        ].join("");
        socket.write(pipeline);
      });

      let data = "";
      socket.setTimeout(5000);
      socket.on("data", (chunk) => {
        data += chunk.toString("utf8");
      });
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("Redis validation timeout"));
      });
      socket.once("error", (error) => {
        reject(error);
      });
      socket.once("close", () => {
        const pong = data.includes("+PONG");
        const gotValue = data.includes("$2\r\nOK");
        if (pong && gotValue) {
          resolve();
        } else {
          reject(new Error(`Unexpected Redis response: ${data}`));
        }
      });
      setTimeout(() => socket.end(), 300);
    });
    return true;
  } catch {
    return false;
  }
}

function parseKafkaBroker(input: string): { host: string; port: number } {
  const [firstBroker] = input.split(",");
  const [host, rawPort] = firstBroker.trim().split(":");
  return {
    host,
    port: Number(rawPort || "9092"),
  };
}

async function kafkaConnectivityCheck(broker: string): Promise<boolean> {
  const { host, port } = parseKafkaBroker(broker);
  try {
    await connectTcp(host, port);
    return true;
  } catch {
    return false;
  }
}

async function socketEndpointCheck(baseUrl: string): Promise<boolean> {
  const endpoint = `${baseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return false;
    const body = await res.text();
    return body.includes("sid") && body.includes("upgrades");
  } catch {
    return false;
  }
}

async function waitForBackend(url: string): Promise<void> {
  const retries = 10;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore and retry
    }
    await wait(2000);
  }
  throw new Error("Backend not reachable after retries");
}
async function run(): Promise<void> {
  await waitForBackend(`${DEFAULT_BACKEND_URL}/api/health`);
  const health = await fetchJsonWithRetry(`${DEFAULT_BACKEND_URL}/api/health`);
  const metrics = await fetchJsonWithRetry(`${DEFAULT_BACKEND_URL}/api/metrics`);

  const redis = await redisPingAndCacheCheck(REDIS_URL);
  const kafka = await kafkaConnectivityCheck(KAFKA_BROKER);
  const socketWorking = await socketEndpointCheck(DEFAULT_BACKEND_URL);

  const backendHealth = Boolean(health?.ok);
  const queueWorking = typeof metrics?.queueDepth?.logoEnrichment?.total === "number";
  const cacheWorking = redis;
  const searchLatencyTarget = Number(metrics?.symbolSearch?.p50LatencyMs ?? 0) < 100;

  const results: ValidationResult = {
    redis,
    kafka,
    backendHealth,
    queueWorking,
    cacheWorking,
    socketWorking,
    searchLatencyTarget,
  };

  const failed = Object.entries(results)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  if (failed.length > 0) {
    console.error(JSON.stringify({
      status: "failed",
      failedChecks: failed,
      results,
      context: {
        backendUrl: DEFAULT_BACKEND_URL,
        redisUrl: REDIS_URL,
        kafkaBroker: KAFKA_BROKER,
      },
    }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    status: "passed",
    results,
    context: {
      backendUrl: DEFAULT_BACKEND_URL,
      redisUrl: REDIS_URL,
      kafkaBroker: KAFKA_BROKER,
    },
  }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});



