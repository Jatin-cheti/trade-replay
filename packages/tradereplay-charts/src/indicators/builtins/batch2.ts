import type { IndicatorComputeContext, IndicatorDefinition, IndicatorResult } from '../types.ts';
import { computeEmaValues } from './ema.ts';
import { computeWmaValues } from './wma.ts';
import { computeRsiValues } from './rsi.ts';
import { computeAroonValues } from './aroon.ts';
import { clampInt, nulls, rollingSma, rollingStdDev } from './_helpers.ts';

type Num = number | null;

function absValues(values: readonly Num[]): Num[] {
  return values.map((v) => (v == null ? null : Math.abs(v)));
}

function priceDiff(values: readonly Num[]): Num[] {
  const out = nulls(values.length);
  for (let i = 1; i < values.length; i++) {
    const cur = values[i];
    const prev = values[i - 1];
    if (cur == null || prev == null) continue;
    out[i] = cur - prev;
  }
  return out;
}

function highest(values: readonly Num[], from: number, to: number): number | null {
  let best: number | null = null;
  for (let i = from; i <= to; i++) {
    const v = values[i];
    if (v == null) return null;
    best = best == null ? v : Math.max(best, v);
  }
  return best;
}

function lowest(values: readonly Num[], from: number, to: number): number | null {
  let best: number | null = null;
  for (let i = from; i <= to; i++) {
    const v = values[i];
    if (v == null) return null;
    best = best == null ? v : Math.min(best, v);
  }
  return best;
}

export function computeDemaValues(values: readonly Num[], period: number): Num[] {
  const ema1 = computeEmaValues(values, period);
  const ema2 = computeEmaValues(ema1, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ema1[i] == null || ema2[i] == null) continue;
    out[i] = 2 * ema1[i]! - ema2[i]!;
  }
  return out;
}

export function computeTemaValues(values: readonly Num[], period: number): Num[] {
  const ema1 = computeEmaValues(values, period);
  const ema2 = computeEmaValues(ema1, period);
  const ema3 = computeEmaValues(ema2, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ema1[i] == null || ema2[i] == null || ema3[i] == null) continue;
    out[i] = 3 * ema1[i]! - 3 * ema2[i]! + ema3[i]!;
  }
  return out;
}

export function computeHmaValues(values: readonly Num[], period: number): Num[] {
  const half = Math.max(1, Math.round(period / 2));
  const root = Math.max(1, Math.round(Math.sqrt(period)));
  const wmaHalf = computeWmaValues(values, half);
  const wmaFull = computeWmaValues(values, period);
  const raw = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (wmaHalf[i] == null || wmaFull[i] == null) continue;
    raw[i] = 2 * wmaHalf[i]! - wmaFull[i]!;
  }
  return computeWmaValues(raw, root);
}

export function computeZlemaValues(values: readonly Num[], period: number): Num[] {
  const lag = Math.max(1, Math.floor((period - 1) / 2));
  const adjusted = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    const cur = values[i];
    if (cur == null) continue;
    if (i >= lag && values[i - lag] != null) adjusted[i] = cur + (cur - values[i - lag]!);
    else adjusted[i] = cur;
  }
  return computeEmaValues(adjusted, period);
}

export function computeKamaValues(values: readonly Num[], erPeriod: number, fast: number, slow: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  const fastSc = 2 / (fast + 1);
  const slowSc = 2 / (slow + 1);
  let prev: number | null = null;

  for (let i = 0; i < n; i++) {
    const cur = values[i];
    if (cur == null) continue;
    if (i < erPeriod || values[i - erPeriod] == null) {
      prev = cur;
      continue;
    }

    let volatility = 0;
    let valid = true;
    for (let j = i - erPeriod + 1; j <= i; j++) {
      if (values[j] == null || values[j - 1] == null) {
        valid = false;
        break;
      }
      volatility += Math.abs(values[j]! - values[j - 1]!);
    }
    if (!valid || volatility === 0) continue;

    const change = Math.abs(cur - values[i - erPeriod]!);
    const er = change / volatility;
    const sc = Math.pow(er * (fastSc - slowSc) + slowSc, 2);
    prev = prev == null ? cur : prev + sc * (cur - prev);
    out[i] = prev;
  }

  return out;
}

export function computeAlmaValues(values: readonly Num[], period: number, sigma: number, offset: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights: number[] = [];
  let wSum = 0;
  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - m) * (i - m)) / (2 * s * s));
    weights.push(w);
    wSum += w;
  }

  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) {
        valid = false;
        break;
      }
      sum += v * weights[j];
    }
    if (valid) out[i] = sum / wSum;
  }

  return out;
}

