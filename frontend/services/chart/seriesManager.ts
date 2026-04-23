/**
 * Series Manager — frontend wrapper
 *
 * Type definitions, factory, and visibility helpers are now in @tradereplay/charts.
 * This file re-exports them for backward compatibility and keeps the two
 * app-specific functions that depend on TransformedData.
 */
export {
  createChartSeries,
  applySeriesVisibility,
  activeSeriesForType,
  chartVisibilityMap,
  type ChartSeriesKey,
  type ChartSeriesMap,
  type ChartSeriesOptions,
} from '@tradereplay/charts';

import type { ChartSeriesMap } from '@tradereplay/charts';
import type { TransformedData } from './dataTransforms';

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

