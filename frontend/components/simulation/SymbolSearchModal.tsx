import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Globe, Search, X } from "lucide-react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import AssetAvatar from "@/components/ui/AssetAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetCategory, AssetSearchItem, AssetSortOption } from "@/lib/assetSearch";
import { FilterDropdown, ModalPanel, ModalTriggerButton, SYMBOL_CATEGORIES } from "@/components/simulation/symbolSearchModalParts";
import { useSymbolSearch } from "@/components/simulation/useSymbolSearch";
import { FutureContractsView } from "@/components/simulation/FutureContractsView";
import { isSpreadExpression, parseQuery, extractSymbols } from "@/lib/spreadOperator";

const FALLBACK_ICON = "/icons/exchange/default.svg";

const SORT_OPTIONS: Array<{ value: AssetSortOption; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "name", label: "Name" },
  { value: "symbol", label: "Symbol" },
  { value: "volume", label: "Volume" },
  { value: "marketCap", label: "Market Cap" },
];

function formatCompactNumber(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "--";
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(0);
}

function formatSigned(value?: number, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function normalizeCompanyKey(item: AssetSearchItem): string {
  const ticker = (item.ticker || item.symbol || "").toUpperCase();
  const baseTicker = ticker
    .replace(/-F-\d{6}$/g, "")
    .replace(/-\d{6}-[CP]-.+$/g, "")
    .replace(/-PERP$/g, "")
    .replace(/-FUT$/g, "");
  const dotIndex = baseTicker.indexOf(".");
  const normalizedBase = (dotIndex > 0 ? baseTicker.slice(0, dotIndex) : baseTicker).replace(/[^A-Z0-9]/g, "");
  if (normalizedBase) return normalizedBase;

  return String(item.name || "")
    .toUpperCase()
    .replace(/\b(LIMITED|LTD\.?|INC\.?|CORP\.?|CORPORATION|CO\.?|PLC|HOLDINGS?)\b/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function exchangePriority(item: AssetSearchItem, country: string): number {
  const exchange = String(item.exchange || "").toUpperCase();
  const effectiveCountry = (country || item.country || "").toUpperCase();

  if (effectiveCountry === "IN") {
    if (exchange === "NSE") return 40;
    if (exchange === "BSE") return 28;
  }
  if (effectiveCountry === "US") {
    if (exchange === "NASDAQ") return 34;
    if (exchange === "NYSE") return 34;
    if (exchange === "AMEX") return 18;
  }
  return 0;
}

function listingScore(item: AssetSearchItem, country: string): number {
  const liquidity = Number(item.liquidityScore || 0);
  const volume = Number(item.volume || 0);
  return exchangePriority(item, country) + Math.log10(liquidity + 1) * 4 + Math.log10(volume + 1) * 3;
}

interface SymbolSearchModalProps {
  open: boolean;
  selectedSymbol: string;
  onOpenChange: (next: boolean) => void;
  onSelect: (item: AssetSearchItem) => void;
  initialCategory?: "all" | AssetCategory;
}

type GroupedSymbolRow = {
  key: string;
  representative: AssetSearchItem;
  alternatives: AssetSearchItem[];
};

type VirtualSymbolRow =
  | { kind: "group"; group: GroupedSymbolRow }
  | { kind: "alternative"; groupKey: string; listing: AssetSearchItem };

export default function SymbolSearchModal({
  open,
  selectedSymbol,
  onOpenChange,
  onSelect,
  initialCategory = "all",
}: SymbolSearchModalProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const {
    view, setView,
    query, setQuery,
    category, setCategory,
    country, setCountry,
    type, setType,
    sector, setSector,
    source, setSource,
    exchangeType, setExchangeType,
    futureCategory, setFutureCategory,
    economyCategory, setEconomyCategory,
    expiry, setExpiry,
    strike, setStrike,
    underlyingAsset, setUnderlyingAsset,
    sort, setSort,
    rows,
    loading,
    loadingMore,
    total,
    activeFilters,
    countryOptions,
    typeOptions,
    sectorOptions,
    sourceOptions,
    exchangeTypeOptions,
    futureCategoryOptions,
    economyCategoryOptions,
    expiryOptions,
    strikeOptions,
    underlyingAssetOptions,
    sourceUiType,
    selectedFutureRoot, setSelectedFutureRoot,
    selectedCountryLabel,
    selectedTypeLabel,
    selectedSectorLabel,
    selectedSourceLabel,
    selectedExchangeTypeLabel,
    selectedFutureCategoryLabel,
    selectedEconomyCategoryLabel,
    selectedExpiryLabel,
    selectedStrikeLabel,
    selectedUnderlyingAssetLabel,
    listContainerRef,
  } = useSymbolSearch(open, selectedSymbol, initialCategory);

  const listRef = useRef<VariableSizeList | null>(null);

  const spreadInfo = useMemo(() => {
    if (!query || !isSpreadExpression(query)) return null;
    const parsed = parseQuery(query);
    if (parsed.type !== "spread") return null;
    return { parsed, symbols: extractSymbols(parsed) };
  }, [query]);

  useEffect(() => {
    setExpandedGroups({});
  }, [query, category, country, type, sector, source, exchangeType, futureCategory, economyCategory, expiry, strike, underlyingAsset]);

  const groupedRows = useMemo<GroupedSymbolRow[]>(() => {
    const order: string[] = [];
    const buckets = new Map<string, AssetSearchItem[]>();

    for (const item of rows) {
      const key = normalizeCompanyKey(item);
      if (!buckets.has(key)) {
        buckets.set(key, []);
        order.push(key);
      }
      buckets.get(key)?.push(item);
    }

    return order.map((key) => {
      const listings = buckets.get(key) || [];
      const representative = [...listings].sort((left, right) => listingScore(right, country) - listingScore(left, country))[0] || listings[0];
      const alternatives = listings.filter((listing) => listing.exchange !== representative.exchange || listing.ticker !== representative.ticker);
      return {
        key,
        representative,
        alternatives,
      };
    }).filter((group) => Boolean(group.representative));
  }, [rows, country]);

  const virtualRows = useMemo<VirtualSymbolRow[]>(() => {
    const flattened: VirtualSymbolRow[] = [];
    for (const group of groupedRows) {
      flattened.push({ kind: "group", group });
      if (expandedGroups[group.key]) {
        for (const listing of group.alternatives) {
          flattened.push({ kind: "alternative", groupKey: group.key, listing });
        }
      }
    }
    return flattened;
  }, [groupedRows, expandedGroups]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0, true);
  }, [virtualRows]);

  const rowCount = virtualRows.length + 1;
  const estimatedHeight = useMemo(() => {
    const rowsHeight = virtualRows.reduce((accumulator, row) => {
      return accumulator + (row.kind === "group" ? 108 : 64);
    }, 0);
    const totalHeight = rowsHeight + 60;
    return Math.max(220, Math.min(560, totalHeight));
  }, [virtualRows]);

  const itemSize = (index: number): number => {
    if (index >= virtualRows.length) return 60;
    return virtualRows[index].kind === "group" ? 108 : 64;
  };

  const renderVirtualRow = ({ index, style }: ListChildComponentProps) => {
    if (index >= virtualRows.length) {
      return (
        <div style={style} className="border-t border-border/60 bg-secondary/10 px-3 py-2">
          {!loading && rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No symbols found</p>
          ) : null}
          {loading ? <p className="text-center text-xs text-muted-foreground">Loading symbols...</p> : null}
          {!loading && rows.length > 0 ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Showing {rows.length} of {total}
            </p>
          ) : null}
          {loadingMore ? <p className="text-center text-xs text-muted-foreground">Loading more...</p> : null}
        </div>
      );
    }

    const row = virtualRows[index];
    if (row.kind === "alternative") {
      const listing = row.listing;
      return (
        <div style={style} className="border-b border-border/50 bg-secondary/15 px-2 py-1">
          <button
            key={`${row.groupKey}-${listing.exchange}-${listing.ticker}`}
            data-testid="symbol-listing-row"
            type="button"
            onClick={() => {
              onSelect(listing);
              onOpenChange(false);
            }}
            className="grid h-full w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border/60 bg-secondary/25 px-2.5 py-2 text-left transition-colors hover:bg-secondary/45"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{listing.ticker}</p>
              <p className="truncate text-[11px] text-muted-foreground">{listing.name}</p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AssetAvatar src={listing.exchangeLogoUrl || listing.exchangeIcon} label={listing.exchange} className="h-3.5 w-3.5 rounded-sm object-cover" />
              <span>{listing.exchange}</span>
            </div>
          </button>
        </div>
      );
    }

    const group = row.group;
    const item = group.representative;
    const isPositive = (item.changePercent ?? 0) >= 0;
    const changeClass = isPositive ? "text-profit" : "text-loss";
    const priceText = typeof item.price === "number" && Number.isFinite(item.price)
      ? item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
      : "--";
    const hasAlternatives = group.alternatives.length > 0;
    const expanded = Boolean(expandedGroups[group.key]);

    return (
      <div style={style} className="border-b border-border/60">
        <button
          data-testid="symbol-result-row"
          data-symbol={item.ticker}
          type="button"
          onClick={() => {
            if (hasAlternatives) {
              setExpandedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }));
              return;
            }
            if (item.category === "futures" && (item.contracts?.length ?? 0) > 0) {
              setSelectedFutureRoot(item);
              setView("futureContracts");
              return;
            }
            onSelect(item);
            onOpenChange(false);
          }}
          className={`grid h-full w-full grid-cols-[1fr_auto] items-center gap-4 px-3 py-2.5 text-left transition-colors hover:bg-secondary/45 ${
            item.ticker === selectedSymbol ? "bg-secondary/65" : "bg-secondary/20"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <AssetAvatar src={item.displayIconUrl || item.logoUrl || item.iconUrl || FALLBACK_ICON} label={item.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{item.ticker}</p>
              <p className="truncate text-sm text-muted-foreground">{item.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {item.market} {item.instrumentType ? `• ${item.instrumentType}` : ""}
              </p>
            </div>
          </div>

          <div className="flex min-w-[210px] flex-col items-end gap-0.5 whitespace-nowrap text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <AssetAvatar src={item.exchangeLogoUrl || item.exchangeIcon} label={item.exchange} className="h-4 w-4 rounded-sm object-cover" />
              <span className="font-medium text-foreground">{item.exchange}</span>
              {hasAlternatives ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary/45 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  +{group.alternatives.length} listings
                </span>
              ) : null}
            </div>
            <p className="text-sm font-semibold text-foreground">{priceText}</p>
            <p className={`text-[11px] font-semibold ${changeClass}`}>
              {formatSigned(item.changePercent)}% • P&L {formatSigned(item.pnl ?? item.change)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Vol {formatCompactNumber(item.volume)} • MC {formatCompactNumber(item.marketCap)} • LQ {(item.liquidityScore ?? 0).toFixed(1)}
            </p>
          </div>
        </button>
      </div>
    );
  };

  if (view === "futureContracts" && selectedFutureRoot) {
    return (
      <FutureContractsView
        open={open}
        onOpenChange={onOpenChange}
        selectedSymbol={selectedSymbol}
        selectedFutureRoot={selectedFutureRoot}
        onBack={() => {
          setView("search");
          setSelectedFutureRoot(null);
        }}
        onSelect={onSelect}
      />
    );
  }

  if (view === "sources") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(960px,94vw)] max-w-none gap-0 border-border/80 bg-background/95 p-0 backdrop-blur-xl">
          <DialogHeader className="flex flex-row items-center gap-3 px-5 pt-5 pb-3">
            <button type="button" onClick={() => setView("search")} className="rounded-full p-1 transition-colors hover:bg-secondary/60" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <DialogTitle className="font-display text-xl">Sources</DialogTitle>
          </DialogHeader>

          <ModalPanel
            options={sourceOptions}
            value={source}
            sectionLabel="SOURCES"
            onChange={(nextValue) => {
              setSource(nextValue);
              setView("search");
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (view === "countries") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(960px,94vw)] max-w-none gap-0 border-border/80 bg-background/95 p-0 backdrop-blur-xl">
          <DialogHeader className="flex flex-row items-center gap-3 px-5 pt-5 pb-3">
            <button type="button" onClick={() => setView("search")} className="rounded-full p-1 transition-colors hover:bg-secondary/60" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <DialogTitle className="font-display text-xl">Countries</DialogTitle>
          </DialogHeader>

          <ModalPanel
            options={countryOptions}
            value={country}
            sectionLabel="COUNTRIES"
            showFlags
            onChange={(nextValue) => {
              setCountry(nextValue);
              setView("search");
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="symbol-search-modal" className="w-[min(960px,94vw)] max-w-none gap-3 border-border/80 bg-background/95 p-0 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-5 pb-1">
          <DialogTitle className="font-display text-[1.9rem]">Symbol Search</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4">
          <div className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-muted-foreground" />
              <input
                data-testid="symbol-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Symbol or name (e.g. AAPL, BTC or AAPL/MSFT spread)"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary/60" aria-label="Clear">
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>

          {spreadInfo ? (
            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
              <span className="font-semibold text-primary">Spread detected:</span>{" "}
              <span className="text-foreground">{spreadInfo.parsed.displayLabel}</span>
              <span className="ml-2 text-muted-foreground">
                ({spreadInfo.symbols.length} legs: {spreadInfo.symbols.join(` ${spreadInfo.parsed.operator} `)})
              </span>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SYMBOL_CATEGORIES.map((categoryItem) => (
              <button
                key={categoryItem.id}
                data-testid={`symbol-category-${categoryItem.id}`}
                type="button"
                onClick={() => setCategory(categoryItem.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  category === categoryItem.id
                    ? "border-primary/70 bg-primary/15 text-foreground"
                    : "border-border/70 bg-secondary/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {categoryItem.id === "all" ? (
                    <Globe size={12} className="shrink-0" />
                  ) : categoryItem.iconUrl ? (
                    <AssetAvatar src={categoryItem.iconUrl} label={categoryItem.label} className="h-3.5 w-3.5 shrink-0 rounded-full object-cover ring-1 ring-border/70" />
                  ) : null}
                  <span>{categoryItem.label}</span>
                </span>
              </button>
            ))}
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {activeFilters.includes("source") && sourceUiType === "modal" ? (
                <ModalTriggerButton
                  testId="symbol-filter-source-modal"
                  label={source === "all" ? "All Sources" : selectedSourceLabel}
                  onClick={() => setView("sources")}
                />
              ) : null}

              {activeFilters.includes("source") && sourceUiType === "dropdown" ? (
                <FilterDropdown
                  testId="symbol-filter-source-dropdown"
                  triggerLabel={selectedSourceLabel}
                  value={source}
                  options={sourceOptions}
                  onChange={setSource}
                />
              ) : null}

              {activeFilters.includes("country") ? (
                <ModalTriggerButton
                  testId="symbol-filter-country-modal"
                  label={country === "all" ? "All Countries" : selectedCountryLabel}
                  onClick={() => setView("countries")}
                />
              ) : null}

              {activeFilters.includes("type") ? (
                <FilterDropdown
                  testId="symbol-filter-type"
                  triggerLabel={selectedTypeLabel}
                  value={type}
                  options={typeOptions}
                  onChange={setType}
                />
              ) : null}

              {activeFilters.includes("sector") ? (
                <FilterDropdown
                  testId="symbol-filter-sector"
                  triggerLabel={selectedSectorLabel}
                  value={sector}
                  options={sectorOptions}
                  onChange={setSector}
                />
              ) : null}

              {activeFilters.includes("exchangeType") ? (
                <FilterDropdown
                  testId="symbol-filter-exchange-type"
                  triggerLabel={selectedExchangeTypeLabel}
                  value={exchangeType}
                  options={exchangeTypeOptions}
                  onChange={setExchangeType}
                />
              ) : null}

              {activeFilters.includes("futureCategory") ? (
                <FilterDropdown
                  testId="symbol-filter-future-category"
                  triggerLabel={selectedFutureCategoryLabel}
                  value={futureCategory}
                  options={futureCategoryOptions}
                  onChange={setFutureCategory}
                />
              ) : null}

              {activeFilters.includes("economyCategory") ? (
                <FilterDropdown
                  testId="symbol-filter-economy-category"
                  triggerLabel={selectedEconomyCategoryLabel}
                  value={economyCategory}
                  options={economyCategoryOptions}
                  onChange={setEconomyCategory}
                />
              ) : null}

              {activeFilters.includes("expiry") ? (
                <FilterDropdown
                  testId="symbol-filter-expiry"
                  triggerLabel={selectedExpiryLabel}
                  value={expiry}
                  options={expiryOptions}
                  onChange={setExpiry}
                />
              ) : null}

              {activeFilters.includes("underlyingAsset") ? (
                <FilterDropdown
                  testId="symbol-filter-underlying-asset"
                  triggerLabel={selectedUnderlyingAssetLabel}
                  value={underlyingAsset}
                  options={underlyingAssetOptions}
                  onChange={setUnderlyingAsset}
                />
              ) : null}

              {activeFilters.includes("strike") ? (
                <FilterDropdown
                  testId="symbol-filter-strike"
                  triggerLabel={selectedStrikeLabel}
                  value={strike}
                  options={strikeOptions}
                  onChange={setStrike}
                />
              ) : null}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div />
            <FilterDropdown
              testId="symbol-sort"
              triggerLabel={`Sort: ${SORT_OPTIONS.find((opt) => opt.value === sort)?.label ?? "Relevance"}`}
              value={sort}
              options={SORT_OPTIONS}
              onChange={(nextValue) => setSort(nextValue as AssetSortOption)}
            />
          </div>

          <div className="mt-2 rounded-xl border border-border/70">
            <VariableSizeList
              ref={listRef}
              outerRef={listContainerRef}
              className="rounded-xl"
              height={estimatedHeight}
              width="100%"
              itemCount={rowCount}
              itemSize={itemSize}
            >
              {renderVirtualRow}
            </VariableSizeList>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}