export function computeLsmaValues(values: readonly Num[], period: number): Num[] {
  const n = values.length;
  const out = nulls(n);
  const sumX = (period * (period - 1)) / 2;
  const sumXX = ((period - 1) * period * (2 * period - 1)) / 6;
  const denom = period * sumXX - sumX * sumX;

  for (let i = period - 1; i < n; i++) {
    let sumY = 0;
    let sumXY = 0;
    let valid = true;
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j];
      if (v == null) {
        valid = false;
        break;
      }
      sumY += v;
      sumXY += j * v;
    }
    if (!valid) continue;
    const slope = (period * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / period;
    out[i] = intercept + slope * (period - 1);
  }

  return out;
}

export function computeStochRsiValues(close: readonly Num[], rsiPeriod: number, stochPeriod: number, smoothK: number, smoothD: number): { k: Num[]; d: Num[] } {
  const rsi = computeRsiValues(close, rsiPeriod);
  const raw = nulls(close.length);
  for (let i = stochPeriod - 1; i < close.length; i++) {
    const hi = highest(rsi, i - stochPeriod + 1, i);
    const lo = lowest(rsi, i - stochPeriod + 1, i);
    const rv = rsi[i];
    if (hi == null || lo == null || rv == null || hi === lo) continue;
    raw[i] = ((rv - lo) / (hi - lo)) * 100;
  }
  const k = rollingSma(raw, smoothK);
  const d = rollingSma(k, smoothD);
  return { k, d };
}

export function computeRviValues(open: readonly Num[], high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): { rvi: Num[]; signal: Num[] } {
  const num = nulls(close.length);
  const den = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) continue;
    num[i] = close[i]! - open[i]!;
    den[i] = high[i]! - low[i]!;
  }

  const numSma = rollingSma(num, period);
  const denSma = rollingSma(den, period);
  const rvi = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (numSma[i] == null || denSma[i] == null || denSma[i] === 0) continue;
    rvi[i] = numSma[i]! / denSma[i]!;
  }
  const signal = rollingSma(rvi, 4);
  return { rvi, signal };
}

export function computePpoValues(values: readonly Num[], fast: number, slow: number, signal: number): { ppo: Num[]; signalLine: Num[]; histogram: Num[] } {
  const fastEma = computeEmaValues(values, fast);
  const slowEma = computeEmaValues(values, slow);
  const ppo = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (fastEma[i] == null || slowEma[i] == null || slowEma[i] === 0) continue;
    ppo[i] = ((fastEma[i]! - slowEma[i]!) / slowEma[i]!) * 100;
  }
  const signalLine = computeEmaValues(ppo, signal);
  const histogram = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ppo[i] == null || signalLine[i] == null) continue;
    histogram[i] = ppo[i]! - signalLine[i]!;
  }
  return { ppo, signalLine, histogram };
}

export function computeTsiValues(values: readonly Num[], longPeriod: number, shortPeriod: number, signalPeriod: number): { tsi: Num[]; signal: Num[] } {
  const m = priceDiff(values);
  const absM = absValues(m);
  const ema1 = computeEmaValues(m, longPeriod);
  const ema2 = computeEmaValues(ema1, shortPeriod);
  const absEma1 = computeEmaValues(absM, longPeriod);
  const absEma2 = computeEmaValues(absEma1, shortPeriod);
  const tsi = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (ema2[i] == null || absEma2[i] == null || absEma2[i] === 0) continue;
    tsi[i] = (100 * ema2[i]!) / absEma2[i]!;
  }
  const signal = computeEmaValues(tsi, signalPeriod);
  return { tsi, signal };
}

export function computeDxValues(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): Num[] {
  const n = close.length;
  const plusDm = nulls(n);
  const minusDm = nulls(n);
  const tr = nulls(n);

  for (let i = 1; i < n; i++) {
    if (high[i] == null || low[i] == null || high[i - 1] == null || low[i - 1] == null || close[i - 1] == null) continue;
    const up = high[i]! - high[i - 1]!;
    const down = low[i - 1]! - low[i]!;
    plusDm[i] = up > down && up > 0 ? up : 0;
    minusDm[i] = down > up && down > 0 ? down : 0;
    tr[i] = Math.max(high[i]! - low[i]!, Math.abs(high[i]! - close[i - 1]!), Math.abs(low[i]! - close[i - 1]!));
  }

  const smPlus = computeEmaValues(plusDm, period, 1 / period);
  const smMinus = computeEmaValues(minusDm, period, 1 / period);
  const smTr = computeEmaValues(tr, period, 1 / period);
  const out = nulls(n);

  for (let i = 0; i < n; i++) {
    if (smTr[i] == null || smTr[i] === 0 || smPlus[i] == null || smMinus[i] == null) continue;
    const pdi = (100 * smPlus[i]!) / smTr[i]!;
    const mdi = (100 * smMinus[i]!) / smTr[i]!;
    const sum = pdi + mdi;
    if (sum === 0) continue;
    out[i] = (100 * Math.abs(pdi - mdi)) / sum;
  }

  return out;
}

