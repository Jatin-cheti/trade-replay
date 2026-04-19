import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, BarChart3, ChevronRight, ChevronDown, Camera, Copy,
  Search, X,
} from "lucide-react";
import { api } from "@/lib/api";
import AssetAvatar from "@/components/ui/AssetAvatar";
import TradingChart from "@/components/chart/TradingChart";
import { fetchLiveSnapshot } from "@/services/live/liveMarketApi";
import type { CandleData } from "@/data/stockData";

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

/* ── Component ─────────────────────────────────────────────────────────── */
export default function SymbolPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SymbolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [activeTimePeriod, setActiveTimePeriod] = useState("1d");

  // Symbol picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"stocks" | "futures">("stocks");
  const [pickerSearch, setPickerSearch] = useState("");
  const [copiedIsin, setCopiedIsin] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Chart candle data
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

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
  useEffect(() => {
    if (!detail?.symbol) return;
    setChartLoading(true);
    fetchLiveSnapshot({ symbols: [detail.symbol], candleSymbols: [detail.symbol], candleLimit: 240 })
      .then((snap) => {
        const c = snap.candlesBySymbol?.[detail.symbol];
        if (c?.length) setCandles(c);
      })
      .catch(() => {})
      .finally(() => setChartLoading(false));
  }, [detail?.symbol]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIsin(text);
      setTimeout(() => setCopiedIsin(null), 2000);
    });
  }, []);

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

  // Build stock picker entries from detail
  const stockEntries: SymbolPickerEntry[] = isStock ? [
    { symbol: detail.symbol, isin: "—", source: detail.exchange },
  ] : [];
  const futuresEntries: SymbolPickerEntry[] = [];

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
                {/* Exchange badge with picker trigger */}
                <div className="relative" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                    {detail.exchange}
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
                        className="absolute left-0 top-full z-50 mt-2 w-[460px] rounded-xl border border-border/60 bg-background/98 shadow-2xl backdrop-blur-xl"
                      >
                        {/* Picker tabs */}
                        <div className="flex items-center gap-0.5 border-b border-border/40 px-3 pt-2">
                          {(isStock ? (["stocks", "futures"] as const) : (["futures"] as const)).map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setPickerTab(tab)}
                              className={`relative px-3 py-2 text-xs font-medium transition-colors ${pickerTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              {tab === "stocks" ? "Stocks" : "Futures"}
                              {pickerTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                            </button>
                          ))}
                          <div className="ml-auto pb-1">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                              <input
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                placeholder="Search"
                                className="w-[140px] rounded-md border border-border/40 bg-secondary/20 py-1 pl-6 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Picker header */}
                        <div className="grid grid-cols-[1fr_140px_80px] gap-2 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/30">
                          <span>Symbol</span>
                          <span>{pickerTab === "stocks" ? "ISIN" : "Description"}</span>
                          <span>Source</span>
                        </div>

                        {/* Picker rows */}
                        <div className="max-h-60 overflow-auto">
                          {pickerTab === "stocks" && (
                            <PickerStockRow
                              symbol={detail.symbol}
                              isin="—"
                              source={detail.exchange}
                              active
                              onCopy={copyToClipboard}
                              copiedIsin={copiedIsin}
                            />
                          )}
                          {pickerTab === "futures" && (
                            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No futures available</div>
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
                <span className="inline-flex gap-1">
                  <span className="w-5 h-5 rounded-md bg-blue-500/80 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer" title="Add to watchlist">&bull;</span>
                  <span className="w-5 h-5 rounded-md bg-teal-500/80 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer" title="Add to portfolio">+</span>
                </span>
              </div>

              {/* Price line — live data */}
              <div className="flex items-baseline gap-3 mb-0.5">
                <span className="text-4xl md:text-5xl font-bold text-foreground tabular-nums">
                  {detail.price > 0 ? detail.price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "\u2014"}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{detail.currency}</span>
                {detail.changePercent !== 0 && (
                  <span className={`text-lg font-semibold ${detail.changePercent > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {detail.change > 0 ? "+" : ""}{detail.change.toFixed(2)}{" "}
                    {detail.changePercent > 0 ? "+" : ""}{detail.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
              {/* Timestamp like TradingView */}
              <p className="text-xs text-muted-foreground">
                At close at {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })} {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}
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
              to={`/simulation?symbol=${detail.symbol}`}
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
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-1">
                  Chart <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </h2>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors text-xs">&lt;/&gt;</button>
                  <button
                    onClick={() => navigate(`/simulation?symbol=${detail.symbol}`)}
                    className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-sm text-foreground hover:bg-secondary/30 transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Full chart
                  </button>
                </div>
              </div>

              {/* Chart — real TradingChart or loading fallback */}
              {chartLoading ? (
                <div className="h-80 rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                </div>
              ) : candles.length > 0 ? (
                <div className="h-80 rounded-xl border border-border/30 bg-background/40 overflow-hidden">
                  <TradingChart data={candles} visibleCount={candles.length} symbol={detail.symbol} />
                </div>
              ) : (
                <div
                  onClick={() => navigate(`/simulation?symbol=${detail.symbol}`)}
                  className="h-80 rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center cursor-pointer hover:bg-secondary/15 transition-colors group"
                >
                  <div className="text-center">
                    <BarChart3 className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3 group-hover:text-primary/50 transition-colors" />
                    <p className="text-muted-foreground text-sm">Click to open interactive chart</p>
                  </div>
                </div>
              )}

              {/* Time period pills — TradingView exact layout */}
              <div className="flex items-center gap-1 mt-3 overflow-x-auto scrollbar-hide">
                {TIME_PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setActiveTimePeriod(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeTimePeriod === p.key
                        ? "bg-secondary/60 text-foreground border border-border/40"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
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
                <KeyStat label="Dividend yield (indicated)" value={detail.dividendYield && detail.dividendYield > 0 ? `${detail.dividendYield.toFixed(2)}%` : "\u2014"} clickable />
                <KeyStat label="Price to earnings Ratio (TTM)" value={detail.pe && detail.pe > 0 ? detail.pe.toFixed(2) : "\u2014"} clickable />
                <KeyStat label="Basic EPS (TTM)" value={detail.eps && detail.eps > 0 ? detail.eps.toFixed(2) : "\u2014"} />
                <KeyStat label="Net income (FY)" value={fmt(detail.netIncome || 0, detail.currency)} clickable />
                <KeyStat label="Revenue (FY)" value={fmt(detail.revenue || 0, detail.currency)} clickable />
                <KeyStat label="Shares float" value={fmt(detail.sharesFloat || 0)} clickable />
                <KeyStat label="Beta (1Y)" value={detail.beta && detail.beta > 0 ? detail.beta.toFixed(2) : "\u2014"} />
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

            {/* ── Quick Actions ──────────────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-6 border-t border-border/20">
              <button
                onClick={() => navigate(`/simulation?symbol=${detail.symbol}`)}
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
              <span className="text-[9px] text-emerald-400">✓</span>
            ) : (
              <svg viewBox="0 0 18 18" className="h-3 w-3 text-muted-foreground" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M5.5 3A1.5 1.5 0 0 0 4 4.5v8A1.5 1.5 0 0 0 5.5 14h5a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06L8.94 3.94A1.5 1.5 0 0 0 7.879 3.5H5.5Zm7 2A1.5 1.5 0 0 1 14 6.5v6a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 6 12.5v-8A1.5 1.5 0 0 1 7.5 3h.379a1.5 1.5 0 0 1 1.06.44l2.622 2.621A1.5 1.5 0 0 1 12 7.121V5Z" />
              </svg>
            )}
          </button>
        )}
      </span>
      <span className="text-muted-foreground">{source}</span>
    </div>
  );
}
