import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";

process.env.CHART_SERVICE_AUTH_ENABLED = "false";
process.env.ENABLE_INDICATOR_WORKER = "false";

const { createApp } = await import("../../src/app");
const { closeRedis } = await import("../../src/config/redis");

function getJson(baseUrl: string, path: string): Promise<{ statusCode: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(`${baseUrl}${path}`, { method: "GET" }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve({ statusCode: res.statusCode ?? 0, body: JSON.parse(raw) });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function postJson(baseUrl: string, path: string, body: unknown): Promise<{ statusCode: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = httpRequest(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload)),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve({ statusCode: res.statusCode ?? 0, body: JSON.parse(raw) });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const server = createServer(createApp());
await new Promise<void>((resolve) => server.listen(0, resolve));
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("FAILED_TO_BIND_TEST_SERVER");
}
const base = `http://127.0.0.1:${address.port}`;

const healthRes = await getJson(base, "/health");
assert.equal(healthRes.statusCode, 200);

const candlesRes = await getJson(base, "/api/chart/candles?symbol=AAPL&timeframe=1m&limit=30");
assert.equal(candlesRes.statusCode, 200);
const candlesBody = candlesRes.body as { ok: boolean; data: unknown[] };
assert.equal(candlesBody.ok, true);
assert.ok(Array.isArray(candlesBody.data));
assert.ok(candlesBody.data.length > 0);

const bundleRes = await postJson(base, "/bundle", {
  source: { symbol: "AAPL", timeframe: "1m", limit: 30 },
  transformType: "renko",
  indicators: [{ id: "sma", params: { period: 5 } }],
});
assert.equal(bundleRes.statusCode, 200);
const bundleBody = bundleRes.body as {
  candlesCount: number;
  candles: unknown[];
  transformed: { candles: unknown[] } | null;
  indicators: { indicators: unknown[] } | null;
};
assert.ok(Number.isFinite(bundleBody.candlesCount));
assert.ok(Array.isArray(bundleBody.candles));
assert.ok(bundleBody.candles.length > 0);
assert.ok(bundleBody.transformed == null || Array.isArray(bundleBody.transformed.candles));
assert.ok(bundleBody.indicators == null || Array.isArray(bundleBody.indicators.indicators));

await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
await closeRedis().catch(() => {});
process.stdout.write("chart.api.test.ts passed\n");
