/**
 * Market cap enrichment v3 — uses Yahoo v10 with crumb/cookie auth
 * Usage: node scripts/enrich-marketcap-v3.cjs
 * 
 * Steps:
 * 1. Fetches consent cookie from Yahoo
 * 2. Gets crumb token
 * 3. Uses v10 quoteSummary with crumb for marketCap data
 * 4. Processes in small batches with generous delays to avoid 429
 */
const { MongoClient } = require("mongodb");
const https = require("https");
const http = require("http");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const BATCH_SIZE = 10;       // Small batches
const DELAY_BETWEEN_MS = 1000; // 1s between batches
const DELAY_BETWEEN_ITEMS = 300; // 300ms between individual requests

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Exchange suffix mapping
const EXCHANGE_SUFFIX = {
  NSE: ".NS", BSE: ".BO", TSE: ".T", HKEX: ".HK", LSE: ".L",
  ASX: ".AX", TSX: ".TO", XETRA: ".DE", FRA: ".F", EURONEXT: ".PA",
  KRX: ".KS", SGX: ".SI", TWSE: ".TW", SET: ".BK", JSE: ".JO", SAU: ".SAU",
};

const US_EXCHANGES = ["NYSE", "NASDAQ", "AMEX", "CFD", "NYSEARCA", "BATS"];

function yahooTicker(symbol, exchange) {
  if (US_EXCHANGES.includes(exchange)) return symbol;
  return `${symbol}${EXCHANGE_SUFFIX[exchange] || ""}`;
}

// --- Yahoo crumb/cookie auth ---
let _cookies = "";
let _crumb = "";

function rawRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...(options.headers || {}),
      },
      ...options,
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function getCrumb() {
  // Step 1: Get cookies from fc.yahoo.com
  const r1 = await rawRequest("https://fc.yahoo.com/", { headers: { Cookie: "" } });
  const setCookies = r1.headers["set-cookie"] || [];
  _cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  console.log("Got cookies:", _cookies ? "yes" : "no");

  // Step 2: Get crumb
  const r2 = await rawRequest("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { Cookie: _cookies },
  });
  _crumb = r2.body.trim();
  console.log("Got crumb:", _crumb ? _crumb.slice(0, 8) + "..." : "FAILED");
  
  if (!_crumb) {
    throw new Error("Failed to get Yahoo crumb");
  }
}

async function fetchQuoteSummary(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price&crumb=${encodeURIComponent(_crumb)}`;
  try {
    const { status, body } = await rawRequest(url, {
      headers: { Cookie: _cookies },
    });
    
    if (status === 429) {
      // Rate limited — wait and retry once
      console.log(`    429 on ${ticker}, waiting 5s...`);
      await sleep(5000);
      const retry = await rawRequest(url, { headers: { Cookie: _cookies } });
      if (retry.status !== 200) return null;
      const json = JSON.parse(retry.body);
      return extractPriceData(json);
    }
    
    if (status !== 200) return null;
    const json = JSON.parse(body);
    return extractPriceData(json);
  } catch {
    return null;
  }
}

function extractPriceData(json) {
  const result = json?.quoteSummary?.result?.[0];
  if (!result) return null;
  const price = result.price || {};
  return {
    marketCap: price.marketCap?.raw || 0,
    volume: price.regularMarketVolume?.raw || 0,
    regularMarketPrice: price.regularMarketPrice?.raw || 0,
  };
}

async function main() {
  // Get Yahoo auth
  console.log("Fetching Yahoo crumb...");
  await getCrumb();
  
  // Test with AAPL
  console.log("\nTesting with AAPL...");
  const test = await fetchQuoteSummary("AAPL");
  if (!test || !test.marketCap) {
    console.error("Test failed — AAPL returned:", test);
    console.error("Yahoo API may be rate-limiting. Try again later.");
    process.exit(1);
  }
  console.log("AAPL marketCap:", test.marketCap, "volume:", test.volume);
  
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symbolsColl = db.collection("symbols");
  const cleanassetsColl = db.collection("cleanassets");

  const priorityExchanges = [
    ["NSE", "BSE"],
    ["NYSE", "NASDAQ", "AMEX", "NYSEARCA"],
  ];

  let totalUpdated = 0;
  let totalFailed = 0;
  let consecutiveFails = 0;

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

    const count = await symbolsColl.countDocuments(query);
    console.log(`Found ${count} symbols needing marketCap enrichment`);
    if (count === 0) continue;

    const cursor = symbolsColl.find(query, {
      projection: { symbol: 1, exchange: 1, fullSymbol: 1 },
    }).batchSize(BATCH_SIZE);

    let batchNum = 0;
    let batch = [];

    while (await cursor.hasNext()) {
      batch.push(await cursor.next());

      if (batch.length >= BATCH_SIZE) {
        batchNum++;
        const results = await processBatch(batch, symbolsColl, cleanassetsColl);
        totalUpdated += results.updated;
        totalFailed += results.failed;
        
        if (results.updated === 0) {
          consecutiveFails++;
        } else {
          consecutiveFails = 0;
        }
        
        // If too many consecutive failures, re-fetch crumb
        if (consecutiveFails >= 5) {
          console.log("  Too many failures, refreshing crumb...");
          try {
            await getCrumb();
            consecutiveFails = 0;
          } catch(e) {
            console.log("  Crumb refresh failed, waiting 30s...");
            await sleep(30000);
            try { await getCrumb(); consecutiveFails = 0; } catch {
              console.log("  Still failing. Stopping.");
              break;
            }
          }
        }

        if (batchNum % 50 === 0 || batchNum <= 5) {
          console.log(`  Batch ${batchNum}: ${results.updated}/${batch.length} updated (total: ${totalUpdated}, failed: ${totalFailed})`);
        }
        batch = [];
        await sleep(DELAY_BETWEEN_MS);
      }
    }

    if (batch.length > 0) {
      batchNum++;
      const results = await processBatch(batch, symbolsColl, cleanassetsColl);
      totalUpdated += results.updated;
      totalFailed += results.failed;
      console.log(`  Batch ${batchNum}: ${results.updated}/${batch.length} updated (total: ${totalUpdated}, failed: ${totalFailed})`);
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

  for (const doc of docs) {
    const ticker = yahooTicker(doc.symbol, doc.exchange);
    const data = await fetchQuoteSummary(ticker);
    await sleep(DELAY_BETWEEN_ITEMS);

    if (!data || !data.marketCap) {
      failed++;
      continue;
    }

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
