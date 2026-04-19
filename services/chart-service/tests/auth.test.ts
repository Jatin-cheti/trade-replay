import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../src/app";
import { env } from "../src/config/env";

async function run(): Promise<void> {
  const original = {
    enabled: env.CHART_SERVICE_AUTH_ENABLED,
    token: env.CHART_SERVICE_AUTH_TOKEN,
  };

  env.CHART_SERVICE_AUTH_ENABLED = true;
  env.CHART_SERVICE_AUTH_TOKEN = "chart-internal-token";

  const app = createApp();
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("SERVER_ADDRESS_UNAVAILABLE");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const unauthorized = await fetch(`${baseUrl}/bundle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      candles: [
        { time: 1710000000, open: 1, high: 2, low: 1, close: 2, volume: 1 },
        { time: 1710000060, open: 2, high: 3, low: 2, close: 3, volume: 1 },
      ],
    }),
  });
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(`${baseUrl}/bundle`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.CHART_SERVICE_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      candles: [
        { time: 1710000000, open: 1, high: 2, low: 1, close: 2, volume: 1 },
        { time: 1710000060, open: 2, high: 3, low: 2, close: 3, volume: 1 },
      ],
      transformType: "renko",
      params: { boxSize: 0.5 },
      indicators: [{ id: "sma", params: { period: 2 } }],
    }),
  });
  assert.equal(authorized.status, 200);

  const metricsUnauthorized = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsUnauthorized.status, 401);

  const healthOpen = await fetch(`${baseUrl}/health`);
  assert.equal(healthOpen.status, 200);

  await new Promise<void>((resolve) => server.close(() => resolve()));

  env.CHART_SERVICE_AUTH_ENABLED = original.enabled;
  env.CHART_SERVICE_AUTH_TOKEN = original.token;

  console.log("auth.test.ts passed");
}

void run();
