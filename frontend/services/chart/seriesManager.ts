import {
  type IChartApi,
  type ISeriesApi,
} from '@tradereplay/charts';
import type { ChartType, TransformedData } from './dataTransforms';

export type ChartSeriesKey =
  | 'candlestick'
  | 'hollowCandles'
  | 'line'
  | 'stepLine'
  | 'area'
  | 'mountainArea'
  | 'rangeArea'
  | 'baseline'
  | 'histogram'
  | 'bar'
  | 'heikinAshi'
  | 'ohlc'
  | 'renko'
  | 'rangeBars'
  | 'lineBreak'
  | 'kagi'
  | 'pointFigure'
  | 'brick'
  | 'volume';

export type ChartSeriesMap = {
  candlestick: ISeriesApi<'Candlestick'>;
  hollowCandles: ISeriesApi<'Candlestick'>;
  line: ISeriesApi<'Line'>;
  stepLine: ISeriesApi<'Line'>;
  area: ISeriesApi<'Area'>;
  mountainArea: ISeriesApi<'Area'>;
  rangeArea: ISeriesApi<'Area'>;
  baseline: ISeriesApi<'Baseline'>;
  histogram: ISeriesApi<'Histogram'>;
  bar: ISeriesApi<'Bar'>;
  heikinAshi: ISeriesApi<'Candlestick'>;
  ohlc: ISeriesApi<'Bar'>;
  renko: ISeriesApi<'Candlestick'>;
  rangeBars: ISeriesApi<'Candlestick'>;
  lineBreak: ISeriesApi<'Candlestick'>;
  kagi: ISeriesApi<'Line'>;
  pointFigure: ISeriesApi<'Candlestick'>;
  brick: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
};

type ChartSeriesOptions = {
  parityMode?: boolean;
};

export const chartVisibilityMap: Record<ChartType, ChartSeriesKey[]> = {
  candlestick: ['candlestick'],
  line: ['line'],
  area: ['area'],
  baseline: ['baseline'],
  histogram: ['histogram'],
  bar: ['bar'],
  heikinAshi: ['heikinAshi'],
  ohlc: ['ohlc'],
  hollowCandles: ['hollowCandles'],
  stepLine: ['stepLine'],
  rangeArea: ['rangeArea'],
  mountainArea: ['mountainArea'],
  renko: ['renko'],
  rangeBars: ['rangeBars'],
  lineBreak: ['lineBreak'],
  kagi: ['kagi'],
  pointFigure: ['pointFigure'],
  brick: ['brick'],
  volumeCandles: ['candlestick', 'volume'],
  volumeLine: ['line', 'volume'],
};

export function createChartSeries(chart: IChartApi, options?: ChartSeriesOptions): ChartSeriesMap {
  const parityMode = options?.parityMode ?? false;
  const candleUpColor = parityMode ? '#089981' : '#26a69a';
  const candleDownColor = parityMode ? '#f23645' : '#ef5350';

  const map: ChartSeriesMap = {
    candlestick: chart.addSeries('Candlestick', {
      upColor: candleUpColor,
      downColor: candleDownColor,
      borderUpColor: candleUpColor,
      borderDownColor: candleDownColor,
      wickUpColor: candleUpColor,
      wickDownColor: candleDownColor,
      visible: true,
    }),
    hollowCandles: chart.addSeries('Candlestick', {
      upColor: 'rgba(23, 201, 100, 0.08)', downColor: '#ff4d4f', borderUpColor: '#43e391', borderDownColor: '#ff7275',
      wickUpColor: '#43e391', wickDownColor: '#ff7275', visible: false,
    }),
    line: chart.addSeries('Line', { color: '#2962ff', lineWidth: 2, visible: false }),
    stepLine: chart.addSeries('Line', {
      color: '#89e7ff',
      lineWidth: 2,
      visible: false,
      excludeFromTimeIndex: true,
    }),
    area: chart.addSeries('Area', {
      lineColor: '#17c964', lineWidth: 2, topColor: 'rgba(23, 201, 100, 0.35)', bottomColor: 'rgba(23, 201, 100, 0.02)', visible: false,
    }),
    mountainArea: chart.addSeries('Area', {
      lineColor: '#40e0d0', lineWidth: 2, topColor: 'rgba(64, 224, 208, 0.46)', bottomColor: 'rgba(64, 224, 208, 0.04)', visible: false,
    }),
    rangeArea: chart.addSeries('Area', {
      lineColor: '#ffd166', lineWidth: 2, topColor: 'rgba(255, 209, 102, 0.42)', bottomColor: 'rgba(255, 209, 102, 0.03)', visible: false,
    }),
    baseline: chart.addSeries('Baseline', {
      baseValue: { type: 'price', price: 0 }, topLineColor: '#17c964', topFillColor1: 'rgba(23, 201, 100, 0.35)', topFillColor2: 'rgba(23, 201, 100, 0.04)',
      bottomLineColor: '#ff4d4f', bottomFillColor1: 'rgba(255, 77, 79, 0.25)', bottomFillColor2: 'rgba(255, 77, 79, 0.03)', lineWidth: 2, visible: false,
    }),
    histogram: chart.addSeries('Histogram', { priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, base: 0, visible: false }),
    bar: chart.addSeries('Bar', { upColor: '#17c964', downColor: '#ff4d4f', thinBars: false, visible: false }),
    heikinAshi: chart.addSeries('Candlestick', {
      upColor: '#61dca0', downColor: '#ff6b6e', borderUpColor: '#61dca0', borderDownColor: '#ff6b6e',
      wickUpColor: '#83e8bb', wickDownColor: '#ff8d8f', visible: false,
    }),
    ohlc: chart.addSeries('Bar', { upColor: '#a1f2c8', downColor: '#ff9799', thinBars: true, visible: false }),
    renko: chart.addSeries('Candlestick', {
      upColor: '#2ecc71', downColor: '#e74c3c', borderUpColor: '#2ecc71', borderDownColor: '#e74c3c',
      wickUpColor: '#2ecc71', wickDownColor: '#e74c3c', visible: false,
    }),
    rangeBars: chart.addSeries('Candlestick', {
      upColor: '#48c9b0', downColor: '#ff6b6e', borderUpColor: '#48c9b0', borderDownColor: '#ff6b6e',
      wickUpColor: '#48c9b0', wickDownColor: '#ff6b6e', visible: false,
    }),
    lineBreak: chart.addSeries('Candlestick', {
      upColor: '#5dade2', downColor: '#ec7063', borderUpColor: '#5dade2', borderDownColor: '#ec7063',
      wickUpColor: '#5dade2', wickDownColor: '#ec7063', visible: false,
    }),
    kagi: chart.addSeries('Line', { color: '#f5b041', lineWidth: 2, visible: false }),
    pointFigure: chart.addSeries('Candlestick', {
      upColor: '#7dcea0', downColor: '#f1948a', borderUpColor: '#7dcea0', borderDownColor: '#f1948a',
      wickUpColor: '#7dcea0', wickDownColor: '#f1948a', visible: false,
    }),
    brick: chart.addSeries('Candlestick', {
      upColor: '#85c1e9', downColor: '#f8c471', borderUpColor: '#85c1e9', borderDownColor: '#f8c471',
      wickUpColor: '#85c1e9', wickDownColor: '#f8c471', visible: false,
    }),
    volume: chart.addSeries('Histogram', { priceFormat: { type: 'volume' }, priceScaleId: '', visible: false }),
  };

  map.volume.priceScale().applyOptions({
    scaleMargins: {
      top: parityMode ? 0.865 : 0.84,
      bottom: 0,
    },
  });
  return map;
}

