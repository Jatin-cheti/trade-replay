import { STATIC_DOMAIN_MAP } from "./staticDomainMap";

export const HIGH_CONFIDENCE_DOMAIN_MAP: Record<string, string> = {
  RELIANCE: "relianceindustries.com",
  TCS: "tcs.com",
  INFY: "infosys.com",
  SBIN: "sbi.co.in",
  HDFCBANK: "hdfcbank.com",
  ICICIBANK: "icicibank.com",
  KOTAKBANK: "kotak.com",
  AXISBANK: "axisbank.com",
  LT: "larsentoubro.com",
  ITC: "itcportal.com",
  HINDUNILVR: "hul.co.in",
  BHARTIARTL: "airtel.in",
  MARUTI: "marutisuzuki.com",
  SUNPHARMA: "sunpharma.com",
  TATAMOTORS: "tatamotors.com",
  TATASTEEL: "tatasteel.com",
  WIPRO: "wipro.com",
  HCLTECH: "hcltech.com",
  TECHM: "techmahindra.com",
  AAPL: "apple.com",
  MSFT: "microsoft.com",
  GOOGL: "abc.xyz",
  GOOG: "abc.xyz",
  AMZN: "amazon.com",
  META: "meta.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
  JPM: "jpmorganchase.com",
  BAC: "bankofamerica.com",
  GS: "goldmansachs.com",
  NFLX: "netflix.com",
  ORCL: "oracle.com",
  CRM: "salesforce.com",
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function extractBaseSymbol(symbol: string): string {
  return normalizeSymbol(symbol).split(/[-.$]/)[0] || normalizeSymbol(symbol);
}

export function getHighConfidenceDomain(symbol: string): string | null {
  const normalized = normalizeSymbol(symbol);
  const base = extractBaseSymbol(normalized);
  return (
    HIGH_CONFIDENCE_DOMAIN_MAP[normalized]
    || HIGH_CONFIDENCE_DOMAIN_MAP[base]
    || STATIC_DOMAIN_MAP[normalized]
    || STATIC_DOMAIN_MAP[base]
    || null
  );
}