import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { ScreenerOption } from "@/lib/screener";

export default function WatchlistFilterEditor({
  selected,
  onChange,
  watchlists,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  watchlists: ScreenerOption[];
}) {
  const [search, setSearch] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const needle = search.toLowerCase();

  const defaultWatchlists: Array<{ id: string; icon: string; name: string }> = [
    { id: "red_list", icon: "🔴", name: "Red list" },
    { id: "daftar_pantau", icon: "📋", name: "Daftar Pantau" },
  ];

  const allWatchlists = useMemo(() => {
    const fromServer = watchlists.map((w) => ({ id: w.value, icon: "📋", name: w.label }));
    // Deduplicate by normalized ID (handle _ vs - variants)
    const seen = new Set<string>();
    const deduped: Array<{ id: string; icon: string; name: string }> = [];
    for (const w of fromServer) {
      const norm = w.id.toLowerCase().replace(/[-_]/g, "");
      if (seen.has(norm)) continue;
      seen.add(norm);
      deduped.push(w);
    }
    // Add defaults only if not already present from server
    for (const d of defaultWatchlists) {
      const norm = d.id.toLowerCase().replace(/[-_]/g, "");
      if (!seen.has(norm)) {
        seen.add(norm);
        deduped.push(d);
      }
    }
    return deduped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlists]);

  const filtered = useMemo(
    () => allWatchlists.filter((w) => !needle || w.name.toLowerCase().includes(needle)),
    [allWatchlists, needle],
  );

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((v) => v !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="w-[320px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
      <div className="mb-2 border-b border-border/40 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search watchlists..."
            className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
      </div>

      <div className="max-h-64 overflow-auto pr-1">
        {filtered.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No watchlists found</p>}
        {filtered.map((wl) => {
          const checked = selectedSet.has(wl.id);
          return (
            <button
              key={wl.id}
              type="button"
              onClick={() => toggle(wl.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                checked ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
              }`}
            >
              <input type="checkbox" checked={checked} readOnly className="pointer-events-none h-3.5 w-3.5 rounded border-border accent-primary" />
              <span className="text-sm">{wl.icon}</span>
              <span className="flex-1 truncate">{wl.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 border-t border-border/40 pt-1.5">
        {creatingNew ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onChange([...selected, newName.trim()]);
                  setCreatingNew(false);
                  setNewName("");
                }
                if (e.key === "Escape") setCreatingNew(false);
              }}
              placeholder="Watchlist name..."
              className="flex-1 rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { setCreatingNew(false); setNewName(""); }}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreatingNew(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Create new watchlist
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-1.5 w-full rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
