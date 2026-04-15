/**
 * validateDataIntegrity.ts — Production data integrity checker.
 *
 * Run: npx tsx backend/scripts/validateDataIntegrity.ts
 *
 * Validates:
 *   1. Symbol count ≥ target thresholds
 *   2. No duplicate fullSymbol entries
 *   3. Every category has symbols
 *   4. Clean assets populated (≥100K target)
 *   5. Ingestion state healthy (no stuck runs)
 *   6. Index health
 *   7. Logo coverage check
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

interface CheckResult {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, status: "PASS" | "WARN" | "FAIL", detail: string) {
  results.push({ name, status, detail });
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "⚠" : "✗";
  console.log(`  ${icon} [${status}] ${name}: ${detail}`);
}

async function run() {
  console.log("\n═══ Data Integrity Validation ═══\n");
  console.log(`MongoDB: ${MONGO_URI}\n`);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  // 1. Symbol count
  const symbolCount = await db.collection("symbols").countDocuments();
  if (symbolCount >= 100_000) {
    check("Symbol count", "PASS", `${symbolCount.toLocaleString()} symbols (≥100K)`);
  } else if (symbolCount >= 10_000) {
    check("Symbol count", "WARN", `${symbolCount.toLocaleString()} symbols (target: ≥100K)`);
  } else {
    check("Symbol count", "FAIL", `${symbolCount.toLocaleString()} symbols (way below 100K)`);
  }

  // 2. Duplicate check
  const dupPipeline = [
    { $group: { _id: "$fullSymbol", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "duplicates" },
  ];
  const dupResult = await db.collection("symbols").aggregate(dupPipeline).toArray();
  const dupes = dupResult[0]?.duplicates ?? 0;
  if (dupes === 0) {
    check("No duplicates", "PASS", "0 duplicate fullSymbol entries");
  } else {
    check("No duplicates", "FAIL", `${dupes} duplicate fullSymbol groups found`);
  }

  // 3. Category coverage
  const EXPECTED_TYPES = ["stock", "etf", "crypto", "forex", "index", "bond", "economy", "derivative"];
  const typeCounts = await db.collection("symbols").aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const typeMap = new Map(typeCounts.map(t => [t._id, t.count]));
  const missingTypes = EXPECTED_TYPES.filter(t => !typeMap.has(t) || typeMap.get(t) === 0);

  if (missingTypes.length === 0) {
    const breakdown = typeCounts.map(t => `${t._id}: ${t.count.toLocaleString()}`).join(", ");
    check("Category coverage", "PASS", breakdown);
  } else {
    check("Category coverage", "FAIL", `Missing types: ${missingTypes.join(", ")}`);
  }

  // 4. Clean assets check
  const collections = await db.listCollections().toArray();
  const hasCleanAssets = collections.some(c => c.name === "cleanassets");
  if (hasCleanAssets) {
    const cleanCount = await db.collection("cleanassets").countDocuments();
    if (cleanCount >= 100_000) {
      check("Clean assets", "PASS", `${cleanCount.toLocaleString()} verified clean assets`);
    } else if (cleanCount > 0) {
      check("Clean assets", "WARN", `${cleanCount.toLocaleString()} clean assets (target: ≥100K)`);
    } else {
      check("Clean assets", "FAIL", "Clean assets collection empty — run buildCleanAssets()");
    }
  } else {
    check("Clean assets", "WARN", "cleanassets collection not yet created");
  }

  // 5. Ingestion state check
  const hasIngestionStates = collections.some(c => c.name === "ingestionstates");
  if (hasIngestionStates) {
    const stuckRuns = await db.collection("ingestionstates").countDocuments({
      status: "running",
      lastSyncedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) }, // >1h
    });
    if (stuckRuns === 0) {
      const states = await db.collection("ingestionstates").find().toArray();
      const stateInfo = states.map(s => `${s.provider}: ${s.status}`).join(", ");
      check("Ingestion state", "PASS", stateInfo || "No ingestion runs recorded yet");
    } else {
      check("Ingestion state", "WARN", `${stuckRuns} stuck ingestion runs (>1h in 'running' state)`);
    }
  } else {
    check("Ingestion state", "PASS", "No ingestion state collection yet (first run)");
  }

  // 6. Index health
  const symbolIndexes = await db.collection("symbols").indexes();
  const hasFullSymbolIdx = symbolIndexes.some((idx: Record<string, unknown>) => {
    const key = idx.key as Record<string, unknown>;
    return key.fullSymbol !== undefined;
  });
  const hasPriorityIdx = symbolIndexes.some((idx: Record<string, unknown>) => {
    const key = idx.key as Record<string, unknown>;
    return key.priorityScore !== undefined;
  });

  if (hasFullSymbolIdx && hasPriorityIdx) {
    check("Index health", "PASS", `${symbolIndexes.length} indexes on symbols (fullSymbol ✓, priorityScore ✓)`);
  } else {
    check("Index health", "WARN", `Missing key indexes — fullSymbol: ${hasFullSymbolIdx}, priorityScore: ${hasPriorityIdx}`);
  }

  // 7. Logo coverage
  const withLogo = await db.collection("symbols").countDocuments({
    $or: [
      { iconUrl: { $exists: true, $ne: "" } },
      { s3Icon: { $exists: true, $ne: "" } },
    ],
  });
  const logoPct = symbolCount > 0 ? ((withLogo / symbolCount) * 100).toFixed(1) : "0";
  if (parseFloat(logoPct) >= 50) {
    check("Logo coverage", "PASS", `${withLogo.toLocaleString()} / ${symbolCount.toLocaleString()} (${logoPct}%)`);
  } else if (parseFloat(logoPct) >= 10) {
    check("Logo coverage", "WARN", `${withLogo.toLocaleString()} / ${symbolCount.toLocaleString()} (${logoPct}%)`);
  } else {
    check("Logo coverage", "WARN", `${withLogo.toLocaleString()} / ${symbolCount.toLocaleString()} (${logoPct}%) — low but may be expected early`);
  }

  // 8. GlobalSymbolMaster check
  const masterCount = await db.collection("globalsymbolmasters").countDocuments();
  check("GlobalSymbolMaster", masterCount > 0 ? "PASS" : "WARN",
    `${masterCount.toLocaleString()} entries in global master registry`);

  // ── Summary ──
  console.log("\n═══ Summary ═══\n");
  const passes = results.filter(r => r.status === "PASS").length;
  const warns = results.filter(r => r.status === "WARN").length;
  const fails = results.filter(r => r.status === "FAIL").length;
  console.log(`  ${passes} passed, ${warns} warnings, ${fails} failed out of ${results.length} checks\n`);

  if (fails > 0) {
    console.log("  ❌ INTEGRITY CHECK FAILED — fix the issues above before deploying.\n");
    process.exitCode = 1;
  } else if (warns > 0) {
    console.log("  ⚠ INTEGRITY CHECK PASSED WITH WARNINGS — review before deploying.\n");
  } else {
    console.log("  ✅ ALL CHECKS PASSED — safe to deploy.\n");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Validation script failed:", err);
  process.exitCode = 1;
});
