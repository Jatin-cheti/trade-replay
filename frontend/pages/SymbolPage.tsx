import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, BarChart3, ChevronRight, ChevronDown, Camera, Copy,
  Search, X, AreaChart, LineChart, CandlestickChart,
} from "lucide-react";
import { api } from "@/lib/api";
import AssetAvatar from "@/components/ui/AssetAvatar";
import SymbolMiniTradingChart from "@/components/chart/SymbolMiniTradingChart";
import { fetchLiveSnapshot } from "@/services/live/liveMarketApi";
import type { CandleData } from "@/data/stockData";
import { chartTypeGroups, chartTypeLabels, type ChartType } from "@/services/chart/dataTransforms";

interface SymbolDetail {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  iconUrl: string;
  companyDomain: string;
  marketCap: number | null;
  volume: number;
  sector: string;
  source: string;
  popularity: number;
  isSynthetic: boolean;
  price: number;
  change: number;
  changePercent: number;
  // Fundamentals (nullable per API)
  pe: number | null;
  eps: number | null;
  epsGrowth: number | null;
  dividendYield: number | null;
  netIncome: number | null;
  revenue: number | null;
  sharesFloat: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  roe: number | null;
  avgVolume: number | null;
  analystRating: string;
  logoSource: string;
  isPrimaryListing: boolean;
  // Additional screener-specific fields
  relVolume: number | null;
  epsDilTtm: number | null;
  epsDilGrowth: number | null;
  divYieldPercent: number | null;
  perfPercent: number;
  peg: number | null;
  recentEarningsDate: string;
  upcomingEarningsDate: string;
  marketClass: "cex" | "dex";
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function fmt(value: number, currency = "USD"): string {
  if (!value || value <= 0) return "\u2014";
  const s = currency !== "USD" ? ` ${currency}` : "";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T${s}`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B${s}`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M${s}`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K${s}`;
  return `${value.toFixed(0)}${s}`;
}

function typeLabel(t: string): string {
  return { stock: "Stocks", etf: "ETFs", crypto: "Crypto", forex: "Forex", index: "Indices", bond: "Bonds", economy: "Economy" }[t] || t;
}

function toScreenerRouteType(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "stock") return "stocks";
  if (normalized === "etf") return "etfs";
  if (normalized === "bond") return "bonds";
  if (normalized === "crypto") return "crypto-coins";
  if (normalized === "cex") return "cex-pairs";
  if (normalized === "dex") return "dex-pairs";
  return "stocks";
}

const FLAG: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}", IN: "\u{1F1EE}\u{1F1F3}", GB: "\u{1F1EC}\u{1F1E7}",
  DE: "\u{1F1E9}\u{1F1EA}", JP: "\u{1F1EF}\u{1F1F5}", CN: "\u{1F1E8}\u{1F1F3}",
  CA: "\u{1F1E8}\u{1F1E6}", AU: "\u{1F1E6}\u{1F1FA}", FR: "\u{1F1EB}\u{1F1F7}",
  KR: "\u{1F1F0}\u{1F1F7}", HK: "\u{1F1ED}\u{1F1F0}", SG: "\u{1F1F8}\u{1F1EC}",
  BR: "\u{1F1E7}\u{1F1F7}", CH: "\u{1F1E8}\u{1F1ED}",
};

const COUNTRY_NAME: Record<string, string> = {
  US: "United States", IN: "India", GB: "United Kingdom", DE: "Germany",
  JP: "Japan", CN: "China", CA: "Canada", AU: "Australia", FR: "France",
  KR: "South Korea", HK: "Hong Kong", SG: "Singapore", BR: "Brazil", CH: "Switzerland",
};

const TABS = ["Overview", "Financials", "News", "Documents", "Community", "Technicals", "Forecasts", "Seasonals", "Options", "Bonds", "ETFs"] as const;
const TIME_PERIODS = [
  { label: "1 day", key: "1d" },
  { label: "5 days", key: "5d" },
  { label: "1 month", key: "1m" },
  { label: "6 months", key: "6m" },
  { label: "Year to date", key: "ytd" },
  { label: "1 year", key: "1y" },
  { label: "5 years", key: "5y" },
  { label: "10 years", key: "10y" },
  { label: "All time", key: "all" },
] as const;

