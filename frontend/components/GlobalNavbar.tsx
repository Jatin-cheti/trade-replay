import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LogOut, Settings, User, Sun, Moon } from "lucide-react";
import BrandLottie from "@/components/BrandLottie";

interface NavItem {
  label: string;
  action: () => void;
  activeMatch: (pathname: string, hash: string) => boolean;
}

export default function GlobalNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, username, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 22);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goToHash = (hash: string) => {
    if (location.pathname !== "/") {
      navigate(`/${hash}`);
      return;
    }

    if (location.hash !== hash) {
      window.history.replaceState(null, "", `${location.pathname}${hash}`);
    }

    const target = document.querySelector(hash);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const navItems: NavItem[] = useMemo(() => {
    if (!isAuthenticated) {
      return [
        {
          label: "Home",
          action: () => {
            navigate("/");
            if (location.hash) {
              window.history.replaceState(null, "", "/");
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
          },
          activeMatch: (pathname, hash) => (pathname === "/" || pathname === "/homepage") && hash === "",
        },
        {
          label: "Features",
          action: () => goToHash("#features"),
          activeMatch: (pathname, hash) => (pathname === "/" || pathname === "/homepage") && hash === "#features",
        },
        {
          label: "Markets",
          action: () => goToHash("#markets"),
          activeMatch: (pathname, hash) => (pathname === "/" || pathname === "/homepage") && hash === "#markets",
        },
        { label: "Login", action: () => navigate("/login"), activeMatch: (pathname) => pathname.startsWith("/login") },
        { label: "Signup", action: () => navigate("/signup"), activeMatch: (pathname) => pathname.startsWith("/signup") },
      ];
    }

    return [
      { label: "Home", action: () => navigate("/"), activeMatch: (pathname) => pathname === "/" || pathname === "/homepage" },
      { label: "Dashboard", action: () => navigate("/dashboard"), activeMatch: (pathname) => pathname.startsWith("/dashboard") },
      { label: "Portfolio", action: () => navigate("/portfolio/create"), activeMatch: (pathname) => pathname.startsWith("/portfolio") },
      { label: "Scenarios", action: () => navigate("/simulation"), activeMatch: (pathname) => pathname.startsWith("/simulation") },
    ];
  }, [goToHash, isAuthenticated, location.hash, location.pathname, navigate]);

  return (
    <motion.nav
      initial={{ y: -14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`glass sticky top-0 z-50 px-4 md:px-6 py-3.5 backdrop-blur-xl border-b border-primary/25 shadow-[0_8px_28px_hsl(var(--background)/0.45)] transition-colors duration-300 ${
        scrolled ? "bg-background/65" : "bg-background/45"
      }`}
    >
      <div className="relative z-[2] mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 rounded-xl px-1 py-1 font-semibold tracking-wide text-foreground/95 transition-colors hover:text-foreground"
        >
          <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
            <BrandLottie size={52} className="shrink-0 drop-shadow-[0_0_12px_hsl(var(--neon-blue)/0.24)]" />
          </motion.div>
          <span className="font-display text-[1.1rem] sm:text-[1.32rem] md:text-[1.5rem] leading-tight font-bold text-foreground tracking-wide">Trade Replay</span>
        </button>

        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-xl bg-secondary/35 p-1.5">
          {navItems.map((item) => {
            const active = item.activeMatch(location.pathname, location.hash);
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`relative rounded-lg px-3 py-2 text-xs sm:px-4 sm:text-sm font-medium transition-all ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:drop-shadow-[0_0_8px_hsl(var(--neon-cyan)/0.4)]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="global-nav-active"
                    className="absolute inset-0 -z-10 rounded-lg border border-primary/35 bg-primary/20 shadow-[0_0_16px_hsl(var(--neon-blue)/0.24)]"
                    transition={{ duration: 0.24, ease: "easeOut" }}
                  />
                )}
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
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

          {isAuthenticated && (
            <Popover open={profileOpen} onOpenChange={setProfileOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary ring-2 ring-primary/30 transition-all hover:ring-primary/60"
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
          )}
        </div>
      </div>
    </motion.nav>
  );
}
