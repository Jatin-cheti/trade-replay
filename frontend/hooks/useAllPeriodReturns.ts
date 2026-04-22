/**
 * useAllPeriodReturns
 *
 * Fetches the period-start closing price for each time-period chip via the
 * /api/candles endpoint (real Yahoo Finance data). Computes the percentage
 * return relative to the current live quote price.
 *
 * Each period maps to a start date; we query a 3-day window starting there
 * and take the first candle's close as the anchor price.
 */

import { useState, useEffect, useRef } from "react";
import axios from "axios";

// Use a relative-URL axios instance so requests go through the Vite proxy in
// development (→ localhost:4000) and through the Vercel rewrite in production
// (→ api.tradereplay.me).  The `api` singleton has an absolute production base
// URL baked in via VITE_API_URL, which bypasses the local backend entirely.
const candlesAxios = axios.create({ baseURL: "/api" });

// ──────────────────────────────────────────────────────────────────────────────
// Period start-date helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Returns the Unix-seconds timestamp for the most recent trading day's 15:30 close (UTC). */
function prevTradingDayCloseSec(): number {
  // Walk back from yesterday until we hit a weekday
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  // 15:30 IST = 10:00 UTC
  return Math.floor(d.getTime() / 1000) + 36_000;
}

/** Returns the start timestamp (seconds UTC) for each chip key. */
function getPeriodStartSec(period: string): number {
  const now = Math.floor(Date.now() / 1000);

  switch (period) {
    case "1d":  return prevTradingDayCloseSec();
    case "5d":  return now - 7   * 86_400;
    case "1m":  return now - 31  * 86_400;
    case "3m":  return now - 95  * 86_400;
    case "6m":  return now - 185 * 86_400;
    case "ytd": return Math.floor(new Date(new Date().getUTCFullYear(), 0, 1).getTime() / 1000);
    case "1y":  return now - 366 * 86_400;
    case "5y":  return now - 5   * 366 * 86_400;
    case "10y": return now - 10  * 366 * 86_400;
    case "all": return 946_684_800; // Jan 1 2000
    default:    return prevTradingDayCloseSec();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export type PeriodReturns = Record<string, number | null>;

const ALL_CHIP_PERIODS = ["1d", "5d", "1m", "3m", "6m", "ytd", "1y", "5y", "10y", "all"] as const;

export function useAllPeriodReturns(
  symbol: string | undefined,
  exchange: string | undefined | null,
  currentPrice: number | null | undefined,
): { returns: PeriodReturns; loading: boolean } {
  const [returns, setReturns] = useState<PeriodReturns>({});
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!symbol || !currentPrice || currentPrice <= 0) {
      setLoading(false);
      return;
    }

    // Cancel any in-flight request for a previous symbol/price combo
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);

    /** Fetch the period-start close for one period key. Returns null on error. */
    const fetchStartClose = async (period: string): Promise<number | null> => {
      try {
        const from = getPeriodStartSec(period);
        const to   = from + 4 * 86_400; // 4-day window to find the nearest candle

        const exchangeParam = exchange ? `&exchange=${encodeURIComponent(exchange)}` : "";
        const url = `/candles/${encodeURIComponent(symbol)}?resolution=D&from=${from}&to=${to}&limit=1${exchangeParam}`;

        const res = await candlesAxios.get<{ candles: { close: number; time: number }[] }>(url, {
          signal: ac.signal,
        });

        const candles = res.data?.candles ?? [];
        if (!candles.length) return null;

        const price = Number(candles[0].close);
        return price > 0 ? price : null;
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        const isAbortAxios = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ERR_CANCELED";
        if (!isAbort && !isAbortAxios) {
          console.warn(`[PeriodReturn] ${period} error:`, err instanceof Error ? err.message : err);
        }
        return null;
      }
    };

    Promise.allSettled(ALL_CHIP_PERIODS.map(p => fetchStartClose(p))).then(results => {
      if (ac.signal.aborted) return;

      const map: PeriodReturns = {};
      ALL_CHIP_PERIODS.forEach((period, i) => {
        const r = results[i];
        if (r.status === "fulfilled" && r.value != null && r.value > 0) {
          map[period] = ((currentPrice - r.value) / r.value) * 100;
        } else {
          map[period] = null;
        }
      });

      // Sanity check: warn if all non-null values are identical (backend ignoring params)
      if (process.env.NODE_ENV === "development") {
        const vals = Object.values(map).filter(v => v !== null);
        const unique = new Set(vals.map(v => (v as number).toFixed(2)));
        if (unique.size === 1 && vals.length > 3) {
          console.error("❌ All period returns identical — backend may be ignoring from/to params");
        } else {
          console.log("✅ Period returns:", Object.fromEntries(
            Object.entries(map).map(([k, v]) => [k, v != null ? v.toFixed(2) + "%" : "null"])
          ));
        }
      }

      setReturns(map);
      setLoading(false);
    });

    return () => {
      ac.abort();
    };
  }, [symbol, exchange, currentPrice]);

  return { returns, loading };
}
