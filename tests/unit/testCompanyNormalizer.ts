/**
 * Unit tests for companyNormalizer.service.ts
 *
 * Run: npx tsx tests/unit/testCompanyNormalizer.ts
 */
import { normalizeName, deriveDomain, deriveDomainCandidates } from "../../backend/src/services/companyNormalizer.service";

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

// ── normalizeName ──
console.log("--- normalizeName ---");
assert("strips Ltd", normalizeName("Infosys Ltd"), "infosys");
assert("strips Limited", normalizeName("Tata Steel Limited"), "tata");
assert("strips Inc", normalizeName("Apple Inc"), "apple");
assert("strips Corp", normalizeName("Microsoft Corporation"), "microsoft");
assert("strips multiple suffixes", normalizeName("Bajaj Finance Holdings Ltd"), "bajaj");
assert("strips Industries", normalizeName("Reliance Industries Limited"), "reliance");
assert("strips Plc", normalizeName("HSBC Holdings Plc"), "hsbc");
assert("preserves core", normalizeName("Asian Paints"), "asian paints");
assert("handles empty", normalizeName(""), "");

// ── deriveDomain (backward compat) ──
console.log("\n--- deriveDomain ---");
assert("known: TCS", deriveDomain("Tata Consultancy Services Ltd"), "tcs.com");
assert("known: Infosys", deriveDomain("Infosys Limited"), "infosys.com");
assert("known: Apple", deriveDomain("Apple Inc"), "apple.com");
assert("known: HDFC Bank", deriveDomain("HDFC Bank Limited"), "hdfcbank.com");
assert("known: Meta", deriveDomain("Meta Platforms Inc"), "meta.com");
assert("known: Amazon", deriveDomain("Amazon.com Inc"), "amazon.com");
assert("known: Reliance", deriveDomain("Reliance Industries Limited"), "ril.com");
assert("known: Tesla", deriveDomain("Tesla Inc"), "tesla.com");
assert("known: NVIDIA", deriveDomain("NVIDIA Corporation"), "nvidia.com");
assert("known: Nestle India", deriveDomain("Nestle India Ltd"), "nestle.in");
assert("known: Hindustan Unilever", deriveDomain("Hindustan Unilever Limited"), "hul.co.in");
assert("known: Bharti Airtel", deriveDomain("Bharti Airtel Limited"), "airtel.in");
assert("fallback two words", deriveDomain("XYZ Unknown Corp"), "xyzunknown.com");
assert("null for short", deriveDomain("A"), null);

// ── deriveDomainCandidates ──
console.log("\n--- deriveDomainCandidates ---");

// Known map should return single high-confidence result
const tcsC = deriveDomainCandidates("Tata Consultancy Services Ltd");
assert("TCS candidates length", tcsC.length, 1);
assert("TCS candidate domain", tcsC[0]?.domain, "tcs.com");
assert("TCS candidate confidence", tcsC[0]?.confidence, "high");
assert("TCS candidate method", tcsC[0]?.method, "known_map");

// Unknown company with IN country should have country-specific TLDs
const unknownIN = deriveDomainCandidates("Acme Technologies Ltd", "IN");
assert("Indian company has multiple candidates", unknownIN.length > 1, true);
const inDomains = unknownIN.map(c => c.domain);
assert("Indian TLD .co.in present", inDomains.some(d => d.endsWith(".co.in")), true);
assert("Indian TLD .in present", inDomains.some(d => d.endsWith(".in")), true);

// Unknown US company defaults to .com
const unknownUS = deriveDomainCandidates("Acme Technologies Corp", "US");
assert("US company has .com", unknownUS.some(c => c.domain.endsWith(".com")), true);

// Empty / short inputs
assert("empty returns empty", deriveDomainCandidates("").length, 0);
assert("single char returns empty", deriveDomainCandidates("A").length, 0);

// ── deriveDomain with country hint ──
console.log("\n--- deriveDomain with country ---");
const indDerived = deriveDomain("Acme Technologies Ltd", "IN");
assert("Indian country derives .co.in", indDerived?.endsWith(".co.in") || indDerived?.endsWith(".in"), true);

const ukDerived = deriveDomain("Acme Technologies Plc", "GB");
assert("UK country derives .co.uk", ukDerived?.endsWith(".co.uk"), true);

const auDerived = deriveDomain("Acme Resources Ltd", "AU");
assert("AU country derives .com.au", auDerived?.endsWith(".com.au"), true);

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
