import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { ScreenerOption } from "@/lib/screener";

export default function MultiSelectEditor({
  options,
  selected,
  onChange,
}: {
  options: ScreenerOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return options;
    const needle = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle));
  }, [options, search]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((entry) => entry !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <div className="w-[320px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
      {options.length > 8 && (
        <div className="mb-2 border-b border-border/40 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search filter values"
              className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="max-h-64 overflow-auto pr-1">
        {filtered.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No results</p>
        )}

        {filtered.map((option) => {
          const active = selectedSet.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-colors ${
                active ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
              }`}
            >
              <span className="truncate">{option.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          );
        })}
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
