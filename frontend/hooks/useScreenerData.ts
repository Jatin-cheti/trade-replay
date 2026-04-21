import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, getDetectedCountry } from "@/lib/api";
import type {
  DateRangeFilterValue,
  ParsedFilters,
  RangeFilterValue,
  ScreenerItem,
  ScreenerListResponse,
  SortOrder,
} from "@/lib/screener";
import {
  BATCH_SIZE,
  DATE_FILTER_KEYS,
  MULTI_FILTER_KEYS,
  RANGE_FILTER_KEYS,
  getDateParamNames,
  getMultiParamName,
  parseFiltersFromSearch,
} from "@/lib/screener";

export function useScreenerData(routeType: string, selectedColumns: string[]) {
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [flashBySymbol, setFlashBySymbol] = useState<Record<string, "up" | "down">>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchKeyRef = useRef("");
  const fetchCounterRef = useRef(0);
  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);
  const prefetchInFlightRef = useRef(false);
  const prefetchedRef = useRef<{ key: string; offset: number; payload: ScreenerListResponse } | null>(null);
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  const flashClearTimerRef = useRef<number | null>(null);

  const parsedFilters = useMemo(() => {
    const f = parseFiltersFromSearch(searchParams);
    // Default stock/etf/bond screeners to user's detected country
    const countryTypes = new Set(["stocks", "etfs", "bonds"]);
    if (!f.marketCountries && countryTypes.has(routeType)) {
      const userCountry = getDetectedCountry();
      if (userCountry && userCountry !== "WORLD") {
        f.marketCountries = [userCountry];
      }
      // If no country detected yet, show all (no filter)
    }
    return f;
  }, [searchParams, routeType]);
  const activeTab = searchParams.get("tab") || "overview";
  const sortField = searchParams.get("sort") || "marketCap";
  const sortOrder: SortOrder = searchParams.get("order") === "asc" ? "asc" : "desc";

  const requestKey = useMemo(() => {
    return JSON.stringify({ routeType, tab: activeTab, sortField, sortOrder, query: searchParams.get("q") || "", columns: selectedColumns, filters: parsedFilters });
  }, [activeTab, parsedFilters, routeType, searchParams, selectedColumns, sortField, sortOrder]);

  const buildRequestParams = useCallback((offset: number) => {
    const params: Record<string, string | number | boolean> = {
      type: routeType, tab: activeTab, columns: selectedColumns.join(","), limit: BATCH_SIZE, offset, sort: sortField, order: sortOrder,
    };
    const q = searchParams.get("q") || "";
    if (q) params.q = q;
    for (const key of MULTI_FILTER_KEYS) {
      const value = parsedFilters[key];
      if (Array.isArray(value) && value.length > 0) params[getMultiParamName(key)] = value.join(",");
    }
    for (const key of RANGE_FILTER_KEYS) {
      const value = parsedFilters[key] as RangeFilterValue | undefined;
      if (value?.min !== undefined) params[`${key}Min`] = value.min;
      if (value?.max !== undefined) params[`${key}Max`] = value.max;
    }
    for (const key of DATE_FILTER_KEYS) {
      const value = parsedFilters[key] as DateRangeFilterValue | undefined;
      if (!value) continue;
      const names = getDateParamNames(key);
      if (value.from) params[names.from] = value.from;
      if (value.to) params[names.to] = value.to;
    }
    if (parsedFilters.primaryListingOnly === true) params.primaryListing = true;
    return params;
  }, [activeTab, parsedFilters, routeType, searchParams, selectedColumns, sortField, sortOrder]);

  const fetchBatch = useCallback(async (offset: number): Promise<ScreenerListResponse> => {
    const params = buildRequestParams(offset);
    const response = await api.get<ScreenerListResponse>("/screener/list", { params });

    // Dev-only diagnostics for data mapping
    if (import.meta.env.DEV && response.data.items.length > 0) {
      const sample = response.data.items[0];
      const requestedCols = (params.columns as string || "").split(",").filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const missingFields = requestedCols.filter((col: string) => col !== "symbol" && (sample as any)[col] === undefined);
      if (missingFields.length > 0) {
        console.warn("[Screener] Fields requested but undefined in response:", missingFields, "| Sample keys:", Object.keys(sample));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nullFields = requestedCols.filter((col: string) => (sample as any)[col] === null);
      if (nullFields.length > 0) {
        console.debug("[Screener] Fields with null value (genuinely unavailable):", nullFields);
      }
    }

    return response.data;
  }, [buildRequestParams]);

  const schedulePrefetch = useCallback(async (key: string, offset: number) => {
    if (prefetchInFlightRef.current || !hasMoreRef.current) return;
    prefetchInFlightRef.current = true;
    try {
      const payload = await fetchBatch(offset);
      if (fetchKeyRef.current !== key) return;
      prefetchedRef.current = { key, offset, payload };
    } catch { prefetchedRef.current = null; }
    finally { prefetchInFlightRef.current = false; }
  }, [fetchBatch]);

  const refreshList = useCallback(async () => {
    setLoading(true); setLoadingMore(false);
    prefetchedRef.current = null; hasMoreRef.current = true; offsetRef.current = 0;
    const key = requestKey; fetchKeyRef.current = key;
    const fetchId = ++fetchCounterRef.current;
    try {
      const payload = await fetchBatch(0);
      if (fetchCounterRef.current !== fetchId || fetchKeyRef.current !== key) return;
      const nextPrices = new Map<string, number>();
      const nextFlash: Record<string, "up" | "down"> = {};
      payload.items.forEach((entry) => {
        const sk = entry.fullSymbol || entry.symbol;
        const prev = previousPricesRef.current.get(sk);
        if (typeof prev === "number" && Number.isFinite(prev) && Number.isFinite(entry.price) && entry.price !== prev)
          nextFlash[sk] = entry.price > prev ? "up" : "down";
        nextPrices.set(sk, entry.price);
      });
      setItems(payload.items); previousPricesRef.current = nextPrices;
      if (flashClearTimerRef.current !== null) { window.clearTimeout(flashClearTimerRef.current); flashClearTimerRef.current = null; }
      setFlashBySymbol(nextFlash);
      if (Object.keys(nextFlash).length > 0) { flashClearTimerRef.current = window.setTimeout(() => { setFlashBySymbol({}); flashClearTimerRef.current = null; }, 900); }
      setTotal(payload.total); hasMoreRef.current = payload.hasMore; offsetRef.current = payload.offset + payload.items.length;
      if (payload.hasMore) void schedulePrefetch(key, offsetRef.current);
    } catch { if (fetchCounterRef.current === fetchId) { setItems([]); setTotal(0); hasMoreRef.current = false; } }
    finally { if (fetchCounterRef.current === fetchId) setLoading(false); }
  }, [fetchBatch, requestKey, schedulePrefetch]);

  const refreshListRef = useRef(refreshList);
  refreshListRef.current = refreshList;
  useEffect(() => { void refreshListRef.current(); }, [requestKey]);

  useEffect(() => {
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void refreshListRef.current(); }, 12000);
    return () => { window.clearInterval(poll); if (flashClearTimerRef.current !== null) { window.clearTimeout(flashClearTimerRef.current); flashClearTimerRef.current = null; } };
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMoreRef.current) return;
    const key = fetchKeyRef.current; const offset = offsetRef.current;
    if (prefetchedRef.current && prefetchedRef.current.key === key && prefetchedRef.current.offset === offset) {
      const payload = prefetchedRef.current.payload; prefetchedRef.current = null;
      setItems((prev) => [...prev, ...payload.items]); setTotal(payload.total); hasMoreRef.current = payload.hasMore; offsetRef.current = offset + payload.items.length;
      if (payload.hasMore) void schedulePrefetch(key, offsetRef.current);
      return;
    }
    setLoadingMore(true); const fetchId = ++fetchCounterRef.current;
    try {
      const payload = await fetchBatch(offset);
      if (fetchCounterRef.current !== fetchId || fetchKeyRef.current !== key) return;
      setItems((prev) => [...prev, ...payload.items]); setTotal(payload.total); hasMoreRef.current = payload.hasMore; offsetRef.current = offset + payload.items.length;
      if (payload.hasMore) void schedulePrefetch(key, offsetRef.current);
    } finally { if (fetchCounterRef.current === fetchId) setLoadingMore(false); }
  }, [fetchBatch, loading, loadingMore, schedulePrefetch]);

  return { items, flashBySymbol, total, loading, loadingMore, parsedFilters, activeTab, sortField, sortOrder, refreshList, loadMore };
}