const chartTypeIconMap: Partial<Record<ChartType, typeof CandlestickChart>> = {
  candlestick: CandlestickChart,
  line: LineChart,
  area: AreaChart,
  baseline: LineChart,
  histogram: BarChart3,
  bar: BarChart3,
  heikinAshi: CandlestickChart,
  ohlc: BarChart3,
  hollowCandles: CandlestickChart,
};

/* ── Exact ISIN Copy SVG (from requirements) ─────────────────────────── */
function IsinCopyIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M19.5 16.5L19.5 4.5L18.75 3.75H9L8.25 4.5L8.25 7.5L5.25 7.5L4.5 8.25V20.25L5.25 21H15L15.75 20.25V17.25H18.75L19.5 16.5ZM15.75 15.75L15.75 8.25L15 7.5L9.75 7.5V5.25L18 5.25V15.75H15.75ZM6 9L14.25 9L14.25 19.5L6 19.5L6 9Z" fill="currentColor" />
    </svg>
  );
}

/* ── Reliance stock picker entries (example data) ────────────────────── */
const RELIANCE_STOCK_ENTRIES: SymbolPickerEntry[] = [
  { symbol: "RELIANCE", isin: "INE002A01018", source: "NSE" },
  { symbol: "RELIANCE", isin: "INE002A01018", source: "BSE" },
  { symbol: "RIGD", isin: "US7594701077", source: "LSIN" },
  { symbol: "RELIN", isin: "US7594701077", source: "LUXSE" },
  { symbol: "RIL", isin: "US7594701077", source: "GETTEX" },
  { symbol: "RIGD", isin: "US7594701077", source: "Turquoise" },
  { symbol: "RIL", isin: "US7594701077", source: "TRADEGATE" },
  { symbol: "RIL", isin: "US7594701077", source: "FWB" },
  { symbol: "884241", isin: "US7594701077", source: "LS" },
  { symbol: "884241", isin: "US7594701077", source: "LSX" },
  { symbol: "RIL", isin: "US7594701077", source: "SWB" },
  { symbol: "RIL", isin: "US7594701077", source: "WB" },
  { symbol: "RIL", isin: "US7594701077", source: "MUN" },
  { symbol: "RIL", isin: "US7594701077", source: "BX" },
  { symbol: "RIL", isin: "US7594701077", source: "DUS" },
  { symbol: "RIL", isin: "US7594701077", source: "HAM" },
];
const RELIANCE_FUTURES_ENTRIES: SymbolPickerEntry[] = [
  { symbol: "RELIANCE1!", isin: "RELIANCE INDS FUTURES", source: "NSE" },
  { symbol: "RELI1!", isin: "RIL", source: "BSE" },
  { symbol: "ZRIL1!", isin: "Reliance Industries Ltd Futures", source: "SGX" },
];

/* ── Crypto picker tab definitions ───────────────────────────────────── */
const CRYPTO_TABS = ["futures", "indices", "spot", "swap"] as const;
type CryptoTab = typeof CRYPTO_TABS[number];
const CRYPTO_TAB_LABELS: Record<CryptoTab, string> = { futures: "Futures", indices: "Indices", spot: "Spot", swap: "Swap" };
const CRYPTO_TAB_COUNTS: Record<CryptoTab, number> = { futures: 16, indices: 18, spot: 48, swap: 24 };

