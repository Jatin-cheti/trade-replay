import { AnimatePresence, motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AssetAvatar from "@/components/ui/AssetAvatar";
import { formatPrice } from "@/lib/numberFormat";

interface StickySymbolHeaderProps {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  iconUrl: string;
  activeTab: string;
  tabs: readonly string[];
  onTabChange: (tab: string) => void;
  onFullChart: () => void;
  /** ref to the hero section — when it leaves viewport, show sticky header */
  heroRef: React.RefObject<HTMLDivElement | null>;
}

function getTabSlug(tab: string): string {
  return tab.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function StickySymbolHeader({
  symbol,
  name,
  exchange,
  price,
  change,
  changePercent,
  currency,
  iconUrl,
  activeTab,
  tabs,
  onTabChange,
  onFullChart,
  heroRef,
}: StickySymbolHeaderProps) {
  const [visible, setVisible] = useState(false);
  const [navbarHeight, setNavbarHeight] = useState<number>(64);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Measure the app navbar height so the sticky header sits directly below it.
  useEffect(() => {
    const navEl = document.querySelector("nav");
    if (navEl) setNavbarHeight(navEl.getBoundingClientRect().height);
    const onResize = () => {
      const el = document.querySelector("nav");
      if (el) setNavbarHeight(el.getBoundingClientRect().height);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    // Use IntersectionObserver as the single source of truth for visibility —
    // a scroll listener that races with the observer was previously causing
    // the sticky header to flicker/hide unexpectedly on certain scroll positions.
    observerRef.current = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: `-${Math.max(navbarHeight, 48)}px 0px 0px 0px` }
    );
    observerRef.current.observe(el);
    return () => {
      observerRef.current?.disconnect();
    };
  }, [heroRef, navbarHeight]);

  const safeChangePercent = changePercent ?? 0;
  const isPositive = safeChangePercent > 0;
  const isNegative = safeChangePercent < 0;
  const priceColor = isPositive
    ? "text-emerald-400"
    : isNegative
    ? "text-red-400"
    : "text-muted-foreground";

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const lastIndex = tabs.length - 1;
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;

    const nextTab = tabs[nextIndex];
    onTabChange(nextTab);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed left-0 right-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl shadow-lg"
          style={{ willChange: "transform", top: navbarHeight }}
        >
          <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10">
            <div className="flex items-center h-12 gap-3">
              {/* Compact logo + info */}
              <AssetAvatar
                src={iconUrl}
                label={symbol}
                className="h-7 w-7 rounded-full border border-border/30 shrink-0"
              />
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-foreground truncate">{symbol}</span>
                <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[160px]">
                  {name}
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-medium bg-secondary/50 rounded px-1.5 py-0.5 border border-border/20 shrink-0">
                  {exchange}
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {price > 0 ? formatPrice(price) : "—"}
                </span>
                <span className="text-xs text-muted-foreground">{currency}</span>
                <span className={`text-xs font-semibold tabular-nums ${priceColor}`}>
                  {isPositive ? "+" : ""}
                  {safeChangePercent.toFixed(2)}%
                </span>
              </div>

              {/* Tabs — scrollable */}
              <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide ml-2">
                <div className="flex items-center gap-0" role="tablist" aria-label="Sticky symbol sections">
                  {tabs.map((tab, index) => {
                    const tabSlug = getTabSlug(tab);
                    const selected = activeTab === tab;
                    return (
                    <button
                      key={tab}
                      ref={(node) => { tabRefs.current[index] = node; }}
                      onClick={() => onTabChange(tab)}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      role="tab"
                      id={`sticky-tab-${tabSlug}`}
                      aria-controls={`symbol-panel-${tabSlug}`}
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      className={`relative px-3 h-12 text-xs font-medium whitespace-nowrap transition-colors ${
                        selected
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab}
                      {selected && (
                        <motion.div
                          layoutId="sticky-tab-indicator"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                          transition={{ type: "spring", stiffness: 450, damping: 30 }}
                        />
                      )}
                    </button>
                  );})}
                </div>
              </div>

              {/* Full chart CTA */}
              <button
                onClick={onFullChart}
                className="hidden md:flex shrink-0 items-center gap-1.5 rounded-md border border-border/40 px-3 h-7 text-xs font-medium text-foreground hover:bg-secondary/30 transition-colors"
              >
                <BarChart3 className="w-3 h-3" />
                Full chart
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
