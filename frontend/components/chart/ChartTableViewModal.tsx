import { createPortal } from "react-dom";
import { useState, useMemo } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import type { CandleData } from "@/data/stockData";

interface ChartTableViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  candles: CandleData[];
  resolution: string;
}

type SortKey = "time" | "open" | "high" | "low" | "close" | "volume";
type SortDir = "asc" | "desc";

function formatResolutionDate(time: string, resolution: string): string {
  const d = new Date(time);
  if (resolution === "D" || resolution === "W" || resolution === "M") {
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
  }
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ChartTableViewModal({
  open,
  onOpenChange,
  symbol,
  candles,
  resolution,
}: ChartTableViewModalProps) {
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...candles];
    copy.sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === "time") {
        va = new Date(a.time).getTime();
        vb = new Date(b.time).getTime();
      } else {
        va = a[sortKey];
        vb = b[sortKey];
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return copy.slice(0, 500); // cap display at 500 rows
  }, [candles, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (!open) return null;

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="cursor-pointer select-none whitespace-nowrap py-2 px-3 text-left text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </span>
      </th>
    );
  }

  const modal = (
    <div
      data-testid="chart-table-modal"
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div className="flex h-[70vh] w-[720px] flex-col rounded-xl border border-primary/25 bg-background shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
          <div>
            <span className="text-sm font-semibold text-foreground">Table View · {symbol}</span>
            <span className="ml-2 text-[11px] text-muted-foreground">{candles.length} bars</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
              <tr className="border-b border-border/30">
                <Th col="time" label="Date / Time" />
                <Th col="open" label="Open" />
                <Th col="high" label="High" />
                <Th col="low" label="Low" />
                <Th col="close" label="Close" />
                <Th col="volume" label="Volume" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const change = c.close - c.open;
                const bullish = change >= 0;
                return (
                  <tr
                    key={c.time}
                    className="border-b border-border/10 hover:bg-primary/5 transition-colors"
                  >
                    <td className="py-1.5 px-3 text-[11px] tabular-nums text-muted-foreground">
                      {formatResolutionDate(c.time, resolution)}
                    </td>
                    <td className="py-1.5 px-3 text-[12px] tabular-nums text-foreground">
                      {c.open.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-[12px] tabular-nums text-emerald-300">
                      {c.high.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-[12px] tabular-nums text-rose-300">
                      {c.low.toFixed(2)}
                    </td>
                    <td className={`py-1.5 px-3 text-[12px] tabular-nums font-semibold ${bullish ? "text-emerald-300" : "text-rose-300"}`}>
                      {c.close.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-[11px] tabular-nums text-muted-foreground">
                      {c.volume >= 1e7
                        ? `${(c.volume / 1e7).toFixed(2)}Cr`
                        : c.volume >= 1e5
                          ? `${(c.volume / 1e5).toFixed(2)}L`
                          : c.volume.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[12px] text-muted-foreground">
                    No candle data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