export function computeCrsiValues(close: readonly Num[], rsiPeriod: number, streakPeriod: number, rankPeriod: number): Num[] {
  const n = close.length;
  const streak = nulls(n);
  let cur = 0;
  for (let i = 1; i < n; i++) {
    if (close[i] == null || close[i - 1] == null) continue;
    if (close[i]! > close[i - 1]!) cur = cur >= 0 ? cur + 1 : 1;
    else if (close[i]! < close[i - 1]!) cur = cur <= 0 ? cur - 1 : -1;
    else cur = 0;
    streak[i] = cur;
  }

  const rsiClose = computeRsiValues(close, rsiPeriod);
  const rsiStreak = computeRsiValues(streak, streakPeriod);

  const roc1 = nulls(n);
  for (let i = 1; i < n; i++) {
    if (close[i] == null || close[i - 1] == null || close[i - 1] === 0) continue;
    roc1[i] = ((close[i]! - close[i - 1]!) / close[i - 1]!) * 100;
  }

  const rank = nulls(n);
  for (let i = rankPeriod; i < n; i++) {
    const v = roc1[i];
    if (v == null) continue;
    let less = 0;
    let valid = 0;
    for (let j = i - rankPeriod; j < i; j++) {
      if (roc1[j] == null) continue;
      valid++;
      if (roc1[j]! < v) less++;
    }
    if (valid > 0) rank[i] = (less / valid) * 100;
  }

  const out = nulls(n);
  for (let i = 0; i < n; i++) {
    if (rsiClose[i] == null || rsiStreak[i] == null || rank[i] == null) continue;
    out[i] = (rsiClose[i]! + rsiStreak[i]! + rank[i]!) / 3;
  }
  return out;
}

export function computeElderRayValues(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): { bull: Num[]; bear: Num[] } {
  const ema = computeEmaValues(close, period);
  const bull = nulls(close.length);
  const bear = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (ema[i] == null || high[i] == null || low[i] == null) continue;
    bull[i] = high[i]! - ema[i]!;
    bear[i] = low[i]! - ema[i]!;
  }
  return { bull, bear };
}

export function computeCmoValues(close: readonly Num[], period: number): Num[] {
  const out = nulls(close.length);
  for (let i = period; i < close.length; i++) {
    let up = 0;
    let down = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (close[j] == null || close[j - 1] == null) {
        valid = false;
        break;
      }
      const diff = close[j]! - close[j - 1]!;
      if (diff > 0) up += diff;
      else down += Math.abs(diff);
    }
    if (!valid || up + down === 0) continue;
    out[i] = (100 * (up - down)) / (up + down);
  }
  return out;
}

export function computeFisherValues(high: readonly Num[], low: readonly Num[], period: number): { fisher: Num[]; signal: Num[] } {
  const median = nulls(high.length);
  for (let i = 0; i < high.length; i++) {
    if (high[i] == null || low[i] == null) continue;
    median[i] = (high[i]! + low[i]!) / 2;
  }

  const fisher = nulls(high.length);
  const signal = nulls(high.length);
  let prevValue = 0;
  let prevFisher = 0;

  for (let i = period - 1; i < high.length; i++) {
    const hi = highest(median, i - period + 1, i);
    const lo = lowest(median, i - period + 1, i);
    const cur = median[i];
    if (hi == null || lo == null || cur == null || hi === lo) continue;

    const x = 0.33 * 2 * ((cur - lo) / (hi - lo) - 0.5) + 0.67 * prevValue;
    const value = Math.max(-0.999, Math.min(0.999, x));
    const f = 0.5 * Math.log((1 + value) / (1 - value)) + 0.5 * prevFisher;
    fisher[i] = f;
    signal[i] = prevFisher;
    prevValue = value;
    prevFisher = f;
  }

  return { fisher, signal };
}

export function computeKdjValues(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number, smoothK: number, smoothD: number): { k: Num[]; d: Num[]; j: Num[] } {
  const rsv = nulls(close.length);
  for (let i = period - 1; i < close.length; i++) {
    const hi = highest(high, i - period + 1, i);
    const lo = lowest(low, i - period + 1, i);
    const c = close[i];
    if (hi == null || lo == null || c == null || hi === lo) continue;
    rsv[i] = ((c - lo) / (hi - lo)) * 100;
  }

  const k = rollingSma(rsv, smoothK);
  const d = rollingSma(k, smoothD);
  const j = nulls(close.length);
  for (let i = 0; i < close.length; i++) {
    if (k[i] == null || d[i] == null) continue;
    j[i] = 3 * k[i]! - 2 * d[i]!;
  }
  return { k, d, j };
}

export function computeBollingerPctB(values: readonly Num[], period: number, mult: number): Num[] {
  const basis = rollingSma(values, period);
  const std = rollingStdDev(values, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (basis[i] == null || std[i] == null || values[i] == null) continue;
    const upper = basis[i]! + mult * std[i]!;
    const lower = basis[i]! - mult * std[i]!;
    if (upper === lower) continue;
    out[i] = (values[i]! - lower) / (upper - lower);
  }
  return out;
}

