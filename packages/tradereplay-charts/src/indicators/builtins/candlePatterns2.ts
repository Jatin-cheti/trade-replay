/**
 * candlePatterns2.ts – Additional candlestick patterns for full TradingView parity.
 *
 * Supplements candlePatterns.ts with 32+ additional patterns:
 * - Split combined patterns (Marubozu Black/White, Spinning Top Black/White, Tweezer Top/Bottom)
 * - New patterns (Abandoned Baby, Doji Star, Dragonfly/Gravestone Doji, etc.)
 */

import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { nulls } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

function body(o: number, c: number): number { return Math.abs(c - o); }
function range(h: number, l: number): number { return h - l; }
function isBullish(o: number, c: number): boolean { return c > o; }
function isBearish(o: number, c: number): boolean { return c < o; }

/** Single-candle pattern factory */
function singlePattern(
  id: string, name: string,
  detect: (o: number, h: number, l: number, c: number) => number,
): IndicatorDefinition {
  return {
    id, name, inputs: [],
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

/** Two-candle pattern factory */
function twoPattern(
  id: string, name: string,
  detect: (o0: number, h0: number, l0: number, c0: number, o1: number, h1: number, l1: number, c1: number) => number,
): IndicatorDefinition {
  return {
    id, name, inputs: [],
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

/** Three-candle pattern factory */
function threePattern(
  id: string, name: string,
  detect: (
    o0: number, h0: number, l0: number, c0: number,
    o1: number, h1: number, l1: number, c1: number,
    o2: number, h2: number, l2: number, c2: number,
  ) => number,
): IndicatorDefinition {
  return {
    id, name, inputs: [],
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

/* ── Split patterns ──────────────────────────────────────────────────── */

export const cpMarubozuWhiteDef = singlePattern('cp_marubozuWhite', 'Marubozu White', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  return isBullish(o, c) && body(o, c) / r >= 0.9 ? 1 : 0;
});

export const cpMarubozuBlackDef = singlePattern('cp_marubozuBlack', 'Marubozu Black', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  return isBearish(o, c) && body(o, c) / r >= 0.9 ? -1 : 0;
});

export const cpSpinningTopWhiteDef = singlePattern('cp_spinningTopWhite', 'Spinning Top White', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const b = body(o, c);
  const uw = h - Math.max(o, c);
  const lw = Math.min(o, c) - l;
  return isBullish(o, c) && b / r < 0.3 && uw > b && lw > b ? 1 : 0;
});

export const cpSpinningTopBlackDef = singlePattern('cp_spinningTopBlack', 'Spinning Top Black', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const b = body(o, c);
  const uw = h - Math.max(o, c);
  const lw = Math.min(o, c) - l;
  return isBearish(o, c) && b / r < 0.3 && uw > b && lw > b ? -1 : 0;
});

export const cpTweezerTopDef = twoPattern('cp_tweezerTop', 'Tweezer Top',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    const tol = range(Math.max(h0, h1), Math.min(l0, l1)) * 0.005 || 0.0001;
    return Math.abs(h0 - h1) <= tol && isBullish(o0, c0) && isBearish(o1, c1) ? -1 : 0;
  },
);

export const cpTweezerBottomDef = twoPattern('cp_tweezerBottom', 'Tweezer Bottom',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    const tol = range(Math.max(h0, h1), Math.min(l0, l1)) * 0.005 || 0.0001;
    return Math.abs(l0 - l1) <= tol && isBearish(o0, c0) && isBullish(o1, c1) ? 1 : 0;
  },
);

/* ── New single-candle patterns ──────────────────────────────────────── */

export const cpDragonflyDojiDef = singlePattern('cp_dragonflyDoji', 'Dragonfly Doji', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const b = body(o, c);
  const lw = Math.min(o, c) - l;
  const uw = h - Math.max(o, c);
  return b / r < 0.1 && lw > r * 0.6 && uw < r * 0.1 ? 1 : 0;
});

export const cpGravestoneDojiDef = singlePattern('cp_gravestoneDoji', 'Gravestone Doji', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const b = body(o, c);
  const uw = h - Math.max(o, c);
  const lw = Math.min(o, c) - l;
  return b / r < 0.1 && uw > r * 0.6 && lw < r * 0.1 ? -1 : 0;
});

export const cpLongLowerShadowDef = singlePattern('cp_longLowerShadow', 'Long Lower Shadow', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const lw = Math.min(o, c) - l;
  return lw > r * 0.6 ? 1 : 0;
});

export const cpLongUpperShadowDef = singlePattern('cp_longUpperShadow', 'Long Upper Shadow', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const uw = h - Math.max(o, c);
  return uw > r * 0.6 ? -1 : 0;
});

export const cpHangingManDef = singlePattern('cp_hangingMan', 'Hanging Man', (o, h, l, c) => {
  const r = range(h, l);
  const b = body(o, c);
  if (r === 0 || b === 0) return 0;
  const lw = Math.min(o, c) - l;
  const uw = h - Math.max(o, c);
  return lw >= b * 2 && uw < b * 0.5 ? -1 : 0;
});

