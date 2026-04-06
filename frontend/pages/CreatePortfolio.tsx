import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
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

const defaultRows: HoldingRow[] = [{ symbol: "AAPL", quantity: 10, avgPrice: 165 }];

type VantaBirdsOptions = {
  el: HTMLElement;
  mouseControls: boolean;
  touchControls: boolean;
  gyroControls: boolean;
  backgroundColor: number;
  color1: number;
  color2: number;
  colorMode: string;
  quantity: number;
  birdSize: number;
  wingSpan: number;
  speedLimit: number;
  separation: number;
  alignment: number;
  cohesion: number;
  scale: number;
  scaleMobile: number;
};

type VantaCloudsOptions = {
  el: HTMLElement;
  mouseControls: boolean;
  touchControls: boolean;
  gyroControls: boolean;
  backgroundColor: number;
  skyColor: number;
  cloudColor: number;
  cloudShadowColor: number;
  sunColor: number;
  sunGlareColor: number;
  sunlightColor: number;
  speed: number;
};

type VantaEffect = {
  destroy: () => void;
};

declare global {
  interface Window {
    VANTA?: {
      BIRDS?: (config: VantaBirdsOptions) => VantaEffect;
      CLOUDS?: (config: VantaCloudsOptions) => VantaEffect;
    };
  }
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-vanta-src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed loading ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.vantaSrc = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Failed loading ${src}`)), { once: true });
    document.head.appendChild(script);
  });

export default function CreatePortfolio() {
  const { theme } = useTheme();
  const birdsRef = useRef<HTMLDivElement | null>(null);
  const cloudsRef = useRef<HTMLDivElement | null>(null);
  const birdsEffectRef = useRef<VantaEffect | null>(null);
  const cloudsEffectRef = useRef<VantaEffect | null>(null);
  const navigate = useNavigate();
  const [name, setName] = useState("My Portfolio");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rows, setRows] = useState<HoldingRow[]>(defaultRows);
  const [marketFilter, setMarketFilter] = useState<MarketType>("stocks");
  const [selectedAssetMetaBySymbol, setSelectedAssetMetaBySymbol] = useState<Record<string, AssetSearchItem>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const estimatedCost = useMemo(
    () => rows.reduce((acc, row) => acc + (Number(row.quantity) || 0) * (Number(row.avgPrice) || 0), 0),
    [rows],
  );

  const initVantaBackground = useCallback(async (isDark: boolean) => {
    birdsEffectRef.current?.destroy();
    birdsEffectRef.current = null;
    cloudsEffectRef.current?.destroy();
    cloudsEffectRef.current = null;

    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js");
    await Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.birds.min.js"),
      loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js"),
    ]);

    if (cloudsRef.current && window.VANTA?.CLOUDS) {
      cloudsEffectRef.current = window.VANTA.CLOUDS({
        el: cloudsRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        backgroundColor: isDark ? 0x050d1a : 0x8baac6,
        skyColor: isDark ? 0x0a1628 : 0x6b94b8,
        cloudColor: isDark ? 0x0e2244 : 0xb0cfea,
        cloudShadowColor: isDark ? 0x06101e : 0x5a7d9e,
        sunColor: isDark ? 0x1a3a66 : 0xffd080,
        sunGlareColor: isDark ? 0x0d2040 : 0xf5c860,
        sunlightColor: isDark ? 0x142d52 : 0xfff0c0,
        speed: 0.8,
      });
    }

    if (birdsRef.current && window.VANTA?.BIRDS) {
      birdsEffectRef.current = window.VANTA.BIRDS({
        el: birdsRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        backgroundColor: isDark ? 0x000000 : 0xffffff,
        color1: isDark ? 0x3b82f6 : 0x1d4ed8,
        color2: isDark ? 0x00d1ff : 0x0284c7,
        colorMode: "varianceGradient",
        quantity: 4,
        birdSize: 1.1,
        wingSpan: 30,
        speedLimit: 4,
        separation: 25,
        alignment: 25,
        cohesion: 20,
        scale: 1.0,
        scaleMobile: 1.0,
      });
    }
  }, []);

  useEffect(() => {
    const isDark = theme === "dark";
    initVantaBackground(isDark).catch(() => undefined);

    return () => {
      birdsEffectRef.current?.destroy();
      birdsEffectRef.current = null;
      cloudsEffectRef.current?.destroy();
      cloudsEffectRef.current = null;
    };
  }, [theme, initVantaBackground]);

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

  const saveManual = async () => {
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

      await api.post("/portfolio", {
        name: name.trim(),
        baseCurrency,
        holdings,
      });

      toast.success("Portfolio created");
      navigate("/dashboard");
    } catch (error) {
      const message = getApiErrorMessage(error, "Could not create portfolio");
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const importCsv = async () => {
    setFormError(null);
    if (!csvFile) {
      setFormError("Choose a CSV file before importing.");
      toast.error("Please choose a CSV file first");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();
      data.append("file", csvFile);
      data.append("name", name.trim() || "Imported Portfolio");
      data.append("baseCurrency", baseCurrency);
      await api.post("/portfolio/import", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Portfolio imported from CSV");
      navigate("/dashboard");
    } catch (error) {
      const message = getApiErrorMessage(error, "CSV import failed. Ensure file has symbol, quantity, avgPrice columns.");
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 pt-24 md:px-8 page-gradient-shell">
      <div className="page-bg-orb page-bg-orb--one" aria-hidden="true" />
      <div className="page-bg-orb page-bg-orb--two" aria-hidden="true" />
      <div className="page-bg-orb page-bg-orb--three" aria-hidden="true" />
      <div className="page-bg-grid" aria-hidden="true" />
      <div ref={cloudsRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />
      <div
        ref={birdsRef}
        className={`fixed inset-0 z-0 pointer-events-none ${theme === "dark" ? "mix-blend-screen" : "mix-blend-multiply"}`}
        style={{ background: "transparent" }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <ScrollReveal>
          <InteractiveSurface className="glass-strong rounded-3xl p-7 md:p-8 gradient-border section-hover-reveal">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <BrandLottie size={56} className="shrink-0 drop-shadow-[0_0_16px_hsl(var(--neon-blue)/0.3)]" />
                <div>
                  <h1 className="text-[2.65rem] font-bold font-display leading-[1]">Portfolio Builder</h1>
                  <p className="text-sm text-muted-foreground mt-1">Build a diversified trading basket with market-aware asset search</p>
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
          <div className="xl:col-span-8 space-y-6">
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

            <ScrollReveal delay={0.08}>
              <InteractiveSurface className="glass-strong rounded-2xl p-6 gradient-border section-hover-reveal">
                <h3 className="font-display text-[1.3rem] mb-2">CSV Import</h3>
                <p className="text-xs text-muted-foreground mb-3">Upload CSV with columns: symbol, quantity, avgPrice</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="premium-select px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-secondary/65 transition-colors">
                    Choose CSV
                    <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} className="hidden" />
                  </label>
                  {csvFile ? <span className="text-xs text-muted-foreground truncate max-w-[240px]">{csvFile.name}</span> : null}
                  <button onClick={() => void importCsv()} disabled={isSaving} className="px-3 py-2 rounded-lg bg-secondary/60 border border-border text-sm disabled:opacity-60 interactive-cta">
                    {isSaving ? "Importing..." : "Import CSV"}
                  </button>
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
                      placeholder="Momentum Portfolio"
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
                    <button onClick={() => void saveManual()} disabled={isSaving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60 interactive-cta">
                      {isSaving ? "Saving..." : "Save Portfolio"}
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
