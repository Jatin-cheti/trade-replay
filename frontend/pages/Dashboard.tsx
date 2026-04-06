import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { flushSync } from "react-dom";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api";
import { scenarios } from "@/data/stockData";
import { toast } from "sonner";
import BrandLottie from "@/components/BrandLottie";
import ScrollReveal from "@/components/ScrollReveal";
import InteractiveSurface from "@/components/ui/InteractiveSurface";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import PremiumSelect from "@/components/simulation/PremiumSelect";

interface SavedPortfolio {
  id: string;
  name: string;
  baseCurrency: string;
  holdings: Array<{ symbol: string; quantity: number; avgPrice: number }>;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
}

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

export default function Dashboard() {
  const { isAuthenticated } = useApp();
  const { theme } = useTheme();
  const birdsRef = useRef<HTMLDivElement | null>(null);
  const cloudsRef = useRef<HTMLDivElement | null>(null);
  const birdsEffectRef = useRef<VantaEffect | null>(null);
  const cloudsEffectRef = useRef<VantaEffect | null>(null);
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedPortfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedScenarioByPortfolio, setSelectedScenarioByPortfolio] = useState<Record<string, string>>({});
  const [featuredScenarioId, setFeaturedScenarioId] = useState(scenarios[0]?.id ?? "2008-crash");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [scenarioCarouselApi, setScenarioCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [selectedPortfolioIdsForBulkApply, setSelectedPortfolioIdsForBulkApply] = useState<string[]>([]);
  const [openPortfolioScenarioDropdownId, setOpenPortfolioScenarioDropdownId] = useState<string | null>(null);
  const featuredScenario = scenarios.find((scenario) => scenario.id === featuredScenarioId) ?? scenarios[0];
  const featuredScenarioIndex = Math.max(0, scenarios.findIndex((scenario) => scenario.id === featuredScenarioId));
  const scenarioSelectOptions = useMemo(
    () => scenarios.map((scenario) => ({ value: scenario.id, label: scenario.name, subtitle: scenario.description })),
    []
  );

  const totalAum = useMemo(() => items.reduce((acc, portfolio) => acc + portfolio.totalValue, 0), [items]);

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

  const loadPortfolios = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<SavedPortfolio[]>("/portfolio");
      setItems(response.data);
      setSelectedPortfolioIdsForBulkApply(response.data.map((portfolio) => portfolio.id));
      setSelectedScenarioByPortfolio((prev) => {
        const next = { ...prev };
        response.data.forEach((portfolio) => {
          if (!next[portfolio.id]) {
            next[portfolio.id] = scenarios[0]?.id ?? "2008-crash";
          }
        });
        return next;
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load portfolios"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadPortfolios();
  }, [isAuthenticated]);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updatePointerType = () => setIsCoarsePointer(mediaQuery.matches);

    updatePointerType();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePointerType);
      return () => mediaQuery.removeEventListener("change", updatePointerType);
    }

    mediaQuery.addListener(updatePointerType);
    return () => mediaQuery.removeListener(updatePointerType);
  }, []);

  useEffect(() => {
    if (!openPortfolioScenarioDropdownId) return;

    let closed = false;

    const isInsidePremiumSelectContent = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      const element = target instanceof Element ? target : target.parentElement;
      return !!element?.closest('[data-premium-select-content="true"]');
    };

    const closeDropdownImmediately = (event?: Event) => {
      if (closed) return;
      if (event && isInsidePremiumSelectContent(event.target)) return;
      closed = true;
      flushSync(() => {
        setOpenPortfolioScenarioDropdownId(null);
      });
    };

    // Capture wheel/touch intent before the page visually scrolls so the menu does not appear to move.
    window.addEventListener("wheel", closeDropdownImmediately, { capture: true, passive: true });
    window.addEventListener("touchmove", closeDropdownImmediately, { capture: true, passive: true });
    window.addEventListener("scroll", closeDropdownImmediately, { passive: true });
    window.addEventListener("resize", closeDropdownImmediately);

    return () => {
      window.removeEventListener("wheel", closeDropdownImmediately, true);
      window.removeEventListener("touchmove", closeDropdownImmediately, true);
      window.removeEventListener("scroll", closeDropdownImmediately);
      window.removeEventListener("resize", closeDropdownImmediately);
    };
  }, [openPortfolioScenarioDropdownId]);

  useEffect(() => {
    if (!scenarioCarouselApi) return;

    const syncStateFromCarousel = () => {
      setCanScrollPrev(scenarioCarouselApi.canScrollPrev());
      setCanScrollNext(scenarioCarouselApi.canScrollNext());
      const snapIndex = scenarioCarouselApi.selectedScrollSnap();
      const selectedScenario = scenarios[snapIndex];
      if (selectedScenario && selectedScenario.id !== featuredScenarioId) {
        setFeaturedScenarioId(selectedScenario.id);
      }
    };

    syncStateFromCarousel();
    scenarioCarouselApi.on("select", syncStateFromCarousel);
    scenarioCarouselApi.on("reInit", syncStateFromCarousel);

    return () => {
      scenarioCarouselApi.off("select", syncStateFromCarousel);
      scenarioCarouselApi.off("reInit", syncStateFromCarousel);
    };
  }, [scenarioCarouselApi, featuredScenarioId]);

  useEffect(() => {
    if (!scenarioCarouselApi) return;
    if (scenarioCarouselApi.selectedScrollSnap() !== featuredScenarioIndex) {
      scenarioCarouselApi.scrollTo(featuredScenarioIndex);
    }
  }, [scenarioCarouselApi, featuredScenarioIndex]);

  const handleScenarioWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (isCoarsePointer || !scenarioCarouselApi) return;

    const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(dominantDelta) < 6) return;

    if (dominantDelta > 0) {
      if (!scenarioCarouselApi.canScrollNext()) return;
      event.preventDefault();
      scenarioCarouselApi.scrollNext();
      return;
    }

    if (!scenarioCarouselApi.canScrollPrev()) return;
    event.preventDefault();
    scenarioCarouselApi.scrollPrev();
  }, [isCoarsePointer, scenarioCarouselApi]);

  const openSimulation = (portfolioId: string) => {
    const scenarioId = selectedScenarioByPortfolio[portfolioId] ?? scenarios[0].id;
    navigate(`/simulation?portfolioId=${portfolioId}&scenarioId=${scenarioId}`);
  };

  const toggleSelectedPortfolioId = (portfolioId: string, checked: boolean) => {
    setSelectedPortfolioIdsForBulkApply((prev) => {
      if (checked) {
        if (prev.includes(portfolioId)) return prev;
        return [...prev, portfolioId];
      }
      return prev.filter((id) => id !== portfolioId);
    });
  };

  const applyFeaturedScenarioToSelectedPortfolios = () => {
    if (selectedPortfolioIdsForBulkApply.length === 0) {
      toast.error("Select at least one portfolio");
      return;
    }

    const selected = new Set(selectedPortfolioIdsForBulkApply);
    setSelectedScenarioByPortfolio((prev) => {
      const next = { ...prev };
      items.forEach((portfolio) => {
        if (selected.has(portfolio.id)) {
          next[portfolio.id] = featuredScenarioId;
        }
      });
      return next;
    });

    toast.success(`Scenario applied to ${selectedPortfolioIdsForBulkApply.length} selected portfolio(s)`);
  };

  const importFromDashboard = async () => {
    if (!csvFile) {
      toast.error("Please choose a CSV file first");
      return;
    }

    try {
      const form = new FormData();
      form.append("file", csvFile);
      form.append("name", `Imported ${new Date().toLocaleDateString()}`);
      await api.post("/portfolio/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Portfolio imported");
      setCsvFile(null);
      await loadPortfolios();
    } catch (_error) {
      toast.error("CSV import failed");
    }
  };

  return (
    <div className="min-h-screen pb-8 page-gradient-shell overflow-x-hidden">
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

      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-4 md:pt-5 pb-8 space-y-8">
        <section aria-label="Hero summary" className="section-enter">
          <ScrollReveal>
            <InteractiveSurface className="glass-strong card-primary rounded-3xl p-7 md:p-8 gradient-border overflow-hidden section-hover-reveal">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <p className="kicker-text">Portfolio Control</p>
                  <div>
                    <p className="text-base text-muted-foreground">Total Managed Value</p>
                    <p className="headline-xl font-mono text-foreground">${totalAum.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-xs border border-primary/40 bg-primary/10">{items.length} Portfolios</span>
                    <span className="px-3 py-1 rounded-full text-xs border border-border bg-secondary/30">Scenario: {featuredScenario?.name}</span>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-3 lg:pt-2">
                  <button onClick={() => navigate("/portfolio/create")} className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm interactive-cta">
                    + Create Portfolio
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="px-3 py-2.5 rounded-xl border border-border text-sm cursor-pointer bg-secondary/30 hover:bg-secondary/50 transition-all text-center">
                      Select CSV
                      <input type="file" accept=".csv" className="hidden" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
                    </label>
                    <button onClick={() => void importFromDashboard()} className="px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-secondary/40 transition-all">
                      Import CSV
                    </button>
                  </div>
                  {csvFile && <p className="text-xs text-muted-foreground max-w-full truncate" title={csvFile.name}>Selected: {csvFile.name}</p>}
                </div>
              </div>
            </InteractiveSurface>
          </ScrollReveal>
        </section>

        <section aria-label="Scenario navigator" className="section-enter-delayed">
          <ScrollReveal delay={0.05} className="glass-strong card-secondary rounded-2xl p-4 md:p-5 gradient-border overflow-hidden">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="eyebrow-label">Scenario Navigator</p>
              {!isCoarsePointer ? (
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scenarioCarouselApi?.scrollPrev()}
                  disabled={!canScrollPrev}
                  className="h-9 w-9 rounded-full border border-border bg-secondary/45 flex items-center justify-center text-foreground disabled:opacity-35 transition-all hover:border-primary/45 hover:bg-secondary/65"
                  aria-label="Previous scenario"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => scenarioCarouselApi?.scrollNext()}
                  disabled={!canScrollNext}
                  className="h-9 w-9 rounded-full border border-border bg-secondary/45 flex items-center justify-center text-foreground disabled:opacity-35 transition-all hover:border-primary/45 hover:bg-secondary/65"
                  aria-label="Next scenario"
                >
                  <ArrowRight size={16} />
                </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Tap to choose scenario</p>
              )}
            </div>

            {isCoarsePointer ? (
              <div className="space-y-2 py-1">
                {scenarios.map((scenario) => {
                  const isActive = featuredScenarioId === scenario.id;
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setFeaturedScenarioId(scenario.id)}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
                        isActive
                          ? "border-primary/60 bg-primary/12 shadow-[0_0_22px_hsl(var(--neon-blue)/0.18)]"
                          : "border-border bg-secondary/25"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-[1rem] font-semibold text-foreground">{scenario.name}</p>
                        {isActive ? <Check size={14} className="mt-0.5 text-primary" /> : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.description}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="w-full overflow-hidden" onWheel={handleScenarioWheel}>
                <Carousel
                  setApi={setScenarioCarouselApi}
                  opts={{ align: "center", containScroll: "trimSnaps", duration: 30 }}
                  onWheelCapture={handleScenarioWheel}
                  className="px-1 w-full min-w-0"
                >
                  <CarouselContent className="py-2">
                    {scenarios.map((scenario, index) => {
                      const isActive = featuredScenarioId === scenario.id;
                      return (
                        <CarouselItem key={scenario.id} className="basis-[85%] sm:basis-[70%] md:basis-[58%] lg:basis-[46%]">
                          <motion.div
                            animate={{ opacity: isActive ? 1 : 0.64, scale: isActive ? 1 : 0.95, y: isActive ? 0 : 4 }}
                            transition={{ duration: 0.32, ease: "easeOut" }}
                          >
                            <InteractiveSurface
                              onClick={() => {
                                setFeaturedScenarioId(scenario.id);
                                scenarioCarouselApi?.scrollTo(index);
                              }}
                              className={`rounded-2xl border px-4 py-4 cursor-pointer ${
                                isActive
                                  ? "border-primary/60 bg-primary/12 shadow-[0_0_30px_hsl(var(--neon-blue)/0.2)]"
                                  : "border-border bg-secondary/25 hover:border-primary/45"
                              }`}
                            >
                              <p className="font-display text-[1.1rem] font-semibold text-foreground">{scenario.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.description}</p>
                            </InteractiveSurface>
                          </motion.div>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                </Carousel>
              </div>
            )}

            <div className="mt-2 flex items-center justify-center gap-1.5">
              {scenarios.map((scenario) => {
                const active = scenario.id === featuredScenarioId;
                return (
                  <span
                    key={scenario.id}
                    className={`h-1.5 rounded-full transition-all ${active ? "w-6 bg-primary" : "w-2 bg-muted-foreground/45"}`}
                  />
                );
              })}
            </div>

            <div className="mt-4 panel-shell card-tertiary px-4 py-3 overflow-hidden">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="eyebrow-label">Featured Scenario</p>
                <p className="font-display text-base md:text-lg text-foreground">{featuredScenario?.name}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-secondary/40 text-sm hover:border-primary/45 hover:bg-secondary/65 transition-all">
                      Select Portfolios ({selectedPortfolioIdsForBulkApply.length})
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] glass-strong border-border/70 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">Apply To</p>
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {items.map((portfolio) => (
                        <label key={portfolio.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/20 px-2.5 py-2 text-sm">
                          <span className="truncate">{portfolio.name}</span>
                          <Checkbox
                            checked={selectedPortfolioIdsForBulkApply.includes(portfolio.id)}
                            onCheckedChange={(checked) => toggleSelectedPortfolioId(portfolio.id, checked === true)}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedPortfolioIdsForBulkApply(items.map((portfolio) => portfolio.id))}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPortfolioIdsForBulkApply([])}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <button
                  onClick={applyFeaturedScenarioToSelectedPortfolios}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary/90 text-primary-foreground text-sm interactive-cta"
                >
                  Apply To Selected
                </button>
              </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <section aria-label="Portfolio grid" className="space-y-4 section-enter-delayed">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="kicker-text">Portfolio Section</p>
              <h2 className="font-display text-[2.45rem] font-bold text-foreground">Your Portfolios</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="glass-strong card-tertiary rounded-xl p-8 text-muted-foreground">
              <div>
                <div className="flex items-center justify-center gap-3">
                  <BrandLottie size={54} className="shrink-0" />
                  <p>Loading portfolios...</p>
                </div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="glass-strong card-tertiary rounded-xl p-8 text-center space-y-2">
              <p className="text-lg font-semibold">No portfolios yet</p>
              <p className="text-sm text-muted-foreground">Create one manually or import from CSV to start simulation.</p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.08 } },
              }}
            >
              {items.map((portfolio, idx) => {
                const positive = portfolio.pnl >= 0;
                return (
                  <motion.div
                    key={portfolio.id}
                    variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <InteractiveSurface className="glass-strong card-tertiary rounded-xl p-5 space-y-4 border border-border hover:border-primary/40 transition-all overflow-hidden card-lift section-hover-reveal">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <h3 className="text-lg font-semibold text-foreground truncate" title={portfolio.name}>{portfolio.name}</h3>
                          <p className="text-xs text-muted-foreground">{portfolio.holdings.length} holdings • {portfolio.baseCurrency}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${positive ? "bg-neon-green/20 text-profit" : "bg-neon-red/20 text-loss"}`}>
                          {positive ? "+" : ""}{portfolio.pnlPercent.toFixed(2)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-secondary/40 p-3">
                          <p className="text-xs text-muted-foreground">Total Value</p>
                          <p className="font-mono text-foreground">${portfolio.totalValue.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/40 p-3">
                          <p className="text-xs text-muted-foreground">P&L</p>
                          <p className={`font-mono ${positive ? "text-profit" : "text-loss"}`}>{positive ? "+" : ""}${portfolio.pnl.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <PremiumSelect
                          value={selectedScenarioByPortfolio[portfolio.id] ?? scenarios[0].id}
                          options={scenarioSelectOptions}
                          searchable
                          onChange={(next) => setSelectedScenarioByPortfolio((prev) => ({ ...prev, [portfolio.id]: next }))}
                          open={openPortfolioScenarioDropdownId === portfolio.id}
                          onOpenChange={(open) => {
                            setOpenPortfolioScenarioDropdownId((current) => {
                              if (open) return portfolio.id;
                              return current === portfolio.id ? null : current;
                            });
                          }}
                          className="w-full sm:flex-1"
                        />
                        <button onClick={() => navigate(`/portfolio/edit/${portfolio.id}`)} className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border text-sm hover:border-primary/40 hover:bg-secondary/40 transition-all">
                          Edit
                        </button>
                        <button onClick={() => openSimulation(portfolio.id)} className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm interactive-cta">
                          Open Simulation
                        </button>
                      </div>
                    </InteractiveSurface>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </section>
      </main>
    </div>
  );
}
