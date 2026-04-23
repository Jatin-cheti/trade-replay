/**
 * @tradereplay/charts — Series Manager
 *
 * Creates and manages all chart series for TradingReplay charts.
 * Use `createChartSeries(chart)` once per chart instance.
 * Use `applySeriesVisibility(map, chartType)` to switch chart types.
 * Use `activeSeriesForType(map, chartType)` to get the primary series for crosshair/price queries.
 */

import type { IChartApi, ISeriesApi } from '../lib/createChart.js';
import type { ChartType } from './chartTypes.js';

// ─── Series key catalogue ────────────────────────────────────────────────────

export type ChartSeriesKey =
  | 'candlestick' | 'hollowCandles' | 'line' | 'stepLine' | 'area' | 'mountainArea'
  | 'rangeArea' | 'baseline' | 'histogram' | 'bar' | 'heikinAshi' | 'ohlc'
  | 'renko' | 'rangeBars' | 'lineBreak' | 'kagi' | 'pointFigure' | 'brick' | 'volume'
  | 'hlcBar' | 'avgPriceBar' | 'openClose' | 'dotChart'
  | 'maLine' | 'emaLine' | 'vwapLine' | 'priceChange'
  | 'rsiLine' | 'macdHistogram' | 'macdSignal'
  | 'equityCurve' | 'drawdownChart' | 'returnsHistogram' | 'zScoreLine' | 'volumeOscillator'
  | 'regressionMid' | 'regressionUpper' | 'regressionLower' | 'seasonalityLine'
  | 'monteCarloUpper' | 'monteCarloLower' | 'paretoCumulative';

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
  hlcBar: ISeriesApi<'Line'>;
  avgPriceBar: ISeriesApi<'Line'>;
  openClose: ISeriesApi<'Line'>;
  dotChart: ISeriesApi<'Line'>;
  maLine: ISeriesApi<'Line'>;
  emaLine: ISeriesApi<'Line'>;
  vwapLine: ISeriesApi<'Line'>;
  priceChange: ISeriesApi<'Line'>;
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
  monteCarloUpper: ISeriesApi<'Line'>;
  monteCarloLower: ISeriesApi<'Line'>;
  paretoCumulative: ISeriesApi<'Line'>;
};

export type ChartSeriesOptions = {
  /** When true, uses TradingView-parity colour palette (slightly different greens/reds). */
  parityMode?: boolean;
};

// ─── Visibility map — which series keys are active per ChartType ──────────────

