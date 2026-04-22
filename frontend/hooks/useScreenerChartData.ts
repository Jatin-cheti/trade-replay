import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { CandleData } from "@/data/stockData";

export interface ScreenerChartSymbolData {
  symbol: string;
  currentPrice: number;
  changePercent: number;
  candles: CandleData[];
}

type DataMap = Record<string, ScreenerChartSymbolData>;

const BATCH_SIZE = 50;

function cacheTtl(period: string): number {
  if (period === "1D") return 30_000;
  if (period === "5D") return 60_000;
  return 300_000;
}

interface CacheEntry { data: ScreenerChartSymbolData; ts: number }

// Module-level cache keyed by `${symbol}:${period}`
const cache = new Map<string, CacheEntry>();

export function useScreenerChartData(
  symbols: string[],
  period: string,
  customRange?: { from: Date; to: Date },
): { data: DataMap; loading: boolean; isRefreshing: boolean; refresh: () => void } {
  const [data, setData] = useState<DataMap>({});
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const symbolsRef = useRef(symbols);
  const periodRef = useRef(period);
  const customRangeRef = useRef(customRange);
  symbolsRef.current = symbols;
  periodRef.current = period;
  customRangeRef.current = customRange;

  const fetchData = useCallback(async (syms: string[], per: string, isRefresh: boolean, range?: { from: Date; to: Date }) => {
    if (!syms.length) { setData({}); setLoading(false); setIsRefreshing(false); return; }
    if (isRefresh) setIsRefreshing(true); else setLoading(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Custom range uses a different cache key and no TTL
    const cacheKey = range
      ? `${range.from.toISOString().slice(0, 10)}:${range.to.toISOString().slice(0, 10)}`
      : per;

    const ttl = range ? 300_000 : cacheTtl(per);
    const now = Date.now();
    const result: DataMap = {};
    const uncached: string[] = [];

    for (const sym of syms) {
      const entry = cache.get(`${sym}:${cacheKey}`);
      if (entry && now - entry.ts < ttl) result[sym] = entry.data;
      else uncached.push(sym);
    }

    if (uncached.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < uncached.length; i += BATCH_SIZE) batches.push(uncached.slice(i, i + BATCH_SIZE));
      try {
        await Promise.all(
          batches.map(async (batch) => {
            const params: Record<string, string> = { symbols: batch.join(",") };
            if (range) {
              params.from = range.from.toISOString().slice(0, 10);
              params.to = range.to.toISOString().slice(0, 10);
            } else {
              params.period = per;
            }
            const resp = await api.get<DataMap>("/screener/chart-data", {
              params,
              signal: ac.signal,
            });
            for (const [k, v] of Object.entries(resp.data)) {
              result[k] = v;
              cache.set(`${k}:${cacheKey}`, { data: v, ts: Date.now() });
            }
          }),
        );
      } catch (err: unknown) {
        const name = (err as { name?: string }).name;
        if (name !== "CanceledError" && name !== "AbortError") {
          console.error("[useScreenerChartData]", err);
        }
      }
    }

    if (!ac.signal.aborted) {
      setData(result);
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch on mount and when symbols/period/customRange change
  const customRangeKey = customRange ? `${customRange.from.toISOString()}:${customRange.to.toISOString()}` : "";
  useEffect(() => {
    void fetchData(symbols, period, false, customRange);
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(","), period, customRangeKey]);

  // Auto-refresh every 60s (skip for custom range)
  useEffect(() => {
    const id = setInterval(() => {
      if (!customRangeRef.current) {
        void fetchData(symbolsRef.current, periodRef.current, true);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const refresh = useCallback(() => {
    const range = customRangeRef.current;
    const cacheKey = range
      ? `${range.from.toISOString().slice(0, 10)}:${range.to.toISOString().slice(0, 10)}`
      : periodRef.current;
    for (const sym of symbolsRef.current) cache.delete(`${sym}:${cacheKey}`);
    void fetchData(symbolsRef.current, periodRef.current, true, range ?? undefined);
  }, [fetchData]);

  return { data, loading, isRefreshing, refresh };
}
