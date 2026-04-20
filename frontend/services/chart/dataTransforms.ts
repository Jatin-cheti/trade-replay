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
  | 'candlestick'
  | 'line'
  | 'area'
  | 'baseline'
  | 'histogram'
  | 'bar'
  | 'heikinAshi'
  | 'ohlc'
  | 'hollowCandles'
  | 'stepLine'
  | 'rangeArea'
  | 'mountainArea'
  | 'volumeCandles'
  | 'volumeLine'
  | 'renko'
  | 'rangeBars'
  | 'lineBreak'
  | 'kagi'
  | 'pointFigure'
  | 'brick';

export const chartTypeGroups: Array<{ id: string; label: string; types: ChartType[] }> = [
  { id: 'core', label: 'Core', types: ['candlestick', 'line', 'area', 'baseline', 'histogram', 'bar', 'ohlc'] },
  { id: 'advanced', label: 'Advanced', types: ['heikinAshi', 'hollowCandles', 'stepLine', 'rangeArea', 'mountainArea'] },
  { id: 'premium', label: 'Premium', types: ['renko', 'rangeBars', 'lineBreak', 'kagi', 'pointFigure', 'brick'] },
  { id: 'volume', label: 'Volume', types: ['volumeCandles', 'volumeLine'] },
];

export const chartTypeLabels: Record<ChartType, string> = {
  candlestick: 'Candlestick',
  line: 'Line',
  area: 'Area',
  baseline: 'Baseline',
  histogram: 'Histogram',
  bar: 'Bar',
  heikinAshi: 'Heikin Ashi',
  ohlc: 'OHLC',
  hollowCandles: 'Hollow Candles',
  stepLine: 'Step Line',
  rangeArea: 'Range Area',
  mountainArea: 'Mountain Area',
  volumeCandles: 'Candles + Volume',
  volumeLine: 'Line + Volume',
  renko: 'Renko',
  rangeBars: 'Range Bars',
  lineBreak: '3-Line Break',
  kagi: 'Kagi',
  pointFigure: 'Point & Figure',
  brick: 'Brick',
};

export type OhlcRow = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

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
    times: ohlcRows.map((row) => row.time),
  };
}
