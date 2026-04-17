/**
 * Sector Classifier Service
 *
 * Guarantees every clean asset gets a sector classification.
 * Multi-source hierarchy:
 *   1. Existing sector from data source (SEC, etc.)
 *   2. Type-based classification (crypto, forex, index, bond, etc.)
 *   3. Name/exchange/country heuristic fallback
 */

// ── Crypto sub-classification map ──────────────────────────────
const CRYPTO_EXACT: Record<string, string> = {
  BTC: "Crypto - Currency", BCH: "Crypto - Currency", LTC: "Crypto - Currency",
  DOGE: "Crypto - Currency", XMR: "Crypto - Privacy", DASH: "Crypto - Currency",
  ZEC: "Crypto - Privacy", XLM: "Crypto - Currency", XRP: "Crypto - Currency",
  SHIB: "Crypto - Currency", PEPE: "Crypto - Meme", FLOKI: "Crypto - Meme",
  BONK: "Crypto - Meme", WIF: "Crypto - Meme", BRETT: "Crypto - Meme",
  ETH: "Crypto - Smart Contracts", SOL: "Crypto - Smart Contracts", ADA: "Crypto - Smart Contracts",
  DOT: "Crypto - Smart Contracts", AVAX: "Crypto - Smart Contracts", NEAR: "Crypto - Smart Contracts",
  ATOM: "Crypto - Smart Contracts", ALGO: "Crypto - Smart Contracts", FTM: "Crypto - Smart Contracts",
  HBAR: "Crypto - Smart Contracts", ICP: "Crypto - Smart Contracts", EOS: "Crypto - Smart Contracts",
  TRX: "Crypto - Smart Contracts", TON: "Crypto - Smart Contracts", APT: "Crypto - Smart Contracts",
  SUI: "Crypto - Smart Contracts", SEI: "Crypto - Smart Contracts", INJ: "Crypto - Smart Contracts",
  KAS: "Crypto - Smart Contracts", EGLD: "Crypto - Smart Contracts",
  MATIC: "Crypto - Layer 2", POL: "Crypto - Layer 2", ARB: "Crypto - Layer 2",
  OP: "Crypto - Layer 2", IMX: "Crypto - Layer 2", MANTA: "Crypto - Layer 2",
  STRK: "Crypto - Layer 2", MNT: "Crypto - Layer 2", METIS: "Crypto - Layer 2",
  UNI: "Crypto - DeFi", AAVE: "Crypto - DeFi", MKR: "Crypto - DeFi",
  COMP: "Crypto - DeFi", CRV: "Crypto - DeFi", SNX: "Crypto - DeFi",
  SUSHI: "Crypto - DeFi", CAKE: "Crypto - DeFi", DYDX: "Crypto - DeFi",
  LDO: "Crypto - DeFi", PENDLE: "Crypto - DeFi", JUP: "Crypto - DeFi",
  RAY: "Crypto - DeFi", GMX: "Crypto - DeFi", "1INCH": "Crypto - DeFi",
  YFI: "Crypto - DeFi", BAL: "Crypto - DeFi",
  USDT: "Crypto - Stablecoin", USDC: "Crypto - Stablecoin", DAI: "Crypto - Stablecoin",
  BUSD: "Crypto - Stablecoin", TUSD: "Crypto - Stablecoin", FRAX: "Crypto - Stablecoin",
  USDD: "Crypto - Stablecoin", PYUSD: "Crypto - Stablecoin", FDUSD: "Crypto - Stablecoin",
  USDE: "Crypto - Stablecoin",
  BNB: "Crypto - Exchange", OKB: "Crypto - Exchange", CRO: "Crypto - Exchange",
  FTT: "Crypto - Exchange", LEO: "Crypto - Exchange", GT: "Crypto - Exchange",
  KCS: "Crypto - Exchange", HT: "Crypto - Exchange", MX: "Crypto - Exchange",
  AXS: "Crypto - Gaming", SAND: "Crypto - Gaming", MANA: "Crypto - Gaming",
  GALA: "Crypto - Gaming", ENJ: "Crypto - Gaming", ILV: "Crypto - Gaming",
  MAGIC: "Crypto - Gaming", PRIME: "Crypto - Gaming", PIXEL: "Crypto - Gaming",
  RON: "Crypto - Gaming", BEAM: "Crypto - Gaming",
  LINK: "Crypto - Infrastructure", GRT: "Crypto - Infrastructure", FIL: "Crypto - Infrastructure",
  AR: "Crypto - Infrastructure", THETA: "Crypto - Infrastructure", RNDR: "Crypto - Infrastructure",
  OCEAN: "Crypto - Infrastructure", BAND: "Crypto - Infrastructure", API3: "Crypto - Infrastructure",
  PYTH: "Crypto - Infrastructure", TIA: "Crypto - Infrastructure",
};

