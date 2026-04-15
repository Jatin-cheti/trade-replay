import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import pLimit from "p-limit";
import { connectDB } from "../src/config/db";
import { SymbolModel } from "../src/models/Symbol";
import { resolveTrustedDomainMultiSource, isValidDomainForCompany, type DomainSource } from "../src/services/domain-intelligence.service";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_PATH = path.join(ROOT, "data", "domainDataset.json");
const LIMIT = Number(process.env.DOMAIN_ENRICH_LIMIT || 300);
const CONCURRENCY = Number(process.env.DOMAIN_ENRICH_CONCURRENCY || 10);

type RejectReason = "no_domain" | "invalid_domain" | "duplicate_domain" | "resolver_error";

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

async function main(): Promise<void> {
  await connectDB();

  const symbols = await SymbolModel.find({ type: "stock" })
    .sort({ priorityScore: -1, searchFrequency: -1 })
    .limit(LIMIT)
    .select({ symbol: 1, name: 1, exchange: 1, country: 1 })
    .lean<Array<{ symbol: string; name: string; exchange: string; country: string }>>();

  let dataset: Record<string, string> = {};
  try {
    dataset = JSON.parse(await fs.readFile(DATASET_PATH, "utf8")) as Record<string, string>;
  } catch {
    dataset = {};
  }

  const taken = new Map<string, string>();
  for (const [sym, dom] of Object.entries(dataset)) taken.set(dom, sym);

  let accepted = 0;
  let httpErrorTotal = 0;

  const sourceCount: Record<DomainSource, number> = {
    "static-map": 0,
    wikipedia: 0,
    "google-search": 0,
    "nse-profile": 0,
    "bse-profile": 0,
    "fmp-optional": 0,
  };

  const rejected: Record<RejectReason, number> = {
    no_domain: 0,
    invalid_domain: 0,
    duplicate_domain: 0,
    resolver_error: 0,
  };

  const examples: Partial<Record<RejectReason, Array<{ symbol: string; name: string; domain?: string }>>> = {};
  const captureExample = (reason: RejectReason, sample: { symbol: string; name: string; domain?: string }): void => {
    const bucket = examples[reason] || [];
    if (bucket.length < 5) bucket.push(sample);
    examples[reason] = bucket;
  };

  const limitFn = pLimit(CONCURRENCY);
  await Promise.allSettled(symbols.map((row) => limitFn(async () => {
    try {
      const resolved = await resolveTrustedDomainMultiSource({
        symbol: row.symbol,
        companyName: row.name,
        exchange: row.exchange,
      });

      httpErrorTotal += resolved.httpErrors;
      if (!resolved.domain || !resolved.source) {
        rejected.no_domain += 1;
        captureExample("no_domain", { symbol: row.symbol, name: row.name });
        return;
      }

      const normalizedDomain = normalizeDomain(resolved.domain);
      const valid = await isValidDomainForCompany(
        normalizedDomain,
        row.name,
        row.symbol,
        resolved.source === "static-map" ? 0 : 0.4,
        resolved.source === "static-map",
      );
      if (!valid) {
        rejected.invalid_domain += 1;
        captureExample("invalid_domain", { symbol: row.symbol, name: row.name, domain: normalizedDomain });
        return;
      }

      const existing = taken.get(normalizedDomain);
      if (existing && existing !== row.symbol.toUpperCase()) {
        rejected.duplicate_domain += 1;
        captureExample("duplicate_domain", { symbol: row.symbol, name: row.name, domain: normalizedDomain });
        return;
      }

      dataset[row.symbol.toUpperCase()] = normalizedDomain;
      taken.set(normalizedDomain, row.symbol.toUpperCase());
      sourceCount[resolved.source] += 1;
      accepted += 1;
    } catch {
      rejected.resolver_error += 1;
      captureExample("resolver_error", { symbol: row.symbol, name: row.name });
    }
  })));

  await fs.writeFile(DATASET_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        scanned: symbols.length,
        accepted,
        datasetSize: Object.keys(dataset).length,
        sourceCount,
        sourceDiversity: Object.values(sourceCount).filter((count) => count > 0).length >= 2,
        http_error: httpErrorTotal,
        rejected,
        examples,
      },
      null,
      2,
    ),
  );
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error("enrich_verified_domains_failed", err instanceof Error ? err.message : String(err));
  try {
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});


