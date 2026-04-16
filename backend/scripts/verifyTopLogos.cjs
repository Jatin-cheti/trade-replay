/**
 * Verify top symbols have correct logos after fixes.
 * Run: node backend/scripts/verifyTopLogos.cjs
 */
const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/tradereplay';

const CHECK_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V',
  'SPY', 'QQQ', 'IWM', 'VOO', 'GLD',
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN',
  'BTC', 'ETH', 'SOL', 'DOGE', 'ADA',
];

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('tradereplay');
  const symbols = db.collection('symbols');

  let pass = 0;
  let fail = 0;

  console.log('=== TOP SYMBOL LOGO VERIFICATION ===\n');
  console.log('Symbol'.padEnd(14) + 'Domain'.padEnd(30) + 'Status'.padEnd(12) + 'HasIcon  ApiKeyLeak  IconPreview');
  console.log('-'.repeat(120));

  for (const sym of CHECK_SYMBOLS) {
    const doc = await symbols.findOne(
      { symbol: sym, type: { $nin: ['derivative'] } },
      { projection: { symbol: 1, companyDomain: 1, iconUrl: 1, logoVerificationStatus: 1, type: 1 } },
    );

    if (!doc) {
      console.log(`${sym.padEnd(14)}NOT FOUND`);
      fail++;
      continue;
    }

    const hasIcon = !!doc.iconUrl && doc.iconUrl.length > 5;
    const hasApiKey = doc.iconUrl && /apikey=/i.test(doc.iconUrl);
    const domain = (doc.companyDomain || '').padEnd(28);
    const status = (doc.logoVerificationStatus || 'unknown').padEnd(12);
    const preview = (doc.iconUrl || '').substring(0, 55);
    const icon = hasIcon ? 'YES' : 'NO ';

    if (hasIcon && !hasApiKey) {
      pass++;
      console.log(`✓ ${sym.padEnd(12)}${domain}  ${status}${icon}      ${hasApiKey ? 'LEAK!' : 'clean'}       ${preview}`);
    } else {
      fail++;
      console.log(`✗ ${sym.padEnd(12)}${domain}  ${status}${icon}      ${hasApiKey ? 'LEAK!' : 'clean'}       ${preview}`);
    }
  }

  // Global stats
  const totalCount = await symbols.estimatedDocumentCount();
  const withIcon = await symbols.countDocuments({ iconUrl: { $ne: '', $exists: true } });
  const apiKeyLeaks = await symbols.countDocuments({ iconUrl: /apikey=/i });
  const validated = await symbols.countDocuments({ logoVerificationStatus: 'validated' });
  const repaired = await symbols.countDocuments({ logoVerificationStatus: 'repaired' });
  const wrongDomain = await symbols.countDocuments({
    companyDomain: { $in: ['financialmodelingprep.com', 'clearbit.com', 'logo.clearbit.com'] },
  });

  console.log(`\n=== GLOBAL STATS ===`);
  console.log(`Total symbols: ${totalCount}`);
  console.log(`With icon: ${withIcon} (${((withIcon / totalCount) * 100).toFixed(1)}%)`);
  console.log(`Validated: ${validated}`);
  console.log(`Repaired: ${repaired}`);
  console.log(`API key leaks remaining: ${apiKeyLeaks}`);
  console.log(`Wrong domains remaining: ${wrongDomain}`);
  console.log(`\nTop symbols: ${pass}/${CHECK_SYMBOLS.length} pass, ${fail} fail`);

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
