import type { OHLCV } from "./candle.model";

export type NodeType =
  | "SOURCE"
  | "SMA" | "EMA" | "WMA" | "DEMA" | "TEMA"
  | "RSI" | "MACD" | "BOLLINGER" | "ATR" | "VWAP"
  | "STOCHASTIC" | "OBV" | "ADX" | "CCI" | "WILLIAMS_R"
  | "MFI" | "CMF" | "AROON" | "STDDEV" | "SUPERTREND"
  | "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE"
  | "GT" | "LT" | "GTE" | "LTE" | "EQ"
  | "CROSS_ABOVE" | "CROSS_BELOW"
  | "IF" | "AND" | "OR" | "NOT"
  | "PLOT" | "FILL" | "LABEL";

export interface IndicatorNode {
  id: string;
  type: NodeType;
  inputs?: Record<string, string>;
  config?: Record<string, unknown>;
}

export interface IndicatorGraph {
  indicatorId: string;
  version: number;
  nodes: IndicatorNode[];
  outputs: string[];
}

export interface IndicatorExecutionInput {
  candles: OHLCV[];
  graph: IndicatorGraph;
}

export interface IndicatorSeriesMap {
  [nodeId: string]: number[];
}

export interface IndicatorExecutionResult {
  indicatorId: string;
  outputs: IndicatorSeriesMap;
  computedNodeCount: number;
}

export interface IndicatorPreset {
  id: string;
  name: string;
  graph: IndicatorGraph;
}
