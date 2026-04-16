/**
 * Clean API key leaks from icon URLs.
 * Run: node backend/scripts/cleanApiKeyLeaks.cjs
 */
const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/tradereplay';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('tradereplay');
  const symbols = db.collection('symbols');

  // Count how many have API keys in URLs
  const leakCount = await symbols.countDocuments({ iconUrl: /[?&]apikey=/i });
  console.log(`Found ${leakCount} documents with API key leaks in iconUrl`);

  if (leakCount === 0) {
    console.log('No leaks to clean!');
    await client.close();
    return;
  }

  let cleaned = 0;
  let batch = 0;
  const BATCH_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const docs = await symbols.find(
      { iconUrl: /[?&]apikey=/i },
      { projection: { _id: 1, iconUrl: 1, symbol: 1, companyDomain: 1 } },
    ).limit(BATCH_SIZE).toArray();

    if (docs.length === 0) {
      hasMore = false;
      break;
    }

    batch++;
    const ops = [];
    for (const doc of docs) {
      if (!doc.iconUrl) continue;
      // Remove apikey param
      let cleanedUrl = doc.iconUrl.replace(/[?&]apikey=[^&]+/gi, '');
      // Clean up leftover ? or &
      cleanedUrl = cleanedUrl.replace(/\?$/, '').replace(/&$/, '');
      
      if (cleanedUrl !== doc.iconUrl) {
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { iconUrl: cleanedUrl, logoVerificationStatus: 'repaired' } },
          },
        });
      }
    }

    if (ops.length > 0) {
      const result = await symbols.bulkWrite(ops, { ordered: false });
      cleaned += result.modifiedCount;
    }

    console.log(`Batch ${batch}: cleaned ${ops.length} docs (total: ${cleaned})`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total API key leaks cleaned: ${cleaned}`);

  // Verify none remain
  const remaining = await symbols.countDocuments({ iconUrl: /[?&]apikey=/i });
  console.log(`Remaining leaks: ${remaining}`);

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
