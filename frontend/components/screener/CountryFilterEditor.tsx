import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { POPULAR_COUNTRIES, ALL_COUNTRIES } from "@/lib/screener";
import CountryFlagImg from "./CountryFlagImg";

export default function CountryFilterEditor({
  selected,
  onChange,
  primaryOnly,
  onPrimaryChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  primaryOnly: boolean;
  onPrimaryChange: (next: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const needle = search.toLowerCase();

  const filteredPopular = useMemo(
    () => POPULAR_COUNTRIES.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.value.toLowerCase().includes(needle)),
    [needle],
  );
  const filteredAll = useMemo(
    () => ALL_COUNTRIES.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.value.toLowerCase().includes(needle)),
    [needle],
  );

  const toggle = (value: string) => {
    if (value === "WORLD") { onChange([]); return; }
    if (selectedSet.has(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const CountryRow = ({ flag, name, value }: { flag: string; name: string; value: string }) => {
    const checked = value === "WORLD" ? selected.length === 0 : selectedSet.has(value);
    return (
      <button
        type="button"
        onClick={() => toggle(value)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
          checked ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
        }`}
      >
        <input type="checkbox" checked={checked} readOnly className="pointer-events-none h-3.5 w-3.5 rounded border-border accent-primary" />
        <CountryFlagImg code={value} size={18} />
        <span className="truncate">{name}</span>
      </button>
    );
  };

  return (
    <div className="w-[320px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
      <div className="mb-2 border-b border-border/40 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search countries..."
            className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-auto pr-1">
        {filteredPopular.length > 0 && (
          <>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">⭐ Popular</p>
            {filteredPopular.map((c) => <CountryRow key={`pop-${c.value}`} {...c} />)}
            <div className="my-1.5 h-px bg-border/40" />
          </>
        )}

        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">All Countries</p>
        {filteredAll.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No results</p>}
        {filteredAll.map((c) => <CountryRow key={`all-${c.value}`} {...c} />)}
      </div>

      <div className="mt-2 border-t border-border/40 pt-2">
        <button
          type="button"
          onClick={() => onPrimaryChange(!primaryOnly)}
          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
            primaryOnly ? "bg-primary/12 text-primary" : "text-foreground/85 hover:bg-secondary/45"
          }`}
        >
          <span>Primary listing only</span>
          <div className={`h-4 w-7 rounded-full transition-colors ${primaryOnly ? "bg-primary" : "bg-border"}`}>
            <div className={`h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${primaryOnly ? "translate-x-3.5" : "translate-x-0.5"}`} />
          </div>
        </button>
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
