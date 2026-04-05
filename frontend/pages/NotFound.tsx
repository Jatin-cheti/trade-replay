import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import BrandLottie from "@/components/BrandLottie";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center animated-gradient-bg relative overflow-x-hidden overflow-y-auto px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,hsl(var(--neon-blue)/0.2),transparent_44%),radial-gradient(circle_at_78%_24%,hsl(var(--neon-purple)/0.18),transparent_45%)]" />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-2xl p-8 md:p-10 text-center max-w-lg w-full gradient-border relative z-10"
      >
        <div className="flex items-center justify-center gap-3 mb-5">
          <BrandLottie size={64} className="shrink-0 drop-shadow-[0_0_16px_hsl(var(--neon-blue)/0.28)]" />
          <p className="font-display text-4xl font-bold text-foreground">404</p>
        </div>
        <p className="mb-2 text-2xl font-semibold text-foreground">Page not found</p>
        <p className="mb-6 text-muted-foreground">The route {location.pathname} does not exist in this market view.</p>
        <a href="/" className="inline-flex px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm interactive-cta">
          Return to Home
        </a>
      </motion.div>
    </div>
  );
};

export default NotFound;
