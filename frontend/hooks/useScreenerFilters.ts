import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  DateRangeFilterValue,
  ParsedFilters,
  RangeFilterValue,
  ScreenerFilterField,
  ScreenerMetaResponse,
} from "@/lib/screener";
import {
  DATE_FILTER_KEYS,
  DEFAULT_FILTER_KEYS,
  MULTI_FILTER_KEYS,
  RANGE_FILTER_KEYS,
  TOGGLE_FILTER_KEYS,
  dedupe,
  getDateParamNames,
  getMultiParamName,
  isFilterActiveValue,
} from "@/lib/screener";

export function useScreenerFilters(meta: ScreenerMetaResponse | null, parsedFilters: ParsedFilters) {
  const [, setSearchParams] = useSearchParams();
  const [manualFilterKeys, setManualFilterKeys] = useState<string[]>([]);
  const [editingFilterKey, setEditingFilterKey] = useState<string | null>(null);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [addFilterSearch, setAddFilterSearch] = useState("");

  const addFilterRef = useRef<HTMLDivElement | null>(null);
  const filterChipRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filterLookup = useMemo(() => {
    const map = new Map<string, ScreenerFilterField>();
    (meta?.filterFields || []).forEach((field) => map.set(field.key, field));
    return map;
  }, [meta]);

  const activeFilterKeys = useMemo(() => {
    const keys: string[] = [];
    for (const key of [...MULTI_FILTER_KEYS, ...RANGE_FILTER_KEYS, ...DATE_FILTER_KEYS, ...TOGGLE_FILTER_KEYS]) {
      if (isFilterActiveValue(parsedFilters[key])) keys.push(key);
    }
    return keys;
  }, [parsedFilters]);

  const visibleFilterKeys = useMemo(
    () => dedupe([...DEFAULT_FILTER_KEYS, ...manualFilterKeys, ...activeFilterKeys]).filter((key) => filterLookup.has(key)),
    [activeFilterKeys, filterLookup, manualFilterKeys],
  );

  const filterFields = useMemo(
    () => visibleFilterKeys.map((key) => filterLookup.get(key)).filter(Boolean) as ScreenerFilterField[],
    [filterLookup, visibleFilterKeys],
  );

  const filterCount = activeFilterKeys.length;

  const updateSearch = useCallback((apply: (next: URLSearchParams) => void) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      apply(next);
      if (!next.get("tab")) next.set("tab", "overview");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearLegacyFilterParams = useCallback((params: URLSearchParams) => {
    params.delete("country"); params.delete("sector"); params.delete("exchange"); params.delete("primary");
  }, []);

  const setMultiFilter = useCallback((key: string, values: string[]) => {
    const paramName = getMultiParamName(key);
    updateSearch((next) => { clearLegacyFilterParams(next); if (values.length === 0) next.delete(paramName); else next.set(paramName, values.join(",")); });
  }, [clearLegacyFilterParams, updateSearch]);

  const setRangeFilter = useCallback((key: string, value?: RangeFilterValue) => {
    updateSearch((next) => { next.delete(`${key}Min`); next.delete(`${key}Max`); if (value?.min !== undefined) next.set(`${key}Min`, String(value.min)); if (value?.max !== undefined) next.set(`${key}Max`, String(value.max)); });
  }, [updateSearch]);

  const setDateFilter = useCallback((key: string, value?: DateRangeFilterValue) => {
    const params = getDateParamNames(key);
    updateSearch((next) => { next.delete(params.from); next.delete(params.to); if (value?.from) next.set(params.from, value.from); if (value?.to) next.set(params.to, value.to); });
  }, [updateSearch]);

  const setToggleFilter = useCallback((key: string, value: boolean) => {
    if (key !== "primaryListingOnly") return;
    updateSearch((next) => { next.delete("primary"); if (value) next.set("primaryListing", "true"); else next.delete("primaryListing"); });
  }, [updateSearch]);

  const clearAllFilters = useCallback(() => {
    updateSearch((next) => {
      clearLegacyFilterParams(next);
      for (const key of MULTI_FILTER_KEYS) next.delete(getMultiParamName(key));
      for (const key of RANGE_FILTER_KEYS) { next.delete(`${key}Min`); next.delete(`${key}Max`); }
      for (const key of DATE_FILTER_KEYS) { const names = getDateParamNames(key); next.delete(names.from); next.delete(names.to); }
      next.delete("primaryListing");
    });
    setManualFilterKeys([]);
    setEditingFilterKey(null);
  }, [clearLegacyFilterParams, updateSearch]);

  return {
    filterFields, visibleFilterKeys, filterCount, activeFilterKeys,
    editingFilterKey, setEditingFilterKey,
    addFilterOpen, setAddFilterOpen,
    addFilterSearch, setAddFilterSearch,
    addFilterRef, filterChipRefs,
    manualFilterKeys, setManualFilterKeys,
    setMultiFilter, setRangeFilter, setDateFilter, setToggleFilter, clearAllFilters,
    updateSearch,
  };
}
