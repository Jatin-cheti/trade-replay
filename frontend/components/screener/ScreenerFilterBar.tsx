import { useMemo } from "react";
import {
  Check, ChevronDown, Filter, Plus, Search, X,
  Globe2, BookMarked, BarChart2, DollarSign, TrendingUp, Building2,
  Percent, Coins, Layers, Star, Activity, ArrowUpRight, Sigma,
  Waves, Calendar, CalendarClock,
} from "lucide-react";
import type {
  DateRangeFilterValue,
  ParsedFilters,
  RangeFilterValue,
  ScreenerFilterField,
  ScreenerMetaResponse,
} from "@/lib/screener";
import {
  ALL_COUNTRIES,
  DEFAULT_FILTER_KEYS,
  FALLBACK_FILTER_CATEGORY_LABELS,
  buildFilterLabel,
  isFilterActiveValue,
} from "@/lib/screener";
import CountryFlagImg from "./CountryFlagImg";
import FilterEditorSwitch from "./FilterEditorSwitch";

const FILTER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  marketCountries: Globe2,
  watchlists: BookMarked,
  indices: BarChart2,
  exchanges: Building2,
  price: DollarSign,
  changePercent: TrendingUp,
  marketCap: Building2,
  pe: Percent,
  epsDilGrowth: TrendingUp,
  divYieldPercent: Coins,
  sector: Layers,
  analystRating: Star,
  perfPercent: Activity,
  revenueGrowth: ArrowUpRight,
  peg: Sigma,
  roe: Percent,
  beta: Waves,
  recentEarningsDate: Calendar,
  upcomingEarningsDate: CalendarClock,
};