function classifyCrypto(symbol: string, name: string): string {
  const base = symbol.replace(/(USDT|BUSD|USDC|USD|BTC|ETH|BNB|EUR|GBP|TRY|AUD|BRL|PERP|SWAP|1000|DOWN|UP|BULL|BEAR)$/i, "");
  if (CRYPTO_EXACT[base]) return CRYPTO_EXACT[base];

  const nm = name.toLowerCase();
  if (/stablecoin|usd coin|tether/.test(nm)) return "Crypto - Stablecoin";
  if (/swap|dex|defi|finance|lend|yield/.test(nm)) return "Crypto - DeFi";
  if (/game|play|meta|nft|world/.test(nm)) return "Crypto - Gaming";
  if (/chain|network|protocol|layer|wrapped|bridged/.test(nm)) return "Crypto - Infrastructure";
  if (/inu|doge|pepe|meme|moon|baby/.test(nm)) return "Crypto - Meme";
  if (/exchange|binance/.test(nm)) return "Crypto - Exchange";
  if (/\bai\b|artificial|machine learning/.test(nm)) return "Crypto - AI";
  return "Crypto";
}

function classifyFutures(symbol: string, name: string): string {
  const nm = name.toLowerCase();
  const sym = symbol.toUpperCase();
  if (/\b(crude|oil|brent|wti|gasoline|natural gas|heating)\b/.test(nm) || /^(CL|BZ|NG|RB|HO|QM)/.test(sym)) return "Futures - Energy";
  if (/\b(gold|silver|platinum|palladium|copper)\b/.test(nm) || /^(GC|SI|PL|PA|HG)/.test(sym)) return "Futures - Metals";
  if (/\b(corn|wheat|soybean|coffee|cocoa|sugar|cotton|rice|cattle|hog|pork|lean)\b/.test(nm)) return "Futures - Agriculture";
  if (/\b(s&p|nasdaq|dow|russell|nifty|nikkei|dax|ftse|index)\b/.test(nm) || /^(ES|NQ|YM|RTY)/.test(sym)) return "Futures - Index";
  if (/\b(treasury|bond|note|eurodollar|rate)\b/.test(nm) || /^(ZN|ZB|ZT|ZF)/.test(sym)) return "Futures - Bonds";
  if (/\b(euro|yen|pound|franc|dollar|forex)\b/.test(nm) || /^(6E|6J|6B|6S)/.test(sym)) return "Futures - Currency";
  if (/\b(bitcoin|ethereum|crypto)\b/.test(nm) || /^(BTC|ETH)/.test(sym)) return "Futures - Crypto";
  return "Futures";
}

function classifyETF(name: string): string {
  const nm = name.toLowerCase();
  if (/bond|treasury|fixed income|yield|rate|debt|credit|municipal/.test(nm)) return "ETF - Fixed Income";
  if (/s&p 500|total market|index|russell|dow jones|nasdaq|nifty|msci|large cap|mid cap|small cap/.test(nm)) return "ETF - Equity Index";
  if (/tech|software|semiconductor|cyber|cloud|innovation|internet|digital/.test(nm)) return "ETF - Technology";
  if (/health|biotech|pharma|medical|genomic|cannabis/.test(nm)) return "ETF - Healthcare";
  if (/financ|bank|insurance/.test(nm)) return "ETF - Financial";
  if (/energy|oil|gas|clean energy|solar|wind|uranium/.test(nm)) return "ETF - Energy";
  if (/real estate|reit|housing|mortgage/.test(nm)) return "ETF - Real Estate";
  if (/gold|silver|precious|metal|mining|commodity|agriculture/.test(nm)) return "ETF - Commodities";
  if (/emerging|china|india|japan|europe|international|global|world|asia|latin/.test(nm)) return "ETF - International";
  if (/dividend|value|growth|momentum|quality|factor|smart beta/.test(nm)) return "ETF - Factor/Strategy";
  if (/leverag|inverse|ultra|bull|bear|2x|3x|short/.test(nm)) return "ETF - Leveraged/Inverse";
  if (/bitcoin|ethereum|crypto|blockchain/.test(nm)) return "ETF - Crypto";
  if (/consumer|retail|staple|discretionary/.test(nm)) return "ETF - Consumer";
  if (/defense|aerospace|industrial|manufactur|material/.test(nm)) return "ETF - Industrial";
  if (/utilit|water|waste/.test(nm)) return "ETF - Utilities";
  if (/communicat|media|entertainment/.test(nm)) return "ETF - Communication";
  if (/esg|sustainable|green|climate/.test(nm)) return "ETF - ESG";
  if (/currency|fx|forex|dollar/.test(nm)) return "ETF - Currency";
  return "ETF";
}

