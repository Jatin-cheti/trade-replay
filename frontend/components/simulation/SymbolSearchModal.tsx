import { ArrowLeft, Globe, Search, X } from "lucide-react";
import AssetAvatar from "@/components/ui/AssetAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetCategory, AssetSearchItem } from "@/lib/assetSearch";
import { FilterDropdown, ModalPanel, ModalTriggerButton, SYMBOL_CATEGORIES } from "@/components/simulation/symbolSearchModalParts";
import { useSymbolSearch } from "@/components/simulation/useSymbolSearch";
import { FutureContractsView } from "@/components/simulation/FutureContractsView";

const FALLBACK_ICON = "/icons/exchange/default.svg";

interface SymbolSearchModalProps {
  open: boolean;
  selectedSymbol: string;
  onOpenChange: (next: boolean) => void;
  onSelect: (item: AssetSearchItem) => void;
  initialCategory?: "all" | AssetCategory;
}

export default function SymbolSearchModal({
  open,
  selectedSymbol,
  onOpenChange,
  onSelect,
  initialCategory = "all",
}: SymbolSearchModalProps) {
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
    sourceUiType,
    selectedFutureRoot, setSelectedFutureRoot,
    selectedCountryLabel,
    selectedTypeLabel,
    selectedSectorLabel,
    selectedSourceLabel,
    selectedExchangeTypeLabel,
    selectedFutureCategoryLabel,
    selectedEconomyCategoryLabel,
    listContainerRef,
  } = useSymbolSearch(open, selectedSymbol, initialCategory);

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
                placeholder="Symbol or name"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary/60" aria-label="Clear">
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>

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
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
            </div>
          )}

          <div ref={listContainerRef} className="mt-3 max-h-[58vh] overflow-y-auto rounded-xl border border-border/70">
            {rows.map((item) => (
              <button
                key={`${item.category}-${item.ticker}-${item.exchange}`}
                data-testid="symbol-result-row"
                data-symbol={item.ticker}
                type="button"
                onClick={() => {
                  if (item.category === "futures" && (item.contracts?.length ?? 0) > 0) {
                    setSelectedFutureRoot(item);
                    setView("futureContracts");
                    return;
                  }
                  onSelect(item);
                  onOpenChange(false);
                }}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-secondary/45 ${
                  item.ticker === selectedSymbol ? "bg-secondary/65" : "bg-secondary/20"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AssetAvatar src={item.iconUrl || FALLBACK_ICON} label={item.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.ticker}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.market} {item.instrumentType ? `• ${item.instrumentType}` : ""}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  <AssetAvatar src={item.exchangeLogoUrl || item.exchangeIcon} label={item.exchange} className="h-4 w-4 rounded-sm object-cover" />
                  <span className="font-medium text-foreground">{item.exchange}</span>
                </div>
              </button>
            ))}

            {!loading && rows.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">No symbols found</p>
            ) : null}
            {loading ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">Loading symbols...</p> : null}
            {!loading && rows.length > 0 ? (
              <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">
                Showing {rows.length} of {total}
              </p>
            ) : null}
            {loadingMore ? <p className="px-3 py-3 text-center text-xs text-muted-foreground">Loading more...</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}