/**
 * Random Logo QA Test — Tests 500 random symbols from clean_assets
 *
 * Checks:
 * 1. Every asset has an icon URL
 * 2. No API key leaks in URLs
 * 3. No fallback/generic icons
 * 4. Domain matches company
 * 5. Icon URL is reachable (HTTP HEAD check)
 *
 * Usage: npx tsx scripts/randomLogoQA.ts [--count=500] [--check-http]
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../../.env");
const secretsPath = path.resolve(__dirname, "../../../.env.secrets");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
if (fs.existsSync(secretsPath)) dotenv.config({ path: secretsPath, override: true });

const MONGO_URI = process.env.MONGO_URI_LOCAL || "mongodb://127.0.0.1:27017/tradereplay";
const SAMPLE_COUNT = parseInt(process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] || "500", 10);
const CHECK_HTTP = process.argv.includes("--check-http");

interface QAResult {
  symbol: string;
  fullSymbol: string;
  type: string;
  exchange: string;
  status: "pass" | "fail";
  issues: string[];
  iconUrl: string;
  domain: string;
}

async function main() {
  console.log(`\n=== RANDOM LOGO QA TEST ===`);
  console.log(`Sample size: ${SAMPLE_COUNT}`);
  console.log(`HTTP check: ${CHECK_HTTP}\n`);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const cleanCol = db.collection("clean_assets");

  const total = await cleanCol.countDocuments();
  console.log(`Clean assets: ${total.toLocaleString()}`);

  if (total === 0) {
    console.log("ERROR: No clean_assets. Run buildCleanAssets.ts first.");
    process.exit(1);
  }

  // Random sample
  const sample = await cleanCol.aggregate([
    { $sample: { size: SAMPLE_COUNT } },
  ]).toArray();

  console.log(`Sampled: ${sample.length}\n`);

  const results: QAResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const doc of sample) {
    const issues: string[] = [];

    // Check 1: Has icon URL
    if (!doc.iconUrl || doc.iconUrl.trim() === "") {
      issues.push("missing_icon");
    }

    // Check 2: No API key leaks
    if (doc.iconUrl && /apikey=/i.test(doc.iconUrl)) {
      issues.push("api_key_leak");
    }

    // Check 3: Not a fallback/generic icon
    if (doc.iconUrl) {
      const url = doc.iconUrl.toLowerCase();
      if (url.includes("placeholder") || url.includes("default-icon") || url.includes("no-logo")) {
        issues.push("fallback_icon");
      }
    }

    // Check 4: Domain-icon consistency
    if (doc.companyDomain && doc.iconUrl) {
      if (doc.iconUrl.includes("google.com/s2/favicons")) {
        const match = doc.iconUrl.match(/domain=([^&]+)/);
        if (match && match[1] !== doc.companyDomain) {
          issues.push(`domain_mismatch: icon=${match[1]} expected=${doc.companyDomain}`);
        }
      }
    }

    // Check 5: Logo verification status — only fail on "fallback", not "suspect"
    if (doc.logoVerificationStatus === "fallback") {
      issues.push(`status_${doc.logoVerificationStatus}`);
    }

    // Check 6: HTTP reachability (if enabled)
    if (CHECK_HTTP && doc.iconUrl && issues.length === 0) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(doc.iconUrl, {
          method: "HEAD",
          signal: controller.signal,
          headers: { "User-Agent": "TradeReplay-QA/1.0" },
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          issues.push(`http_${resp.status}`);
        }
      } catch (err: any) {
        issues.push(`http_error: ${err.message?.slice(0, 50)}`);
      }
    }

    const status = issues.length === 0 ? "pass" : "fail";
    if (status === "pass") passed++;
    else failed++;

    results.push({
      symbol: doc.symbol,
      fullSymbol: doc.fullSymbol,
      type: doc.type,
      exchange: doc.exchange,
      status,
      issues,
      iconUrl: (doc.iconUrl || "").slice(0, 80),
      domain: doc.companyDomain || "",
    });
  }

  // Report failures
  const failures = results.filter((r) => r.status === "fail");
  if (failures.length > 0) {
    console.log(`\n--- FAILURES (${failures.length}) ---`);
    for (const f of failures.slice(0, 50)) {
      console.log(`  ✗ ${f.symbol} (${f.type}/${f.exchange}): ${f.issues.join(", ")}`);
    }
    if (failures.length > 50) {
      console.log(`  ... and ${failures.length - 50} more`);
    }
  }

  // Issue breakdown
  const issueBreakdown: Record<string, number> = {};
  for (const r of results) {
    for (const issue of r.issues) {
      const key = issue.split(":")[0];
      issueBreakdown[key] = (issueBreakdown[key] || 0) + 1;
    }
  }

  if (Object.keys(issueBreakdown).length > 0) {
    console.log(`\nIssue breakdown:`);
    for (const [issue, count] of Object.entries(issueBreakdown).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${issue}: ${count}`);
    }
  }

  // Summary
  const passRate = ((passed / sample.length) * 100).toFixed(1);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Pass: ${passed} / ${sample.length} (${passRate}%)`);
  console.log(`Fail: ${failed} / ${sample.length}`);
  console.log(parseFloat(passRate) >= 99 ? "✓ QA PASSED" : "✗ QA NEEDS WORK");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
