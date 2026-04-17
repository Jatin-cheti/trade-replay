import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, BarChart3, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import AssetAvatar from "@/components/ui/AssetAvatar";

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
  marketCap: number;
  volume: number;
  liquidityScore: number;
  priorityScore: number;
  sector: string;
  source: string;
  popularity: number;
  isSynthetic: boolean;
  price: number;
  change: number;
  changePercent: number;
  // Fundamentals
  pe: number;
  eps: number;
  dividendYield: number;
  netIncome: number;
  revenue: number;
  sharesFloat: number;
  beta: number;
  revenueGrowth: number;
  roe: number;
  logoSource: string;
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

const TABS = ["Overview", "Financials", "News", "Documents", "Technicals", "Forecasts", "Seasonals"] as const;
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
  const { fullSymbol } = useParams<{ fullSymbol: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SymbolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [activeTimePeriod, setActiveTimePeriod] = useState("1d");

  useEffect(() => {
    if (!fullSymbol) return;
    setLoading(true);
    setError(null);
    api.get(`/screener/symbol/${encodeURIComponent(fullSymbol)}`)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err.response?.status === 404 ? "Symbol not found" : "Failed to load symbol"))
      .finally(() => setLoading(false));
  }, [fullSymbol]);

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

  return (
    <div className="min-h-screen bg-background pt-4 pb-20">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">

        {/* ── Breadcrumb (TradingView exact) ────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
          <Link to="/screener" className="hover:text-foreground transition-colors">Markets</Link>
          <span className="text-muted-foreground/40">/</span>
          {detail.country && (
            <>
              <Link to={`/screener?country=${detail.country}`} className="hover:text-foreground transition-colors">
                {countryName}
              </Link>
              <span className="text-muted-foreground/40">/</span>
            </>
          )}
          <Link to={`/screener?type=${detail.type}`} className="hover:text-foreground transition-colors">
            {typeLabel(detail.type)}
          </Link>
          {detail.sector && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <Link to={`/screener?sector=${detail.sector}`} className="hover:text-foreground transition-colors">
                {detail.sector}
              </Link>
            </>
          )}
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium">{detail.symbol}</span>
        </div>

        {/* ── Symbol Header (TradingView exact: logo + name + badges + price) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-start gap-6">
            {/* Large circular logo */}
            <AssetAvatar
              src={detail.iconUrl}
              label={detail.symbol}
              className="h-24 w-24 md:h-28 md:w-28 rounded-full border-2 border-border/20 shadow-lg object-cover shrink-0"
            />
            <div className="flex-1 min-w-0 pt-1">
              {/* Name */}
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">{detail.name}</h1>

              {/* Symbol badge line: RELIANCE · ⊕ NSE ▼ */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm font-semibold text-foreground bg-secondary/50 rounded px-2 py-0.5 border border-border/30">
                  {detail.symbol}
                </span>
                <span className="text-sm text-muted-foreground">&middot;</span>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  {detail.exchange}
                </span>
                {/* Colored action dots */}
                <span className="inline-flex gap-1">
                  <span className="w-5 h-5 rounded-md bg-blue-500/80 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer" title="Add to watchlist">&bull;</span>
                  <span className="w-5 h-5 rounded-md bg-teal-500/80 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer" title="Add to portfolio">+</span>
                </span>
              </div>

              {/* Price line — live data from priceCache */}
              <div className="flex items-baseline gap-3 mb-1">
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
              <p className="text-xs text-muted-foreground">As of today</p>
            </div>
          </div>
        </motion.div>

        {/* ── Tabs (TradingView exact) ──────────────────────────────────── */}
        <div className="flex items-center border-b border-border/30 mb-6 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="symbol-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" transition={{ duration: 0.2 }} />
              )}
            </button>
          ))}
          {/* See on Supercharts — TradingView style right-aligned link */}
          <button
            onClick={() => navigate(`/simulation?symbol=${detail.symbol}`)}
            className="ml-auto flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors whitespace-nowrap px-3"
          >
            <BarChart3 className="w-4 h-4" /> See on Supercharts
          </button>
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

              {/* Chart placeholder */}
              <div
                onClick={() => navigate(`/simulation?symbol=${detail.symbol}`)}
                className="h-80 rounded-xl border border-border/30 bg-secondary/5 flex items-center justify-center cursor-pointer hover:bg-secondary/15 transition-colors group"
              >
                <div className="text-center">
                  <BarChart3 className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3 group-hover:text-primary/50 transition-colors" />
                  <p className="text-muted-foreground text-sm">Click to open interactive chart</p>
                </div>
              </div>

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
                  value={fmt(detail.marketCap, detail.currency)}
                  clickable
                />
                <KeyStat label="Dividend yield (indicated)" value={detail.dividendYield > 0 ? `${detail.dividendYield.toFixed(2)}%` : "\u2014"} clickable />
                <KeyStat label="Price to earnings Ratio (TTM)" value={detail.pe > 0 ? detail.pe.toFixed(2) : "\u2014"} clickable />
                <KeyStat label="Basic EPS (TTM)" value={detail.eps > 0 ? detail.eps.toFixed(2) : "\u2014"} />
                <KeyStat label="Net income (FY)" value={fmt(detail.netIncome, detail.currency)} clickable />
                <KeyStat label="Revenue (FY)" value={fmt(detail.revenue, detail.currency)} clickable />
                <KeyStat label="Shares float" value={fmt(detail.sharesFloat)} clickable />
                <KeyStat label="Beta (1Y)" value={detail.beta > 0 ? detail.beta.toFixed(2) : "\u2014"} />
              </div>
            </div>

            {/* ── About Section (TradingView exact) ──────────────────────── */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-foreground mb-5">About {detail.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-6">
                {detail.sector && (
                  <AboutItem label="Sector">
                    <Link to={`/screener?sector=${detail.sector}`}
                      className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1">
                      {detail.sector} <ChevronRight className="w-3 h-3" />
                    </Link>
                  </AboutItem>
                )}
                <AboutItem label="Country">
                  <Link to={`/screener?country=${detail.country}`}
                    className="text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1">
                    {FLAG[detail.country] || ""} {countryName}
                  </Link>
                </AboutItem>
                <AboutItem label="Exchange">
                  <Link to={`/screener?exchange=${detail.exchange}`}
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
                  <Link to={`/screener?type=${detail.type}`}
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
                to={`/screener?type=${detail.type}`}
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
