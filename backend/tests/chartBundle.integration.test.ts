import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import http from "node:http";
import { once } from "node:events";
import { signJwt } from "../src/utils/jwt";
import { createChartRoutes } from "../src/routes/chartRoutes";
import { errorHandler } from "../src/middlewares/errorHandler";
import { env } from "../src/config/env";
import { resetChartServiceStateForTests } from "../src/services/chartCompute.service";

const originalFetch = globalThis.fetch;

async function requestJson(url: string, token: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const target = new URL(url);
  const payload = JSON.stringify(body);

  return await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: target.hostname,
      port: Number(target.port),
      path: target.pathname,
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "content-length": Buffer.byteLength(payload),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve({
          status: res.statusCode ?? 500,
          json: JSON.parse(raw),
        });
      });
    });

    req.on("error", (error) => reject(error));
    req.write(payload);
    req.end();
  });
}

async function run(): Promise<void> {
  const original = {
    enabled: env.CHART_SERVICE_ENABLED,
    retries: env.CHART_SERVICE_RETRY_COUNT,
    authEnabled: env.CHART_SERVICE_AUTH_ENABLED,
    authToken: env.CHART_SERVICE_AUTH_TOKEN,
  };

  env.CHART_SERVICE_ENABLED = true;
  env.CHART_SERVICE_RETRY_COUNT = 0;
  env.CHART_SERVICE_AUTH_ENABLED = true;
  env.CHART_SERVICE_AUTH_TOKEN = "internal-token";

  const app = express();
  app.use(express.json());
  app.use("/api/chart", createChartRoutes());
  app.use(errorHandler);

  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("SERVER_ADDRESS_UNAVAILABLE");
  }

  const token = signJwt({ userId: "u-1", email: "user@example.com" });
  const baseUrl = `http://127.0.0.1:${address.port}`;

  globalThis.fetch = (async (_input, init) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
    assert.equal(auth, `Bearer ${env.CHART_SERVICE_AUTH_TOKEN}`);

    return new Response(JSON.stringify({
      candlesCount: 2,
      candles: [
        { time: 1710000000, open: 1, high: 2, low: 1, close: 2, volume: 1 },
        { time: 1710000060, open: 2, high: 3, low: 2, close: 3, volume: 1 },
      ],
      transformed: null,
      indicators: null,
      cached: true,
      stale: false,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  resetChartServiceStateForTests();
  const success = await requestJson(`${baseUrl}/api/chart/bundle`, token, {
    source: { symbol: "AAPL", timeframe: "1m", limit: 120 },
  });

  assert.equal(success.status, 200);
  assert.equal((success.json as { delegated?: boolean }).delegated, true);

  env.CHART_SERVICE_AUTH_TOKEN = "";
  let wasFetchCalled = false;
  globalThis.fetch = (async () => {
    wasFetchCalled = true;
    throw new Error("TIMEOUT");
  }) as typeof globalThis.fetch;

  resetChartServiceStateForTests();
  const fallback = await requestJson(`${baseUrl}/api/chart/bundle`, token, {
    source: { symbol: "AAPL", timeframe: "1m", limit: 120 },
  });

  assert.equal(fallback.status, 200);
  assert.equal((fallback.json as { delegated?: boolean }).delegated, false);
  assert.equal(wasFetchCalled, false);

  await new Promise<void>((resolve) => server.close(() => resolve()));

  env.CHART_SERVICE_ENABLED = original.enabled;
  env.CHART_SERVICE_RETRY_COUNT = original.retries;
  env.CHART_SERVICE_AUTH_ENABLED = original.authEnabled;
  env.CHART_SERVICE_AUTH_TOKEN = original.authToken;
  globalThis.fetch = originalFetch;

  console.log("chartBundle.integration.test.ts passed");
}

void run();
