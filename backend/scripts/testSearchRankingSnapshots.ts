import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { searchSymbols } from "../src/services/symbol.service";
import { intelligentSearch } from "../src/services/searchIntelligence.service";

type SnapshotCase = {
  query: string;
  expectedTopFullSymbols: string[];
  rejectDerivativeInTop?: number;
};

type SnapshotFile = {
  casesByEnv: Record<string, SnapshotCase[]>;
};

function loadSnapshot(): SnapshotFile {
  const filePath = path.resolve(process.cwd(), "scripts", "searchRankingSnapshot.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as SnapshotFile;
}

function isDerivativeLike(exchange: string, symbol: string): boolean {
  const ex = (exchange || "").toUpperCase();
  const s = (symbol || "").toUpperCase();
  return ex === "OPT"
    || ex === "DERIV"
    || ex === "CFD"
    || /-F-\d{6}/.test(s)
    || /-\d{6}-[CP]-/.test(s)
    || s.includes("-PERP")
    || s.includes("-FUT");
}

function assertTopSnapshot(caseItem: SnapshotCase, actualTop: string[]): void {
  const expected = caseItem.expectedTopFullSymbols;
  if (expected.length !== actualTop.length) {
    throw new Error(`Snapshot length mismatch for query '${caseItem.query}': expected ${expected.length}, got ${actualTop.length}`);
  }

  for (let i = 0; i < expected.length; i += 1) {
    if (actualTop[i] !== expected[i]) {
      throw new Error(
        `Ranking drift for query '${caseItem.query}' at rank ${i + 1}: expected '${expected[i]}', got '${actualTop[i]}'`,
      );
    }
  }
}

async function runCase(caseItem: SnapshotCase): Promise<void> {
  const result = await searchSymbols({
    query: caseItem.query,
    limit: Math.max(12, caseItem.expectedTopFullSymbols.length),
  });

  const actualTop = result.items.slice(0, caseItem.expectedTopFullSymbols.length).map((item) => item.fullSymbol);
  assertTopSnapshot(caseItem, actualTop);

  const rejectTop = Math.max(0, caseItem.rejectDerivativeInTop ?? 0);
  if (rejectTop > 0) {
    const hasDerivative = result.items.slice(0, rejectTop).some((item) => isDerivativeLike(item.exchange, item.symbol) || Boolean(item.isSynthetic));
    if (hasDerivative) {
      throw new Error(`Derivative/synthetic symbol found in top ${rejectTop} for query '${caseItem.query}'`);
    }
  }

  const scoreResult = await intelligentSearch({ query: caseItem.query, limit: 10 });
  const invalidScore = scoreResult.items.some((item) => !Number.isFinite(item._baseScore) || !Number.isFinite(item._score));
  if (invalidScore) {
    throw new Error(`Invalid score detected (NaN/Infinity) for query '${caseItem.query}'`);
  }

  console.log(`PASS ${caseItem.query}: ${actualTop.join(" | ")}`);
}

async function main(): Promise<void> {
  const snapshot = loadSnapshot();
  const envKey = (process.env.APP_ENV || "").toLowerCase() === "production" ? "production" : "default";
  const cases = snapshot.casesByEnv?.[envKey] ?? snapshot.casesByEnv?.default;

  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error(`searchRankingSnapshot.json has no cases for env '${envKey}'`);
  }

  await connectDB();
  for (const caseItem of cases) {
    await runCase(caseItem);
  }
  await mongoose.connection.close();
  console.log("All ranking snapshots passed.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore close failures
  }
  process.exit(1);
});
