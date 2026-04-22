import { useState, useEffect, useMemo, useCallback, useRef, useId, lazy, Suspense } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink, BarChart3, ChevronRight, ChevronDown, Copy,
  Search, X, AreaChart, LineChart, CandlestickChart, TrendingUp,
  TrendingDown, Calendar, Plus, BookmarkPlus,
  Building2, Globe, Hash, Info, Tag, Briefcase, MapPin, DollarSign,
  Users, Layers, Activity, Target, Award, Code2,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/numberFormat";
import AssetAvatar from "@/components/ui/AssetAvatar";
import HelpTooltip from "@/components/ui/HelpTooltip";
import SymbolMiniTradingChart from "@/components/chart/SymbolMiniTradingChart";
import StickySymbolHeader from "@/components/symbol/StickySymbolHeader";
import { useSavedPeriods } from "@/components/symbol/useSavedPeriods";
import { useUserList } from "@/hooks/useUserList";
import { toast } from "@/hooks/use-toast";
import MarketClosedIcon from "@/components/symbol/MarketClosedIcon";
import PrimaryListingIcon from "@/components/symbol/PrimaryListingIcon";

// On-demand components — lazy-loaded to reduce initial bundle
const SnapshotMenu = lazy(() => import("@/components/symbol/SnapshotMenu"));
const CustomRangePicker = lazy(() => import("@/components/symbol/CustomRangePicker"));
const SavedPeriodsMenu = lazy(() => import("@/components/symbol/SavedPeriodsMenu"));
import type { CustomRange } from "@/components/symbol/CustomRangePicker";
import axios from "axios";
import type { CandleData } from "@/data/stockData";
import { chartTypeGroups, chartTypeLabels, type ChartType } from "@/services/chart/dataTransforms";
import { useAllPeriodReturns } from "@/hooks/useAllPeriodReturns";

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
  relVolume: number | null;
  epsDilTtm: number | null;
  epsDilGrowth: number | null;
  divYieldPercent: number | null;
  perfPercent: number;
  peg: number | null;
  recentEarningsDate: string;
  upcomingEarningsDate: string;
  marketClass: "cex" | "dex";
  // Extended fields (may be absent depending on data source)
  industry?: string;
  ceo?: string;
  headquarters?: string;
  founded?: string;
  ipoDate?: string;
  isin?: string;
  cfiCode?: string;
  earningsReportPeriod?: string;
  epsEstimate?: number | null;
  revenueEstimate?: number | null;
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

function splitIdentifiers(raw?: string): string[] {
  if (!raw) return [];
  return Array.from(new Set(raw.split(/[\s,;|]+/).map((v) => v.trim()).filter(Boolean)));
}

