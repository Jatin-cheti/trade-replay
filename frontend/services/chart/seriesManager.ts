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
  | 'volume'
  // Derived price series
  | 'hlcBar'
  | 'avgPriceBar'
  | 'openClose'
  | 'dotChart'
  | 'maLine'
  | 'emaLine'
  | 'vwapLine'
  | 'priceChange'
  // Analytical series
  | 'rsiLine'
  | 'macdHistogram'
  | 'macdSignal'
  | 'equityCurve'
  | 'drawdownChart'
  | 'returnsHistogram'
  | 'zScoreLine'
  | 'volumeOscillator'
  | 'regressionMid'
  | 'regressionUpper'
  | 'regressionLower'
  | 'seasonalityLine'
  // Advanced analytical series
  | 'monteCarloUpper'
  | 'monteCarloLower'
  | 'paretoCumulative';

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
  // Derived price series
  hlcBar: ISeriesApi<'Line'>;
  avgPriceBar: ISeriesApi<'Line'>;
  openClose: ISeriesApi<'Line'>;
  dotChart: ISeriesApi<'Line'>;
  maLine: ISeriesApi<'Line'>;
  emaLine: ISeriesApi<'Line'>;
  vwapLine: ISeriesApi<'Line'>;
  priceChange: ISeriesApi<'Line'>;
  // Analytical series
  rsiLine: ISeriesApi<'Line'>;
  macdHistogram: ISeriesApi<'Histogram'>;
  macdSignal: ISeriesApi<'Line'>;
  equityCurve: ISeriesApi<'Area'>;
  drawdownChart: ISeriesApi<'Area'>;
  returnsHistogram: ISeriesApi<'Histogram'>;
  zScoreLine: ISeriesApi<'Line'>;
  volumeOscillator: ISeriesApi<'Line'>;
  regressionMid: ISeriesApi<'Line'>;
  regressionUpper: ISeriesApi<'Line'>;
  regressionLower: ISeriesApi<'Line'>;
  seasonalityLine: ISeriesApi<'Line'>;
  // Advanced analytical series
  monteCarloUpper: ISeriesApi<'Line'>;
  monteCarloLower: ISeriesApi<'Line'>;
  paretoCumulative: ISeriesApi<'Line'>;
};

type ChartSeriesOptions = {
  parityMode?: boolean;
};

