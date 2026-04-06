import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { scenarios } from "@/data/stockData";
import { toast } from "sonner";
import BrandLottie from "@/components/BrandLottie";
import ScrollReveal from "@/components/ScrollReveal";
import InteractiveSurface from "@/components/ui/InteractiveSurface";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";

interface SavedPortfolio {
  id: string;
  name: string;
  baseCurrency: string;
  holdings: Array<{ symbol: string; quantity: number; avgPrice: number }>;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
}

export default function Dashboard() {
  const { username, logout } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedPortfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedScenarioByPortfolio, setSelectedScenarioByPortfolio] = useState<Record<string, string>>({});
  const [featuredScenarioId, setFeaturedScenarioId] = useState(scenarios[0]?.id ?? "2008-crash");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [scenarioCarouselApi, setScenarioCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const featuredScenario = scenarios.find((scenario) => scenario.id === featuredScenarioId) ?? scenarios[0];
  const featuredScenarioIndex = Math.max(0, scenarios.findIndex((scenario) => scenario.id === featuredScenarioId));

  const totalAum = useMemo(() => items.reduce((acc, portfolio) => acc + portfolio.totalValue, 0), [items]);

  const loadPortfolios = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<SavedPortfolio[]>("/portfolio");
      setItems(response.data);
      setSelectedScenarioByPortfolio((prev) => {
        const next = { ...prev };
        response.data.forEach((portfolio) => {
          if (!next[portfolio.id]) {
            next[portfolio.id] = scenarios[0]?.id ?? "2008-crash";
          }
        });
        return next;
      });
    } catch (_error) {
      toast.error("Failed to load saved portfolios");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPortfolios();
  }, []);

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

  const openSimulation = (portfolioId: string) => {
    const scenarioId = selectedScenarioByPortfolio[portfolioId] ?? scenarios[0].id;
    navigate(`/simulation?portfolioId=${portfolioId}&scenarioId=${scenarioId}`);
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
      <motion.header initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass sticky top-0 z-50 px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 backdrop-blur-xl">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <BrandLottie size={58} className="shrink-0 drop-shadow-[0_0_14px_hsl(var(--neon-blue)/0.26)]" />
          <div className="min-w-0">
            <p className="font-display font-bold text-[1.75rem] leading-none text-foreground tracking-tight">Trade Replay</p>
            <p className="text-base text-muted-foreground tracking-wide">Portfolio Command Center</p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-auto max-w-full">
          <span className="text-sm text-muted-foreground truncate">Welcome, <span className="text-foreground">{username || "Trader"}</span></span>
          <button onClick={() => { logout(); navigate("/"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Logout
          </button>
        </div>
      </motion.header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
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
                  {csvFile && <p className="text-xs text-muted-foreground">Selected: {csvFile.name}</p>}
                </div>
              </div>
            </InteractiveSurface>
          </ScrollReveal>
        </section>

        <section aria-label="Scenario navigator" className="section-enter-delayed">
          <ScrollReveal delay={0.05} className="glass-strong card-secondary rounded-2xl p-4 md:p-5 gradient-border overflow-hidden">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="eyebrow-label">Scenario Navigator</p>
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
            </div>

            <Carousel
              setApi={setScenarioCarouselApi}
              opts={{ align: "center", containScroll: "trimSnaps", duration: 30 }}
              className="px-1"
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 panel-shell card-tertiary px-4 py-3 overflow-hidden">
              <div>
                <p className="eyebrow-label">Featured Scenario</p>
                <p className="font-display text-base md:text-lg text-foreground">{featuredScenario?.name}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedScenarioByPortfolio((prev) => {
                    const next = { ...prev };
                    items.forEach((portfolio) => {
                      next[portfolio.id] = featuredScenarioId;
                    });
                    return next;
                  });
                  toast.success("Scenario applied to all portfolios");
                }}
                className="px-4 py-2 rounded-lg bg-primary/90 text-primary-foreground text-sm interactive-cta"
              >
                Apply To All Portfolios
              </button>
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
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{portfolio.name}</h3>
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

                      <div className="flex items-center gap-2">
                        <select
                          value={selectedScenarioByPortfolio[portfolio.id] ?? scenarios[0].id}
                          onChange={(e) => setSelectedScenarioByPortfolio((prev) => ({ ...prev, [portfolio.id]: e.target.value }))}
                          className="premium-select flex-1 px-3 py-2 rounded-lg text-sm"
                        >
                          {scenarios.map((scenario) => (
                            <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                          ))}
                        </select>
                        <button onClick={() => navigate(`/portfolio/edit/${portfolio.id}`)} className="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary/40 hover:bg-secondary/40 transition-all">
                          Edit
                        </button>
                        <button onClick={() => openSimulation(portfolio.id)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm interactive-cta">
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
