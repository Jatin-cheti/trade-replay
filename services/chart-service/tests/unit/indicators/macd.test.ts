import assert from "node:assert/strict";
import { macd } from "../../../src/lib/indicators/macd";

const values = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 5 + (i * 0.2));
const out = macd(values, 12, 26, 9);

assert.equal(out.macd.length, values.length);
assert.equal(out.signal.length, values.length);
assert.equal(out.histogram.length, values.length);

for (let i = 0; i < values.length; i += 1) {
  const m = out.macd[i];
  const s = out.signal[i];
  const h = out.histogram[i];
  if (Number.isFinite(m) && Number.isFinite(s)) {
    assert.equal(Number(h.toFixed(10)), Number((m - s).toFixed(10)));
  }
}

process.stdout.write("macd.test.ts passed\n");
