import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { DomainDatasetModel } from "../src/models/DomainDataset";
import { SymbolModel } from "../src/models/Symbol";
import { logger } from "../src/utils/logger";

function normalizeDomain(urlOrDomain?: string | null): string | null {
  if (!urlOrDomain) return null;
  const input = urlOrDomain.trim();
  if (!input) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const hostname = new URL(withProtocol).hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");
    if (!domain || !domain.includes(".")) return null;
    return domain;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  await connectDB();

  const docs = await SymbolModel.find({
    iconUrl: { $exists: true, $nin: [null, ""] },
    website: { $exists: true, $nin: [null, ""] },
  })
    .select({ fullSymbol: 1, name: 1, exchange: 1, website: 1 })
    .lean()
    .exec();

  let scanned = 0;
  let upserted = 0;

  for (const doc of docs as Array<{ fullSymbol: string; name?: string; exchange?: string; website?: string }>) {
    scanned += 1;

    const domain = normalizeDomain(doc.website);
    if (!domain) continue;

    const source = doc.exchange?.toLowerCase() === "sec" ? "sec" : "auto";

    await DomainDatasetModel.updateOne(
      { fullSymbol: doc.fullSymbol.toUpperCase() },
      {
        $set: {
          symbol: doc.fullSymbol.split(":").pop() || doc.fullSymbol,
          fullSymbol: doc.fullSymbol.toUpperCase(),
          companyName: doc.name ?? "",
          exchange: doc.exchange ?? "",
          domain,
          source,
          confidence: source === "sec" ? 0.98 : 0.9,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    upserted += 1;
  }

  logger.info("domain_dataset_auto_builder_complete", { scanned, upserted });
}

main()
  .catch((error) => {
    logger.error("domain_dataset_auto_builder_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
