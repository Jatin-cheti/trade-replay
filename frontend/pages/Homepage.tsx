import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ArrowRight, TrendingUp, BarChart3, Shield } from "lucide-react";
import GlobalNavbar from "@/components/GlobalNavbar";

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
  setOptions: (options: Record<string, unknown>) => void;
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
      if (existing.dataset.loaded === "true") { resolve(); return; }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed loading ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.vantaSrc = src;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed loading ${src}`)), { once: true });
    document.head.appendChild(script);
  });

const features = [
  { icon: TrendingUp, title: "Real-time Replay", desc: "Replay historical market scenarios tick-by-tick" },
  { icon: BarChart3, title: "Advanced Charts", desc: "TradingView-grade charts with drawing tools" },
  { icon: Shield, title: "Risk-free Trading", desc: "Practice strategies with zero financial risk" },
];

export default function Homepage() {
  const birdsRef = useRef<HTMLDivElement | null>(null);
  const cloudsRef = useRef<HTMLDivElement | null>(null);
  const birdsEffectRef = useRef<VantaEffect | null>(null);
  const cloudsEffectRef = useRef<VantaEffect | null>(null);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [vantaReady, setVantaReady] = useState(false);

  const initVanta = useCallback(async (isDark: boolean) => {
    // Destroy old effects
    birdsEffectRef.current?.destroy();
    birdsEffectRef.current = null;
    cloudsEffectRef.current?.destroy();
    cloudsEffectRef.current = null;
    setVantaReady(false);

    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js");
    await Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.birds.min.js"),
      loadScript("https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js"),
    ]);

    // Clouds (background layer)
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

    // Birds (foreground layer)
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

    setVantaReady(true);
  }, []);

  useEffect(() => {
    document.body.classList.add("homepage-cinematic");
    return () => document.body.classList.remove("homepage-cinematic");
  }, []);

  useEffect(() => {
    const isDark = theme === "dark";
    initVanta(isDark).catch(() => undefined);
    return () => {
      birdsEffectRef.current?.destroy();
      birdsEffectRef.current = null;
      cloudsEffectRef.current?.destroy();
      cloudsEffectRef.current = null;
    };
  }, [theme, initVanta]);

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden">
      {/* Vanta loading overlay */}
      <AnimatePresence>
        {!vantaReady && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-[10] flex items-center justify-center bg-background"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <TrendingUp size={20} className="text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground tracking-wide">Loading experience...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clouds layer (background) */}
      <div ref={cloudsRef} className="absolute inset-0 z-0" />

      {/* Birds layer (foreground) — dark: screen blend on black bg, light: multiply blend on white bg */}
      <div
        ref={birdsRef}
        className={`absolute inset-0 z-[1] ${theme === "dark" ? "mix-blend-screen" : "mix-blend-multiply"}`}
        style={{ background: "transparent" }}
      />

      {/* Gradient overlay for contrast */}
      <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-b from-transparent via-transparent to-background/80" />

      {/* Content */}
      <div className="relative z-[3]">
        <GlobalNavbar />

        <main>
          <section id="top" className="mx-auto w-full max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
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

              <h1
                className="font-display text-foreground mb-5 leading-[1.02]"
                style={{ fontSize: "clamp(2.1rem, 4.8vw + 0.9rem, 5.2rem)", fontWeight: 800, letterSpacing: "-0.03em" }}
              >
                Master the Market.{" "}
                <span className="bg-gradient-to-r from-primary via-neon-cyan to-accent bg-clip-text text-transparent">
                  Risk Nothing.
                </span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="mx-auto mb-10 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed"
              >
                Replay real historical market crashes and rallies. Build portfolios, execute trades,
                and learn from the past - all without risking a single dollar.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
              >
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="group relative inline-flex items-center gap-2.5 rounded-xl bg-primary px-6 sm:px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_hsl(var(--neon-blue)/0.3)] transition-all hover:shadow-[0_0_50px_hsl(var(--neon-blue)/0.5)] hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start Trading
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-6 sm:px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all hover:bg-secondary/50 hover:border-primary/30"
                >
                  View Dashboard
                </button>
              </motion.div>
            </motion.div>
          </section>

          <section id="features" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="mb-4 sm:mb-6">
              <p className="kicker-text">Features</p>
              <h2 className="text-foreground">Train Like A Pro Trader</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                  className="glass-strong flex items-start gap-3 rounded-xl px-5 py-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <f.icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-snug">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section id="markets" className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pb-16 sm:pt-8 lg:px-8">
            <div className="glass-strong rounded-2xl p-5 sm:p-7 md:p-8">
              <p className="kicker-text">Markets</p>
              <h2 className="mb-3 text-foreground">Historical Cycles Included</h2>
              <p className="max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
                Explore multiple market phases from crash to recovery with scenario-based data and instrument sets.
                Switch contexts quickly, compare outcomes, and stress-test your strategy execution.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs sm:text-sm">2008 Financial Crisis</span>
                <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs sm:text-sm">Dotcom Bubble</span>
                <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs sm:text-sm">COVID Volatility</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
