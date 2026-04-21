/**
 * Unit tests for source-confidence + decideMerge.
 * Run: node scripts/lib/source-confidence.test.cjs
 */

"use strict";

const assert = require("assert");
const { getSourceConfidence, decideMerge, SOURCE_CONFIDENCE_REGISTRY } = require("./source-confidence.cjs");

let pass = 0, fail = 0;
function t(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    fail++;
  }
}

console.log("=== getSourceConfidence ===");
t("registered source returns exact confidence", () => {
  assert.strictEqual(getSourceConfidence("NSE_official"), 1.0);
  assert.strictEqual(getSourceConfidence("yahoo_quote"), 0.78);
});
t("unknown source defaults to 0.0", () => {
  assert.strictEqual(getSourceConfidence("never_heard_of_it"), 0.0);
});
t("null/undefined/empty source returns 0.0", () => {
  assert.strictEqual(getSourceConfidence(null), 0.0);
  assert.strictEqual(getSourceConfidence(undefined), 0.0);
  assert.strictEqual(getSourceConfidence(""), 0.0);
});
t("every registered source has confidence in [0,1]", () => {
  for (const [k, v] of Object.entries(SOURCE_CONFIDENCE_REGISTRY)) {
    assert.ok(typeof v === "number" && v >= 0 && v <= 1, `${k} -> ${v}`);
  }
});

console.log("\n=== decideMerge ===");
t("NULL_SKIP: incoming null is never written", () => {
  const d = decideMerge(24.5, null, "NSE_official", "yahoo_quote");
  assert.strictEqual(d.shouldWrite, false);
  assert.strictEqual(d.reasonCode, "NULL_SKIP");
});
t("NULL_SKIP: incoming undefined is never written", () => {
  assert.strictEqual(decideMerge("ExistingCo", undefined, "NSE_official", "yahoo_quote").reasonCode, "NULL_SKIP");
});
t("NULL_SKIP: incoming '' is never written", () => {
  assert.strictEqual(decideMerge("ExistingCo", "", "NSE_official", "yahoo_quote").reasonCode, "NULL_SKIP");
});
t("NULL_SKIP: incoming NaN is never written", () => {
  assert.strictEqual(decideMerge(10, Number.NaN, "yahoo_quote", "fmp").reasonCode, "NULL_SKIP");
});
t("NULL_SKIP: incoming Infinity is never written", () => {
  assert.strictEqual(decideMerge(10, Infinity, "yahoo_quote", "fmp").reasonCode, "NULL_SKIP");
});
t("NEW_VALUE: writes to empty slot", () => {
  const d = decideMerge(null, 24.5, "unknown", "yahoo_quote");
  assert.strictEqual(d.shouldWrite, true);
  assert.strictEqual(d.reasonCode, "NEW_VALUE");
});
t("NEW_VALUE: writes over empty string", () => {
  assert.strictEqual(decideMerge("", "Tata", "unknown", "NSE_official").reasonCode, "NEW_VALUE");
});
t("SOURCE_UPGRADE: higher confidence overwrites", () => {
  const d = decideMerge(24.5, 25.1, "yahoo_quote", "NSE_official");
  assert.strictEqual(d.shouldWrite, true);
  assert.strictEqual(d.reasonCode, "SOURCE_UPGRADE");
});
t("SOURCE_UPGRADE: equal confidence overwrites (fresher data)", () => {
  assert.strictEqual(decideMerge(24.5, 25.1, "yahoo_quote", "yahoo_quote").reasonCode, "SOURCE_UPGRADE");
});
t("LOWER_CONFIDENCE_SKIP: lower confidence preserves existing", () => {
  const d = decideMerge(24.5, 25.1, "NSE_official", "yahoo_quote");
  assert.strictEqual(d.shouldWrite, false);
  assert.strictEqual(d.reasonCode, "LOWER_CONFIDENCE_SKIP");
});
t("LOWER_CONFIDENCE_SKIP: unknown source cannot overwrite anything", () => {
  assert.strictEqual(decideMerge("NVIDIA", "Nvidia", "yahoo_quote", "random_blog").reasonCode, "LOWER_CONFIDENCE_SKIP");
});

console.log(`\n=== SUMMARY: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
