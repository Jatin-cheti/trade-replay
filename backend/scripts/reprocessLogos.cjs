/**
 * Batch reprocess all clean assets to resolve logos — 100% coverage.
 * Mirrors the upgraded logoResolver.service.ts + companyNormalizer.service.ts logic.
 */
const mongoose = require('mongoose');

// ── Expanded Symbol Map (mirrors logoResolver.service.ts) ──
const SYMBOL_LOGO_MAP = {
  // Indices
  NIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTY50: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  "NIFTY 50": "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SENSEX: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BSE_Logo.svg/120px-BSE_Logo.svg.png",
  BANKNIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  "BANK NIFTY": "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTYBANK: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SPX: "https://logo.clearbit.com/spglobal.com",
  DJI: "https://logo.clearbit.com/spglobal.com",
  DJIA: "https://logo.clearbit.com/spglobal.com",
  IXIC: "https://logo.clearbit.com/nasdaq.com",
  FTSE: "https://logo.clearbit.com/lseg.com",
  FTSE100: "https://logo.clearbit.com/lseg.com",
  DAX: "https://logo.clearbit.com/deutsche-boerse.com",
  CAC40: "https://logo.clearbit.com/euronext.com",
  N225: "https://logo.clearbit.com/jpx.co.jp",
  NIKKEI: "https://logo.clearbit.com/jpx.co.jp",
  HSI: "https://logo.clearbit.com/hkex.com.hk",
  KOSPI: "https://logo.clearbit.com/krx.co.kr",
  STI: "https://logo.clearbit.com/sgx.com",
  ASX200: "https://logo.clearbit.com/asx.com.au",
  DXY: "https://www.google.com/s2/favicons?sz=128&domain=ice.com",
  VIX: "https://logo.clearbit.com/cboe.com",
  RUT: "https://logo.clearbit.com/ftserussell.com",
  NDX: "https://logo.clearbit.com/nasdaq.com",
  // Commodities
  XAUUSD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  XAGUSD: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  GOLD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  SILVER: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  CRUDEOIL: "https://www.google.com/s2/favicons?sz=128&domain=opec.org",
  NATURALGAS: "https://www.google.com/s2/favicons?sz=128&domain=eia.gov",
  COPPER: "https://www.google.com/s2/favicons?sz=128&domain=lme.com",
  // Bonds
  EUROBOND: "https://www.google.com/s2/favicons?sz=128&domain=ecb.europa.eu",
  TBOND: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  TNOTE: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  BUND: "https://www.google.com/s2/favicons?sz=128&domain=bundesbank.de",
  GILT: "https://www.google.com/s2/favicons?sz=128&domain=bankofengland.co.uk",
  JGB: "https://www.google.com/s2/favicons?sz=128&domain=boj.or.jp",
  // Crypto
  BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  BNB: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  XRP: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
  ADA: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  DOT: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
  LINK: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  MATIC: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
  UNI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
};

const FOREX_FLAGS = {
  USD: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  EUR: "https://www.google.com/s2/favicons?sz=128&domain=ecb.europa.eu",
  GBP: "https://www.google.com/s2/favicons?sz=128&domain=bankofengland.co.uk",
  JPY: "https://www.google.com/s2/favicons?sz=128&domain=boj.or.jp",
  CHF: "https://www.google.com/s2/favicons?sz=128&domain=snb.ch",
  AUD: "https://www.google.com/s2/favicons?sz=128&domain=rba.gov.au",
  CAD: "https://www.google.com/s2/favicons?sz=128&domain=bankofcanada.ca",
  NZD: "https://www.google.com/s2/favicons?sz=128&domain=rbnz.govt.nz",
  CNY: "https://www.google.com/s2/favicons?sz=128&domain=pbc.gov.cn",
  INR: "https://www.google.com/s2/favicons?sz=128&domain=rbi.org.in",
};

const TYPE_FALLBACK = {
  index: "https://www.google.com/s2/favicons?sz=128&domain=spglobal.com",
  bond: "https://www.google.com/s2/favicons?sz=128&domain=treasury.gov",
  economy: "https://www.google.com/s2/favicons?sz=128&domain=worldbank.org",
  futures: "https://www.google.com/s2/favicons?sz=128&domain=cmegroup.com",
};

const EXCHANGE_DOMAIN = {
  NASDAQ: "nasdaq.com", NYSE: "nyse.com", NSE: "nseindia.com", BSE: "bseindia.com",
  LSE: "londonstockexchange.com", TSX: "tsx.com", ASX: "asx.com.au",
  XETRA: "deutsche-boerse.com", EURONEXT: "euronext.com", HKEX: "hkex.com.hk",
  SGX: "sgx.com", BINANCE: "binance.com", COINBASE: "coinbase.com",
  KRAKEN: "kraken.com", BYBIT: "bybit.com", OKX: "okx.com",
  GATEIO: "gate.io", KUCOIN: "kucoin.com", COINGECKO: "coingecko.com",
  MCX: "mcxindia.com", NCDEX: "ncdex.com", SWX: "six-group.com",
  MOEX: "moex.com", B3: "b3.com.br", JSE: "jse.co.za",
  AMEX: "nyse.com", OTCMARKETS: "otcmarkets.com", CFD: "ig.com",
  FOREX: "xe.com", FX: "xe.com",
};

// ── Company Name Normalizer (mirrors companyNormalizer.service.ts) ──
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

