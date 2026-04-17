/**
 * Batch reprocess all clean assets to resolve logos — 100% coverage.
 * Uses logoResolver.service.ts tiered resolution.
 */
const mongoose = require('mongoose');

// Inline logo resolver (since we can't import TS from CJS)
const SYMBOL_LOGO_MAP = {
  NIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTY50: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SENSEX: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BSE_Logo.svg/120px-BSE_Logo.svg.png",
  BANKNIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SPX: "https://logo.clearbit.com/spglobal.com",
  DJI: "https://logo.clearbit.com/spglobal.com",
  IXIC: "https://logo.clearbit.com/nasdaq.com",
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
};

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

  // Tier 1: symbol map
  const base = sym.replace(/(USDT|USDC|USD|BUSD|BTC|ETH)$/, '');
  if (SYMBOL_LOGO_MAP[sym]) return { url: SYMBOL_LOGO_MAP[sym], source: 'symbolMap', tier: 1 };
  if (base && SYMBOL_LOGO_MAP[base]) return { url: SYMBOL_LOGO_MAP[base], source: 'symbolMap:base', tier: 1 };

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

  // Tier 3: Clearbit
  if (doc.companyDomain) {
    const domain = doc.companyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return { url: `https://logo.clearbit.com/${domain}`, source: 'clearbit', tier: 3 };
  }

  // Tier 4: exchange favicon
  const exDomain = EXCHANGE_DOMAIN[(doc.exchange || '').toUpperCase()];
  if (exDomain) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`, source: 'exchange:favicon', tier: 4 };

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

  const cursor = clean.find({}).project({
    _id: 1, symbol: 1, type: 1, exchange: 1, companyDomain: 1,
    iconUrl: 1, s3Icon: 1, name: 1,
  }).batchSize(BATCH);

  let batch = [];

  for await (const doc of cursor) {
    processed++;
    const logo = resolveLogo(doc);
    tierCounts[logo.tier]++;

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

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
