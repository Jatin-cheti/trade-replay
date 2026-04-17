/**
 * reprocessFailedLogos.cjs — Reprocess ONLY symbols with missing/broken logos.
 *
 * Reads from Redis logo:missing set, resolves with HTTP validation,
 * loops until zero failures remain.
 *
 * Features:
 * - Concurrency-limited (5 parallel) for Google/Clearbit rate safety
 * - Retry with exponential backoff
 * - Event loop yielding (setImmediate between batches)
 * - Loops until missing = 0
 */
const mongoose = require('mongoose');
const Redis = require('ioredis');
require('dotenv').config();

// ── Redis connection ──
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
if (!REDIS_URL) { console.error('No REDIS_URL found'); process.exit(1); }
const redis = new Redis(REDIS_URL, { tls: REDIS_URL.startsWith('rediss://') ? {} : undefined });

// ── FMP Key Rotation ──
const FMP_KEYS = [
  process.env.FMP_API_KEY,
  process.env.FMP_KEY_1,
  process.env.FMP_KEY_2,
  process.env.FMP_KEY_3,
  process.env.FMP_KEY_4,
].filter(k => k && k.length > 5);
let fmpIdx = 0;
function getFmpKey() {
  if (FMP_KEYS.length === 0) return null;
  const k = FMP_KEYS[fmpIdx % FMP_KEYS.length];
  fmpIdx++;
  return k;
}

// ── Company Name Normalizer ──
const STRIP_RE = /\b(ltd|limited|inc|incorporated|corp|corporation|co|company|plc|ag|sa|se|nv|bv|gmbh|llc|lp|industries|industry|group|holdings|holding|enterprises|enterprise|international|intl|global|services|solutions|technologies|technology|tech|systems|pharma|pharmaceuticals|infra|infrastructure|logistics|capital|financial|finance|bancorp|bank|insurance|assurance|realty|properties|land|development|manufacturing|mfg|chemicals|chemical|textiles|textile|metals|metal|power|energy|oil|gas|petroleum|construction|engineering|steel|cement|foods|food|beverages|minerals|mining|investments|investors|associates|partners|ventures)\b/gi;

const NAME_DOMAIN_MAP = {
  "hdfc life": "hdfclife.com", "hdfc bank": "hdfcbank.com", "hdfc": "hdfc.com",
  "icici bank": "icicibank.com", "icici prudential": "iciciprulife.com",
  "sbi": "sbi.co.in", "sbi life": "sbilife.co.in", "reliance": "ril.com",
  "tata motors": "tatamotors.com", "tata steel": "tatasteel.com",
  "tata consultancy": "tcs.com", "tcs": "tcs.com", "infosys": "infosys.com",
  "wipro": "wipro.com", "bajaj finance": "bajajfinserv.in", "mahindra": "mahindra.com",
  "bharti airtel": "airtel.in", "airtel": "airtel.in", "kotak mahindra": "kotak.com",
  "asian paints": "asianpaints.com", "ultratech": "ultratechcement.com",
  "sun pharma": "sunpharma.com", "dr reddys": "drreddys.com", "cipla": "cipla.com",
  "maruti suzuki": "marutisuzuki.com", "hero motocorp": "heromotocorp.com",
  "bajaj auto": "bajajauto.com", "nestle india": "nestle.in",
  "hindustan unilever": "hul.co.in", "itc": "itcportal.com",
  "larsen toubro": "larsentoubro.com", "axis bank": "axisbank.com", "adani": "adani.com",
  "power grid": "powergrid.in", "ntpc": "ntpc.co.in", "ongc": "ongcindia.com",
  "coal india": "coalindia.in", "grasim": "grasim.com", "dhunseri": "dhunseri.com",
  "tarachand": "tarachand.com",
  "apple": "apple.com", "microsoft": "microsoft.com", "google": "google.com",
  "alphabet": "abc.xyz", "amazon": "amazon.com", "meta platforms": "meta.com",
  "tesla": "tesla.com", "nvidia": "nvidia.com", "berkshire hathaway": "berkshirehathaway.com",
  "johnson johnson": "jnj.com", "jpmorgan": "jpmorganchase.com",
  "visa": "visa.com", "mastercard": "mastercard.com", "walmart": "walmart.com",
  "procter gamble": "pg.com", "disney": "disney.com", "coca cola": "coca-cola.com",
};

