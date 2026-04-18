/**
 * Logo enrichment script using logo.dev API
 * Usage: LOGO_DEV_TOKEN=sk_xxx node scripts/enrich-logos.cjs
 * 
 * Finds symbols with companyDomain but broken/missing/fallback logos,
 * generates logo.dev URLs, and updates both symbols and cleanassets.
 */
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const TOKEN = process.env.LOGO_DEV_TOKEN;
if (!TOKEN) {
  console.error("ERROR: Set LOGO_DEV_TOKEN env var");
  process.exit(1);
}

const BATCH_SIZE = 500;
const LOGO_URL = (domain) =>
  `https://img.logo.dev/${domain}?token=${TOKEN}&size=128&format=png`;

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symbols = db.collection("symbols");
  const cleanassets = db.collection("cleanassets");

  // Find symbols with a companyDomain that have no iconUrl or a google-favicon fallback
  const query = {
    companyDomain: { $nin: [null, ""] },
    $or: [
      { iconUrl: { $in: [null, ""] } },
      { iconUrl: { $regex: /google\.com\/s2\/favicons/i } },
      { iconUrl: { $regex: /clearbit\.com/i } },
    ],
  };

  const total = await symbols.countDocuments(query);
  console.log(`Found ${total} symbols needing logo enrichment`);

  let updated = 0;
  let failed = 0;
  const unresolved = [];

  const cursor = symbols.find(query, {
    projection: { symbol: 1, companyDomain: 1, fullSymbol: 1, exchange: 1, name: 1 },
  }).batchSize(BATCH_SIZE);

  const bulkSymOps = [];
  const bulkCAOps = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const domain = doc.companyDomain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (!domain || domain.includes(" ")) {
      unresolved.push({ symbol: doc.symbol, domain: doc.companyDomain, reason: "invalid domain" });
      failed++;
      continue;
    }

    const logoUrl = LOGO_URL(domain);

    bulkSymOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            iconUrl: logoUrl,
            logoStatus: "mapped",
            logoSource: "logo.dev",
            logoLastUpdated: new Date(),
          },
        },
      },
    });

    bulkCAOps.push({
      updateOne: {
        filter: { fullSymbol: doc.fullSymbol },
        update: {
          $set: {
            iconUrl: logoUrl,
            logoStatus: "mapped",
            logoLastUpdated: new Date(),
          },
        },
      },
    });

    updated++;

    // Flush in batches
    if (bulkSymOps.length >= BATCH_SIZE) {
      await symbols.bulkWrite(bulkSymOps, { ordered: false });
      await cleanassets.bulkWrite(bulkCAOps, { ordered: false });
      console.log(`  Processed ${updated} / ${total}...`);
      bulkSymOps.length = 0;
      bulkCAOps.length = 0;
    }
  }

  // Flush remaining
  if (bulkSymOps.length > 0) {
    await symbols.bulkWrite(bulkSymOps, { ordered: false });
    await cleanassets.bulkWrite(bulkCAOps, { ordered: false });
  }

  console.log(`\n=== Logo Enrichment Complete ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed/Invalid: ${failed}`);
  console.log(`Total unresolved: ${unresolved.length}`);

  if (unresolved.length > 0) {
    const fs = require("fs");
    fs.writeFileSync("/tmp/unresolved_logos.json", JSON.stringify(unresolved, null, 2));
    console.log(`Unresolved report written to /tmp/unresolved_logos.json`);
  }

  // Also update symbols that have s3Icon (CloudFront) but no logo.dev — keep s3Icon as-is
  // Just ensure they have logoStatus = mapped
  const s3Count = await symbols.updateMany(
    {
      s3Icon: { $nin: [null, ""] },
      iconUrl: { $regex: /cloudfront\.net/i },
    },
    { $set: { logoStatus: "mapped", logoSource: "s3-cdn" } }
  );
  console.log(`Marked ${s3Count.modifiedCount} S3/CloudFront logos as mapped`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
