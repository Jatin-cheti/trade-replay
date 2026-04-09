import assert from "node:assert/strict";
import { computeIndicatorsSchema, transformSchema } from "../src/lib/validation";

const validCandles = [
  { time: 1710000000, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
  { time: 1710000060, open: 100.5, high: 102, low: 100, close: 101.2, volume: 1100 },
];

const indicatorsOk = computeIndicatorsSchema.safeParse({
  candles: validCandles,
  indicators: [{ id: "sma", params: { period: 2 } }],
});
assert.equal(indicatorsOk.success, true);

const indicatorsBad = computeIndicatorsSchema.safeParse({
  indicators: [{ id: "sma" }],
});
assert.equal(indicatorsBad.success, false);

const transformOk = transformSchema.safeParse({
  candles: validCandles,
  transformType: "renko",
  params: { boxSize: 0.5 },
});
assert.equal(transformOk.success, true);

const transformBad = transformSchema.safeParse({
  candles: validCandles,
  transformType: "unknown",
});
assert.equal(transformBad.success, false);

console.log("validation.test.ts passed");