function classifyStockFallback(name: string, exchange: string, country: string): string {
  const nm = name.toLowerCase();
  const exch = exchange.toUpperCase();

  if (exch === "OPT" || exch === "OPRA" || /\b(call|put|option|strike)\b/.test(nm)) return "Options";
  if (exch === "CFD" || exch === "DERIV") return "Derivatives";
  if (exch === "CRYPTO" || /\b(token|coin|crypto|blockchain|defi|nft)\b/.test(nm)) return "Crypto";

  // Name-based sector inference
  if (/\b(bank|financ|insurance|capital|asset management|invest|credit|mortgage|lending|holdings)\b/.test(nm)) return "Finance";
  if (/\b(pharma|biotech|therapeut|medic|health|hospital|diagnos|genomic|bioscien)\b/.test(nm)) return "Healthcare";
  if (/\b(tech|software|digital|comput|data|cyber|cloud|semiconductor|chip|system)\b/.test(nm)) return "Technology";
  if (/\b(energy|oil|gas|petrol|solar|wind|power|electr|nuclear|renew|fuel)\b/.test(nm)) return "Energy";
  if (/\b(mining|mineral|gold|silver|copper|lithium|iron|metal|resource|exploration)\b/.test(nm)) return "Mining";
  if (/\b(real estate|reit|property|realty|housing|land|residential)\b/.test(nm)) return "Real Estate";
  if (/\b(retail|store|shop|consumer|food|beverage|restaurant|brand|apparel)\b/.test(nm)) return "Retail Trade";
  if (/\b(telecom|communicat|media|broadcast|entertain|stream|publish)\b/.test(nm)) return "Communications";
  if (/\b(transport|logistic|shipping|airlin|railroad|freight|delivery)\b/.test(nm)) return "Transportation";
  if (/\b(construct|building|cement|steel|infrastruc|engineer)\b/.test(nm)) return "Construction";
  if (/\b(utilit|water|waste|sanit)\b/.test(nm)) return "Utilities";
  if (/\b(agriculture|farm|crop|seed|fertiliz|agri)\b/.test(nm)) return "Agriculture";
  if (/\b(manufactur|industrial|machin|equipment|defense|aerospace|chemical|auto|motor|vehicle)\b/.test(nm)) return "Manufacturing";
  if (/\b(education|hotel|travel|tourism|casino|consult|staffing)\b/.test(nm)) return "Services";

  // Exchange-based region
  if (exch === "NSE" || exch === "BSE") return "Equity - India";
  if (exch === "JPX" || exch === "TSE") return "Equity - Japan";
  if (exch === "HKSE" || exch === "SHH" || exch === "SHZ") return "Equity - China/HK";
  if (exch === "KSC" || exch === "KOSDAQ") return "Equity - Korea";
  if (exch === "LSE") return "Equity - UK";
  if (["XETRA", "FWB", "PAR", "MIL", "BME", "SWX"].includes(exch)) return "Equity - Europe";
  if (exch === "ASX") return "Equity - Australia";
  if (["TSX", "TSXV", "CNQ"].includes(exch)) return "Equity - Canada";
  if (exch === "TAI" || exch === "TWO") return "Equity - Taiwan";
  if (exch === "SET") return "Equity - Southeast Asia";
  if (exch === "TLV") return "Equity - Israel";
  if (exch === "OTC" || exch === "SEC") return "Equity - OTC";
  if (["NYSE", "NASDAQ", "AMEX", "BATS", "NYSE ARCA", "NYSEARCA"].includes(exch)) return "Equity - US";

  // Country fallback
  const cc = country.toUpperCase();
  if (cc === "US") return "Equity - US";
  if (cc === "IN") return "Equity - India";
  if (cc === "CN" || cc === "HK") return "Equity - China/HK";
  if (cc === "JP") return "Equity - Japan";
  if (cc === "KR") return "Equity - Korea";
  if (cc === "GB") return "Equity - UK";
  if (cc === "AU") return "Equity - Australia";
  if (cc === "CA") return "Equity - Canada";
  if (["EU", "DE", "FR", "IT", "ES"].includes(cc)) return "Equity - Europe";
  if (["BR", "MX"].includes(cc)) return "Equity - Latin America";
  if (cc === "GLOBAL") return "Equity - Global";

  return "Equity";
}

/**
 * Classify a single asset. Returns a non-empty sector string.
 * If existingSector is already populated, returns it as-is.
 */
export function classifySector(
  type: string,
  symbol: string,
  name: string,
  exchange: string,
  country: string,
  existingSector?: string,
): string {
  if (existingSector && existingSector.trim() !== "") return existingSector;

  const t = type.toLowerCase();
  switch (t) {
    case "crypto":   return classifyCrypto(symbol.toUpperCase(), name);
    case "forex":    return "Forex";
    case "index":    return "Index";
    case "bond":     return "Bonds";
    case "economy":  return "Economic Indicator";
    case "futures":  return classifyFutures(symbol.toUpperCase(), name);
    case "etf":      return classifyETF(name);
    case "stock":    return classifyStockFallback(name, exchange, country);
    default:         return "Other";
  }
}
