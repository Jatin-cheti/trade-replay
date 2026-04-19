export function sma(values: number[], period: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN);
  if (period <= 0) {
    return out;
  }
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN);
  if (period <= 0 || values.length === 0) {
    return out;
  }
  const alpha = 2 / (period + 1);
  let acc = values[0];
  for (let i = 0; i < values.length; i += 1) {
    acc = i === 0 ? values[i] : (values[i] * alpha) + (acc * (1 - alpha));
    if (i >= period - 1) {
      out[i] = acc;
    }
  }
  return out;
}

export function wma(values: number[], period: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN);
  if (period <= 0) {
    return out;
  }
  const den = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i += 1) {
    let num = 0;
    for (let j = 0; j < period; j += 1) {
      num += values[i - period + 1 + j] * (j + 1);
    }
    out[i] = num / den;
  }
  return out;
}

export function dema(values: number[], period: number): number[] {
  const e1 = ema(values, period);
  const e2 = ema(e1.map((v) => Number.isFinite(v) ? v : 0), period);
  return e1.map((v, i) => Number.isFinite(v) && Number.isFinite(e2[i]) ? (2 * v) - e2[i] : Number.NaN);
}

export function tema(values: number[], period: number): number[] {
  const e1 = ema(values, period);
  const e2 = ema(e1.map((v) => Number.isFinite(v) ? v : 0), period);
  const e3 = ema(e2.map((v) => Number.isFinite(v) ? v : 0), period);
  return e1.map((v, i) => {
    if (!Number.isFinite(v) || !Number.isFinite(e2[i]) || !Number.isFinite(e3[i])) {
      return Number.NaN;
    }
    return (3 * v) - (3 * e2[i]) + e3[i];
  });
}
