import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { nulls } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

/** Helpers for body/wick ratios */
function body(o: number, c: number): number {
  return Math.abs(c - o);
}
function range(h: number, l: number): number {
  return h - l;
}
function isBullish(o: number, c: number): boolean {
  return c > o;
}
function isBearish(o: number, c: number): boolean {
  return c < o;
}

/** Generic single-candle pattern factory */
function singlePattern(
  id: string,
  name: string,
  desc: string,
  detect: (o: number, h: number, l: number, c: number) => number,
): IndicatorDefinition {
  return {
    id,
    name,
    inputs: [],
    outputs: [{ name: 'signal', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
    compute({ open, high, low, close }) {
      const n = close.length;
      const out = nulls(n);
      for (let i = 0; i < n; i++) {
        const o = open[i], h = high[i], l = low[i], c = close[i];
        if (o == null || h == null || l == null || c == null) continue;
        const v = detect(o, h, l, c);
        if (v !== 0) out[i] = v;
      }
      return toResult(out);
    },
  };
}

/** Generic two-candle pattern factory */
function twoPattern(
  id: string,
  name: string,
  desc: string,
  detect: (o0: number, h0: number, l0: number, c0: number, o1: number, h1: number, l1: number, c1: number) => number,
): IndicatorDefinition {
  return {
    id,
    name,
    inputs: [],
    outputs: [{ name: 'signal', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
    compute({ open, high, low, close }) {
      const n = close.length;
      const out = nulls(n);
      for (let i = 1; i < n; i++) {
        const o0 = open[i - 1], h0 = high[i - 1], l0 = low[i - 1], c0 = close[i - 1];
        const o1 = open[i], h1 = high[i], l1 = low[i], c1 = close[i];
        if (o0 == null || h0 == null || l0 == null || c0 == null) continue;
        if (o1 == null || h1 == null || l1 == null || c1 == null) continue;
        const v = detect(o0, h0, l0, c0, o1, h1, l1, c1);
        if (v !== 0) out[i] = v;
      }
      return toResult(out);
    },
  };
}

/** Generic three-candle pattern factory */
function threePattern(
  id: string,
  name: string,
  desc: string,
  detect: (
    o0: number, h0: number, l0: number, c0: number,
    o1: number, h1: number, l1: number, c1: number,
    o2: number, h2: number, l2: number, c2: number,
  ) => number,
): IndicatorDefinition {
  return {
    id,
    name,
    inputs: [],
    outputs: [{ name: 'signal', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
    compute({ open, high, low, close }) {
      const n = close.length;
      const out = nulls(n);
      for (let i = 2; i < n; i++) {
        const o0 = open[i - 2], h0 = high[i - 2], l0 = low[i - 2], c0 = close[i - 2];
        const o1 = open[i - 1], h1 = high[i - 1], l1 = low[i - 1], c1 = close[i - 1];
        const o2 = open[i], h2 = high[i], l2 = low[i], c2 = close[i];
        if (o0 == null || h0 == null || l0 == null || c0 == null) continue;
        if (o1 == null || h1 == null || l1 == null || c1 == null) continue;
        if (o2 == null || h2 == null || l2 == null || c2 == null) continue;
        const v = detect(o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2);
        if (v !== 0) out[i] = v;
      }
      return toResult(out);
    },
  };
}

/* ── Doji ─────────────────────────────────────────────────────────────── */
export const cpDojiDef = singlePattern('cp_doji', 'Doji', 'Indecision candle', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  return body(o, c) / r < 0.1 ? 1 : 0;
});

/* ── Hammer ───────────────────────────────────────────────────────────── */
export const cpHammerDef = singlePattern('cp_hammer', 'Hammer', 'Bullish reversal', (o, h, l, c) => {
  const r = range(h, l);
  const b = body(o, c);
  if (r === 0 || b === 0) return 0;
  const lowerWick = Math.min(o, c) - l;
  const upperWick = h - Math.max(o, c);
  return lowerWick >= b * 2 && upperWick < b * 0.5 ? 1 : 0;
});

/* ── Shooting Star ───────────────────────────────────────────────────── */
export const cpShootingStarDef = singlePattern('cp_shootingStar', 'Shooting Star', 'Bearish reversal', (o, h, l, c) => {
  const r = range(h, l);
  const b = body(o, c);
  if (r === 0 || b === 0) return 0;
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;
  return upperWick >= b * 2 && lowerWick < b * 0.5 ? -1 : 0;
});

/* ── Engulfing ───────────────────────────────────────────────────────── */
export const cpEngulfingDef = twoPattern('cp_engulfing', 'Engulfing', 'Bullish/bearish engulfing',
  (o0, _h0, _l0, c0, o1, _h1, _l1, c1) => {
    if (isBearish(o0, c0) && isBullish(o1, c1) && o1 <= c0 && c1 >= o0) return 1;
    if (isBullish(o0, c0) && isBearish(o1, c1) && o1 >= c0 && c1 <= o0) return -1;
    return 0;
  },
);

/* ── Morning Star ────────────────────────────────────────────────────── */
export const cpMorningStarDef = threePattern('cp_morningStar', 'Morning Star', 'Bullish 3-candle reversal',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    const b0 = body(o0, c0);
    const b1 = body(o1, c1);
    const r0 = range(h0, l0);
    if (r0 === 0) return 0;
    return isBearish(o0, c0) && b0 > r0 * 0.4 && b1 < b0 * 0.3 && isBullish(o2, c2) && c2 > (o0 + c0) / 2 ? 1 : 0;
  },
);

/* ── Evening Star ────────────────────────────────────────────────────── */
export const cpEveningStarDef = threePattern('cp_eveningStar', 'Evening Star', 'Bearish 3-candle reversal',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    const b0 = body(o0, c0);
    const b1 = body(o1, c1);
    const r0 = range(h0, l0);
    if (r0 === 0) return 0;
    return isBullish(o0, c0) && b0 > r0 * 0.4 && b1 < b0 * 0.3 && isBearish(o2, c2) && c2 < (o0 + c0) / 2 ? -1 : 0;
  },
);

/* ── Harami ──────────────────────────────────────────────────────────── */
export const cpHaramiDef = twoPattern('cp_harami', 'Harami', 'Inside bar reversal',
  (o0, _h0, _l0, c0, o1, _h1, _l1, c1) => {
    const h0body = Math.max(o0, c0);
    const l0body = Math.min(o0, c0);
    const h1body = Math.max(o1, c1);
    const l1body = Math.min(o1, c1);
    if (h1body > h0body || l1body < l0body) return 0;
    if (body(o1, c1) >= body(o0, c0) * 0.8) return 0;
    if (isBearish(o0, c0) && isBullish(o1, c1)) return 1;
    if (isBullish(o0, c0) && isBearish(o1, c1)) return -1;
    return 0;
  },
);

/* ── Three White Soldiers ────────────────────────────────────────────── */
export const cpThreeWhiteSoldiersDef = threePattern('cp_threeWhiteSoldiers', 'Three White Soldiers', 'Strong bullish',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    if (!isBullish(o0, c0) || !isBullish(o1, c1) || !isBullish(o2, c2)) return 0;
    if (c1 <= c0 || c2 <= c1) return 0;
    if (o1 < o0 || o1 > c0) return 0;
    if (o2 < o1 || o2 > c1) return 0;
    const r0 = range(h0, l0), r1 = range(h1, l1), r2 = range(h2, l2);
    if (r0 === 0 || r1 === 0 || r2 === 0) return 0;
    if (body(o0, c0) / r0 < 0.5 || body(o1, c1) / r1 < 0.5 || body(o2, c2) / r2 < 0.5) return 0;
    return 1;
  },
);

/* ── Three Black Crows ──────────────────────────────────────────────── */
export const cpThreeBlackCrowsDef = threePattern('cp_threeBlackCrows', 'Three Black Crows', 'Strong bearish',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    if (!isBearish(o0, c0) || !isBearish(o1, c1) || !isBearish(o2, c2)) return 0;
    if (c1 >= c0 || c2 >= c1) return 0;
    if (o1 > o0 || o1 < c0) return 0;
    if (o2 > o1 || o2 < c1) return 0;
    const r0 = range(h0, l0), r1 = range(h1, l1), r2 = range(h2, l2);
    if (r0 === 0 || r1 === 0 || r2 === 0) return 0;
    if (body(o0, c0) / r0 < 0.5 || body(o1, c1) / r1 < 0.5 || body(o2, c2) / r2 < 0.5) return 0;
    return -1;
  },
);

/* ── Spinning Top ────────────────────────────────────────────────────── */
export const cpSpinningTopDef = singlePattern('cp_spinningTop', 'Spinning Top', 'Indecision', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const b = body(o, c);
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;
  return b / r < 0.3 && upperWick > b && lowerWick > b ? 1 : 0;
});