export function computeBollingerBandwidth(values: readonly Num[], period: number, mult: number): Num[] {
  const basis = rollingSma(values, period);
  const std = rollingStdDev(values, period);
  const out = nulls(values.length);
  for (let i = 0; i < values.length; i++) {
    if (basis[i] == null || std[i] == null || basis[i] === 0) continue;
    const upper = basis[i]! + mult * std[i]!;
    const lower = basis[i]! - mult * std[i]!;
    out[i] = ((upper - lower) / basis[i]!) * 100;
  }
  return out;
}

export function computeChaikinVolatility(high: readonly Num[], low: readonly Num[], period: number, diffPeriod: number): Num[] {
  const hl = nulls(high.length);
  for (let i = 0; i < high.length; i++) {
    if (high[i] == null || low[i] == null) continue;
    hl[i] = high[i]! - low[i]!;
  }
  const ema = computeEmaValues(hl, period);
  const out = nulls(high.length);
  for (let i = diffPeriod; i < high.length; i++) {
    if (ema[i] == null || ema[i - diffPeriod] == null || ema[i - diffPeriod] === 0) continue;
    out[i] = ((ema[i]! - ema[i - diffPeriod]!) / ema[i - diffPeriod]!) * 100;
  }
  return out;
}

export function computeVariance(values: readonly Num[], period: number): Num[] {
  const std = rollingStdDev(values, period);
  return std.map((v) => (v == null ? null : v * v));
}

export function computeAdl(high: readonly Num[], low: readonly Num[], close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let acc = 0;
  for (let i = 0; i < close.length; i++) {
    if (high[i] == null || low[i] == null || close[i] == null || volume[i] == null || high[i] === low[i]) {
      out[i] = i === 0 ? 0 : out[i - 1];
      continue;
    }
    const mfm = ((close[i]! - low[i]!) - (high[i]! - close[i]!)) / (high[i]! - low[i]!);
    const mfv = mfm * volume[i]!;
    acc += mfv;
    out[i] = acc;
  }
  return out;
}

export function computeForceIndex(close: readonly Num[], volume: readonly Num[], period: number): Num[] {
  const raw = nulls(close.length);
  for (let i = 1; i < close.length; i++) {
    if (close[i] == null || close[i - 1] == null || volume[i] == null) continue;
    raw[i] = (close[i]! - close[i - 1]!) * volume[i]!;
  }
  return computeEmaValues(raw, period);
}

export function computeEom(high: readonly Num[], low: readonly Num[], volume: readonly Num[], period: number): Num[] {
  const raw = nulls(high.length);
  for (let i = 1; i < high.length; i++) {
    if (high[i] == null || low[i] == null || high[i - 1] == null || low[i - 1] == null || volume[i] == null || volume[i] === 0) continue;
    const distance = ((high[i]! + low[i]!) / 2) - ((high[i - 1]! + low[i - 1]!) / 2);
    const boxRatio = (volume[i]! / 100000000) / Math.max(1e-9, high[i]! - low[i]!);
    raw[i] = distance / boxRatio;
  }
  return rollingSma(raw, period);
}

export function computeNvi(close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let idx = 1000;
  if (close.length > 0) out[0] = idx;
  for (let i = 1; i < close.length; i++) {
    out[i] = idx;
    if (close[i] == null || close[i - 1] == null || volume[i] == null || volume[i - 1] == null || close[i - 1] === 0) continue;
    if (volume[i]! < volume[i - 1]!) idx += idx * ((close[i]! - close[i - 1]!) / close[i - 1]!);
    out[i] = idx;
  }
  return out;
}

export function computePvi(close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let idx = 1000;
  if (close.length > 0) out[0] = idx;
  for (let i = 1; i < close.length; i++) {
    out[i] = idx;
    if (close[i] == null || close[i - 1] == null || volume[i] == null || volume[i - 1] == null || close[i - 1] === 0) continue;
    if (volume[i]! > volume[i - 1]!) idx += idx * ((close[i]! - close[i - 1]!) / close[i - 1]!);
    out[i] = idx;
  }
  return out;
}

export function computeVpt(close: readonly Num[], volume: readonly Num[]): Num[] {
  const out = nulls(close.length);
  let acc = 0;
  if (close.length > 0) out[0] = 0;
  for (let i = 1; i < close.length; i++) {
    if (close[i] == null || close[i - 1] == null || volume[i] == null || close[i - 1] === 0) {
      out[i] = acc;
      continue;
    }
    acc += volume[i]! * ((close[i]! - close[i - 1]!) / close[i - 1]!);
    out[i] = acc;
  }
  return out;
}

