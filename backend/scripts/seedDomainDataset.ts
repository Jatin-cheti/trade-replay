import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { connectDB } from "../src/config/db";
import { SymbolModel } from "../src/models/Symbol";
import { DomainMemoryModel } from "../src/models/DomainMemory";
import { normalizeSymbol } from "../utils/normalizeSymbol";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_PATH = path.join(ROOT, "data", "domainDataset.json");

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function extractBaseSymbol(symbol: string): string {
  const [head] = normalizeSymbol(symbol).split(/[-.$]/);
  return head || normalizeSymbol(symbol);
}

function isValidDomain(domain: string): boolean {
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain) && !domain.includes(" ");
}

async function loadDataset(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(DATASET_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed;
  } catch {
    return {};
  }
}

function upsert(dataset: Record<string, string>, symbol: string, domain: string): boolean {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedSymbol || !normalizedDomain || !isValidDomain(normalizedDomain)) return false;
  if (dataset[normalizedSymbol] === normalizedDomain) return false;
  dataset[normalizedSymbol] = normalizedDomain;
  return true;
}

async function seedFromSymbols(dataset: Record<string, string>): Promise<number> {
  const symbols = await SymbolModel.find({
    companyDomain: { $exists: true, $ne: "" },
  })
    .select({ symbol: 1, companyDomain: 1 })
    .lean<Array<{ symbol: string; companyDomain: string }>>();

  let count = 0;
  for (const row of symbols) {
    if (upsert(dataset, row.symbol, row.companyDomain)) count += 1;
  }
  return count;
}

async function seedFromDomainMemory(dataset: Record<string, string>): Promise<number> {
  const rows = await DomainMemoryModel.find({
    domain: { $exists: true, $ne: "" },
  })
    .sort({ confidence: -1 })
    .select({ symbol: 1, baseSymbol: 1, domain: 1 })
    .lean<Array<{ symbol: string; baseSymbol: string; domain: string }>>();

  let count = 0;
  for (const row of rows) {
    if (upsert(dataset, row.symbol, row.domain)) count += 1;
    if (upsert(dataset, row.baseSymbol, row.domain)) count += 1;
  }
  return count;
}

async function seedTopByCountry(dataset: Record<string, string>, country: "IN" | "US", limit: number): Promise<number> {
  const exchanges = country === "IN" ? ["NSE", "BSE"] : ["NASDAQ", "NYSE", "NYSEARCA", "AMEX"];

  const rows = await SymbolModel.find({
    type: "stock",
    country,
    exchange: { $in: exchanges },
    companyDomain: { $exists: true, $ne: "" },
  })
    .sort({ priorityScore: -1 })
    .limit(limit)
    .select({ symbol: 1, companyDomain: 1 })
    .lean<Array<{ symbol: string; companyDomain: string }>>();

  let count = 0;
  for (const row of rows) {
    if (upsert(dataset, row.symbol, row.companyDomain)) count += 1;
  }
  return count;
}

async function main(): Promise<void> {
  await connectDB();

  const dataset = await loadDataset();
  const before = Object.keys(dataset).length;

  const [fromSymbols, fromMemory, fromIN, fromUS] = await Promise.all([
    seedFromSymbols(dataset),
    seedFromDomainMemory(dataset),
    seedTopByCountry(dataset, "IN", 500),
    seedTopByCountry(dataset, "US", 500),
  ]);

  const keys = Object.keys(dataset).sort();
  const ordered: Record<string, string> = {};
  for (const key of keys) {
    ordered[key] = dataset[key]!;
  }

  await fs.mkdir(path.dirname(DATASET_PATH), { recursive: true });
  await fs.writeFile(DATASET_PATH, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

  const after = keys.length;
  console.log(JSON.stringify({
    before,
    after,
    added: after - before,
    sources: {
      fromSymbols,
      fromMemory,
      topIN500: fromIN,
      topUS500: fromUS,
    },
    datasetPath: DATASET_PATH,
  }, null, 2));

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error("seed_domain_dataset_failed", error instanceof Error ? error.message : String(error));
  try {
    await mongoose.connection.close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
