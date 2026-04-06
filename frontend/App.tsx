import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import GlobalLoader from "@/components/GlobalLoader";
import GlobalNavbar from "@/components/GlobalNavbar";
import PageBirdsCloudsBackground from "@/components/background/PageBirdsCloudsBackground";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Simulation from "./pages/Simulation";
import LiveMarket from "./pages/LiveMarket";
import CreatePortfolio from "./pages/CreatePortfolio";
import EditPortfolio from "./pages/EditPortfolio";
import Homepage from "./pages/Homepage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type RouteBackgroundConfig = {
  showShellLayers?: boolean;
  showGradientOverlay?: boolean;
  cloudsClassName?: string;
  birdsClassName?: string;
  showReadyOverlay?: boolean;
};

function getRouteBackgroundConfig(pathname: string): RouteBackgroundConfig | null {
  if (pathname === "/" || pathname === "/homepage") {
    return {
      showGradientOverlay: true,
      cloudsClassName: "absolute inset-0 z-0",
      birdsClassName: "absolute inset-0 z-[1]",
      showReadyOverlay: true,
    };
  }

  if (
    pathname === "/login"
    || pathname === "/signup"
    || pathname === "/dashboard"
    || pathname === "/portfolio/create"
    || pathname.startsWith("/portfolio/edit/")
    || pathname === "/live-market"
  ) {
    return { showShellLayers: true };
  }

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [vantaReady, setVantaReady] = useState(false);
  const backgroundConfig = getRouteBackgroundConfig(location.pathname);

  useEffect(() => {
    setIsRouteLoading(true);
    const timeout = setTimeout(() => setIsRouteLoading(false), 420);
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  useEffect(() => {
    setVantaReady(backgroundConfig == null);
  }, [backgroundConfig, location.pathname]);

  return (
    <>
      <GlobalLoader isRouteLoading={isRouteLoading} />
      {backgroundConfig ? (
        <PageBirdsCloudsBackground
          showShellLayers={backgroundConfig.showShellLayers}
          showGradientOverlay={backgroundConfig.showGradientOverlay}
          cloudsClassName={backgroundConfig.cloudsClassName}
          birdsClassName={backgroundConfig.birdsClassName}
          onReadyChange={setVantaReady}
        />
      ) : null}

      <AnimatePresence>
        {backgroundConfig?.showReadyOverlay && !vantaReady ? (
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
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.995 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Homepage />} />
            <Route path="/homepage" element={<Homepage />} />
            <Route path="/login" element={<Login mode="login" />} />
            <Route path="/signup" element={<Login mode="signup" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/portfolio/create" element={<CreatePortfolio />} />
            <Route path="/portfolio/edit/:portfolioId" element={<EditPortfolio />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/live-market" element={<LiveMarket />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner
          position="top-right"
          richColors
          expand
          toastOptions={{
            className: "!min-w-[340px] !text-base !py-4 !px-4 !border !border-primary/40 !shadow-[0_0_20px_hsl(var(--neon-blue)/0.25)]",
          }}
        />
        <BrowserRouter>
          <div
            className="futuristic-shell"
            onMouseMove={(e) => {
              document.documentElement.style.setProperty("--pointer-x", `${e.clientX}px`);
              document.documentElement.style.setProperty("--pointer-y", `${e.clientY}px`);
            }}
          >
            <GlobalNavbar />
            <div className="ambient-layer ambient-layer--one" aria-hidden="true" />
            <div className="ambient-layer ambient-layer--two" aria-hidden="true" />
            <div className="ambient-layer ambient-layer--three" aria-hidden="true" />
            <div className="noise-layer" aria-hidden="true" />
            <AnimatedRoutes />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
