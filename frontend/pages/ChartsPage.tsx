import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Maximize2, Minimize2, Search } from "lucide-react";
import { toast } from "sonner";

import TradingChart from "@/components/chart/TradingChart";
import ChartContextMenu from "@/components/chart/ChartContextMenu";
import ChartTimeRangeBar from "@/components/chart/ChartTimeRangeBar";
import ChartSettingsModal from "@/components/chart/ChartSettingsModal";
import ChartAlertModal from "@/components/chart/ChartAlertModal";
import ChartTableViewModal from "@/components/chart/ChartTableViewModal";
import ChartRightMiniStrip from "@/components/chart/ChartRightMiniStrip";
import ChartOhlcLegendOverlay from "@/components/chart/ChartOhlcLegendOverlay";
import AssetAvatar from "@/components/ui/AssetAvatar";
import SymbolSearchModal from "@/components/simulation/SymbolSearchModal";
import type { AssetSearchItem } from "@/lib/assetSearch";
import type { CandleData } from "@/data/stockData";
import { getISTOffsetSeconds } from "@tradereplay/charts";

/* ── Types ──────────────────────────────────────────────────────────── */

interface SymbolDetail {
  symbol: string;
  fullSymbol?: string;
  name: string;
  exchange: string;
  type: string;
  price?: number;
  iconUrl?: string;
  s3Icon?: string;
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
}

/* ── Period → resolution + time-range config (mirrors SymbolPage) ─── */

function getNseDayOpen(daysBack = 0): number {
  const IST_OPEN_UTC_H = 3, IST_OPEN_UTC_M = 45;
  const now = Date.now();
  const d = new Date(now);
  d.setUTCHours(IST_OPEN_UTC_H, IST_OPEN_UTC_M, 0, 0);
  let candidate = Math.floor(d.getTime() / 1000);
  if (candidate > Math.floor(now / 1000)) candidate -= 86400;
  candidate -= daysBack * 86400;
  let probe = new Date(candidate * 1000);
  while (probe.getUTCDay() === 0 || probe.getUTCDay() === 6) {
    candidate -= 86400;
    probe = new Date(candidate * 1000);
  }
  return candidate;
}

const PERIOD_CONFIG: Record<string, { resolution: string; fromSec: () => number; toSec: () => number }> = {
  "1d":  { resolution: "1",   fromSec: () => getNseDayOpen(0),                                                     toSec: () => Math.floor(Date.now() / 1000) },
  "5d":  { resolution: "5",   fromSec: () => Math.floor(Date.now() / 1000) - 8   * 86400,                         toSec: () => Math.floor(Date.now() / 1000) },
  "1m":  { resolution: "30",  fromSec: () => Math.floor(Date.now() / 1000) - 35  * 86400,                         toSec: () => Math.floor(Date.now() / 1000) },
  "3m":  { resolution: "60",  fromSec: () => Math.floor(Date.now() / 1000) - 95  * 86400,                         toSec: () => Math.floor(Date.now() / 1000) },
  "6m":  { resolution: "120", fromSec: () => Math.floor(Date.now() / 1000) - 190 * 86400,                         toSec: () => Math.floor(Date.now() / 1000) },
  "ytd": { resolution: "D",   fromSec: () => Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000), toSec: () => Math.floor(Date.now() / 1000) },
  "1y":  { resolution: "D",   fromSec: () => Math.floor(Date.now() / 1000) - 370 * 86400,                         toSec: () => Math.floor(Date.now() / 1000) },
  "5y":  { resolution: "W",   fromSec: () => Math.floor(Date.now() / 1000) - 1850 * 86400,                        toSec: () => Math.floor(Date.now() / 1000) },
  "all": { resolution: "M",   fromSec: () => 946684800,                                                            toSec: () => Math.floor(Date.now() / 1000) },
};

const INTRADAY_RESOLUTIONS = new Set(["1", "2", "5", "15", "30", "60", "120"]);
const IST_OFFSET_S = getISTOffsetSeconds();
const DEV_SYNTHETIC_FALLBACK = import.meta.env.DEV;

function resolutionToSeconds(resolution: string): number {
  if (resolution === "D") return 86400;
  if (resolution === "W") return 7 * 86400;
  if (resolution === "M") return 30 * 86400;
  const n = Number.parseInt(resolution, 10);
  return Number.isFinite(n) && n > 0 ? n * 60 : 60;
}