function normalizeName(name) {
  let n = name.toLowerCase().trim();
  n = n.replace(STRIP_RE, '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  return n;
}

function deriveDomain(name) {
  const norm = normalizeName(name);
  if (!norm || norm.length < 2) return null;
  for (const [key, domain] of Object.entries(NAME_DOMAIN_MAP)) {
    if (norm.includes(key)) return domain;
  }
  const words = norm.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return null;
  if (words.length >= 2) {
    const two = words.slice(0, 2).join('').replace(/[^a-z0-9]/g, '');
    if (two.length >= 3) return `${two}.com`;
  }
  const one = words[0].replace(/[^a-z0-9]/g, '');
  if (one.length >= 3) return `${one}.com`;
  return null;
}

// ── Symbol Map (indices, commodities, bonds, crypto) ──
const SYMBOL_LOGO_MAP = {
  NIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTY50: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  "NIFTY 50": "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SENSEX: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BSE_Logo.svg/120px-BSE_Logo.svg.png",
  BANKNIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SPX: "https://logo.clearbit.com/spglobal.com",
  DJI: "https://logo.clearbit.com/spglobal.com",
  DJIA: "https://logo.clearbit.com/spglobal.com",
  IXIC: "https://logo.clearbit.com/nasdaq.com",
  FTSE: "https://logo.clearbit.com/lseg.com",
  DAX: "https://logo.clearbit.com/deutsche-boerse.com",
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  GOLD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  SILVER: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  CRUDEOIL: "https://www.google.com/s2/favicons?sz=128&domain=opec.org",
  EUROBOND: "https://www.google.com/s2/favicons?sz=128&domain=ecb.europa.eu",
  TBOND: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
};

const EXCHANGE_DOMAIN = {
  NASDAQ: "nasdaq.com", NYSE: "nyse.com", NSE: "nseindia.com", BSE: "bseindia.com",
  LSE: "londonstockexchange.com", TSX: "tsx.com", ASX: "asx.com.au",
  BINANCE: "binance.com", COINBASE: "coinbase.com", MCX: "mcxindia.com",
  AMEX: "nyse.com", OTCMARKETS: "otcmarkets.com", CFD: "ig.com",
};

const TYPE_FALLBACK = {
  index: "https://www.google.com/s2/favicons?sz=128&domain=spglobal.com",
  bond: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  economy: "https://www.google.com/s2/favicons?sz=128&domain=worldbank.org",
  futures: "https://www.google.com/s2/favicons?sz=128&domain=cmegroup.com",
};

const FOREX_FLAGS = {
  USD: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  EUR: "https://www.google.com/s2/favicons?sz=128&domain=ecb.europa.eu",
  GBP: "https://www.google.com/s2/favicons?sz=128&domain=bankofengland.co.uk",
  JPY: "https://www.google.com/s2/favicons?sz=128&domain=boj.or.jp",
  INR: "https://www.google.com/s2/favicons?sz=128&domain=rbi.org.in",
};

// ── HTTP validation with retry ──
async function retry(fn, attempts = 3, baseMs = 500) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < attempts) await new Promise(r => setTimeout(r, baseMs * Math.pow(2, i - 1))); }
  }
  throw last;
}

async function isUrlReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, headers: { 'User-Agent': 'tradereplay-logo/1.0' } });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) return false;
    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    if (cl > 0 && cl < 100) return false;
    return true;
  } catch { clearTimeout(timer); return false; }
}

