import { useEffect, useMemo, useRef, useState } from "react";
import type { CandleData } from "@/data/stockData";
import { fetchLiveCandles, fetchLiveQuotes, type LiveDataMode, type LiveQuote } from "@/services/live/liveMarketApi";
import { fetchChartBundle } from "@/services/api/chartBundle";

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

const PARITY_LIVE_CANDLE_LIMIT = 391;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function toMinuteIso(input: string): string {
  const value = Date.parse(input);
  if (!Number.isFinite(value)) return input;
  return new Date(Math.floor(value / 60_000) * 60_000).toISOString();
}

function normalizeMinuteCandles(candles: CandleData[]): CandleData[] {
  if (candles.length <= 1) return candles;

  const sorted = candles
    .slice()
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

  const normalized: CandleData[] = [];
  for (const candle of sorted) {
    const bucketTime = toMinuteIso(candle.time);
    const previous = normalized[normalized.length - 1];

    if (previous && previous.time === bucketTime) {
      previous.high = Math.max(previous.high, candle.high);
      previous.low = Math.min(previous.low, candle.low);
      previous.close = candle.close;
      previous.volume = Math.max(previous.volume, candle.volume);
      continue;
    }

    normalized.push({ ...candle, time: bucketTime });
  }

  return normalized;
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
  dataMode?: LiveDataMode;
}) {
  const { mode, symbol, holdings, quoteSymbols = [], pollMs = 2500, dataMode } = input;

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

        let symbolCandles: CandleData[] = [];
        let symbolQuoteFromCandles: LiveQuote | null = null;

        if (dataMode === "parity-live") {
          const livePayload = await fetchLiveCandles({
            symbol: normalizedSymbol,
            limit: PARITY_LIVE_CANDLE_LIMIT,
            dataMode,
          });
          symbolCandles = normalizeMinuteCandles(livePayload.candles);
          symbolQuoteFromCandles = livePayload.quote;
        } else {
          const symbolPayload = await fetchChartBundle({
            symbol: normalizedSymbol,
            timeframe: "1m",
            limit: 260,
            dataMode,
            transformType: "renko",
            params: { boxSize: 0.5 },
            indicators: [{ id: "sma", params: { period: 20 } }],
          });
          symbolCandles = normalizeMinuteCandles(symbolPayload.candles);
        }

        let partial: Partial<LiveMarketState> = {
          symbolCandles,
          symbolQuote: symbolQuoteFromCandles,
          isLoading: false,
          error: null,
        };

        const requestedQuoteSymbols = Array.from(new Set([
          normalizedSymbol,
          ...quoteSymbols.map((item) => normalizeSymbol(item)),
          ...holdings.map((holding) => normalizeSymbol(holding.symbol)),
        ].filter(Boolean)));

        if (requestedQuoteSymbols.length > 0) {
          const watchlistQuotesPayload = await fetchLiveQuotes({ symbols: requestedQuoteSymbols, dataMode });
          partial = {
            ...partial,
            quotesBySymbol: watchlistQuotesPayload.quotes,
            symbolQuote: watchlistQuotesPayload.quotes[normalizedSymbol] ?? symbolQuoteFromCandles,
          };
        }

        if (mode === "portfolio" && holdings.length > 0) {
          const symbols = holdings.map((holding) => normalizeSymbol(holding.symbol));

          const missing = symbols.filter((item) => !(item in portfolioCandleMapRef.current));
          if (missing.length > 0) {
            const candleLoads = await Promise.all(
              missing.map(async (item) => {
                if (dataMode === "parity-live") {
                  const response = await fetchLiveCandles({ symbol: item, limit: PARITY_LIVE_CANDLE_LIMIT, dataMode });
                  return { symbol: item, candles: normalizeMinuteCandles(response.candles) };
                }

                const response = await fetchChartBundle({
                  symbol: item,
                  timeframe: "1m",
                  limit: 220,
                  dataMode,
                  transformType: "renko",
                  params: { boxSize: 0.5 },
                  indicators: [{ id: "sma", params: { period: 20 } }],
                });
                return { symbol: item, candles: normalizeMinuteCandles(response.candles) };
              }),
            );

            candleLoads.forEach((entry) => {
              portfolioCandleMapRef.current[entry.symbol] = entry.candles;
            });
          }

          const quotesPayload = await fetchLiveQuotes({ symbols, dataMode });

          Object.entries(quotesPayload.quotes).forEach(([quoteSymbol, quote]) => {
            const candles = portfolioCandleMapRef.current[quoteSymbol] ?? [];
            if (candles.length === 0) return;

            const last = candles[candles.length - 1];
            const lastBucketTime = toMinuteIso(last.time);
            const quoteBucketTime = toMinuteIso(quote.timestamp);

            if (quoteBucketTime === lastBucketTime) {
              const next = {
                ...last,
                close: quote.price,
                high: Math.max(last.high, quote.price),
                low: Math.min(last.low, quote.price),
                volume: quote.volume,
              };

              portfolioCandleMapRef.current[quoteSymbol] = [...candles.slice(0, -1), next];
              return;
            }

            const next = {
              time: quoteBucketTime,
              open: last.close,
              high: Math.max(last.close, quote.price),
              low: Math.min(last.close, quote.price),
              close: quote.price,
              volume: quote.volume,
            };

            portfolioCandleMapRef.current[quoteSymbol] = [...candles, next].slice(-220);
          });

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
  }, [mode, symbol, holdings, holdingsKey, quoteSymbols, quoteSymbolsKey, pollMs, dataMode]);

  return state;
}
