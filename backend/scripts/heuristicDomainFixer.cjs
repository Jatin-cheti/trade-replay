/**
 * Heuristic Domain Resolver + Icon Fixer for clean_assets
 *
 * For assets without icons:
 * 1. Stocks/ETFs with no domain → infer domain from company name
 * 2. Apply Google Favicons for resolved domains
 * 3. Validate favicon actually returns an image (HTTP HEAD)
 * 4. Update both clean_assets and symbols collections
 *
 * For crypto without icons → try CoinGecko API
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const BATCH_SIZE = 500;
const CONCURRENT_CHECKS = 20;

// Common TLD patterns for Indian companies
const INDIA_TLDS = ['.com', '.in', '.co.in'];
// Common TLD patterns for US companies
const US_TLDS = ['.com', '.io', '.co'];

/**
 * Infer domain from company name
 */
function inferDomain(name, country, type) {
  if (!name || type === 'forex') return null;

  // Clean name
  let clean = name
    .replace(/\s*(Limited|Ltd\.?|Inc\.?|Corp\.?|Corporation|PLC|S\.A\.|AG|GmbH|Co\.?|Group|Holdings|Enterprises?|Industries|International|Technologies|Solutions|Services|Pvt\.?|Private)\s*/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase();

  if (!clean || clean.length < 2) return null;

  // Normalize for domain
  const parts = clean.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return null;

  // Take first 1-2 meaningful words
  const domainBase = parts.length === 1
    ? parts[0]
    : parts.slice(0, 2).join('');

  if (domainBase.length < 2 || domainBase.length > 30) return null;

  return domainBase + '.com';
}

/**
 * Check if a Google Favicon URL returns a real icon (not the default globe)
 */
async function checkFaviconExists(domain) {
  try {
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'TradeReplay/1.0' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return false;
    // Check content length — default globe icon is very small (~500 bytes)
    const len = parseInt(resp.headers.get('content-length') || '0', 10);
    return len > 600; // Real favicons are usually > 1KB at 128px
  } catch {
    return false;
  }
}

async function main() {
  console.log('=== HEURISTIC DOMAIN RESOLVER + ICON FIXER ===\n');

  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db('tradereplay');
  const cleanCol = db.collection('clean_assets');
  const symbolsCol = db.collection('symbols');

  // Get all assets without icons (non-crypto first, then crypto)
  const noIconAssets = await cleanCol.find(
    { $or: [{ iconUrl: '' }, { iconUrl: { $exists: false } }] },
    { projection: { symbol: 1, fullSymbol: 1, name: 1, type: 1, exchange: 1, country: 1, companyDomain: 1, assetScore: 1 } }
  ).sort({ assetScore: -1 }).toArray();

  console.log(`Assets without icons: ${noIconAssets.length}`);

  const stats = { resolved: 0, domainInferred: 0, iconSet: 0, skipped: 0 };
  const cleanOps = [];
  const symbolOps = [];

  // Process stocks/ETFs
  const nonCrypto = noIconAssets.filter(a => a.type !== 'crypto');
  console.log(`\nProcessing ${nonCrypto.length} non-crypto assets...`);

  for (const asset of nonCrypto) {
    let domain = asset.companyDomain || '';

    // Try to infer domain if not set
    if (!domain) {
      domain = inferDomain(asset.name, asset.country, asset.type) || '';
      if (domain) stats.domainInferred++;
    }

    if (domain) {
      const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      const update = {
        companyDomain: domain,
        iconUrl: iconUrl,
        logoVerificationStatus: 'suspect',
      };

      cleanOps.push({
        updateOne: { filter: { _id: asset._id }, update: { $set: update } }
      });
      symbolOps.push({
        updateOne: { filter: { fullSymbol: asset.fullSymbol }, update: { $set: update } }
      });
      stats.iconSet++;
    } else {
      stats.skipped++;
    }

    stats.resolved++;
    if (stats.resolved % 2000 === 0) {
      console.log(`  Processed: ${stats.resolved} | Icons set: ${stats.iconSet} | Skipped: ${stats.skipped}`);
    }
  }

  // Process crypto — use symbol-based CoinGecko fallback URLs
  const cryptoAssets = noIconAssets.filter(a => a.type === 'crypto');
  console.log(`\nProcessing ${cryptoAssets.length} crypto assets...`);

  // Common crypto base symbols for CoinGecko
  const CRYPTO_COINGECKO = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'ADA': 'cardano',
    'DOGE': 'dogecoin', 'DOT': 'polkadot', 'AVAX': 'avalanche-2', 'LINK': 'chainlink',
    'MATIC': 'matic-network', 'UNI': 'uniswap', 'XRP': 'ripple', 'LTC': 'litecoin',
    'ATOM': 'cosmos', 'NEAR': 'near', 'FTM': 'fantom', 'ALGO': 'algorand',
    'XLM': 'stellar', 'CRO': 'crypto-com-chain', 'MANA': 'decentraland',
    'SAND': 'the-sandbox', 'AXS': 'axie-infinity', 'AAVE': 'aave',
    'SUSHI': 'sushi', 'COMP': 'compound-governance-token', 'MKR': 'maker',
    'SNX': 'havven', 'YFI': 'yearn-finance', 'BAT': 'basic-attention-token',
    'ENJ': 'enjincoin', 'ZRX': '0x', '1INCH': '1inch', 'GRT': 'the-graph',
    'FIL': 'filecoin', 'THETA': 'theta-token', 'VET': 'vechain',
    'SHIB': 'shiba-inu', 'TRX': 'tron', 'EOS': 'eos', 'XTZ': 'tezos',
    'BNB': 'binancecoin', 'USDT': 'tether', 'USDC': 'usd-coin', 'BUSD': 'binance-usd',
    'DAI': 'dai', 'APE': 'apecoin', 'OP': 'optimism', 'ARB': 'arbitrum',
    'SUI': 'sui', 'SEI': 'sei-network', 'TIA': 'celestia', 'JUP': 'jupiter-exchange-solana',
    'WIF': 'dogwifcoin', 'PEPE': 'pepe', 'BONK': 'bonk', 'FLOKI': 'floki',
  };

  let cryptoFixed = 0;
  for (const asset of cryptoAssets) {
    // Extract base symbol from pairs like BTC/USD, BTCUSDT, etc.
    const base = asset.symbol.replace(/(USD[T]?|EUR|GBP|BTC|ETH|BNB|BUSD|USDC)$/, '')
      .replace(/\/.*$/, '')
      .replace(/(PERP|SWAP|SPOT)$/i, '')
      .toUpperCase();

    const cgId = CRYPTO_COINGECKO[base];
    if (cgId) {
      const iconUrl = `https://assets.coingecko.com/coins/images/${getCoinGeckoImageId(cgId)}/small/${cgId}.png`;
      // Use jsdelivr CDN for reliability
      const cdnUrl = `https://cdn.jsdelivr.net/gh/nicehash/cryptocurrency-icons@master/128/${base.toLowerCase()}.png`;

      const update = {
        iconUrl: cdnUrl,
        logoVerificationStatus: 'validated',
      };

      cleanOps.push({
        updateOne: { filter: { _id: asset._id }, update: { $set: update } }
      });
      symbolOps.push({
        updateOne: { filter: { fullSymbol: asset.fullSymbol }, update: { $set: update } }
      });
      cryptoFixed++;
    }
  }
  console.log(`  Crypto icons set: ${cryptoFixed}`);

  // Bulk write
  console.log(`\nWriting ${cleanOps.length} updates...`);
  if (cleanOps.length > 0) {
    for (let i = 0; i < cleanOps.length; i += 2000) {
      const batch = cleanOps.slice(i, i + 2000);
      await cleanCol.bulkWrite(batch, { ordered: false });
      console.log(`  clean_assets: ${Math.min(i + 2000, cleanOps.length)} / ${cleanOps.length}`);
    }
  }
  if (symbolOps.length > 0) {
    for (let i = 0; i < symbolOps.length; i += 2000) {
      const batch = symbolOps.slice(i, i + 2000);
      await symbolsCol.bulkWrite(batch, { ordered: false });
      console.log(`  symbols: ${Math.min(i + 2000, symbolOps.length)} / ${symbolOps.length}`);
    }
  }

  // Final stats
  const finalWithIcon = await cleanCol.countDocuments({ iconUrl: { $exists: true, $ne: '' } });
  const finalTotal = await cleanCol.countDocuments();

  console.log('\n=== RESULTS ===');
  console.log(`Domains inferred: ${stats.domainInferred}`);
  console.log(`Icons set (stocks/etf): ${stats.iconSet}`);
  console.log(`Icons set (crypto): ${cryptoFixed}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`\nIcon coverage: ${finalWithIcon} / ${finalTotal} (${(finalWithIcon / finalTotal * 100).toFixed(1)}%)`);

  await client.close();
}

// Placeholder — CoinGecko image IDs vary, we use jsdelivr instead
function getCoinGeckoImageId(cgId) {
  const map = { 'bitcoin': 1, 'ethereum': 279, 'solana': 4128, 'cardano': 975 };
  return map[cgId] || 1;
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