export function computeVortex(high: readonly Num[], low: readonly Num[], close: readonly Num[], period: number): { viPlus: Num[]; viMinus: Num[] } {
  const n = close.length;
  const tr = nulls(n);
  const vmPlus = nulls(n);
  const vmMinus = nulls(n);

  for (let i = 1; i < n; i++) {
    if (high[i] == null || low[i] == null || high[i - 1] == null || low[i - 1] == null || close[i - 1] == null) continue;
    tr[i] = Math.max(high[i]! - low[i]!, Math.abs(high[i]! - close[i - 1]!), Math.abs(low[i]! - close[i - 1]!));
    vmPlus[i] = Math.abs(high[i]! - low[i - 1]!);
    vmMinus[i] = Math.abs(low[i]! - high[i - 1]!);
  }

  const trSum = rollingSma(tr, period).map((v) => (v == null ? null : v * period));
  const vpSum = rollingSma(vmPlus, period).map((v) => (v == null ? null : v * period));
  const vmSum = rollingSma(vmMinus, period).map((v) => (v == null ? null : v * period));
  const viPlus = nulls(n);
  const viMinus = nulls(n);

  for (let i = 0; i < n; i++) {
    if (trSum[i] == null || trSum[i] === 0 || vpSum[i] == null || vmSum[i] == null) continue;
    viPlus[i] = vpSum[i]! / trSum[i]!;
    viMinus[i] = vmSum[i]! / trSum[i]!;
  }

  return { viPlus, viMinus };
}

function lineDef(id: string, name: string, pane: 'overlay' | 'subpane', color: string, compute: (ctx: IndicatorComputeContext) => Num[]): IndicatorDefinition {
  return {
    id,
    name,
    inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
    outputs: [{ name: id, seriesType: 'Line', pane, color, lineWidth: 1 }],
    compute(ctx) {
      return { outputs: [compute(ctx)] };
    },
  };
}

export const hmaDef: IndicatorDefinition = {
  id: 'hma',
  name: 'Hull Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'hma', seriesType: 'Line', pane: 'overlay', color: '#f8c471', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 20, 20, 1);
    return { outputs: [computeHmaValues(ctx.close, p)] };
  },
};

export const demaDef: IndicatorDefinition = {
  id: 'dema',
  name: 'Double Exponential Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'dema', seriesType: 'Line', pane: 'overlay', color: '#f39c12', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 20, 20, 1);
    return { outputs: [computeDemaValues(ctx.close, p)] };
  },
};

export const temaDef: IndicatorDefinition = {
  id: 'tema',
  name: 'Triple Exponential Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'tema', seriesType: 'Line', pane: 'overlay', color: '#eb984e', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 20, 20, 1);
    return { outputs: [computeTemaValues(ctx.close, p)] };
  },
};

export const zlemaDef: IndicatorDefinition = {
  id: 'zlema',
  name: 'Zero Lag EMA',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'zlema', seriesType: 'Line', pane: 'overlay', color: '#d35400', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 20, 20, 1);
    return { outputs: [computeZlemaValues(ctx.close, p)] };
  },
};

export const kamaDef: IndicatorDefinition = {
  id: 'kama',
  name: 'Kaufman Adaptive Moving Average',
  inputs: [
    { name: 'period', label: 'ER Period', type: 'number', default: 10, min: 1, max: 200, step: 1 },
    { name: 'fast', label: 'Fast', type: 'number', default: 2, min: 1, max: 50, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 30, min: 2, max: 200, step: 1 },
  ],
  outputs: [{ name: 'kama', seriesType: 'Line', pane: 'overlay', color: '#af7ac5', lineWidth: 1 }],
  compute(ctx) {
    const period = clampInt(ctx.params.period ?? 10, 10, 1);
    const fast = clampInt(ctx.params.fast ?? 2, 2, 1);
    const slow = clampInt(ctx.params.slow ?? 30, 30, 2);
    return { outputs: [computeKamaValues(ctx.close, period, fast, slow)] };
  },
};

export const almaDef: IndicatorDefinition = {
  id: 'alma',
  name: 'Arnaud Legoux Moving Average',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 9, min: 1, max: 200, step: 1 },
    { name: 'sigma', label: 'Sigma', type: 'number', default: 6, min: 1, max: 20, step: 1 },
    { name: 'offset', label: 'Offset', type: 'number', default: 0.85, min: 0, max: 1, step: 0.01 },
  ],
  outputs: [{ name: 'alma', seriesType: 'Line', pane: 'overlay', color: '#7dcea0', lineWidth: 1 }],
  compute(ctx) {
    const period = clampInt(ctx.params.period ?? 9, 9, 1);
    const sigma = Math.max(1, Number(ctx.params.sigma ?? 6));
    const offset = Math.max(0, Math.min(1, Number(ctx.params.offset ?? 0.85)));
    return { outputs: [computeAlmaValues(ctx.close, period, sigma, offset)] };
  },
};

