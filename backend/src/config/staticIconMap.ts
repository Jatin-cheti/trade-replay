const FOREX_ICON = "https://logo.clearbit.com/xe.com";

export const STATIC_ICON_MAP: Record<string, string> = {
  // Indices
  DAX: "https://logo.clearbit.com/deutsche-boerse.com",
  CAC40: "https://logo.clearbit.com/euronext.com",
  NDX: "https://logo.clearbit.com/nasdaq.com",
  DJI: "https://logo.clearbit.com/dowjones.com",
  HANGSENG: "https://logo.clearbit.com/hkex.com.hk",

  // Forex
  EURUSD: FOREX_ICON,
  USDJPY: FOREX_ICON,
  GBPUSD: FOREX_ICON,
  USDCHF: FOREX_ICON,
  AUDUSD: FOREX_ICON,
  USDCAD: FOREX_ICON,
  NZDUSD: FOREX_ICON,
  EURJPY: FOREX_ICON,
  USDINR: FOREX_ICON,
  EURINR: FOREX_ICON,
  GBPINR: FOREX_ICON,

  // NSE symbols requiring curated icon bootstrap
  TARACHAND: "https://logo.clearbit.com/tarachand.com",
  TIRUPATIFL: "https://logo.clearbit.com/tirupatiforge.com",
  TPLPLASTEH: "https://logo.clearbit.com/tplplastech.in",
  TATACHEM: "https://logo.clearbit.com/tatachemicals.com",
  TRENT: "https://logo.clearbit.com/trentlimited.com",
  TNTELE: "https://logo.clearbit.com/tntl.in",
  TIJARIA: "https://logo.clearbit.com/tijaria.com",
  TATAINVEST: "https://logo.clearbit.com/tatainvestment.com",
  TARMAT: "https://logo.clearbit.com/tarmatlimited.com",
  TTML: "https://logo.clearbit.com/tata-tele.com",
  TRITURBINE: "https://logo.clearbit.com/triveniturbine.com",
  TRAVELFOOD: "https://logo.clearbit.com/travelfoodservices.com",
};

export function resolveStaticIcon(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  return STATIC_ICON_MAP[symbol.trim().toUpperCase()];
}
