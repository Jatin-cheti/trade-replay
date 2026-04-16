import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { connectRedis, redisClient, isRedisReady } from "../config/redis";
import { SymbolModel } from "../models/Symbol";
import {
  verifySymbolLogo,
  propagateBrandLogo,
  computeBrandId,
  hashLogoUrl,
} from "../services/logoAuthority.service";
import { googleFaviconUrl, normalizeDomain, normalizeSymbol, CRYPTO_ICON_MAP, extractCryptoBaseSymbol } from "../services/logo.helpers";
import { inferDomainWithConfidence } from "../services/domainConfidence.service";
import { getHighConfidenceDomain } from "../config/highConfidenceDomainMap";
import { logger } from "../utils/logger";

const BATCH_SIZE = 500;
const MAX_BATCHES = 200;
const DRY_RUN = process.argv.includes("--dry-run");

interface RunStats {
  totalScanned: number;
  correct: number;
  fixedDomain: number;
  fixedApiKeyLeak: number;
  fixedMissing: number;
  fixedWrongLogo: number;
  propagated: number;
  unfixable: number;
  elapsed: number;
}

function getExpectedDomain(symbol: string, name: string): string | null {
  const sym = normalizeSymbol(symbol);
  const hardcoded = getHighConfidenceDomain(sym);
  if (hardcoded) return normalizeDomain(hardcoded);
  const inference = inferDomainWithConfidence({ symbol: sym, name });
  if (inference.domain && inference.confidence >= 0.95) return normalizeDomain(inference.domain);
  return null;
}

async function fixAndPropagate(doc: {
  symbol: string;
  fullSymbol: string;
  name: string;
  type: string;
  iconUrl?: string;
  companyDomain?: string;
}, expectedDomain: string, logoUrl: string): Promise<number> {
  if (DRY_RUN) return 0;

  await SymbolModel.updateOne(
    { fullSymbol: doc.fullSymbol },
    {
      $set: {
        iconUrl: logoUrl,
        companyDomain: expectedDomain,
        logoValidatedAt: new Date(),
        logoVerificationStatus: "validated",
        logoQualityScore: 99,
      },
    },
  );

  const propagated = await propagateBrandLogo(doc.symbol, expectedDomain, logoUrl);
  return propagated;
}

async function main(): Promise<void> {
  console.log(`\n=== LOGO AUTHORITY MASS VALIDATION ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE (will fix)"}`);
  console.log(`Batch size: ${BATCH_SIZE}, Max batches: ${MAX_BATCHES}\n`);

  await connectDB();
  await connectRedis();

  const stats: RunStats = {
    totalScanned: 0, correct: 0, fixedDomain: 0, fixedApiKeyLeak: 0,
    fixedMissing: 0, fixedWrongLogo: 0, propagated: 0, unfixable: 0, elapsed: 0,
  };

  const startTime = Date.now();
  let lastId: mongoose.Types.ObjectId | null = null;
  let batch = 0;

  while (batch < MAX_BATCHES) {
    batch += 1;

    const filter: mongoose.FilterQuery<unknown> = {
      type: { $nin: ["derivative"] },
    };
    if (lastId) {
      filter._id = { $gt: lastId };
    }

    const docs = await SymbolModel.find(filter)
      .select({
        _id: 1, symbol: 1, fullSymbol: 1, name: 1, type: 1, exchange: 1,
        iconUrl: 1, s3Icon: 1, companyDomain: 1, priorityScore: 1,
      })
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        symbol: string; fullSymbol: string; name: string; type: string; exchange?: string;
        iconUrl?: string; s3Icon?: string; companyDomain?: string;
      }>>();

    if (docs.length === 0) break;
    lastId = docs[docs.length - 1]._id;

    for (const doc of docs) {
      stats.totalScanned += 1;
      const verification = verifySymbolLogo(doc);

      switch (verification.status) {
        case "correct":
          stats.correct += 1;
          break;

        case "api_key_leak": {
          const expectedDomain = getExpectedDomain(doc.symbol, doc.name);
          if (expectedDomain) {
            const logo = googleFaviconUrl(expectedDomain);
            const p = await fixAndPropagate(doc, expectedDomain, logo);
            stats.fixedApiKeyLeak += 1;
            stats.propagated += p;
          } else {
            // Strip API key even if no known domain
            if (!DRY_RUN && doc.iconUrl) {
              const cleanUrl = doc.iconUrl.replace(/[?&]apikey=[^&]+/gi, "");
              await SymbolModel.updateOne(
                { fullSymbol: doc.fullSymbol },
                { $set: { iconUrl: cleanUrl, logoVerificationStatus: "validated" } },
              );
              stats.fixedApiKeyLeak += 1;
            }
          }
          break;
        }

        case "wrong_domain": {
          if (verification.fixedDomain && verification.fixedIconUrl) {
            const p = await fixAndPropagate(doc, verification.fixedDomain, verification.fixedIconUrl);
            stats.fixedDomain += 1;
            stats.propagated += p;
          } else {
            stats.unfixable += 1;
          }
          break;
        }

        case "wrong_logo": {
          if (verification.fixedIconUrl) {
            if (!DRY_RUN) {
              await SymbolModel.updateOne(
                { fullSymbol: doc.fullSymbol },
                {
                  $set: {
                    iconUrl: verification.fixedIconUrl,
                    logoValidatedAt: new Date(),
                    logoVerificationStatus: "validated",
                    logoQualityScore: 99,
                  },
                },
              );
            }
            stats.fixedWrongLogo += 1;
          } else {
            stats.unfixable += 1;
          }
          break;
        }

        case "missing":
          stats.fixedMissing += 1;
          stats.unfixable += 1;
          break;

        case "fallback":
          stats.unfixable += 1;
          break;
      }
    }

    // Event loop yield
    await new Promise((resolve) => setImmediate(resolve));

    if (batch % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Batch ${batch}: scanned=${stats.totalScanned} correct=${stats.correct} fixed=${stats.fixedDomain + stats.fixedApiKeyLeak + stats.fixedWrongLogo} unfixable=${stats.unfixable} (${elapsed}s)`);
    }
  }

  stats.elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n=== RESULTS ===`);
  console.log(JSON.stringify(stats, null, 2));

  // Summary by type
  const byType = await SymbolModel.aggregate([
    { $match: { type: { $nin: ["derivative"] } } },
    {
      $group: {
        _id: "$type",
        total: { $sum: 1 },
        withLogo: { $sum: { $cond: [{ $and: [{ $ne: ["$iconUrl", ""] }, { $ne: ["$iconUrl", null] }] }, 1, 0] } },
        validated: { $sum: { $cond: [{ $eq: ["$logoVerificationStatus", "validated"] }, 1, 0] } },
      },
    },
    { $sort: { total: -1 } },
  ]);

  console.log("\n=== COVERAGE BY TYPE ===");
  for (const row of byType) {
    const coverage = row.total > 0 ? ((row.withLogo / row.total) * 100).toFixed(1) : "0.0";
    console.log(`${row._id}: ${row.withLogo}/${row.total} (${coverage}%) | validated: ${row.validated}`);
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("LOGO VALIDATION FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
