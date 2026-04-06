import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ArrowRight, TrendingUp, BarChart3, Shield } from "lucide-react";

const features = [
  { icon: TrendingUp, title: "Real-time Replay", desc: "Replay historical market scenarios tick-by-tick" },
  { icon: BarChart3, title: "Advanced Charts", desc: "TradingView-grade charts with drawing tools" },
  { icon: Shield, title: "Risk-free Trading", desc: "Practice strategies with zero financial risk" },
];

export default function Homepage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const navContainer = document.querySelector("nav > div") as HTMLElement | null;
    const navLinksCluster = navContainer?.children.item(1) as HTMLElement | null;
    if (!navLinksCluster) return;

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const applyMobileNavBehavior = () => {
      navLinksCluster.style.display = mediaQuery.matches ? "none" : "";
    };

    applyMobileNavBehavior();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyMobileNavBehavior);
      return () => {
        mediaQuery.removeEventListener("change", applyMobileNavBehavior);
        navLinksCluster.style.display = "";
      };
    }

    mediaQuery.addListener(applyMobileNavBehavior);
    return () => {
      mediaQuery.removeListener(applyMobileNavBehavior);
      navLinksCluster.style.display = "";
    };
  }, []);

  return (
    <div className="relative min-h-[calc(100svh-60px)] overflow-x-hidden">
      {/* Content */}
      <div className="relative z-[3] flex min-h-[calc(100svh-60px)] flex-col items-center justify-center px-6 py-8 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-4xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Live Market Simulation
          </motion.div>

          <h1 className="font-display text-foreground mb-5 leading-[1.02]"
              style={{ fontSize: "clamp(2.8rem, 5vw + 1rem, 5.2rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
            Master the Market.{" "}
            <span className="bg-gradient-to-r from-primary via-neon-cyan to-accent bg-clip-text text-transparent">
              Risk Nothing.
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed"
          >
            Replay real historical market crashes and rallies. Build portfolios, execute trades,
            and learn from the past — all without risking a single dollar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <button
              type="button"
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
              className="group relative inline-flex items-center gap-2.5 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_hsl(var(--neon-blue)/0.3)] transition-all hover:shadow-[0_0_50px_hsl(var(--neon-blue)/0.5)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Trading
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:bg-secondary/50 hover:border-primary/30"
            >
              View Dashboard
            </button>
          </motion.div>
        </motion.div>

        {/* Feature cards at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-10 flex w-full flex-col items-center gap-3 px-1 pb-2 sm:px-4 md:mt-12 md:flex-row md:justify-center md:gap-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + i * 0.1, duration: 0.4 }}
              className="glass-strong flex w-full max-w-[320px] items-center gap-3 rounded-xl px-5 py-3 md:max-w-[260px]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <f.icon size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-tight">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
