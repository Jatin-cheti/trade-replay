import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "../backend/src/config/db";
import { SymbolModel } from "../backend/src/models/Symbol";
import { bootstrapSearchPrefixes } from "../backend/src/services/searchIntelligence.service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env"), override: false });
dotenv.config({ path: path.join(ROOT, ".env.secrets"), override: true });

async function run() {
  await connectDB();
  console.log("--- Bootstrap Search Prefixes Migration ---");
  const result = await bootstrapSearchPrefixes(2000);
  console.log("Updated:", result.updated, "symbols");

  const prefixTest = await SymbolModel.find({ searchPrefixes: "REL" }).select({ symbol: 1, fullSymbol: 1 }).limit(10).lean();
  console.log("Prefix search REL:", prefixTest.map((s: any) => s.fullSymbol).join(", "));

  const prefixAA = await SymbolModel.find({ searchPrefixes: "AA" }).select({ symbol: 1, fullSymbol: 1 }).limit(10).lean();
  console.log("Prefix search AA:", prefixAA.map((s: any) => s.fullSymbol).join(", "));

  process.exit(0);
}

run().catch((err) => { console.error("Migration failed:", err); process.exit(1); });
