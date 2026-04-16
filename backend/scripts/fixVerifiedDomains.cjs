/**
 * Fix ALL symbols in the high-confidence domain map (not just top 80).
 * This propagates correct domains from the VERIFIED_DOMAIN_MAP + HIGH_CONFIDENCE_DOMAIN_MAP
 * to all matching symbol documents.
 * Run: node backend/scripts/fixVerifiedDomains.cjs
 */
const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/tradereplay';

// Combined domain map - extracted from domainConfidence.service.ts + highConfidenceDomainMap.ts
// This includes Indian stocks, US mega-caps, major ETFs, and more
const VERIFIED_DOMAINS = {
  // ── US Mega-caps ──
  AAPL: 'apple.com', MSFT: 'microsoft.com', GOOGL: 'google.com', GOOG: 'google.com',
  AMZN: 'amazon.com', TSLA: 'tesla.com', META: 'meta.com', NVDA: 'nvidia.com',
  BRK: 'berkshirehathaway.com', JPM: 'jpmorganchase.com', V: 'visa.com',
  JNJ: 'jnj.com', WMT: 'walmart.com', PG: 'pg.com', MA: 'mastercard.com',
  HD: 'homedepot.com', DIS: 'disney.com', BAC: 'bankofamerica.com',
  NFLX: 'netflix.com', ADBE: 'adobe.com', CRM: 'salesforce.com',
  INTC: 'intel.com', AMD: 'amd.com', CSCO: 'cisco.com', ORCL: 'oracle.com',
  IBM: 'ibm.com', QCOM: 'qualcomm.com', PYPL: 'paypal.com',
  T: 'att.com', VZ: 'verizon.com', KO: 'coca-cola.com', PEP: 'pepsico.com',
  MCD: 'mcdonalds.com', NKE: 'nike.com', SBUX: 'starbucks.com', COST: 'costco.com',
  GS: 'goldmansachs.com', MS: 'morganstanley.com', C: 'citigroup.com',
  WFC: 'wellsfargo.com', UNH: 'unitedhealthgroup.com', ABBV: 'abbvie.com',
  PFE: 'pfizer.com', MRK: 'merck.com', LLY: 'lilly.com', TMO: 'thermofisher.com',
  ABT: 'abbott.com', BA: 'boeing.com', CAT: 'cat.com', GE: 'ge.com', MMM: '3m.com',
  AVGO: 'broadcom.com', TXN: 'ti.com', MU: 'micron.com', AMAT: 'appliedmaterials.com',
  LRCX: 'lamresearch.com', KLAC: 'kla.com', MRVL: 'marvell.com',
  NOW: 'servicenow.com', SNOW: 'snowflake.com', PANW: 'paloaltonetworks.com',
  CRWD: 'crowdstrike.com', ZS: 'zscaler.com', DDOG: 'datadoghq.com',
  NET: 'cloudflare.com', MDB: 'mongodb.com', TEAM: 'atlassian.com',
  SQ: 'squareup.com', SHOP: 'shopify.com', UBER: 'uber.com', LYFT: 'lyft.com',
  ABNB: 'airbnb.com', DASH: 'doordash.com', RBLX: 'roblox.com',
  COIN: 'coinbase.com', HOOD: 'robinhood.com', PLTR: 'palantir.com',
  AI: 'c3.ai', PATH: 'uipath.com', U: 'unity.com',
  F: 'ford.com', GM: 'gm.com', RIVN: 'rivian.com', LCID: 'lucidmotors.com',
  XOM: 'exxonmobil.com', CVX: 'chevron.com', COP: 'conocophillips.com',
  NEE: 'nexteraenergy.com', SO: 'southerncompany.com',
  // ── ETFs ──
  SPY: 'ssga.com', QQQ: 'invesco.com', IWM: 'ishares.com',
  VTI: 'vanguard.com', VOO: 'vanguard.com', VEA: 'vanguard.com',
  VWO: 'vanguard.com', BND: 'vanguard.com', VXUS: 'vanguard.com',
  DIA: 'ssga.com', GLD: 'ssga.com', SLV: 'ishares.com',
  ARKK: 'ark-invest.com', ARKG: 'ark-invest.com', ARKF: 'ark-invest.com',
  XLF: 'ssga.com', XLK: 'ssga.com', XLE: 'ssga.com', XLV: 'ssga.com',
  XLI: 'ssga.com', XLP: 'ssga.com', XLY: 'ssga.com', XLB: 'ssga.com',
  XLU: 'ssga.com', XLRE: 'ssga.com',
  EEM: 'ishares.com', EFA: 'ishares.com', AGG: 'ishares.com',
  TLT: 'ishares.com', HYG: 'ishares.com', LQD: 'ishares.com',
  IEMG: 'ishares.com', IXUS: 'ishares.com',
  SCHD: 'schwab.com', SCHF: 'schwab.com', SCHB: 'schwab.com',
  SQQQ: 'proshares.com', TQQQ: 'proshares.com', SPXU: 'proshares.com',
  // ── Indian ──
  RELIANCE: 'ril.com', TCS: 'tcs.com', INFY: 'infosys.com',
  HDFCBANK: 'hdfcbank.com', ICICIBANK: 'icicibank.com', SBIN: 'sbi.co.in',
  WIPRO: 'wipro.com', HINDUNILVR: 'hul.co.in', ITC: 'itcportal.com',
  BAJFINANCE: 'bajajfinserv.in', TATAMOTORS: 'tatamotors.com',
  TATASTEEL: 'tatasteel.com', MARUTI: 'marutisuzuki.com',
  AXISBANK: 'axisbank.com', KOTAKBANK: 'kotak.com',
  LT: 'larsentoubro.com', SUNPHARMA: 'sunpharma.com',
  HCLTECH: 'hcltech.com', ADANIENT: 'adani.com',
  ASIANPAINT: 'asianpaints.com', BHARTIARTL: 'airtel.in',
  BAJAJFINSV: 'bajajfinserv.in', TITAN: 'titancompany.in',
  NESTLEIND: 'nestle.in', ULTRACEMCO: 'ultratechcement.com',
  TECHM: 'techmahindra.com', POWERGRID: 'powergridindia.com',
  NTPC: 'ntpc.co.in', ONGC: 'ongcindia.com', COALINDIA: 'coalindia.in',
  HINDALCO: 'hindalco.com', JSWSTEEL: 'jsw.in', DIVISLAB: 'dfrlab.com',
  DRREDDY: 'drreddy.com', CIPLA: 'cipla.com',
  EICHERMOT: 'eichermotors.com', M_M: 'mahindra.com',
  HEROMOTOCO: 'heromotocorp.com', BAJAJ_AUTO: 'bajajauto.com',
  HINDZINC: 'hzlindia.com', VEDL: 'vedantalimited.com',
  BPCL: 'bharatpetroleum.in', IOC: 'iocl.com',
  GAIL: 'gailonline.com', INDUSINDBK: 'indusind.com',
  BANDHANBNK: 'bandhanbank.com', SBILIFE: 'sbilife.co.in',
  HDFCLIFE: 'hdfclife.com', ICICIPRULI: 'iciciprulife.com',
  TATACONSUM: 'tataconsumer.com', GODREJCP: 'godrejcp.com',
  DABUR: 'dabur.com', MARICO: 'marico.com',
  PIDILITIND: 'pidilite.com', BERGEPAINT: 'bergerpaints.com',
  HAVELLS: 'havells.com', VOLTAS: 'voltas.com',
  TRENT: 'tfrgroup.com', PAGEIND: 'pageindustries.com',
  COLPAL: 'colgatepalmolive.co.in',
  GRASIM: 'grasim.com', SHREECEM: 'shreecement.com',
  AMBUJACEM: 'ambujacement.com',
};

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
  const entries = Object.entries(VERIFIED_DOMAINS);

  console.log(`Fixing ${entries.length} verified domain entries...\n`);

  for (const [sym, domain] of entries) {
    const logoUrl = faviconUrl(domain);

    // Fix ALL docs of this symbol that have wrong/missing domain
    const result = await symbols.updateMany(
      {
        symbol: sym,
        $or: [
          { companyDomain: { $in: ['', null, 'financialmodelingprep.com', 'clearbit.com', 'logo.clearbit.com'] } },
          { companyDomain: { $exists: false } },
        ],
      },
      {
        $set: {
          iconUrl: logoUrl,
          companyDomain: domain,
          logoValidatedAt: new Date(),
          logoVerificationStatus: 'validated',
          logoQualityScore: 99,
        },
      },
    );

    if (result.modifiedCount > 0) {
      totalFixed += result.modifiedCount;
    }

    // Also fix derivatives
    const derivResult = await symbols.updateMany(
      {
        symbol: sym,
        type: 'derivative',
        $or: [
          { companyDomain: { $in: ['', null, 'financialmodelingprep.com'] } },
          { companyDomain: { $exists: false } },
        ],
      },
      {
        $set: {
          iconUrl: logoUrl,
          companyDomain: domain,
          logoValidatedAt: new Date(),
          logoVerificationStatus: 'validated',
        },
      },
    );

    totalPropagated += derivResult.modifiedCount;
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Primary symbols fixed: ${totalFixed}`);
  console.log(`Derivatives propagated: ${totalPropagated}`);
  console.log(`Total entries processed: ${entries.length}`);

  // Stats
  const validated = await symbols.countDocuments({ logoVerificationStatus: 'validated' });
  const repaired = await symbols.countDocuments({ logoVerificationStatus: 'repaired' });
  console.log(`\nDB-wide validated: ${validated}`);
  console.log(`DB-wide repaired: ${repaired}`);

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