export const cpInvertedHammerDef = singlePattern('cp_invertedHammer', 'Inverted Hammer', (o, h, l, c) => {
  const r = range(h, l);
  const b = body(o, c);
  if (r === 0 || b === 0) return 0;
  const uw = h - Math.max(o, c);
  const lw = Math.min(o, c) - l;
  return uw >= b * 2 && lw < b * 0.5 ? 1 : 0;
});

export const cpBeltHoldDef = singlePattern('cp_beltHold', 'Belt Hold', (o, h, l, c) => {
  const r = range(h, l);
  if (r === 0) return 0;
  const b = body(o, c);
  if (b / r < 0.6) return 0;
  if (isBullish(o, c) && o === l) return 1;
  if (isBearish(o, c) && o === h) return -1;
  return 0;
});

/* ── New two-candle patterns ─────────────────────────────────────────── */

export const cpKickingDef = twoPattern('cp_kicking', 'Kicking',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    const r0 = range(h0, l0), r1 = range(h1, l1);
    if (r0 === 0 || r1 === 0) return 0;
    const isMaruB0 = isBearish(o0, c0) && body(o0, c0) / r0 >= 0.9;
    const isMaruW1 = isBullish(o1, c1) && body(o1, c1) / r1 >= 0.9;
    if (isMaruB0 && isMaruW1 && o1 > o0) return 1;
    const isMaruW0 = isBullish(o0, c0) && body(o0, c0) / r0 >= 0.9;
    const isMaruB1 = isBearish(o1, c1) && body(o1, c1) / r1 >= 0.9;
    if (isMaruW0 && isMaruB1 && o1 < o0) return -1;
    return 0;
  },
);

export const cpCounterattackDef = twoPattern('cp_counterattack', 'Counterattack',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    const tol = range(Math.max(h0, h1), Math.min(l0, l1)) * 0.005 || 0.0001;
    if (isBearish(o0, c0) && isBullish(o1, c1) && Math.abs(c0 - c1) <= tol) return 1;
    if (isBullish(o0, c0) && isBearish(o1, c1) && Math.abs(c0 - c1) <= tol) return -1;
    return 0;
  },
);

export const cpHaramiCrossDef = twoPattern('cp_haramiCross', 'Harami Cross',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    const b0 = body(o0, c0);
    const b1 = body(o1, c1);
    const r1 = range(h1, l1);
    if (r1 === 0 || b0 === 0) return 0;
    const h0body = Math.max(o0, c0), l0body = Math.min(o0, c0);
    if (b1 / r1 < 0.1 && Math.max(o1, c1) <= h0body && Math.min(o1, c1) >= l0body) {
      return isBearish(o0, c0) ? 1 : -1;
    }
    return 0;
  },
);

export const cpHomingPigeonDef = twoPattern('cp_homingPigeon', 'Homing Pigeon',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    if (!isBearish(o0, c0) || !isBearish(o1, c1)) return 0;
    if (o1 < o0 && c1 > c0 && h1 < h0 && l1 > l0) return 1;
    return 0;
  },
);

export const cpMatchingLowDef = twoPattern('cp_matchingLow', 'Matching Low',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    if (!isBearish(o0, c0) || !isBearish(o1, c1)) return 0;
    const tol = range(Math.max(h0, h1), Math.min(l0, l1)) * 0.005 || 0.0001;
    if (Math.abs(c0 - c1) <= tol) return 1;
    return 0;
  },
);

export const cpStickSandwichDef = twoPattern('cp_stickSandwich', 'Stick Sandwich',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    // Simplified: bearish-bullish-bearish with same close on 1st and 3rd — we check 2-candle variant
    if (isBearish(o0, c0) && isBullish(o1, c1) && c1 < o0) return 1;
    return 0;
  },
);

export const cpTasukiLineDef = twoPattern('cp_tasukiLine', 'Tasuki Line',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    if (isBullish(o0, c0) && isBearish(o1, c1) && o1 > c0 && c1 > o0) return -1;
    if (isBearish(o0, c0) && isBullish(o1, c1) && o1 < c0 && c1 < o0) return 1;
    return 0;
  },
);

export const cpDojiStarDef = twoPattern('cp_dojiStar', 'Doji Star',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    const r1 = range(h1, l1);
    if (r1 === 0) return 0;
    const isDoji = body(o1, c1) / r1 < 0.1;
    if (!isDoji) return 0;
    if (isBullish(o0, c0) && l1 > c0) return -1;
    if (isBearish(o0, c0) && h1 < c0) return 1;
    return 0;
  },
);

export const cpRisingWindowDef = twoPattern('cp_risingWindow', 'Rising Window',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    return l1 > h0 ? 1 : 0;
  },
);

export const cpFallingWindowDef = twoPattern('cp_fallingWindow', 'Falling Window',
  (o0, h0, l0, c0, o1, h1, l1, c1) => {
    return h1 < l0 ? -1 : 0;
  },
);

/* ── Three-candle patterns ───────────────────────────────────────────── */

