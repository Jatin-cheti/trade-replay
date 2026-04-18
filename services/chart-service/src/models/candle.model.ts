export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W" | "1M";

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleQuery {
  symbol: string;
  timeframe: Timeframe;
  from?: number;
  to?: number;
  limit?: number;
}

export interface MultiSymbolCandleQuery {
  symbols: string[];
  timeframe: Timeframe;
  from?: number;
  to?: number;
  limit?: number;
}

export interface SymbolMetadata {
  symbol: string;
  description: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
}
