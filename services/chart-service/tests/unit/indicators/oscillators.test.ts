import assert from "node:assert/strict";
import { cci, rsi, stochastic, williamsR } from "../../../src/lib/indicators/oscillators";

const close = [10, 11, 12, 11, 13, 14, 13, 15, 16, 17, 18, 17, 19, 20, 21];
const high = close.map((v) => v + 1);
const low = close.map((v) => v - 1);

const rsiOut = rsi(close, 5);
assert.equal(rsiOut.length, close.length);
assert.ok(rsiOut.slice(6).every((v) => Number.isNaN(v) || (v >= 0 && v <= 100)));

const stochOut = stochastic(high, low, close, 5);
assert.equal(stochOut.length, close.length);

const cciOut = cci(high, low, close, 5);
assert.equal(cciOut.length, close.length);

const wrOut = williamsR(high, low, close, 5);
assert.equal(wrOut.length, close.length);
assert.ok(wrOut.slice(6).every((v) => Number.isNaN(v) || (v <= 0 && v >= -100)));

process.stdout.write("oscillators.test.ts passed\n");
