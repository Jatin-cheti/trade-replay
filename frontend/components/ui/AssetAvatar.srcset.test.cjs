/* Loop 3 LOGO-005 — srcset builder tests (node:assert, no deps). */
const assert = require("node:assert/strict");

// Inline mirror of the TS buildSrcSet (contract test).
function buildSrcSet(src) {
  if (!src || src.startsWith("data:")) return "";
  if (/\.svg(\?|$)/i.test(src)) return "";

  if (src.includes("www.google.com/s2/favicons")) {
    const url = new URL(src);
    const base = `${url.origin}${url.pathname}`;
    const domain = url.searchParams.get("domain") ?? "";
    const enc = encodeURIComponent(domain);
    return [
      `${base}?sz=64&domain=${enc} 1x`,
      `${base}?sz=128&domain=${enc} 2x`,
      `${base}?sz=256&domain=${enc} 3x`,
    ].join(", ");
  }
  if (src.includes("logo.clearbit.com")) {
    const [base] = src.split("?");
    return [`${base}?size=64 1x`, `${base}?size=128 2x`, `${base}?size=256 3x`].join(", ");
  }
  if (src.includes("img.logo.dev")) {
    const [base] = src.split("?");
    return [`${base}?size=64 1x`, `${base}?size=128 2x`, `${base}?size=256 3x`].join(", ");
  }
  const szMatch = src.match(/(\/|_)(sz-?)(128|256)(\/|_|\.)/i);
  if (szMatch) {
    const at64 = src.replace(szMatch[0], `${szMatch[1]}${szMatch[2]}64${szMatch[4]}`);
    const at128 = src.replace(szMatch[0], `${szMatch[1]}${szMatch[2]}128${szMatch[4]}`);
    const at256 = src.replace(szMatch[0], `${szMatch[1]}${szMatch[2]}256${szMatch[4]}`);
    return [`${at64} 1x`, `${at128} 2x`, `${at256} 3x`].join(", ");
  }
  return "";
}

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); console.log("  ✓", name); passed++; }
  catch (e) { console.log("  ✗", name, "\n    ", e.message); failed++; }
}

console.log("buildSrcSet");
t("empty for undefined src", () => assert.equal(buildSrcSet(undefined), ""));
t("empty for data URI", () => assert.equal(buildSrcSet("data:image/svg+xml;base64,AAA"), ""));
t("empty for .svg URL", () => assert.equal(buildSrcSet("https://cdn.example.com/logos/tcs.svg"), ""));
t("Google favicon — 1x/2x/3x", () => {
  const r = buildSrcSet("https://www.google.com/s2/favicons?sz=128&domain=reliance.com");
  assert.match(r, /sz=64.*1x/);
  assert.match(r, /sz=128.*2x/);
  assert.match(r, /sz=256.*3x/);
});
t("Clearbit — 1x/2x/3x", () => {
  const r = buildSrcSet("https://logo.clearbit.com/apple.com?size=64");
  assert.match(r, /size=64 1x/);
  assert.match(r, /size=256 3x/);
});
t("Logo.dev — 1x/2x/3x", () => {
  const r = buildSrcSet("https://img.logo.dev/microsoft.com?size=48");
  assert.match(r, /size=128 2x/);
});
t("S3 sz-256 path rewritten to 1x/2x/3x", () => {
  const r = buildSrcSet("https://cdn.example.com/logos/sz-256/aapl.png");
  assert.match(r, /sz-64\/aapl\.png 1x/);
  assert.match(r, /sz-128\/aapl\.png 2x/);
  assert.match(r, /sz-256\/aapl\.png 3x/);
});
t("unknown CDN — empty srcset (safe default)", () => {
  assert.equal(buildSrcSet("https://static.example.com/tcs-logo.png"), "");
});

console.log(`\nbuildSrcSet: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