// ── SVG Generator ──
function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}
function generateSvg(symbol) {
  const initials = symbol.slice(0, 2).toUpperCase();
  const color = hashColor(symbol);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${color}"/><text x="32" y="38" text-anchor="middle" fill="white" font-size="22" font-family="Arial,sans-serif" font-weight="bold">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// ── Async Logo Resolver (validates via HTTP) ──
async function resolveLogoAsync(doc) {
  const sym = doc.symbol.toUpperCase();

  // Tier 0: S3
  if (doc.s3Icon && doc.s3Icon.startsWith('http')) return { url: doc.s3Icon, source: 's3', tier: 0 };

  // Tier 1: Symbol map
  const base = sym.replace(/(USDT|USDC|USD|BUSD|BTC|ETH)$/, '');
  const mapHit = SYMBOL_LOGO_MAP[sym] || (base ? SYMBOL_LOGO_MAP[base] : null);
  if (mapHit) return { url: mapHit, source: 'symbolMap', tier: 1 };
  const nameUp = (doc.name || '').toUpperCase();
  if (nameUp && SYMBOL_LOGO_MAP[nameUp]) return { url: SYMBOL_LOGO_MAP[nameUp], source: 'symbolMap:name', tier: 1 };

  // Tier 2: Type-based
  if (doc.type === 'crypto') {
    const coinId = sym.toLowerCase().replace(/usdt$|usdc$|usd$|busd$|btc$|eth$/i, '');
    if (coinId.length >= 2) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${coinId}.org`, source: 'crypto:favicon', tier: 2 };
  }
  if (doc.type === 'forex') {
    const baseCur = sym.slice(0, 3).toUpperCase();
    if (FOREX_FLAGS[baseCur]) return { url: FOREX_FLAGS[baseCur], source: 'forex:flag', tier: 2 };
  }
  if (TYPE_FALLBACK[doc.type]) return { url: TYPE_FALLBACK[doc.type], source: `type:${doc.type}`, tier: 2 };

  // Tier 3: Clearbit with explicit domain (validated)
  if (doc.companyDomain) {
    const domain = doc.companyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const cbUrl = `https://logo.clearbit.com/${domain}`;
    const ok = await retry(() => isUrlReachable(cbUrl), 2, 300).catch(() => false);
    if (ok) return { url: cbUrl, source: 'clearbit', tier: 3 };
  }

  // Tier 3b: Clearbit derived (validated)
  if (doc.name) {
    const derived = deriveDomain(doc.name);
    if (derived) {
      const cbUrl = `https://logo.clearbit.com/${derived}`;
      const ok = await retry(() => isUrlReachable(cbUrl), 2, 300).catch(() => false);
      if (ok) return { url: cbUrl, source: 'clearbit:derived', tier: 3 };
    }
  }

  // Tier 3c: FMP image (validated, with key rotation)
  const fmpKey = getFmpKey();
  if (fmpKey) {
    const fmpUrl = `https://financialmodelingprep.com/image-stock/${encodeURIComponent(sym)}.png?apikey=${encodeURIComponent(fmpKey)}`;
    const ok = await retry(() => isUrlReachable(fmpUrl), 2, 300).catch(() => false);
    if (ok) return { url: fmpUrl, source: 'fmp', tier: 3 };
  }

  // Tier 4: Exchange favicon
  const exDomain = EXCHANGE_DOMAIN[(doc.exchange || '').toUpperCase()];
  if (exDomain) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`, source: 'exchange:favicon', tier: 4 };

  // Tier 4b: Google favicon derived
  if (doc.name) {
    const derived = deriveDomain(doc.name);
    if (derived) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${derived}`, source: 'google:derived', tier: 4 };
  }

  // Tier 5: Generated
  return { url: generateSvg(sym), source: 'generated', tier: 5 };
}

// ── Concurrency limiter ──
function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  }
  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}
const limit = pLimit(5);

