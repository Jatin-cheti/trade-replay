import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { flushSync } from "react-dom";
import { useApp } from "@/context/AppContext";
import { api, getApiErrorMessage } from "@/lib/api";
import { scenarios } from "@/data/stockData";
import { toast } from "sonner";
import type { CarouselApi } from "@/components/ui/carousel";

export interface SavedPortfolio {
  id: string;
  name: string;
  baseCurrency: string;
  holdings: Array<{ symbol: string; quantity: number; avgPrice: number }>;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
}

export function useDashboard() {
  const { isAuthenticated } = useApp();
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

  const featuredScenario = scenarios.find((s) => s.id === featuredScenarioId) ?? scenarios[0];
  const featuredScenarioIndex = Math.max(0, scenarios.findIndex((s) => s.id === featuredScenarioId));
  const scenarioSelectOptions = useMemo(
    () => scenarios.map((s) => ({ value: s.id, label: s.name, subtitle: s.description })),
    []
  );
  const totalAum = useMemo(() => items.reduce((acc, p) => acc + p.totalValue, 0), [items]);

  const loadPortfolios = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<SavedPortfolio[]>("/portfolio");
      setItems(response.data);
      setSelectedPortfolioIdsForBulkApply(response.data.map((p) => p.id));
      setSelectedScenarioByPortfolio((prev) => {
        const next = { ...prev };
        response.data.forEach((p) => {
          if (!next[p.id]) next[p.id] = scenarios[0]?.id ?? "2008-crash";
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    if (!openPortfolioScenarioDropdownId) return;
    let closed = false;
    const isInsidePremiumSelectContent = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      const el = target instanceof Element ? target : (target as Node as Element & { parentElement: Element | null }).parentElement;
      return !!el?.closest('[data-premium-select-content="true"]');
    };
    const closeNow = (event?: Event) => {
      if (closed) return;
      if (event && isInsidePremiumSelectContent(event.target)) return;
      closed = true;
      flushSync(() => setOpenPortfolioScenarioDropdownId(null));
    };
    window.addEventListener("wheel", closeNow, { capture: true, passive: true });
    window.addEventListener("touchmove", closeNow, { capture: true, passive: true });
    window.addEventListener("scroll", closeNow, { passive: true });
    window.addEventListener("resize", closeNow);
    return () => {
      window.removeEventListener("wheel", closeNow, true);
      window.removeEventListener("touchmove", closeNow, true);
      window.removeEventListener("scroll", closeNow);
      window.removeEventListener("resize", closeNow);
    };
  }, [openPortfolioScenarioDropdownId]);

  useEffect(() => {
    if (!scenarioCarouselApi) return;
    const sync = () => {
      setCanScrollPrev(scenarioCarouselApi.canScrollPrev());
      setCanScrollNext(scenarioCarouselApi.canScrollNext());
      const snap = scenarioCarouselApi.selectedScrollSnap();
      const s = scenarios[snap];
      if (s && s.id !== featuredScenarioId) setFeaturedScenarioId(s.id);
    };
    sync();
    scenarioCarouselApi.on("select", sync);
    scenarioCarouselApi.on("reInit", sync);
    return () => {
      scenarioCarouselApi.off("select", sync);
      scenarioCarouselApi.off("reInit", sync);
    };
  }, [scenarioCarouselApi, featuredScenarioId]);

  useEffect(() => {
    if (!scenarioCarouselApi) return;
    if (scenarioCarouselApi.selectedScrollSnap() !== featuredScenarioIndex) {
      scenarioCarouselApi.scrollTo(featuredScenarioIndex);
    }
  }, [scenarioCarouselApi, featuredScenarioIndex]);

  const handleScenarioWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (isCoarsePointer || !scenarioCarouselApi) return;
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 6) return;
      if (delta > 0) {
        if (!scenarioCarouselApi.canScrollNext()) return;
        event.preventDefault();
        scenarioCarouselApi.scrollNext();
        return;
      }
      if (!scenarioCarouselApi.canScrollPrev()) return;
      event.preventDefault();
      scenarioCarouselApi.scrollPrev();
    },
    [isCoarsePointer, scenarioCarouselApi]
  );

  const openSimulation = (portfolioId: string) => {
    const scenarioId = selectedScenarioByPortfolio[portfolioId] ?? scenarios[0].id;
    navigate(`/simulation?portfolioId=${portfolioId}&scenarioId=${scenarioId}`);
  };

  const toggleSelectedPortfolioId = (portfolioId: string, checked: boolean) => {
    setSelectedPortfolioIdsForBulkApply((prev) => {
      if (checked) return prev.includes(portfolioId) ? prev : [...prev, portfolioId];
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
      items.forEach((p) => { if (selected.has(p.id)) next[p.id] = featuredScenarioId; });
      return next;
    });
    toast.success(`Scenario applied to ${selectedPortfolioIdsForBulkApply.length} selected portfolio(s)`);
  };

  const importFromDashboard = async () => {
    if (!csvFile) { toast.error("Please choose a CSV file first"); return; }
    try {
      const form = new FormData();
      form.append("file", csvFile);
      form.append("name", `Imported ${new Date().toLocaleDateString()}`);
      await api.post("/portfolio/import", form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Portfolio imported");
      setCsvFile(null);
      await loadPortfolios();
    } catch (_error) {
      toast.error("CSV import failed");
    }
  };

  return {
    isAuthenticated, navigate, items, isLoading, csvFile, setCsvFile,
    scenarioCarouselApi, setScenarioCarouselApi, canScrollPrev, canScrollNext,
    isCoarsePointer, selectedPortfolioIdsForBulkApply, setSelectedPortfolioIdsForBulkApply,
    openPortfolioScenarioDropdownId, setOpenPortfolioScenarioDropdownId,
    featuredScenarioId, setFeaturedScenarioId, featuredScenario,
    scenarioSelectOptions, selectedScenarioByPortfolio, setSelectedScenarioByPortfolio,
    totalAum, handleScenarioWheel, openSimulation,
    toggleSelectedPortfolioId, applyFeaturedScenarioToSelectedPortfolios, importFromDashboard,
  };
}