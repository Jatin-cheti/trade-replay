/**
 * Unit tests for logoResolver.service.ts
 *
 * Run: npx tsx tests/unit/testLogoResolver.ts
 */
import { resolveLogo, isBadDomain, isLogoUrlSafe, type LogoResult } from "../../backend/src/services/logoResolver.service";

let passed = 0;
let failed = 0;

function assert(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(label: string, actual: string, substr: string) {
  if (actual.includes(substr)) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
    console.error(`    expected to include: ${substr}`);
    console.error(`    actual: ${actual}`);
  }
}

function assertNotIncludes(label: string, actual: string, substr: string) {
  if (!actual.includes(substr)) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
    console.error(`    expected NOT to include: ${substr}`);
    console.error(`    actual: ${actual}`);
  }
}

// ── TIER 0: Existing S3 logo ──
console.log("--- Tier 0: Existing logos ---");
const s3Result = resolveLogo({ symbol: "AAPL", type: "stock", s3Icon: "https://cdn.mycdn.com/logos/AAPL.webp" });
assert("S3 icon tier", s3Result.logoTier, 0);
assert("S3 icon source", s3Result.logoSource, "s3");
assert("S3 icon confidence", s3Result.logoConfidence, "high");
assertIncludes("S3 icon URL", s3Result.iconUrl, "cdn.mycdn.com");

const existingResult = resolveLogo({ symbol: "AAPL", type: "stock", iconUrl: "https://goodcdn.com/apple.png" });
assert("Existing icon tier", existingResult.logoTier, 0);
assert("Existing icon source", existingResult.logoSource, "existing");

// ── TIER 1: Symbol map ──
console.log("\n--- Tier 1: Symbol map ---");
const btcResult = resolveLogo({ symbol: "BTC", type: "crypto" });
assert("BTC tier", btcResult.logoTier, 1);
assert("BTC source", btcResult.logoSource, "symbolMap");
assert("BTC confidence", btcResult.logoConfidence, "high");

const btcusdtResult = resolveLogo({ symbol: "BTCUSDT", type: "crypto" });
assert("BTCUSDT resolves to BTC base", btcusdtResult.logoTier, 1);

// ── TIER 2: Type-based (crypto) ──
console.log("\n--- Tier 2: Type-based ---");
const unknownCrypto = resolveLogo({ symbol: "OBSCUREUSDT", type: "crypto" });
assert("Unknown crypto tier", unknownCrypto.logoTier, 2);
assertIncludes("Unknown crypto uses favicon", unknownCrypto.iconUrl, "google.com/s2/favicons");
assert("Unknown crypto confidence", unknownCrypto.logoConfidence, "low");

// Forex
const forexResult = resolveLogo({ symbol: "EURUSD", type: "forex" });
assert("Forex tier", forexResult.logoTier, 2);
assert("Forex source", forexResult.logoSource, "forex:flag");
assert("Forex confidence", forexResult.logoConfidence, "medium");

// ── TIER 3: Google Favicon with explicit domain ──
console.log("\n--- Tier 3: Google Favicon ---");
const googleDomainResult = resolveLogo({ symbol: "TEST", type: "stock", companyDomain: "tesla.com" });
assert("Google domain tier", googleDomainResult.logoTier, 3);
assertIncludes("Google Favicon URL", googleDomainResult.iconUrl, "google.com/s2/favicons");
assertIncludes("Google Favicon has tesla domain", googleDomainResult.iconUrl, "tesla.com");
assert("Google domain confidence", googleDomainResult.logoConfidence, "high");

// ── TIER 3b: Google Favicon derived from name ──
console.log("\n--- Tier 3b: Google Favicon derived ---");
const derivedResult = resolveLogo({ symbol: "INFY", type: "stock", name: "Infosys Limited" });
assert("Derived favicon tier", derivedResult.logoTier, 3);
assertIncludes("Derived uses google favicon", derivedResult.iconUrl, "google.com/s2/favicons");
assert("Derived confidence high (known map)", derivedResult.logoConfidence, "high");

// ── TIER 4: FMP image stock ──
console.log("\n--- Tier 4: FMP ---");
const fmpResult = resolveLogo({ symbol: "AAPL", type: "stock" });
assert("FMP tier", fmpResult.logoTier, 4);
assertIncludes("FMP URL", fmpResult.iconUrl, "financialmodelingprep.com/image-stock/AAPL.png");
assert("FMP confidence", fmpResult.logoConfidence, "medium");