export const chartVisibilityMap: Record<ChartType, ChartSeriesKey[]> = {
  // Standard
  candlestick: ['candlestick'], line: ['line'], area: ['area'],
  baseline: ['baseline'], histogram: ['histogram'], bar: ['bar'],
  ohlc: ['ohlc'], stepLine: ['stepLine'],
  // Derived price
  heikinAshi: ['heikinAshi'], hollowCandles: ['hollowCandles'],
  hlcBar: ['hlcBar'], avgPriceBar: ['avgPriceBar'],
  openClose: ['openClose'], dotChart: ['dotChart'],
  mountainArea: ['mountainArea'], rangeArea: ['rangeArea'],
  // Indicators
  maLine: ['maLine'], emaLine: ['emaLine'],
  vwapLine: ['vwapLine'], priceChange: ['priceChange'],
  // Volume
  volumeCandles: ['candlestick', 'volume'], volumeLine: ['line', 'volume'],
  // Price Action
  renko: ['renko'], rangeBars: ['rangeBars'], lineBreak: ['lineBreak'],
  kagi: ['kagi'], pointFigure: ['pointFigure'], brick: ['brick'],
  // Analytical — now implemented
  equityCurve: ['equityCurve'],
  drawdownChart: ['drawdownChart'],
  returnsHistogram: ['returnsHistogram'],
  zScoreLine: ['zScoreLine'],
  rsiLine: ['rsiLine'],
  macdHistogram: ['macdHistogram', 'macdSignal'],
  volumeOscillator: ['volumeOscillator'],
  regressionChannel: ['regressionMid', 'regressionUpper', 'regressionLower'],
  seasonality: ['seasonalityLine'],
  // Canvas-based — still coming soon
  scatterPlot: ['dotChart'],
  bubblePlot: [], boxPlot: [], heatMap: [],
  radarChart: [], treemap: [], waterfallChart: ['returnsHistogram'], sunburst: [],
  yieldCurve: ['area'],
  volatilitySurface: [], correlationMatrix: [],
  optionsPayoff: ['priceChange'],
  monteCarlo: ['equityCurve', 'monteCarloUpper', 'monteCarloLower'],
  fanChart: ['equityCurve', 'monteCarloUpper', 'monteCarloLower'],
  paretoChart: ['volume', 'paretoCumulative'],
  funnelChart: [], networkGraph: [],
  donutChart: [], stackedArea: ['area', 'mountainArea', 'rangeArea'],
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
    // Derived price series
    hlcBar: chart.addSeries('Line', { color: '#a78bfa', lineWidth: 2, visible: false }),
    avgPriceBar: chart.addSeries('Line', { color: '#f87171', lineWidth: 2, visible: false }),
    openClose: chart.addSeries('Line', { color: '#60a5fa', lineWidth: 2, visible: false }),
    dotChart: chart.addSeries('Line', { color: '#fb923c', lineWidth: 2, lineStyle: 1, visible: false }),
    maLine: chart.addSeries('Line', { color: '#facc15', lineWidth: 2, visible: false }),
    emaLine: chart.addSeries('Line', { color: '#f97316', lineWidth: 2, visible: false }),
    vwapLine: chart.addSeries('Line', { color: '#2dd4bf', lineWidth: 2, visible: false }),
    priceChange: chart.addSeries('Line', { color: '#4ade80', lineWidth: 2, visible: false }),
    // Analytical series
    rsiLine: chart.addSeries('Line', { color: '#c084fc', lineWidth: 2, visible: false }),
    macdHistogram: chart.addSeries('Histogram', { priceFormat: { type: 'price', precision: 4, minMove: 0.0001 }, base: 0, visible: false }),
    macdSignal: chart.addSeries('Line', { color: '#f59e0b', lineWidth: 1, lineStyle: 2, visible: false }),
    equityCurve: chart.addSeries('Area', { lineColor: '#22d3ee', topColor: 'rgba(34,211,238,0.25)', bottomColor: 'rgba(34,211,238,0.02)', lineWidth: 2, visible: false }),
    drawdownChart: chart.addSeries('Area', { lineColor: '#f87171', topColor: 'rgba(248,113,113,0.25)', bottomColor: 'rgba(248,113,113,0.02)', lineWidth: 2, visible: false }),
    returnsHistogram: chart.addSeries('Histogram', { priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, base: 0, visible: false }),
    zScoreLine: chart.addSeries('Line', { color: '#a3e635', lineWidth: 2, visible: false }),
    volumeOscillator: chart.addSeries('Line', { color: '#38bdf8', lineWidth: 2, visible: false }),
    regressionMid: chart.addSeries('Line', { color: '#fbbf24', lineWidth: 2, visible: false }),
    regressionUpper: chart.addSeries('Line', { color: 'rgba(251,191,36,0.5)', lineWidth: 1, lineStyle: 2, visible: false }),
    regressionLower: chart.addSeries('Line', { color: 'rgba(251,191,36,0.5)', lineWidth: 1, lineStyle: 2, visible: false }),
    seasonalityLine: chart.addSeries('Line', { color: '#e879f9', lineWidth: 2, visible: false }),
    // Advanced analytical series
    monteCarloUpper: chart.addSeries('Line', { color: 'rgba(34,211,238,0.45)', lineWidth: 1, lineStyle: 2, visible: false }),
    monteCarloLower: chart.addSeries('Line', { color: 'rgba(34,211,238,0.45)', lineWidth: 1, lineStyle: 2, visible: false }),
    paretoCumulative: chart.addSeries('Line', { color: '#f97316', lineWidth: 2, visible: false }),
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
  // Derived price series
  map.hlcBar.setData(data.hlcBarRows);
  map.avgPriceBar.setData(data.avgPriceRows);
  map.openClose.setData(data.openCloseRows);
  map.dotChart.setData(data.closeRows);
  map.maLine.setData(data.maRows);
  map.emaLine.setData(data.emaRows);
  map.vwapLine.setData(data.vwapRows);
  map.priceChange.setData(data.priceChangeRows);
  // Analytical
  map.rsiLine.setData(data.rsiRows);
  map.macdHistogram.setData(data.macdRows);
  map.macdSignal.setData(data.macdSignalRows);
  map.equityCurve.setData(data.equityCurveRows);
  map.drawdownChart.setData(data.drawdownRows);
  map.returnsHistogram.setData(data.returnsHistogramRows);
  map.zScoreLine.setData(data.zScoreRows);
  map.volumeOscillator.setData(data.volumeOscillatorRows);
  map.regressionMid.setData(data.regressionMidRows);
  map.regressionUpper.setData(data.regressionUpperRows);
  map.regressionLower.setData(data.regressionLowerRows);
  map.seasonalityLine.setData(data.seasonalityRows);
  map.monteCarloUpper.setData(data.monteCarloUpperRows);
  map.monteCarloLower.setData(data.monteCarloLowerRows);
  map.paretoCumulative.setData(data.paretoCumulativeRows);
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

export function activeSeriesForType(map: ChartSeriesMap, chartType: ChartType): ISeriesApi<'Line'> | ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Area'> | ISeriesApi<'Baseline'> | ISeriesApi<'Histogram'> {
  if (chartType === 'volumeLine') return map.line;
  if (chartType === 'volumeCandles') return map.candlestick;
  // For coming-soon types (no series), fall back to candlestick (hidden, coordinate queries return null)
  return (map as Record<string, ISeriesApi<'Line'>>)[chartType] ?? map.candlestick;
}
