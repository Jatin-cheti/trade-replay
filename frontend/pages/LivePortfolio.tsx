import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowUpRight, ChevronDown, CircleAlert, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { getSocket } from "@/lib/socket";
import AssetSearchDropdown from "@/components/portfolio/AssetSearchDropdown";
import AssetAvatar from "@/components/ui/AssetAvatar";
import BrandLottie from "@/components/BrandLottie";
import PageBirdsCloudsBackground from "@/components/background/PageBirdsCloudsBackground";
import ScrollReveal from "@/components/ScrollReveal";
import InteractiveSurface from "@/components/ui/InteractiveSurface";
import type { AssetSearchItem } from "@/lib/assetSearch";
import { resolveUserIdentityLabel } from "@/lib/userIdentity";

type Position = {
  symbol: string;
  status: "OPEN" | "CLOSED";
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  updatedAt?: string;
};

type Trade = {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  realizedPnl: number;
  source: string;
  occurredAt: string;
};

type PortfolioResponse = {
  userId: string;
  currency: string;
  positions: Position[];
  totalValue: number;
  dailyPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  investedValue: number;
  cashBalance: number;
};

type PnlResponse = {
  totalValue: number;
  dailyPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  investedValue: number;
  cashBalance: number;
};

type TradesResponse = {
  success: boolean;
  trades: Trade[];
};

const INITIAL_TRADE = {
  symbol: "AAPL",
  type: "BUY" as const,
  quantity: 1,
  price: 200,
};

function formatMoney(value: number, currency = "USD"): string {
  const prefix = currency === "INR" ? "₹" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "JPY" ? "¥" : "$";
  return `${prefix}${value.toFixed(2)}`;
}

function toPnlSnapshot(portfolio: PortfolioResponse): PnlResponse {
  return {
    totalValue: portfolio.totalValue,
    dailyPnl: portfolio.dailyPnl,
    unrealizedPnl: portfolio.unrealizedPnl,
    realizedPnl: portfolio.realizedPnl,
    investedValue: portfolio.investedValue,
    cashBalance: portfolio.cashBalance,
  };
}