// ── TIER 4b: Exchange favicon ──
console.log("\n--- Tier 4b: Exchange favicon ---");
const exchangeResult = resolveLogo({ symbol: "LONGNAME123", type: "stock", exchange: "NYSE" });
assert("Exchange favicon tier", exchangeResult.logoTier, 4);
assertIncludes("Exchange uses google favicon", exchangeResult.iconUrl, "google.com/s2/favicons");
assertIncludes("Exchange domain", exchangeResult.iconUrl, "nyse.com");
assert("Exchange confidence", exchangeResult.logoConfidence, "low");

// ── TIER 5: Generated SVG ──
console.log("\n--- Tier 5: Generated SVG ---");
const svgResult = resolveLogo({ symbol: "ZZZZZ", type: "derivative" });
assert("SVG tier", svgResult.logoTier, 5);
assert("SVG source", svgResult.logoSource, "generated");
assert("SVG confidence", svgResult.logoConfidence, "none");
assertIncludes("SVG is data URI", svgResult.iconUrl, "data:image/svg+xml;base64,");

// ── Wrong-Logo Guardrails ──
console.log("\n--- Guardrails: Bad domains ---");
assert("fmp is bad domain", isBadDomain("financialmodelingprep.com"), true);
assert("polygon is bad domain", isBadDomain("polygon.io"), true);
assert("yahoo is bad domain", isBadDomain("yahoo.com"), true);
assert("empty is bad domain", isBadDomain(""), true);
assert("null is bad domain", isBadDomain(null), true);
assert("undefined is bad domain", isBadDomain(undefined), true);
assert("short domain is bad", isBadDomain("ab"), true);
assert("apple.com is good domain", isBadDomain("apple.com"), false);
assert("tesla.com is good domain", isBadDomain("tesla.com"), false);

console.log("\n--- Guardrails: Dead CDN rejection ---");
const deadCdnResult = resolveLogo({ symbol: "AAPL", type: "stock", s3Icon: "https://dl142w45levth.cloudfront.net/AAPL.webp" });
assert("Dead CDN s3Icon rejected (not tier 0)", deadCdnResult.logoTier !== 0, true);
assertNotIncludes("Dead CDN not in result URL", deadCdnResult.iconUrl, "dl142w45levth.cloudfront.net");

console.log("\n--- Guardrails: Bad domain in existing iconUrl ---");
const badIconResult = resolveLogo({ symbol: "TEST", type: "stock", iconUrl: "https://financialmodelingprep.com/image-stock/TEST.png" });
assert("Provider-domain iconUrl rejected (not tier 0)", badIconResult.logoTier !== 0, true);

console.log("\n--- Guardrails: Bad companyDomain skipped ---");
const badCompanyDomain = resolveLogo({ symbol: "TEST", type: "stock", companyDomain: "financialmodelingprep.com" });
assert("Bad companyDomain skipped (not tier 3)", badCompanyDomain.logoTier !== 3 || !badCompanyDomain.iconUrl.includes("financialmodelingprep.com"), true);

// ── LogoResult interface ──
console.log("\n--- LogoResult fields ---");
const fullResult = resolveLogo({ symbol: "MSFT", type: "stock", name: "Microsoft Corporation" });
assert("has iconUrl", typeof fullResult.iconUrl, "string");
assert("has logoSource", typeof fullResult.logoSource, "string");
assert("has logoTier", typeof fullResult.logoTier, "number");
assert("has logoConfidence", typeof fullResult.logoConfidence, "string");

// ── isLogoUrlSafe function ──
console.log("\n--- isLogoUrlSafe ---");
assert("safe: normal CDN url", isLogoUrlSafe("https://cdn.example.org/logo.png"), true);
assert("safe: google favicon good domain", isLogoUrlSafe("https://www.google.com/s2/favicons?sz=128&domain=apple.com"), true);
assert("unsafe: dead CDN", isLogoUrlSafe("https://dl142w45levth.cloudfront.net/logo.png"), false);
assert("unsafe: bad domain in google favicon", isLogoUrlSafe("https://www.google.com/s2/favicons?sz=128&domain=financialmodelingprep.com"), false);
assert("unsafe: provider domain", isLogoUrlSafe("https://financialmodelingprep.com/image.png"), false);
assert("unsafe: empty string", isLogoUrlSafe(""), false);
assert("unsafe: non-http", isLogoUrlSafe("not-a-url"), false);

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
