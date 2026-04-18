import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { INDEX_GROUPS } from "@/lib/screener";
import CountryFlagImg from "./CountryFlagImg";

export default function IndexFilterEditor({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const needle = search.toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!needle) return INDEX_GROUPS;
    return INDEX_GROUPS.map((g) => ({
      ...g,
      indices: g.indices.filter(
        (i) => i.ticker.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle) || g.region.toLowerCase().includes(needle),
      ),
    })).filter((g) => g.indices.length > 0);
  }, [needle]);

  const toggle = (ticker: string) => {
    if (selectedSet.has(ticker)) onChange(selected.filter((v) => v !== ticker));
    else onChange([...selected, ticker]);
  };

  const toggleCollapse = (region: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  return (
    <div className="w-[360px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
      <div className="mb-2 border-b border-border/40 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search indices..."
            className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
      </div>

      <div className="max-h-80 overflow-auto pr-1">
        {filteredGroups.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No results</p>}
        {filteredGroups.map((group) => (
          <div key={group.region} className="mb-1">
            <button
              type="button"
              onClick={() => toggleCollapse(group.region)}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 transition-colors hover:bg-secondary/30"
            >
              <CountryFlagImg code={group.flag} size={16} />
              <span>{group.region}</span>
              <ChevronDown className={`ml-auto h-3 w-3 transition-transform ${collapsed.has(group.region) ? "-rotate-90" : ""}`} />
            </button>
            {!collapsed.has(group.region) && group.indices.map((idx) => {
              const checked = selectedSet.has(idx.ticker);
              return (
                <button
                  key={idx.ticker}
                  type="button"
                  onClick={() => toggle(idx.ticker)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-6 text-left text-xs transition-colors ${
                    checked ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
                  }`}
                >
                  <input type="checkbox" checked={checked} readOnly className="pointer-events-none h-3.5 w-3.5 rounded border-border accent-primary" />
                  <span className="font-mono text-[10px] text-muted-foreground">{idx.ticker}</span>
                  <span className="text-muted-foreground/50">—</span>
                  <span className="truncate">{idx.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 w-full rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
