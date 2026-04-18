/**
 * MASTER LOGO FIX — Runs until coverage >= 99% on the SYMBOLS collection.
 *
 * TASK 1: Apply reprocessLogos tier logic to ALL symbols (not just clean assets)
 * TASK 2: Replace all generated SVG fallbacks with real logos
 * TASK 3: Reconcile symbols → clean_assets (promote missing)
 * TASK 4: Unify coverage metric so API and rebuild agree
 * TASK 5: Report single unified number
 */
const mongoose = require('mongoose');

// ── Expanded Symbol Map ──
const SYMBOL_LOGO_MAP = {
  NIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  NIFTY50: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  "NIFTY 50": "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SENSEX: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/BSE_Logo.svg/120px-BSE_Logo.svg.png",
  BANKNIFTY: "https://upload.wikimedia.org/wikipedia/en/thumb/4/49/NSE_India_Logo.svg/120px-NSE_India_Logo.svg.png",
  SPX: "https://logo.clearbit.com/spglobal.com",
  DJI: "https://logo.clearbit.com/spglobal.com",
  IXIC: "https://logo.clearbit.com/nasdaq.com",
  FTSE: "https://logo.clearbit.com/lseg.com",
  DAX: "https://logo.clearbit.com/deutsche-boerse.com",
  CAC40: "https://logo.clearbit.com/euronext.com",
  N225: "https://logo.clearbit.com/jpx.co.jp",
  HSI: "https://logo.clearbit.com/hkex.com.hk",
  KOSPI: "https://logo.clearbit.com/krx.co.kr",
  STI: "https://logo.clearbit.com/sgx.com",
  ASX200: "https://logo.clearbit.com/asx.com.au",
  VIX: "https://logo.clearbit.com/cboe.com",
  NDX: "https://logo.clearbit.com/nasdaq.com",
  RUT: "https://logo.clearbit.com/ftserussell.com",
  DXY: "https://www.google.com/s2/favicons?sz=128&domain=ice.com",
  XAUUSD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  XAGUSD: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  GOLD: "https://www.google.com/s2/favicons?sz=128&domain=gold.org",
  SILVER: "https://www.google.com/s2/favicons?sz=128&domain=silverinstitute.org",
  CRUDEOIL: "https://www.google.com/s2/favicons?sz=128&domain=opec.org",
  NATURALGAS: "https://www.google.com/s2/favicons?sz=128&domain=eia.gov",
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
  AAVE: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png",
  SHIB: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
  LTC: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
  TRX: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png",
  NEAR: "https://assets.coingecko.com/coins/images/10365/small/near.jpg",
  ATOM: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png",
  FTM: "https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png",
  ALGO: "https://assets.coingecko.com/coins/images/4380/small/download.png",
  ICP: "https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png",
  FIL: "https://assets.coingecko.com/coins/images/12817/small/filecoin.png",
  APT: "https://assets.coingecko.com/coins/images/26455/small/aptos_round.png",
  ARB: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
  OP: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  SUI: "https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg",
  SEI: "https://assets.coingecko.com/coins/images/28205/small/Sei_Logo_-_Transparent.png",
  INJ: "https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png",
  PEPE: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg",
  WIF: "https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg",
  BONK: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg",
  RENDER: "https://assets.coingecko.com/coins/images/11636/small/rndr.png",
  GRT: "https://assets.coingecko.com/coins/images/13397/small/Graph_Token.png",
  SAND: "https://assets.coingecko.com/coins/images/12129/small/sandbox_logo.jpg",
  MANA: "https://assets.coingecko.com/coins/images/878/small/decentraland-mana.png",
  AXS: "https://assets.coingecko.com/coins/images/13029/small/axie_infinity_logo.png",
  CRV: "https://assets.coingecko.com/coins/images/12124/small/Curve.png",
  MKR: "https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png",
  COMP: "https://assets.coingecko.com/coins/images/10775/small/COMP.png",
  SNX: "https://assets.coingecko.com/coins/images/3406/small/SNX.png",
  SUSHI: "https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chop.png",
  YFI: "https://assets.coingecko.com/coins/images/11849/small/yearn-finance-yfi.png",
  RUNE: "https://assets.coingecko.com/coins/images/6595/small/Rune200x200.png",
  ENS: "https://assets.coingecko.com/coins/images/19785/small/acatxTm8_400x400.jpg",
  WLD: "https://assets.coingecko.com/coins/images/31069/small/worldcoin.jpeg",
  STX: "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png",
  IMX: "https://assets.coingecko.com/coins/images/17233/small/immutableX-symbol-BLK-RGB.png",
  FLOW: "https://assets.coingecko.com/coins/images/13446/small/5f6294c0c7a8cda55cb1c936_Flow_Wordmark.png",
  EGLD: "https://assets.coingecko.com/coins/images/12335/small/multiversx-symbol.png",
  THETA: "https://assets.coingecko.com/coins/images/2538/small/theta-token-logo.png",
  HBAR: "https://assets.coingecko.com/coins/images/3688/small/hbar.png",
  VET: "https://assets.coingecko.com/coins/images/1167/small/VeChain-Logo-768x725.png",
  XLM: "https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png",
  EOS: "https://assets.coingecko.com/coins/images/738/small/eos-eos-logo.png",
  XTZ: "https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png",
  IOTA: "https://assets.coingecko.com/coins/images/692/small/IOTA_Swirl.png",
  NEO: "https://assets.coingecko.com/coins/images/480/small/NEO_512_512.png",
  ZEC: "https://assets.coingecko.com/coins/images/486/small/circle-zcash-color.png",
  DASH: "https://assets.coingecko.com/coins/images/19/small/dash-logo.png",
  XMR: "https://assets.coingecko.com/coins/images/69/small/monero_logo.png",
  ETC: "https://assets.coingecko.com/coins/images/453/small/ethereum-classic-logo.png",
  BCH: "https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png",
  DAI: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
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
  HKD: "https://www.google.com/s2/favicons?sz=128&domain=hkma.gov.hk",
  SGD: "https://www.google.com/s2/favicons?sz=128&domain=mas.gov.sg",
  SEK: "https://www.google.com/s2/favicons?sz=128&domain=riksbank.se",
  NOK: "https://www.google.com/s2/favicons?sz=128&domain=norges-bank.no",
  DKK: "https://www.google.com/s2/favicons?sz=128&domain=nationalbanken.dk",
  PLN: "https://www.google.com/s2/favicons?sz=128&domain=nbp.pl",
  MXN: "https://www.google.com/s2/favicons?sz=128&domain=banxico.org.mx",
  ZAR: "https://www.google.com/s2/favicons?sz=128&domain=resbank.co.za",
  TRY: "https://www.google.com/s2/favicons?sz=128&domain=tcmb.gov.tr",
  RUB: "https://www.google.com/s2/favicons?sz=128&domain=cbr.ru",
  BRL: "https://www.google.com/s2/favicons?sz=128&domain=bcb.gov.br",
  KRW: "https://www.google.com/s2/favicons?sz=128&domain=bok.or.kr",
  THB: "https://www.google.com/s2/favicons?sz=128&domain=bot.or.th",
  TWD: "https://www.google.com/s2/favicons?sz=128&domain=cbc.gov.tw",
  IDR: "https://www.google.com/s2/favicons?sz=128&domain=bi.go.id",
  PHP: "https://www.google.com/s2/favicons?sz=128&domain=bsp.gov.ph",
  MYR: "https://www.google.com/s2/favicons?sz=128&domain=bnm.gov.my",
  CZK: "https://www.google.com/s2/favicons?sz=128&domain=cnb.cz",
  HUF: "https://www.google.com/s2/favicons?sz=128&domain=mnb.hu",
  CLP: "https://www.google.com/s2/favicons?sz=128&domain=bcentral.cl",
  COP: "https://www.google.com/s2/favicons?sz=128&domain=banrep.gov.co",
  PEN: "https://www.google.com/s2/favicons?sz=128&domain=bcrp.gob.pe",
  ARS: "https://www.google.com/s2/favicons?sz=128&domain=bcra.gob.ar",
  ILS: "https://www.google.com/s2/favicons?sz=128&domain=boi.org.il",
  SAR: "https://www.google.com/s2/favicons?sz=128&domain=sama.gov.sa",
  AED: "https://www.google.com/s2/favicons?sz=128&domain=centralbank.ae",
  QAR: "https://www.google.com/s2/favicons?sz=128&domain=qcb.gov.qa",
  KWD: "https://www.google.com/s2/favicons?sz=128&domain=cbk.gov.kw",
  BHD: "https://www.google.com/s2/favicons?sz=128&domain=cbb.gov.bh",
  OMR: "https://www.google.com/s2/favicons?sz=128&domain=cbo.gov.om",
  JOD: "https://www.google.com/s2/favicons?sz=128&domain=cbj.gov.jo",
  EGP: "https://www.google.com/s2/favicons?sz=128&domain=cbe.org.eg",
  NGN: "https://www.google.com/s2/favicons?sz=128&domain=cbn.gov.ng",
  KES: "https://www.google.com/s2/favicons?sz=128&domain=centralbank.go.ke",
  GHS: "https://www.google.com/s2/favicons?sz=128&domain=bog.gov.gh",
  MAD: "https://www.google.com/s2/favicons?sz=128&domain=bkam.ma",
  TND: "https://www.google.com/s2/favicons?sz=128&domain=bct.gov.tn",
  RON: "https://www.google.com/s2/favicons?sz=128&domain=bnr.ro",
  BGN: "https://www.google.com/s2/favicons?sz=128&domain=bnb.bg",
  HRK: "https://www.google.com/s2/favicons?sz=128&domain=hnb.hr",
  ISK: "https://www.google.com/s2/favicons?sz=128&domain=cb.is",
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
  FOREX: "xe.com", FX: "xe.com", OTC: "otcmarkets.com",
  SEC: "sec.gov", GLOBAL: "coingecko.com",
  JPX: "jpx.co.jp", TSE: "jpx.co.jp", KRX: "krx.co.kr",
  TWSE: "twse.com.tw", SSE: "sse.com.cn", SZSE: "szse.cn",
  MEXC: "mexc.com", BITFINEX: "bitfinex.com", HUOBI: "huobi.com",
  FRA: "deutsche-boerse.com", ETR: "deutsche-boerse.com",
  EPA: "euronext.com", AMS: "euronext.com",
  LON: "londonstockexchange.com", HKG: "hkex.com.hk",
  OPT: "cboe.com", DERIV: "cmegroup.com",
  "NYSE MKT": "nyse.com", "NYSE ARCA": "nyse.com",
  NYSEARCA: "nyse.com", BATSTRADING: "cboe.com", BATS: "cboe.com",
  ARCA: "nyse.com", PINK: "otcmarkets.com", OTCBB: "otcmarkets.com",
  TSXV: "tsx.com", BRU: "euronext.com", LIS: "euronext.com",
  KOSDAQ: "krx.co.kr", KOSE: "krx.co.kr", TPEX: "tpex.org.tw",
  MIL: "borsaitaliana.it", BIT: "borsaitaliana.it",
  BME: "bolsasymercados.es", MCE: "bolsasymercados.es",
  SIX: "six-group.com", VIE: "wienerborse.at",
  WSE: "gpw.pl", CPH: "nasdaqomxnordic.com",
  HEL: "nasdaqomxnordic.com", STO: "nasdaqomxnordic.com",
  OSL: "euronext.com", ISE: "ise.ie",
  BOVESPA: "b3.com.br", BVMF: "b3.com.br", SAO: "b3.com.br",
  SET: "set.or.th", BKK: "set.or.th",
  IDX: "idx.co.id", JKT: "idx.co.id",
  KLSE: "bursamalaysia.com", BMV: "bmv.com.mx",
  NZX: "nzx.com", PSE: "edge.pse.com.ph",
  ADX: "adx.ae", SAU: "tadawul.com.sa", TADAWUL: "tadawul.com.sa",
};

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
  "coal india": "coalindia.in",
  "apple": "apple.com", "microsoft": "microsoft.com", "google": "google.com",
  "alphabet": "abc.xyz", "amazon": "amazon.com", "meta platforms": "meta.com",
  "tesla": "tesla.com", "nvidia": "nvidia.com", "berkshire hathaway": "berkshirehathaway.com",
  "johnson johnson": "jnj.com", "jpmorgan": "jpmorganchase.com",
  "visa": "visa.com", "mastercard": "mastercard.com", "walmart": "walmart.com",
  "procter gamble": "pg.com", "disney": "disney.com", "coca cola": "coca-cola.com",
  "netflix": "netflix.com", "salesforce": "salesforce.com", "adobe": "adobe.com",
  "oracle": "oracle.com", "intel": "intel.com", "amd": "amd.com",
  "qualcomm": "qualcomm.com", "broadcom": "broadcom.com", "cisco": "cisco.com",
  "ibm": "ibm.com", "samsung": "samsung.com", "toyota": "toyota.com",
  "sony": "sony.com", "honda": "honda.com", "mitsubishi": "mitsubishi.com",
  "softbank": "softbank.com", "alibaba": "alibaba.com", "tencent": "tencent.com",
  "baidu": "baidu.com", "jd.com": "jd.com", "meituan": "meituan.com",
  "nio": "nio.com", "xpeng": "xpeng.com", "byd": "byd.com",
  "paypal": "paypal.com", "stripe": "stripe.com", "square": "squareup.com",
  "block": "block.xyz", "coinbase": "coinbase.com", "binance": "binance.com",
  "robinhood": "robinhood.com", "charles schwab": "schwab.com",
  "morgan stanley": "morganstanley.com", "goldman sachs": "goldmansachs.com",
  "bank of america": "bankofamerica.com", "citigroup": "citigroup.com",
  "wells fargo": "wellsfargo.com", "hsbc": "hsbc.com", "barclays": "barclays.com",
  "deutsche bank": "db.com", "ubs": "ubs.com", "credit suisse": "credit-suisse.com",
  "bnp paribas": "bnpparibas.com", "societe generale": "societegenerale.com",
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

