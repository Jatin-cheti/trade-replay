import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LogOut, Settings, User, Sun, Moon, Menu, ChevronDown, ChevronRight, BarChart3, LayoutGrid, LineChart, Briefcase, Search, Globe } from "lucide-react";
import BrandLottie from "@/components/BrandLottie";
import { MobileNavDrawer } from "./MobileNavDrawer";
import type { NavItem, FeatureMenuItem, MarketSection } from "./MobileNavDrawer";

const PRODUCTS_SCREENER_ITEMS: FeatureMenuItem[] = [
  { label: "Stocks", path: "/screener/stocks" },
  { label: "ETFs", path: "/screener/etfs" },
  { label: "Bonds", path: "/screener/bonds" },
  { label: "Crypto coins", path: "/screener/crypto-coins" },
  { label: "CEX pairs", path: "/screener/cex-pairs" },
  { label: "DEX pairs", path: "/screener/dex-pairs" },
  { label: "Indices", path: "/screener/indices" },
  { label: "Futures", path: "/screener/futures" },
  { label: "Forex", path: "/screener/forex" },
  { label: "Options", path: "/screener/options" },
];

const PRODUCTS_HEATMAP_ITEMS: FeatureMenuItem[] = [
  { label: "Stocks", path: "/heatmap?type=stock" },
  { label: "ETFs", path: "/heatmap?type=etf" },
  { label: "Crypto coins", path: "/heatmap?type=crypto" },
];

/* ── Markets menu data (geo-aware) ───────────────────────────────────── */
const MARKETS_SECTIONS: MarketSection[] = [
  {
    label: "\u{1F1EE}\u{1F1F3} India",
    items: [
      { label: "Stocks", path: "/screener/stocks?marketCountries=IN" },
      { label: "Indices", path: "/screener/stocks?indices=NIFTY" },
      { label: "ETFs", path: "/screener/etfs?marketCountries=IN" },
      { label: "Bonds", path: "/screener/bonds?marketCountries=IN" },
    ],
  },
  {
    label: "\u{1F1FA}\u{1F1F8} United States",
    items: [
      { label: "Stocks", path: "/screener/stocks?marketCountries=US" },
      { label: "ETFs", path: "/screener/etfs?marketCountries=US" },
      { label: "Indices", path: "/screener/stocks?indices=SPX" },
      { label: "Bonds", path: "/screener/bonds?marketCountries=US" },
    ],
  },
  {
    label: "Global",
    items: [
      { label: "Crypto coins", path: "/screener/crypto-coins" },
      { label: "CEX pairs", path: "/screener/cex-pairs" },
      { label: "DEX pairs", path: "/screener/dex-pairs" },
      { label: "Bonds", path: "/screener/bonds" },
      { label: "Stocks", path: "/screener/stocks?marketCountries=WORLD" },
      { label: "ETFs", path: "/screener/etfs?marketCountries=WORLD" },
      { label: "Indices", path: "/screener/indices" },
      { label: "Options", path: "/screener/options" },
      { label: "Futures", path: "/screener/futures" },
      { label: "Forex", path: "/screener/forex" },
    ],
  },
];

