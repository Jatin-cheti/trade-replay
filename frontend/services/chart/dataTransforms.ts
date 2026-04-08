import type { CandlestickData, HistogramData, LineData, UTCTimestamp } from '@tradereplay/charts';
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
  | 'volumeLine';

export const chartTypeGroups: Array<{ id: string; label: string; types: ChartType[] }> = [
  { id: 'core', label: 'Core', types: ['candlestick', 'line', 'area', 'baseline', 'histogram', 'bar', 'ohlc'] },
  { id: 'advanced', label: 'Advanced', types: ['heikinAshi', 'hollowCandles', 'stepLine', 'rangeArea', 'mountainArea'] },
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
  closeRows: LineData[];
  rangeRows: LineData[];
  stepRows: LineData[];
  histogramRows: HistogramData[];
  volumeRows: HistogramData[];
  heikinRows: CandlestickData[];
  times: UTCTimestamp[];
};

export function toTimestamp(input: string): UTCTimestamp {
  return Math.floor(new Date(input).getTime() / 1000) as UTCTimestamp;
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

export function transformChartData(data: CandleData[], visibleCount: number): TransformedData {
  const visible = data.slice(0, visibleCount);
  const ohlcRows = visible.map((item) => ({
    time: toTimestamp(item.time),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume,
  }));

  const closeRows = ohlcRows.map((row) => ({ time: row.time, value: row.close }));
  const rangeRows = ohlcRows.map((row) => ({ time: row.time, value: (row.high + row.low) / 2 }));

  return {
    ohlcRows,
    closeRows,
    rangeRows,
    stepRows: stepLineTransform(closeRows),
    histogramRows: ohlcRows.map((row) => ({
      time: row.time,
      value: row.close - row.open,
      color: row.close >= row.open ? 'rgba(23, 201, 100, 0.72)' : 'rgba(255, 77, 79, 0.72)',
    })),
    volumeRows: ohlcRows.map((row) => ({
      time: row.time,
      value: row.volume,
      color: row.close >= row.open ? 'rgba(0, 209, 255, 0.45)' : 'rgba(255, 120, 120, 0.45)',
    })),
    heikinRows: heikinAshiTransform(ohlcRows),
    times: ohlcRows.map((row) => row.time),
  };
}
