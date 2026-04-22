import {
  brickTransform,
  kagiTransform,
  lineBreakTransform,
  pointFigureTransform,
  rangeBarsTransform,
  renkoTransform,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type TransformOhlc,
  type UTCTimestamp,
} from '@tradereplay/charts';
import type { CandleData } from '@/data/stockData';

export type ChartType =
  // ── Standard ─────────────────────────────────────────────────────────
  | 'candlestick' | 'line' | 'area' | 'baseline' | 'histogram'
  | 'bar' | 'ohlc' | 'heikinAshi' | 'hollowCandles' | 'stepLine'
  // ── Derived Price (implementable with existing engine) ────────────────
  | 'hlcBar' | 'avgPriceBar' | 'openClose' | 'dotChart'
  | 'maLine' | 'emaLine' | 'vwapLine' | 'priceChange'
  // ── Overlays ──────────────────────────────────────────────────────────
  | 'rangeArea' | 'mountainArea'
  // ── Volume ────────────────────────────────────────────────────────────
  | 'volumeCandles' | 'volumeLine'
  // ── Price Action ─────────────────────────────────────────────────────
  | 'renko' | 'rangeBars' | 'lineBreak' | 'kagi' | 'pointFigure' | 'brick'
  // ── Analytical — Coming Soon ─────────────────────────────────────────
  | 'equityCurve' | 'drawdownChart' | 'returnsHistogram'
  | 'zScoreLine' | 'rsiLine' | 'macdHistogram' | 'volumeOscillator'
  // ── Advanced Statistical — Coming Soon ───────────────────────────────
  | 'scatterPlot' | 'bubblePlot' | 'boxPlot' | 'heatMap'
  | 'radarChart' | 'treemap' | 'waterfallChart' | 'sunburst'
  // ── Financial — Coming Soon ──────────────────────────────────────────
  | 'yieldCurve' | 'volatilitySurface' | 'correlationMatrix'
  | 'optionsPayoff' | 'monteCarlo' | 'seasonality' | 'regressionChannel'
  // ── Layouts — Coming Soon ─────────────────────────────────────────────
  | 'fanChart' | 'paretoChart' | 'funnelChart' | 'networkGraph'
  | 'donutChart' | 'stackedArea';

/** Chart types not yet implemented — show a "coming soon" overlay in the chart panel. */
export const COMING_SOON_CHART_TYPES: ReadonlySet<ChartType> = new Set<ChartType>([
  'equityCurve', 'drawdownChart', 'returnsHistogram',
  'zScoreLine', 'rsiLine', 'macdHistogram', 'volumeOscillator',
  'scatterPlot', 'bubblePlot', 'boxPlot', 'heatMap',
  'radarChart', 'treemap', 'waterfallChart', 'sunburst',
  'yieldCurve', 'volatilitySurface', 'correlationMatrix',
  'optionsPayoff', 'monteCarlo', 'seasonality', 'regressionChannel',
  'fanChart', 'paretoChart', 'funnelChart', 'networkGraph',
  'donutChart', 'stackedArea',
]);

export const chartTypeGroups: Array<{ id: string; label: string; types: ChartType[] }> = [
  {
    id: 'standard', label: 'Standard',
    types: ['candlestick', 'line', 'area', 'baseline', 'histogram', 'bar', 'ohlc', 'stepLine'],
  },
  {
    id: 'derived', label: 'Derived Price',
    types: ['heikinAshi', 'hollowCandles', 'hlcBar', 'avgPriceBar', 'openClose', 'dotChart', 'mountainArea', 'rangeArea'],
  },
  {
    id: 'indicators', label: 'Indicators',
    types: ['maLine', 'emaLine', 'vwapLine', 'priceChange'],
  },
  {
    id: 'volume', label: 'Volume',
    types: ['volumeCandles', 'volumeLine'],
  },
  {
    id: 'priceAction', label: 'Price Action',
    types: ['renko', 'rangeBars', 'lineBreak', 'kagi', 'pointFigure', 'brick'],
  },
  {
    id: 'analytical', label: 'Analytical',
    types: ['equityCurve', 'drawdownChart', 'returnsHistogram', 'zScoreLine', 'rsiLine', 'macdHistogram', 'volumeOscillator'],
  },
  {
    id: 'statistical', label: 'Statistical',
    types: ['scatterPlot', 'bubblePlot', 'boxPlot', 'heatMap', 'radarChart', 'treemap', 'waterfallChart', 'sunburst'],
  },
  {
    id: 'financial', label: 'Financial',
    types: ['yieldCurve', 'volatilitySurface', 'correlationMatrix', 'optionsPayoff', 'monteCarlo', 'seasonality', 'regressionChannel'],
  },
  {
    id: 'layouts', label: 'Layouts',
    types: ['fanChart', 'paretoChart', 'funnelChart', 'networkGraph', 'donutChart', 'stackedArea'],
  },
];

