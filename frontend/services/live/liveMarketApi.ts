import { api } from "@/lib/api";
import type { CandleData } from "@/data/stockData";

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: "snapshot-live";
}

export interface LiveCandlesResponse {
  symbol: string;
  candles: CandleData[];
  quote: LiveQuote;
  source: "snapshot-live";
}

export interface LiveQuotesResponse {
  quotes: Record<string, LiveQuote>;
  source: "snapshot-live";
}

export interface LiveSnapshotResponse {
  quotes: Record<string, LiveQuote>;
  candlesBySymbol: Record<string, CandleData[]>;
  generatedAt: string;
  source: "snapshot-live";
}

export async function fetchLiveCandles(params: { symbol: string; limit?: number }): Promise<LiveCandlesResponse> {
  const response = await api.get<LiveCandlesResponse>("/live/candles", {
    params: {
      symbol: params.symbol,
      limit: params.limit ?? 240,
    },
  });

  return response.data;
}

export async function fetchLiveQuotes(params: { symbols: string[] }): Promise<LiveQuotesResponse> {
  const response = await api.get<LiveQuotesResponse>("/live/quotes", {
    params: {
      symbols: params.symbols.join(","),
    },
  });

  return response.data;
}

export async function fetchLiveSnapshot(params: {
  symbols: string[];
  candleSymbols?: string[];
  candleLimit?: number;
}): Promise<LiveSnapshotResponse> {
  const response = await api.post<LiveSnapshotResponse>("/live/snapshot/public", {
    symbols: params.symbols,
    candleSymbols: params.candleSymbols ?? [],
    candleLimit: params.candleLimit ?? 240,
  }, {
    suppressGlobalLoading: true,
  });

  return response.data;
}