function buildSyntheticCandles(resolution: string, toSec: number, basePrice = 100): CandleData[] {
  const intervalSec = resolutionToSeconds(resolution);
  const count = 220;
  const startSec = toSec - intervalSec * (count - 1);
  const out: CandleData[] = [];
  let price = Math.max(1, basePrice);
  for (let i = 0; i < count; i += 1) {
    const t = startSec + i * intervalSec;
    const drift = Math.sin(i / 8) * 0.35 + Math.cos(i / 21) * 0.2;
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + 0.45;
    const low = Math.max(0.5, Math.min(open, close) - 0.45);
    out.push({
      time: String(t),
      open,
      high,
      low,
      close,
      volume: 1000 + (i % 17) * 120,
    });
    price = close;
  }
  return out;
}

function applyIstOffset(candles: CandleData[], resolution: string): CandleData[] {
  if (!INTRADAY_RESOLUTIONS.has(resolution)) return candles;
  return candles.map((c) => ({
    ...c,
    time: String(Number(c.time) + IST_OFFSET_S),
  }));
}

// Access TradingChart's debug API (exposed on window by TradingChart itself)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getChartDebug = (): any => (window as unknown as Record<string, unknown>).__chartDebug;

/* ── Main page component ────────────────────────────────────────────── */

/** Strip exchange prefix like "NSE:RELIANCE" → "RELIANCE", preserving plain symbols */
function stripExchange(raw: string): { bare: string; exchange: string | null } {
  const colonIdx = raw.indexOf(":");
  if (colonIdx < 0) return { bare: raw, exchange: null };
  return { bare: raw.slice(colonIdx + 1), exchange: raw.slice(0, colonIdx) };
}

