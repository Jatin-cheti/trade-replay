import { sma } from "./moving-averages";

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
  percentB: number[];
  bandwidth: number[];
}

function stddev(window: number[], mean: number): number {
  const variance = window.reduce((acc, v) => acc + ((v - mean) ** 2), 0) / window.length;
  return Math.sqrt(variance);
}

export function bollinger(values: number[], period: number, multiplier: number): BollingerResult {
  const middle = sma(values, period);
  const upper = Array.from({ length: values.length }, () => Number.NaN);
  const lower = Array.from({ length: values.length }, () => Number.NaN);
  const percentB = Array.from({ length: values.length }, () => Number.NaN);
  const bandwidth = Array.from({ length: values.length }, () => Number.NaN);

  for (let i = period - 1; i < values.length; i += 1) {
    const mean = middle[i];
    const sd = stddev(values.slice(i - period + 1, i + 1), mean);
    upper[i] = mean + (multiplier * sd);
    lower[i] = mean - (multiplier * sd);
    const width = upper[i] - lower[i];
    percentB[i] = width === 0 ? 0 : (values[i] - lower[i]) / width;
    bandwidth[i] = mean === 0 ? 0 : width / mean;
  }

  return { upper, middle, lower, percentB, bandwidth };
}
