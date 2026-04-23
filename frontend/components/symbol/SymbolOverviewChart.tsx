import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "@tradereplay/charts";
import type { CandleData } from "@/data/stockData";
import { normalizeOhlcRows } from "@/services/chart/dataTransforms";

export type SymbolChartRangeKey = "1d" | "5d" | "1m" | "6m" | "ytd" | "1y" | "5y" | "10y" | "all";
export type ChartType = "area" | "candle";

type SymbolOverviewChartProps = {
  candles: CandleData[];
  range: SymbolChartRangeKey;
  chartType?: ChartType;
  loading?: boolean;
  error?: string | null;
  onOpenFullChart?: () => void;
};

const RANGE_POINTS: Record<SymbolChartRangeKey, number> = {
  "1d": 80,
  "5d": 140,
  "1m": 220,
  "6m": 300,
  ytd: 340,
  "1y": 380,
  "5y": 450,
  "10y": 500,
  all: Number.POSITIVE_INFINITY,
};

function selectRangeRows(candles: CandleData[], range: SymbolChartRangeKey) {
  const normalized = normalizeOhlcRows(candles, candles.length);
  if (!normalized.length) return normalized;

  const keep = RANGE_POINTS[range];
  if (!Number.isFinite(keep) || normalized.length <= keep) return normalized;
  return normalized.slice(normalized.length - keep);
}

export default function SymbolOverviewChart({ candles, range, chartType = "area", loading = false, error = null, onOpenFullChart }: SymbolOverviewChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<"Area"> | ISeriesApi<"Candlestick"> | null>(null);

  const rangeRows = useMemo(() => selectRangeRows(candles, range), [candles, range]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: false,
      layout: {
        background: { type: "solid", color: "rgba(0, 0, 0, 0)" },
        textColor: "rgba(155, 172, 198, 0.9)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(56, 78, 112, 0.2)" },
        horzLines: { color: "rgba(56, 78, 112, 0.2)" },
      },
      rightPriceScale: {
        borderColor: "rgba(73, 98, 138, 0.4)",
      },
      timeScale: {
        borderColor: "rgba(73, 98, 138, 0.4)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
      },
    });

    if (chartType === "candle") {
      const candleSeries = chart.addSeries("Candlestick", {
        upColor: "#34d399",
        downColor: "#fb7185",
        wickUpColor: "#34d399",
        wickDownColor: "#fb7185",
      });
      chartRef.current = chart;
      seriesRef.current = candleSeries;
    } else {
      const areaSeries = chart.addSeries("Area", {
        lineColor: "#00c2ff",
        lineWidth: 2,
        topColor: "rgba(0, 194, 255, 0.35)",
        bottomColor: "rgba(0, 194, 255, 0.02)",
      });
      chartRef.current = chart;
      seriesRef.current = areaSeries;
    }

    const resize = () => {
      const root = containerRef.current;
      const chartApi = chartRef.current;
      if (!root || !chartApi) return;
      chartApi.applyOptions({
        width: Math.max(root.clientWidth, 1),
        height: Math.max(root.clientHeight, 1),
      });
    };

    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [chartType]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    if (!rangeRows.length) {
      series.setData([]);
      return;
    }

    if (chartType === "candle") {
      (series as ISeriesApi<"Candlestick">).setData(
        rangeRows.map((row) => ({
          time: row.time as UTCTimestamp,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
        })),
      );
    } else {
      const first = rangeRows[0].close;
      const last = rangeRows[rangeRows.length - 1].close;
      const positive = last >= first;

      const upColor = {
        lineColor: "#34d399",
        topColor: "rgba(52, 211, 153, 0.32)",
        bottomColor: "rgba(52, 211, 153, 0.03)",
      };
      const downColor = {
        lineColor: "#fb7185",
        topColor: "rgba(251, 113, 133, 0.28)",
        bottomColor: "rgba(251, 113, 133, 0.03)",
      };

      (series as ISeriesApi<"Area">).applyOptions(positive ? upColor : downColor);
      (series as ISeriesApi<"Area">).setData(
        rangeRows.map((row) => ({ time: row.time as UTCTimestamp, value: row.close })),
      );
    }

    // Best-effort fit; chart library may or may not expose fitContent.
    try {
      (chart.timeScale() as unknown as { fitContent?: () => void }).fitContent?.();
    } catch {
      // ignore
    }
  }, [rangeRows, chartType]);

  return (
    <div
      className={`relative h-full w-full ${onOpenFullChart ? "cursor-pointer" : ""}`}
      onDoubleClick={onOpenFullChart}
      title={onOpenFullChart ? "Double click to open full chart" : undefined}
    >
      <div ref={containerRef} className="h-full w-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <p className="rounded-md border border-border/60 bg-background/75 px-3 py-1.5 text-xs text-muted-foreground">Loading chart...</p>
        </div>
      )}

      {!loading && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/55">
          <p className="rounded-md border border-red-400/40 bg-background/90 px-3 py-1.5 text-xs text-red-200">{error}</p>
        </div>
      )}

      {!loading && !error && rangeRows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <p className="rounded-md border border-border/60 bg-background/75 px-3 py-1.5 text-xs text-muted-foreground">No chart data available</p>
        </div>
      )}
    </div>
  );
}
