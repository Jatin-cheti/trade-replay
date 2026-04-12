import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { SymbolModel } from "../src/models/Symbol";
import { DomainMemoryModel } from "../src/models/DomainMemory";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_PATH = path.join(ROOT, "data", "domainDataset.json");
const EXPLICIT_BAD = new Set(["tgroup.com", "agroup.com"]);
const GENERIC_TERMS = ["group", "global", "holding", "holdings", "service", "services"];

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericDomain(domain: string): boolean {
  const root = normalizeDomain(domain).split(".")[0] || "";
  return !root || root.length <= 1 || GENERIC_TERMS.some((term) => root.includes(term));
}

async function main(): Promise<void> {
  await connectDB();

  const duplicateRows = await SymbolModel.aggregate<Array<{ _id: string; names: string[]; count: number }>>([
    { $match: { companyDomain: { $exists: true, $ne: "" } } },
    { $project: { companyDomain: { $toLower: "$companyDomain" }, name: "$name" } },
    { $group: { _id: "$companyDomain", names: { $addToSet: "$name" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  const duplicateDomains = new Set<string>();
  for (const row of duplicateRows) {
    const names = new Set(row.names.map((name) => normalizeName(name)).filter(Boolean));
    if (names.size > 1) {
      duplicateDomains.add(normalizeDomain(row._id));
    }
  }

  const allDomainRows = await SymbolModel.find({ companyDomain: { $exists: true, $ne: "" } })
    .select({ companyDomain: 1 })
    .lean<Array<{ companyDomain: string }>>();

  const badDomains = new Set<string>([...EXPLICIT_BAD, ...duplicateDomains]);
  for (const row of allDomainRows) {
    const normalized = normalizeDomain(row.companyDomain);
    if (isGenericDomain(normalized)) {
      badDomains.add(normalized);
    }
  }

  const badList = Array.from(badDomains);

  const reset = await SymbolModel.updateMany(
    { companyDomain: { $in: badList } },
    {
      $set: {
        iconUrl: "",
        s3Icon: "",
        companyDomain: "",
        logoAttempts: 0,
        lastLogoAttemptAt: Date.now(),
      },
      $unset: { logoValidatedAt: "" },
    },
  );

  const memoryDelete = await DomainMemoryModel.deleteMany({ domain: { $in: badList } });

  let dataset: Record<string, string> = {};
  try {
    dataset = JSON.parse(await fs.readFile(DATASET_PATH, "utf8")) as Record<string, string>;
  } catch {
    dataset = {};
  }

  const before = Object.keys(dataset).length;
  let removed = 0;
  for (const [symbol, domain] of Object.entries(dataset)) {
    const normalized = normalizeDomain(domain);
    if (badDomains.has(normalized) || isGenericDomain(normalized)) {
      delete dataset[symbol];
      removed += 1;
    }
  }

  await fs.writeFile(DATASET_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    badDomains: badList.length,
    duplicateDomains: duplicateDomains.size,
    resetSymbols: reset.modifiedCount,
    deletedDomainMemory: memoryDelete.deletedCount,
    datasetBefore: before,
    datasetRemoved: removed,
    datasetAfter: Object.keys(dataset).length,
  }, null, 2));

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error("cleanup_fake_domains_failed", error instanceof Error ? error.message : String(error));
  try {
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