export const lsmaDef: IndicatorDefinition = {
  id: 'lsma',
  name: 'Linear Regression Moving Average',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 25, min: 2, max: 500, step: 1 }],
  outputs: [{ name: 'lsma', seriesType: 'Line', pane: 'overlay', color: '#58d68d', lineWidth: 1 }],
  compute(ctx) {
    const period = clampInt(ctx.params.period ?? 25, 25, 2);
    return { outputs: [computeLsmaValues(ctx.close, period)] };
  },
};

export const stochRsiDef: IndicatorDefinition = {
  id: 'stoch_rsi',
  name: 'Stochastic RSI',
  inputs: [
    { name: 'rsi', label: 'RSI Period', type: 'number', default: 14, min: 1, max: 200, step: 1 },
    { name: 'stoch', label: 'Stoch Period', type: 'number', default: 14, min: 1, max: 200, step: 1 },
    { name: 'k', label: 'K Smoothing', type: 'number', default: 3, min: 1, max: 20, step: 1 },
    { name: 'd', label: 'D Smoothing', type: 'number', default: 3, min: 1, max: 20, step: 1 },
  ],
  outputs: [
    { name: 'k', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 },
    { name: 'd', seriesType: 'Line', pane: 'subpane', color: '#ff9f43', lineWidth: 1 },
  ],
  compute(ctx) {
    const rsiPeriod = clampInt(ctx.params.rsi ?? 14, 14, 1);
    const stochPeriod = clampInt(ctx.params.stoch ?? 14, 14, 1);
    const smoothK = clampInt(ctx.params.k ?? 3, 3, 1);
    const smoothD = clampInt(ctx.params.d ?? 3, 3, 1);
    const { k, d } = computeStochRsiValues(ctx.close, rsiPeriod, stochPeriod, smoothK, smoothD);
    return { outputs: [k, d] };
  },
};

export const rviDef: IndicatorDefinition = {
  id: 'rvi',
  name: 'Relative Vigor Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 10, min: 1, max: 200, step: 1 }],
  outputs: [
    { name: 'rvi', seriesType: 'Line', pane: 'subpane', color: '#5dade2', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 },
  ],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 10, 10, 1);
    const { rvi, signal } = computeRviValues(ctx.open, ctx.high, ctx.low, ctx.close, p);
    return { outputs: [rvi, signal] };
  },
};

export const ppoDef: IndicatorDefinition = {
  id: 'ppo',
  name: 'Percentage Price Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1, max: 200, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 1, max: 200, step: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { name: 'ppo', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#ff9f43', lineWidth: 1 },
    { name: 'histogram', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(0,209,255,0.45)', base: 0 },
  ],
  compute(ctx) {
    const fast = clampInt(ctx.params.fast ?? 12, 12, 1);
    const slow = clampInt(ctx.params.slow ?? 26, 26, 1);
    const signal = clampInt(ctx.params.signal ?? 9, 9, 1);
    const { ppo, signalLine, histogram } = computePpoValues(ctx.close, fast, slow, signal);
    return { outputs: [ppo, signalLine, histogram] };
  },
};

