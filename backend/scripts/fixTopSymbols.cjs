/**
 * Fix top symbols with wrong domains/logos immediately.
 * Run: node backend/scripts/fixTopSymbols.cjs
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017/tradereplay';

// Top symbols with verified correct domains
const FIXES = [
  { symbol: 'AAPL',     domain: 'apple.com',          name: 'Apple Inc' },
  { symbol: 'MSFT',     domain: 'microsoft.com',      name: 'Microsoft' },
  { symbol: 'GOOGL',    domain: 'google.com',          name: 'Alphabet' },
  { symbol: 'GOOG',     domain: 'google.com',          name: 'Alphabet' },
  { symbol: 'AMZN',     domain: 'amazon.com',          name: 'Amazon' },
  { symbol: 'TSLA',     domain: 'tesla.com',           name: 'Tesla' },
  { symbol: 'META',     domain: 'meta.com',            name: 'Meta' },
  { symbol: 'NVDA',     domain: 'nvidia.com',          name: 'NVIDIA' },
  { symbol: 'JPM',      domain: 'jpmorganchase.com',   name: 'JPMorgan' },
  { symbol: 'V',        domain: 'visa.com',            name: 'Visa' },
  { symbol: 'JNJ',      domain: 'jnj.com',             name: 'J&J' },
  { symbol: 'WMT',      domain: 'walmart.com',         name: 'Walmart' },
  { symbol: 'PG',       domain: 'pg.com',              name: 'P&G' },
  { symbol: 'MA',       domain: 'mastercard.com',      name: 'Mastercard' },
  { symbol: 'HD',       domain: 'homedepot.com',       name: 'Home Depot' },
  { symbol: 'DIS',      domain: 'disney.com',          name: 'Disney' },
  { symbol: 'BAC',      domain: 'bankofamerica.com',   name: 'Bank of America' },
  { symbol: 'NFLX',     domain: 'netflix.com',         name: 'Netflix' },
  { symbol: 'ADBE',     domain: 'adobe.com',           name: 'Adobe' },
  { symbol: 'CRM',      domain: 'salesforce.com',      name: 'Salesforce' },
  { symbol: 'INTC',     domain: 'intel.com',           name: 'Intel' },
  { symbol: 'AMD',      domain: 'amd.com',             name: 'AMD' },
  { symbol: 'CSCO',     domain: 'cisco.com',           name: 'Cisco' },
  { symbol: 'ORCL',     domain: 'oracle.com',          name: 'Oracle' },
  { symbol: 'IBM',      domain: 'ibm.com',             name: 'IBM' },
  { symbol: 'QCOM',     domain: 'qualcomm.com',        name: 'Qualcomm' },
  { symbol: 'PYPL',     domain: 'paypal.com',          name: 'PayPal' },
  { symbol: 'T',        domain: 'att.com',             name: 'AT&T' },
  { symbol: 'VZ',       domain: 'verizon.com',         name: 'Verizon' },
  { symbol: 'KO',       domain: 'coca-cola.com',       name: 'Coca-Cola' },
  { symbol: 'PEP',      domain: 'pepsico.com',         name: 'PepsiCo' },
  { symbol: 'MCD',      domain: 'mcdonalds.com',       name: 'McDonalds' },
  { symbol: 'NKE',      domain: 'nike.com',            name: 'Nike' },
  { symbol: 'SBUX',     domain: 'starbucks.com',       name: 'Starbucks' },
  { symbol: 'COST',     domain: 'costco.com',          name: 'Costco' },
  { symbol: 'GS',       domain: 'goldmansachs.com',    name: 'Goldman Sachs' },
  { symbol: 'MS',       domain: 'morganstanley.com',   name: 'Morgan Stanley' },
  { symbol: 'C',        domain: 'citigroup.com',       name: 'Citigroup' },
  { symbol: 'WFC',      domain: 'wellsfargo.com',      name: 'Wells Fargo' },
  { symbol: 'UNH',      domain: 'unitedhealthgroup.com', name: 'UnitedHealth' },
  { symbol: 'ABBV',     domain: 'abbvie.com',          name: 'AbbVie' },
  { symbol: 'PFE',      domain: 'pfizer.com',          name: 'Pfizer' },
  { symbol: 'MRK',      domain: 'merck.com',           name: 'Merck' },
  { symbol: 'LLY',      domain: 'lilly.com',           name: 'Eli Lilly' },
  { symbol: 'TMO',      domain: 'thermofisher.com',    name: 'Thermo Fisher' },
  { symbol: 'ABT',      domain: 'abbott.com',          name: 'Abbott' },
  { symbol: 'BA',       domain: 'boeing.com',          name: 'Boeing' },
  { symbol: 'CAT',      domain: 'cat.com',             name: 'Caterpillar' },
  { symbol: 'GE',       domain: 'ge.com',              name: 'GE' },
  { symbol: 'MMM',      domain: '3m.com',              name: '3M' },
  // ETFs
  { symbol: 'SPY',      domain: 'ssga.com',            name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ',      domain: 'invesco.com',         name: 'Invesco QQQ' },
  { symbol: 'IWM',      domain: 'ishares.com',         name: 'iShares Russell 2000' },
  { symbol: 'VTI',      domain: 'vanguard.com',        name: 'Vanguard Total Stock' },
  { symbol: 'VOO',      domain: 'vanguard.com',        name: 'Vanguard S&P 500' },
  { symbol: 'DIA',      domain: 'ssga.com',            name: 'SPDR Dow Jones' },
  { symbol: 'ARKK',     domain: 'ark-invest.com',      name: 'ARK Innovation' },
  { symbol: 'XLF',      domain: 'ssga.com',            name: 'Financial Select SPDR' },
  { symbol: 'XLK',      domain: 'ssga.com',            name: 'Tech Select SPDR' },
  { symbol: 'GLD',      domain: 'ssga.com',            name: 'SPDR Gold' },
  { symbol: 'SLV',      domain: 'ishares.com',         name: 'iShares Silver' },
  // Indian
  { symbol: 'RELIANCE', domain: 'ril.com',             name: 'Reliance Industries' },
  { symbol: 'TCS',      domain: 'tcs.com',             name: 'TCS' },
  { symbol: 'INFY',     domain: 'infosys.com',         name: 'Infosys' },
  { symbol: 'HDFCBANK', domain: 'hdfcbank.com',        name: 'HDFC Bank' },
  { symbol: 'ICICIBANK',domain: 'icicibank.com',       name: 'ICICI Bank' },
  { symbol: 'SBIN',     domain: 'sbi.co.in',           name: 'SBI' },
  { symbol: 'WIPRO',    domain: 'wipro.com',           name: 'Wipro' },
  { symbol: 'HINDUNILVR',domain: 'hul.co.in',          name: 'HUL' },
  { symbol: 'ITC',      domain: 'itcportal.com',       name: 'ITC' },
  { symbol: 'BAJFINANCE',domain: 'bajajfinserv.in',    name: 'Bajaj Finance' },
  { symbol: 'TATAMOTORS',domain: 'tatamotors.com',     name: 'Tata Motors' },
  { symbol: 'TATASTEEL',domain: 'tatasteel.com',       name: 'Tata Steel' },
  { symbol: 'MARUTI',   domain: 'marutisuzuki.com',    name: 'Maruti Suzuki' },
  { symbol: 'AXISBANK', domain: 'axisbank.com',        name: 'Axis Bank' },
  { symbol: 'KOTAKBANK',domain: 'kotak.com',           name: 'Kotak Bank' },
  { symbol: 'LT',       domain: 'larsentoubro.com',    name: 'L&T' },
  { symbol: 'SUNPHARMA',domain: 'sunpharma.com',       name: 'Sun Pharma' },
  { symbol: 'HCLTECH',  domain: 'hcltech.com',         name: 'HCL Tech' },
  { symbol: 'ADANIENT', domain: 'adani.com',           name: 'Adani Enterprises' },
  { symbol: 'ASIANPAINT',domain: 'asianpaints.com',    name: 'Asian Paints' },
];

function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('tradereplay');
  const symbols = db.collection('symbols');

  let totalFixed = 0;
  let totalPropagated = 0;

  for (const fix of FIXES) {
    const logoUrl = faviconUrl(fix.domain);

    // Fix primary (by symbol across all exchanges, but only if domain is wrong or missing)
    const result = await symbols.updateMany(
      {
        symbol: fix.symbol,
        $or: [
          { companyDomain: { $in: ['', null, 'financialmodelingprep.com', 'clearbit.com', 'logo.clearbit.com'] } },
          { companyDomain: { $exists: false } },
          // Also fix if icon has api key
          { iconUrl: /apikey=/i },
        ],
      },
      {
        $set: {
          iconUrl: logoUrl,
          companyDomain: fix.domain,
          logoValidatedAt: new Date(),
          logoVerificationStatus: 'validated',
          logoQualityScore: 99,
        },
      },
    );

    if (result.modifiedCount > 0) {
      totalFixed += result.modifiedCount;
      console.log(`✓ ${fix.symbol} → ${fix.domain}: fixed ${result.modifiedCount} docs`);
    }

    // Also propagate to derivatives of these symbols
    const derivResult = await symbols.updateMany(
      {
        symbol: fix.symbol,
        type: 'derivative',
        $or: [
          { companyDomain: { $in: ['', null, 'financialmodelingprep.com'] } },
          { iconUrl: /apikey=/i },
        ],
      },
      {
        $set: {
          iconUrl: logoUrl,
          companyDomain: fix.domain,
          logoValidatedAt: new Date(),
          logoVerificationStatus: 'validated',
        },
      },
    );

    if (derivResult.modifiedCount > 0) {
      totalPropagated += derivResult.modifiedCount;
    }
  }

  // Also clean ALL API key leaks across the entire collection
  const apiKeyLeaks = await symbols.updateMany(
    { iconUrl: /[?&]apikey=[^&]+/i },
    [
      {
        $set: {
          iconUrl: {
            $replaceAll: {
              input: '$iconUrl',
              find: { $regexFind: { input: '$iconUrl', regex: /[?&]apikey=[^&]+/i } },
              replacement: '',
            },
          },
          logoVerificationStatus: 'repaired',
        },
      },
    ],
  );

  // Simpler approach for API key cleanup
  const leakDocs = await symbols.find(
    { iconUrl: /[?&]apikey=/i },
    { projection: { _id: 1, iconUrl: 1, symbol: 1 } },
  ).limit(10000).toArray();

  let apiKeyCleaned = 0;
  for (const doc of leakDocs) {
    if (!doc.iconUrl) continue;
    const cleaned = doc.iconUrl.replace(/[?&]apikey=[^&]+/gi, '');
    if (cleaned !== doc.iconUrl) {
      await symbols.updateOne(
        { _id: doc._id },
        { $set: { iconUrl: cleaned, logoVerificationStatus: 'repaired' } },
      );
      apiKeyCleaned++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Top symbols fixed: ${totalFixed}`);
  console.log(`Derivatives propagated: ${totalPropagated}`);
  console.log(`API key leaks cleaned: ${apiKeyCleaned}`);

  // Verify a few key symbols
  console.log('\n=== VERIFICATION ===');
  for (const sym of ['AAPL', 'SPY', 'RELIANCE', 'TSLA', 'TCS']) {
    const doc = await symbols.findOne(
      { symbol: sym, type: { $ne: 'derivative' } },
      { projection: { symbol: 1, companyDomain: 1, iconUrl: 1, logoVerificationStatus: 1 } },
    );
    if (doc) {
      console.log(`${doc.symbol}: domain=${doc.companyDomain} status=${doc.logoVerificationStatus} icon=${doc.iconUrl?.substring(0, 60)}`);
    }
  }

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
