import { useEffect, useRef } from "react";
import { BookPlus, ExternalLink, Flag, X } from "lucide-react";

const FLAG_COLORS = [
  { id: "red",    hex: "#EF4444" },
  { id: "blue",   hex: "#3B82F6" },
  { id: "green",  hex: "#22C55E" },
  { id: "yellow", hex: "#EAB308" },
  { id: "purple", hex: "#A855F7" },
  { id: "cyan",   hex: "#06B6D4" },
  { id: "pink",   hex: "#EC4899" },
  { id: "orange", hex: "#F97316" },
];

interface Props {
  x: number; y: number;
  symbol: string; fullSymbol: string; name: string;
  flagColor: string | null;
  watchlists: { id: string; name: string }[];
  onClose: () => void;
  onFlag: (fullSymbol: string, color: string | null) => void;
  onAddToWatchlist: (fullSymbol: string, watchlistId: string) => void;
}

export default function ScreenerRowContextMenu({ x, y, symbol, fullSymbol, flagColor, watchlists, onClose, onFlag, onAddToWatchlist }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const safeX = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 280);
  const safeY = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 270);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.altKey && e.key === "Enter") { onFlag(fullSymbol, flagColor ? null : "blue"); onClose(); }
    };
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [flagColor, fullSymbol, onClose, onFlag]);

  const FLAG_HEX: Record<string, string> = Object.fromEntries(FLAG_COLORS.map(c => [c.id, c.hex]));

  return (
    <div ref={ref} role="menu" className="fixed z-[9999] min-w-[260px] select-none rounded-xl border border-border/50 bg-background shadow-2xl py-1.5" style={{ left: safeX, top: safeY }}>
      <div className="px-3 py-2">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Flag className="h-3.5 w-3.5" style={{ color: flagColor ? FLAG_HEX[flagColor] : undefined }} />
            {flagColor ? "Unflag" : "Flag"} {symbol}
          </div>
          <kbd className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Alt+↵</kbd>
        </div>
        <div className="flex items-center gap-1.5">
          {FLAG_COLORS.map((c) => (
            <button key={c.id} type="button" title={c.id}
              onClick={() => { onFlag(fullSymbol, flagColor === c.id ? null : c.id); onClose(); }}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${flagColor === c.id ? "ring-2 ring-white ring-offset-1 ring-offset-background scale-110" : ""}`}
              style={{ backgroundColor: c.hex }} />
          ))}
          {flagColor && (
            <button type="button" onClick={() => { onFlag(fullSymbol, null); onClose(); }}
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border/50 text-muted-foreground hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="my-1 border-t border-border/25" />

      <div className="group relative">
        <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-3 py-2 text-sm text-foreground/85 hover:bg-secondary/40 transition-colors">
          <BookPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">Add {symbol} to watchlist</span>
          <span className="text-muted-foreground/50 text-xs">›</span>
        </button>
        <div className="pointer-events-none group-hover:pointer-events-auto absolute left-full top-0 hidden group-hover:block min-w-[180px] rounded-xl border border-border/50 bg-background shadow-xl py-1.5 z-[10000]">
          {watchlists.length === 0
            ? <p className="px-3 py-2 text-xs text-muted-foreground">No watchlists yet</p>
            : watchlists.map(wl => (
                <button key={wl.id} type="button" onClick={() => { onAddToWatchlist(fullSymbol, wl.id); onClose(); }}
                  className="flex w-full items-center px-3 py-2 text-xs text-foreground/85 hover:bg-secondary/40">{wl.name}</button>
              ))}
          <div className="mt-1 border-t border-border/25 pt-1">
            <button type="button" onClick={onClose} className="flex w-full items-center px-3 py-2 text-xs text-primary hover:bg-primary/10">+ Create new watchlist</button>
          </div>
        </div>
      </div>

      <a role="menuitem" href={`/supercharts?symbol=${encodeURIComponent(fullSymbol)}`} target="_blank" rel="noopener noreferrer" onClick={onClose}
        className="flex items-center gap-3 px-3 py-2 text-sm text-foreground/85 hover:bg-secondary/40 transition-colors">
        <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span className="flex-1">Open {symbol} Supercharts</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      </a>

      <a role="menuitem" href={`/symbol/${encodeURIComponent(fullSymbol)}`} target="_blank" rel="noopener noreferrer" onClick={onClose}
        className="flex items-center gap-3 px-3 py-2 text-sm text-foreground/85 hover:bg-secondary/40 transition-colors">
        <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span className="flex-1">See {symbol} Overview</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      </a>
    </div>
  );
}
