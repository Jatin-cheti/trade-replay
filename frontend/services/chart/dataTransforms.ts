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

/** Chart types not yet implemented — truly canvas-only, cannot be rendered in LightweightCharts. */
export const COMING_SOON_CHART_TYPES: ReadonlySet<ChartType> = new Set<ChartType>([
  // Empty: dropdown is restricted to the original 20 chart types (TradingView
  // parity baseline). The extra types in the ChartType union remain only so
  // the engine's series renderers and visibility map keep type-checking; they
  // are intentionally NOT reachable from the chart-type dropdown UI. Indicator
  // / analytics types were moved out of "chart types" since they are overlays
  // or backtest analytics, not standalone price visualizations.
]);

export const chartTypeGroups: Array<{ id: string; label: string; types: ChartType[] }> = [
  {
    id: 'core', label: 'Core',
    types: ['candlestick', 'line', 'area', 'baseline', 'histogram', 'bar', 'ohlc'],
  },
  {
    id: 'advanced', label: 'Advanced',
    types: ['heikinAshi', 'hollowCandles', 'stepLine', 'rangeArea', 'mountainArea'],
  },
  {
    id: 'premium', label: 'Premium',
    types: ['renko', 'rangeBars', 'lineBreak', 'kagi', 'pointFigure', 'brick'],
  },
  {
    id: 'volume', label: 'Volume',
    types: ['volumeCandles', 'volumeLine'],
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

function computeRSI(rows: OhlcRow[], period = 14): LineData[] {
  if (rows.length < period + 1) return rows.map((r) => ({ time: r.time, value: 50 }));
  const output: LineData[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = rows[i].close - rows[i - 1].close;
    if (diff >= 0) avgGain += diff; else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;
  const pushRsi = (i: number, ag: number, al: number) => {
    const rs = al === 0 ? 100 : ag / al;
    output.push({ time: rows[i].time, value: 100 - 100 / (1 + rs) });
  };
  // pad nulls before warmup
  for (let i = 0; i < period; i++) output.push({ time: rows[i].time, value: 50 });
  pushRsi(period, avgGain, avgLoss);
  for (let i = period + 1; i < rows.length; i++) {
    const diff = rows[i].close - rows[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    pushRsi(i, avgGain, avgLoss);
  }
  return output;
}

function computeMACD(rows: OhlcRow[], fast = 12, slow = 26, signal = 9): { macd: HistogramData[]; signalLine: LineData[] } {
  const ema = (data: number[], p: number): number[] => {
    const k = 2 / (p + 1);
    const out: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) out.push(data[i] * k + out[i - 1] * (1 - k));
    return out;
  };
  const closes = rows.map((r) => r.close);
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalArr = ema(macdLine.slice(slow - 1), signal);
  const macdHist: HistogramData[] = rows.map((r, i) => {
    const m = macdLine[i];
    const s = i >= slow - 1 ? signalArr[i - (slow - 1)] : 0;
    const hist = m - s;
    return {
      time: r.time,
      value: hist,
      color: hist >= 0 ? 'rgba(38,166,154,0.8)' : 'rgba(239,83,80,0.8)',
    };
  });
  const signalLineData: LineData[] = rows.map((r, i) => ({
    time: r.time,
    value: i >= slow - 1 ? signalArr[i - (slow - 1)] : 0,
  }));
  return { macd: macdHist, signalLine: signalLineData };
}

function computeEquityCurve(rows: OhlcRow[]): LineData[] {
  if (!rows.length) return [];
  const first = rows[0].close;
  return rows.map((r) => ({ time: r.time, value: ((r.close - first) / first) * 100 }));
}

function computeDrawdown(rows: OhlcRow[]): LineData[] {
  if (!rows.length) return [];
  let peak = rows[0].close;
  return rows.map((r) => {
    if (r.close > peak) peak = r.close;
    const dd = peak > 0 ? ((r.close - peak) / peak) * 100 : 0;
    return { time: r.time, value: dd };
  });
}

function computeReturnsHistogram(rows: OhlcRow[]): HistogramData[] {
  // Daily returns as histogram bars ordered by time (not by return bucket)
  return rows.map((r, i) => {
    const prev = rows[i - 1]?.close ?? r.close;
    const ret = prev > 0 ? ((r.close - prev) / prev) * 100 : 0;
    return {
      time: r.time,
      value: ret,
      color: ret >= 0 ? 'rgba(38,166,154,0.8)' : 'rgba(239,83,80,0.8)',
    };
  });
}

function computeZScore(rows: OhlcRow[], period = 20): LineData[] {
  return rows.map((r, i) => {
    const start = Math.max(0, i - period + 1);
    const slice = rows.slice(start, i + 1).map((x) => x.close);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
    return { time: r.time, value: std > 0 ? (r.close - mean) / std : 0 };
  });
}

function computeVolumeOscillator(rows: OhlcRow[], fast = 5, slow = 20): LineData[] {
  const k1 = 2 / (fast + 1);
  const k2 = 2 / (slow + 1);
  let emaFast = rows[0]?.volume ?? 0;
  let emaSlow = rows[0]?.volume ?? 0;
  return rows.map((r) => {
    emaFast = r.volume * k1 + emaFast * (1 - k1);
    emaSlow = r.volume * k2 + emaSlow * (1 - k2);
    return { time: r.time, value: emaSlow > 0 ? ((emaFast - emaSlow) / emaSlow) * 100 : 0 };
  });
}

function computeRegressionChannel(rows: OhlcRow[]): { mid: LineData[]; upper: LineData[]; lower: LineData[] } {
  const n = rows.length;
  if (n < 2) return { mid: rows.map((r) => ({ time: r.time, value: r.close })), upper: [], lower: [] };
  const xs = rows.map((_, i) => i);
  const ys = rows.map((r) => r.close);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const predicted = xs.map((x) => slope * x + intercept);
  const residuals = ys.map((y, i) => y - predicted[i]);
  const stdDev = Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / n);
  return {
    mid: rows.map((r, i) => ({ time: r.time, value: predicted[i] })),
    upper: rows.map((r, i) => ({ time: r.time, value: predicted[i] + 2 * stdDev })),
    lower: rows.map((r, i) => ({ time: r.time, value: predicted[i] - 2 * stdDev })),
  };
}

function computeSeasonality(rows: OhlcRow[]): LineData[] {
  // Average monthly return plotted per bar (same month avg return shown flat across that month)
  const monthAvg: Record<number, { sum: number; count: number }> = {};
  for (let i = 1; i < rows.length; i++) {
    const d = new Date((rows[i].time as number) * 1000);
    const m = d.getUTCMonth();
    const ret = rows[i - 1].close > 0 ? ((rows[i].close - rows[i - 1].close) / rows[i - 1].close) * 100 : 0;
    if (!monthAvg[m]) monthAvg[m] = { sum: 0, count: 0 };
    monthAvg[m].sum += ret;
    monthAvg[m].count++;
  }
  return rows.map((r) => {
    const m = new Date((r.time as number) * 1000).getUTCMonth();
    const avg = monthAvg[m];
    return { time: r.time, value: avg ? avg.sum / avg.count : 0 };
  });
}

/** Monte Carlo confidence bands: equity curve ± rolling 1.96σ (95% CI). */
function computeMonteCarloConfidence(rows: OhlcRow[]): { upper: LineData[]; lower: LineData[] } {
  const equity = computeEquityCurve(rows);
  const WIN = 20;
  const K = 1.96;
  return {
    upper: equity.map((e, i) => {
      const slice = equity.slice(Math.max(0, i - WIN + 1), i + 1).map((x) => x.value);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
      return { time: e.time, value: e.value + K * std };
    }),
    lower: equity.map((e, i) => {
      const slice = equity.slice(Math.max(0, i - WIN + 1), i + 1).map((x) => x.value);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
      return { time: e.time, value: e.value - K * std };
    }),
  };
}

/** Pareto cumulative volume % line (for Pareto chart type). */
function computeParetoCumulative(rows: OhlcRow[]): LineData[] {
  const totalVolume = rows.reduce((sum, r) => sum + r.volume, 0);
  let cumVol = 0;
  return rows.map((r) => {
    cumVol += r.volume;
    return { time: r.time, value: totalVolume > 0 ? (cumVol / totalVolume) * 100 : 0 };
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
  // Analytical rows
  rsiRows: LineData[];
  macdRows: HistogramData[];
  macdSignalRows: LineData[];
  equityCurveRows: LineData[];
  drawdownRows: LineData[];
  returnsHistogramRows: HistogramData[];
  zScoreRows: LineData[];
  volumeOscillatorRows: LineData[];
  regressionMidRows: LineData[];
  regressionUpperRows: LineData[];
  regressionLowerRows: LineData[];
  seasonalityRows: LineData[];
  // Advanced analytical rows
  monteCarloUpperRows: LineData[];
  monteCarloLowerRows: LineData[];
  paretoCumulativeRows: LineData[];
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

export function normalizeOhlcRows(data: CandleData[], count: number): OhlcRow[] {
  const visible = data.slice(0, count);
  let previousTime: UTCTimestamp | undefined;
  return visible.map((item) => {
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
    // Analytical
    rsiRows: computeRSI(ohlcRows),
    ...(() => {
      const { macd, signalLine } = computeMACD(ohlcRows);
      return { macdRows: macd, macdSignalRows: signalLine };
    })(),
    equityCurveRows: computeEquityCurve(ohlcRows),
    drawdownRows: computeDrawdown(ohlcRows),
    returnsHistogramRows: computeReturnsHistogram(ohlcRows),
    zScoreRows: computeZScore(ohlcRows),
    volumeOscillatorRows: computeVolumeOscillator(ohlcRows),
    ...(() => {
      const { mid, upper, lower } = computeRegressionChannel(ohlcRows);
      return { regressionMidRows: mid, regressionUpperRows: upper, regressionLowerRows: lower };
    })(),
    seasonalityRows: computeSeasonality(ohlcRows),
    ...(() => {
      const { upper, lower } = computeMonteCarloConfidence(ohlcRows);
      return { monteCarloUpperRows: upper, monteCarloLowerRows: lower };
    })(),
    paretoCumulativeRows: computeParetoCumulative(ohlcRows),
    times: ohlcRows.map((row) => row.time),
  };
}
