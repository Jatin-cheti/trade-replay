import type { OHLCV } from "../models/candle.model";

export function closes(candles: OHLCV[]): number[] {
  return candles.map((c) => c.close);
}

export function highs(candles: OHLCV[]): number[] {
  return candles.map((c) => c.high);
}

export function lows(candles: OHLCV[]): number[] {
  return candles.map((c) => c.low);
}

export function volumes(candles: OHLCV[]): number[] {
  return candles.map((c) => c.volume);
}

export function typicalPrices(candles: OHLCV[]): number[] {
  return candles.map((c) => (c.high + c.low + c.close) / 3);
}

export function alignSeries(values: number[], size: number): number[] {
  if (values.length === size) {
    return values;
  }
  if (values.length > size) {
    return values.slice(values.length - size);
  }
  return Array.from({ length: size - values.length }, () => Number.NaN).concat(values);
}