// ── Main loop ──
mongoose.connect('mongodb://127.0.0.1:27017/tradereplay').then(async () => {
  const db = mongoose.connection.db;
  const clean = db.collection('cleanassets');

  let round = 0;
  const MAX_ROUNDS = 5;

  while (round < MAX_ROUNDS) {
    round++;
    console.log(`\n=== Round ${round} ===`);

    // Get failures from Redis
    const missing = await redis.smembers('logo:missing');

    if (missing.length === 0) {
      // First round: seed from DB (tier 5 or no logo)
      if (round === 1) {
        console.log('No Redis failures tracked. Scanning DB for tier-5 / missing...');
        const cursor = clean.find({
          $or: [
            { logoSource: 'generated' },
            { iconUrl: { $regex: '^data:' } },
            { iconUrl: '' },
            { iconUrl: null },
            { iconUrl: { $exists: false } },
          ]
        }).project({ symbol: 1, name: 1, exchange: 1, type: 1, companyDomain: 1, s3Icon: 1, iconUrl: 1 }).limit(50000);

        const failedDocs = await cursor.toArray();
        console.log(`Found ${failedDocs.length} candidates from DB scan`);

        if (failedDocs.length === 0) {
          console.log('All logos already resolved! Zero missing.');
          break;
        }

        // Track them in Redis
        const pipeline = redis.pipeline();
        for (const d of failedDocs) {
          pipeline.sadd('logo:missing', d.symbol);
          pipeline.hset(`logo:missing:${d.symbol}`, { name: d.name || '', exchange: d.exchange || '', type: d.type || '' });
        }
        await pipeline.exec();
        continue; // Re-enter loop to process them
      }
      console.log('Zero failures remaining. Done!');
      break;
    }

    console.log(`Processing ${missing.length} failed symbols...`);

    // Fetch docs from DB
    const docs = await clean.find({ symbol: { $in: missing } })
      .project({ _id: 1, symbol: 1, name: 1, type: 1, exchange: 1, companyDomain: 1, s3Icon: 1, iconUrl: 1 })
      .toArray();

    const docMap = {};
    for (const d of docs) docMap[d.symbol] = d;

    let resolved = 0, stillFailed = 0;
    const BATCH = 50;
    const tier5Samples = [];

    for (let i = 0; i < missing.length; i += BATCH) {
      const chunk = missing.slice(i, i + BATCH);
      const results = await Promise.all(chunk.map(sym => limit(async () => {
        const doc = docMap[sym];
        if (!doc) {
          // Symbol not in clean_assets — remove from tracking
          await redis.srem('logo:missing', sym);
          await redis.del(`logo:missing:${sym}`);
          return null;
        }
        const logo = await resolveLogoAsync(doc);
        return { sym, doc, logo };
      })));

      const updates = [];
      for (const r of results) {
        if (!r) continue;
        const { sym, doc, logo } = r;

        if (logo.tier < 5) {
          // Resolved! Update DB and clear from Redis
          updates.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { iconUrl: logo.url, logoSource: logo.source, logoStatus: 'resolved' } }
            }
          });
          await redis.srem('logo:missing', sym);
          await redis.del(`logo:missing:${sym}`);
          resolved++;
        } else {
          stillFailed++;
          if (tier5Samples.length < 20) tier5Samples.push({ symbol: sym, name: doc.name, exchange: doc.exchange });
        }
      }

      if (updates.length > 0) {
        try { await clean.bulkWrite(updates, { ordered: false }); }
        catch (e) { console.warn('  bulk write partial:', e.message); }
      }

      // Event loop safety
      await new Promise(resolve => setImmediate(resolve));
    }

    console.log(`  Resolved: ${resolved}, Still failed: ${stillFailed}`);
    if (tier5Samples.length > 0) {
      console.log('  Tier 5 samples:', tier5Samples.slice(0, 10).map(s => `${s.symbol}|${s.name}`).join(', '));
    }

    if (stillFailed === 0) {
      console.log('\nAll logos resolved! Zero missing.');
      break;
    }

    if (resolved === 0) {
      console.log(`\nNo new resolutions this round. ${stillFailed} genuinely unresolvable symbols remain.`);
      break;
    }
  }

  // Final verification
  const total = await clean.countDocuments();
  const withSvg = await clean.countDocuments({ iconUrl: { $regex: '^data:' } });
  const withLogo = await clean.countDocuments({ iconUrl: { $ne: '', $exists: true } });
  const finalMissing = await redis.scard('logo:missing');

  console.log(`\n=== Final Report ===`);
  console.log(`Total: ${total}, With logo: ${withLogo}, SVG fallbacks: ${withSvg}`);
  console.log(`Coverage: ${((withLogo / total) * 100).toFixed(1)}%`);
  console.log(`Redis logo:missing count: ${finalMissing}`);

  redis.disconnect();
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