export default function GlobalNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, username, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [screenerOpen, setScreenerOpen] = useState(false);
  const [marketsOpen, setMarketsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const screenerMenuRef = useRef<HTMLDivElement | null>(null);

  const goToAuthGate = useCallback((targetPath: string, mode: "login" | "signup" = "login") => {
    const redirect = encodeURIComponent(targetPath);
    navigate(`/${mode}?redirect=${redirect}`);
  }, [navigate]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 22);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const updateHeightVar = (height: number) => {
      document.documentElement.style.setProperty("--navbar-height", `${Math.ceil(height)}px`);
    };
    updateHeightVar(nav.getBoundingClientRect().height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateHeightVar(entry.contentRect.height);
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  const goHome = useCallback(() => {
    if (location.pathname !== "/" && location.pathname !== "/homepage") {
      navigate("/");
      return;
    }
    if (location.hash) navigate("/", { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.hash, location.pathname, navigate]);

  const goToHash = useCallback((hash: string) => {
    const onHomepage = location.pathname === "/" || location.pathname === "/homepage";
    if (!onHomepage) {
      navigate(`/${hash}`);
      return;
    }
    const target = document.querySelector(hash);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileFeaturesOpen(false);
    setProductsOpen(false);
    setScreenerOpen(false);
    setMarketsOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!productsOpen) {
      setScreenerOpen(false);
    }
  }, [productsOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!screenerOpen || !screenerMenuRef.current) return;
      const target = event.target as Node;
      const button = screenerMenuRef.current.querySelector("button[type='button']");
      if (button && button.contains(target)) return;
      const submenu = screenerMenuRef.current.querySelector("div[class*='absolute']");
      if (submenu && submenu.contains(target)) return;
      setScreenerOpen(false);
    };

    if (screenerOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [screenerOpen]);

  const homeNavItem = useMemo<NavItem>(() => ({
    label: "Home",
    action: goHome,
    activeMatch: (pathname, hash) => (pathname === "/" || pathname === "/homepage") && hash !== "#markets",
  }), [goHome]);

  const loggedInNavItems: NavItem[] = useMemo(() => [], []);

  const featureMenuItems: FeatureMenuItem[] = useMemo(() => ([
    { label: "Supercharts", path: "/simulation" },
    { label: "Portfolio", path: "/portfolio/create" },
    { label: "Dashboard", path: "/dashboard" },
    { label: "Live Market", path: "/live-market" },
  ]), []);

  const mobilePrimaryNavItems: NavItem[] = useMemo(() => {
    if (!isAuthenticated) return [homeNavItem];
    return [homeNavItem];
  }, [homeNavItem, isAuthenticated]);

  const runFeatureMenuAction = useCallback((targetPath: string) => {
    setProductsOpen(false);
    setScreenerOpen(false);
    setMarketsOpen(false);
    setMobileFeaturesOpen(false);
    setMobileMenuOpen(false);
    if (!isAuthenticated && (targetPath.startsWith("/simulation") || targetPath.startsWith("/portfolio") || targetPath.startsWith("/live-market"))) {
      goToAuthGate(targetPath);
      return;
    }
    navigate(targetPath);
  }, [goToAuthGate, isAuthenticated, navigate]);

  const runMobileItemAction = useCallback((action: () => void) => {
    setMobileMenuOpen(false);
    setMobileFeaturesOpen(false);
    action();
  }, []);

  const loginActive = location.pathname.startsWith("/login");
  const signupActive = location.pathname.startsWith("/signup");

  const isProductsActive = productsOpen || location.pathname.startsWith("/simulation") || location.pathname.startsWith("/portfolio");
  const isMarketsActive = marketsOpen || location.pathname.startsWith("/screener") || location.pathname.startsWith("/symbol");

  return (
    <>
      <motion.nav
        ref={navRef}
        initial={{ y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`glass sticky top-0 z-50 px-4 md:px-6 py-3.5 backdrop-blur-xl border-b border-primary/25 shadow-[0_8px_28px_hsl(var(--background)/0.45)] transition-colors duration-300 ${
          scrolled ? "bg-background/65" : "bg-background/45"
        }`}
      >
        <div className="relative z-[2] mx-auto flex w-full max-w-[1200px] items-center justify-between gap-2 md:gap-4">
          {/* Logo */}
          <button
            type="button"
            onClick={goHome}
            className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 font-semibold tracking-wide text-foreground/95 transition-colors hover:text-foreground sm:gap-3"
          >
            <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
              <BrandLottie size={52} className="shrink-0 drop-shadow-[0_0_12px_hsl(var(--neon-blue)/0.24)]" />
            </motion.div>
            <span className="font-display text-[1.1rem] leading-none font-bold text-foreground tracking-wide whitespace-nowrap sm:text-[1.5rem]">Trade Replay</span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2 rounded-2xl border border-border/55 bg-secondary/35 px-3 py-2">
            {/* Products Dropdown */}
            <Popover open={productsOpen} onOpenChange={setProductsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${
                    isProductsActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Products
                  <ChevronDown size={14} className={`transition-transform duration-200 ${productsOpen ? "rotate-180" : ""}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={10}
                className="w-[520px] border-primary/30 bg-background/95 p-0 backdrop-blur-xl"
              >
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex"
                >
                  {/* Left column */}
                  <div className="flex-1 p-3 border-r border-border/30">
                    <button type="button" onClick={() => runFeatureMenuAction("/simulation")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-secondary/45 group">
                      <LineChart size={18} className="text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Supercharts</p>
                        <p className="text-xs text-muted-foreground">The one terminal to rule them all</p>
                      </div>
                    </button>

                    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Individual Tools</p>

                    <div className="relative" ref={screenerMenuRef}>
                      <button
                        type="button"
                        onClick={() => setScreenerOpen((open) => !open)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground/90 transition-colors hover:bg-secondary/45"
                      >
                        <span className="flex items-center gap-3"><Search size={16} className="text-muted-foreground shrink-0" />Screeners</span>
                        <ChevronRight size={14} className={`transition-transform duration-200 ${screenerOpen ? "rotate-90" : ""} text-muted-foreground/50`} />
                      </button>

                      {screenerOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-full top-0 z-50 ml-1 w-64 rounded-lg border border-primary/30 bg-background/95 p-2 backdrop-blur-xl"
                        >
                          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Screeners</p>
                          {PRODUCTS_SCREENER_ITEMS.map((item) => (
                            <button key={item.label} type="button" onClick={() => runFeatureMenuAction(item.path)}
                              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-secondary/45 hover:text-foreground">
                              {item.label}
                            </button>
                          ))}

                          <div className="my-2 h-px bg-border/40" />

                          <p className="px-2 pb-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Heat Maps</p>
                          {PRODUCTS_HEATMAP_ITEMS.map((item) => (
                            <button key={item.label} type="button" onClick={() => runFeatureMenuAction(item.path)}
                              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-secondary/45 hover:text-foreground">
                              {item.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                    {[
                      { label: "Portfolio", icon: Briefcase, path: "/portfolio/create" },
                      { label: "Dashboard", icon: LayoutGrid, path: "/dashboard" },
                      { label: "Live Market", icon: BarChart3, path: "/live-market" },
                    ].map((item) => (
                      <button key={item.label} type="button" onClick={() => runFeatureMenuAction(item.path)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground/90 transition-colors hover:bg-secondary/45 hover:text-foreground">
                        <item.icon size={16} className="text-muted-foreground shrink-0" />
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Right column — quick actions */}
                  <div className="w-[200px] p-3">
                    <p className="px-2 pb-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Quick Links</p>
                    {[
                      { label: "Top Gainers", path: "/screener/stocks?sort=changePercent&order=desc" },
                      { label: "Top Losers", path: "/screener/stocks?sort=changePercent&order=asc" },
                      { label: "Most Active", path: "/screener/stocks?sort=volume&order=desc" },
                      { label: "Crypto Overview", path: "/screener/crypto-coins" },
                      { label: "ETF Explorer", path: "/screener/etfs" },
                    ].map((item) => (
                      <button key={item.label} type="button" onClick={() => runFeatureMenuAction(item.path)}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-secondary/45 hover:text-foreground">
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </PopoverContent>
            </Popover>

            {/* Markets Dropdown */}
            <Popover open={marketsOpen} onOpenChange={setMarketsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${
                    isMarketsActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Markets
                  <ChevronDown size={14} className={`transition-transform duration-200 ${marketsOpen ? "rotate-180" : ""}`} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={10}
                className="w-[380px] border-primary/30 bg-background/95 p-0 backdrop-blur-xl"
              >
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="p-3"
                >
                  {MARKETS_SECTIONS.map((section) => (
                    <div key={section.label} className="mb-2 last:mb-0">
                      <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                        {section.label}
                      </p>
                      <div className="grid grid-cols-2 gap-0.5">
                        {section.items.map((item) => (
                          <button
                            key={item.path}
                            type="button"
                            onClick={() => runFeatureMenuAction(item.path)}
                            className="flex items-center rounded-lg px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-secondary/45 hover:text-foreground"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2.5 md:gap-3">
            <motion.button
              type="button"
              onClick={toggleTheme}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-foreground transition-all hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_16px_hsl(var(--neon-blue)/0.3)]"
              aria-label="Toggle theme"
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {!isAuthenticated && (
              <div className="hidden md:flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium tracking-wide transition-colors ${
                    loginActive
                      ? "border border-primary/35 bg-primary/20 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium tracking-wide transition-colors ${
                    signupActive
                      ? "border border-primary/35 bg-primary/20 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground"
                  }`}
                >
                  Signup
                </button>
              </div>
            )}

            {isAuthenticated && (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary ring-2 ring-primary/30 transition-all hover:ring-primary/60 md:hidden"
                  aria-label="Profile"
                >
                  {(username || "T").charAt(0).toUpperCase()}
                </button>

                <Popover open={profileOpen} onOpenChange={setProfileOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="hidden h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary ring-2 ring-primary/30 transition-all hover:ring-primary/60 md:flex"
                      aria-label="Profile menu"
                    >
                      {(username || "T").charAt(0).toUpperCase()}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={8} className="w-52 border-border/80 bg-background/95 p-1.5 backdrop-blur-xl">
                    <p className="px-3 py-2 text-xs text-muted-foreground truncate">{username || "Trader"}</p>
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); navigate("/dashboard"); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/45"
                    >
                      <User size={14} />
                      My Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/45"
                    >
                      <Settings size={14} />
                      Settings
                    </button>
                    <div className="my-1 h-px bg-border/60" />
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); logout(); navigate("/"); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <LogOut size={14} />
                      Logout
                    </button>
                  </PopoverContent>
                </Popover>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-foreground transition-all hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_16px_hsl(var(--neon-blue)/0.3)] md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={17} />
            </button>
          </div>
        </div>
      </motion.nav>

      <MobileNavDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        mobilePrimaryNavItems={mobilePrimaryNavItems}
        mobileFeaturesOpen={mobileFeaturesOpen}
        setMobileFeaturesOpen={setMobileFeaturesOpen}
        isAuthenticated={isAuthenticated}
        featureMenuItems={featureMenuItems}
        screenerMenuItems={PRODUCTS_SCREENER_ITEMS}
        heatmapMenuItems={PRODUCTS_HEATMAP_ITEMS}
        marketSections={MARKETS_SECTIONS}
        runFeatureMenuAction={runFeatureMenuAction}
        runMobileItemAction={runMobileItemAction}
        pathname={location.pathname}
        hash={location.hash}
        logout={logout}
        navigate={navigate}
      />
    </>
  );
}