export const pvoDef: IndicatorDefinition = {
  id: 'pvo',
  name: 'Percentage Volume Oscillator',
  inputs: [
    { name: 'fast', label: 'Fast', type: 'number', default: 12, min: 1, max: 200, step: 1 },
    { name: 'slow', label: 'Slow', type: 'number', default: 26, min: 1, max: 200, step: 1 },
    { name: 'signal', label: 'Signal', type: 'number', default: 9, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { name: 'pvo', seriesType: 'Line', pane: 'subpane', color: '#2ecc71', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 },
    { name: 'histogram', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(46,204,113,0.45)', base: 0 },
  ],
  compute(ctx) {
    const fast = clampInt(ctx.params.fast ?? 12, 12, 1);
    const slow = clampInt(ctx.params.slow ?? 26, 26, 1);
    const signal = clampInt(ctx.params.signal ?? 9, 9, 1);
    const { ppo, signalLine, histogram } = computePpoValues(ctx.volume, fast, slow, signal);
    return { outputs: [ppo, signalLine, histogram] };
  },
};

export const tsiDef: IndicatorDefinition = {
  id: 'tsi',
  name: 'True Strength Index',
  inputs: [
    { name: 'long', label: 'Long Period', type: 'number', default: 25, min: 1, max: 200, step: 1 },
    { name: 'short', label: 'Short Period', type: 'number', default: 13, min: 1, max: 200, step: 1 },
    { name: 'signal', label: 'Signal Period', type: 'number', default: 7, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { name: 'tsi', seriesType: 'Line', pane: 'subpane', color: '#af7ac5', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f7dc6f', lineWidth: 1 },
  ],
  compute(ctx) {
    const longP = clampInt(ctx.params.long ?? 25, 25, 1);
    const shortP = clampInt(ctx.params.short ?? 13, 13, 1);
    const signalP = clampInt(ctx.params.signal ?? 7, 7, 1);
    const { tsi, signal } = computeTsiValues(ctx.close, longP, shortP, signalP);
    return { outputs: [tsi, signal] };
  },
};

export const dxDef: IndicatorDefinition = {
  id: 'dx',
  name: 'Directional Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'dx', seriesType: 'Line', pane: 'subpane', color: '#f1c40f', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 14, 14, 1);
    return { outputs: [computeDxValues(ctx.high, ctx.low, ctx.close, p)] };
  },
};

export const crsiDef: IndicatorDefinition = {
  id: 'crsi',
  name: 'Connors RSI',
  inputs: [
    { name: 'rsi', label: 'RSI Period', type: 'number', default: 3, min: 1, max: 50, step: 1 },
    { name: 'streak', label: 'Streak RSI Period', type: 'number', default: 2, min: 1, max: 50, step: 1 },
    { name: 'rank', label: 'Rank Period', type: 'number', default: 100, min: 2, max: 500, step: 1 },
  ],
  outputs: [{ name: 'crsi', seriesType: 'Line', pane: 'subpane', color: '#5dade2', lineWidth: 1 }],
  compute(ctx) {
    const rsiP = clampInt(ctx.params.rsi ?? 3, 3, 1);
    const streakP = clampInt(ctx.params.streak ?? 2, 2, 1);
    const rankP = clampInt(ctx.params.rank ?? 100, 100, 2);
    return { outputs: [computeCrsiValues(ctx.close, rsiP, streakP, rankP)] };
  },
};

export const elderRayDef: IndicatorDefinition = {
  id: 'elder_ray',
  name: 'Elder Ray',
  inputs: [{ name: 'period', label: 'EMA Period', type: 'number', default: 13, min: 1, max: 200, step: 1 }],
  outputs: [
    { name: 'bull', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(46,204,113,0.45)', base: 0 },
    { name: 'bear', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(231,76,60,0.45)', base: 0 },
  ],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 13, 13, 1);
    const { bull, bear } = computeElderRayValues(ctx.high, ctx.low, ctx.close, p);
    return { outputs: [bull, bear] };
  },
};

export const cmoDef: IndicatorDefinition = {
  id: 'cmo',
  name: 'Chande Momentum Oscillator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'cmo', seriesType: 'Line', pane: 'subpane', color: '#58d68d', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 14, 14, 1);
    return { outputs: [computeCmoValues(ctx.close, p)] };
  },
};

export const fisherDef: IndicatorDefinition = {
  id: 'fisher',
  name: 'Fisher Transform',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 10, min: 2, max: 200, step: 1 }],
  outputs: [
    { name: 'fisher', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 },
    { name: 'signal', seriesType: 'Line', pane: 'subpane', color: '#f39c12', lineWidth: 1 },
  ],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 10, 10, 2);
    const { fisher, signal } = computeFisherValues(ctx.high, ctx.low, p);
    return { outputs: [fisher, signal] };
  },
};

export const kdjDef: IndicatorDefinition = {
  id: 'kdj',
  name: 'KDJ',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 9, min: 1, max: 200, step: 1 },
    { name: 'k', label: 'K Smooth', type: 'number', default: 3, min: 1, max: 20, step: 1 },
    { name: 'd', label: 'D Smooth', type: 'number', default: 3, min: 1, max: 20, step: 1 },
  ],
  outputs: [
    { name: 'k', seriesType: 'Line', pane: 'subpane', color: '#5dade2', lineWidth: 1 },
    { name: 'd', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 },
    { name: 'j', seriesType: 'Line', pane: 'subpane', color: '#af7ac5', lineWidth: 1 },
  ],
  compute(ctx) {
    const period = clampInt(ctx.params.period ?? 9, 9, 1);
    const ks = clampInt(ctx.params.k ?? 3, 3, 1);
    const ds = clampInt(ctx.params.d ?? 3, 3, 1);
    const { k, d, j } = computeKdjValues(ctx.high, ctx.low, ctx.close, period, ks, ds);
    return { outputs: [k, d, j] };
  },
};

export const bollingerPercentBDef: IndicatorDefinition = {
  id: 'bollinger_percent_b',
  name: 'Bollinger %B',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [{ name: 'pct_b', seriesType: 'Line', pane: 'subpane', color: '#00d1ff', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 20, 20, 1);
    const m = Math.max(0.1, Number(ctx.params.mult ?? 2));
    return { outputs: [computeBollingerPctB(ctx.close, p, m)] };
  },
};

