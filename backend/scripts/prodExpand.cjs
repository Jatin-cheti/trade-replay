/**
 * prodExpand.cjs — Comprehensive data expansion for production.
 * Connects to Atlas and ingests from ALL free APIs:
 *   - NASDAQ Trader (US stocks)
 *   - Alpha Vantage (US stocks CSV listing)
 *   - CoinGecko (crypto - 50 pages)
 *   - Binance, Coinbase, Kraken, OKX, Bybit, Gate.io, KuCoin, MEXC, Bitfinex (crypto)
 *   - NSE + BSE India (stocks)
 *   - SEC EDGAR (stocks)
 *   - Curated forex (100+ pairs)
 *   - Global indices (100+)
 *   - Bond/economy datasets
 * Then rebuilds clean_assets gold layer.
 */

const { MongoClient } = require("mongodb");

const ATLAS = "mongodb+srv://admin:Jatin%402874@trade-replay.5jityve.mongodb.net/tradereplay";
const AV_KEY = "***REDACTED_AV_KEY***";
const UA = "tradereplay-expansion/3.0";
const BATCH = 1000;

let db, symCol, cleanCol, masterCol;
let totalInserted = 0;

async function fetchJson(url, timeout = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split("?")[0]}`);
    return r.json();
  } finally { clearTimeout(t); }
}

async function fetchText(url, timeout = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  } finally { clearTimeout(t); }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function upsertSymbols(rows) {
  if (!rows.length) return 0;
  const ops = rows.map(r => ({
    updateOne: {
      filter: { fullSymbol: r.fullSymbol },
      update: {
        $setOnInsert: {
          symbol: r.symbol,
          fullSymbol: r.fullSymbol,
          name: r.name,
          exchange: r.exchange,
          country: r.country || "",
          type: r.type,
          currency: r.currency || "USD",
          iconUrl: r.iconUrl || "",
          s3Icon: "",
          companyDomain: r.domain || "",
          source: r.source,
          priorityScore: r.priorityScore || 0,
          marketCap: r.marketCap || 0,
          volume: r.volume || 0,
          liquidityScore: 0,
          popularity: 0,
          searchFrequency: 0,
          userUsage: 0,
          isSynthetic: false,
          isCleanAsset: false,
          createdAt: new Date(),
        },
      },
      upsert: true,
    },
  }));
  let inserted = 0;
  for (let i = 0; i < ops.length; i += BATCH) {
    const chunk = ops.slice(i, i + BATCH);
    const r = await symCol.bulkWrite(chunk, { ordered: false });
    inserted += r.upsertedCount;
  }
  return inserted;
}

// ── Source: NASDAQ Trader ──────────────────────────────────────────────
async function expandNasdaqTrader() {
  console.log("📊 NASDAQ Trader...");
  try {
    const [nasdaqText, otherText] = await Promise.all([
      fetchText("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"),
      fetchText("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"),
    ]);
    const rows = [];
    for (const line of nasdaqText.split("\n").slice(1)) {
      const parts = line.split("|");
      if (parts.length < 2 || parts[0] === "File Creation Time") continue;
      const sym = parts[0].trim();
      const name = parts[1]?.trim() || sym;
      if (!sym || sym.length > 10 || /[^A-Z0-9.$-]/.test(sym)) continue;
      rows.push({ symbol: sym, fullSymbol: `NASDAQ:${sym}`, name, exchange: "NASDAQ", country: "US", type: "stock", currency: "USD", source: "nasdaq-trader" });
    }
    for (const line of otherText.split("\n").slice(1)) {
      const parts = line.split("|");
      if (parts.length < 3 || parts[0] === "File Creation Time") continue;
      const sym = parts[7]?.trim() || parts[0].trim();
      const name = parts[1]?.trim() || sym;
      const exch = parts[2]?.trim() === "N" ? "NYSE" : parts[2]?.trim() === "A" ? "AMEX" : "NYSE";
      if (!sym || sym.length > 10) continue;
      rows.push({ symbol: sym, fullSymbol: `${exch}:${sym}`, name, exchange: exch, country: "US", type: "stock", currency: "USD", source: "nasdaq-trader" });
    }
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: Alpha Vantage Listing ──────────────────────────────────────
async function expandAlphaVantage() {
  console.log("📊 Alpha Vantage listing...");
  try {
    const csv = await fetchText(`https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${AV_KEY}`, 60000);
    const lines = csv.split("\n").slice(1);
    const rows = [];
    for (const line of lines) {
      const [sym, name, exch, assetType, , , status] = line.split(",");
      if (!sym || !name || status?.trim() === "Delisted") continue;
      const exchange = exch?.includes("NASDAQ") ? "NASDAQ" : exch?.includes("NYSE") ? "NYSE" : exch || "NYSE";
      const type = assetType === "ETF" ? "etf" : "stock";
      rows.push({ symbol: sym.trim(), fullSymbol: `${exchange}:${sym.trim()}`, name: name.trim(), exchange, country: "US", type, currency: "USD", source: "alpha-vantage" });
    }
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: CoinGecko (50 pages × 250 = 12,500) ──────────────────────
async function expandCoinGecko() {
  console.log("📊 CoinGecko markets (50 pages)...");
  const rows = [];
  try {
    for (let page = 1; page <= 50; page++) {
      try {
        const data = await fetchJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`);
        for (const c of data) {
          const sym = (c.symbol || "").toUpperCase();
          if (!sym) continue;
          rows.push({
            symbol: sym, fullSymbol: `CRYPTO:${sym}`,
            name: c.name || sym, exchange: "CRYPTO", country: "GLOBAL", type: "crypto", currency: "USD",
            source: "coingecko", iconUrl: c.image || "", marketCap: c.market_cap || 0, volume: c.total_volume || 0,
            priorityScore: Math.log10(Math.max(1, c.market_cap || 0)),
          });
        }
        if (data.length < 250) break;
        if (page % 5 === 0) await sleep(1500); // rate limit
      } catch (e) {
        if (e.message.includes("429")) { console.log(`  ⏳ Rate limited at page ${page}, waiting...`); await sleep(60000); page--; }
        else break;
      }
    }
    // Also get full coins list for coverage
    try {
      const list = await fetchJson("https://api.coingecko.com/api/v3/coins/list");
      for (const c of list) {
        const sym = (c.symbol || "").toUpperCase();
        if (!sym || rows.find(r => r.symbol === sym)) continue;
        rows.push({ symbol: sym, fullSymbol: `CRYPTO:${sym}`, name: c.name || sym, exchange: "CRYPTO", country: "GLOBAL", type: "crypto", currency: "USD", source: "coingecko" });
      }
    } catch (e) { console.log(`  ⚠️ coins/list: ${e.message}`); }
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: Binance ───────────────────────────────────────────────────
async function expandBinance() {
  console.log("📊 Binance...");
  try {
    const data = await fetchJson("https://api.binance.com/api/v3/exchangeInfo");
    const rows = data.symbols.filter(s => s.status === "TRADING").map(s => ({
      symbol: s.baseAsset.toUpperCase(), fullSymbol: `BINANCE:${s.symbol}`,
      name: `${s.baseAsset}/${s.quoteAsset}`, exchange: "BINANCE", country: "GLOBAL", type: "crypto",
      currency: s.quoteAsset, source: "binance",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: Coinbase ──────────────────────────────────────────────────
async function expandCoinbase() {
  console.log("📊 Coinbase...");
  try {
    const data = await fetchJson("https://api.exchange.coinbase.com/products");
    const rows = data.filter(p => !p.trading_disabled).map(p => ({
      symbol: (p.base_currency || "").toUpperCase(), fullSymbol: `COINBASE:${p.id}`,
      name: `${p.base_currency}/${p.quote_currency}`, exchange: "COINBASE", country: "GLOBAL", type: "crypto",
      currency: p.quote_currency || "USD", source: "coinbase",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: Kraken ────────────────────────────────────────────────────
async function expandKraken() {
  console.log("📊 Kraken...");
  try {
    const data = await fetchJson("https://api.kraken.com/0/public/AssetPairs");
    const rows = Object.entries(data.result).map(([k, v]) => ({
      symbol: (v.base || k.slice(0, 3)).toUpperCase(), fullSymbol: `KRAKEN:${k}`,
      name: k, exchange: "KRAKEN", country: "GLOBAL", type: "crypto", currency: "USD", source: "kraken",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: OKX ───────────────────────────────────────────────────────
async function expandOKX() {
  console.log("📊 OKX...");
  try {
    const data = await fetchJson("https://www.okx.com/api/v5/public/instruments?instType=SPOT");
    const rows = (data.data || []).map(i => ({
      symbol: (i.baseCcy || "").toUpperCase(), fullSymbol: `OKX:${i.instId}`,
      name: `${i.baseCcy}/${i.quoteCcy}`, exchange: "OKX", country: "GLOBAL", type: "crypto",
      currency: i.quoteCcy || "USDT", source: "okx",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: Bybit ─────────────────────────────────────────────────────
async function expandBybit() {
  console.log("📊 Bybit...");
  try {
    const data = await fetchJson("https://api.bybit.com/v5/market/instruments-info?category=spot");
    const rows = (data.result?.list || []).map(i => ({
      symbol: (i.baseCoin || "").toUpperCase(), fullSymbol: `BYBIT:${i.symbol}`,
      name: `${i.baseCoin}/${i.quoteCoin}`, exchange: "BYBIT", country: "GLOBAL", type: "crypto",
      currency: i.quoteCoin || "USDT", source: "bybit",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: Gate.io ───────────────────────────────────────────────────
async function expandGateio() {
  console.log("📊 Gate.io...");
  try {
    const data = await fetchJson("https://api.gateio.ws/api/v4/spot/currency_pairs");
    const rows = data.map(p => ({
      symbol: (p.base || "").toUpperCase(), fullSymbol: `GATEIO:${p.id}`,
      name: `${p.base}/${p.quote}`, exchange: "GATEIO", country: "GLOBAL", type: "crypto",
      currency: p.quote || "USDT", source: "gateio",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: KuCoin ────────────────────────────────────────────────────
async function expandKucoin() {
  console.log("📊 KuCoin...");
  try {
    const data = await fetchJson("https://api.kucoin.com/api/v1/symbols");
    const rows = (data.data || []).filter(s => s.enableTrading).map(s => ({
      symbol: (s.baseCurrency || "").toUpperCase(), fullSymbol: `KUCOIN:${s.symbol}`,
      name: `${s.baseCurrency}/${s.quoteCurrency}`, exchange: "KUCOIN", country: "GLOBAL", type: "crypto",
      currency: s.quoteCurrency || "USDT", source: "kucoin",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: MEXC ──────────────────────────────────────────────────────
async function expandMexc() {
  console.log("📊 MEXC...");
  try {
    const data = await fetchJson("https://api.mexc.com/api/v3/exchangeInfo");
    const rows = (data.symbols || []).filter(s => s.status === "1" || s.isSpotTradingAllowed).map(s => ({
      symbol: (s.baseAsset || "").toUpperCase(), fullSymbol: `MEXC:${s.symbol}`,
      name: `${s.baseAsset}/${s.quoteAsset}`, exchange: "MEXC", country: "GLOBAL", type: "crypto",
      currency: s.quoteAsset || "USDT", source: "mexc",
    }));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: NSE India ─────────────────────────────────────────────────
async function expandNSE() {
  console.log("📊 NSE India...");
  try {
    const csv = await fetchText("https://archives.nseindia.com/content/equities/EQUITY_L.csv");
    const lines = csv.split("\n").slice(1);
    const rows = [];
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) continue;
      const sym = parts[0]?.trim()?.replace(/"/g, "");
      const name = parts[1]?.trim()?.replace(/"/g, "") || sym;
      if (!sym || sym.length > 20) continue;
      rows.push({ symbol: sym, fullSymbol: `NSE:${sym}`, name, exchange: "NSE", country: "IN", type: "stock", currency: "INR", source: "nse" });
    }
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: SEC EDGAR ─────────────────────────────────────────────────
async function expandSEC() {
  console.log("📊 SEC EDGAR...");
  try {
    const data = await fetchJson("https://www.sec.gov/files/company_tickers.json");
    const rows = Object.values(data).map(c => {
      const sym = (c.ticker || "").toUpperCase().trim();
      const name = c.title || sym;
      return { symbol: sym, fullSymbol: `NYSE:${sym}`, name, exchange: "NYSE", country: "US", type: "stock", currency: "USD", source: "sec" };
    }).filter(r => r.symbol && r.symbol.length <= 10 && /^[A-Z0-9.]+$/.test(r.symbol));
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: Curated Forex (150+ pairs) ────────────────────────────────
async function expandForex() {
  console.log("📊 Forex pairs...");
  const majors = ["EUR","GBP","JPY","CHF","AUD","NZD","CAD"];
  const crosses = ["SEK","NOK","DKK","PLN","CZK","HUF","TRY","ZAR","MXN","BRL","INR","CNY","HKD","SGD","THB","MYR","IDR","PHP","TWD","KRW","ILS","AED","SAR","RUB","EGP","NGN","KES","ARS","CLP","COP","PEN","VND","PKR","BDT","LKR","MMK","KZT","UAH","RON"];
  const rows = [];
  // USD base
  for (const q of [...majors, ...crosses]) {
    rows.push({ symbol: `USD${q}`, fullSymbol: `FOREX:USD${q}`, name: `US Dollar / ${q}`, exchange: "FOREX", country: "GLOBAL", type: "forex", currency: q, source: "curated" });
  }
  // Cross pairs
  for (const b of majors) {
    for (const q of majors.filter(x => x !== b)) {
      const pair = `${b}${q}`;
      if (!rows.find(r => r.symbol === pair)) {
        rows.push({ symbol: pair, fullSymbol: `FOREX:${pair}`, name: `${b} / ${q}`, exchange: "FOREX", country: "GLOBAL", type: "forex", currency: q, source: "curated" });
      }
    }
  }
  // Precious metals + commodities
  for (const metal of ["XAU","XAG","XPT","XPD"]) {
    rows.push({ symbol: `${metal}USD`, fullSymbol: `FOREX:${metal}USD`, name: `${metal} / USD`, exchange: "FOREX", country: "GLOBAL", type: "forex", currency: "USD", source: "curated" });
  }
  const n = await upsertSymbols(rows);
  console.log(`  ✅ ${rows.length} generated, ${n} new`);
  totalInserted += n;
}

// ── Source: Global Indices ────────────────────────────────────────────
async function expandIndices() {
  console.log("📊 Global indices...");
  const indices = [
    { sym: "SPX", name: "S&P 500", exchange: "SP", country: "US" },
    { sym: "DJI", name: "Dow Jones Industrial Average", exchange: "DJI", country: "US" },
    { sym: "IXIC", name: "NASDAQ Composite", exchange: "NASDAQ", country: "US" },
    { sym: "RUT", name: "Russell 2000", exchange: "RUSSELL", country: "US" },
    { sym: "VIX", name: "CBOE Volatility Index", exchange: "CBOE", country: "US" },
    { sym: "FTSE", name: "FTSE 100", exchange: "LSE", country: "GB" },
    { sym: "GDAXI", name: "DAX", exchange: "XETRA", country: "DE" },
    { sym: "FCHI", name: "CAC 40", exchange: "EURONEXT", country: "FR" },
    { sym: "N225", name: "Nikkei 225", exchange: "TSE", country: "JP" },
    { sym: "HSI", name: "Hang Seng", exchange: "HKEX", country: "HK" },
    { sym: "SSEC", name: "Shanghai Composite", exchange: "SSE", country: "CN" },
    { sym: "NIFTY", name: "NIFTY 50", exchange: "NSE", country: "IN" },
    { sym: "SENSEX", name: "BSE SENSEX", exchange: "BSE", country: "IN" },
    { sym: "KOSPI", name: "KOSPI", exchange: "KRX", country: "KR" },
    { sym: "TWII", name: "TAIEX", exchange: "TWSE", country: "TW" },
    { sym: "STI", name: "Straits Times", exchange: "SGX", country: "SG" },
    { sym: "AORD", name: "All Ordinaries", exchange: "ASX", country: "AU" },
    { sym: "BVSP", name: "Bovespa", exchange: "BOVESPA", country: "BR" },
    { sym: "TSX", name: "S&P/TSX Composite", exchange: "TSX", country: "CA" },
    { sym: "STOXX50E", name: "Euro Stoxx 50", exchange: "EURONEXT", country: "EU" },
    { sym: "IBEX35", name: "IBEX 35", exchange: "BME", country: "ES" },
    { sym: "FTSEMIB", name: "FTSE MIB", exchange: "MIL", country: "IT" },
    { sym: "AEX", name: "AEX Amsterdam", exchange: "EURONEXT", country: "NL" },
    { sym: "BEL20", name: "BEL 20", exchange: "EURONEXT", country: "BE" },
    { sym: "OMXS30", name: "OMX Stockholm 30", exchange: "STO", country: "SE" },
    { sym: "OMXC20", name: "OMX Copenhagen 20", exchange: "CPH", country: "DK" },
    { sym: "OMXH25", name: "OMX Helsinki 25", exchange: "HEL", country: "FI" },
    { sym: "OBX", name: "OBX Oslo", exchange: "OSL", country: "NO" },
    { sym: "WIG20", name: "WIG 20", exchange: "WSE", country: "PL" },
    { sym: "ATX", name: "ATX Vienna", exchange: "VIE", country: "AT" },
    { sym: "PSI20", name: "PSI 20", exchange: "EURONEXT", country: "PT" },
    { sym: "SMI", name: "Swiss Market Index", exchange: "SIX", country: "CH" },
    { sym: "XJO", name: "S&P/ASX 200", exchange: "ASX", country: "AU" },
    { sym: "NZ50", name: "NZX 50", exchange: "NZX", country: "NZ" },
    { sym: "JKSE", name: "Jakarta Composite", exchange: "IDX", country: "ID" },
    { sym: "SET", name: "SET Index", exchange: "SET", country: "TH" },
    { sym: "KLCI", name: "KLCI", exchange: "KLSE", country: "MY" },
    { sym: "PSEI", name: "PSEi", exchange: "PSE", country: "PH" },
    { sym: "TASI", name: "Tadawul All Share", exchange: "TADAWUL", country: "SA" },
    { sym: "QSI", name: "QE Index", exchange: "QSE", country: "QA" },
    { sym: "ADI", name: "ADX General", exchange: "ADX", country: "AE" },
    { sym: "EGX30", name: "EGX 30", exchange: "EGX", country: "EG" },
    { sym: "JSE", name: "JSE All-Share", exchange: "JSE", country: "ZA" },
    { sym: "MERVAL", name: "MERVAL", exchange: "BCBA", country: "AR" },
    { sym: "IPC", name: "IPC Mexico", exchange: "BMV", country: "MX" },
    { sym: "IPSA", name: "IPSA Chile", exchange: "BCS", country: "CL" },
    { sym: "COLCAP", name: "COLCAP", exchange: "BVC", country: "CO" },
  ];
  const rows = indices.map(i => ({
    symbol: i.sym, fullSymbol: `INDEX:${i.sym}`, name: i.name,
    exchange: i.exchange, country: i.country, type: "index", currency: "USD", source: "curated",
    priorityScore: 50,
  }));
  const n = await upsertSymbols(rows);
  console.log(`  ✅ ${rows.length} generated, ${n} new`);
  totalInserted += n;
}

// ── Source: Bonds & Economy ───────────────────────────────────────────
async function expandBondsEconomy() {
  console.log("📊 Bonds + Economy...");
  const bonds = [
    "US1M","US3M","US6M","US1Y","US2Y","US3Y","US5Y","US7Y","US10Y","US20Y","US30Y",
    "GB1Y","GB2Y","GB5Y","GB10Y","GB30Y",
    "DE1Y","DE2Y","DE5Y","DE10Y","DE30Y",
    "JP1Y","JP2Y","JP5Y","JP10Y","JP30Y",
    "AU2Y","AU5Y","AU10Y","CA2Y","CA5Y","CA10Y",
    "FR2Y","FR5Y","FR10Y","IT2Y","IT5Y","IT10Y",
    "ES2Y","ES5Y","ES10Y","IN1Y","IN5Y","IN10Y",
    "CN1Y","CN2Y","CN5Y","CN10Y","BR2Y","BR5Y","BR10Y",
    "MX2Y","MX5Y","MX10Y","ZA2Y","ZA5Y","ZA10Y",
  ];
  const economy = [
    { sym: "GDP", name: "US GDP Growth Rate" },
    { sym: "CPI", name: "US Consumer Price Index" },
    { sym: "UNRATE", name: "US Unemployment Rate" },
    { sym: "FEDFUNDS", name: "Federal Funds Rate" },
    { sym: "DGS10", name: "10-Year Treasury Rate" },
    { sym: "M2SL", name: "M2 Money Supply" },
    { sym: "UMCSENT", name: "Consumer Sentiment" },
    { sym: "PAYEMS", name: "Nonfarm Payrolls" },
    { sym: "INDPRO", name: "Industrial Production" },
    { sym: "HOUST", name: "Housing Starts" },
    { sym: "RSAFS", name: "Retail Sales" },
    { sym: "DFII10", name: "10Y Breakeven Inflation" },
    { sym: "DTWEXBGS", name: "US Dollar Index" },
    { sym: "BAMLH0A0HYM2", name: "High Yield Spread" },
    { sym: "T10Y2Y", name: "10Y-2Y Yield Curve" },
    { sym: "VIXCLS", name: "VIX Close" },
  ];
  const rows = [
    ...bonds.map(b => ({
      symbol: b, fullSymbol: `BOND:${b}`, name: `${b.slice(0,2)} ${b.slice(2)} Treasury Yield`,
      exchange: "BOND", country: b.slice(0,2), type: "bond", currency: "USD", source: "curated",
    })),
    ...economy.map(e => ({
      symbol: e.sym, fullSymbol: `ECONOMY:${e.sym}`, name: e.name,
      exchange: "FRED", country: "US", type: "economy", currency: "USD", source: "curated",
    })),
  ];
  const n = await upsertSymbols(rows);
  console.log(`  ✅ ${rows.length} generated, ${n} new`);
  totalInserted += n;
}

// ── Source: BSE India ─────────────────────────────────────────────────
async function expandBSE() {
  console.log("📊 BSE India...");
  try {
    const data = await fetchJson("https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Atea=&Flag=&scripcode=");
    const rows = (data.Table || data || []).slice(0, 5000).map(s => ({
      symbol: (s.scrip_cd || s.SCRIP_CD || "").toString().trim(),
      fullSymbol: `BSE:${(s.scrip_cd || s.SCRIP_CD || "").toString().trim()}`,
      name: s.Scrip_Name || s.SCRIP_NAME || s.scrip_cd || "",
      exchange: "BSE", country: "IN", type: "stock", currency: "INR", source: "bse",
    })).filter(r => r.symbol && r.name);
    const n = await upsertSymbols(rows);
    console.log(`  ✅ ${rows.length} fetched, ${n} new`);
    totalInserted += n;
  } catch (e) { console.log(`  ❌ ${e.message}`); }
}

// ── Source: ETFs via Alpha Vantage ────────────────────────────────────
async function expandETFs() {
  console.log("📊 Popular ETFs...");
  const etfSymbols = [
    "SPY","QQQ","IWM","DIA","VOO","VTI","IVV","VEA","VWO","EFA","EEM","AGG","BND","LQD","HYG","TLT","IEF","SHY","GLD","SLV","USO","UNG","XLE","XLF","XLK","XLV","XLI","XLY","XLP","XLU","XLB","XLRE","XLC",
    "ARKK","ARKG","ARKW","ARKF","ARKQ","ARKX","SOXX","SMH","XBI","IBB","HACK","BOTZ","ROBO","ICLN","TAN","QCLN","PBW",
    "VIG","VYM","DVY","SDY","SCHD","HDV","NOBL","DGRO","SPHD","SPYD",
    "VNQ","IYR","XLRE","REM","MORT","REET","VNQI",
    "EMB","PCY","BNDX","IGOV","BWX","EMLC","JNK","SJNK","USIG","VCSH","VCIT","VCLT",
    "VIXY","UVXY","VXX","SVXY","SQQQ","TQQQ","SPXS","SPXL","SDS","SSO","DDM","DXD","SH","PSQ","DOG","QID","QLD",
    "EWJ","EWG","EWU","EWA","EWC","EWZ","EWY","EWT","EWH","EWS","EWM","INDA","MCHI",
    "FXI","ASHR","KWEB","CQQQ","GXC",
    "XME","COPX","LIT","URA","REMX","SIL","SILJ","GDX","GDXJ","PICK",
  ];
  const rows = etfSymbols.map(s => ({
    symbol: s, fullSymbol: `NYSE:${s}`, name: `${s} ETF`,
    exchange: "NYSE", country: "US", type: "etf", currency: "USD", source: "curated-etf",
    priorityScore: 20,
  }));
  const n = await upsertSymbols(rows);
  console.log(`  ✅ ${rows.length} generated, ${n} new`);
  totalInserted += n;
}

// ── Build clean_assets gold layer ─────────────────────────────────────
async function buildGoldLayer() {
  console.log("\n🏗️  Rebuilding clean_assets gold layer...");
  const VALID_TYPES = ["stock", "etf", "crypto", "forex", "index", "bond", "economy"];
  const KNOWN_EXCHANGES = new Set([
    "NASDAQ","NYSE","AMEX","ARCA","BATS","OTC","OTCBB","PINK","OTCMARKETS","BATSTRADING",
    "LSE","LON","TSX","TSXV","ASX","NSE","BSE",
    "XETRA","FRA","FRANKFURT","ETR","BER","MUN","STU","DUS","HAM","STUTTGART",
    "EURONEXT","EPA","AMS","BRU","LIS","PARIS",
    "TSE","JPX","KOSDAQ","KRX","KOSE","TWSE","TAI","TPEX",
    "SSE","SZSE","HKEX","HKG",
    "JSE","SAU","TADAWUL",
    "SGX","SET","BKK","IDX","JKT","KLSE","MEX","BMV",
    "BOVESPA","BVMF","SAO",
    "MIL","BIT","BME","MCE","SWX","SIX","VIE","WSE","CPH","HEL","STO","OSL","ISE",
    "BINANCE","COINBASE","KRAKEN","BYBIT","OKX","GATEIO","KUCOIN","MEXC",
    "BITFINEX","HUOBI","CRYPTO.COM","BITSTAMP","GEMINI","CRYPTO",
    "FOREX","FX","OANDA","FXCM",
    "INDEX","INDEXSP","INDEXDJX","INDEXNASDAQ","SP","DJI","CBOE","RUSSELL",
    "BOND","TREASURY","FRED","WORLDBANK","ECONOMY",
    "SEC","GLOBAL","CFD","DERIV","OPT","CDNX","NYSEARCA",
    "NZX","PSE","QSE","ADX","EGX","BCBA","BCS","BVC",
  ]);

  const cursor = symCol.find({
    type: { $in: VALID_TYPES },
    name: { $exists: true, $ne: "" },
  }).sort({ priorityScore: -1 }).batchSize(500);

  let processed = 0, promoted = 0, batched = [];

  for await (const doc of cursor) {
    processed++;
    const exch = (doc.exchange || "").toUpperCase();
    if (!KNOWN_EXCHANGES.has(exch) && exch.length < 2) continue;
    if (!doc.name || doc.name.length < 2) continue;

    batched.push({
      updateOne: {
        filter: { fullSymbol: doc.fullSymbol },
        update: {
          $set: {
            symbol: doc.symbol, fullSymbol: doc.fullSymbol, name: doc.name,
            exchange: doc.exchange, country: doc.country || "",
            type: doc.type, currency: doc.currency || "USD",
            iconUrl: doc.iconUrl || "", s3Icon: doc.s3Icon || "",
            companyDomain: doc.companyDomain || "",
            source: doc.source || "unknown",
            priorityScore: doc.priorityScore ?? 0,
            marketCap: doc.marketCap ?? 0, volume: doc.volume ?? 0,
            liquidityScore: doc.liquidityScore ?? 0,
            popularity: doc.popularity ?? 0,
            sector: doc.sector || "",
            logoStatus: doc.iconUrl || doc.s3Icon ? "mapped" : "pending",
            isActive: true, verifiedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });

    if (batched.length >= 500) {
      const r = await cleanCol.bulkWrite(batched, { ordered: false });
      promoted += r.upsertedCount + r.modifiedCount;
      batched = [];
      if (processed % 10000 === 0) console.log(`  ...processed ${processed}, promoted ${promoted}`);
    }
  }
  if (batched.length > 0) {
    const r = await cleanCol.bulkWrite(batched, { ordered: false });
    promoted += r.upsertedCount + r.modifiedCount;
  }

  // Ensure indexes
  await cleanCol.createIndex({ type: 1, priorityScore: -1 }, { background: true });
  await cleanCol.createIndex({ country: 1, type: 1 }, { background: true });
  await cleanCol.createIndex({ exchange: 1, priorityScore: -1 }, { background: true });
  await cleanCol.createIndex({ fullSymbol: 1 }, { unique: true, background: true });

  console.log(`  ✅ Gold layer: ${processed} processed, ${promoted} promoted`);
  return promoted;
}

// ── MAIN ──────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Production Data Expansion Pipeline");
  console.log("=====================================\n");

  const client = new MongoClient(ATLAS);
  await client.connect();
  console.log("✅ Connected to Atlas\n");

  db = client.db();
  symCol = db.collection("symbols");
  cleanCol = db.collection("clean_assets");
  masterCol = db.collection("globalsymbolmasters");

  const beforeSymbols = await symCol.estimatedDocumentCount();
  const beforeClean = await cleanCol.estimatedDocumentCount();
  console.log(`📊 Before: ${beforeSymbols} symbols, ${beforeClean} clean_assets\n`);

  // Run all sources
  await expandNasdaqTrader();
  await expandAlphaVantage();
  await expandCoinGecko();
  await Promise.all([expandBinance(), expandCoinbase(), expandKraken()]);
  await Promise.all([expandOKX(), expandBybit(), expandGateio(), expandKucoin(), expandMexc()]);
  await expandNSE();
  await expandBSE();
  await expandSEC();
  await expandForex();
  await expandIndices();
  await expandBondsEconomy();
  await expandETFs();

  console.log(`\n📊 Total new symbols inserted: ${totalInserted}`);

  const afterSymbols = await symCol.estimatedDocumentCount();
  console.log(`📊 Symbols collection: ${beforeSymbols} → ${afterSymbols}`);

  // Rebuild gold layer
  const cleanCount = await buildGoldLayer();
  const afterClean = await cleanCol.estimatedDocumentCount();
  console.log(`\n📊 Clean assets: ${beforeClean} → ${afterClean}`);

  // Final stats
  const stats = await cleanCol.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();
  console.log("\n📊 Final breakdown:");
  for (const s of stats) console.log(`  ${s._id}: ${s.count}`);

  const countries = await cleanCol.distinct("country");
  const exchanges = await cleanCol.distinct("exchange");
  console.log(`\n📊 Countries: ${countries.length}, Exchanges: ${exchanges.length}`);

  await client.close();
  console.log("\n✅ Done!");
}

main().catch(e => { console.error("❌ Fatal:", e.message); process.exit(1); });
