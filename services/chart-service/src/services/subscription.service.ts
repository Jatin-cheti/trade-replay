import type { IndicatorGraph } from "../models/indicator.model";
import type { Timeframe } from "../models/candle.model";

export interface ChartSubscription {
  chartId: string;
  symbol: string;
  timeframe: Timeframe;
  indicators: IndicatorGraph[];
}

const byChart = new Map<string, ChartSubscription>();
const chartsBySymbol = new Map<string, Set<string>>();

export function saveSubscription(input: ChartSubscription): void {
  byChart.set(input.chartId, input);
  const set = chartsBySymbol.get(input.symbol) ?? new Set<string>();
  set.add(input.chartId);
  chartsBySymbol.set(input.symbol, set);
}

export function removeSubscription(chartId: string): ChartSubscription | null {
  const existing = byChart.get(chartId);
  if (!existing) {
    return null;
  }
  byChart.delete(chartId);
  const set = chartsBySymbol.get(existing.symbol);
  if (set) {
    set.delete(chartId);
    if (set.size === 0) {
      chartsBySymbol.delete(existing.symbol);
    }
  }
  return existing;
}

export function getSubscription(chartId: string): ChartSubscription | null {
  return byChart.get(chartId) ?? null;
}

export function getChartsBySymbol(symbol: string): string[] {
  return Array.from(chartsBySymbol.get(symbol) ?? []);
}

export function hasSubscribers(symbol: string): boolean {
  return (chartsBySymbol.get(symbol)?.size ?? 0) > 0;
}