export const bollingerBandwidthDef: IndicatorDefinition = {
  id: 'bollinger_bandwidth',
  name: 'Bollinger Bandwidth',
  inputs: [
    { name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 },
    { name: 'mult', label: 'Multiplier', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [{ name: 'bandwidth', seriesType: 'Line', pane: 'subpane', color: '#1abc9c', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 20, 20, 1);
    const m = Math.max(0.1, Number(ctx.params.mult ?? 2));
    return { outputs: [computeBollingerBandwidth(ctx.close, p, m)] };
  },
};

export const chaikinVolatilityDef: IndicatorDefinition = {
  id: 'chaikin_volatility',
  name: 'Chaikin Volatility',
  inputs: [
    { name: 'period', label: 'EMA Period', type: 'number', default: 10, min: 1, max: 200, step: 1 },
    { name: 'diff', label: 'Diff Period', type: 'number', default: 10, min: 1, max: 200, step: 1 },
  ],
  outputs: [{ name: 'chaikin_volatility', seriesType: 'Line', pane: 'subpane', color: '#f39c12', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 10, 10, 1);
    const d = clampInt(ctx.params.diff ?? 10, 10, 1);
    return { outputs: [computeChaikinVolatility(ctx.high, ctx.low, p, d)] };
  },
};

export const stddevDef = lineDef('stddev', 'Standard Deviation', 'subpane', '#3498db', (ctx) => {
  const p = clampInt(ctx.params.period ?? 20, 20, 1);
  return rollingStdDev(ctx.close, p);
});

export const varianceDef = lineDef('variance', 'Variance', 'subpane', '#5dade2', (ctx) => {
  const p = clampInt(ctx.params.period ?? 20, 20, 1);
  return computeVariance(ctx.close, p);
});

export const adlDef: IndicatorDefinition = {
  id: 'adl',
  name: 'Accumulation Distribution Line',
  inputs: [],
  outputs: [{ name: 'adl', seriesType: 'Line', pane: 'subpane', color: '#2ecc71', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeAdl(ctx.high, ctx.low, ctx.close, ctx.volume)] };
  },
};

export const forceIndexDef: IndicatorDefinition = {
  id: 'force_index',
  name: 'Force Index',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 13, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'force_index', seriesType: 'Histogram', pane: 'subpane', color: 'rgba(52,152,219,0.45)', base: 0 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 13, 13, 1);
    return { outputs: [computeForceIndex(ctx.close, ctx.volume, p)] };
  },
};

export const eomDef: IndicatorDefinition = {
  id: 'eom',
  name: 'Ease of Movement',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 200, step: 1 }],
  outputs: [{ name: 'eom', seriesType: 'Line', pane: 'subpane', color: '#af7ac5', lineWidth: 1 }],
  compute(ctx) {
    const p = clampInt(ctx.params.period ?? 14, 14, 1);
    return { outputs: [computeEom(ctx.high, ctx.low, ctx.volume, p)] };
  },
};

export const nviDef: IndicatorDefinition = {
  id: 'nvi',
  name: 'Negative Volume Index',
  inputs: [],
  outputs: [{ name: 'nvi', seriesType: 'Line', pane: 'subpane', color: '#1abc9c', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeNvi(ctx.close, ctx.volume)] };
  },
};

export const pviDef: IndicatorDefinition = {
  id: 'pvi',
  name: 'Positive Volume Index',
  inputs: [],
  outputs: [{ name: 'pvi', seriesType: 'Line', pane: 'subpane', color: '#f5b041', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computePvi(ctx.close, ctx.volume)] };
  },
};

export const vptDef: IndicatorDefinition = {
  id: 'vpt',
  name: 'Volume Price Trend',
  inputs: [],
  outputs: [{ name: 'vpt', seriesType: 'Line', pane: 'subpane', color: '#52be80', lineWidth: 1 }],
  compute(ctx) {
    return { outputs: [computeVpt(ctx.close, ctx.volume)] };
  },
};

export const aroonOscillatorDef: IndicatorDefinition = {
  id: 'aroon_oscillator',
  name: 'Aroon Oscillator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 25, min: 1, max: 500, step: 1 }],
  outputs: [{ name: 'aroon_oscillator', seriesType: 'Line', pane: 'subpane', color: '#3498db', lineWidth: 1 }],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const p = clampInt(ctx.params.period ?? 25, 25, 1);
    const { up, down } = computeAroonValues(ctx.high, ctx.low, p);
    const osc = nulls(ctx.close.length);
    for (let i = 0; i < osc.length; i++) {
      if (up[i] == null || down[i] == null) continue;
      osc[i] = up[i]! - down[i]!;
    }
    return { outputs: [osc] };
  },
};

export const vortexDef: IndicatorDefinition = {
  id: 'vortex',
  name: 'Vortex Indicator',
  inputs: [{ name: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 500, step: 1 }],
  outputs: [
    { name: 'vi_plus', seriesType: 'Line', pane: 'subpane', color: '#2ecc71', lineWidth: 1 },
    { name: 'vi_minus', seriesType: 'Line', pane: 'subpane', color: '#e74c3c', lineWidth: 1 },
  ],
  compute(ctx: IndicatorComputeContext): IndicatorResult {
    const p = clampInt(ctx.params.period ?? 14, 14, 1);
    const { viPlus, viMinus } = computeVortex(ctx.high, ctx.low, ctx.close, p);
    return { outputs: [viPlus, viMinus] };
  },
};
