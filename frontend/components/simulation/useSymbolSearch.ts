import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAssetSearchFilters,
  searchAssets,
  type AssetCategory,
  type AssetSearchFilterOption,
  type AssetSearchItem,
  type AssetSearchResponse,
  type AssetSortOption,
} from "@/lib/assetSearch";
import { SYMBOL_CATEGORIES } from "@/components/simulation/symbolSearchModalParts";

type ViewType = "search" | "sources" | "countries" | "futureContracts";

function isRequestCanceled(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;

  if (typeof error === "object" && error !== null) {
    const maybeCode = (error as { code?: string }).code;
    const maybeName = (error as { name?: string }).name;
    if (maybeCode === "ERR_CANCELED" || maybeName === "CanceledError") return true;
  }

  return false;
}

export function useSymbolSearch(
  open: boolean,
  selectedSymbol: string,
  initialCategory: "all" | AssetCategory,
) {
  const [view, setView] = useState<ViewType>("search");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof SYMBOL_CATEGORIES)[number]["id"]>(initialCategory);
  const [country, setCountry] = useState("all");
  const [type, setType] = useState("all");
  const [sector, setSector] = useState("all");
  const [source, setSource] = useState("all");
  const [exchangeType, setExchangeType] = useState("all");
  const [futureCategory, setFutureCategory] = useState("all");
  const [economyCategory, setEconomyCategory] = useState("all");
  const [expiry, setExpiry] = useState("all");
  const [strike, setStrike] = useState("all");
  const [underlyingAsset, setUnderlyingAsset] = useState("all");
  const [sort, setSort] = useState<AssetSortOption>("relevance");

  const [rows, setRows] = useState<AssetSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<AssetSearchFilterOption[]>([]);
  const [typeOptions, setTypeOptions] = useState<AssetSearchFilterOption[]>([]);
  const [sectorOptions, setSectorOptions] = useState<AssetSearchFilterOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<AssetSearchFilterOption[]>([]);
  const [exchangeTypeOptions, setExchangeTypeOptions] = useState<AssetSearchFilterOption[]>([]);
  const [futureCategoryOptions, setFutureCategoryOptions] = useState<AssetSearchFilterOption[]>([]);
  const [economyCategoryOptions, setEconomyCategoryOptions] = useState<AssetSearchFilterOption[]>([]);
  const [expiryOptions, setExpiryOptions] = useState<AssetSearchFilterOption[]>([]);
  const [strikeOptions, setStrikeOptions] = useState<AssetSearchFilterOption[]>([]);
  const [underlyingAssetOptions, setUnderlyingAssetOptions] = useState<AssetSearchFilterOption[]>([]);
  const [sourceUiType, setSourceUiType] = useState<"modal" | "dropdown">("modal");

  const [selectedFutureRoot, setSelectedFutureRoot] = useState<AssetSearchItem | null>(null);

  const resultCache = useRef(new Map<string, { rows: AssetSearchItem[]; hasMore: boolean; total: number; nextCursor: string | null }>());
  const prefetchedPageCache = useRef(new Map<string, AssetSearchResponse>());
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const paginationInFlightRef = useRef(false);
  const firstPageAbortRef = useRef<AbortController | null>(null);
  const paginationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
  }, [initialCategory, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchAssetSearchFilters({ category: category === "all" ? undefined : category });
        if (cancelled) return;

        setActiveFilters(response.activeFilters ?? []);
        setCountryOptions(response.countries ?? []);
        setTypeOptions(response.types ?? []);
        setSectorOptions(response.sectors ?? []);
        setSourceOptions(response.sources ?? []);
        setExchangeTypeOptions(response.exchangeTypes ?? []);
        setFutureCategoryOptions(response.futureCategories ?? []);
        setEconomyCategoryOptions(response.economyCategories ?? []);
        setExpiryOptions(response.expiries ?? []);
        setStrikeOptions(response.strikes ?? []);
        setUnderlyingAssetOptions(response.underlyingAssets ?? []);
        setSourceUiType(response.sourceUiType ?? "modal");
      } catch {
        if (cancelled) return;
        setActiveFilters([]);
        setCountryOptions([]);
        setTypeOptions([]);
        setSectorOptions([]);
        setSourceOptions([]);
        setExchangeTypeOptions([]);
        setFutureCategoryOptions([]);
        setEconomyCategoryOptions([]);
        setExpiryOptions([]);
        setStrikeOptions([]);
        setUnderlyingAssetOptions([]);
        setSourceUiType("modal");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category, open]);

  useEffect(() => {
    setCountry("all");
    setType("all");
    setSector("all");
    setSource("all");
    setExchangeType("all");
    setFutureCategory("all");
    setEconomyCategory("all");
    setExpiry("all");
    setStrike("all");
    setUnderlyingAsset("all");
    setView("search");
    setSelectedFutureRoot(null);
  }, [category]);

  const filterKey = useMemo(() => JSON.stringify({
    q: query.trim(),
    category,
    country,
    type,
    sector,
    source,
    exchangeType,
    futureCategory,
    economyCategory,
    expiry,
    strike,
    underlyingAsset,
    sort,
  }), [query, category, country, type, sector, source, exchangeType, futureCategory, economyCategory, expiry, strike, underlyingAsset, sort]);

  useEffect(() => {
    if (!open) return;

    const loadFirstPage = async () => {
      const cached = resultCache.current.get(filterKey);
      if (cached) {
        setRows(cached.rows);
        setHasMore(cached.hasMore);
        setTotal(cached.total);
        setNextCursor(cached.nextCursor);
        return;
      }

      setLoading(true);
      firstPageAbortRef.current?.abort();
      paginationAbortRef.current?.abort();
      const controller = new AbortController();
      firstPageAbortRef.current = controller;
      try {
        const response = await searchAssets({
          q: query.trim(),
          category: category === "all" ? undefined : category,
          country: country === "all" ? undefined : country,
          type: type === "all" ? undefined : type,
          sector: sector === "all" ? undefined : sector,
          source: source === "all" ? undefined : source,
          exchangeType: exchangeType === "all" ? undefined : exchangeType,
          futureCategory: futureCategory === "all" ? undefined : futureCategory,
          economyCategory: economyCategory === "all" ? undefined : economyCategory,
          expiry: expiry === "all" ? undefined : expiry,
          strike: strike === "all" ? undefined : strike,
          underlyingAsset: underlyingAsset === "all" ? undefined : underlyingAsset,
          sort,
          limit: 50,
          signal: controller.signal,
        });

        setRows(response.assets);
        setHasMore(response.hasMore);
        setTotal(response.total);
        setNextCursor(response.nextCursor ?? null);
        resultCache.current.set(filterKey, {
          rows: response.assets,
          hasMore: response.hasMore,
          total: response.total,
          nextCursor: response.nextCursor ?? null,
        });
      } catch (error) {
        if (isRequestCanceled(error)) return;
        setRows([]);
        setHasMore(false);
        setTotal(0);
        setNextCursor(null);
      } finally {
        setLoading(false);
      }
    };

    const timer = window.setTimeout(async () => {
      await loadFirstPage();
    }, 200);

    return () => window.clearTimeout(timer);
  }, [open, filterKey, query, category, country, type, sector, source, exchangeType, futureCategory, economyCategory, expiry, strike, underlyingAsset, sort]);

  useEffect(() => {
    return () => {
      firstPageAbortRef.current?.abort();
      paginationAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const container = listContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (loading || loadingMore || paginationInFlightRef.current || !hasMore || !nextCursor) return;

      const scrollRatio = (container.scrollTop + container.clientHeight) / Math.max(container.scrollHeight, 1);
      if (scrollRatio < 0.8) return;

      paginationInFlightRef.current = true;
      setLoadingMore(true);
      paginationAbortRef.current?.abort();
      const controller = new AbortController();
      paginationAbortRef.current = controller;
      void (async () => {
        try {
          const prefetchedKey = `${filterKey}:${nextCursor}`;
          const prefetched = prefetchedPageCache.current.get(prefetchedKey);
          const response = prefetched ?? await searchAssets({
            q: query.trim(),
            category: category === "all" ? undefined : category,
            country: country === "all" ? undefined : country,
            type: type === "all" ? undefined : type,
            sector: sector === "all" ? undefined : sector,
            source: source === "all" ? undefined : source,
            exchangeType: exchangeType === "all" ? undefined : exchangeType,
            futureCategory: futureCategory === "all" ? undefined : futureCategory,
            economyCategory: economyCategory === "all" ? undefined : economyCategory,
            expiry: expiry === "all" ? undefined : expiry,
            strike: strike === "all" ? undefined : strike,
            underlyingAsset: underlyingAsset === "all" ? undefined : underlyingAsset,
            sort,
            cursor: nextCursor,
            limit: 50,
            signal: controller.signal,
          });
          prefetchedPageCache.current.delete(prefetchedKey);

          setRows((previous) => {
            const mergedMap = new Map(previous.map((item) => [`${item.category}|${item.ticker}|${item.exchange}`, item]));
            response.assets.forEach((item) => {
              mergedMap.set(`${item.category}|${item.ticker}|${item.exchange}`, item);
            });
            const merged = Array.from(mergedMap.values());
            resultCache.current.set(filterKey, {
              rows: merged,
              hasMore: response.hasMore,
              total: response.total,
              nextCursor: response.nextCursor ?? null,
            });
            return merged;
          });

          setHasMore(response.hasMore);
          setTotal(response.total);
          setNextCursor(response.nextCursor ?? null);
        } catch (error) {
          if (isRequestCanceled(error)) return;
          // Keep existing list on pagination failures.
        } finally {
          paginationInFlightRef.current = false;
          setLoadingMore(false);
        }
      })();
    };

    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [open, loading, loadingMore, hasMore, nextCursor, query, category, country, type, sector, source, exchangeType, futureCategory, economyCategory, expiry, strike, underlyingAsset, sort, filterKey]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setView("search");
    setSelectedFutureRoot(null);
  }, [open, selectedSymbol]);

  useEffect(() => {
    if (!open || loading || loadingMore || !hasMore || !nextCursor) return;
    const cacheKey = `${filterKey}:${nextCursor}`;
    if (prefetchedPageCache.current.has(cacheKey)) return;

    const controller = new AbortController();
    void searchAssets({
      q: query.trim(),
      category: category === "all" ? undefined : category,
      country: country === "all" ? undefined : country,
      type: type === "all" ? undefined : type,
      sector: sector === "all" ? undefined : sector,
      source: source === "all" ? undefined : source,
      exchangeType: exchangeType === "all" ? undefined : exchangeType,
      futureCategory: futureCategory === "all" ? undefined : futureCategory,
      economyCategory: economyCategory === "all" ? undefined : economyCategory,
      expiry: expiry === "all" ? undefined : expiry,
      strike: strike === "all" ? undefined : strike,
      underlyingAsset: underlyingAsset === "all" ? undefined : underlyingAsset,
      sort,
      cursor: nextCursor,
      limit: 50,
      signal: controller.signal,
    }).then((response) => {
      prefetchedPageCache.current.set(cacheKey, response);
    }).catch(() => {
      // Prefetch is best-effort.
    });

    return () => controller.abort();
  }, [open, loading, loadingMore, hasMore, nextCursor, filterKey, query, category, country, type, sector, source, exchangeType, futureCategory, economyCategory, expiry, strike, underlyingAsset, sort]);

  const selectedCountryLabel = useMemo(() => {
    return countryOptions.find((optionItem) => optionItem.value === country)?.label || "All Countries";
  }, [country, countryOptions]);

  const selectedTypeLabel = useMemo(() => {
    return typeOptions.find((optionItem) => optionItem.value === type)?.label || "All Types";
  }, [type, typeOptions]);

  const selectedSectorLabel = useMemo(() => {
    return sectorOptions.find((optionItem) => optionItem.value === sector)?.label || "All Sectors";
  }, [sector, sectorOptions]);

  const selectedSourceLabel = useMemo(() => {
    return sourceOptions.find((optionItem) => optionItem.value === source)?.label || "All Sources";
  }, [source, sourceOptions]);

  const selectedExchangeTypeLabel = useMemo(() => {
    return exchangeTypeOptions.find((optionItem) => optionItem.value === exchangeType)?.label || "All";
  }, [exchangeType, exchangeTypeOptions]);

  const selectedFutureCategoryLabel = useMemo(() => {
    return futureCategoryOptions.find((optionItem) => optionItem.value === futureCategory)?.label || "All Categories";
  }, [futureCategory, futureCategoryOptions]);

  const selectedEconomyCategoryLabel = useMemo(() => {
    return economyCategoryOptions.find((optionItem) => optionItem.value === economyCategory)?.label || "All Categories";
  }, [economyCategory, economyCategoryOptions]);

  const selectedExpiryLabel = useMemo(() => {
    return expiryOptions.find((optionItem) => optionItem.value === expiry)?.label || "All Expiries";
  }, [expiry, expiryOptions]);

  const selectedStrikeLabel = useMemo(() => {
    return strikeOptions.find((optionItem) => optionItem.value === strike)?.label || "All Strikes";
  }, [strike, strikeOptions]);

  const selectedUnderlyingAssetLabel = useMemo(() => {
    return underlyingAssetOptions.find((optionItem) => optionItem.value === underlyingAsset)?.label || "All Underlying";
  }, [underlyingAsset, underlyingAssetOptions]);

  return {
    view,
    setView,
    query,
    setQuery,
    category,
    setCategory,
    country,
    setCountry,
    type,
    setType,
    sector,
    setSector,
    source,
    setSource,
    exchangeType,
    setExchangeType,
    futureCategory,
    setFutureCategory,
    economyCategory,
    setEconomyCategory,
    expiry,
    setExpiry,
    strike,
    setStrike,
    underlyingAsset,
    setUnderlyingAsset,
    sort,
    setSort,
    rows,
    loading,
    loadingMore,
    hasMore,
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
    selectedFutureRoot,
    setSelectedFutureRoot,
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
  };
}