export default function ChartsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawSymbol = searchParams.get("symbol") ?? "RELIANCE";
  const { bare: symbol, exchange: symbolExchange } = useMemo(() => stripExchange(rawSymbol), [rawSymbol]);
  const [period, setPeriod] = useState("1d");
  const [adjEnabled, setAdjEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Data state
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [resolution, setResolution] = useState("1");
  const [loading, setLoading] = useState(false);
  const [symbolDetail, setSymbolDetail] = useState<SymbolDetail | null>(null);
  const [prevClose, setPrevClose] = useState<number | null>(null);

  // Hover tracking for OHLC legend & context menu price
  const [hoverData, setHoverData] = useState<{ time: number; price: number } | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  // Modals
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0 });
  const [contextMenuPrice, setContextMenuPrice] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPrice, setAlertPrice] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [objectTreeVisible, setObjectTreeVisible] = useState(false);
  const [lockedCrosshair, setLockedCrosshair] = useState(false);
  const [activeIndicatorsCount] = useState(0); // reads from chart state eventually
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);

  // Fetch symbol detail
  useEffect(() => {
    if (!symbol) return;
    axios
      .get<SymbolDetail>(`/api/screener/symbol/${encodeURIComponent(symbol)}`)
      .then((res) => setSymbolDetail(res.data))
      .catch(() => setSymbolDetail(null));
  }, [symbol]);

  // Fetch candle data
  const fetchCandles = useCallback(
    (periodKey: string) => {
      const cfg = PERIOD_CONFIG[periodKey] ?? PERIOD_CONFIG["1y"];
      const exchangeStr = symbolDetail?.exchange || symbolExchange || "";
      const exchangeParam = exchangeStr
        ? `&exchange=${encodeURIComponent(exchangeStr)}`
        : "";
      const nowSec = Math.floor(Date.now() / 1000);
      const buildCandleUrl = (resolutionValue: string, fromSec: number, toSec: number) =>
        `/api/candles/${encodeURIComponent(symbol)}?resolution=${resolutionValue}&from=${fromSec}&to=${toSec}${exchangeParam}`;

      setLoading(true);
      setResolution(cfg.resolution);
      axios
        .get<{ candles: CandleData[] }>(buildCandleUrl(cfg.resolution, cfg.fromSec(), cfg.toSec()))
        .then((res) => {
          let raw = res.data.candles ?? [];

          // Yahoo often returns empty for long-range intraday windows.
          // Retry with the same resolution but capped to the last ~59 days.
          if (!raw.length && ["1", "2", "5", "15", "30", "60", "120"].includes(cfg.resolution)) {
            const cappedFrom = Math.max(cfg.fromSec(), nowSec - (59 * 86400));
            return axios
              .get<{ candles: CandleData[] }>(buildCandleUrl(cfg.resolution, cappedFrom, cfg.toSec()))
              .then((retryRes) => {
                raw = retryRes.data.candles ?? [];
                if (raw.length || cfg.resolution !== "120") {
                  return raw;
                }

                // Some providers do not return 120m bars reliably; degrade to 60m data
                // for rendering continuity while preserving the selected period controls.
                return axios
                  .get<{ candles: CandleData[] }>(buildCandleUrl("60", cappedFrom, cfg.toSec()))
                  .then((retry60Res) => {
                    const retry60 = retry60Res.data.candles ?? [];
                    if (retry60.length) return retry60;

                    // Final safety net for long-range views: use daily candles.
                    return axios
                      .get<{ candles: CandleData[] }>(buildCandleUrl("D", cfg.fromSec(), cfg.toSec()))
                      .then((retryDailyRes) => retryDailyRes.data.candles ?? [])
                      .catch(() => retry60);
                  })
                  .catch(() => raw);
              })
              .catch(() => raw);
          }

          return raw;
        })
        .then((rawCandles) => {
          const raw = rawCandles ?? [];
          const withOffset = applyIstOffset(raw, cfg.resolution);
          const fallbackSynthetic = applyIstOffset(
            buildSyntheticCandles(cfg.resolution, nowSec, symbolDetail?.price ?? prevClose ?? 100),
            cfg.resolution,
          );
          const usable = withOffset.length >= 3
            ? withOffset
            : (DEV_SYNTHETIC_FALLBACK ? fallbackSynthetic : withOffset);
          setCandles((prev) => {
            if (usable.length) return usable;
            if (prev.length) return prev;
            if (!DEV_SYNTHETIC_FALLBACK) return prev;
            return fallbackSynthetic;
          });
          // Derive prevClose from first candle
          if (usable.length >= 2) {
            setPrevClose(usable[usable.length - 2].close);
          }
        })
        .catch(() => {
          setCandles((prev) => {
            if (prev.length) return prev;
            if (!DEV_SYNTHETIC_FALLBACK) return prev;
            const synthetic = buildSyntheticCandles(cfg.resolution, nowSec, symbolDetail?.price ?? prevClose ?? 100);
            return applyIstOffset(synthetic, cfg.resolution);
          });
        })
        .finally(() => setLoading(false));
    },
    [symbol, symbolExchange, symbolDetail?.exchange],
  );

  // Reload on period change or symbol change
  useEffect(() => {
    fetchCandles(period);
  }, [period, fetchCandles]);

  // Live polling every 30s when tab visible
  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") fetchCandles(period);
    }
    const intervalId = setInterval(refreshIfVisible, 30_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [period, fetchCandles]);

  // Track hover point from chart debug API via RAF loop
  useEffect(() => {
    function track() {
      const debug = getChartDebug();
      if (debug) {
        const hp = debug.getHoverPoint?.();
        setHoverData(hp ?? null);
      }
      hoverRafRef.current = requestAnimationFrame(track);
    }
    hoverRafRef.current = requestAnimationFrame(track);
    return () => {
      if (hoverRafRef.current != null) cancelAnimationFrame(hoverRafRef.current);
    };
  }, []);

  // Derive OHLC legend row from hover data
  const legendRow = useMemo(() => {
    const fallback = candles.length > 0 ? candles[candles.length - 1] : null;
    if (!hoverData || !candles.length) {
      if (!fallback) return null;
      return {
        time: new Date(fallback.time).getTime() / 1000,
        open: fallback.open,
        high: fallback.high,
        low: fallback.low,
        close: fallback.close,
        volume: fallback.volume,
      };
    }
    // Find nearest candle by time
    const hoverSec = hoverData.time;
    let nearest = candles[candles.length - 1];
    let minDiff = Infinity;
    for (const c of candles) {
      const cSec = new Date(c.time).getTime() / 1000;
      const diff = Math.abs(cSec - hoverSec);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = c;
      }
    }
    return {
      time: new Date(nearest.time).getTime() / 1000,
      open: nearest.open,
      high: nearest.high,
      low: nearest.low,
      close: nearest.close,
      volume: nearest.volume,
    };
  }, [candles, hoverData]);

  // Context menu handler — intercepts right-click on chart area
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const debug = getChartDebug();
    const hp = debug?.getHoverPoint?.();
    const price = hp?.price ?? (candles.length > 0 ? candles[candles.length - 1].close : null);
    setContextMenuPrice(price);
    setContextMenu({ open: true, x: e.clientX, y: e.clientY });
  }, [candles]);

  // Context menu actions
  function handleResetView() {
    getChartDebug()?.scrollToPosition?.(0);
  }

  function handleCopyPrice() {
    const p = contextMenuPrice;
    if (p == null) return;
    navigator.clipboard.writeText(p.toFixed(2)).then(() => {
      toast.success(`Copied price ${p.toFixed(2)}`);
    }).catch(() => {});
  }

  function handleAddAlert() {
    setAlertPrice(contextMenuPrice);
    setAlertOpen(true);
  }

  function handleSaveTemplate() {
    const templateName = `template-${Date.now()}`;
    try {
      localStorage.setItem(`chart-template-${symbol}`, templateName);
      toast.success("Template saved");
    } catch {
      toast.error("Failed to save template");
    }
  }

  function handleLoadTemplate() {
    const saved = localStorage.getItem(`chart-template-${symbol}`);
    if (saved) {
      toast.success(`Loaded template: ${saved}`);
    } else {
      toast.info("No saved template found");
    }
  }

  function handleRemoveIndicators() {
    // Remove all indicators — signals TradingChart indirectly via no accessible API
    toast.info("Use the Indicators button in the chart top bar to manage indicators");
  }

  function handleSymbolSelect(newSymbol: string) {
    setSearchParams({ symbol: newSymbol });
    setCandles([]);
    setHoverData(null);
  }

  function handleAssetSelect(item: AssetSearchItem) {
    const sym = item.exchange
      ? `${item.exchange}:${item.symbol || item.ticker}`
      : (item.symbol || item.ticker);
    handleSymbolSelect(sym);
    setSymbolSearchOpen(false);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const displayName = symbolDetail?.name ?? symbol;
  const exchange = symbolDetail?.exchange ?? "";
  const baseSymbol = symbol.includes(":") ? symbol.split(":")[1] : symbol;
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : null;
  const prevPrice = candles.length >= 2 ? candles[candles.length - 2].close : null;
  const priceChange = currentPrice != null && prevPrice != null ? currentPrice - prevPrice : null;
  const priceChangePct = prevPrice != null && prevPrice !== 0 && priceChange != null ? (priceChange / prevPrice) * 100 : null;
  const isPositive = priceChange != null ? priceChange >= 0 : null;

  return (
    <div
      data-testid="charts-page"
      className="flex h-screen w-screen flex-col overflow-hidden bg-background"
    >
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-primary/15 bg-background/90 px-3 py-1.5 backdrop-blur-xl">
        {/* Back */}
        <button
          type="button"
          data-testid="charts-back-btn"
          onClick={() => navigate(-1)}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
          title="Go back"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Symbol logo */}
        {(symbolDetail?.s3Icon || symbolDetail?.iconUrl) && (
          <AssetAvatar
            src={symbolDetail.s3Icon || symbolDetail.iconUrl || null}
            label={symbol}
            className="h-7 w-7 shrink-0 rounded-full"
          />
        )}

        {/* Symbol search — clicking anywhere opens the full modal, input never focuses inline */}
        <button
          type="button"
          data-testid="charts-symbol-search-btn"
          onClick={() => setSymbolSearchOpen(true)}
          className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5 text-left hover:border-border/70 transition"
          title="Search symbol"
        >
          <span className="min-w-[80px] text-[12px] font-bold text-foreground">{baseSymbol}</span>
          <Search size={13} className="shrink-0 text-muted-foreground" />
        </button>

        {/* Exchange badge */}
        {exchange && (
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
            {exchange}
          </span>
        )}

        {/* Company name + price */}
        <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
          <span className="truncate text-[12px] text-muted-foreground">{displayName}</span>
          {currentPrice != null && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-bold tabular-nums text-foreground">
                {currentPrice.toFixed(2)}
              </span>
              {priceChange != null && priceChangePct != null && (
                <span className={`text-[11px] tabular-nums ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>
                  {isPositive ? "+" : ""}{priceChange.toFixed(2)} ({isPositive ? "+" : ""}{priceChangePct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}
          {loading && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border border-primary/40 border-t-transparent" />
          )}
        </div>

        {/* Fullscreen toggle */}
        <button
          type="button"
          data-testid="charts-fullscreen-btn"
          onClick={toggleFullscreen}
          className="ml-auto rounded-md p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* ── Main chart area ────────────────────────────────────────────── */}
      <div
        className="relative flex min-h-0 flex-1 overflow-hidden"
        onContextMenu={handleContextMenu}
      >
        {/* TradingChart — fills all space */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {candles.length === 0 && loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
                <span className="text-[12px] text-muted-foreground">Loading {baseSymbol}…</span>
              </div>
            </div>
          ) : candles.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-[14px] font-semibold text-foreground">{baseSymbol}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">No data available for this period.</p>
                <button
                  type="button"
                  onClick={() => fetchCandles(period)}
                  className="mt-3 rounded-md bg-primary/20 px-4 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/30 transition"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <TradingChart
              data={candles}
              visibleCount={candles.length}
              symbol={baseSymbol}
              resolution={resolution}
              mode="live"
              onAddAlert={(price) => {
                setAlertPrice(price);
                setAlertOpen(true);
              }}
              ohlcLegend={
                legendRow ? (
                  <ChartOhlcLegendOverlay
                    symbol={baseSymbol}
                    exchange={exchange}
                    row={legendRow}
                    prevClose={prevClose}
                  />
                ) : null
              }
            />
          )}
        </div>

        {/* Right mini strip */}
        <ChartRightMiniStrip
          onObjectTree={() => setObjectTreeVisible((v) => !v)}
          onSettings={() => setSettingsOpen(true)}
          onWatchlist={() => toast.info("Watchlist panel coming soon")}
          onAlerts={() => setAlertOpen(true)}
          onHelp={() => window.open("https://tradereplay.me/docs", "_blank", "noopener")}
        />

        {/* Context menu */}
        <ChartContextMenu
          open={contextMenu.open}
          x={contextMenu.x}
          y={contextMenu.y}
          symbol={baseSymbol}
          cursorPrice={contextMenuPrice}
          activeIndicatorsCount={activeIndicatorsCount}
          lockedCrosshair={lockedCrosshair}
          onClose={() => setContextMenu((s) => ({ ...s, open: false }))}
          onResetView={handleResetView}
          onCopyPrice={handleCopyPrice}
          onAddAlert={handleAddAlert}
          onToggleLockCrosshair={() => setLockedCrosshair((v) => !v)}
          onTableView={() => setTableOpen(true)}
          onObjectTree={() => setObjectTreeVisible((v) => !v)}
          onSaveTemplate={handleSaveTemplate}
          onLoadTemplate={handleLoadTemplate}
          onRemoveIndicators={handleRemoveIndicators}
          onSettings={() => setSettingsOpen(true)}
          onSellOrder={(price) => toast.info(`Sell order at ₹${price.toFixed(2)} — order placement coming soon`)}
          onBuyOrder={(price) => toast.info(`Buy order at ₹${price.toFixed(2)} — order placement coming soon`)}
          onAddOrder={(price) => toast.info(`Add order at ₹${price.toFixed(2)} — order placement coming soon`)}
        />
      </div>

      {/* ── Time range bar ────────────────────────────────────────────── */}
      <ChartTimeRangeBar
        period={period}
        onPeriodChange={(p) => {
          setPeriod(p);
          setCandles([]);
        }}
        adjEnabled={adjEnabled}
        onToggleAdj={() => setAdjEnabled((v) => !v)}
      />

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <ChartSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        symbol={baseSymbol}
      />

      <ChartAlertModal
        open={alertOpen}
        onOpenChange={setAlertOpen}
        symbol={baseSymbol}
        cursorPrice={alertPrice ?? contextMenuPrice}
      />

      <ChartTableViewModal
        open={tableOpen}
        onOpenChange={setTableOpen}
        symbol={baseSymbol}
        candles={candles}
        resolution={resolution}
      />

      <SymbolSearchModal
        open={symbolSearchOpen}
        selectedSymbol={baseSymbol}
        onOpenChange={setSymbolSearchOpen}
        onSelect={handleAssetSelect}
      />
    </div>
  );
}