function deriveEarningsPeriod(isoDate?: string): string {
  if (!isoDate) return "—";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "—";
  const q = Math.floor(parsed.getUTCMonth() / 3) + 1;
  return `Q${q} ${parsed.getUTCFullYear()}`;
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
type Tab = (typeof TABS)[number];

function getTabSlug(tab: string): string {
  return tab.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Bar-count targets match TradingView's resolution choices for each period
// on NSE (session 09:15–15:30 = 375 min/day, ~252 trading days/year).
const TIME_PERIODS = [
  { label: "1 day",        key: "1d",  limit: 375  }, // 1m  bars × ~375/session
  { label: "5 days",       key: "5d",  limit: 375  }, // 15m bars × 75/day × 5 days
  { label: "1 month",      key: "1m",  limit: 300  }, // 30m bars × ~12/day × 22 days
  { label: "3 months",     key: "3m",  limit: 65   }, // daily bars × ~65 trading days
  { label: "6 months",     key: "6m",  limit: 130  }, // daily bars × ~130 trading days
  { label: "Year to date", key: "ytd", limit: 252  }, // daily bars (Jan 1 → now)
  { label: "1 year",       key: "1y",  limit: 52   }, // weekly bars × 52
  { label: "5 years",      key: "5y",  limit: 260  }, // weekly bars × 5 × 52
  { label: "10 years",     key: "10y", limit: 520  }, // weekly bars × 10 × 52
  { label: "All time",     key: "all", limit: 240  }, // monthly bars ~20 years
] as const;

// Axios instance using a relative baseURL so requests route via the Vite proxy
// in development and through the Vercel rewrite in production.
const chartCandlesAxios = axios.create({ baseURL: "/api" });

/** Returns the most recent NSE trading day's 09:15 IST open (as UTC seconds).
 *  If the current UTC time is before today's 03:45 UTC (09:15 IST), steps back
 *  to the previous weekday so fromSec is always in the past. */
function getNseDayOpen(daysBack = 0): number {
  const IST_OPEN_UTC_H = 3, IST_OPEN_UTC_M = 45; // 09:15 IST = 03:45 UTC
  const now = Date.now();
  let d = new Date(now);
  d.setUTCHours(IST_OPEN_UTC_H, IST_OPEN_UTC_M, 0, 0);
  let candidate = Math.floor(d.getTime() / 1000);
  // If today's open is in the future, shift back 1 day
  if (candidate > Math.floor(now / 1000)) candidate -= 86400;
  candidate -= daysBack * 86400;
  // Skip backwards over weekends
  let probe = new Date(candidate * 1000);
  while (probe.getUTCDay() === 0 || probe.getUTCDay() === 6) {
    candidate -= 86400;
    probe = new Date(candidate * 1000);
  }
  return candidate;
}

// Per-period resolution + time-range config for real Yahoo Finance candles.
// Resolution codes: "1"=1m, "15"=15m, "30"=30m, "D"=1d, "W"=1wk, "M"=1mo
const PERIOD_CANDLE_PARAMS: Record<string, { resolution: string; fromSec: () => number; toSec: () => number }> = {
  "1d":  { resolution: "1",  fromSec: () => getNseDayOpen(0),                                                    toSec: () => Math.floor(Date.now() / 1000) },
  "5d":  { resolution: "15", fromSec: () => Math.floor(Date.now() / 1000) - 8   * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "1m":  { resolution: "30", fromSec: () => Math.floor(Date.now() / 1000) - 35  * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "3m":  { resolution: "D",  fromSec: () => Math.floor(Date.now() / 1000) - 95  * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "6m":  { resolution: "D",  fromSec: () => Math.floor(Date.now() / 1000) - 190 * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "ytd": { resolution: "D",  fromSec: () => Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000), toSec: () => Math.floor(Date.now() / 1000) },
  "1y":  { resolution: "W",  fromSec: () => Math.floor(Date.now() / 1000) - 370 * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "5y":  { resolution: "W",  fromSec: () => Math.floor(Date.now() / 1000) - 1850 * 86400,                       toSec: () => Math.floor(Date.now() / 1000) },
  "10y": { resolution: "W",  fromSec: () => Math.floor(Date.now() / 1000) - 3700 * 86400,                       toSec: () => Math.floor(Date.now() / 1000) },
  "all": { resolution: "M",  fromSec: () => 946684800,                                                           toSec: () => Math.floor(Date.now() / 1000) },
};

// OHLC chart types need wider bar intervals so candles have enough pixel width to render clearly.
// (375 × 1m bars at 1200px = 3.2px/candle → illegible; 75 × 5m bars = 16px/candle → perfect)
const OHLC_FAMILY = new Set<ChartType>(['candlestick', 'bar', 'ohlc', 'heikinAshi', 'hollowCandles', 'renko', 'rangeBars', 'lineBreak', 'kagi', 'pointFigure', 'brick']);

// Wider-interval resolution table for OHLC-family charts.
// Intraday periods (1d/5d/1m) use 5m / 30m / 1h instead of 1m / 15m / 30m.
// Daily+ periods are identical to the line table.
const PERIOD_CANDLE_PARAMS_OHLC: Record<string, { resolution: string; fromSec: () => number; toSec: () => number }> = {
  "1d":  { resolution: "5",  fromSec: () => getNseDayOpen(0),                                                    toSec: () => Math.floor(Date.now() / 1000) },
  "5d":  { resolution: "30", fromSec: () => Math.floor(Date.now() / 1000) - 8   * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "1m":  { resolution: "60", fromSec: () => Math.floor(Date.now() / 1000) - 35  * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "3m":  { resolution: "D",  fromSec: () => Math.floor(Date.now() / 1000) - 95  * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "6m":  { resolution: "D",  fromSec: () => Math.floor(Date.now() / 1000) - 190 * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "ytd": { resolution: "D",  fromSec: () => Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000), toSec: () => Math.floor(Date.now() / 1000) },
  "1y":  { resolution: "W",  fromSec: () => Math.floor(Date.now() / 1000) - 370 * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "5y":  { resolution: "W",  fromSec: () => Math.floor(Date.now() / 1000) - 1850 * 86400,                       toSec: () => Math.floor(Date.now() / 1000) },
  "10y": { resolution: "W",  fromSec: () => Math.floor(Date.now() / 1000) - 3700 * 86400,                       toSec: () => Math.floor(Date.now() / 1000) },
  "all": { resolution: "M",  fromSec: () => 946684800,                                                           toSec: () => Math.floor(Date.now() / 1000) },
};

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

/* ── Sub-components ─────────────────────────────────────────────────────── */

interface KeyStatProps { label: string; value: string; tooltip?: string; accent?: boolean; }
function KeyStatCard({ label, value, tooltip, accent }: KeyStatProps) {
  return (
    <div className="group rounded-xl border border-border/30 bg-card/50 hover:bg-card/80 hover:border-border/60 p-4 transition-all duration-200 hover:shadow-md">
      <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
        {label}
        {tooltip && <HelpTooltip content={tooltip} />}
      </p>
      <p className={`text-base font-bold tabular-nums leading-none ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function AboutRow({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-border/20 last:border-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
        {label}{tooltip && <HelpTooltip content={tooltip} />}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function EarningsCard({ label, value, icon: Icon, accent, tooltip }: {
  label: string; value: string; icon?: typeof Calendar; accent?: boolean; tooltip?: string;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/60 p-4 hover:border-border/60 hover:bg-card/90 transition-all">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className={`mt-0.5 shrink-0 rounded-lg p-2 ${accent ? "bg-primary/10 text-primary" : "bg-secondary/60 text-muted-foreground"}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            {label}{tooltip && <HelpTooltip content={tooltip} />}
          </p>
          <p className={`text-sm font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function FaqItemNew({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const answerId = `faq-answer-${uid.replace(/:/g, "")}`;
  return (
    <div className="border border-border/30 rounded-xl overflow-hidden bg-card/30 hover:bg-card/50 transition-colors">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={answerId}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-foreground text-left">
        {q}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <p id={answerId} className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/20 pt-3">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */
export default function SymbolPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SymbolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [activeTimePeriod, setActiveTimePeriod] = useState("1d");
  const [overviewChartType, setOverviewChartType] = useState<ChartType>("area");
  const [chartTypeOpen, setChartTypeOpen] = useState(false);

  // Custom range + saved periods state
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSavedPeriodId, setActiveSavedPeriodId] = useState<string | undefined>();
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [saveNameError, setSaveNameError] = useState("");
  const { periods, create: createPeriod, update: updatePeriod, remove: removePeriod, isDuplicateName } = useSavedPeriods();

  // Symbol picker state
  const [symPickerOpen, setSymPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"stocks" | "futures" | CryptoTab>("stocks");
  const [pickerSearch, setPickerSearch] = useState("");
  const [copiedIsin, setCopiedIsin] = useState<string | null>(null);

  const watchlist = useUserList("watchlist");
  const portfolioList = useUserList("portfolio");

  // Refs
  const heroRef          = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pickerRef        = useRef<HTMLDivElement>(null);
  const chartTypeRef     = useRef<HTMLDivElement>(null);
  const tabRefs          = useRef<Array<HTMLButtonElement | null>>([]);
  const copiedIsinTimerRef = useRef<number | null>(null);
  const savePromptTitleId = useId().replace(/:/g, "");

  // Chart candle data
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(false);
  // Resolution used for the most recently loaded candles (needed for IST-offset logic).
  const [candleResolution, setCandleResolution] = useState<string>("1");
  // Tracks whether the current chart type is in the OHLC family (candlestick/bar/ohlc/…).
  // Stored in a ref so loadChartCandles can read the live value without being re-memoized.
  const isOhlcFamilyRef = useRef(false);
  // Used to detect family transitions and trigger a reload (line ↔ OHLC).
  const prevChartFamilyRef = useRef<'line' | 'ohlc'>('line');

  // Per-period performance % — fetched via useAllPeriodReturns (real Yahoo Finance data).
  const { returns: perfByPeriod } = useAllPeriodReturns(
    detail?.symbol,
    detail?.exchange,
    detail?.price,
  );

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    api.get(`/screener/symbol/${encodeURIComponent(symbol)}`)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err.response?.status === 404 ? "Symbol not found" : "Failed to load symbol"))
      .finally(() => setLoading(false));
  }, [symbol]);

  // Fetch real historical candles from /api/candles (Yahoo Finance) for a given period.
  // Old candles are intentionally kept visible until new data arrives (no flash).
  const loadChartCandles = useCallback((periodKey: string) => {
    if (!detail?.symbol) return;
    // Pick the correct resolution table based on current chart type family.
    const paramsTable = isOhlcFamilyRef.current ? PERIOD_CANDLE_PARAMS_OHLC : PERIOD_CANDLE_PARAMS;
    const params = paramsTable[periodKey] ?? PERIOD_CANDLE_PARAMS["1d"];
    const exchangeParam = detail.exchange ? `&exchange=${encodeURIComponent(detail.exchange)}` : "";
    setChartError(false);
    setCandleResolution(params.resolution);
    chartCandlesAxios
      .get<{ candles: CandleData[] }>(
        `/candles/${encodeURIComponent(detail.symbol)}?resolution=${params.resolution}&from=${params.fromSec()}&to=${params.toSec()}${exchangeParam}`
      )
      .then((res) => {
        const c = res.data?.candles;
        if (c?.length) setCandles(c);
        else setChartError(true);
      })
      .catch(() => setChartError(true));
  }, [detail?.symbol, detail?.exchange]);

  // Load on symbol/exchange change
  useEffect(() => {
    loadChartCandles(activeTimePeriod);
  }, [loadChartCandles]); // loadChartCandles changes when symbol/exchange changes

  // Live polling: refresh every 30 s while the tab is visible
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (!activeTimePeriod) return; // custom range active — don't clobber it
      loadChartCandles(activeTimePeriod);
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [activeTimePeriod, loadChartCandles]);

  // Reload candles when the user switches between line-type and OHLC-type chart families,
  // because the bar interval must change (area can use 1m; candlestick needs 5m for 1D).
  useEffect(() => {
    const family: 'line' | 'ohlc' = OHLC_FAMILY.has(overviewChartType) ? 'ohlc' : 'line';
    isOhlcFamilyRef.current = family === 'ohlc';
    if (prevChartFamilyRef.current === family) return; // no family change
    prevChartFamilyRef.current = family;
    if (customRange) {
      handleCustomRangeApply(customRange);
    } else if (activeTimePeriod) {
      loadChartCandles(activeTimePeriod);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewChartType]);

  const handleTimePeriodChange = useCallback((key: string) => {
    setActiveTimePeriod(key);
    setCustomRange(null);
    setActiveSavedPeriodId(undefined);
    loadChartCandles(key);
  }, [loadChartCandles]);

  const handleCustomRangeApply = useCallback((range: CustomRange) => {
    setCustomRange(range);
    setActiveTimePeriod("");
    setActiveSavedPeriodId(undefined);
    if (!detail?.symbol) return;
    const from = Math.floor(range.from.getTime() / 1000);
    const to   = Math.floor(range.to.getTime()   / 1000);
    const days = (to - from) / 86400;
    const isOhlc = isOhlcFamilyRef.current;

    // OHLC charts need wider bars: use 5m/30m/1h instead of 1m/15m/30m for intraday spans.
    let resolution: string;
    if (isOhlc) {
      if      (days <= 2)   resolution = "5";   // 5m bars ≤2d → ~75 candles/session
      else if (days <= 7)   resolution = "30";  // 30m bars ≤7d → ~60 candles/session
      else if (days <= 35)  resolution = "60";  // 1h bars  ≤35d → ~130 candles
      else if (days <= 400) resolution = "D";
      else                  resolution = "W";
    } else {
      if      (days <= 2)   resolution = "1";   // 1m bars for ≤2 days
      else if (days <= 7)   resolution = "15";  // 15m bars for ≤7 days
      else if (days <= 35)  resolution = "30";  // 30m bars for ≤35 days
      else if (days <= 400) resolution = "D";   // daily bars for ≤1 year
      else                  resolution = "W";   // weekly bars for >1 year
    }

    const exchangeParam = detail.exchange ? `&exchange=${encodeURIComponent(detail.exchange)}` : "";
    setChartError(false);
    setCandleResolution(resolution);
    chartCandlesAxios
      .get<{ candles: CandleData[] }>(
        `/candles/${encodeURIComponent(detail.symbol)}?resolution=${resolution}&from=${from}&to=${to}${exchangeParam}`
      )
      .then((res) => {
        const c = res.data?.candles;
        if (c?.length) setCandles(c);
        else setChartError(true);
      })
      .catch(() => setChartError(true));
  }, [detail?.symbol, detail?.exchange]);

  // Candles for the chart.
  // For custom range: filter by the selected date window, then apply IST offset for intraday.
  // For preset intraday periods (1d, 5d, 1m with 30m bars): add IST offset (19 800 s) so the
  //   chart's x-axis displays IST local times (Yahoo Finance serves UTC epochs).
  // For daily/weekly/monthly periods: use timestamps as-is.
  const displayCandles = useMemo(() => {
    if (!candles.length) return candles;
    const IST_OFFSET_SEC = 19800; // 5h30m
    // Intraday resolutions that need the IST fake-UTC trick (includes 1h = "60")
    const INTRADAY = new Set(["1", "2", "5", "15", "30", "60"]);
    const isIntraday = INTRADAY.has(candleResolution);

    if (customRange) {
      const from = customRange.from.getTime();
      const to   = customRange.to.getTime();
      let filtered = candles.filter((c) => {
        const t  = typeof c.time === "number" ? c.time : Number(c.time);
        const ms = t < 1e11 ? t * 1000 : t;
        return Number.isFinite(ms) && ms >= from && ms <= to;
      });
      if (!filtered.length) filtered = candles;
      if (isIntraday) {
        return filtered.map((c) => ({ ...c, time: String((c.time as number) + IST_OFFSET_SEC) }));
      }
      return filtered;
    }

    if (isIntraday) {
      return candles.map((c) => ({
        ...c,
        time: String((c.time as number) + IST_OFFSET_SEC),
      }));
    }

    return candles;
  }, [candles, customRange, candleResolution]);

  // Previous-close reference line value.
  //   1D + line/area type : API-reported yesterday's close (most accurate).
  //   Multi-day + line/area: first bar's close = "period start" reference.
  //   OHLC chart types    : null — the open is already visible inside each candle.
  const prevCloseValue = useMemo(() => {
    if (!detail) return null;
    if (OHLC_FAMILY.has(overviewChartType)) return null; // candles encode their own open
    if (activeTimePeriod === "1d" && !customRange) {
      if (typeof detail.price === "number" && typeof detail.change === "number" && detail.change !== 0) {
        return detail.price - detail.change;
      }
    }
    // All other periods: use the close of the first loaded bar as the period-start reference.
    return displayCandles.length > 1 ? (displayCandles[0].close ?? null) : null;
  }, [detail, overviewChartType, activeTimePeriod, customRange, displayCandles]);

  // Close symbol picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setSymPickerOpen(false);
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

  useEffect(() => {
    return () => {
      if (copiedIsinTimerRef.current !== null) {
        window.clearTimeout(copiedIsinTimerRef.current);
      }
    };
  }, []);

  // Escape to close save-prompt modal
  useEffect(() => {
    if (!showSavePrompt) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSavePrompt(false);
        setSaveNameInput("");
        setSaveNameError("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showSavePrompt]);

  const copyToClipboard = useCallback((text: string) => {
    const doCopy = (t: string) => {
      setCopiedIsin(t);
      if (copiedIsinTimerRef.current !== null) {
        window.clearTimeout(copiedIsinTimerRef.current);
      }
      copiedIsinTimerRef.current = window.setTimeout(() => setCopiedIsin(null), 2000);
      toast({ title: "ISIN copied", duration: 1800 });
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

  const showActionToast = useCallback((msg: string, isError = false) => {
    toast({
      title: msg,
      variant: isError ? "destructive" : "default",
      duration: 2400,
    });
  }, []);

  const copyWithFeedback = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showActionToast(`${label} copied`);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showActionToast(`${label} copied`);
    }
  }, [showActionToast]);

  const handleMainTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const lastIndex = TABS.length - 1;
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;

    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab);
    tabRefs.current[nextIndex]?.focus();
  }, []);

  // Performance percentage for time period chips (computed from candle data when available)
  // NOTE: must be before early returns to satisfy React's rules of hooks
  const perfPercent = useMemo(() => {
    const src = customRange ? displayCandles : candles;
    if (!detail || !src.length) return detail?.changePercent ?? 0;
    const first = src[0]?.close;
    const last = src[src.length - 1]?.close;
    if (first && last && first > 0) return ((last - first) / first) * 100;
    return detail?.changePercent ?? 0;
  }, [detail, candles, displayCandles, customRange]);

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
  const symbolLookupKey = detail.fullSymbol || detail.symbol;
  const isInWatchlist = watchlist.has(symbolLookupKey);
  const isInPortfolio = portfolioList.has(symbolLookupKey);
  const isinValues = splitIdentifiers(detail.isin);
  const cfiValues = splitIdentifiers(detail.cfiCode);
  const earningsPeriod = detail.earningsReportPeriod || deriveEarningsPeriod(detail.upcomingEarningsDate || detail.recentEarningsDate);

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
      <StickySymbolHeader
        symbol={detail.symbol}
        name={detail.name}
        exchange={detail.exchange}
        price={detail.price}
        change={detail.change}
        changePercent={detail.changePercent}
        currency={detail.currency}
        iconUrl={detail.iconUrl}
        activeTab={activeTab}
        tabs={[...TABS]}
        onTabChange={(t) => setActiveTab(t as Tab)}
        onFullChart={() => navigate(simulationHref)}
        heroRef={heroRef}
      />
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10">

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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6" ref={heroRef}>
          <div className="flex items-start gap-5">
            {/* Large circular logo */}
            <AssetAvatar
              src={detail.iconUrl}
              label={detail.symbol}
              className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-full border-2 border-border/20 shadow-lg object-cover shrink-0"
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
                  <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    {/* Market status icon — static span outside picker button to avoid nested <button> */}
                    <span
                      aria-label="Market closed"
                      title="Market closed"
                      className="inline-flex items-center"
                    >
                      <MarketClosedIcon className="h-3.5 w-3.5 text-red-400/80" />
                    </span>
                    {/* Exchange picker button */}
                    <button
                      type="button"
                      onClick={() => setSymPickerOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <span className="font-medium">{detail.exchange}</span>
                      {detail.isPrimaryListing && (
                        <span aria-label="Primary listing" title="Primary listing" className="inline-flex items-center">
                          <PrimaryListingIcon className="h-4 w-4 text-amber-400" title="Primary listing" />
                        </span>
                      )}
                      <ChevronDown className={`h-3 w-3 transition-transform ${symPickerOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {/* Symbol Picker Dropdown */}
                  <AnimatePresence>
                    {symPickerOpen && (
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

                {/* Watchlist / portfolio action buttons */}
                <span className="inline-flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const added = watchlist.toggle({
                        symbol: detail.symbol,
                        fullSymbol: symbolLookupKey,
                        name: detail.name,
                        exchange: detail.exchange,
                        currency: detail.currency,
                      });
                      showActionToast(`${detail.symbol} ${added ? "added to" : "removed from"} watchlist`);
                    }}
                    className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
                      isInWatchlist
                        ? "bg-blue-500/25 border-blue-500/40 text-blue-300"
                        : "bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
                    }`}
                    title={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                    aria-label={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                    aria-pressed={isInWatchlist}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const added = portfolioList.toggle({
                        symbol: detail.symbol,
                        fullSymbol: symbolLookupKey,
                        name: detail.name,
                        exchange: detail.exchange,
                        currency: detail.currency,
                      });
                      showActionToast(`${detail.symbol} ${added ? "added to" : "removed from"} portfolio`);
                    }}
                    className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
                      isInPortfolio
                        ? "bg-teal-500/25 border-teal-500/40 text-teal-200"
                        : "bg-teal-500/15 border-teal-500/30 text-teal-400 hover:bg-teal-500/25"
                    }`}
                    title={isInPortfolio ? "Remove from portfolio" : "Add to portfolio"}
                    aria-label={isInPortfolio ? "Remove from portfolio" : "Add to portfolio"}
                    aria-pressed={isInPortfolio}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </span>
              </div>

              {/* Price line — live data */}
              <div className="flex items-baseline gap-3 mb-0.5">
                <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tabular-nums">
                  {detail.price > 0 ? formatPrice(detail.price) : "\u2014"}
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
          <div className="flex items-center gap-0.5" role="tablist" aria-label="Symbol sections">
            {TABS.map((tab, index) => {
              const tabSlug = getTabSlug(tab);
              const selected = activeTab === tab;
              return (
              <button
                key={tab}
                ref={(node) => { tabRefs.current[index] = node; }}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(event) => handleMainTabKeyDown(event, index)}
                role="tab"
                id={`symbol-tab-${tabSlug}`}
                aria-controls={`symbol-panel-${tabSlug}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={`relative px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {selected && (
                  <motion.div layoutId="symbol-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" transition={{ type: "spring", stiffness: 450, damping: 30 }} />
                )}
              </button>
            );})}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="tabpanel"
            id="symbol-panel-overview"
            aria-labelledby="symbol-tab-overview"
          >
            {/* ── Chart Section ──────────────────────────────────────────── */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors">
                  Chart <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <span className="ml-1.5 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    LIVE
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  {/* Chart type dropdown */}
                  <div className="relative" ref={chartTypeRef}>
                    <button
                      onClick={() => setChartTypeOpen((v) => !v)}
                      className="flex items-center gap-1.5 h-8 rounded-md border border-border/40 px-2.5 text-xs font-medium text-foreground hover:bg-secondary/30 transition-colors"
                      title="Chart type"
                      aria-label="Change chart type"
                      aria-haspopup="listbox"
                      aria-expanded={chartTypeOpen}
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

                  {/* Code embed */}
                  <button
                    type="button"
                    className="h-8 w-8 rounded-md border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
                    onClick={() => {
                      const embed = `<iframe src="${window.location.href}" style="width:100%;height:520px;border:0;border-radius:12px;" loading="lazy"></iframe>`;
                      copyWithFeedback(embed, "Embed code");
                    }}
                    title="Copy embed code"
                    aria-label="Copy embed code"
                  >
                    <svg viewBox="0 0 18 18" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <polyline points="5,4 1,9 5,14" /><polyline points="13,4 17,9 13,14" />
                    </svg>
                  </button>
                  <Suspense fallback={null}>
                  <SnapshotMenu
                    chartContainerRef={chartContainerRef}
                    symbol={detail.symbol}
                    symbolName={detail.name}
                    price={detail.price}
                    currency={detail.currency}
                  />
                  </Suspense>
                  {/* Full chart button — matches image5 */}
                  <button
                    onClick={() => navigate(simulationHref)}
                    className="flex items-center gap-1.5 h-8 rounded-md border border-border/50 bg-secondary/30 px-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Full chart
                  </button>
                </div>
              </div>

              {/* Chart — overview area chart.
                  The chart is rendered whenever we have candles (even stale ones during a reload).
                  We never show a loading spinner here — old data stays visible until new data
                  arrives, eliminating the flash / page-shake on period switches. */}
              {chartError && displayCandles.length === 0 ? (
                <div ref={chartContainerRef} style={{ height: "clamp(380px, 58vh, 680px)" }} className="w-full rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm mb-2">Failed to load chart data</p>
                    <button
                      onClick={() => loadChartCandles(activeTimePeriod)}
                      className="text-xs text-primary hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : displayCandles.length > 0 ? (
                <div ref={chartContainerRef} style={{ height: "clamp(380px, 58vh, 680px)" }} className="w-full rounded-xl border border-border/30 bg-background/40 overflow-hidden">
                  <SymbolMiniTradingChart
                    data={displayCandles}
                    height="100%"
                    chartType={overviewChartType}
                    prevClose={prevCloseValue}
                    periodReturn={perfPercent}
                    timePeriod={activeTimePeriod}
                  />
                </div>
              ) : (
                <div
                  onClick={() => navigate(simulationHref)}
                  ref={chartContainerRef}
                  style={{ height: "clamp(380px, 58vh, 680px)" }}
                  className="w-full rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center cursor-pointer hover:bg-secondary/15 transition-colors group"
                >
                  <div className="text-center">
                    <BarChart3 className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3 group-hover:text-primary/50 transition-colors" />
                    <p className="text-muted-foreground text-sm">Click to open interactive chart</p>
                  </div>
                </div>
              )}

              {/* Time period chips — active custom range shows as first chip */}
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {/* Active custom period chip — shown BEFORE predefined periods */}
                  {customRange && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      title="Click to edit custom range"
                      className="flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-w-[90px] bg-primary/10 text-foreground border-2 border-primary shrink-0"
                    >
                      <span className="font-semibold text-[11px] leading-tight">
                        {format(customRange.from, "MMM d")} – {format(customRange.to, "MMM d, yy")}
                      </span>
                      <span className={`text-[10px] tabular-nums mt-0.5 ${perfPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {perfPercent >= 0 ? "+" : ""}{perfPercent.toFixed(2)}%
                      </span>
                    </button>
                  )}
                {TIME_PERIODS.map((p) => {
                  // All chips use real period returns from useAllPeriodReturns (Yahoo Finance data).
                  const pctValue = perfByPeriod[p.key];
                  const hasPct = pctValue != null && Number.isFinite(pctValue);
                  const pctColor = hasPct
                    ? pctValue >= 0
                      ? "text-emerald-500"
                      : "text-red-500"
                    : "";
                  return (
                    <button
                      key={p.key}
                      data-period={p.key}
                      onClick={() => handleTimePeriodChange(p.key)}
                      className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-w-[80px] ${
                        activeTimePeriod === p.key && !customRange
                          ? "bg-primary/10 text-foreground border-2 border-primary"
                          : "border-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"
                      }`}
                    >
                      <span className={activeTimePeriod === p.key && !customRange ? "text-foreground font-semibold" : ""}>{p.label}</span>
                      {hasPct ? (
                        <span data-percent className={`text-[10px] tabular-nums mt-0.5 ${pctColor}`}>
                          {pctValue >= 0 ? "+" : ""}{(pctValue as number).toFixed(2)}%
                        </span>
                      ) : (
                        <span data-percent className="text-[10px] tabular-nums mt-0.5 text-muted-foreground/40">
                          &nbsp;
                        </span>
                      )}
                    </button>
                  );
                })}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="h-9 shrink-0 rounded-lg border border-border/40 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/20 transition-colors whitespace-nowrap"
                  >
                    {customRange ? "Edit range" : "Custom period"}
                  </button>
                  {customRange && (
                    <button
                      type="button"
                      onClick={() => {
                        const fallback = "1d";
                        setCustomRange(null);
                        setActiveSavedPeriodId(undefined);
                        setActiveTimePeriod(fallback);
                        loadChartCandles(fallback);
                      }}
                      title="Clear custom range"
                      className="h-9 shrink-0 rounded-lg border border-border/30 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/20 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                  <Suspense fallback={null}>
                  <SavedPeriodsMenu
                    periods={periods}
                    activePeriodId={activeSavedPeriodId}
                    onSelect={(period) => {
                      setActiveSavedPeriodId(period.id);
                      setActiveTimePeriod("");
                      setCustomRange(period.range);
                      handleCustomRangeApply(period.range);
                    }}
                    onOpenCustom={() => setPickerOpen(true)}
                    onEdit={(id, name) => {
                      updatePeriod(id, { name });
                    }}
                    onDelete={(id) => {
                      removePeriod(id);
                      if (activeSavedPeriodId === id) {
                        setActiveSavedPeriodId(undefined);
                        setCustomRange(null);
                      }
                    }}
                  />
                  </Suspense>
                </div>
                {customRange && (
                  <div className="text-xs text-muted-foreground">
                    Showing: <span className="text-foreground font-medium">{format(customRange.from, "MMM d, yyyy HH:mm")}</span> to <span className="text-foreground font-medium">{format(customRange.to, "MMM d, yyyy HH:mm")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Key Stats (TradingView exact: 4-column grid) ───────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-1">
                Key stats <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KeyStatCard
                  label="Market capitalization"
                  value={fmt(detail.marketCap || 0, detail.currency)}
                  tooltip="Total market value of all outstanding shares"
                  accent
                />
                <KeyStatCard label="P/E ratio (TTM)" value={detail.pe && detail.pe > 0 ? detail.pe.toFixed(2) : "—"} tooltip="Price to earnings ratio over trailing twelve months" />
                <KeyStatCard label="Revenue (FY)" value={fmt(detail.revenue || 0, detail.currency)} tooltip="Total revenue in the latest fiscal year" />
                <KeyStatCard label="Net income (FY)" value={fmt(detail.netIncome || 0, detail.currency)} tooltip="Net profit in the latest fiscal year" />
                <KeyStatCard label="Basic EPS (TTM)" value={detail.eps && detail.eps > 0 ? detail.eps.toFixed(2) : "—"} tooltip="Earnings per share over trailing twelve months" />
                <KeyStatCard label="Dividend yield" value={detail.dividendYield && detail.dividendYield > 0 ? `${detail.dividendYield.toFixed(2)}%` : "—"} tooltip="Indicated annual dividend yield" />
                <KeyStatCard label="Shares float" value={fmt(detail.sharesFloat || 0)} tooltip="Shares available for public trading" />
                <KeyStatCard label="Beta (1Y)" value={detail.beta && detail.beta > 0 ? detail.beta.toFixed(2) : "—"} tooltip="Volatility relative to the market" />
                <KeyStatCard label="Volume" value={fmt(detail.volume || 0)} tooltip="Current traded volume" />
                <KeyStatCard label="Average volume (30D)" value={fmt(detail.avgVolume || 0)} tooltip="Average daily volume over 30 days" />
                {detail.relVolume != null && detail.relVolume > 0 && <KeyStatCard label="Relative volume" value={detail.relVolume.toFixed(2)} tooltip="Current volume versus average" />}
                {detail.peg != null && detail.peg > 0 && <KeyStatCard label="PEG ratio" value={detail.peg.toFixed(2)} tooltip="P/E ratio divided by earnings growth" />}
                {detail.roe != null && detail.roe !== 0 && <KeyStatCard label="Return on equity" value={`${detail.roe.toFixed(2)}%`} tooltip="Return generated on shareholder equity" />}
                {detail.revenueGrowth != null && detail.revenueGrowth !== 0 && <KeyStatCard label="Revenue growth (YoY)" value={`${detail.revenueGrowth.toFixed(2)}%`} tooltip="Year-over-year revenue growth" />}
              </div>
            </div>

            {/* ── About Section (TradingView exact) ──────────────────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5">About {detail.name}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-border/30 bg-card/50 p-5">
                  <AboutRow label="Sector" tooltip="Primary business sector classification">
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      {detail.sector ? (
                        <Link to={`/screener/${screenerRouteType}?sectors=${encodeURIComponent(detail.sector)}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                          {detail.sector} <ChevronRight className="w-3 h-3" />
                        </Link>
                      ) : "—"}
                    </div>
                  </AboutRow>
                  <AboutRow label="Industry" tooltip="Industry or sub-sector classification">
                    <div className="flex items-center gap-2 text-sm"><Layers className="w-4 h-4 text-muted-foreground" />{detail.industry || "—"}</div>
                  </AboutRow>
                  <AboutRow label="CEO" tooltip="Current chief executive officer">
                    <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-muted-foreground" />{detail.ceo || "—"}</div>
                  </AboutRow>
                  <AboutRow label="Headquarters" tooltip="Primary registered office location">
                    <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" />{detail.headquarters || (countryName || "—")}</div>
                  </AboutRow>
                  <AboutRow label="Founded" tooltip="Company founding year/date">
                    <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-muted-foreground" />{detail.founded || "—"}</div>
                  </AboutRow>
                  <AboutRow label="IPO Date" tooltip="Initial public offering date">
                    <div className="flex items-center gap-2 text-sm"><DollarSign className="w-4 h-4 text-muted-foreground" />{detail.ipoDate || "—"}</div>
                  </AboutRow>
                </div>
                <div className="rounded-2xl border border-border/30 bg-card/50 p-5">
                  <AboutRow label="Country" tooltip="Primary market country">
                    <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-muted-foreground" />{FLAG[detail.country] || ""} {countryName}</div>
                  </AboutRow>
                  <AboutRow label="Exchange" tooltip="Main listing exchange">
                    <div className="flex items-center gap-2 text-sm"><Activity className="w-4 h-4 text-muted-foreground" />
                      <Link to={`/screener/${screenerRouteType}?exchanges=${encodeURIComponent(detail.exchange)}`} className="hover:text-primary transition-colors">{detail.exchange}</Link>
                    </div>
                  </AboutRow>
                  <AboutRow label="Website" tooltip="Official company website">
                    <div className="flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4 text-muted-foreground" />
                      {detail.companyDomain ? (
                        <a href={`https://${detail.companyDomain}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{detail.companyDomain}</a>
                      ) : "—"}
                    </div>
                  </AboutRow>
                  <AboutRow label="ISIN" tooltip="International Securities Identification Number">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      {isinValues.length > 0 ? isinValues.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => copyWithFeedback(value, "ISIN")}
                          className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-secondary/25 px-2 py-0.5 text-xs hover:bg-secondary/45 transition-colors"
                          aria-label={`Copy ISIN ${value}`}
                        >
                          {value}
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )) : "—"}
                    </div>
                  </AboutRow>
                  <AboutRow label="CFI Code" tooltip="Classification of Financial Instruments code">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Code2 className="w-4 h-4 text-muted-foreground" />
                      {cfiValues.length > 0 ? cfiValues.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => copyWithFeedback(value, "CFI code")}
                          className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-secondary/25 px-2 py-0.5 text-xs hover:bg-secondary/45 transition-colors"
                          aria-label={`Copy CFI code ${value}`}
                        >
                          {value}
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )) : "—"}
                    </div>
                  </AboutRow>
                  <AboutRow label="Source" tooltip="Primary data source">
                    <div className="flex items-center gap-2 text-sm"><Info className="w-4 h-4 text-muted-foreground" />{detail.source}</div>
                  </AboutRow>
                </div>
              </div>
            </div>

            {/* ── Upcoming Earnings ────────────────────────────────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-1">
                Earnings <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <EarningsCard
                  label="Next report date"
                  value={detail.upcomingEarningsDate || "—"}
                  icon={Target}
                  accent
                  tooltip="Estimated date of the next earnings release"
                />
                <EarningsCard
                  label="Report period"
                  value={earningsPeriod}
                  icon={Calendar}
                  tooltip="Fiscal quarter associated with this report"
                />
                <EarningsCard
                  label="EPS estimate"
                  value={(detail.epsEstimate ?? detail.eps) != null ? (detail.epsEstimate ?? detail.eps ?? 0).toFixed(2) : "—"}
                  icon={TrendingUp}
                  tooltip="Consensus EPS estimate"
                />
                <EarningsCard
                  label="Revenue estimate"
                  value={(detail.revenueEstimate ?? detail.revenue) != null ? fmt(detail.revenueEstimate ?? detail.revenue ?? 0, detail.currency) : "—"}
                  icon={Award}
                  tooltip="Consensus revenue estimate"
                />
              </div>
            </div>

            {/* ── FAQ Section ───────────────────────────────────────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5">Frequently asked questions</h2>
              <div className="space-y-3">
                {/* 1. Exchange listing */}
                <FaqItemNew
                  q={`Which exchange is ${detail.name} (${detail.symbol}) listed on?`}
                  a={`${detail.name} (${detail.symbol}) is listed on ${detail.exchange ? `the ${detail.exchange} exchange` : "a major stock exchange"}${detail.country ? ` in ${COUNTRY_NAME[detail.country] || detail.country}` : ""}.${detail.isin ? ` Its ISIN is ${detail.isin}.` : ""}`}
                />

                {/* 2. How to replay */}
                <FaqItemNew
                  q={`How can I replay historical price data for ${detail.symbol}?`}
                  a={`Use Trade Replay's Supercharts feature to step through historical candles for ${detail.name} at any pace. Click "Open in Supercharts" on this page or choose a period chip above to analyse price action over different time frames.`}
                />

                {/* 3. Earnings */}
                <FaqItemNew
                  q={`When is ${detail.name}'s next earnings report?`}
                  a={detail.upcomingEarningsDate
                    ? `The next earnings report for ${detail.name} is expected on ${detail.upcomingEarningsDate}${earningsPeriod && earningsPeriod !== "—" ? ` (${earningsPeriod})` : ""}.`
                    : `The next earnings date for ${detail.name} has not been announced yet. Check back closer to the reporting period.`}
                />

                {/* 4. EPS */}
                <FaqItemNew
                  q={`What is the current EPS estimate for ${detail.name}?`}
                  a={(detail.epsEstimate ?? detail.eps) != null && (detail.epsEstimate ?? detail.eps ?? 0) > 0
                    ? `The consensus EPS estimate for ${detail.name} is ${(detail.epsEstimate ?? detail.eps ?? 0).toFixed(2)}${detail.currency ? ` ${detail.currency}` : ""} per share.`
                    : `Analyst EPS estimates for ${detail.name} are not currently available on Trade Replay.`}
                />

                {/* 5. Market cap */}
                <FaqItemNew
                  q={`What is ${detail.name}'s market capitalization?`}
                  a={detail.marketCap != null && detail.marketCap > 0
                    ? `The market capitalization of ${detail.name} is ${fmt(detail.marketCap, detail.currency)}.`
                    : `Market capitalization data for ${detail.name} is not available at this time.`}
                />

                {/* 6. Business */}
                <FaqItemNew
                  q={`What does ${detail.name} do?`}
                  a={`${detail.name} (${detail.symbol}) is a ${typeLabel(detail.type).toLowerCase().replace(/s$/, "")} traded${detail.exchange ? ` on ${detail.exchange}` : ""}${detail.sector ? ` in the ${detail.sector} sector` : ""}${detail.industry ? `, within the ${detail.industry} industry` : ""}. ${detail.ceo ? `The company is led by ${detail.ceo}. ` : ""}${detail.headquarters ? `It is headquartered in ${detail.headquarters}.` : ""}`.trim()}
                />

                {/* 7. Sector */}
                <FaqItemNew
                  q={`Which sector does ${detail.name} belong to?`}
                  a={detail.sector
                    ? `${detail.name} belongs to the ${detail.sector} sector${detail.industry ? `, specifically the ${detail.industry} industry` : ""}.`
                    : `Sector classification for ${detail.name} is not available.`}
                />

                {/* 8. Custom period */}
                <FaqItemNew
                  q={`How do I view the ${detail.symbol} chart for a custom date range?`}
                  a={`Click the chart picker icon next to the period chips above to open the custom range picker. You can select any start and end date (or time for intraday ranges) and save frequently used ranges as presets for quick access later.`}
                />

                {/* 9. Dividend */}
                <FaqItemNew
                  q={`Does ${detail.name} pay dividends?`}
                  a={detail.dividendYield != null && detail.dividendYield > 0
                    ? `Yes. ${detail.name} currently has an indicated annual dividend yield of ${detail.dividendYield.toFixed(2)}%.`
                    : `${detail.name} does not currently pay a dividend, or dividend data is unavailable.`}
                />

                {/* 10. 52-week range / price */}
                <FaqItemNew
                  q={`What is the current price of ${detail.symbol}?`}
                  a={detail.price > 0
                    ? `The last known price of ${detail.name} (${detail.symbol}) is ${formatPrice(detail.price)} ${detail.currency}. It moved ${(detail.changePercent ?? 0) >= 0 ? "+" : ""}${(detail.changePercent ?? 0).toFixed(2)}% in the latest trading session.`
                    : `Live price data for ${detail.symbol} is currently unavailable.`}
                />
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
          <div
            className="py-16 rounded-2xl border border-border/30 bg-card/40 text-center"
            role="tabpanel"
            id={`symbol-panel-${getTabSlug(activeTab)}`}
            aria-labelledby={`symbol-tab-${getTabSlug(activeTab)}`}
          >
            <p className="text-base text-foreground mb-2">{activeTab}</p>
            <p className="text-sm text-muted-foreground mb-4">This data lives in the advanced chart workspace.</p>
            <button
              type="button"
              onClick={() => navigate(simulationHref)}
              className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-4 py-2 text-sm text-foreground hover:bg-secondary/30 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Open in Supercharts
            </button>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
      <CustomRangePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialRange={customRange ?? undefined}
        onApply={(range) => {
          handleCustomRangeApply(range);
          setPickerOpen(false);
          setSaveNameInput("");
          setSaveNameError("");
          setShowSavePrompt(true);
        }}
      />
      </Suspense>

      {showSavePrompt && customRange && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={savePromptTitleId}
            className="w-full max-w-md rounded-2xl border border-border/50 bg-background p-5 shadow-2xl"
          >
            <h3 id={savePromptTitleId} className="text-base font-semibold text-foreground mb-2">Save this custom period?</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {format(customRange.from, "MMM d, yyyy HH:mm")} to {format(customRange.to, "MMM d, yyyy HH:mm")}
            </p>
            <input
              autoFocus
              value={saveNameInput}
              onChange={(e) => {
                setSaveNameInput(e.target.value);
                if (saveNameError) setSaveNameError("");
              }}
              placeholder="Name this period"
              className="w-full h-10 rounded-md border border-border/40 bg-card/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {saveNameError && <p className="mt-2 text-xs text-red-400">{saveNameError}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSavePrompt(false);
                  setSaveNameInput("");
                  setSaveNameError("");
                }}
                className="h-9 rounded-md border border-border/40 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/20"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = saveNameInput.trim();
                  if (!name) {
                    setSaveNameError("Please enter a name.");
                    return;
                  }
                  if (isDuplicateName(name)) {
                    setSaveNameError("A saved period with this name already exists.");
                    return;
                  }
                  const created = createPeriod(name, customRange);
                  if (created) setActiveSavedPeriodId(created.id);
                  setShowSavePrompt(false);
                  setSaveNameInput("");
                  setSaveNameError("");
                }}
                className="h-9 rounded-md bg-primary/90 px-3 text-xs font-medium text-primary-foreground hover:bg-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
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
