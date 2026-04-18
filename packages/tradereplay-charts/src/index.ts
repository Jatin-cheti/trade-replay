export {
  createChart,
  type UTCTimestamp,
  type InteractionMode,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type SeriesType,
  type SeriesOptions,
  type ScaleMargins,
  type IPriceScaleApi,
  type ISeriesApi,
  type LogicalRange,
  type TimeRange,
  type ITimeScaleApi,
  type ChartOptions,
  type IChartApi,
  type CrosshairMoveEvent,
} from './lib/createChart';

export { TimeIndex } from './lib/data/timeIndex';
export { SeriesStore, type TimedRow } from './lib/data/seriesStore';
export { type PaneId, type PaneDef, type PaneRect, PANE_DIVIDER_H, computePaneLayout } from './lib/layout/panes';
export { priceToY, yToPrice, sepPriceToY, sepYToPrice } from './lib/scales/priceScale';

// ─── Indicator framework ─────────────────────────────────────────────────────
export {
  type IndicatorId,
  type IndicatorInstanceId,
  type IndicatorInputSpec,
  type IndicatorOutputSpec,
  type IndicatorSeriesType,
  type IndicatorPanePlacement,
  type IndicatorComputeContext,
  type IndicatorOutputSeries,
  type IndicatorResult,
  type IndicatorDefinition,
} from './indicators/types';

export { registerIndicator, getIndicator, listIndicators } from './indicators/registry';
export { getGlobalPerfTelemetry, enableGlobalPerfTelemetry } from './lib/perfTelemetry';

export {
  type TransformOhlc,
  renkoTransform,
  rangeBarsTransform,
  lineBreakTransform,
  kagiTransform,
  pointFigureTransform,
  brickTransform,
} from './transforms/premium';

// Re-export builtin definitions so consumers can reference them without re-registering.
export { smaDef }  from './indicators/builtins/sma';
export { emaDef }  from './indicators/builtins/ema';
export { rsiDef }  from './indicators/builtins/rsi';
export { macdDef } from './indicators/builtins/macd';
export { wmaDef } from './indicators/builtins/wma';
export { vwapDef } from './indicators/builtins/vwap';
export { bbandsDef } from './indicators/builtins/bbands';
export { donchianDef } from './indicators/builtins/donchian';
export { keltnerDef } from './indicators/builtins/keltner';
export { atrDef } from './indicators/builtins/atr';
export { supertrendDef } from './indicators/builtins/supertrend';
export { psarDef } from './indicators/builtins/psar';
export { pivotDef } from './indicators/builtins/pivot';
export { stochasticDef } from './indicators/builtins/stochastic';
export { cciDef } from './indicators/builtins/cci';
export { rocDef } from './indicators/builtins/roc';
export { momentumDef } from './indicators/builtins/momentum';
export { williamsRDef } from './indicators/builtins/williamsR';
export { mfiDef } from './indicators/builtins/mfi';
export { obvDef } from './indicators/builtins/obv';
export { cmfDef } from './indicators/builtins/cmf';
export { adxDef } from './indicators/builtins/adx';
export { aroonDef } from './indicators/builtins/aroon';
export { trixDef } from './indicators/builtins/trix';
export { ultimateDef } from './indicators/builtins/ultimate';
export { chaikinOscDef } from './indicators/builtins/chaikinOsc';
export { awesomeDef } from './indicators/builtins/awesome';
export { dpoDef } from './indicators/builtins/dpo';
export { ichimokuDef } from './indicators/builtins/ichimoku';
export {
  hmaDef,
  demaDef,
  temaDef,
  zlemaDef,
  kamaDef,
  almaDef,
  lsmaDef,
  stochRsiDef,
  rviDef,
  ppoDef,
  pvoDef,
  tsiDef,
  dxDef,
  crsiDef,
  elderRayDef,
  cmoDef,
  fisherDef,
  kdjDef,
  bollingerPercentBDef,
  bollingerBandwidthDef,
  chaikinVolatilityDef,
  stddevDef,
  varianceDef,
  adlDef,
  forceIndexDef,
  eomDef,
  nviDef,
  pviDef,
  vptDef,
  aroonOscillatorDef,
  vortexDef,
} from './indicators/builtins/batch2';
export {
  trimaDef,
  smmaDef,
  apoDef,
  smiDef,
  choppinessDef,
  ulcerIndexDef,
  massIndexDef,
  qstickDef,
  relativeVolumeDef,
  balanceOfPowerDef,
  emvOscDef,
  volatilityRatioDef,
  linearRegSlopeDef,
  linearRegInterceptDef,
  linearRegAngleDef,
  priceChannelMidDef,
  medianPriceDef,
  typicalPriceDef,
  weightedCloseDef,
  volumeOscillatorDef,
} from './indicators/builtins/batch3';
export {
  coppockCurveDef,
  percentileRankDef,
  normalizedAtrDef,
  priceChannelWidthDef,
  closeLocationValueDef,
  candleBodyDef,
  candleBodyPercentDef,
  upperWickDef,
  lowerWickDef,
  trueRangePercentDef,
  rollingHighDef,
  rollingLowDef,
  volumeZScoreDef,
  volumeSmaRatioDef,
  rangeSmaRatioDef,
  cumulativeVolumeDeltaDef,
  rollingReturnDef,
  logReturnDef,
  volatilityEmaDef,
  breakoutStrengthDef,
  trendStrengthDef,
} from './indicators/builtins/batch4';