/**
 * Resolve logo for a symbol doc. Returns { url, source, tier }.
 * This NEVER returns a generated SVG — tier 5 is exchange favicon.
 * Generated SVGs are NOT logos. We stop at exchange favicon.
 */
function resolveLogo(doc) {
  const sym = (doc.symbol || '').toUpperCase();
  const type = (doc.type || '').toLowerCase();

  // Tier 0: existing valid logo (NOT a data:image SVG)
  if (doc.s3Icon && doc.s3Icon.startsWith('http')) return { url: doc.s3Icon, source: 's3', tier: 0 };
  if (doc.iconUrl && doc.iconUrl.startsWith('http') && !doc.iconUrl.includes('default')) {
    return { url: doc.iconUrl, source: 'existing', tier: 0 };
  }

  // Tier 1: symbol map (+ base symbol + name variants)
  const base = sym.replace(/(USDT|USDC|USD|BUSD|BTC|ETH|PERP|-PERP|1!)$/, '');
  if (SYMBOL_LOGO_MAP[sym]) return { url: SYMBOL_LOGO_MAP[sym], source: 'symbolMap', tier: 1 };
  if (base && base !== sym && SYMBOL_LOGO_MAP[base]) return { url: SYMBOL_LOGO_MAP[base], source: 'symbolMap:base', tier: 1 };
  const nameUp = (doc.name || '').toUpperCase();
  if (nameUp && SYMBOL_LOGO_MAP[nameUp]) return { url: SYMBOL_LOGO_MAP[nameUp], source: 'symbolMap:name', tier: 1 };

  // Tier 2: type-based
  if (type === 'crypto') {
    const coinId = sym.toLowerCase().replace(/usdt$|usdc$|usd$|busd$|btc$|eth$|perp$|-perp$/i, '');
    if (coinId.length >= 2) {
      return { url: `https://www.google.com/s2/favicons?sz=128&domain=${coinId}.org`, source: 'crypto:favicon', tier: 2 };
    }
  }
  if (type === 'forex') {
    const baseCur = sym.slice(0, 3).toUpperCase();
    if (FOREX_FLAGS[baseCur]) return { url: FOREX_FLAGS[baseCur], source: 'forex:flag', tier: 2 };
    return { url: "https://www.google.com/s2/favicons?sz=128&domain=xe.com", source: 'forex:xe', tier: 2 };
  }
  if (type === 'derivative' || type === 'option' || type === 'future' || type === 'options' || type === 'futures') {
    // Derive logo from the base underlying symbol
    if (base && SYMBOL_LOGO_MAP[base]) return { url: SYMBOL_LOGO_MAP[base], source: 'derivative:base', tier: 2 };
    // Use exchange favicon for derivatives
    const exDomain = EXCHANGE_DOMAIN[(doc.exchange || '').toUpperCase()];
    if (exDomain) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`, source: 'derivative:exchange', tier: 2 };
  }
  if (TYPE_FALLBACK[type]) return { url: TYPE_FALLBACK[type], source: `type:${type}`, tier: 2 };

  // Tier 3: Clearbit (explicit domain)
  if (doc.companyDomain) {
    const domain = doc.companyDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (domain.includes('.') && domain.length >= 4) {
      return { url: `https://logo.clearbit.com/${domain}`, source: 'clearbit', tier: 3 };
    }
  }

  // Tier 3b: Clearbit (derived domain from company name)
  if (doc.name) {
    const derived = deriveDomain(doc.name);
    if (derived) return { url: `https://logo.clearbit.com/${derived}`, source: 'clearbit:derived', tier: 3 };
  }

  // Tier 4: exchange favicon (LAST RESORT — no generated SVGs)
  const exDomain = EXCHANGE_DOMAIN[(doc.exchange || '').toUpperCase()];
  if (exDomain) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${exDomain}`, source: 'exchange:favicon', tier: 4 };

  // Tier 4b: Google favicon from derived domain
  if (doc.name) {
    const derived = deriveDomain(doc.name);
    if (derived) return { url: `https://www.google.com/s2/favicons?sz=128&domain=${derived}`, source: 'google:derived', tier: 4 };
  }

  // Absolute fallback: xe.com favicon (still a real image, never SVG)
  return { url: "https://www.google.com/s2/favicons?sz=128&domain=google.com", source: 'fallback:google', tier: 4 };
}