export default function LivePortfolio() {
  const { username, token, socketReady } = useApp();
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnl, setPnl] = useState<PnlResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState(INITIAL_TRADE.symbol);
  const [type, setType] = useState<"BUY" | "SELL">(INITIAL_TRADE.type);
  const [quantity, setQuantity] = useState(String(INITIAL_TRADE.quantity));
  const [price, setPrice] = useState(String(INITIAL_TRADE.price));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveFeedStatus, setLiveFeedStatus] = useState<"live" | "disconnected">("disconnected");
  const [selectedTradeAsset, setSelectedTradeAsset] = useState<AssetSearchItem | null>(null);

  const realtimeRefreshTimeoutRef = useRef<number | null>(null);
  const realtimeRefreshInFlightRef = useRef(false);
  const realtimeRefreshQueuedRef = useRef(false);

  const currency = portfolio?.currency ?? "USD";
  const identityLabel = useMemo(() => resolveUserIdentityLabel({ username, token }), [token, username]);

  const stats = useMemo(() => {
    const totalValue = pnl?.totalValue ?? portfolio?.totalValue ?? 0;
    const cashBalance = pnl?.cashBalance ?? portfolio?.cashBalance ?? 0;
    const investedValue = pnl?.investedValue ?? portfolio?.investedValue ?? 0;
    const dailyPnl = pnl?.dailyPnl ?? portfolio?.dailyPnl ?? 0;
    return { totalValue, cashBalance, investedValue, dailyPnl };
  }, [pnl, portfolio]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [portfolioResponse, tradesResponse] = await Promise.all([
        api.get<PortfolioResponse>("/portfolio-service/portfolio"),
        api.get<TradesResponse>("/portfolio-service/trades"),
      ]);

      const nextPortfolio = portfolioResponse.data;
      setPortfolio(nextPortfolio);
      setPositions(nextPortfolio.positions ?? []);
      setPnl(toPnlSnapshot(nextPortfolio));
      setTrades(tradesResponse.data.trades ?? []);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Could not load live portfolio"));
    }
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setIsLoading(true);
      await loadData();
      if (active) {
        setIsLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimeoutRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    };
  }, []);

  const runRealtimeRefresh = useCallback(async () => {
    if (realtimeRefreshInFlightRef.current) {
      realtimeRefreshQueuedRef.current = true;
      return;
    }

    realtimeRefreshInFlightRef.current = true;
    try {
      await loadData();
    } finally {
      realtimeRefreshInFlightRef.current = false;
      if (realtimeRefreshQueuedRef.current) {
        realtimeRefreshQueuedRef.current = false;
        void runRealtimeRefresh();
      }
    }
  }, [loadData]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current !== null) {
      return;
    }

    realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
      realtimeRefreshTimeoutRef.current = null;
      void runRealtimeRefresh();
    }, 450);
  }, [runRealtimeRefresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socketReady || !socket) {
      setLiveFeedStatus("disconnected");
      return;
    }

    const syncConnectionState = () => {
      setLiveFeedStatus(socket.connected ? "live" : "disconnected");
    };

    const onPortfolioLiveUpdate = () => {
      scheduleRealtimeRefresh();
    };

    syncConnectionState();
    socket.on("connect", syncConnectionState);
    socket.on("disconnect", syncConnectionState);
    socket.on("portfolio:live-update", onPortfolioLiveUpdate);

    return () => {
      socket.off("connect", syncConnectionState);
      socket.off("disconnect", syncConnectionState);
      socket.off("portfolio:live-update", onPortfolioLiveUpdate);
    };
  }, [scheduleRealtimeRefresh, socketReady]);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const submitTrade = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const normalizedSymbol = (selectedTradeAsset?.symbol ?? symbol).trim().toUpperCase();
      if (!normalizedSymbol) {
        setError("Select a valid asset before submitting a trade.");
        return;
      }

      const tradePayload = {
        symbol: normalizedSymbol,
        type,
        quantity: Number(quantity),
        price: Number(price),
      };

      await api.post("/portfolio-service/trade", {
        ...tradePayload,
      });
      await loadData();
    } catch (tradeError) {
      setError(getApiErrorMessage(tradeError, "Portfolio trade failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPositions = positions.filter((position) => position.status === "OPEN");

  return (
    <div className="min-h-screen page-gradient-shell px-4 py-6 pt-24 md:px-8">
      <PageBirdsCloudsBackground showShellLayers />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <ScrollReveal>
          <InteractiveSurface className="glass-strong rounded-3xl p-7 md:p-8 gradient-border section-hover-reveal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <BrandLottie size={56} className="shrink-0 drop-shadow-[0_0_16px_hsl(var(--neon-blue)/0.3)]" />
                <div>
                  <p className="kicker-text">Live Portfolio</p>
                  <h1 className="font-display text-[2.4rem] font-bold leading-none md:text-[3rem]">Live Ledger</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Track your real-time portfolio performance.</p>
                  <p className="text-sm text-muted-foreground">Monitor positions, PnL, and trade activity live.</p>
                  <p className="text-sm text-muted-foreground">Updates automatically with market price changes.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-3 text-right">
                <p className="text-xs text-muted-foreground">Trader</p>
                <p className="font-display text-lg font-semibold text-foreground">{identityLabel}</p>
                <p className={`mt-1 text-xs ${liveFeedStatus === "live" ? "text-profit" : "text-muted-foreground"}`}>
                  {liveFeedStatus === "live" ? "Live updates connected" : "Live updates reconnecting"}
                </p>
              </div>
            </div>
          </InteractiveSurface>
        </ScrollReveal>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <CircleAlert size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Value", value: formatMoney(stats.totalValue, currency), icon: Wallet },
            { label: "Cash Balance", value: formatMoney(stats.cashBalance, currency), icon: ShieldCheck },
            { label: "Invested Value", value: formatMoney(stats.investedValue, currency), icon: ArrowUpRight },
            { label: "Daily PnL", value: formatMoney(stats.dailyPnl, currency), icon: Activity },
          ].map((card) => (
            <InteractiveSurface key={card.label} className="glass-strong rounded-2xl border border-border/70 p-4 gradient-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{card.label}</p>
                  <p className="mt-2 font-display text-[1.55rem] font-semibold text-foreground">{card.value}</p>
                </div>
                <card.icon size={20} className="text-primary" />
              </div>
            </InteractiveSurface>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <InteractiveSurface className="glass-strong rounded-3xl p-5 md:p-6 gradient-border">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow-label">Positions</p>
                  <h2 className="font-display text-2xl font-semibold">Open exposure</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={isRefreshing || isLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-2 text-sm transition-colors hover:border-primary/45 hover:bg-secondary/60 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>

              {isLoading ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/25 px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading live portfolio snapshot...
                </div>
              ) : openPositions.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/25 px-4 py-8 text-center text-sm text-muted-foreground">
                  No open positions yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/70">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border/70 text-sm">
                      <thead className="bg-secondary/30 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left">Symbol</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">Avg</th>
                          <th className="px-4 py-3 text-right">Price</th>
                          <th className="px-4 py-3 text-right">Market Value</th>
                          <th className="px-4 py-3 text-right">PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70 bg-background/35">
                        {openPositions.map((position) => (
                          <tr key={position.symbol}>
                            <td className="px-4 py-3 font-semibold text-foreground">{position.symbol}</td>
                            <td className="px-4 py-3 text-right font-mono">{position.quantity.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatMoney(position.avgPrice, currency)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatMoney(position.currentPrice, currency)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatMoney(position.marketValue, currency)}</td>
                            <td className={`px-4 py-3 text-right font-mono ${position.unrealizedPnl >= 0 ? "text-profit" : "text-loss"}`}>
                              {formatMoney(position.unrealizedPnl, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </InteractiveSurface>

            <InteractiveSurface className="glass-strong rounded-3xl p-5 md:p-6 gradient-border">
              <div className="mb-4">
                <p className="eyebrow-label">Trade History</p>
                <h2 className="font-display text-2xl font-semibold">Recent Executions</h2>
              </div>

              {trades.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-secondary/25 px-4 py-8 text-center text-sm text-muted-foreground">
                  No trades recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {trades.slice(0, 8).map((trade) => (
                    <div key={trade.id} className="rounded-2xl border border-border/70 bg-secondary/25 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{trade.symbol} {trade.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(trade.occurredAt).toLocaleString()} · {trade.source === "api" ? "Manual order" : "Automated update"}
                          </p>
                        </div>
                        <p className={`font-mono font-semibold ${trade.realizedPnl >= 0 ? "text-profit" : "text-loss"}`}>
                          {formatMoney(trade.realizedPnl, currency)}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {trade.quantity} @ {formatMoney(trade.price, currency)} for {formatMoney(trade.total, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </InteractiveSurface>
          </div>

          <div className="space-y-6 xl:col-span-4">
            <InteractiveSurface className="glass-strong rounded-3xl p-5 md:p-6 gradient-border sticky top-24">
              <div className="mb-4">
                <p className="eyebrow-label">Direct Trade</p>
                <h2 className="font-display text-2xl font-semibold">Place Manual Order</h2>
                <p className="mt-1 text-sm text-muted-foreground">Select an asset, choose the side, and enter quantity and price to update your live ledger.</p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted-foreground">Symbol</span>
                  <AssetSearchDropdown
                    value={symbol}
                    selectedAsset={selectedTradeAsset}
                    onValueChange={(value, asset) => {
                      setSymbol(value);
                      setSelectedTradeAsset(asset);
                      setError(null);
                    }}
                    placeholder="Search assets globally"
                  />
                  {selectedTradeAsset ? (
                    <p className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                      <AssetAvatar src={selectedTradeAsset.logoUrl} label={selectedTradeAsset.name} className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-border/70" />
                      <span>{selectedTradeAsset.name} • {selectedTradeAsset.market}</span>
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted-foreground">Side</span>
                  <div className="relative">
                    <select
                      value={type}
                      onChange={(event) => setType(event.target.value as "BUY" | "SELL")}
                      className="w-full appearance-none rounded-xl border border-border/80 bg-secondary/35 px-3 py-2.5 pr-10 text-sm font-medium text-foreground outline-none transition-colors hover:bg-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted-foreground">Quantity</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="w-full rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted-foreground">Price</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      className="w-full rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void submitTrade()}
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting..." : "Submit Trade"}
                </button>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl border border-border/70 bg-secondary/25 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Positions</span>
                  <span className="font-semibold">{positions.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Open Positions</span>
                  <span className="font-semibold">{openPositions.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Realized PnL</span>
                  <span className="font-semibold">{formatMoney(pnl?.realizedPnl ?? 0, currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Daily PnL</span>
                  <span className="font-semibold">{formatMoney(pnl?.dailyPnl ?? 0, currency)}</span>
                </div>
              </div>
            </InteractiveSurface>
          </div>
        </div>
      </div>
    </div>
  );
}