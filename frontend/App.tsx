import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import GlobalLoader from "@/components/GlobalLoader";
import GlobalNavbar from "@/components/GlobalNavbar";
import { AppProvider } from "@/context/AppContext";
import { useApp } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Login from "./pages/Login";
import Homepage from "./pages/Homepage";
import NotFound from "./pages/NotFound";

// Heavy pages — code-split into separate chunks
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Simulation = lazy(() => import("./pages/Simulation"));
const LiveMarket = lazy(() => import("./pages/LiveMarket"));
const CreatePortfolio = lazy(() => import("./pages/CreatePortfolio"));
const EditPortfolio = lazy(() => import("./pages/EditPortfolio"));
const Screener = lazy(() => import("./pages/Screener"));
const SymbolPage = lazy(() => import("./pages/SymbolPage"));
const ChartPerformanceBench = lazy(() => import("./pages/ChartPerformanceBench"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (isAuthenticated) {
    return children;
  }

  const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
}

function AnimatedRoutes() {
  const location = useLocation();
  const isBenchRoute = location.pathname.startsWith("/__bench");

  if (isBenchRoute) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route path="/__bench/chart-performance" element={<ChartPerformanceBench />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <>
      <GlobalLoader isRouteLoading={false} />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.995 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<PageFallback />}>
            <Routes location={location}>
              <Route path="/" element={<Homepage />} />
              <Route path="/homepage" element={<Homepage />} />
              <Route path="/login" element={<Login mode="login" />} />
              <Route path="/signup" element={<Login mode="signup" />} />
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/portfolio/create" element={<RequireAuth><CreatePortfolio /></RequireAuth>} />
              <Route path="/portfolio/edit/:portfolioId" element={<RequireAuth><EditPortfolio /></RequireAuth>} />
              <Route path="/simulation" element={<RequireAuth><Simulation /></RequireAuth>} />
              <Route path="/live-market" element={<RequireAuth><LiveMarket /></RequireAuth>} />
              <Route path="/screener" element={<Navigate to="/screener/stocks" replace />} />
              <Route path="/screener/:type" element={<Screener />} />
              <Route path="/symbol/:symbol" element={<SymbolPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
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
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
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
