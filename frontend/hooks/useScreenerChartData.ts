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
): { data: DataMap; loading: boolean; isRefreshing: boolean; refresh: () => void } {
  const [data, setData] = useState<DataMap>({});
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const symbolsRef = useRef(symbols);
  const periodRef = useRef(period);
  symbolsRef.current = symbols;
  periodRef.current = period;

  const fetchData = useCallback(async (syms: string[], per: string, isRefresh: boolean) => {
    if (!syms.length) { setData({}); setLoading(false); setIsRefreshing(false); return; }
    if (isRefresh) setIsRefreshing(true); else setLoading(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const ttl = cacheTtl(per);
    const now = Date.now();
    const result: DataMap = {};
    const uncached: string[] = [];

    for (const sym of syms) {
      const entry = cache.get(`${sym}:${per}`);
      if (entry && now - entry.ts < ttl) result[sym] = entry.data;
      else uncached.push(sym);
    }

    if (uncached.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < uncached.length; i += BATCH_SIZE) batches.push(uncached.slice(i, i + BATCH_SIZE));
      try {
        await Promise.all(
          batches.map(async (batch) => {
            const resp = await api.get<DataMap>("/screener/chart-data", {
              params: { symbols: batch.join(","), period: per },
              signal: ac.signal,
            });
            for (const [k, v] of Object.entries(resp.data)) {
              result[k] = v;
              cache.set(`${k}:${per}`, { data: v, ts: Date.now() });
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

  // Fetch on mount and when symbols/period change
  useEffect(() => {
    void fetchData(symbols, period, false);
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(","), period]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => {
      void fetchData(symbolsRef.current, periodRef.current, true);
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const refresh = useCallback(() => {
    for (const sym of symbolsRef.current) cache.delete(`${sym}:${periodRef.current}`);
    void fetchData(symbolsRef.current, periodRef.current, true);
  }, [fetchData]);

  return { data, loading, isRefreshing, refresh };
}
