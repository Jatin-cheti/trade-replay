/**
 * Market cap enrichment using yahoo-finance2 npm package
 * Usage: node scripts/enrich-marketcap-v2.cjs
 * 
 * Uses the yahoo-finance2 package which handles crumb/cookie auth automatically.
 * Enriches marketCap + volume for symbols where marketCap is 0/null.
 */
const { MongoClient } = require("mongodb");
const yahooFinance = require("yahoo-finance2").default;

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const BATCH_SIZE = 20;
const DELAY_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Suppress yahoo-finance2 validation warnings
yahooFinance.suppressNotices(["yahooSurvey"]);

// Map exchange codes to Yahoo Finance suffix
const EXCHANGE_SUFFIX = {
  NSE: ".NS",
  BSE: ".BO",
  TSE: ".T",
  HKEX: ".HK",
  LSE: ".L",
  ASX: ".AX",
  TSX: ".TO",
  XETRA: ".DE",
  FRA: ".F",
  EURONEXT: ".PA",
  KRX: ".KS",
  SGX: ".SI",
  TWSE: ".TW",
  SET: ".BK",
  JSE: ".JO",
  SAU: ".SAU",
};

function yahooTicker(symbol, exchange) {
  const suffix = EXCHANGE_SUFFIX[exchange] || "";
  if (["NYSE", "NASDAQ", "AMEX", "CFD", "NYSEARCA", "BATS"].includes(exchange)) return symbol;
  return `${symbol}${suffix}`;
}

async function fetchMarketData(ticker) {
  try {
    const result = await yahooFinance.quoteSummary(ticker, {
      modules: ["price", "defaultKeyStatistics"],
    });
    
    const price = result?.price || {};
    const stats = result?.defaultKeyStatistics || {};
    
    return {
      marketCap: price.marketCap || 0,
      volume: price.regularMarketVolume || 0,
      pe: price.trailingPE || stats.trailingPE || 0,
      eps: stats.trailingEps?.raw || 0,
    };
  } catch {
    return null;
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symbols = db.collection("symbols");
  const cleanassets = db.collection("cleanassets");

  const priorityExchanges = [
    ["NSE", "BSE"],
    ["NYSE", "NASDAQ", "AMEX", "NYSEARCA"],
  ];

  let totalUpdated = 0;
  let totalFailed = 0;

  for (let priority = 0; priority <= 2; priority++) {
    let exchangeFilter;
    if (priority < priorityExchanges.length) {
      exchangeFilter = { exchange: { $in: priorityExchanges[priority] } };
      console.log(`\n=== Processing ${priorityExchanges[priority].join("/")} exchanges ===`);
    } else {
      exchangeFilter = {
        exchange: { $nin: priorityExchanges.flat() },
        type: { $in: ["stock", "etf"] },
      };
      console.log(`\n=== Processing remaining exchanges ===`);
    }

    const query = {
      ...exchangeFilter,
      $or: [
        { marketCap: { $in: [0, null] } },
        { marketCap: { $exists: false } },
      ],
    };

    const count = await symbols.countDocuments(query);
    console.log(`Found ${count} symbols needing marketCap enrichment`);
    if (count === 0) continue;

    const cursor = symbols.find(query, {
      projection: { symbol: 1, exchange: 1, fullSymbol: 1 },
    }).batchSize(BATCH_SIZE);

    let batchNum = 0;
    let batch = [];

    while (await cursor.hasNext()) {
      batch.push(await cursor.next());

      if (batch.length >= BATCH_SIZE) {
        batchNum++;
        const results = await processBatch(batch, symbols, cleanassets);
        totalUpdated += results.updated;
        totalFailed += results.failed;
        if (batchNum % 10 === 0 || batchNum <= 3) {
          console.log(`  Batch ${batchNum}: ${results.updated} updated, ${results.failed} failed (total: ${totalUpdated})`);
        }
        batch = [];
        await sleep(DELAY_MS);
      }
    }

    if (batch.length > 0) {
      batchNum++;
      const results = await processBatch(batch, symbols, cleanassets);
      totalUpdated += results.updated;
      totalFailed += results.failed;
      console.log(`  Batch ${batchNum}: ${results.updated} updated, ${results.failed} failed (total: ${totalUpdated})`);
    }

    console.log(`  Subtotal — Updated: ${totalUpdated}, Failed: ${totalFailed}`);
  }

  console.log(`\n=== Market Cap Enrichment Complete ===`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Failed: ${totalFailed}`);

  await client.close();
}

async function processBatch(docs, symbolsColl, cleanassetsColl) {
  let updated = 0;
  let failed = 0;
  const symBulk = [];
  const caBulk = [];

  // Process 3 at a time to avoid rate-limits
  const concurrency = 3;
  for (let i = 0; i < docs.length; i += concurrency) {
    const chunk = docs.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (doc) => {
        const ticker = yahooTicker(doc.symbol, doc.exchange);
        const data = await fetchMarketData(ticker);
        return { doc, data };
      })
    );

    for (const result of results) {
      if (result.status === "rejected" || !result.value.data || !result.value.data.marketCap) {
        failed++;
        continue;
      }

      const { doc, data } = result.value;
      const updateFields = {};
      if (data.marketCap > 0) updateFields.marketCap = data.marketCap;
      if (data.volume > 0) updateFields.volume = data.volume;

      if (Object.keys(updateFields).length === 0) {
        failed++;
        continue;
      }

      symBulk.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updateFields },
        },
      });

      caBulk.push({
        updateOne: {
          filter: { fullSymbol: doc.fullSymbol },
          update: { $set: updateFields },
        },
      });

      updated++;
    }

    await sleep(200);
  }

  if (symBulk.length > 0) {
    await symbolsColl.bulkWrite(symBulk, { ordered: false });
    await cleanassetsColl.bulkWrite(caBulk, { ordered: false });
  }

  return { updated, failed };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
