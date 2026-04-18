import { useState } from "react";
import type { RangeFilterValue, DateRangeFilterValue } from "@/lib/screener";

export function RangeEditor({
  value,
  onChange,
}: {
  value?: RangeFilterValue;
  onChange: (next?: RangeFilterValue) => void;
}) {
  const [minValue, setMinValue] = useState(value?.min !== undefined ? String(value.min) : "");
  const [maxValue, setMaxValue] = useState(value?.max !== undefined ? String(value.max) : "");

  const apply = () => {
    const min = minValue === "" ? undefined : Number(minValue);
    const max = maxValue === "" ? undefined : Number(maxValue);
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) return;
    onChange(min === undefined && max === undefined ? undefined : { min, max });
  };

  return (
    <div className="w-[280px] rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={minValue}
          onChange={(event) => setMinValue(event.target.value)}
          placeholder="Min"
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
        <input
          value={maxValue}
          onChange={(event) => setMaxValue(event.target.value)}
          placeholder="Max"
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={apply} className="flex-1 rounded-md border border-primary/45 bg-primary/12 px-2 py-1.5 text-xs font-medium text-primary">
          Apply
        </button>
        <button
          type="button"
          onClick={() => { setMinValue(""); setMaxValue(""); onChange(undefined); }}
          className="flex-1 rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function DateRangeEditor({
  value,
  onChange,
}: {
  value?: DateRangeFilterValue;
  onChange: (next?: DateRangeFilterValue) => void;
}) {
  const [from, setFrom] = useState(value?.from || "");
  const [to, setTo] = useState(value?.to || "");

  return (
    <div className="w-[280px] rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={from}
          onChange={(event) => {
            const next = event.target.value;
            setFrom(next);
            onChange(next || to ? { from: next || undefined, to: to || undefined } : undefined);
          }}
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground focus:border-primary/40 focus:outline-none"
        />
        <input
          type="date"
          value={to}
          onChange={(event) => {
            const next = event.target.value;
            setTo(next);
            onChange(from || next ? { from: from || undefined, to: next || undefined } : undefined);
          }}
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground focus:border-primary/40 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={() => { setFrom(""); setTo(""); onChange(undefined); }}
        className="mt-2 w-full rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Clear dates
      </button>
    </div>
  );
}

export function ToggleEditor({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="w-[220px] rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-full rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
          value ? "border-primary/45 bg-primary/12 text-primary" : "border-border/50 text-foreground/85"
        }`}
      >
        {value ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}
