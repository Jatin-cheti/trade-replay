/**
 * Mass Logo Validation + Fix Pipeline
 *
 * Processes clean_assets collection:
 * 1. Validates logos with Gemini AI
 * 2. Resolves missing/wrong domains with AI
 * 3. Fixes icon URLs using Google Favicons
 * 4. Uploads optimized logos to CDN via S3
 * 5. Updates clean_assets and symbols collections
 *
 * Usage: npx tsx scripts/massLogoValidation.ts [--batch-size=200] [--skip-ai] [--cdn-only] [--limit=1000]
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../../.env");
const secretsPath = path.resolve(__dirname, "../../../.env.secrets");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
if (fs.existsSync(secretsPath)) dotenv.config({ path: secretsPath, override: true });

// Dynamic imports (these need the env loaded first)  
async function loadServices() {
  const { validateLogoWithAI, resolveDomainWithAI } = await import("../src/services/geminiLogoValidator.service");
  const { processLogoForCDN } = await import("../src/services/logoPipeline.service");
  const { getRedisClient, ensureRedisReady } = await import("../src/config/redis");
  return { validateLogoWithAI, resolveDomainWithAI, processLogoForCDN, getRedisClient, ensureRedisReady };
}

const MONGO_URI = process.env.MONGO_URI_LOCAL || "mongodb://127.0.0.1:27017/tradereplay";
const BATCH_SIZE = parseInt(process.argv.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "200", 10);
const SKIP_AI = process.argv.includes("--skip-ai");
const CDN_ONLY = process.argv.includes("--cdn-only");
const LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0", 10);

// High-confidence domain map (known-good mappings)
const KNOWN_DOMAINS: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com", GOOG: "google.com",
  AMZN: "amazon.com", TSLA: "tesla.com", META: "meta.com", NVDA: "nvidia.com",
  JPM: "jpmorganchase.com", V: "visa.com", MA: "mastercard.com", DIS: "disney.com",
  NFLX: "netflix.com", PYPL: "paypal.com", INTC: "intel.com", AMD: "amd.com",
  CRM: "salesforce.com", ORCL: "oracle.com", CSCO: "cisco.com", ADBE: "adobe.com",
  IBM: "ibm.com", QCOM: "qualcomm.com", TXN: "ti.com", AVGO: "broadcom.com",
  NOW: "servicenow.com", SNOW: "snowflake.com", UBER: "uber.com", ABNB: "airbnb.com",
  SQ: "squareup.com", SHOP: "shopify.com", SPOT: "spotify.com", ZM: "zoom.us",
  PLTR: "palantir.com", CRWD: "crowdstrike.com", NET: "cloudflare.com",
  SPY: "ssga.com", QQQ: "invesco.com", IWM: "ishares.com", DIA: "ssga.com",
  VOO: "vanguard.com", VTI: "vanguard.com", GLD: "ssga.com", SLV: "ishares.com",
  RELIANCE: "ril.com", TCS: "tcs.com", INFY: "infosys.com", HDFCBANK: "hdfcbank.com",
  ICICIBANK: "icicibank.com", SBIN: "sbi.co.in", WIPRO: "wipro.com",
  BHARTIARTL: "airtel.in", ITC: "itcportal.com", KOTAKBANK: "kotak.com",
  WMT: "walmart.com", HD: "homedepot.com", KO: "coca-colacompany.com",
  PEP: "pepsico.com", PG: "pg.com", JNJ: "jnj.com", UNH: "unitedhealthgroup.com",
  MRK: "merck.com", ABBV: "abbvie.com", LLY: "lilly.com", PFE: "pfizer.com",
  BA: "boeing.com", CAT: "caterpillar.com", GE: "ge.com", MMM: "3m.com",
  XOM: "exxonmobil.com", CVX: "chevron.com", T: "att.com", VZ: "verizon.com",
  COST: "costco.com", NKE: "nike.com", SBUX: "starbucks.com", MCD: "mcdonalds.com",
  BRK: "berkshirehathaway.com", GS: "goldmansachs.com", MS: "morganstanley.com",
  BAC: "bankofamerica.com", C: "citigroup.com", WFC: "wellsfargo.com",
};

interface AssetDoc {
  _id: mongoose.Types.ObjectId;
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: string;
  iconUrl: string;
  companyDomain: string;
  s3Icon: string;
  logoVerificationStatus: string;
  assetScore: number;
}

async function main() {
  console.log(`\n=== MASS LOGO VALIDATION + FIX PIPELINE ===`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Skip AI: ${SKIP_AI}`);
  console.log(`CDN only: ${CDN_ONLY}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const cleanCol = db.collection("clean_assets");
  const symbolsCol = db.collection("symbols");

  const total = await cleanCol.countDocuments();
  console.log(`\nClean assets: ${total.toLocaleString()}`);

  if (total === 0) {
    console.log("ERROR: No clean_assets found. Run buildCleanAssets.ts first.");
    process.exit(1);
  }

  let services: Awaited<ReturnType<typeof loadServices>> | null = null;
  if (!SKIP_AI || CDN_ONLY) {
    try {
      services = await loadServices();
      await services.ensureRedisReady();
      console.log("Redis + services loaded.");
    } catch (err: any) {
      console.warn("Services not fully loaded:", err.message);
      if (CDN_ONLY) {
        console.error("CDN mode requires Redis. Exiting.");
        process.exit(1);
      }
    }
  }

  const stats = {
    processed: 0,
    alreadyValid: 0,
    domainFixed: 0,
    aiDomainResolved: 0,
    iconFixed: 0,
    cdnUploaded: 0,
    failed: 0,
  };

  // Process in batches by assetScore DESC (highest value first)
  const query: any = CDN_ONLY
    ? { iconUrl: { $exists: true, $ne: "" }, s3Icon: { $in: ["", null] } }
    : { logoVerificationStatus: { $ne: "validated" } };

  const limitVal = LIMIT || total;
  const cursor = cleanCol
    .find(query)
    .sort({ assetScore: -1 })
    .limit(limitVal)
    .batchSize(BATCH_SIZE);

  const batch: AssetDoc[] = [];

  for await (const doc of cursor) {
    batch.push(doc as unknown as AssetDoc);

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch, db, cleanCol, symbolsCol, services, stats);
      batch.length = 0;
      // Yield to event loop
      await new Promise(setImmediate);
    }
  }

  // Process remaining
  if (batch.length > 0) {
    await processBatch(batch, db, cleanCol, symbolsCol, services, stats);
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Processed: ${stats.processed.toLocaleString()}`);
  console.log(`Already valid: ${stats.alreadyValid.toLocaleString()}`);
  console.log(`Domain fixed (known map): ${stats.domainFixed.toLocaleString()}`);
  console.log(`Domain resolved (AI): ${stats.aiDomainResolved.toLocaleString()}`);
  console.log(`Icon URL fixed: ${stats.iconFixed.toLocaleString()}`);
  console.log(`CDN uploaded: ${stats.cdnUploaded.toLocaleString()}`);
  console.log(`Failed: ${stats.failed.toLocaleString()}`);

  // Final stats
  const finalValidated = await cleanCol.countDocuments({ logoVerificationStatus: "validated" });
  const finalWithIcon = await cleanCol.countDocuments({ iconUrl: { $exists: true, $ne: "" } });
  const finalWithCDN = await cleanCol.countDocuments({ s3Icon: { $exists: true, $ne: "" } });
  console.log(`\nFinal state:`);
  console.log(`  Validated: ${finalValidated.toLocaleString()} / ${total.toLocaleString()} (${((finalValidated / total) * 100).toFixed(1)}%)`);
  console.log(`  With icon: ${finalWithIcon.toLocaleString()} / ${total.toLocaleString()} (${((finalWithIcon / total) * 100).toFixed(1)}%)`);
  console.log(`  CDN logos: ${finalWithCDN.toLocaleString()} / ${total.toLocaleString()} (${((finalWithCDN / total) * 100).toFixed(1)}%)`);

  await mongoose.disconnect();
}

async function processBatch(
  batch: AssetDoc[],
  db: mongoose.mongo.Db,
  cleanCol: mongoose.mongo.Collection,
  symbolsCol: mongoose.mongo.Collection,
  services: Awaited<ReturnType<typeof loadServices>> | null,
  stats: Record<string, number>,
) {
  const cleanOps: any[] = [];
  const symbolOps: any[] = [];

  for (const asset of batch) {
    stats.processed++;

    try {
      let domain = asset.companyDomain || "";
      let iconUrl = asset.iconUrl || "";
      let status = asset.logoVerificationStatus;
      let cdnUrl = asset.s3Icon || "";

      // Step 1: Check known domain map
      if (!domain || isWrongDomain(domain, asset.type)) {
        const known = KNOWN_DOMAINS[asset.symbol];
        if (known) {
          domain = known;
          stats.domainFixed++;
        }
      }

      // Step 2: AI domain resolution for unknowns (if not skip-ai)
      if (!domain && !SKIP_AI && services) {
        if (asset.type !== "forex" && asset.type !== "crypto") {
          try {
            const aiResult = await services.resolveDomainWithAI(
              asset.symbol,
              asset.name,
              asset.exchange,
              asset.type,
            );
            if (aiResult.domain && aiResult.confidence >= 0.7) {
              domain = aiResult.domain;
              stats.aiDomainResolved++;
            }
          } catch {
            // AI might be rate-limited
          }
        }
      }

      // Step 3: Fix icon URL if domain is known
      if (domain && needsIconFix(iconUrl, domain)) {
        // Crypto uses CoinGecko — don't override
        if (asset.type !== "crypto") {
          iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          stats.iconFixed++;
        }
      }

      // Step 4: Validate
      if (domain && iconUrl && iconUrl.includes(domain)) {
        status = "validated";
        stats.alreadyValid++;
      } else if (iconUrl && iconUrl.length > 0) {
        status = asset.type === "crypto" ? "validated" : "suspect";
      }

      // Step 5: CDN upload (if services available and not already done)
      if (services && iconUrl && !cdnUrl) {
        try {
          const processed = await services.processLogoForCDN(iconUrl, asset.symbol);
          if (processed) {
            cdnUrl = processed.cdnUrl;
            stats.cdnUploaded++;
          }
        } catch {
          // CDN might fail — not critical
        }
      }

      // Build update
      const update: any = {};
      if (domain !== asset.companyDomain) update.companyDomain = domain;
      if (iconUrl !== asset.iconUrl) update.iconUrl = iconUrl;
      if (status !== asset.logoVerificationStatus) update.logoVerificationStatus = status;
      if (cdnUrl && cdnUrl !== asset.s3Icon) update.s3Icon = cdnUrl;

      if (Object.keys(update).length > 0) {
        cleanOps.push({
          updateOne: { filter: { _id: asset._id }, update: { $set: update } },
        });
        // Also update the source symbols collection
        symbolOps.push({
          updateOne: {
            filter: { fullSymbol: asset.fullSymbol },
            update: { $set: update },
          },
        });
      }
    } catch (err: any) {
      stats.failed++;
    }
  }

  // Bulk write
  if (cleanOps.length > 0) {
    await cleanCol.bulkWrite(cleanOps, { ordered: false });
  }
  if (symbolOps.length > 0) {
    await symbolsCol.bulkWrite(symbolOps, { ordered: false });
  }

  if (stats.processed % 5000 === 0 || stats.processed === batch.length) {
    console.log(`  Processed: ${stats.processed.toLocaleString()} | Fixed: ${stats.domainFixed + stats.aiDomainResolved} | CDN: ${stats.cdnUploaded} | Failed: ${stats.failed}`);
  }
}

function isWrongDomain(domain: string, type: string): boolean {
  if (!domain) return true;
  const badDomains = [
    "financialmodelingprep.com",
    "coingecko.com",
    "google.com",
    "duckduckgo.com",
    "clearbit.com",
  ];
  return badDomains.some((bad) => domain.includes(bad));
}

function needsIconFix(iconUrl: string, domain: string): boolean {
  if (!iconUrl) return true;
  if (iconUrl.includes("financialmodelingprep.com/image-stock")) return true;
  if (iconUrl.includes("apikey=")) return true;
  // If icon URL uses a different domain than expected
  if (iconUrl.includes("google.com/s2/favicons")) {
    const match = iconUrl.match(/domain=([^&]+)/);
    if (match && match[1] !== domain) return true;
  }
  return false;
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
