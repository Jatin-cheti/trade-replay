/**
 * Chart Engine — frontend wrapper
 *
 * All implementation now lives in @tradereplay/charts.
 * This file re-exports the public API for backward compatibility with existing imports.
 */
export {
  createTradingChart,
  resizeChartSurface,
  fitChartContent,
  type TradingChartOptions as TradingChartEngineOptions,
} from '@tradereplay/charts';