export const chartTypeLabels: Record<ChartType, string> = {
  // Standard
  candlestick: 'Candlestick', line: 'Line', area: 'Area', baseline: 'Baseline',
  histogram: 'Histogram', bar: 'Bar', ohlc: 'OHLC', stepLine: 'Step Line',
  // Derived Price
  heikinAshi: 'Heikin Ashi', hollowCandles: 'Hollow Candles',
  hlcBar: 'HLC Bar', avgPriceBar: 'Avg Price Bar', openClose: 'Open-Close',
  dotChart: 'Dot Chart', mountainArea: 'Mountain Area', rangeArea: 'Range Area',
  // Indicators
  maLine: 'MA Line (20)', emaLine: 'EMA Line (20)', vwapLine: 'VWAP', priceChange: 'Price Change',
  // Volume
  volumeCandles: 'Candles + Volume', volumeLine: 'Line + Volume',
  // Price Action
  renko: 'Renko', rangeBars: 'Range Bars', lineBreak: '3-Line Break',
  kagi: 'Kagi', pointFigure: 'Point & Figure', brick: 'Brick',
  // Analytical (coming soon)
  equityCurve: 'Equity Curve', drawdownChart: 'Drawdown Chart',
  returnsHistogram: 'Returns Histogram', zScoreLine: 'Z-Score Line',
  rsiLine: 'RSI Line', macdHistogram: 'MACD Histogram', volumeOscillator: 'Volume Oscillator',
  // Statistical (coming soon)
  scatterPlot: 'Scatter Plot', bubblePlot: 'Bubble Plot', boxPlot: 'Box Plot',
  heatMap: 'Heat Map', radarChart: 'Radar Chart', treemap: 'Treemap',
  waterfallChart: 'Waterfall Chart', sunburst: 'Sunburst Chart',
  // Financial (coming soon)
  yieldCurve: 'Yield Curve', volatilitySurface: 'Volatility Surface',
  correlationMatrix: 'Correlation Matrix', optionsPayoff: 'Options Payoff',
  monteCarlo: 'Monte Carlo', seasonality: 'Seasonality', regressionChannel: 'Regression Channel',
  // Layouts (coming soon)
  fanChart: 'Fan Chart', paretoChart: 'Pareto Chart', funnelChart: 'Funnel Chart',
  networkGraph: 'Network Graph', donutChart: 'Donut Chart', stackedArea: 'Stacked Area',
};

export type OhlcRow = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ── Derived transform helpers ─────────────────────────────────────────────

function computeSMA(rows: OhlcRow[], period = 20): LineData[] {
  return rows.map((row, i) => {
    const start = Math.max(0, i - period + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) sum += rows[j].close;
    return { time: row.time, value: sum / (i - start + 1) };
  });
}

function computeEMA(rows: OhlcRow[], period = 20): LineData[] {
  if (!rows.length) return [];
  const k = 2 / (period + 1);
  const output: LineData[] = [];
  let ema = rows[0].close;
  for (const row of rows) {
    ema = row.close * k + ema * (1 - k);
    output.push({ time: row.time, value: ema });
  }
  return output;
}

function computeVWAP(rows: OhlcRow[]): LineData[] {
  let cumPV = 0;
  let cumV = 0;
  return rows.map((row) => {
    const tp = (row.high + row.low + row.close) / 3;
    cumPV += tp * row.volume;
    cumV += row.volume;
    return { time: row.time, value: cumV > 0 ? cumPV / cumV : row.close };
  });
}

export type TransformedData = {
  ohlcRows: OhlcRow[];
  renkoRows: OhlcRow[];
  rangeBarsRows: OhlcRow[];
  lineBreakRows: OhlcRow[];
  kagiRows: OhlcRow[];
  pointFigureRows: OhlcRow[];
  brickRows: OhlcRow[];
  closeRows: LineData[];
  kagiLineRows: LineData[];
  rangeRows: LineData[];
  stepRows: LineData[];
  histogramRows: HistogramData[];
  volumeRows: HistogramData[];
  heikinRows: CandlestickData[];
  // Derived price rows
  hlcBarRows: LineData[];
  avgPriceRows: LineData[];
  openCloseRows: LineData[];
  maRows: LineData[];
  emaRows: LineData[];
  vwapRows: LineData[];
  priceChangeRows: LineData[];
  times: UTCTimestamp[];
};

const FALLBACK_TIMESTAMP_START = Math.floor(Date.UTC(2000, 0, 1, 0, 0, 0) / 1000);
const MIN_TIMESTAMP_STEP_SECONDS = 60;

function parseTimestampSeconds(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    const abs = Math.abs(input);
    if (abs >= 1e11) return Math.floor(input / 1000);
    return Math.floor(input);
  }

  const normalized = String(input).trim();
  if (!normalized) return null;

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return null;
    const abs = Math.abs(numeric);
    if (abs >= 1e11) return Math.floor(numeric / 1000);
    return Math.floor(numeric);
  }

  const dateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0) / 1000);
    }
  }

  const parsedMs = Date.parse(normalized);
  if (!Number.isFinite(parsedMs)) return null;
  return Math.floor(parsedMs / 1000);
}

