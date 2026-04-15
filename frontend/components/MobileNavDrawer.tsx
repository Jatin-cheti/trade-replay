import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";

export interface NavItem {
  label: string;
  action: () => void;
  activeMatch: (pathname: string, hash: string) => boolean;
}

export interface FeatureMenuItem {
  label: string;
  path: string;
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mobilePrimaryNavItems: NavItem[];
  mobileFeaturesOpen: boolean;
  setMobileFeaturesOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  isAuthenticated: boolean;
  featureMenuItems: FeatureMenuItem[];
  runFeatureMenuAction: (path: string) => void;
  runMobileItemAction: (action: () => void) => void;
  pathname: string;
  hash: string;
  logout: () => void;
  navigate: NavigateFunction;
}

export function MobileNavDrawer({
  isOpen,
  onClose,
  mobilePrimaryNavItems,
  mobileFeaturesOpen,
  setMobileFeaturesOpen,
  isAuthenticated,
  featureMenuItems,
  runFeatureMenuAction,
  runMobileItemAction,
  pathname,
  hash,
  logout,
  navigate,
}: MobileNavDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close menu overlay"
            onClick={onClose}
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
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-foreground transition-all hover:bg-primary/20"
                aria-label="Close navigation menu"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-2">
              {mobilePrimaryNavItems.map((item) => {
                const active = item.activeMatch(pathname, hash);
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
                            onClick={() => runFeatureMenuAction(item.path)}
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
                  onClick={() => { onClose(); logout(); navigate("/"); }}
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
  );
}