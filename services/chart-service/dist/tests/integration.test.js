import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../src/app";
async function run() {
    const app = createApp();
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") {
        throw new Error("SERVER_ADDRESS_UNAVAILABLE");
    }
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const computeRes = await fetch(`${baseUrl}/compute/indicators`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            candles: [
                { time: 1710000000, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
                { time: 1710000060, open: 100.5, high: 102, low: 100, close: 101.2, volume: 1100 },
            ],
            indicators: [{ id: "sma", params: { period: 2 } }],
        }),
    });
    assert.equal(computeRes.status, 200);
    const computeJson = await computeRes.json();
    assert.equal(Array.isArray(computeJson.indicators), true);
    assert.equal(computeJson.indicators?.[0]?.id, "sma");
    await new Promise((resolve) => server.close(() => resolve()));
    console.log("integration.test.ts passed");
}
void run();