function resolveLogo(doc) {
  const sym = doc.symbol.toUpperCase();

  // Tier 0: existing valid logo
  if (doc.s3Icon && doc.s3Icon.startsWith('http')) return { url: doc.s3Icon, source: 's3', tier: 0 };
  if (doc.iconUrl && doc.iconUrl.startsWith('http') && !doc.iconUrl.includes('default')) return { url: doc.iconUrl, source: 'existing', tier: 0 };

  // Tier 1: symbol map (+ name variants)
  const base = sym.replace(/(USDT|USDC|USD|BUSD|BTC|ETH)$/, '');
  if (SYMBOL_LOGO_MAP[sym]) return { url: SYMBOL_LOGO_MAP[sym], source: 'symbolMap', tier: 1 };
  if (base && SYMBOL_LOGO_MAP[base]) return { url: SYMBOL_LOGO_MAP[base], source: 'symbolMap:base', tier: 1 };
  const nameUp = (doc.name || '').toUpperCase();
  if (nameUp && SYMBOL_LOGO_MAP[nameUp]) return { url: SYMBOL_LOGO_MAP[nameUp], source: 'symbolMap:name', tier: 1 };
  const nameCompact = nameUp.replace(/\s+/g, '');
  if (nameCompact && SYMBOL_LOGO_MAP[nameCompact]) return { url: SYMBOL_LOGO_MAP[nameCompact], source: 'symbolMap:nameCompact', tier: 1 };

  // Tier 2: type-based
  if (doc.type === 'crypto') {
    const coinId = sym.toLowerCase().replace(/usdt$|usdc$|usd$|busd$|btc$|eth$/i, '');
    if (coinId.length >= 2) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${coinId}.org`, source: 'crypto:favicon', tier: 2 };
  }
  if (doc.type === 'forex') {
    const baseCur = sym.slice(0, 3).toUpperCase();
    if (FOREX_FLAGS[baseCur]) return { url: FOREX_FLAGS[baseCur], source: 'forex:flag', tier: 2 };
  }
  if (TYPE_FALLBACK[doc.type]) return { url: TYPE_FALLBACK[doc.type], source: `type:${doc.type}`, tier: 2 };

  // Tier 3: Clearbit (explicit domain)
  if (doc.companyDomain) {
    const domain = doc.companyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return { url: `https://logo.clearbit.com/${domain}`, source: 'clearbit', tier: 3 };
  }

  // Tier 3b: Clearbit (derived domain from company name)
  if (doc.name) {
    const derived = deriveDomain(doc.name);
    if (derived) return { url: `https://logo.clearbit.com/${derived}`, source: 'clearbit:derived', tier: 3 };
  }

  // Tier 4: exchange favicon
  const exDomain = EXCHANGE_DOMAIN[(doc.exchange || '').toUpperCase()];
  if (exDomain) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`, source: 'exchange:favicon', tier: 4 };

  // Tier 4b: Google favicon from derived domain
  if (doc.name) {
    const derived = deriveDomain(doc.name);
    if (derived) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${derived}`, source: 'google:derived', tier: 4 };
  }

  // Tier 5: generated SVG
  return { url: generateSvg(sym), source: 'generated', tier: 5 };
}

// ── Main ──
mongoose.connect('mongodb://127.0.0.1:27017/tradereplay').then(async () => {
  const db = mongoose.connection.db;
  const clean = db.collection('cleanassets');

  console.log('Reprocessing logos for all clean assets...');

  const BATCH = 1000;
  let processed = 0, updated = 0;
  const tierCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const tier5Samples = []; // track generated-SVG symbols for debugging

  const cursor = clean.find({}).project({
    _id: 1, symbol: 1, type: 1, exchange: 1, companyDomain: 1,
    iconUrl: 1, s3Icon: 1, name: 1,
  }).batchSize(BATCH);

  let batch = [];

  for await (const doc of cursor) {
    processed++;
    const logo = resolveLogo(doc);
    tierCounts[logo.tier]++;
    if (logo.tier >= 5 && tier5Samples.length < 50) {
      tier5Samples.push({ symbol: doc.symbol, name: doc.name, exchange: doc.exchange, type: doc.type });
    }

    batch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            iconUrl: logo.url,
            logoStatus: 'resolved',
            logoSource: logo.source,
          }
        }
      }
    });

    if (batch.length >= BATCH) {
      try {
        const r = await clean.bulkWrite(batch, { ordered: false });
        updated += r.modifiedCount;
      } catch (e) {
        if (e.result) updated += e.result.nModified || 0;
      }
      batch = [];
      if (processed % 20000 === 0) {
        console.log(`  ...processed=${processed}, updated=${updated}`);
      }
    }
  }

  if (batch.length > 0) {
    try {
      const r = await clean.bulkWrite(batch, { ordered: false });
      updated += r.modifiedCount;
    } catch (e) {
      if (e.result) updated += e.result.nModified || 0;
    }
  }

  // Verify coverage
  const total = await clean.countDocuments();
  const withLogo = await clean.countDocuments({
    iconUrl: { $ne: '', $exists: true }
  });
  const withoutLogo = await clean.countDocuments({
    $or: [{ iconUrl: '' }, { iconUrl: null }, { iconUrl: { $exists: false } }]
  });

  console.log(`\nDone: processed=${processed}, updated=${updated}`);
  console.log(`Tier breakdown:`, tierCounts);
  console.log(`Total: ${total}, With logo: ${withLogo}, Without: ${withoutLogo}`);
  console.log(`Coverage: ${((withLogo / total) * 100).toFixed(1)}%`);
  if (tier5Samples.length > 0) {
    console.log(`\nTier 5 samples (generated SVG — no real logo found):`);
    for (const s of tier5Samples.slice(0, 20)) {
      console.log(`  ${s.symbol} | ${s.name} | ${s.exchange} | ${s.type}`);
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
