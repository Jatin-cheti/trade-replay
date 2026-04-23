import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  symbol: string;
  fullSymbol?: string;
  name: string;
  exchange: string;
  type: string;
}

interface SymbolSearchInputProps {
  currentSymbol: string;
  onSelect?: (symbol: string) => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const typeColor: Record<string, string> = {
  stock: "text-blue-400",
  etf: "text-purple-400",
  crypto: "text-amber-400",
  forex: "text-emerald-400",
  index: "text-sky-400",
};

export default function SymbolSearchInput({
  currentSymbol,
  onSelect,
}: SymbolSearchInputProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 220);

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (modalOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [modalOpen]);

  // Fetch results
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axios
      .get<{ results?: SearchResult[]; data?: SearchResult[] }>(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data.results ?? res.data.data ?? (Array.isArray(res.data) ? res.data : []);
        setResults(data.slice(0, 10));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close on Escape
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function handleSelect(result: SearchResult) {
    const sym = result.fullSymbol ?? result.symbol;
    setModalOpen(false);
    if (onSelect) {
      onSelect(sym);
    } else {
      navigate(`/charts?symbol=${encodeURIComponent(sym)}`);
    }
  }

  const modal = modalOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background shadow-2xl overflow-hidden">
            {/* Search bar */}
            <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol, e.g. RELIANCE, NIFTY…"
                className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto py-1">
              {loading && (
                <div className="px-4 py-3 text-[13px] text-muted-foreground">Searching…</div>
              )}
              {!loading && query.trim() && results.length === 0 && (
                <div className="px-4 py-3 text-[13px] text-muted-foreground">No results for &ldquo;{query}&rdquo;</div>
              )}
              {!loading && !query.trim() && (
                <div className="px-4 py-3 text-[13px] text-muted-foreground">Type a symbol name to search…</div>
              )}
              {results.map((r) => (
                <button
                  key={`${r.symbol}-${r.exchange}`}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="flex w-full items-center gap-4 px-4 py-2.5 text-left hover:bg-primary/10 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground">{r.symbol}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{r.name}</div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="text-[11px] text-muted-foreground">{r.exchange}</span>
                    <span className={`text-[10px] capitalize ${typeColor[r.type] ?? "text-muted-foreground"}`}>{r.type}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {/* Trigger — clicking anywhere opens the modal */}
      <button
        type="button"
        data-testid="symbol-search-input"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5 transition hover:border-border/70 hover:bg-primary/5"
        title="Search symbol"
      >
        <Search size={13} className="shrink-0 text-muted-foreground" />
        <span className="min-w-[72px] text-left text-[12px] font-bold text-foreground">{currentSymbol}</span>
      </button>

      {modal}
    </>
  );
}
