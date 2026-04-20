import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Twitter,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";

type SnapshotAction = "download" | "copy" | "link" | "newtab" | "tweet";

interface SnapshotMenuProps {
  /** Ref to the chart container div to capture */
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  symbolName: string;
  symbol: string;
  price: number;
  currency: string;
  /** Current page URL for link sharing */
  pageUrl?: string;
}

function useSnapshotMenu() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SnapshotAction | null>(null);
  const [done, setDone] = useState<SnapshotAction | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markDone = (action: SnapshotAction) => {
    setDone(action);
    setTimeout(() => setDone(null), 2000);
  };

  return { open, setOpen, pending, setPending, done, markDone, ref };
}

async function captureChartCanvas(
  chartContainerRef: React.RefObject<HTMLDivElement | null>
): Promise<HTMLCanvasElement | null> {
  const container = chartContainerRef.current;
  if (!container) return null;

  try {
    // lightweight-charts renders directly to a canvas — grab it
    const lc = container.querySelector<HTMLCanvasElement>("canvas");
    if (lc) return lc;

    // fallback: html2canvas screenshot of the container
    const captured = await html2canvas(container, {
      backgroundColor: "#07192f",
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
    });
    return captured;
  } catch {
    return null;
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
}

export default function SnapshotMenu({
  chartContainerRef,
  symbolName,
  symbol,
  price,
  currency,
  pageUrl,
}: SnapshotMenuProps) {
  const { open, setOpen, pending, setPending, done, markDone, ref } = useSnapshotMenu();
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (action: SnapshotAction) => {
    setOpen(false);
    setPending(action);

    try {
      switch (action) {
        case "download": {
          const canvas = await captureChartCanvas(chartContainerRef);
          if (!canvas) throw new Error("Could not capture chart");
          const blob = await canvasToBlob(canvas);
          if (!blob) throw new Error("Could not convert to image");
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const date = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");
          a.download = `${symbol}_chart_${date}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          markDone(action);
          showToast("Chart downloaded");
          break;
        }

        case "copy": {
          const canvas = await captureChartCanvas(chartContainerRef);
          if (!canvas) throw new Error("Could not capture chart");
          const blob = await canvasToBlob(canvas);
          if (!blob) throw new Error("Could not convert to image");
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            markDone(action);
            showToast("Chart image copied to clipboard");
          } catch {
            // Fallback: copy data URL as text
            const dataUrl = canvas.toDataURL("image/png");
            await navigator.clipboard.writeText(dataUrl);
            markDone(action);
            showToast("Chart image URL copied (clipboard API not supported)");
          }
          break;
        }

        case "link": {
          const url = pageUrl || window.location.href;
          await navigator.clipboard.writeText(url);
          markDone(action);
          showToast("Link copied to clipboard");
          break;
        }

        case "newtab": {
          // Open a snapshot preview page in a new tab
          // We generate a data URL and open it
          const canvas = await captureChartCanvas(chartContainerRef);
          if (canvas) {
            const dataUrl = canvas.toDataURL("image/png");
            const html = `<!DOCTYPE html>
<html>
<head>
  <title>${symbolName} Chart Snapshot</title>
  <meta charset="utf-8">
  <style>
    body { margin: 0; background: #07192f; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
    .container { text-align: center; padding: 20px; }
    img { max-width: 100%; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    .info { color: #94a3b8; margin-top: 16px; font-size: 14px; }
    .price { color: #fff; font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <p class="price">${symbolName} · ${price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}</p>
    <img src="${dataUrl}" alt="${symbol} chart snapshot"/>
    <p class="info">Chart snapshot · ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const tab = window.open(url, "_blank");
            if (!tab) {
              showToast("Pop-up was blocked. Allow pop-ups and retry.", true);
            } else {
              markDone(action);
            }
          } else {
            // Open symbol page in new tab as fallback
            window.open(pageUrl || window.location.href, "_blank");
            markDone(action);
          }
          break;
        }

        case "tweet": {
          const url = pageUrl || window.location.href;
          const text = encodeURIComponent(
            `${symbolName} (${symbol}) — ${price.toLocaleString("en", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} ${currency} | Check it out on Trade Replay`
          );
          const encodedUrl = encodeURIComponent(url);
          const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`;
          window.open(twitterUrl, "_blank", "noopener,noreferrer");
          markDone(action);
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      showToast(msg, true);
    } finally {
      setPending(null);
    }
  };

  const menuItems: {
    action: SnapshotAction;
    icon: typeof Download;
    label: string;
    description: string;
  }[] = [
    { action: "download", icon: Download, label: "Download image", description: "Save chart as PNG" },
    { action: "copy", icon: Copy, label: "Copy image", description: "Copy chart to clipboard" },
    { action: "link", icon: Link2, label: "Copy link", description: "Copy shareable URL" },
    { action: "newtab", icon: ExternalLink, label: "Open in new tab", description: "View snapshot in new tab" },
    { action: "tweet", icon: Twitter, label: "Tweet image", description: "Share on X / Twitter" },
  ];

  const isBusy = pending !== null;

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={isBusy}
          className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors
            ${open
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }
            ${isBusy ? "opacity-50 cursor-not-allowed" : ""}
          `}
          title="Snapshot"
          aria-label="Snapshot menu"
          aria-haspopup="true"
          aria-expanded={open}
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-border/50 bg-background/98 backdrop-blur-xl shadow-2xl overflow-hidden"
              role="menu"
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-border/30">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-primary" />
                  Snapshot
                </p>
              </div>

              {/* Actions */}
              <div className="p-1.5">
                {menuItems.map(({ action, icon: Icon, label, description }) => (
                  <button
                    key={action}
                    onClick={() => handleAction(action)}
                    disabled={isBusy}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-secondary/40 disabled:opacity-50 group text-left"
                    role="menuitem"
                  >
                    <span
                      className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-md border transition-colors
                        ${done === action
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-border/40 bg-secondary/30 text-muted-foreground group-hover:text-foreground group-hover:border-border/60"
                        }`}
                    >
                      {done === action ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : pending === action ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-none">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer note */}
              <div className="px-3 py-2 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground/60">
                  Snapshots capture the current chart view
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 30, x: "-50%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`fixed bottom-6 left-1/2 z-[200] flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-2xl
              ${toast.error
                ? "bg-red-950/95 border border-red-500/30 text-red-300"
                : "bg-secondary/95 border border-border/60 text-foreground"
              } backdrop-blur-xl`}
          >
            {toast.error ? (
              <span className="text-red-400 text-xs">✗</span>
            ) : (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Also export chevron variant for inline use
export function SnapshotButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="h-8 flex items-center gap-1 rounded-md border border-border/40 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors disabled:opacity-50"
      title="Snapshot"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
      <ChevronDown className="w-3 h-3" />
    </button>
  );
}