export const chartVisibilityMap: Record<ChartType, ChartSeriesKey[]> = {
  candlestick: ['candlestick'], line: ['line'], area: ['area'],
  baseline: ['baseline'], histogram: ['histogram'], bar: ['bar'],
  ohlc: ['ohlc'], stepLine: ['stepLine'],
  heikinAshi: ['heikinAshi'], hollowCandles: ['hollowCandles'],
  hlcBar: ['hlcBar'], avgPriceBar: ['avgPriceBar'],
  openClose: ['openClose'], dotChart: ['dotChart'],
  mountainArea: ['mountainArea'], rangeArea: ['rangeArea'],
  maLine: ['maLine'], emaLine: ['emaLine'],
  vwapLine: ['vwapLine'], priceChange: ['priceChange'],
  volumeCandles: ['candlestick', 'volume'], volumeLine: ['line', 'volume'],
  renko: ['renko'], rangeBars: ['rangeBars'], lineBreak: ['lineBreak'],
  kagi: ['kagi'], pointFigure: ['pointFigure'], brick: ['brick'],
  equityCurve: ['equityCurve'],
  drawdownChart: ['drawdownChart'],
  returnsHistogram: ['returnsHistogram'],
  zScoreLine: ['zScoreLine'],
  rsiLine: ['rsiLine'],
  macdHistogram: ['macdHistogram', 'macdSignal'],
  volumeOscillator: ['volumeOscillator'],
  regressionChannel: ['regressionMid', 'regressionUpper', 'regressionLower'],
  seasonality: ['seasonalityLine'],
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

// ─── Compat helper — supports both addSeries() (new API) and legacy adders ───

function addSeriesCompat(
  chart: IChartApi,
  type: 'Candlestick' | 'Line' | 'Area' | 'Baseline' | 'Histogram' | 'Bar',
  options: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const c = chart as unknown as Record<string, (...args: unknown[]) => unknown>;

  if (typeof c['addSeries'] === 'function') {
    try { return c['addSeries'](type, options); } catch { /* fall through */ }
  }

  const legacy: Record<string, string> = {
    Candlestick: 'addCandlestickSeries', Line: 'addLineSeries',
    Area: 'addAreaSeries', Baseline: 'addBaselineSeries',
    Histogram: 'addHistogramSeries', Bar: 'addBarSeries',
  };
  const method = legacy[type];
  if (method && typeof c[method] === 'function') return c[method](options);

  // Last-resort fallback so chart creation never throws.
  const fallback = c['addLineSeries'] || c['addAreaSeries'] || c['addHistogramSeries'] || c['addBarSeries'] || c['addCandlestickSeries'];
  if (typeof fallback === 'function') return fallback({ ...options, visible: false });

  throw new Error(`@tradereplay/charts: unsupported chart series API for type: ${type}`);
}

// ─── createChartSeries ───────────────────────────────────────────────────────

/**
 * Creates the full set of series on the given chart instance.
 * All series except `candlestick` start hidden; use `applySeriesVisibility`
 * to show the correct set for the active `ChartType`.
 *
 * @example
 * ```ts
 * import { createChart, createChartSeries, applySeriesVisibility } from '@tradereplay/charts';
 *
 * const chart = createChart(container, { ... });
 * const series = createChartSeries(chart);
 * applySeriesVisibility(series, 'area');
 * ```
 */
export function createChartSeries(chart: IChartApi, options?: ChartSeriesOptions): ChartSeriesMap {
  const parityMode = options?.parityMode ?? false;
  const up   = parityMode ? '#089981' : '#26a69a';
  const down = parityMode ? '#f23645' : '#ef5350';

  const map = {
    candlestick: addSeriesCompat(chart, 'Candlestick', { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, visible: true }),
    hollowCandles: addSeriesCompat(chart, 'Candlestick', { upColor: 'rgba(23,201,100,0.08)', downColor: '#ff4d4f', borderUpColor: '#43e391', borderDownColor: '#ff7275', wickUpColor: '#43e391', wickDownColor: '#ff7275', visible: false }),
    line: addSeriesCompat(chart, 'Line', { color: '#2962ff', lineWidth: 2, visible: false }),
    stepLine: addSeriesCompat(chart, 'Line', { color: '#89e7ff', lineWidth: 2, visible: false, excludeFromTimeIndex: true }),
    area: addSeriesCompat(chart, 'Area', { lineColor: '#17c964', lineWidth: 2, topColor: 'rgba(23,201,100,0.35)', bottomColor: 'rgba(23,201,100,0.02)', visible: false }),
    mountainArea: addSeriesCompat(chart, 'Area', { lineColor: '#40e0d0', lineWidth: 2, topColor: 'rgba(64,224,208,0.46)', bottomColor: 'rgba(64,224,208,0.04)', visible: false }),
    rangeArea: addSeriesCompat(chart, 'Area', { lineColor: '#ffd166', lineWidth: 2, topColor: 'rgba(255,209,102,0.42)', bottomColor: 'rgba(255,209,102,0.03)', visible: false }),
    baseline: addSeriesCompat(chart, 'Baseline', { baseValue: { type: 'price', price: 0 }, topLineColor: '#17c964', topFillColor1: 'rgba(23,201,100,0.35)', topFillColor2: 'rgba(23,201,100,0.04)', bottomLineColor: '#ff4d4f', bottomFillColor1: 'rgba(255,77,79,0.25)', bottomFillColor2: 'rgba(255,77,79,0.03)', lineWidth: 2, visible: false }),
    histogram: addSeriesCompat(chart, 'Histogram', { priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, base: 0, visible: false }),
    bar: addSeriesCompat(chart, 'Bar', { upColor: '#17c964', downColor: '#ff4d4f', thinBars: false, visible: false }),
    heikinAshi: addSeriesCompat(chart, 'Candlestick', { upColor: '#61dca0', downColor: '#ff6b6e', borderUpColor: '#61dca0', borderDownColor: '#ff6b6e', wickUpColor: '#83e8bb', wickDownColor: '#ff8d8f', visible: false }),
    ohlc: addSeriesCompat(chart, 'Bar', { upColor: '#a1f2c8', downColor: '#ff9799', thinBars: true, visible: false }),
    renko: addSeriesCompat(chart, 'Candlestick', { upColor: '#2ecc71', downColor: '#e74c3c', borderUpColor: '#2ecc71', borderDownColor: '#e74c3c', wickUpColor: '#2ecc71', wickDownColor: '#e74c3c', visible: false }),
    rangeBars: addSeriesCompat(chart, 'Candlestick', { upColor: '#48c9b0', downColor: '#ff6b6e', borderUpColor: '#48c9b0', borderDownColor: '#ff6b6e', wickUpColor: '#48c9b0', wickDownColor: '#ff6b6e', visible: false }),
    lineBreak: addSeriesCompat(chart, 'Candlestick', { upColor: '#5dade2', downColor: '#ec7063', borderUpColor: '#5dade2', borderDownColor: '#ec7063', wickUpColor: '#5dade2', wickDownColor: '#ec7063', visible: false }),
    kagi: addSeriesCompat(chart, 'Line', { color: '#f5b041', lineWidth: 2, visible: false }),
    pointFigure: addSeriesCompat(chart, 'Candlestick', { upColor: '#7dcea0', downColor: '#f1948a', borderUpColor: '#7dcea0', borderDownColor: '#f1948a', wickUpColor: '#7dcea0', wickDownColor: '#f1948a', visible: false }),
    brick: addSeriesCompat(chart, 'Candlestick', { upColor: '#85c1e9', downColor: '#f8c471', borderUpColor: '#85c1e9', borderDownColor: '#f8c471', wickUpColor: '#85c1e9', wickDownColor: '#f8c471', visible: false }),
    volume: addSeriesCompat(chart, 'Histogram', { priceFormat: { type: 'volume' }, priceScaleId: '', visible: false }),
    hlcBar: addSeriesCompat(chart, 'Line', { color: '#a78bfa', lineWidth: 2, visible: false }),
    avgPriceBar: addSeriesCompat(chart, 'Line', { color: '#f87171', lineWidth: 2, visible: false }),
    openClose: addSeriesCompat(chart, 'Line', { color: '#60a5fa', lineWidth: 2, visible: false }),
    dotChart: addSeriesCompat(chart, 'Line', { color: '#fb923c', lineWidth: 2, lineStyle: 1, visible: false }),
    maLine: addSeriesCompat(chart, 'Line', { color: '#facc15', lineWidth: 2, visible: false }),
    emaLine: addSeriesCompat(chart, 'Line', { color: '#f97316', lineWidth: 2, visible: false }),
    vwapLine: addSeriesCompat(chart, 'Line', { color: '#2dd4bf', lineWidth: 2, visible: false }),
    priceChange: addSeriesCompat(chart, 'Line', { color: '#4ade80', lineWidth: 2, visible: false }),
    rsiLine: addSeriesCompat(chart, 'Line', { color: '#c084fc', lineWidth: 2, visible: false }),
    macdHistogram: addSeriesCompat(chart, 'Histogram', { priceFormat: { type: 'price', precision: 4, minMove: 0.0001 }, base: 0, visible: false }),
    macdSignal: addSeriesCompat(chart, 'Line', { color: '#f59e0b', lineWidth: 1, lineStyle: 2, visible: false }),
    equityCurve: addSeriesCompat(chart, 'Area', { lineColor: '#22d3ee', topColor: 'rgba(34,211,238,0.25)', bottomColor: 'rgba(34,211,238,0.02)', lineWidth: 2, visible: false }),
    drawdownChart: addSeriesCompat(chart, 'Area', { lineColor: '#f87171', topColor: 'rgba(248,113,113,0.25)', bottomColor: 'rgba(248,113,113,0.02)', lineWidth: 2, visible: false }),
    returnsHistogram: addSeriesCompat(chart, 'Histogram', { priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, base: 0, visible: false }),
    zScoreLine: addSeriesCompat(chart, 'Line', { color: '#a3e635', lineWidth: 2, visible: false }),
    volumeOscillator: addSeriesCompat(chart, 'Line', { color: '#38bdf8', lineWidth: 2, visible: false }),
    regressionMid: addSeriesCompat(chart, 'Line', { color: '#fbbf24', lineWidth: 2, visible: false }),
    regressionUpper: addSeriesCompat(chart, 'Line', { color: 'rgba(251,191,36,0.5)', lineWidth: 1, lineStyle: 2, visible: false }),
    regressionLower: addSeriesCompat(chart, 'Line', { color: 'rgba(251,191,36,0.5)', lineWidth: 1, lineStyle: 2, visible: false }),
    seasonalityLine: addSeriesCompat(chart, 'Line', { color: '#e879f9', lineWidth: 2, visible: false }),
    monteCarloUpper: addSeriesCompat(chart, 'Line', { color: 'rgba(34,211,238,0.45)', lineWidth: 1, lineStyle: 2, visible: false }),
    monteCarloLower: addSeriesCompat(chart, 'Line', { color: 'rgba(34,211,238,0.45)', lineWidth: 1, lineStyle: 2, visible: false }),
    paretoCumulative: addSeriesCompat(chart, 'Line', { color: '#f97316', lineWidth: 2, visible: false }),
  } as ChartSeriesMap;

  map.volume.priceScale().applyOptions({
    scaleMargins: { top: parityMode ? 0.865 : 0.84, bottom: 0 },
  });

  return map;
}

// ─── Visibility / active series helpers ──────────────────────────────────────

/**
 * Shows only the series that belong to `chartType` and hides all others.
 * Call this whenever the user switches chart type.
 */
export function applySeriesVisibility(map: ChartSeriesMap, chartType: ChartType): void {
  const active = new Set(chartVisibilityMap[chartType] ?? []);
  (Object.keys(map) as ChartSeriesKey[]).forEach((key) => {
    map[key].applyOptions({ visible: active.has(key) });
  });
}

/**
 * Returns the primary (price-query) series for a given chart type.
 * Used when you need `priceToCoordinate` / crosshair data for the visible series.
 */
export function activeSeriesForType(
  map: ChartSeriesMap,
  chartType: ChartType,
): ISeriesApi<'Line'> | ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Area'> | ISeriesApi<'Baseline'> | ISeriesApi<'Histogram'> {
  if (chartType === 'volumeLine') return map.line;
  if (chartType === 'volumeCandles') return map.candlestick;
  return (map as unknown as Record<string, ISeriesApi<'Line'>>)[chartType] ?? map.candlestick;
}