export function toTimestamp(input: string | number, previous?: UTCTimestamp): UTCTimestamp {
  const parsed = parseTimestampSeconds(input);
  const fallback = previous != null
    ? Number(previous) + MIN_TIMESTAMP_STEP_SECONDS
    : FALLBACK_TIMESTAMP_START;
  let resolved = Number.isFinite(parsed) ? (parsed as number) : fallback;
  if (previous != null && resolved <= Number(previous)) {
    resolved = Number(previous) + MIN_TIMESTAMP_STEP_SECONDS;
  }
  return Math.floor(resolved) as UTCTimestamp;
}

export function heikinAshiTransform(rows: OhlcRow[]): CandlestickData[] {
  if (!rows.length) return [];
  const output: CandlestickData[] = [];
  let prevOpen = (rows[0].open + rows[0].close) / 2;
  let prevClose = (rows[0].open + rows[0].high + rows[0].low + rows[0].close) / 4;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const close = (row.open + row.high + row.low + row.close) / 4;
    const open = i === 0 ? (row.open + row.close) / 2 : (prevOpen + prevClose) / 2;
    output.push({
      time: row.time,
      open,
      high: Math.max(row.high, open, close),
      low: Math.min(row.low, open, close),
      close,
    });
    prevOpen = open;
    prevClose = close;
  }

  return output;
}

export function stepLineTransform(rows: LineData[]): LineData[] {
  if (rows.length < 2) return rows;
  const output: LineData[] = [rows[0]];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const cur = rows[i];
    const t = Math.max((prev.time as number) + 1, (cur.time as number) - 1) as UTCTimestamp;
    output.push({ time: t, value: prev.value });
    output.push(cur);
  }
  return output;
}

export function transformChartData(data: CandleData[], visibleCount: number, parityMode = false): TransformedData {
  const visible = data.slice(0, visibleCount);
  let previousTime: UTCTimestamp | undefined;
  const ohlcRows = visible.map((item) => {
    const time = toTimestamp(item.time, previousTime);
    previousTime = time;
    return {
      time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    };
  });

  const closeRows = ohlcRows.map((row) => ({ time: row.time, value: row.close }));
  const rangeRows = ohlcRows.map((row) => ({ time: row.time, value: (row.high + row.low) / 2 }));
  const asTransformInput: TransformOhlc[] = ohlcRows.map((row) => ({ ...row }));

  const renkoRows = renkoTransform(asTransformInput) as OhlcRow[];
  const rangeBarsRows = rangeBarsTransform(asTransformInput) as OhlcRow[];
  const lineBreakRows = lineBreakTransform(asTransformInput, 3) as OhlcRow[];
  const kagiRows = kagiTransform(asTransformInput) as OhlcRow[];
  const pointFigureRows = pointFigureTransform(asTransformInput) as OhlcRow[];
  const brickRows = brickTransform(asTransformInput) as OhlcRow[];

  const histogramUpColor = parityMode ? 'rgba(8, 153, 129, 0.72)' : 'rgba(23, 201, 100, 0.72)';
  const histogramDownColor = parityMode ? 'rgba(242, 54, 69, 0.72)' : 'rgba(255, 77, 79, 0.72)';
  const volumeUpColor = parityMode ? 'rgba(8, 153, 129, 0.45)' : 'rgba(38, 166, 154, 0.45)';
  const volumeDownColor = parityMode ? 'rgba(242, 54, 69, 0.45)' : 'rgba(239, 83, 80, 0.45)';

  return {
    ohlcRows,
    renkoRows,
    rangeBarsRows,
    lineBreakRows,
    kagiRows,
    pointFigureRows,
    brickRows,
    closeRows,
    kagiLineRows: kagiRows.map((row) => ({ time: row.time, value: row.close })),
    rangeRows,
    stepRows: stepLineTransform(closeRows),
    histogramRows: ohlcRows.map((row) => ({
      time: row.time,
      value: row.close - row.open,
      color: row.close >= row.open ? histogramUpColor : histogramDownColor,
    })),
    volumeRows: ohlcRows.map((row) => ({
      time: row.time,
      value: row.volume,
      color: row.close >= row.open ? volumeUpColor : volumeDownColor,
    })),
    heikinRows: heikinAshiTransform(ohlcRows),
    // Derived price rows
    hlcBarRows: ohlcRows.map((row) => ({
      time: row.time,
      value: (row.high + row.low + row.close) / 3,
    })),
    avgPriceRows: ohlcRows.map((row) => ({
      time: row.time,
      value: (row.open + row.high + row.low + row.close) / 4,
    })),
    openCloseRows: ohlcRows.map((row) => ({
      time: row.time,
      value: (row.open + row.close) / 2,
    })),
    maRows: computeSMA(ohlcRows, 20),
    emaRows: computeEMA(ohlcRows, 20),
    vwapRows: computeVWAP(ohlcRows),
    priceChangeRows: (() => {
      const first = ohlcRows[0]?.close ?? 0;
      return ohlcRows.map((row) => ({ time: row.time, value: row.close - first }));
    })(),
    times: ohlcRows.map((row) => row.time),
  };
}
