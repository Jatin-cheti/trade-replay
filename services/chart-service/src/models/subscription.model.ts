import type { IndicatorGraph } from "./indicator.model";
import type { OHLCV, Timeframe } from "./candle.model";

export interface SubscribePayload {
  chartId: string;
  symbol: string;
  timeframe: Timeframe;
  indicators?: IndicatorGraph[];
}

export interface UnsubscribePayload {
  chartId: string;
  symbol: string;
}

export interface CrosshairPayload {
  chartId: string;
  timestamp: number;
}

export interface SeekPayload {
  chartId: string;
  timestamp: number;
}

export type ClientMessage =
  | { type: "SUBSCRIBE"; payload: SubscribePayload }
  | { type: "UNSUBSCRIBE"; payload: UnsubscribePayload }
  | { type: "CROSSHAIR"; payload: CrosshairPayload }
  | { type: "SEEK"; payload: SeekPayload };

export type ServerMessage =
  | { type: "CANDLE"; payload: { chartId: string; symbol: string; candle: OHLCV } }
  | { type: "INDICATOR"; payload: { chartId: string; nodeId: string; values: number[] } }
  | { type: "CROSSHAIR"; payload: { timestamp: number; sourceChartId: string } }
  | { type: "CONNECTED"; payload: { chartId: string; sessionId: string } }
  | { type: "ERROR"; payload: { code: string; message: string } };
