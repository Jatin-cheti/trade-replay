/**
 * Market cap enrichment using yahoo-finance2 (free, no API key)
 * Usage: node scripts/enrich-marketcap.cjs
 * 
 * Finds symbols with marketCap = 0/null and enriches from Yahoo Finance.
 * Priority: Indian NSE/BSE → US NYSE/NASDAQ → Others
 */
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const BATCH_SIZE = 50; // Yahoo rate-limits aggressively
const DELAY_MS = 300;  // Delay between batches

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  // NYSE/NASDAQ tickers have no suffix in Yahoo
  if (["NYSE", "NASDAQ", "AMEX", "CFD", "NYSEARCA", "BATS"].includes(exchange)) return symbol;
  return `${symbol}${suffix}`;
}

async function fetchQuote(ticker) {
  // Use Yahoo Finance v8 API (no auth needed)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      regularMarketPrice: meta.regularMarketPrice || null,
      marketCap: null, // v8 chart doesn't return marketCap, use quoteSummary
    };
  } catch {
    return null;
  }
}

async function fetchQuoteSummary(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,summaryDetail,price`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;
    
    const price = result.price || {};
    const stats = result.defaultKeyStatistics || {};
    const detail = result.summaryDetail || {};
    
    return {
      marketCap: price.marketCap?.raw || detail.marketCap?.raw || 0,
      pe: detail.trailingPE?.raw || stats.trailingPE?.raw || 0,
      eps: stats.trailingEps?.raw || 0,
      beta: stats.beta?.raw || 0,
      volume: price.regularMarketVolume?.raw || detail.volume?.raw || 0,
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

  // Priority order: Indian stocks first, then US, then others
  const priorityExchanges = [
    ["NSE", "BSE"],           // India
    ["NYSE", "NASDAQ", "AMEX", "NYSEARCA"], // US
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
        exchange: {
          $nin: priorityExchanges.flat(),
        },
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

    // Process in batches
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
        console.log(`  Batch ${batchNum}: ${results.updated} updated, ${results.failed} failed (total: ${totalUpdated})`);
        batch = [];
        await sleep(DELAY_MS);
      }
    }

    // Remaining batch
    if (batch.length > 0) {
      batchNum++;
      const results = await processBatch(batch, symbols, cleanassets);
      totalUpdated += results.updated;
      totalFailed += results.failed;
      console.log(`  Batch ${batchNum}: ${results.updated} updated, ${results.failed} failed (total: ${totalUpdated})`);
    }
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

  // Process concurrently with concurrency limit of 5
  const concurrency = 5;
  for (let i = 0; i < docs.length; i += concurrency) {
    const chunk = docs.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (doc) => {
        const ticker = yahooTicker(doc.symbol, doc.exchange);
        const data = await fetchQuoteSummary(ticker);
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

    // Small delay between concurrent chunks
    await sleep(100);
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
