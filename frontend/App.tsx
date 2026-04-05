import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import GlobalLoader from "@/components/GlobalLoader";
import GlobalNavbar from "@/components/GlobalNavbar";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Simulation from "./pages/Simulation";
import CreatePortfolio from "./pages/CreatePortfolio";
import EditPortfolio from "./pages/EditPortfolio";
import Homepage from "./pages/Homepage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  useEffect(() => {
    setIsRouteLoading(true);
    const timeout = setTimeout(() => setIsRouteLoading(false), 420);
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  return (
    <>
      <GlobalLoader isRouteLoading={isRouteLoading} />
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
