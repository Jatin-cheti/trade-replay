import assert from "node:assert/strict";
import {
  buildCandlesCacheKey,
  buildIndicatorsCacheKey,
  buildTransformCacheKey,
} from "../src/services/cacheKeys";

const source = {
  symbol: "AAPL",
  timeframe: "1m",
  from: "2024-01-01T00:00:00.000Z",
  to: "2024-01-01T23:59:59.000Z",
};

const candlesKey = buildCandlesCacheKey(source);
assert.equal(
  candlesKey,
  "v1:chart:candles:AAPL:1m:2024-01-01T00_00_00.000Z:2024-01-01T23_59_59.000Z",
);

const transformKey = buildTransformCacheKey({
  source,
  transformType: "renko",
  params: { boxSize: 2 },
});
assert.equal(transformKey.startsWith("v1:chart:transform:renko:"), true);
assert.equal(transformKey.includes(":AAPL:1m:"), true);

const indicatorsKeyA = buildIndicatorsCacheKey({
  source,
  indicators: [{ id: "sma", params: { period: 10 } }],
});
const indicatorsKeyB = buildIndicatorsCacheKey({
  source,
  indicators: [{ id: "sma", params: { period: 10 } }],
});
assert.equal(indicatorsKeyA, indicatorsKeyB);
assert.equal(indicatorsKeyA.startsWith("v1:chart:indicators:"), true);

console.log("cache-keys.test.ts passed");
