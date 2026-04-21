import { useMemo, useState } from "react";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import AssetAvatar from "@/components/ui/AssetAvatar";
import { marketMeta } from "@/data/assetCatalog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AssetCategory, AssetSearchFilterOption } from "@/lib/assetSearch";

const marketIconByCategory = marketMeta.reduce((accumulator, item) => {
  accumulator[item.key] = item.iconUrl;
  return accumulator;
}, {} as Record<AssetCategory, string>);

// TODO: SYMBOL_CATEGORIES is a shared constant consumed alongside the modal parts; splitting would require a new module
// eslint-disable-next-line react-refresh/only-export-components
export const SYMBOL_CATEGORIES: Array<{ id: "all" | AssetCategory; label: string; iconUrl?: string }> = [
  { id: "all", label: "All" },
  { id: "stocks", label: "Stocks", iconUrl: marketIconByCategory.stocks },
  { id: "funds", label: "Funds", iconUrl: marketIconByCategory.funds },
  { id: "futures", label: "Futures", iconUrl: marketIconByCategory.futures },
  { id: "forex", label: "Forex", iconUrl: marketIconByCategory.forex },
  { id: "crypto", label: "Crypto", iconUrl: marketIconByCategory.crypto },
  { id: "indices", label: "Indices", iconUrl: marketIconByCategory.indices },
  { id: "bonds", label: "Bonds", iconUrl: marketIconByCategory.bonds },
  { id: "economy", label: "Economy", iconUrl: marketIconByCategory.economy },
  { id: "options", label: "Options", iconUrl: marketIconByCategory.options },
];

export function ModalTriggerButton({ label, onClick, testId }: { label: string; onClick: () => void; testId?: string }) {
  return (
    <button
      data-testid={testId}
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary/45"
    >
      <span>{label}</span>
      <ChevronDown size={13} className="text-muted-foreground" />
    </button>
  );
}

export function ModalPanel({
  options,
  value,
  sectionLabel,
  showFlags,
  onChange,
}: {
  options: AssetSearchFilterOption[];
  value: string;
  sectionLabel: string;
  showFlags?: boolean;
  onChange: (nextValue: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const normalized = query.trim().toLowerCase();
    return options.filter((optionItem) => optionItem.label.toLowerCase().includes(normalized));
  }, [options, query]);

  const allOption = filtered.find((optionItem) => optionItem.value === "all");
  const rest = filtered.filter((optionItem) => optionItem.value !== "all");

  return (
    <div className="px-5 pb-5">
      <div className="mb-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {allOption ? (
        <button
          data-testid="symbol-modal-option"
          data-option="all"
          type="button"
          onClick={() => onChange("all")}
          className={`mb-3 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${
            value === "all" ? "bg-foreground text-background" : "transition-colors hover:bg-secondary/45"
          }`}
        >
          <Globe size={16} />
          <span className="font-medium">{allOption.label}</span>
        </button>
      ) : null}

      <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{sectionLabel}</div>

      <div className="max-h-[50vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {rest.map((optionItem) => {
            const selected = value === optionItem.value;
            const iconUrl = optionItem.icon || (showFlags ? countryFlagUrl(optionItem.value) : "");

            return (
              <button
                key={optionItem.value}
                data-testid="symbol-modal-option"
                data-option={optionItem.value}
                type="button"
                onClick={() => onChange(optionItem.value)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                  selected ? "bg-secondary/65" : "hover:bg-secondary/35"
                }`}
              >
                {iconUrl ? (
                  <AssetAvatar src={iconUrl} label={optionItem.label} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                )}

                <div className="min-w-0">
                  <p className={`truncate text-sm ${selected ? "font-semibold text-foreground" : "text-foreground"}`}>{optionItem.label}</p>
                  {optionItem.subtitle ? <p className="truncate text-xs text-muted-foreground">{optionItem.subtitle}</p> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function FilterDropdown({
  triggerLabel,
  value,
  options,
  onChange,
  testId,
}: {
  triggerLabel: string;
  value: string;
  options: AssetSearchFilterOption[];
  onChange: (nextValue: string) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button data-testid={testId} type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary/45">
          <span>{triggerLabel}</span>
          <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className="w-[260px] border-border/80 bg-background/95 p-0">
        <div className="max-h-[320px] overflow-y-auto py-1">
          {options.map((optionItem) => {
            const selected = value === optionItem.value;
            return (
              <button
                key={optionItem.value}
                type="button"
                onClick={() => {
                  onChange(optionItem.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                  selected
                    ? "bg-secondary/65 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/35 hover:text-foreground"
                }`}
              >
                <span>{optionItem.label}</span>
                {selected ? <Check size={12} className="text-foreground" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function countryFlagUrl(value: string): string {
  const code = value.trim().toLowerCase();
  if (!code || code === "all" || code === "global") return "";
  if (code.length !== 2) return "";
  return `https://flagcdn.com/${code}.svg`;
}
