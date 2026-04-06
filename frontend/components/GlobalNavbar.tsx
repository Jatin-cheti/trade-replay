import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LogOut, Settings, User, Sun, Moon, Menu, X, ChevronDown } from "lucide-react";
import BrandLottie from "@/components/BrandLottie";

interface NavItem {
  label: string;
  action: () => void;
  activeMatch: (pathname: string, hash: string) => boolean;
}

interface FeatureMenuItem {
  label: string;
  action: () => void;
}

export default function GlobalNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, username, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 22);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goHome = useCallback(() => {
    if (location.pathname !== "/" && location.pathname !== "/homepage") {
      navigate("/");
      return;
    }

    if (location.hash) {
      navigate("/", { replace: true });
    }

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
    setFeaturesOpen(false);
  }, [location.pathname, location.hash]);

  const homeNavItem = useMemo<NavItem>(() => (
    {
      label: "Home",
      action: goHome,
      activeMatch: (pathname, hash) => (pathname === "/" || pathname === "/homepage") && hash !== "#markets",
    }
  ), [goHome]);

  const loggedInNavItems: NavItem[] = useMemo(() => {
    return [
      { label: "Dashboard", action: () => navigate("/dashboard"), activeMatch: (pathname) => pathname.startsWith("/dashboard") },
      { label: "Portfolio", action: () => navigate("/portfolio/create"), activeMatch: (pathname) => pathname.startsWith("/portfolio") },
      { label: "Scenarios", action: () => navigate("/simulation"), activeMatch: (pathname) => pathname.startsWith("/simulation") },
      {
        label: "Live Market",
        action: () => navigate("/live-market"),
        activeMatch: (pathname) => pathname.startsWith("/live-market"),
      },
    ];
  }, [navigate]);

  const featureMenuItems: FeatureMenuItem[] = useMemo(() => (
    [
      { label: "Dashboard", action: () => navigate("/dashboard") },
      { label: "Portfolio", action: () => navigate("/portfolio/create") },
      { label: "Assets", action: () => navigate("/portfolio/create") },
      { label: "Scenarios", action: () => navigate("/simulation") },
    ]
  ), [navigate]);

  const mobilePrimaryNavItems: NavItem[] = useMemo(() => {
    if (!isAuthenticated) {
      return [homeNavItem];
    }

    return loggedInNavItems;
  }, [homeNavItem, isAuthenticated, loggedInNavItems]);

  const runFeatureMenuAction = useCallback((action: () => void) => {
    setFeaturesOpen(false);
    setMobileFeaturesOpen(false);
    setMobileMenuOpen(false);
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    action();
  }, [isAuthenticated, navigate]);

  const runMobileItemAction = useCallback((action: () => void) => {
    setMobileMenuOpen(false);
    setMobileFeaturesOpen(false);
    action();
  }, []);

  const desktopTabClasses = (active: boolean) => {
    return `relative rounded-xl px-1 py-1 text-sm font-medium tracking-wide transition-colors duration-200 ${
      active
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;
  };

  const loginActive = location.pathname.startsWith("/login");
  const signupActive = location.pathname.startsWith("/signup");

  return (
    <>
      <motion.nav
        initial={{ y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`glass sticky top-0 z-50 px-4 md:px-6 py-3.5 backdrop-blur-xl border-b border-primary/25 shadow-[0_8px_28px_hsl(var(--background)/0.45)] transition-colors duration-300 ${
          scrolled ? "bg-background/65" : "bg-background/45"
        }`}
      >
        <div className="relative z-[2] mx-auto flex w-full max-w-[1200px] items-center justify-between gap-2 md:gap-4">
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

          <div className="hidden md:flex items-center gap-4 lg:gap-6 rounded-2xl border border-border/55 bg-secondary/35 px-4 py-2">
            {!isAuthenticated ? (
              <div className="flex items-center gap-4 lg:gap-6">
                {[homeNavItem].map((item) => {
                  const active = item.activeMatch(location.pathname, location.hash);
                  return (
                    <button key={item.label} type="button" onClick={item.action} className={desktopTabClasses(active)}>
                      {active && (
                        <motion.span
                          layoutId="global-nav-active"
                          className="absolute inset-0 -z-10 rounded-xl border border-primary/35 bg-primary/20 shadow-[0_0_16px_hsl(var(--neon-blue)/0.24)]"
                          transition={{ duration: 0.24, ease: "easeOut" }}
                        />
                      )}
                      <span className="relative z-10 px-2 py-1">{item.label}</span>
                    </button>
                  );
                })}

                <Popover open={featuresOpen} onOpenChange={setFeaturesOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Open features menu"
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${
                        featuresOpen
                          ? "border border-primary/35 bg-primary/20 text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Features
                      <ChevronDown size={15} className={`transition-transform duration-200 ${featuresOpen ? "rotate-180" : "rotate-0"}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="center"
                    sideOffset={10}
                    className="w-56 border-primary/30 bg-background/90 p-2 backdrop-blur-xl"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-1"
                    >
                      {featureMenuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => runFeatureMenuAction(item.action)}
                          className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium tracking-wide text-foreground/90 transition-colors hover:bg-secondary/45 hover:text-foreground"
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="flex items-center gap-4 lg:gap-6">
                {loggedInNavItems.map((item) => {
                  const active = item.activeMatch(location.pathname, location.hash);
                  return (
                    <button key={item.label} type="button" onClick={item.action} className={desktopTabClasses(active)}>
                      {active && (
                        <motion.span
                          layoutId="global-nav-active"
                          className="absolute inset-0 -z-10 rounded-xl border border-primary/35 bg-primary/20 shadow-[0_0_16px_hsl(var(--neon-blue)/0.24)]"
                          transition={{ duration: 0.24, ease: "easeOut" }}
                        />
                      )}
                      <span className="relative z-10 px-2 py-1">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu overlay"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.aside
              className="fixed right-0 top-0 z-[80] h-[100dvh] w-[min(86vw,320px)] border-l border-primary/25 bg-background/85 p-4 shadow-[-18px_0_40px_hsl(var(--background)/0.45)] backdrop-blur-xl md:hidden"
              initial={{ x: "100%", opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.8 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold tracking-wide text-foreground">Navigation</p>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-foreground transition-all hover:bg-primary/20"
                  aria-label="Close navigation menu"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="space-y-2">
                {mobilePrimaryNavItems.map((item) => {
                  const active = item.activeMatch(location.pathname, location.hash);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => runMobileItemAction(item.action)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium tracking-wide transition-all ${
                        active
                          ? "border border-primary/35 bg-primary/20 text-foreground"
                          : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}

                {!isAuthenticated && (
                  <div className="rounded-xl border border-border/60 bg-secondary/20">
                    <button
                      type="button"
                      onClick={() => setMobileFeaturesOpen((prev) => !prev)}
                      aria-expanded={mobileFeaturesOpen}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium tracking-wide text-foreground transition-colors hover:bg-secondary/45"
                    >
                      <span>Features</span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${mobileFeaturesOpen ? "rotate-180" : "rotate-0"}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {mobileFeaturesOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: -6, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="space-y-1 overflow-hidden border-t border-border/60 px-2 py-2"
                        >
                          {featureMenuItems.map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => runFeatureMenuAction(item.action)}
                              className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
                            >
                              {item.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                      navigate("/");
                    }}
                    className="mt-2 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-400 transition-all hover:bg-red-500/10"
                  >
                    Logout
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => runMobileItemAction(() => navigate("/login"))}
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-secondary/45 hover:text-foreground"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => runMobileItemAction(() => navigate("/signup"))}
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:bg-secondary/45 hover:text-foreground"
                    >
                      Signup
                    </button>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
