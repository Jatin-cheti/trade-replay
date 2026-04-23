/**
 * @tradereplay/charts — Chart Type Definitions
 *
 * Canonical list of every chart type the library supports.
 * Import these instead of re-defining in the consuming app.
 */

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
  // ── Analytical — Implemented ─────────────────────────────────────────
  | 'equityCurve' | 'drawdownChart' | 'returnsHistogram'
  | 'zScoreLine' | 'rsiLine' | 'macdHistogram' | 'volumeOscillator'
  | 'regressionChannel' | 'seasonality'
  // ── Advanced Statistical — Coming Soon ───────────────────────────────
  | 'scatterPlot' | 'bubblePlot' | 'boxPlot' | 'heatMap'
  | 'radarChart' | 'treemap' | 'waterfallChart' | 'sunburst'
  // ── Financial — Coming Soon ──────────────────────────────────────────
  | 'yieldCurve' | 'volatilitySurface' | 'correlationMatrix'
  | 'optionsPayoff' | 'monteCarlo' | 'fanChart' | 'paretoChart'
  // ── Layouts — Coming Soon ─────────────────────────────────────────────
  | 'funnelChart' | 'networkGraph' | 'donutChart' | 'stackedArea';

/** Chart types not yet implemented in the canvas engine. */
export const COMING_SOON_CHART_TYPES: ReadonlySet<ChartType> = new Set<ChartType>([
  'bubblePlot', 'boxPlot', 'heatMap',
  'radarChart', 'treemap', 'sunburst',
  'volatilitySurface', 'correlationMatrix',
  'networkGraph', 'donutChart', 'funnelChart',
]);

export interface ChartTypeGroup {
  id: string;
  label: string;
  types: ChartType[];
}

export const chartTypeGroups: ChartTypeGroup[] = [
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