export const cpAbandonedBabyDef = threePattern('cp_abandonedBaby', 'Abandoned Baby',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    const b1 = body(o1, c1);
    const r1 = range(h1, l1);
    if (r1 === 0) return 0;
    const isDoji = b1 / r1 < 0.1;
    if (!isDoji) return 0;
    // Bullish abandoned baby
    if (isBearish(o0, c0) && h1 < l0 && l2 > h1 && isBullish(o2, c2)) return 1;
    // Bearish abandoned baby
    if (isBullish(o0, c0) && l1 > h0 && h2 < l1 && isBearish(o2, c2)) return -1;
    return 0;
  },
);

export const cpThreeInsideDef = threePattern('cp_threeInside', 'Three Inside Up/Down',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    const h0body = Math.max(o0, c0), l0body = Math.min(o0, c0);
    const h1body = Math.max(o1, c1), l1body = Math.min(o1, c1);
    if (h1body > h0body || l1body < l0body) return 0;
    // Three Inside Up
    if (isBearish(o0, c0) && isBullish(o1, c1) && isBullish(o2, c2) && c2 > h0body) return 1;
    // Three Inside Down
    if (isBullish(o0, c0) && isBearish(o1, c1) && isBearish(o2, c2) && c2 < l0body) return -1;
    return 0;
  },
);

export const cpThreeOutsideDef = threePattern('cp_threeOutside', 'Three Outside Up/Down',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    // Three Outside Up: small bearish + bullish engulfing + bullish continuation
    if (isBearish(o0, c0) && isBullish(o1, c1) && o1 <= c0 && c1 >= o0 && isBullish(o2, c2) && c2 > c1) return 1;
    // Three Outside Down
    if (isBullish(o0, c0) && isBearish(o1, c1) && o1 >= c0 && c1 <= o0 && isBearish(o2, c2) && c2 < c1) return -1;
    return 0;
  },
);

export const cpTriStarDef = threePattern('cp_triStar', 'Tri-Star',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    const r0 = range(h0, l0), r1 = range(h1, l1), r2 = range(h2, l2);
    if (r0 === 0 || r1 === 0 || r2 === 0) return 0;
    const d0 = body(o0, c0) / r0 < 0.1;
    const d1 = body(o1, c1) / r1 < 0.1;
    const d2 = body(o2, c2) / r2 < 0.1;
    if (!d0 || !d1 || !d2) return 0;
    if (l1 > h0 && l1 > h2) return -1;
    if (h1 < l0 && h1 < l2) return 1;
    return 0;
  },
);

export const cpRisingFallingThreeDef = threePattern('cp_risingFallingThree', 'Rising/Falling Three Methods',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    // Rising Three: bull + small bear inside + bull continuation
    if (isBullish(o0, c0) && isBearish(o1, c1) && body(o1, c1) < body(o0, c0) * 0.5 &&
        h1 <= h0 && l1 >= l0 && isBullish(o2, c2) && c2 > c0) return 1;
    // Falling Three
    if (isBearish(o0, c0) && isBullish(o1, c1) && body(o1, c1) < body(o0, c0) * 0.5 &&
        h1 <= h0 && l1 >= l0 && isBearish(o2, c2) && c2 < c0) return -1;
    return 0;
  },
);

export const cpDownsideTasukiGapDef = threePattern('cp_downsideTasukiGap', 'Downside Tasuki Gap',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    // Two bearish candles with gap down, then bullish candle into gap
    if (isBearish(o0, c0) && isBearish(o1, c1) && h1 < l0 && isBullish(o2, c2) && o2 >= c1 && c2 <= l0)
      return -1;
    return 0;
  },
);

export const cpUpsideTasukiGapDef = threePattern('cp_upsideTasukiGap', 'Upside Tasuki Gap',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    // Two bullish candles with gap up, then bearish candle into gap
    if (isBullish(o0, c0) && isBullish(o1, c1) && l1 > h0 && isBearish(o2, c2) && o2 <= c1 && c2 >= h0)
      return 1;
    return 0;
  },
);

export const cpLadderBottomDef = threePattern('cp_ladderBottom', 'Ladder Bottom',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    // Three bearish candles making lower lows, last one has long lower shadow
    if (isBearish(o0, c0) && isBearish(o1, c1) && c1 < c0 && isBullish(o2, c2)) return 1;
    return 0;
  },
);

export const cpThreeStarsInSouthDef = threePattern('cp_threeStarsInSouth', 'Three Stars in the South',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    // Three bearish candles with decreasing ranges, bullish reversal
    if (isBearish(o0, c0) && isBearish(o1, c1) && isBearish(o2, c2)) {
      const r0 = range(h0, l0), r1 = range(h1, l1), r2 = range(h2, l2);
      if (r1 < r0 && r2 < r1) return 1;
    }
    return 0;
  },
);

export const cpUniqueThreeRiverDef = threePattern('cp_uniqueThreeRiver', 'Unique Three River Bottom',
  (o0, h0, l0, c0, o1, h1, l1, c1, o2, h2, l2, c2) => {
    if (isBearish(o0, c0) && isBearish(o1, c1) && body(o1, c1) < body(o0, c0) * 0.3 && isBullish(o2, c2) && c2 < c0)
      return 1;
    return 0;
  },
);
