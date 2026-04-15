const FOREX_ICON = "https://www.google.com/s2/favicons?domain=xe.com&sz=128";
const INDEX_ICON = "https://www.google.com/s2/favicons?domain=tradingview.com&sz=128";

export const STATIC_ICON_MAP: Record<string, string> = {
  // Indices
  DAX: "https://www.google.com/s2/favicons?domain=deutsche-boerse.com&sz=128",
  CAC40: "https://www.google.com/s2/favicons?domain=euronext.com&sz=128",
  NDX: "https://www.google.com/s2/favicons?domain=nasdaq.com&sz=128",
  DJI: "https://www.google.com/s2/favicons?domain=dowjones.com&sz=128",
  HANGSENG: "https://www.google.com/s2/favicons?domain=hkex.com.hk&sz=128",
  RUT: "https://www.google.com/s2/favicons?domain=ftserussell.com&sz=128",
  SPX: INDEX_ICON,
  NIFTY50: "https://www.google.com/s2/favicons?domain=nseindia.com&sz=128",
  SENSEX: "https://www.google.com/s2/favicons?domain=bseindia.com&sz=128",
  FTSE100: "https://www.google.com/s2/favicons?domain=londonstockexchange.com&sz=128",
  NIKKEI225: "https://www.google.com/s2/favicons?domain=jpx.co.jp&sz=128",

  // Forex — all major + minor + INR pairs
  EURUSD: FOREX_ICON,
  USDJPY: FOREX_ICON,
  GBPUSD: FOREX_ICON,
  USDCHF: FOREX_ICON,
  AUDUSD: FOREX_ICON,
  USDCAD: FOREX_ICON,
  NZDUSD: FOREX_ICON,
  EURJPY: FOREX_ICON,
  EURGBP: FOREX_ICON,
  USDINR: FOREX_ICON,
  EURINR: FOREX_ICON,
  GBPINR: FOREX_ICON,
  AUDJPY: FOREX_ICON,
  GBPJPY: FOREX_ICON,
  CHFJPY: FOREX_ICON,
  EURAUD: FOREX_ICON,
  EURCHF: FOREX_ICON,
  EURCAD: FOREX_ICON,
  EURNZD: FOREX_ICON,
  GBPAUD: FOREX_ICON,
  GBPCAD: FOREX_ICON,
  GBPCHF: FOREX_ICON,
  GBPNZD: FOREX_ICON,
  AUDCAD: FOREX_ICON,
  AUDCHF: FOREX_ICON,
  AUDNZD: FOREX_ICON,
  NZDJPY: FOREX_ICON,
  CADCHF: FOREX_ICON,
  CADJPY: FOREX_ICON,
  NZDCAD: FOREX_ICON,
  NZDCHF: FOREX_ICON,
  JPYINR: FOREX_ICON,
  SGDINR: FOREX_ICON,
  XAUUSD: FOREX_ICON,
  XAGUSD: FOREX_ICON,
};

export function resolveStaticIcon(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  return STATIC_ICON_MAP[symbol.trim().toUpperCase()];
}