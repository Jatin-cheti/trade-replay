import assert from "node:assert/strict";
import { dema, ema, sma, tema, wma } from "../../../src/lib/indicators/moving-averages";

const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const smaResult = sma(values, 3);
assert.equal(smaResult.length, values.length);
assert.equal(smaResult[2], 2);

const emaResult = ema(values, 3);
assert.equal(emaResult.length, values.length);
assert.ok(Number.isFinite(emaResult[9]));

const wmaResult = wma(values, 3);
assert.equal(wmaResult.length, values.length);
assert.ok(Number.isFinite(wmaResult[9]));

const demaResult = dema(values, 3);
const temaResult = tema(values, 3);
assert.equal(demaResult.length, values.length);
assert.equal(temaResult.length, values.length);
assert.ok(Number.isFinite(demaResult[9]));
assert.ok(Number.isFinite(temaResult[9]));

process.stdout.write("moving-averages.test.ts passed\n");