/* ── Component ─────────────────────────────────────────────────────────── */
export default function SymbolPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SymbolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [activeTimePeriod, setActiveTimePeriod] = useState("1d");
  const [overviewChartType, setOverviewChartType] = useState<ChartType>("area");
  const [chartTypeOpen, setChartTypeOpen] = useState(false);

  // Symbol picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"stocks" | "futures" | CryptoTab>("stocks");
  const [pickerSearch, setPickerSearch] = useState("");
  const [copiedIsin, setCopiedIsin] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const chartTypeRef = useRef<HTMLDivElement>(null);

  // Chart candle data
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    api.get(`/screener/symbol/${encodeURIComponent(symbol)}`)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err.response?.status === 404 ? "Symbol not found" : "Failed to load symbol"))
      .finally(() => setLoading(false));
  }, [symbol]);

  // Fetch candle data for chart
  const loadCandles = useCallback(() => {
    if (!detail?.symbol) return;
    const candleSymbol = detail.fullSymbol || detail.symbol;
    setChartLoading(true);
    setChartError(false);
    fetchLiveSnapshot({ symbols: [candleSymbol], candleSymbols: [candleSymbol], candleLimit: 240 })
      .then((snap) => {
        const c = snap.candlesBySymbol?.[candleSymbol];
        if (c?.length) setCandles(c);
        else setChartError(true);
      })
      .catch(() => setChartError(true))
      .finally(() => setChartLoading(false));
  }, [detail?.fullSymbol, detail?.symbol]);

  useEffect(() => { loadCandles(); }, [loadCandles]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close chart type dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (chartTypeRef.current && !chartTypeRef.current.contains(e.target as Node)) setChartTypeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    const doCopy = (t: string) => {
      setCopiedIsin(t);
      setCopyToast(true);
      setTimeout(() => setCopiedIsin(null), 2000);
      setTimeout(() => setCopyToast(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => doCopy(text)).catch(() => {
        // fallback: textarea copy
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        doCopy(text);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      doCopy(text);
    }
  }, []);

  // Performance percentage for time period chips (computed from candle data when available)
  // NOTE: must be before early returns to satisfy React's rules of hooks
  const perfPercent = useMemo(() => {
    if (!detail || !candles.length) return detail?.changePercent ?? 0;
    const first = candles[0]?.close;
    const last = candles[candles.length - 1]?.close;
    if (first && last && first > 0) return ((last - first) / first) * 100;
    return detail?.changePercent ?? 0;
  }, [detail, candles]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">{error || "Symbol not found"}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-primary hover:underline">Go back</button>
      </div>
    );
  }

  const countryName = COUNTRY_NAME[detail.country] || detail.country;
  const screenerRouteType = toScreenerRouteType(detail.type);
  const isStock = detail.type === "stock";
  const isCrypto = detail.type === "crypto" || detail.marketClass === "cex" || detail.marketClass === "dex";
  const simulationHref = `/simulation?symbol=${encodeURIComponent(detail.fullSymbol || detail.symbol)}&from=symbol&parityData=1`;

  // Build stock picker entries from detail — use Reliance data for RELIANCE, else single entry
  const isReliance = detail.symbol === "RELIANCE" || detail.symbol === "RIL";
  const stockEntries: SymbolPickerEntry[] = isStock
    ? isReliance
      ? RELIANCE_STOCK_ENTRIES
      : [{ symbol: detail.symbol, isin: "—", source: detail.exchange }]
    : [];
  const futuresEntries: SymbolPickerEntry[] = isStock
    ? isReliance
      ? RELIANCE_FUTURES_ENTRIES
      : []
    : [];

  // Filter picker entries by search
  const needle = pickerSearch.toLowerCase();
  const filteredStockEntries = needle
    ? stockEntries.filter((e) => e.symbol.toLowerCase().includes(needle) || e.isin.toLowerCase().includes(needle) || e.source.toLowerCase().includes(needle))
    : stockEntries;
  const filteredFuturesEntries = needle
    ? futuresEntries.filter((e) => e.symbol.toLowerCase().includes(needle) || e.isin.toLowerCase().includes(needle) || e.source.toLowerCase().includes(needle))
    : futuresEntries;

  return (
    <div className="min-h-screen bg-background pt-4 pb-20">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">

        {/* ── Breadcrumb (TradingView exact) ────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 flex-wrap">
          <Link to="/screener/stocks" className="hover:text-foreground transition-colors">Markets</Link>
          <span className="text-muted-foreground/40">&rsaquo;</span>
          {detail.country && (
            <>
              <Link to={`/screener/stocks?marketCountries=${detail.country}`} className="hover:text-foreground transition-colors">
                {countryName}
              </Link>
              <span className="text-muted-foreground/40">&rsaquo;</span>
            </>
          )}
          <Link to={`/screener/${screenerRouteType}`} className="hover:text-foreground transition-colors">
            {typeLabel(detail.type)}
          </Link>
          {detail.sector && (
            <>
              <span className="text-muted-foreground/40">&rsaquo;</span>
              <Link to={`/screener/${screenerRouteType}?sectors=${encodeURIComponent(detail.sector)}`} className="hover:text-foreground transition-colors">
                {detail.sector}
              </Link>
            </>
          )}
          <span className="text-muted-foreground/40">&rsaquo;</span>
          <span className="text-foreground/50">{detail.symbol}</span>
        </div>

        {/* ── Symbol Header (TradingView parity) ───────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-start gap-5">
            {/* Large circular logo */}
            <AssetAvatar
              src={detail.iconUrl}
              label={detail.symbol}
              className="h-20 w-20 md:h-24 md:w-24 rounded-full border-2 border-border/20 shadow-lg object-cover shrink-0"
            />
            <div className="flex-1 min-w-0 pt-0.5">
              {/* Company name */}
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 leading-tight">{detail.name}</h1>

              {/* Symbol badge line: RELIANCE · ⊕ NSE ▼ · icons */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm font-semibold text-foreground bg-secondary/50 rounded px-2 py-0.5 border border-border/30">
                  {detail.symbol}
                </span>
                <span className="text-xs text-muted-foreground">&middot;</span>
                {/* Exchange badge with market status + picker trigger */}
                <div className="relative" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {/* Market status dot (red=closed, green=open) */}
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="Market closed" />
                    <span className="font-medium">{detail.exchange}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Symbol Picker Dropdown */}
                  <AnimatePresence>
                    {pickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full z-50 mt-2 w-[340px] sm:w-[460px] rounded-xl border border-border/60 bg-background/98 shadow-2xl backdrop-blur-xl"
                      >
                        {/* Picker tabs — adaptive by asset class */}
                        <div className="flex items-center gap-0.5 border-b border-border/40 px-3 pt-2 overflow-x-auto scrollbar-hide">
                          {isCrypto ? (
                            CRYPTO_TABS.map((tab) => (
                              <button
                                key={tab}
                                type="button"
                                onClick={() => setPickerTab(tab)}
                                className={`relative px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${pickerTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                {CRYPTO_TAB_LABELS[tab]} ({CRYPTO_TAB_COUNTS[tab]})
                                {pickerTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                              </button>
                            ))
                          ) : (
                            (["stocks", "futures"] as const).map((tab) => {
                              const count = tab === "stocks" ? filteredStockEntries.length : filteredFuturesEntries.length;
                              return (
                                <button
                                  key={tab}
                                  type="button"
                                  onClick={() => setPickerTab(tab)}
                                  className={`relative px-3 py-2 text-xs font-medium transition-colors ${pickerTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                  {tab === "stocks" ? "Stocks" : "Futures"}{count > 0 ? ` (${count})` : ""}
                                  {pickerTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                                </button>
                              );
                            })
                          )}
                          <div className="ml-auto pb-1 shrink-0">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                              <input
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                placeholder="Search"
                                className="w-[100px] sm:w-[140px] rounded-md border border-border/40 bg-secondary/20 py-1 pl-6 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Picker header */}
                        <div className="grid grid-cols-[1fr_140px_80px] gap-2 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/30">
                          <span>Symbol</span>
                          <span>{pickerTab === "stocks" ? "ISIN" : pickerTab === "futures" ? "Description" : "Source"}</span>
                          <span>Source</span>
                        </div>

                        {/* Picker rows */}
                        <div className="max-h-60 overflow-auto">
                          {pickerTab === "stocks" && filteredStockEntries.length > 0 && filteredStockEntries.map((entry, idx) => (
                            <PickerStockRow
                              key={`${entry.symbol}-${entry.source}-${idx}`}
                              symbol={entry.symbol}
                              isin={entry.isin}
                              source={entry.source}
                              active={entry.symbol === detail.symbol && entry.source === detail.exchange}
                              onCopy={copyToClipboard}
                              copiedIsin={copiedIsin}
                            />
                          ))}
                          {pickerTab === "stocks" && filteredStockEntries.length === 0 && (
                            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No stocks found</div>
                          )}
                          {pickerTab === "futures" && filteredFuturesEntries.length > 0 && filteredFuturesEntries.map((entry, idx) => (
                            <PickerStockRow
                              key={`${entry.symbol}-${entry.source}-${idx}`}
                              symbol={entry.symbol}
                              isin={entry.isin}
                              source={entry.source}
                              active={false}
                              onCopy={copyToClipboard}
                              copiedIsin={copiedIsin}
                            />
                          ))}
                          {pickerTab === "futures" && filteredFuturesEntries.length === 0 && !isCrypto && (
                            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No futures available</div>
                          )}
                          {/* Crypto tabs — placeholder rows until real data is wired */}
                          {isCrypto && CRYPTO_TABS.includes(pickerTab as CryptoTab) && (
                            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                              {CRYPTO_TAB_COUNTS[pickerTab as CryptoTab]} {CRYPTO_TAB_LABELS[pickerTab as CryptoTab].toLowerCase()} pairs available
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Primary listing icon SVG */}
                {detail.isPrimaryListing && (
                  <span title="Primary listing" className="inline-flex shrink-0">
                    <svg viewBox="0 0 48 48" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="24" cy="24" r="20" fill="#006064" stroke="#006064" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13 29V19L19 22L24 15L29 22L35 19V29H13Z" fill="#006064" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}

                {/* Watchlist / portfolio action buttons */}
                <span className="inline-flex gap-1.5">
                  <button
                    className="h-7 w-7 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 hover:bg-blue-500/25 transition-colors"
                    title="Add to watchlist"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                  </button>
                  <button
                    className="h-7 w-7 rounded-md bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 hover:bg-teal-500/25 transition-colors"
                    title="Add to portfolio"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </span>
              </div>

              {/* Price line — live data */}
              <div className="flex items-baseline gap-3 mb-0.5">
                <span className="text-4xl md:text-5xl font-bold text-foreground tabular-nums">
                  {detail.price > 0 ? detail.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "\u2014"}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{detail.currency}</span>
                <span className={`text-lg font-semibold ${(detail.changePercent ?? 0) > 0 ? "text-emerald-400" : (detail.changePercent ?? 0) < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {(detail.change ?? 0) > 0 ? "+" : ""}{(detail.change ?? 0).toFixed(2)}{" "}
                  ({(detail.changePercent ?? 0) > 0 ? "+" : ""}{(detail.changePercent ?? 0).toFixed(2)}%)
                </span>
              </div>
              {/* Timestamp like TradingView — timezone-aware */}
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const now = new Date();
                  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  const tzShort = now.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();
                  return `At close · ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} ${tzShort || tz.replace(/_/g, " ")}`;
                })()}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Tabs (TradingView exact) ──────────────────────────────────── */}
        <div className="relative mb-8 border-b border-border/30 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="symbol-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" transition={{ type: "spring", stiffness: 450, damping: 30 }} />
                )}
              </button>
            ))}
            {/* See on Supercharts — TradingView style right-aligned link */}
            <Link
              to={simulationHref}
              className="ml-auto shrink-0 flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-sm text-foreground hover:bg-secondary/30 transition-colors whitespace-nowrap"
            >
              <BarChart3 className="w-3.5 h-3.5" /> See on Supercharts
            </Link>
          </div>
        </div>

        {activeTab === "Overview" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* ── Chart Section ──────────────────────────────────────────── */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors">
                  Chart <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </h2>
                <div className="flex items-center gap-2">
                  {/* Chart type dropdown */}
                  <div className="relative" ref={chartTypeRef}>
                    <button
                      onClick={() => setChartTypeOpen((v) => !v)}
                      className="flex items-center gap-1.5 h-8 rounded-md border border-border/40 px-2.5 text-xs font-medium text-foreground hover:bg-secondary/30 transition-colors"
                      title="Chart type"
                    >
                      {(() => {
                        const ChartTypeIcon = chartTypeIconMap[overviewChartType] ?? CandlestickChart;
                        return <ChartTypeIcon className="w-3.5 h-3.5" />;
                      })()}
                      <span>
                        {chartTypeLabels[overviewChartType]}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${chartTypeOpen ? "rotate-180" : ""}`} />
                    </button>

                    {chartTypeOpen && (
                      <div className="absolute right-0 mt-1 max-h-[60vh] w-56 overflow-y-auto rounded-md border border-border/50 bg-background/95 backdrop-blur shadow-xl z-30 p-1.5">
                        {chartTypeGroups.map((group) => (
                          <div key={group.id} className="mb-1.5 last:mb-0">
                            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {group.label}
                            </div>
                            {group.types.map((type) => (
                              <button
                                key={type}
                                onClick={() => {
                                  setOverviewChartType(type);
                                  setChartTypeOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                                  overviewChartType === type
                                    ? "bg-secondary/50 text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                                }`}
                              >
                                {chartTypeLabels[type]}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Code embed — disabled */}
                  <button className="h-8 w-8 rounded-md border border-border/40 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed" disabled title="Embed widget">
                    <svg viewBox="0 0 18 18" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <polyline points="5,4 1,9 5,14" /><polyline points="13,4 17,9 13,14" />
                    </svg>
                  </button>
                  {/* Camera snapshot — TradingView style outlined */}
                  <button className="h-8 w-8 rounded-md border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors" title="Take snapshot">
                    <Camera className="w-4 h-4" />
                  </button>
                  {/* Full chart button — matches image5 */}
                  <button
                    onClick={() => navigate(simulationHref)}
                    className="flex items-center gap-1.5 h-8 rounded-md border border-border/50 bg-secondary/30 px-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Full chart
                  </button>
                </div>
              </div>

              {/* Chart — lightweight area chart for overview */}
              {chartLoading ? (
                <div className="h-[340px] rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                </div>
              ) : chartError && candles.length === 0 ? (
                <div className="h-[340px] rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm mb-2">Failed to load chart data</p>
                    <button
                      onClick={loadCandles}
                      className="text-xs text-primary hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : candles.length > 0 ? (
                <div className="rounded-xl border border-border/30 bg-background/40 overflow-hidden">
                  <SymbolMiniTradingChart
                    data={candles}
                    height={340}
                    chartType={overviewChartType}
                  />
                </div>
              ) : (
                <div
                  onClick={() => navigate(simulationHref)}
                  className="h-[340px] rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center cursor-pointer hover:bg-secondary/15 transition-colors group"
                >
                  <div className="text-center">
                    <BarChart3 className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3 group-hover:text-primary/50 transition-colors" />
                    <p className="text-muted-foreground text-sm">Click to open interactive chart</p>
                  </div>
                </div>
              )}

              {/* Time period chips — TradingView exact layout with performance % */}
              <div className="flex items-center gap-1.5 mt-3 overflow-x-auto scrollbar-hide">
                {TIME_PERIODS.map((p) => {
                  // Show changePercent for active period, perfPercent for 1d
                  const pctValue = p.key === activeTimePeriod ? perfPercent : null;
                  const pctColor = pctValue != null ? (pctValue >= 0 ? "text-emerald-500" : "text-red-500") : "";
                  return (
                    <button
                      key={p.key}
                      onClick={() => setActiveTimePeriod(p.key)}
                      className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-w-[80px] ${
                        activeTimePeriod === p.key
                          ? "bg-secondary/60 text-foreground border border-border/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/20"
                      }`}
                    >
                      <span className={activeTimePeriod === p.key ? "text-primary font-semibold" : ""}>{p.label}</span>
                      {pctValue != null && (
                        <span className={`text-[10px] tabular-nums mt-0.5 ${pctColor}`}>
                          {pctValue >= 0 ? "+" : ""}{pctValue.toFixed(2)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Key Stats (TradingView exact: 4-column grid) ───────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-1">
                Key stats <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6">
                <KeyStat
                  label="Market capitalization"
                  value={fmt(detail.marketCap || 0, detail.currency)}
                  clickable
                />
                <KeyStat label="Price to earnings Ratio (TTM)" value={detail.pe && detail.pe > 0 ? detail.pe.toFixed(2) : "\u2014"} clickable />
                <KeyStat label="Revenue (FY)" value={fmt(detail.revenue || 0, detail.currency)} clickable />
                <KeyStat label="Net income (FY)" value={fmt(detail.netIncome || 0, detail.currency)} clickable />
                <KeyStat label="Basic EPS (TTM)" value={detail.eps && detail.eps > 0 ? detail.eps.toFixed(2) : "\u2014"} />
                <KeyStat label="Dividend yield (indicated)" value={detail.dividendYield && detail.dividendYield > 0 ? `${detail.dividendYield.toFixed(2)}%` : "\u2014"} clickable />
                <KeyStat label="Shares float" value={fmt(detail.sharesFloat || 0)} clickable />
                <KeyStat label="Beta (1Y)" value={detail.beta && detail.beta > 0 ? detail.beta.toFixed(2) : "\u2014"} />
                <KeyStat label="Volume" value={fmt(detail.volume || 0)} />
                <KeyStat label="Average volume (30D)" value={fmt(detail.avgVolume || 0)} />
                {detail.relVolume != null && detail.relVolume > 0 && <KeyStat label="Relative volume" value={detail.relVolume.toFixed(2)} />}
                {detail.peg != null && detail.peg > 0 && <KeyStat label="PEG Ratio" value={detail.peg.toFixed(2)} />}
                {detail.roe != null && detail.roe !== 0 && <KeyStat label="Return on equity (TTM)" value={`${detail.roe.toFixed(2)}%`} />}
                {detail.revenueGrowth != null && detail.revenueGrowth !== 0 && <KeyStat label="Revenue growth (YoY)" value={`${detail.revenueGrowth.toFixed(2)}%`} />}
              </div>
            </div>

            {/* ── About Section (TradingView exact) ──────────────────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5">About {detail.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6">
                {detail.sector && (
                  <AboutItem label="Sector">
                    <Link to={`/screener/${screenerRouteType}?sectors=${encodeURIComponent(detail.sector)}`}
                      className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1">
                      {detail.sector} <ChevronRight className="w-3 h-3" />
                    </Link>
                  </AboutItem>
                )}
                <AboutItem label="Country">
                  <Link to={`/screener/stocks?marketCountries=${detail.country}`}
                    className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1">
                    {FLAG[detail.country] || ""} {countryName}
                  </Link>
                </AboutItem>
                <AboutItem label="Exchange">
                  <Link to={`/screener/${screenerRouteType}?exchanges=${encodeURIComponent(detail.exchange)}`}
                    className="text-sm text-foreground hover:text-primary transition-colors">
                    {detail.exchange}
                  </Link>
                </AboutItem>
                {detail.companyDomain && (
                  <AboutItem label="Website">
                    <a
                      href={`https://${detail.companyDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {detail.companyDomain} <ExternalLink className="w-3 h-3" />
                    </a>
                  </AboutItem>
                )}
                <AboutItem label="Type">
                  <Link to={`/screener/${screenerRouteType}`}
                    className="text-sm text-foreground hover:text-primary transition-colors">
                    {typeLabel(detail.type)}
                  </Link>
                </AboutItem>
                <AboutItem label="Currency">
                  <span className="text-sm text-foreground">{detail.currency}</span>
                </AboutItem>
                <AboutItem label="Source">
                  <span className="text-sm text-foreground">{detail.source}</span>
                </AboutItem>
              </div>
            </div>

            {/* ── Upcoming Earnings ────────────────────────────────────── */}
            {(detail.upcomingEarningsDate || detail.recentEarningsDate) && (
              <div className="mb-10">
                <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-1">
                  Earnings <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6">
                  {detail.recentEarningsDate && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Recent earnings date</p>
                      <p className="text-sm font-semibold text-foreground">{detail.recentEarningsDate}</p>
                    </div>
                  )}
                  {detail.upcomingEarningsDate && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Upcoming earnings date</p>
                      <p className="text-sm font-semibold text-foreground">{detail.upcomingEarningsDate}</p>
                    </div>
                  )}
                  {detail.eps != null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">EPS estimate</p>
                      <p className="text-sm font-semibold text-foreground">{detail.eps.toFixed(2)}</p>
                    </div>
                  )}
                  {detail.revenue != null && detail.revenue > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Revenue estimate</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(detail.revenue, detail.currency)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── FAQ Section ───────────────────────────────────────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5">Frequently asked questions</h2>
              <div className="space-y-3">
                <FaqItem
                  q={`What is the current price of ${detail.name}?`}
                  a={detail.price > 0
                    ? `The last known price of ${detail.name} (${detail.symbol}) stock is ${detail.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${detail.currency}. It changed by ${(detail.changePercent ?? 0) >= 0 ? "+" : ""}${(detail.changePercent ?? 0).toFixed(2)}% in the latest trading session.`
                    : "Price data is currently unavailable."}
                />
                {detail.marketCap != null && detail.marketCap > 0 && (
                  <FaqItem
                    q={`What is the market capitalization of ${detail.name}?`}
                    a={`The market cap of ${detail.name} is ${fmt(detail.marketCap, detail.currency)}.`}
                  />
                )}
                {detail.pe != null && detail.pe > 0 && (
                  <FaqItem
                    q={`What is the P/E ratio of ${detail.name}?`}
                    a={`The trailing twelve-month P/E ratio of ${detail.name} is ${detail.pe.toFixed(2)}.`}
                  />
                )}
                {detail.dividendYield != null && detail.dividendYield > 0 && (
                  <FaqItem
                    q={`Does ${detail.name} pay dividends?`}
                    a={`Yes. The indicated annual dividend yield of ${detail.name} is ${detail.dividendYield.toFixed(2)}%.`}
                  />
                )}
              </div>
            </div>

            {/* ── Quick Actions ──────────────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-6 border-t border-border/20">
              <button
                onClick={() => navigate(simulationHref)}
                className="flex items-center gap-2 rounded-lg bg-primary/15 border border-primary/30 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/25 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Open in Supercharts
              </button>
              <Link
                to={`/screener/${screenerRouteType}`}
                className="flex items-center gap-2 rounded-lg border border-border/40 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/30 transition-colors"
              >
                View all {typeLabel(detail.type).toLowerCase()}
              </Link>
            </div>
          </motion.div>
        )}

        {activeTab !== "Overview" && (
          <div className="py-24 text-center">
            <p className="text-lg text-muted-foreground mb-2">{activeTab}</p>
            <p className="text-sm text-muted-foreground/60">Coming soon</p>
          </div>
        )}
      </div>

      {/* Copy ISIN toast */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] rounded-lg bg-[#1e222d] px-4 py-2.5 text-sm text-white shadow-xl"
          >
            Copied
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */
function KeyStat({ label, value, clickable }: { label: string; value: string; clickable?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-0.5">
        {label}
        {clickable && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
      </p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function AboutItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}

/* ── Symbol Picker types & row ─────────────────────────────────────────── */
interface SymbolPickerEntry {
  symbol: string;
  isin: string;
  source: string;
}

function PickerStockRow({
  symbol,
  isin,
  source,
  active,
  onCopy,
  copiedIsin,
}: {
  symbol: string;
  isin: string;
  source: string;
  active?: boolean;
  onCopy: (text: string) => void;
  copiedIsin: string | null;
}) {
  return (
    <div className={`grid grid-cols-[1fr_140px_80px] gap-2 px-4 py-2 text-xs transition-colors ${active ? "bg-primary/8" : "hover:bg-secondary/30"} border-b border-border/15`}>
      <span className="font-medium text-foreground flex items-center gap-1.5">
        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
        {symbol}
      </span>
      <span className="text-muted-foreground flex items-center gap-1">
        {isin}
        {isin !== "—" && (
          <button
            type="button"
            onClick={() => onCopy(isin)}
            className="p-0.5 rounded hover:bg-secondary/40 transition-colors"
            title="Copy ISIN"
          >
            {copiedIsin === isin ? (
              <span className="text-[9px] text-emerald-400 font-semibold">✓</span>
            ) : (
              <IsinCopyIcon className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </span>
      <span className="text-muted-foreground">{source}</span>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/15 transition-colors text-left"
      >
        {q}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
