import { useEffect, useMemo, useRef, useState } from "react";
import type { CandleData } from "@/data/stockData";
import TradingChart from "./TradingChart";
import { globalChartManager } from "./ChartManager";
import { frontendEnv } from "@/lib/env";

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W" | "1M";

type NodeType =
  | "SOURCE"
  | "SMA" | "EMA" | "WMA" | "DEMA" | "TEMA"
  | "RSI" | "MACD" | "BOLLINGER" | "ATR" | "VWAP"
  | "STOCHASTIC" | "OBV" | "ADX" | "CCI"
  | "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE"
  | "GT" | "LT" | "GTE" | "LTE" | "EQ"
  | "CROSS_ABOVE" | "CROSS_BELOW"
  | "IF" | "AND" | "OR" | "NOT"
  | "PLOT" | "FILL" | "LABEL";

interface IndicatorNode {
  id: string;
  type: NodeType;
  inputs?: Record<string, string>;
  config?: Record<string, unknown>;
}

interface IndicatorGraph {
  indicatorId: string;
  version: number;
  nodes: IndicatorNode[];
  outputs: string[];
}

export interface ChartEngineProps {
  symbol: string;
  timeframe: Timeframe;
  indicators?: IndicatorGraph[];
  height?: number;
  width?: number;
  syncGroup?: string;
  overlay?: boolean;
  theme?: "dark" | "light";
  onReady?: (chartId: string) => void;
  onError?: (error: Error) => void;
  data?: CandleData[];
  visibleCount?: number;
  mode?: "simulation" | "live";
  parityMode?: boolean;
}

interface CandleApiRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toCandleData(rows: CandleApiRow[]): CandleData[] {
  return rows.map((row) => ({
    time: new Date(row.timestamp).toISOString().split("T")[0],
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
}

function wsUrl(base: string, symbol: string): string {
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/realtime/${encodeURIComponent(symbol)}`;
}

function timeframeToResolution(timeframe: Timeframe): string {
  if (timeframe === "1m") return "1";
  if (timeframe === "5m") return "5";
  if (timeframe === "15m") return "15";
  if (timeframe === "30m") return "30";
  if (timeframe === "1h") return "60";
  if (timeframe === "4h") return "240";
  if (timeframe === "1D") return "D";
  if (timeframe === "1W") return "W";
  return "M";
}

export default function ChartEngine({
  symbol,
  timeframe,
  onReady,
  onError,
  data,
  visibleCount,
  mode,
  parityMode,
  syncGroup = "default",
}: ChartEngineProps) {
  const [remoteData, setRemoteData] = useState<CandleData[]>([]);
  const chartId = useMemo(
    () => (globalThis.crypto?.randomUUID?.() ?? `chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    [],
  );
  const hasFiredReady = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  const chartApiBase = (import.meta.env.VITE_CHART_SERVICE_URL as string | undefined)
    ?? `${frontendEnv.API_URL}/chart`;
  const chartWsBase = (import.meta.env.VITE_CHART_SERVICE_WS_URL as string | undefined)
    ?? chartApiBase.replace(/^http/i, "ws");
  const resolution = useMemo(() => timeframeToResolution(timeframe), [timeframe]);

  useEffect(() => {
    globalChartManager.register({
      chartId,
      syncGroup,
      onCrosshair: () => {},
    });
    return () => {
      globalChartManager.unregister(chartId);
    };
  }, [chartId, syncGroup]);

  useEffect(() => {
    if (data && data.length > 0) {
      return;
    }

    let cancelled = false;
    const endpoint = `${chartApiBase.replace(/\/$/, "")}/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=500`;

    const load = async (): Promise<void> => {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Chart candles request failed (${response.status})`);
        }
        const payload = await response.json() as { ok?: boolean; data?: CandleApiRow[] };
        const next = toCandleData(payload.data ?? []);
        if (!cancelled) {
          setRemoteData(next);
        }
      } catch (error) {
        if (!cancelled && onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    void load();

    const ws = new WebSocket(wsUrl(chartWsBase, symbol));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (cancelled) {
        return;
      }
      try {
        const message = JSON.parse(event.data as string) as { type?: string; payload?: { candle?: CandleApiRow } };
        if (message.type !== "CANDLE" || !message.payload?.candle) {
          return;
        }
        const nextCandle = toCandleData([message.payload.candle])[0];
        setRemoteData((prev) => [...prev.slice(-499), nextCandle]);
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    ws.onerror = () => {
      if (!cancelled && onError) {
        onError(new Error("Chart realtime connection failed"));
      }
    };

    return () => {
      cancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, [chartApiBase, chartWsBase, data, onError, symbol, timeframe]);

  const effectiveData = data ?? remoteData;

  useEffect(() => {
    if (hasFiredReady.current || !onReady || effectiveData.length === 0) {
      return;
    }
    hasFiredReady.current = true;
    onReady(chartId);
  }, [chartId, effectiveData.length, onReady]);

  return (
    <div data-testid="chart-engine-root" className="h-full w-full">
      <TradingChart
        data={effectiveData}
        visibleCount={visibleCount ?? effectiveData.length}
        symbol={symbol}
        resolution={resolution}
        mode={mode ?? "simulation"}
        parityMode={Boolean(parityMode)}
      />
    </div>
  );
}