/* ── Marubozu ────────────────────────────────────────────────────────── */
export const cpMarubozuDef = singlePattern('cp_marubozu', 'Marubozu', 'Full-body candle', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const b = body(o, c);
  if (b / r < 0.9) return 0;
  return isBullish(o, c) ? 1 : -1;
});

/* ── Piercing Line ───────────────────────────────────────────────────── */
export const cpPiercingLineDef = twoPattern('cp_piercingLine', 'Piercing Line', 'Bullish reversal',
  (o0, _h0, _l0, c0, o1, _h1, _l1, c1) => {
    if (!isBearish(o0, c0) || !isBullish(o1, c1)) return 0;
    if (o1 >= c0) return 0;
    const mid0 = (o0 + c0) / 2;
    return c1 > mid0 && c1 < o0 ? 1 : 0;
  },
);

/* ── Dark Cloud Cover ────────────────────────────────────────────────── */
export const cpDarkCloudDef = twoPattern('cp_darkCloud', 'Dark Cloud Cover', 'Bearish reversal',
  (o0, _h0, _l0, c0, o1, _h1, _l1, c1) => {
    if (!isBullish(o0, c0) || !isBearish(o1, c1)) return 0;
    if (o1 <= c0) return 0;
    const mid0 = (o0 + c0) / 2;
    return c1 < mid0 && c1 > o0 ? -1 : 0;
  },
);

/* ── Tweezer Top/Bottom ──────────────────────────────────────────────── */
export const cpTweezerDef = twoPattern('cp_tweezer', 'Tweezer Top/Bottom', 'Same high/low',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    const tol = range(Math.max(h0, h1), Math.min(l0, l1)) * 0.005 || 0.0001;
    // Tweezer top: same high, first bull then bear
    if (Math.abs(h0 - h1) <= tol && isBullish(o0, c0) && isBearish(o1, c1)) return -1;
    // Tweezer bottom: same low, first bear then bull
    if (Math.abs(l0 - l1) <= tol && isBearish(o0, c0) && isBullish(o1, c1)) return 1;
    return 0;
  },
);