export default function ScreenerFilterBar({
  meta,
  parsedFilters,
  filterFields,
  visibleFilterKeys,
  filterCount,
  editingFilterKey,
  setEditingFilterKey,
  addFilterOpen,
  setAddFilterOpen,
  addFilterSearch,
  setAddFilterSearch,
  filterChipRefs,
  addFilterRef,
  manualFilterKeys,
  setManualFilterKeys,
  setMultiFilter,
  setRangeFilter,
  setDateFilter,
  setToggleFilter,
  clearAllFilters,
}: {
  meta: ScreenerMetaResponse | null;
  parsedFilters: ParsedFilters;
  filterFields: ScreenerFilterField[];
  visibleFilterKeys: string[];
  filterCount: number;
  editingFilterKey: string | null;
  setEditingFilterKey: (key: string | null) => void;
  addFilterOpen: boolean;
  setAddFilterOpen: (open: boolean) => void;
  addFilterSearch: string;
  setAddFilterSearch: (search: string) => void;
  filterChipRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  addFilterRef: React.RefObject<HTMLDivElement>;
  manualFilterKeys: string[];
  setManualFilterKeys: React.Dispatch<React.SetStateAction<string[]>>;
  setMultiFilter: (key: string, values: string[]) => void;
  setRangeFilter: (key: string, value?: RangeFilterValue) => void;
  setDateFilter: (key: string, value?: DateRangeFilterValue) => void;
  setToggleFilter: (key: string, value: boolean) => void;
  clearAllFilters: () => void;
}) {
  const availableAddFilterFields = useMemo(() => {
    const needle = addFilterSearch.toLowerCase();
    return (meta?.filterFields || []).filter((field) => {
      if (!needle) return true;
      return field.label.toLowerCase().includes(needle) || field.category.toLowerCase().includes(needle);
    });
  }, [addFilterSearch, meta]);

  const groupedAddFilterFields = useMemo(() => {
    const categoryLabelLookup = new Map<string, string>();
    (meta?.filterCategories || []).forEach((entry) => categoryLabelLookup.set(entry.key, entry.label));
    const order = [...(meta?.filterCategories || []).map((e) => e.key), ...Object.keys(FALLBACK_FILTER_CATEGORY_LABELS)];
    const groups = new Map<string, ScreenerFilterField[]>();
    availableAddFilterFields.forEach((field) => {
      const key = field.category || "other";
      const list = groups.get(key) || [];
      list.push(field);
      groups.set(key, list);
      if (!categoryLabelLookup.has(key)) categoryLabelLookup.set(key, FALLBACK_FILTER_CATEGORY_LABELS[key] || key.replace(/-/g, " "));
    });
    const seen = new Set<string>();
    const orderedKeys = order.filter((key) => { if (seen.has(key)) return false; seen.add(key); return groups.has(key); });
    for (const key of groups.keys()) { if (!seen.has(key)) orderedKeys.push(key); }
    return orderedKeys.map((key) => ({ key, label: categoryLabelLookup.get(key) || key, fields: groups.get(key) || [] }));
  }, [availableAddFilterFields, meta]);

  return (
    <div className="screener-filter-bar mb-2 flex flex-wrap items-center gap-1.5">
      {filterFields.map((field) => {
        const value = parsedFilters[field.key];
        const active = isFilterActiveValue(value);
        return (
          <div key={field.key} ref={(el) => { filterChipRefs.current[field.key] = el; }} className="relative">
            <button
              type="button"
              onClick={() => setEditingFilterKey(editingFilterKey === field.key ? null : field.key)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "border-primary/40 bg-primary/12 text-primary" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {(() => { const Icon = FILTER_ICONS[field.key]; return Icon ? <Icon className="h-3 w-3 shrink-0 opacity-70" /> : null; })()}
              {field.key === "marketCountries" ? (
                <span className="inline-flex items-center gap-1">
                  {(() => {
                    const countries = (value as string[] | undefined) || [];
                    if (countries.length === 0) return <><CountryFlagImg code="WORLD" size={16} /><span>Entire world</span></>;
                    if (countries.length === 1) {
                      const code = countries[0];
                      if (code === "WORLD") return <><CountryFlagImg code="WORLD" size={16} /><span>Entire world</span></>;
                      const entry = ALL_COUNTRIES.find((c) => c.value === code);
                      const name = entry?.name ?? code;
                      return <><CountryFlagImg code={code} size={16} /><span>{name}</span></>;
                    }
                    return <>{countries.slice(0, 2).map((c) => <CountryFlagImg key={c} code={c} size={14} />)}{countries.length > 2 && <span>+{countries.length - 2}</span>}</>;
                  })()}
                </span>
              ) : buildFilterLabel(field, value)}
              <ChevronDown className="h-3 w-3" />
            </button>
            {active && !DEFAULT_FILTER_KEYS.includes(field.key) && (
              <button
                type="button"
                onClick={() => {
                  setEditingFilterKey(null);
                  if (field.inputType === "multiselect") setMultiFilter(field.key, []);
                  if (field.inputType === "range") setRangeFilter(field.key, undefined);
                  if (field.inputType === "date-range") setDateFilter(field.key, undefined);
                  if (field.inputType === "toggle") setToggleFilter(field.key, false);
                  setManualFilterKeys((cur) => cur.filter((e) => e !== field.key));
                }}
                className="absolute -right-1 -top-1 rounded-full border border-border/50 bg-background p-0.5 text-muted-foreground transition-colors hover:text-red-400"
                aria-label={`Remove ${field.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {editingFilterKey === field.key && (
              <div className="absolute left-0 top-full z-40 mt-1.5">
                <FilterEditorSwitch field={field} parsedFilters={parsedFilters} meta={meta} setMultiFilter={setMultiFilter} setRangeFilter={setRangeFilter} setDateFilter={setDateFilter} setToggleFilter={setToggleFilter} />
              </div>
            )}
          </div>
        );
      })}

      <div className="relative" ref={addFilterRef}>
        <button
          type="button"
          onClick={() => setAddFilterOpen(!addFilterOpen)}
          className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Filter className="h-3.5 w-3.5" />
          Add filter
        </button>
        {addFilterOpen && (
          <div className="absolute left-0 top-full z-40 mt-1.5 w-[340px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
            <div className="mb-2 border-b border-border/40 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={addFilterSearch}
                  onChange={(e) => setAddFilterSearch(e.target.value)}
                  placeholder="Search filters"
                  className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-auto pr-1">
              {groupedAddFilterFields.map((group) => (
                <div key={group.key} className="mb-2">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{group.label}</p>
                  {group.fields.map((field) => {
                    const active = visibleFilterKeys.includes(field.key);
                    return (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => {
                          setManualFilterKeys((cur) => [...new Set([...cur, field.key])]);
                          setEditingFilterKey(field.key);
                          setAddFilterOpen(false);
                        }}
                        className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          active ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
                        }`}
                      >
                        <span>{field.label}</span>
                        {active ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {filterCount > 0 && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:text-red-300"
        >
          <X className="h-3.5 w-3.5" />
          Clear all
        </button>
      )}
    </div>
  );
}
