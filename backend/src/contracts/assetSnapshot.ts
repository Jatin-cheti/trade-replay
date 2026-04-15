import { CandleData } from "../types/shared";

export type SnapshotSource = "snapshot-live";

export interface AssetSnapshotQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: SnapshotSource;
}

export interface AssetSnapshotResponse {
  quotes: Record<string, AssetSnapshotQuote>;
  candlesBySymbol: Record<string, CandleData[]>;
  generatedAt: string;
  source: SnapshotSource;
}

export interface AssetSnapshotQuotesResponse {
  quotes: Record<string, AssetSnapshotQuote>;
  source: SnapshotSource;
}

export interface AssetSnapshotCandlesResponse {
  symbol: string;
  candles: CandleData[];
  quote: AssetSnapshotQuote;
  source: SnapshotSource;
}

export interface AssetSnapshotRequest {
  symbols: string[];
  candleSymbols?: string[];
  candleLimit?: number;
}

export interface AssetSnapshotIngestInput {
  quotes?: Record<string, Omit<AssetSnapshotQuote, "symbol" | "source"> & { symbol?: string; source?: string }>;
  candlesBySymbol?: Record<string, CandleData[]>;
}

export interface AssetSnapshotIngestResponse {
  storedQuotes: number;
  storedCandles: number;
  source: SnapshotSource;
}
