import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import BrandLottie from "@/components/BrandLottie";
import ScrollReveal from "@/components/ScrollReveal";
import InteractiveSurface from "@/components/ui/InteractiveSurface";
import SearchableDropdown from "@/components/portfolio/SearchableDropdown";
import AssetSearchDropdown from "@/components/portfolio/AssetSearchDropdown";
import AssetAvatar from "@/components/ui/AssetAvatar";
import { currencyCatalog, marketMeta, type MarketType } from "@/data/assetCatalog";
import { AssetSearchItem } from "@/lib/assetSearch";

interface HoldingRow {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

interface PortfolioPayload {
  id: string;
  name: string;
  baseCurrency: string;
  holdings: HoldingRow[];
}

export default function EditPortfolio() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rows, setRows] = useState<HoldingRow[]>([]);
  const [marketFilter, setMarketFilter] = useState<MarketType>("stocks");
  const [selectedAssetMetaBySymbol, setSelectedAssetMetaBySymbol] = useState<Record<string, AssetSearchItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const estimatedCost = useMemo(
    () => rows.reduce((acc, row) => acc + (Number(row.quantity) || 0) * (Number(row.avgPrice) || 0), 0),
    [rows],
  );

  const selectedAssetCount = useMemo(() => rows.filter((row) => Boolean(row.symbol)).length, [rows]);

  const marketMix = useMemo(() => {
    const map: Record<MarketType, number> = {
      stocks: 0,
      funds: 0,
      futures: 0,
      forex: 0,
      crypto: 0,
      indices: 0,
      bonds: 0,
      economy: 0,
      options: 0,
    };

    const marketToFilter: Record<string, MarketType> = {
      Stocks: "stocks",
      Funds: "funds",
      Futures: "futures",
      ETF: "funds",
      Crypto: "crypto",
      Forex: "forex",
      Indices: "indices",
      Bonds: "bonds",
      Economy: "economy",
      Options: "options",
    };

    rows.forEach((row) => {
      const meta = selectedAssetMetaBySymbol[row.symbol];
      const bucket = meta ? marketToFilter[meta.market] : undefined;
      if (bucket) map[bucket] += 1;
    });

    return map;
  }, [rows, selectedAssetMetaBySymbol]);

  const marketFilterApiParam: Record<MarketType, string> = {
    stocks: "stocks",
    funds: "funds",
    futures: "futures",
    forex: "forex",
    crypto: "crypto",
    indices: "indices",
    bonds: "bonds",
    economy: "economy",
    options: "options",
  };

  useEffect(() => {
    const load = async () => {
      if (!portfolioId) {
        toast.error("Portfolio ID is missing");
        navigate("/dashboard");
        return;
      }

      try {
        const response = await api.get<PortfolioPayload>(`/portfolio/${portfolioId}`);
        setName(response.data.name);
        setBaseCurrency(response.data.baseCurrency);
        setRows(response.data.holdings.length ? response.data.holdings : [{ symbol: "", quantity: 1, avgPrice: 1 }]);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Could not load portfolio"));
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [portfolioId, navigate]);

  const updateRow = (index: number, patch: Partial<HoldingRow>) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { symbol: "", quantity: 1, avgPrice: 1 }]);
    setFormError(null);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_row, idx) => idx !== index));
  };

  const handleMarketFilterChange = (nextMarket: MarketType) => {
    setMarketFilter(nextMarket);
    setRows((prev) => prev.map((row) => ({ ...row, symbol: "" })));
    setSelectedAssetMetaBySymbol({});
    setFormError(null);
  };

  const saveChanges = async () => {
    if (!portfolioId) return;

    setFormError(null);
    setIsSaving(true);
    try {
      const holdings = rows
        .map((row) => ({
          symbol: row.symbol.trim().toUpperCase(),
          quantity: Number(row.quantity),
          avgPrice: Number(row.avgPrice),
        }))
        .filter((row) => row.symbol && row.quantity > 0 && row.avgPrice > 0);

      if (!name.trim()) {
        setFormError("Portfolio name is required.");
        return;
      }

      if (holdings.length === 0) {
        setFormError("Add at least one valid asset before saving.");
        return;
      }

      await api.put(`/portfolio/${portfolioId}`, {
        name: name.trim(),
        baseCurrency,
        holdings,
      });

      toast.success("Portfolio updated");
      navigate("/dashboard");
    } catch (error) {
      const message = getApiErrorMessage(error, "Could not update portfolio");
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen page-gradient-shell flex items-center justify-center pt-24">
        <div className="glass-strong rounded-xl px-6 py-4 text-sm text-muted-foreground gradient-border">
          <div className="flex items-center gap-3">
            <BrandLottie size={50} className="shrink-0" />
            <p>Loading portfolio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pt-24 md:px-8 page-gradient-shell">
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <ScrollReveal>
          <InteractiveSurface className="glass-strong rounded-3xl p-7 md:p-8 gradient-border section-hover-reveal">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <BrandLottie size={56} className="shrink-0 drop-shadow-[0_0_16px_hsl(var(--neon-blue)/0.3)]" />
                <div>
                  <h1 className="text-[2.65rem] font-bold font-display leading-[1]">Portfolio Editor</h1>
                  <p className="text-sm text-muted-foreground mt-1">Refine allocation, markets, and pricing assumptions</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-secondary/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Selected Assets</p>
                <p className="text-xl font-semibold font-display">{selectedAssetCount}</p>
              </div>
            </div>
          </InteractiveSurface>
        </ScrollReveal>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8">
            <ScrollReveal delay={0.04}>
              <InteractiveSurface className="glass-strong rounded-2xl p-6 md:p-7 gradient-border section-hover-reveal">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <h2 className="font-display text-[2rem] font-semibold">Asset Builder</h2>
                  <button onClick={addRow} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm interactive-cta">
                    + Add Asset
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {marketMeta.map((market) => {
                    const active = marketFilter === market.key;
                    return (
                      <button
                        key={market.key}
                        type="button"
                        onClick={() => handleMarketFilterChange(market.key)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                          active
                            ? "bg-primary/20 border-primary/50 text-foreground glow-blue"
                            : "bg-secondary/35 border-border text-muted-foreground hover:text-foreground hover:border-primary/35"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <AssetAvatar src={market.iconUrl} label={market.label} className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-border/70" />
                          {market.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  {rows.length === 0 ? (
                    <div className="rounded-xl border border-border/80 bg-secondary/25 p-6 text-center">
                      <p className="font-medium">No assets added yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Select a market and add your first position.</p>
                    </div>
                  ) : (
                    rows.map((row, index) => {
                      const selectedAsset = selectedAssetMetaBySymbol[row.symbol];
                      return (
                        <motion.div
                          key={`row-${index}`}
                          className="grid grid-cols-12 gap-2 items-center rounded-xl border border-border/70 bg-secondary/20 p-2"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="col-span-12 md:col-span-5">
                            <AssetSearchDropdown
                              value={row.symbol}
                              selectedAsset={selectedAsset}
                              marketFilter={marketFilterApiParam[marketFilter]}
                              onValueChange={(value, asset) => {
                                setSelectedAssetMetaBySymbol((prev) => ({ ...prev, [value]: asset }));
                                updateRow(index, { symbol: value });
                                setFormError(null);
                              }}
                              placeholder="Search assets globally"
                            />
                            {selectedAsset ? (
                              <p className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                                <AssetAvatar src={selectedAsset.logoUrl} label={selectedAsset.name} className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-border/70" />
                                <span>{selectedAsset.name} • {selectedAsset.market}</span>
                              </p>
                            ) : null}
                          </div>

                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) => {
                              updateRow(index, { quantity: Number(e.target.value) });
                              setFormError(null);
                            }}
                            placeholder="Qty"
                            className="premium-input col-span-5 md:col-span-2 px-3 py-2.5 rounded-lg"
                          />

                          <input
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={row.avgPrice}
                            onChange={(e) => {
                              updateRow(index, { avgPrice: Number(e.target.value) });
                              setFormError(null);
                            }}
                            placeholder="Avg Price"
                            className="premium-input col-span-5 md:col-span-3 px-3 py-2.5 rounded-lg"
                          />

                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="col-span-2 text-xs md:text-sm text-loss hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </InteractiveSurface>
            </ScrollReveal>
          </div>

          <div className="xl:col-span-4">
            <ScrollReveal delay={0.06}>
              <InteractiveSurface className="glass-strong rounded-2xl p-6 gradient-border section-hover-reveal xl:sticky xl:top-24">
                <h2 className="font-display text-[1.6rem] mb-4">Summary</h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="portfolio-name" className="text-xs text-muted-foreground block mb-1">Portfolio Name</label>
                    <input
                      id="portfolio-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setFormError(null);
                      }}
                      className="premium-input w-full px-3 py-2.5 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Base Currency</label>
                    <SearchableDropdown
                      items={currencyCatalog.map((currency) => ({
                        value: currency.code,
                        label: currency.code,
                        subtitle: currency.name,
                        iconUrl: currency.iconUrl,
                      }))}
                      value={baseCurrency}
                      onValueChange={(value) => {
                        setBaseCurrency(value);
                        setFormError(null);
                      }}
                      placeholder="Select currency"
                      searchPlaceholder="Search currency code or name"
                      emptyText="No currency found"
                    />
                  </div>

                  <div className="rounded-xl border border-border/80 bg-secondary/25 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Assets</span>
                      <span className="font-semibold">{selectedAssetCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Estimated Cost</span>
                      <span className="font-semibold font-mono">${estimatedCost.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-secondary/25 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Market Mix</p>
                    <div className="space-y-1.5">
                      {marketMeta.map((market) => (
                        <div key={market.key} className="flex justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <AssetAvatar src={market.iconUrl} label={market.label} className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-border/70" />
                            {market.label}
                          </span>
                          <span>{marketMix[market.key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {formError ? (
                    <div className="rounded-lg border border-neon-red/45 bg-neon-red/10 px-3 py-2 text-xs text-loss">{formError}</div>
                  ) : null}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary/45 transition-all">
                      Cancel
                    </button>
                    <button onClick={() => void saveChanges()} disabled={isSaving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60 interactive-cta">
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </InteractiveSurface>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </div>
  );
}
