import { useEffect, useRef, useState } from "react";
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

export default function SymbolSearchInput({
  currentSymbol,
  onSelect,
}: SymbolSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 220);

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
        setResults(data.slice(0, 8));
        setOpen(true);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(result: SearchResult) {
    const sym = result.fullSymbol ?? result.symbol;
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    if (onSelect) {
      onSelect(sym);
    } else {
      navigate(`/charts?symbol=${encodeURIComponent(sym)}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const typeColor: Record<string, string> = {
    stock: "text-blue-400",
    etf: "text-purple-400",
    crypto: "text-amber-400",
    forex: "text-emerald-400",
    index: "text-sky-400",
  };

  return (
    <div ref={containerRef} className="relative" data-testid="symbol-search-input">
      <div
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition ${
          focused
            ? "border-primary/50 bg-primary/5"
            : "border-border/40 bg-background/60 hover:border-border/70"
        }`}
      >
        {!focused && !query ? (
          <span className="min-w-[80px] text-[12px] font-bold text-foreground">{currentSymbol}</span>
        ) : null}
        <Search size={13} className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); if (query) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={focused || query ? "Search symbol…" : ""}
          className="w-32 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (query.trim() || results.length > 0) && (
        <div className="absolute left-0 top-full z-[100] mt-1 w-72 rounded-xl border border-primary/20 bg-background/95 py-1.5 shadow-2xl backdrop-blur-xl">
          {loading && (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">Searching…</div>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">No results for "{query}"</div>
          )}
          {results.map((r) => (
            <button
              key={`${r.symbol}-${r.exchange}`}
              type="button"
              onClick={() => handleSelect(r)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-primary/10 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-foreground">{r.symbol}</div>
                <div className="truncate text-[11px] text-muted-foreground">{r.name}</div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[10px] text-muted-foreground">{r.exchange}</span>
                <span className={`text-[10px] capitalize ${typeColor[r.type] ?? "text-muted-foreground"}`}>{r.type}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
