import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, BarChart3, FolderOpen, List, Search, TrendingUp } from "lucide-react";
import ChartEngine from "@/components/chart/ChartEngine";
import SymbolSearchModal from "@/components/simulation/SymbolSearchModal";
import AssetAvatar from "@/components/ui/AssetAvatar";
import InteractiveSurface from "@/components/ui/InteractiveSurface";
import PageBirdsCloudsBackground from "@/components/background/PageBirdsCloudsBackground";
import { api, getApiErrorMessage } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useLiveMarketData } from "@/hooks/useLiveMarketData";
import { searchAssets } from "@/lib/assetSearch";
import type { AssetSearchItem } from "@/lib/assetSearch";

interface SavedPortfolio {
  id: string;
  name: string;
  holdings: Array<{ symbol: string; quantity: number; avgPrice: number }>;
}

type LiveViewMode = "symbol" | "portfolio";

const defaultWatchlist = ["SPY", "AAPL", "TSLA", "BTCUSDT", "EURUSD"];

export default function LiveMarket() {
  const { isAuthenticated, formatCurrency } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dataMode = searchParams.get("parityData") === "1" ? "parity-live" : undefined;
  const parityMode = dataMode === "parity-live";

  const [viewMode, setViewMode] = useState<LiveViewMode>("symbol");
  const [selectedSymbol, setSelectedSymbol] = useState("SPY");
  const [selectedAssetMeta, setSelectedAssetMeta] = useState<AssetSearchItem | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(defaultWatchlist);
  const [symbolModalOpen, setSymbolModalOpen] = useState(false);
  const [watchlistAssetMetaBySymbol, setWatchlistAssetMetaBySymbol] = useState<Record<string, AssetSearchItem>>({});
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolios = async () => {
      try {
        const response = await api.get<SavedPortfolio[]>("/portfolio");
        if (cancelled) return;
        setPortfolios(response.data);
        setSelectedPortfolioId((prev) => prev || response.data[0]?.id || "");
        setPortfolioError(null);
      } catch (error) {
        if (cancelled) return;
        setPortfolioError(getApiErrorMessage(error, "Could not load portfolios"));
      }
    };

    if (isAuthenticated) {
      void loadPortfolios();
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId],
  );

  const portfolioHoldings = useMemo(
    () => (selectedPortfolio?.holdings ?? []).map((holding) => ({ symbol: holding.symbol, quantity: holding.quantity })),
    [selectedPortfolio],
  );

  const liveData = useLiveMarketData({
    mode: viewMode,
    symbol: selectedSymbol,
    holdings: portfolioHoldings,
    quoteSymbols: parityMode ? [selectedSymbol] : watchlist,
    pollMs: parityMode ? 7000 : 2500,
    dataMode,
  });

  useEffect(() => {
    let cancelled = false;

    const loadWatchlistMeta = async () => {
      const missingSymbols = watchlist.filter((symbol) => !watchlistAssetMetaBySymbol[symbol]);
      if (missingSymbols.length === 0) return;

      const result = await Promise.all(
        missingSymbols.map(async (symbol) => {
          try {
            const response = await searchAssets({ q: symbol, page: 1, limit: 25 });
            const exact = response.assets.find((asset) => asset.symbol.toUpperCase() === symbol.toUpperCase());
            const first = exact ?? response.assets[0] ?? null;
            return { symbol, asset: first };
          } catch {
            return { symbol, asset: null };
          }
        }),
      );

      if (cancelled) return;

      setWatchlistAssetMetaBySymbol((prev) => {
        let changed = false;
        const next = { ...prev };
        result.forEach((entry) => {
          if (entry.asset) {
            next[entry.symbol] = entry.asset;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    void loadWatchlistMeta();

    return () => {
      cancelled = true;
    };
  }, [watchlist, watchlistAssetMetaBySymbol]);

  const chartData = viewMode === "portfolio" ? liveData.portfolioCandles : liveData.symbolCandles;
  const chartSymbol = viewMode === "portfolio"
    ? (selectedPortfolio ? `PORT-${selectedPortfolio.name}` : "PORTFOLIO")
    : selectedSymbol;

  const priceValue = viewMode === "portfolio" ? liveData.portfolioValue : (liveData.symbolQuote?.price ?? 0);
  const changePercent = viewMode === "portfolio" ? liveData.portfolioChangePercent : (liveData.symbolQuote?.changePercent ?? 0);
  const quoteVolume = liveData.symbolQuote?.volume ?? 0;

  const selectedAssetName = selectedAssetMeta?.name || selectedSymbol;

  return (
    <div data-testid="live-market-page" className="min-h-screen pb-8 page-gradient-shell overflow-x-hidden">
      <PageBirdsCloudsBackground showShellLayers showBirds={false} />

      <main className="px-3 pt-5 pb-8 relative z-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[2.1rem] font-semibold leading-none">Live Market</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time stream mode. Replay/date controls are disabled here.</p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/30 p-1">
            <button
              type="button"
              onClick={() => setViewMode("symbol")}
              className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === "symbol" ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Single Symbol
            </button>
            <button
              type="button"
              onClick={() => setViewMode("portfolio")}
              className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === "portfolio" ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Portfolio
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px] gap-4">
          <InteractiveSurface className="glass-strong rounded-2xl p-4 gradient-border card-lift h-fit">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs tracking-[0.1em] text-muted-foreground">WATCHLIST</p>
              <List size={14} className="text-muted-foreground" />
            </div>

            <div className="space-y-1.5">
              {watchlist.map((symbol) => {
                const active = selectedSymbol === symbol && viewMode === "symbol";
                const quote = liveData.quotesBySymbol[symbol] ?? (selectedSymbol === symbol ? liveData.symbolQuote : null);
                const assetMeta = watchlistAssetMetaBySymbol[symbol];
                const changeClass = quote
                  ? (quote.changePercent >= 0 ? "text-profit" : "text-loss")
                  : "text-muted-foreground";
                return (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => {
                      setViewMode("symbol");
                      setSelectedSymbol(symbol);
                    }}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition-all ${
                      active
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border/60 bg-secondary/25 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <AssetAvatar src={assetMeta?.iconUrl} label={assetMeta?.name || symbol} className="h-5 w-5 rounded-full object-cover ring-1 ring-border/70" />
                        <span className="font-mono text-xs truncate">{symbol}</span>
                      </div>
                      <span className={`text-[11px] font-semibold ${changeClass}`}>
                        {quote ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "--"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              data-testid="live-market-symbol-trigger"
              type="button"
              onClick={() => setSymbolModalOpen(true)}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-secondary/35 px-3 py-2 text-sm hover:bg-secondary/55"
            >
              <Search size={14} />
              Add / Select Symbol
            </button>
          </InteractiveSurface>

          <InteractiveSurface className="glass-strong rounded-2xl overflow-hidden gradient-border card-lift min-h-[68vh]">
            {chartData.length > 0 ? (
              <ChartEngine
                mode="live"
                data={chartData}
                visibleCount={chartData.length}
                symbol={chartSymbol}
                timeframe="1m"
                parityMode={parityMode}
              />
            ) : (
              <div className="h-full min-h-[460px] flex items-center justify-center text-sm text-muted-foreground">
                Loading live chart...
              </div>
            )}
          </InteractiveSurface>

          <div className="space-y-4">
            <InteractiveSurface className="glass-strong rounded-2xl p-4 gradient-border card-lift">
              <p className="text-xs tracking-[0.1em] text-muted-foreground mb-2">LIVE SNAPSHOT</p>

              <div className="flex items-center gap-2 mb-3">
                <AssetAvatar src={selectedAssetMeta?.iconUrl} label={selectedAssetName} className="h-8 w-8 rounded-full object-cover ring-1 ring-border/70" />
                <div className="min-w-0">
                  <p data-testid="live-market-active-symbol" className="font-semibold truncate">{chartSymbol}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedAssetName}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1"><Activity size={13} /> Price</span>
                  <span data-testid="live-market-price" className="font-mono text-foreground">{formatCurrency(priceValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1"><TrendingUp size={13} /> Change</span>
                  <span className={`font-mono ${changePercent >= 0 ? "text-profit" : "text-loss"}`}>
                    {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground inline-flex items-center gap-1"><BarChart3 size={13} /> Volume</span>
                  <span className="font-mono">{quoteVolume.toLocaleString()}</span>
                </div>
              </div>

              {liveData.error ? (
                <p className="mt-3 text-xs text-loss">{liveData.error}</p>
              ) : null}
            </InteractiveSurface>

            <InteractiveSurface className="glass-strong rounded-2xl p-4 gradient-border card-lift">
              <p className="text-xs tracking-[0.1em] text-muted-foreground mb-2">MODE CONTROLS</p>

              <div className="space-y-2">
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5 text-xs text-muted-foreground">
                  Live mode disables simulator replay controls and date changes.
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground inline-flex items-center gap-1"><FolderOpen size={12} /> Portfolio</label>
                  <select
                    data-testid="live-market-portfolio-select"
                    value={selectedPortfolioId}
                    onChange={(event) => {
                      setViewMode("portfolio");
                      setSelectedPortfolioId(event.target.value);
                    }}
                    className="w-full rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-sm"
                  >
                    {portfolios.length === 0 ? <option value="">No portfolio</option> : null}
                    {portfolios.map((portfolio) => (
                      <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                    ))}
                  </select>
                  {portfolioError ? <p className="text-xs text-loss">{portfolioError}</p> : null}
                </div>
              </div>
            </InteractiveSurface>
          </div>
        </div>
      </main>

      <SymbolSearchModal
        open={symbolModalOpen}
        selectedSymbol={selectedSymbol}
        onOpenChange={setSymbolModalOpen}
        onSelect={(asset) => {
          const nextSymbol = asset.symbol.toUpperCase();
          setSelectedAssetMeta(asset);
          setSelectedSymbol(nextSymbol);
          setViewMode("symbol");
          setWatchlist((prev) => (prev.includes(nextSymbol) ? prev : [nextSymbol, ...prev].slice(0, 12)));
        }}
      />
    </div>
  );
}
