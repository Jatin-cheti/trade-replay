import { api } from "@/lib/api";
import type { CandleData } from "@/data/stockData";

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: "synthetic-live";
}

export interface LiveCandlesResponse {
  symbol: string;
  candles: CandleData[];
  quote: LiveQuote;
  source: "synthetic-live";
}

export interface LiveQuotesResponse {
  quotes: Record<string, LiveQuote>;
  source: "synthetic-live";
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
