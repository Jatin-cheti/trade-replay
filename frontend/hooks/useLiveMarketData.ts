import { useEffect, useMemo, useRef, useState } from "react";
import type { CandleData } from "@/data/stockData";
import { fetchLiveSnapshot, type LiveQuote } from "@/services/live/liveMarketApi";

type LiveMode = "symbol" | "portfolio";

type PortfolioHolding = {
  symbol: string;
  quantity: number;
};

type LiveMarketState = {
  symbolCandles: CandleData[];
  symbolQuote: LiveQuote | null;
  quotesBySymbol: Record<string, LiveQuote>;
  portfolioCandles: CandleData[];
  portfolioValue: number;
  portfolioChangePercent: number;
  isLoading: boolean;
  error: string | null;
};

const initialState: LiveMarketState = {
  symbolCandles: [],
  symbolQuote: null,
  quotesBySymbol: {},
  portfolioCandles: [],
  portfolioValue: 0,
  portfolioChangePercent: 0,
  isLoading: true,
  error: null,
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function buildPortfolioCandles(holdings: PortfolioHolding[], candlesBySymbol: Record<string, CandleData[]>): CandleData[] {
  if (holdings.length === 0) return [];

  const prepared = holdings
    .map((holding) => ({
      quantity: holding.quantity,
      candles: candlesBySymbol[normalizeSymbol(holding.symbol)] ?? [],
    }))
    .filter((row) => row.quantity > 0 && row.candles.length > 0);

  if (prepared.length === 0) return [];

  const minLength = prepared.reduce((min, row) => Math.min(min, row.candles.length), Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(minLength) || minLength <= 0) return [];

  const series: CandleData[] = [];
  let previousClose = 0;

  for (let index = 0; index < minLength; index += 1) {
    let open = 0;
    let close = 0;
    let high = 0;
    let low = 0;
    let volume = 0;
    let time = "";

    prepared.forEach((row) => {
      const candle = row.candles[index];
      open += candle.open * row.quantity;
      close += candle.close * row.quantity;
      high += candle.high * row.quantity;
      low += candle.low * row.quantity;
      volume += candle.volume;
      time = candle.time;
    });

    const normalizedOpen = Number(open.toFixed(4));
    const normalizedClose = Number(close.toFixed(4));
    const normalizedHigh = Number(Math.max(high, normalizedOpen, normalizedClose).toFixed(4));
    const normalizedLow = Number(Math.min(low, normalizedOpen, normalizedClose).toFixed(4));

    series.push({
      time,
      open: previousClose || normalizedOpen,
      high: normalizedHigh,
      low: normalizedLow,
      close: normalizedClose,
      volume,
    });

    previousClose = normalizedClose;
  }

  return series;
}

export function useLiveMarketData(input: {
  mode: LiveMode;
  symbol: string;
  holdings: PortfolioHolding[];
  quoteSymbols?: string[];
  pollMs?: number;
}) {
  const { mode, symbol, holdings, quoteSymbols = [], pollMs = 2500 } = input;

  const [state, setState] = useState<LiveMarketState>(initialState);
  const frameRef = useRef<number | null>(null);
  const queuedRef = useRef<Partial<LiveMarketState> | null>(null);
  const inFlightRef = useRef(false);
  const portfolioCandleMapRef = useRef<Record<string, CandleData[]>>({});
  const initializedPortfolioSymbolsRef = useRef<string>("");

  const holdingsKey = useMemo(
    () => holdings.map((holding) => `${normalizeSymbol(holding.symbol)}:${holding.quantity}`).sort().join("|"),
    [holdings],
  );

  const quoteSymbolsKey = useMemo(
    () => quoteSymbols.map((item) => normalizeSymbol(item)).sort().join("|"),
    [quoteSymbols],
  );

  const flushQueued = () => {
    if (frameRef.current != null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const queued = queuedRef.current;
      if (!queued) return;

      queuedRef.current = null;
      setState((prev) => ({ ...prev, ...queued }));
    });
  };

  useEffect(() => {
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentSymbolsKey = holdings.map((holding) => normalizeSymbol(holding.symbol)).sort().join(",");
    if (currentSymbolsKey !== initializedPortfolioSymbolsRef.current) {
      portfolioCandleMapRef.current = {};
      initializedPortfolioSymbolsRef.current = currentSymbolsKey;
    }
  }, [holdings]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const normalizedSymbol = normalizeSymbol(symbol);
        const requestedQuoteSymbols = Array.from(new Set([
          normalizedSymbol,
          ...quoteSymbols.map((item) => normalizeSymbol(item)),
          ...holdings.map((holding) => normalizeSymbol(holding.symbol)),
        ].filter(Boolean)));
        const requestedCandleSymbols = mode === "portfolio"
          ? Array.from(new Set([
            normalizedSymbol,
            ...holdings.map((holding) => normalizeSymbol(holding.symbol)),
          ].filter(Boolean)))
          : [normalizedSymbol];

        const snapshot = await fetchLiveSnapshot({
          symbols: requestedQuoteSymbols,
          candleSymbols: requestedCandleSymbols,
          candleLimit: mode === "portfolio" ? 220 : 260,
        });

        const symbolCandles = snapshot.candlesBySymbol[normalizedSymbol] ?? [];
        let partial: Partial<LiveMarketState> = {
          symbolCandles,
          symbolQuote: snapshot.quotes[normalizedSymbol] ?? null,
          quotesBySymbol: snapshot.quotes,
          isLoading: false,
          error: null,
        };

        if (mode === "portfolio" && holdings.length > 0) {
          for (const [snapshotSymbol, candles] of Object.entries(snapshot.candlesBySymbol)) {
            portfolioCandleMapRef.current[snapshotSymbol] = candles;
          }

          const portfolioCandles = buildPortfolioCandles(holdings, portfolioCandleMapRef.current);
          const last = portfolioCandles[portfolioCandles.length - 1];
          const prev = portfolioCandles[portfolioCandles.length - 2] ?? last;
          const changePercent = prev && prev.close !== 0 ? ((last?.close ?? 0) - prev.close) / prev.close * 100 : 0;

          partial = {
            ...partial,
            portfolioCandles,
            portfolioValue: last?.close ?? 0,
            portfolioChangePercent: Number(changePercent.toFixed(4)),
          };
        }

        if (!cancelled) {
          queuedRef.current = { ...(queuedRef.current ?? {}), ...partial };
          flushQueued();
        }
      } catch (error) {
        if (!cancelled) {
          queuedRef.current = {
            ...(queuedRef.current ?? {}),
            isLoading: false,
            error: error instanceof Error ? error.message : "Live market data unavailable",
          };
          flushQueued();
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, Math.max(1000, pollMs));

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mode, symbol, holdings, holdingsKey, quoteSymbols, quoteSymbolsKey, pollMs]);

  return state;
}