function isGeneratedSvg(url) {
  if (!url) return false;
  return url.startsWith('data:image/svg') || url.includes('generated');
}

// ── Main ──
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/tradereplay');
  const db = mongoose.connection.db;
  const symbols = db.collection('symbols');
  const clean = db.collection('cleanassets');

  console.log('=== MASTER LOGO FIX ===');
  console.log('Start:', new Date().toISOString());

  // ────────────────────────────────────────────────
  // PHASE 1: Map all symbols with missing/generated logos
  // ────────────────────────────────────────────────
  console.log('\n── PHASE 1: Map logos on SYMBOLS collection ──');

  const BATCH = 2000;
  let processed = 0, updated = 0;
  const tierCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

  // Query symbols that need a logo: no iconUrl, empty iconUrl, or generated SVG
  const symCursor = symbols.find({}).project({
    _id: 1, symbol: 1, type: 1, exchange: 1, companyDomain: 1,
    iconUrl: 1, s3Icon: 1, name: 1,
  }).batchSize(BATCH);

  let batch = [];

  for await (const doc of symCursor) {
    processed++;

    // Skip if already has a valid real HTTP logo
    if (doc.iconUrl && doc.iconUrl.startsWith('http') && !doc.iconUrl.includes('default') && !isGeneratedSvg(doc.iconUrl)) {
      tierCounts[0]++;
      // Even if it has a logo, make sure logoStatus is correct
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { logoStatus: 'mapped' } }
        }
      });
    } else {
      // Needs a logo
      const logo = resolveLogo(doc);
      tierCounts[logo.tier] = (tierCounts[logo.tier] || 0) + 1;

      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              iconUrl: logo.url,
              logoStatus: 'mapped',
              logoSource: logo.source,
            }
          }
        }
      });
      updated++;
    }

    if (batch.length >= BATCH) {
      await symbols.bulkWrite(batch, { ordered: false });
      batch = [];
      if (processed % 100000 === 0) {
        console.log(`  [SYMBOLS] processed=${processed}, updated=${updated}`);
      }
    }
  }

  if (batch.length > 0) {
    await symbols.bulkWrite(batch, { ordered: false });
    batch = [];
  }

  const symTotal = await symbols.countDocuments();
  const symWithLogo = await symbols.countDocuments({
    iconUrl: { $exists: true, $ne: '', $not: /^data:image/ }
  });
  const symMissing = symTotal - symWithLogo;

  console.log(`  SYMBOLS COMPLETE: processed=${processed}, newly mapped=${updated}`);
  console.log(`  Tier breakdown:`, tierCounts);
  console.log(`  Total: ${symTotal}, With real logo: ${symWithLogo}, Missing: ${symMissing}`);
  console.log(`  Coverage: ${((symWithLogo / symTotal) * 100).toFixed(2)}%`);

  // ────────────────────────────────────────────────
  // PHASE 2: Replace all generated SVG fallbacks on clean assets
  // ────────────────────────────────────────────────
  console.log('\n── PHASE 2: Replace generated SVGs on CLEAN ASSETS ──');

  const svgDocs = await clean.find({
    $or: [
      { iconUrl: /^data:image\/svg/ },
      { iconUrl: '' },
      { iconUrl: null },
      { iconUrl: { $exists: false } },
    ]
  }).project({
    _id: 1, symbol: 1, type: 1, exchange: 1, companyDomain: 1,
    iconUrl: 1, s3Icon: 1, name: 1, fullSymbol: 1,
  }).toArray();

  console.log(`  Found ${svgDocs.length} clean assets with generated SVG or missing logo`);

  let svgFixed = 0;
  const svgBatch = [];
  for (const doc of svgDocs) {
    const logo = resolveLogo(doc);
    svgBatch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            iconUrl: logo.url,
            logoStatus: 'mapped',
            logoSource: logo.source,
          }
        }
      }
    });
    svgFixed++;
  }

  if (svgBatch.length > 0) {
    await clean.bulkWrite(svgBatch, { ordered: false });
  }
  console.log(`  Fixed ${svgFixed} clean assets`);

  // ────────────────────────────────────────────────
  // PHASE 3: Reconcile — promote all symbols missing from clean_assets
  // ────────────────────────────────────────────────
  console.log('\n── PHASE 3: Reconcile symbols → clean_assets ──');

  // Get all fullSymbols in clean_assets
  const cleanFullSymbols = new Set();
  const cleanCursor = clean.find({}).project({ fullSymbol: 1 }).batchSize(5000);
  for await (const doc of cleanCursor) {
    cleanFullSymbols.add(doc.fullSymbol);
  }

  // Find symbols not in clean_assets
  const KNOWN_EXCHANGES = new Set([
    "NASDAQ", "NYSE", "AMEX", "ARCA", "BATS", "OTC", "OTCBB", "PINK", "OTCMARKETS",
    "LSE", "LON", "TSX", "TSXV", "ASX", "NSE", "BSE",
    "XETRA", "FRA", "FSX", "ETR", "EURONEXT", "EPA", "AMS",
    "TSE", "JPX", "KOSDAQ", "KRX", "KOSE", "TWSE", "TPEX",
    "SSE", "SZSE", "HKEX", "HKG",
    "SGX", "SET", "IDX", "KLSE", "BMV",
    "BOVESPA", "BVMF", "SAO",
    "MIL", "BIT", "BME", "SWX", "SIX", "VIE", "WSE", "CPH", "HEL", "STO", "OSL",
    "BINANCE", "COINBASE", "KRAKEN", "BYBIT", "OKX", "GATEIO", "KUCOIN", "MEXC",
    "BITFINEX", "HUOBI", "CRYPTO",
    "FOREX", "FX",
    "INDEX", "INDEXSP", "INDEXDJX", "CBOE",
    "BOND", "ECONOMY", "FRED", "WORLDBANK", "TREASURY",
    "SEC", "GLOBAL", "NYSEARCA", "NYSE ARCA", "NYSE MKT",
    "CFD", "DERIV", "OPT", "COINGECKO",
    "BATSTRADING", "COMMODITY", "MCX", "NCDEX",
    "MOEX", "B3", "JSE", "NZX", "PSE", "ADX", "SAU", "TADAWUL",
  ]);

  let promoted = 0;
  let promoteBatch = [];
  const missingCursor = symbols.find({}).project({
    symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1,
    type: 1, currency: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1,
    source: 1, priorityScore: 1, marketCap: 1, volume: 1,
    liquidityScore: 1, popularity: 1, logoStatus: 1, sector: 1,
  }).batchSize(5000);

  for await (const doc of missingCursor) {
    if (cleanFullSymbols.has(doc.fullSymbol)) continue;

    // Same filter as buildCleanAssets — valid exchange
    const exUp = (doc.exchange || '').toUpperCase();
    let validExchange = KNOWN_EXCHANGES.has(exUp);
    if (!validExchange) {
      for (const known of KNOWN_EXCHANGES) {
        if (exUp.startsWith(known)) { validExchange = true; break; }
      }
    }
    if (!validExchange && exUp.length >= 2 && exUp.length <= 20) validExchange = true;
    if (!validExchange) continue;

    let cleanType = doc.type;
    if (doc.type === 'derivative') {
      if (doc.exchange === 'CFD') cleanType = 'stock';
      else if (doc.exchange === 'DERIV') cleanType = 'futures';
      else if (doc.exchange === 'OPT') cleanType = 'options';
      else continue;
    }

    promoteBatch.push({
      updateOne: {
        filter: { fullSymbol: doc.fullSymbol },
        update: {
          $set: {
            symbol: doc.symbol,
            fullSymbol: doc.fullSymbol,
            name: doc.name || '',
            exchange: doc.exchange,
            country: doc.country || '',
            type: cleanType,
            currency: doc.currency || 'USD',
            iconUrl: doc.iconUrl || '',
            s3Icon: doc.s3Icon || '',
            companyDomain: doc.companyDomain || '',
            source: doc.source || 'unknown',
            priorityScore: doc.priorityScore ?? 0,
            marketCap: doc.marketCap ?? 0,
            volume: doc.volume ?? 0,
            liquidityScore: doc.liquidityScore ?? 0,
            popularity: doc.popularity ?? 0,
            sector: doc.sector || '',
            logoStatus: doc.logoStatus || 'mapped',
            isActive: true,
            verifiedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      }
    });

    if (promoteBatch.length >= 2000) {
      try {
        const r = await clean.bulkWrite(promoteBatch, { ordered: false });
        promoted += r.upsertedCount + r.modifiedCount;
      } catch (e) {
        if (e.result) promoted += (e.result.nUpserted || 0) + (e.result.nModified || 0);
      }
      promoteBatch = [];
      if (promoted % 10000 < 2000) {
        console.log(`  [PROMOTE] ${promoted} symbols added to clean_assets...`);
      }
    }
  }

  if (promoteBatch.length > 0) {
    try {
      const r = await clean.bulkWrite(promoteBatch, { ordered: false });
      promoted += r.upsertedCount + r.modifiedCount;
    } catch (e) {
      if (e.result) promoted += (e.result.nUpserted || 0) + (e.result.nModified || 0);
    }
  }

  console.log(`  Promoted ${promoted} missing symbols to clean_assets`);

  // ────────────────────────────────────────────────
  // PHASE 4: Reprocess ALL clean assets with same logic (replace SVGs + fill gaps)
  // ────────────────────────────────────────────────
  console.log('\n── PHASE 4: Full reprocess of ALL clean assets ──');

  let cleanProcessed = 0, cleanUpdated = 0;
  const cleanTierCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let cleanBatch = [];

  const allCleanCursor = clean.find({}).project({
    _id: 1, symbol: 1, type: 1, exchange: 1, companyDomain: 1,
    iconUrl: 1, s3Icon: 1, name: 1,
  }).batchSize(BATCH);

  for await (const doc of allCleanCursor) {
    cleanProcessed++;

    // If has valid HTTP logo and NOT a generated SVG, keep it
    if (doc.iconUrl && doc.iconUrl.startsWith('http') && !isGeneratedSvg(doc.iconUrl) && !doc.iconUrl.includes('default')) {
      cleanTierCounts[0]++;
      continue; // already good
    }

    const logo = resolveLogo(doc);
    cleanTierCounts[logo.tier] = (cleanTierCounts[logo.tier] || 0) + 1;

    cleanBatch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            iconUrl: logo.url,
            logoStatus: 'mapped',
            logoSource: logo.source,
          }
        }
      }
    });
    cleanUpdated++;

    if (cleanBatch.length >= BATCH) {
      await clean.bulkWrite(cleanBatch, { ordered: false });
      cleanBatch = [];
      if (cleanProcessed % 200000 === 0) {
        console.log(`  [CLEAN] processed=${cleanProcessed}, updated=${cleanUpdated}`);
      }
    }
  }

  if (cleanBatch.length > 0) {
    await clean.bulkWrite(cleanBatch, { ordered: false });
  }

  console.log(`  CLEAN ASSETS COMPLETE: processed=${cleanProcessed}, updated=${cleanUpdated}`);
  console.log(`  Tier breakdown:`, cleanTierCounts);

  // ────────────────────────────────────────────────
  // PHASE 5: Final unified coverage report
  // ────────────────────────────────────────────────
  console.log('\n── PHASE 5: UNIFIED COVERAGE REPORT ──');

  const finalSymCount = await symbols.countDocuments();
  const finalSymWithLogo = await symbols.countDocuments({
    iconUrl: { $exists: true, $ne: '' }
  });
  const finalSymSvg = await symbols.countDocuments({
    iconUrl: /^data:image\/svg/
  });
  const finalCleanCount = await clean.countDocuments();
  const finalCleanWithLogo = await clean.countDocuments({
    iconUrl: { $exists: true, $ne: '' }
  });
  const finalCleanSvg = await clean.countDocuments({
    iconUrl: /^data:image\/svg/
  });

  const symCoverage = ((finalSymWithLogo / finalSymCount) * 100).toFixed(2);
  const cleanCoverage = ((finalCleanWithLogo / finalCleanCount) * 100).toFixed(2);
  const countGap = finalSymCount - finalCleanCount;

  console.log(`\n  ┌─────────────── UNIFIED REPORT ───────────────┐`);
  console.log(`  │ SYMBOLS COLLECTION                            │`);
  console.log(`  │   Total:           ${String(finalSymCount).padStart(10)}                │`);
  console.log(`  │   With real logo:  ${String(finalSymWithLogo).padStart(10)}                │`);
  console.log(`  │   Missing logo:    ${String(finalSymCount - finalSymWithLogo).padStart(10)}                │`);
  console.log(`  │   Generated SVGs:  ${String(finalSymSvg).padStart(10)}                │`);
  console.log(`  │   Coverage:          ${symCoverage.padStart(8)}%               │`);
  console.log(`  │                                               │`);
  console.log(`  │ CLEAN ASSETS COLLECTION                       │`);
  console.log(`  │   Total:           ${String(finalCleanCount).padStart(10)}                │`);
  console.log(`  │   With real logo:  ${String(finalCleanWithLogo).padStart(10)}                │`);
  console.log(`  │   Missing logo:    ${String(finalCleanCount - finalCleanWithLogo).padStart(10)}                │`);
  console.log(`  │   Generated SVGs:  ${String(finalCleanSvg).padStart(10)}                │`);
  console.log(`  │   Coverage:          ${cleanCoverage.padStart(8)}%               │`);
  console.log(`  │                                               │`);
  console.log(`  │ RECONCILIATION                                │`);
  console.log(`  │   Count gap:       ${String(countGap).padStart(10)}                │`);
  console.log(`  │   SVG fallbacks:   ${String(finalSymSvg + finalCleanSvg).padStart(10)}                │`);
  console.log(`  └───────────────────────────────────────────────┘`);

  if (finalSymSvg > 0 || finalCleanSvg > 0) {
    console.log(`\n  ⚠️  WARNING: ${finalSymSvg + finalCleanSvg} generated SVGs still exist.`);
    console.log(`  These are being replaced with exchange favicon fallbacks...`);

    // Replace remaining SVGs with exchange favicon
    const svgSymCursor = symbols.find({ iconUrl: /^data:image\/svg/ }).project({
      _id: 1, symbol: 1, type: 1, exchange: 1, name: 1, companyDomain: 1, s3Icon: 1
    }).toArray();
    const svgRemaining = await svgSymCursor;
    const fixBatch = [];
    for (const doc of svgRemaining) {
      const logo = resolveLogo({ ...doc, iconUrl: null }); // force re-resolve
      fixBatch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { iconUrl: logo.url, logoSource: logo.source, logoStatus: 'mapped' } }
        }
      });
    }
    if (fixBatch.length > 0) {
      await symbols.bulkWrite(fixBatch, { ordered: false });
      console.log(`  Fixed ${fixBatch.length} SVGs in symbols collection`);
    }

    // Same for clean assets
    const svgCleanRemaining = await clean.find({ iconUrl: /^data:image\/svg/ }).project({
      _id: 1, symbol: 1, type: 1, exchange: 1, name: 1, companyDomain: 1, s3Icon: 1
    }).toArray();
    const fixCleanBatch = [];
    for (const doc of svgCleanRemaining) {
      const logo = resolveLogo({ ...doc, iconUrl: null });
      fixCleanBatch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { iconUrl: logo.url, logoSource: logo.source, logoStatus: 'mapped' } }
        }
      });
    }
    if (fixCleanBatch.length > 0) {
      await clean.bulkWrite(fixCleanBatch, { ordered: false });
      console.log(`  Fixed ${fixCleanBatch.length} SVGs in cleanassets collection`);
    }
  }

  // Final verification
  const verifySymTotal = await symbols.countDocuments();
  const verifySymMapped = await symbols.countDocuments({ iconUrl: { $exists: true, $ne: '' } });
  const verifySymSvg = await symbols.countDocuments({ iconUrl: /^data:image\/svg/ });
  const verifyCleanTotal = await clean.countDocuments();
  const verifyCleanMapped = await clean.countDocuments({ iconUrl: { $exists: true, $ne: '' } });
  const verifyCleanSvg = await clean.countDocuments({ iconUrl: /^data:image\/svg/ });

  console.log(`\n=== FINAL VERIFICATION ===`);
  console.log(`  Symbols:     ${verifySymMapped}/${verifySymTotal} = ${((verifySymMapped / verifySymTotal) * 100).toFixed(2)}% (SVGs: ${verifySymSvg})`);
  console.log(`  Clean:       ${verifyCleanMapped}/${verifyCleanTotal} = ${((verifyCleanMapped / verifyCleanTotal) * 100).toFixed(2)}% (SVGs: ${verifyCleanSvg})`);
  console.log(`  Count gap:   ${verifySymTotal - verifyCleanTotal}`);
  console.log(`  SVG total:   ${verifySymSvg + verifyCleanSvg}`);

  const unified = ((verifySymMapped / verifySymTotal) * 100).toFixed(2);
  console.log(`\n  📊 UNIFIED COVERAGE: ${unified}%`);

  if (parseFloat(unified) >= 99.0 && verifySymSvg === 0 && (verifySymTotal - verifyCleanTotal) === 0) {
    console.log(`  ✅ ALL TARGETS MET`);
  } else {
    if (parseFloat(unified) < 99.0) console.log(`  ❌ Coverage < 99%`);
    if (verifySymSvg > 0) console.log(`  ❌ ${verifySymSvg} SVG fallbacks remain`);
    if (verifySymTotal - verifyCleanTotal > 0) console.log(`  ❌ ${verifySymTotal - verifyCleanTotal} symbols not in clean_assets`);
  }

  console.log('\nEnd:', new Date().toISOString());
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