export function applySeriesData(map: ChartSeriesMap, data: TransformedData): void {
  map.candlestick.setData(data.ohlcRows);
  map.hollowCandles.setData(data.ohlcRows);
  map.line.setData(data.closeRows);
  map.stepLine.setData(data.stepRows);
  map.area.setData(data.closeRows);
  map.mountainArea.setData(data.closeRows);
  map.rangeArea.setData(data.rangeRows);
  map.baseline.setData(data.closeRows);
  map.histogram.setData(data.histogramRows);
  map.bar.setData(data.ohlcRows);
  map.heikinAshi.setData(data.heikinRows);
  map.ohlc.setData(data.ohlcRows);
  map.renko.setData(data.renkoRows);
  map.rangeBars.setData(data.rangeBarsRows);
  map.lineBreak.setData(data.lineBreakRows);
  map.kagi.setData(data.kagiLineRows);
  map.pointFigure.setData(data.pointFigureRows);
  map.brick.setData(data.brickRows);
  map.volume.setData(data.volumeRows);
}

export function updateSeriesData(map: ChartSeriesMap, data: TransformedData): void {
  const lastOhlc = data.ohlcRows[data.ohlcRows.length - 1];
  const lastClose = data.closeRows[data.closeRows.length - 1];
  const lastRange = data.rangeRows[data.rangeRows.length - 1];
  const lastHistogram = data.histogramRows[data.histogramRows.length - 1];
  const lastVolume = data.volumeRows[data.volumeRows.length - 1];
  const lastHeikin = data.heikinRows[data.heikinRows.length - 1];

  if (lastOhlc) {
    map.candlestick.update(lastOhlc);
    map.hollowCandles.update(lastOhlc);
    map.bar.update(lastOhlc);
    map.ohlc.update(lastOhlc);
  }

  if (lastClose) {
    map.line.update(lastClose);
    map.area.update(lastClose);
    map.mountainArea.update(lastClose);
    map.baseline.update(lastClose);
  }

  if (lastRange) {
    map.rangeArea.update(lastRange);
  }

  if (lastHistogram) {
    map.histogram.update(lastHistogram);
  }

  if (lastVolume) {
    map.volume.update(lastVolume);
  }

  if (lastHeikin) {
    map.heikinAshi.update(lastHeikin);
  }

  // Premium transforms can reflow historical bars, so they are synced in full.
  map.renko.setData(data.renkoRows);
  map.rangeBars.setData(data.rangeBarsRows);
  map.lineBreak.setData(data.lineBreakRows);
  map.kagi.setData(data.kagiLineRows);
  map.pointFigure.setData(data.pointFigureRows);
  map.brick.setData(data.brickRows);

  // Step-line data inserts synthetic mid-points and can reorder tail updates.
  // Use full sync for this series to avoid "Cannot update oldest data" runtime errors.
  map.stepLine.setData(data.stepRows);
}

export function applySeriesVisibility(map: ChartSeriesMap, chartType: ChartType): void {
  const active = new Set(chartVisibilityMap[chartType]);
  (Object.keys(map) as ChartSeriesKey[]).forEach((key) => {
    map[key].applyOptions({ visible: active.has(key) });
  });
}

export function activeSeriesForType(map: ChartSeriesMap, chartType: ChartType) {
  if (chartType === 'volumeLine') return map.line;
  if (chartType === 'volumeCandles') return map.candlestick;
  if (chartType === 'hollowCandles') return map.hollowCandles;
  return map[chartType as Exclude<ChartType, 'volumeLine' | 'volumeCandles'>] ?? map.candlestick;
}
