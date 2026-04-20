/**
 * chartPatterns.ts – TradingView-style Chart Pattern detection.
 *
 * Each pattern detects geometric shapes (triangles, wedges, head & shoulders, etc.)
 * using OHLCV data and outputs signal markers (+1 bullish, -1 bearish).
 */

import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { clampInt, nulls, rollingExtrema } from './_helpers.ts';

type Num = number | null;

function toResult(...outputs: Num[][]): IndicatorResult {
  return { outputs };
}

function chartPatternDef(
  id: string,
  name: string,
  inputs: IndicatorDefinition['inputs'],
  compute: IndicatorDefinition['compute'],
): IndicatorDefinition {
  return {
    id,
    name,
    inputs,
    outputs: [{ name: 'signal', seriesType: 'Histogram', pane: 'subpane', color: '#f59e0b' }],
    compute,
  };
}

function pivotBars(lb: number) {
  return [{ name: 'leftBars', label: 'Left Bars', type: 'number' as const, default: lb, min: 2 },
          { name: 'rightBars', label: 'Right Bars', type: 'number' as const, default: lb, min: 2 }];
}

/** Generic pivot detection helper */
function findPivots(
  high: readonly Num[], low: readonly Num[],
  leftBars: number, rightBars: number,
): { pivotHighs: { idx: number; val: number }[]; pivotLows: { idx: number; val: number }[] } {
  const n = high.length;
  const pivotHighs: { idx: number; val: number }[] = [];
  const pivotLows: { idx: number; val: number }[] = [];
  for (let i = leftBars; i < n - rightBars; i++) {
    const h = high[i], l = low[i];
    if (h == null || l == null) continue;
    let isHigh = true, isLow = true;
    for (let j = 1; j <= leftBars; j++) {
      if (high[i - j] == null || high[i - j]! >= h) isHigh = false;
      if (low[i - j] == null || low[i - j]! <= l) isLow = false;
    }
    for (let j = 1; j <= rightBars; j++) {
      if (high[i + j] == null || high[i + j]! >= h) isHigh = false;
      if (low[i + j] == null || low[i + j]! <= l) isLow = false;
    }
    if (isHigh) pivotHighs.push({ idx: i, val: h });
    if (isLow) pivotLows.push({ idx: i, val: l });
  }
  return { pivotHighs, pivotLows };
}

/* Head and Shoulders */
const headAndShouldersDef = chartPatternDef('pat_headAndShoulders', 'Head and Shoulders',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs } = findPivots(high, low, lb, rb);
    for (let i = 2; i < pivotHighs.length; i++) {
      const left = pivotHighs[i - 2], head = pivotHighs[i - 1], right = pivotHighs[i];
      if (head.val > left.val && head.val > right.val && Math.abs(left.val - right.val) / head.val < 0.03) {
        out[right.idx] = -1;
      }
    }
    return toResult(out);
  },
);

/* Inverse Head and Shoulders */
const inverseHeadShouldersDef = chartPatternDef('pat_inverseHeadShoulders', 'Inverse Head and Shoulders',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = low.length;
    const out = nulls(n);
    const { pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 2; i < pivotLows.length; i++) {
      const left = pivotLows[i - 2], head = pivotLows[i - 1], right = pivotLows[i];
      if (head.val < left.val && head.val < right.val && Math.abs(left.val - right.val) / head.val < 0.03) {
        out[right.idx] = 1;
      }
    }
    return toResult(out);
  },
);

/* Double Top */
const doubleTopDef = chartPatternDef('pat_doubleTop', 'Double Top',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs } = findPivots(high, low, lb, rb);
    for (let i = 1; i < pivotHighs.length; i++) {
      const first = pivotHighs[i - 1], second = pivotHighs[i];
      if (Math.abs(first.val - second.val) / first.val < 0.02 && second.idx - first.idx >= lb * 2) {
        out[second.idx] = -1;
      }
    }
    return toResult(out);
  },
);

/* Double Bottom */
const doubleBottomDef = chartPatternDef('pat_doubleBottom', 'Double Bottom',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = low.length;
    const out = nulls(n);
    const { pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 1; i < pivotLows.length; i++) {
      const first = pivotLows[i - 1], second = pivotLows[i];
      if (Math.abs(first.val - second.val) / first.val < 0.02 && second.idx - first.idx >= lb * 2) {
        out[second.idx] = 1;
      }
    }
    return toResult(out);
  },
);

/* Triple Top */
const tripleTopDef = chartPatternDef('pat_tripleTop', 'Triple Top',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs } = findPivots(high, low, lb, rb);
    for (let i = 2; i < pivotHighs.length; i++) {
      const a = pivotHighs[i - 2], b = pivotHighs[i - 1], c = pivotHighs[i];
      const avg = (a.val + b.val + c.val) / 3;
      if (Math.abs(a.val - avg) / avg < 0.02 && Math.abs(b.val - avg) / avg < 0.02 && Math.abs(c.val - avg) / avg < 0.02) {
        out[c.idx] = -1;
      }
    }
    return toResult(out);
  },
);

/* Triple Bottom */
const tripleBottomDef = chartPatternDef('pat_tripleBottom', 'Triple Bottom',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = low.length;
    const out = nulls(n);
    const { pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 2; i < pivotLows.length; i++) {
      const a = pivotLows[i - 2], b = pivotLows[i - 1], c = pivotLows[i];
      const avg = (a.val + b.val + c.val) / 3;
      if (Math.abs(a.val - avg) / avg < 0.02 && Math.abs(b.val - avg) / avg < 0.02 && Math.abs(c.val - avg) / avg < 0.02) {
        out[c.idx] = 1;
      }
    }
    return toResult(out);
  },
);

/* Ascending Triangle */
const ascTriangleDef = chartPatternDef('pat_ascendingTriangle', 'Ascending Triangle',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs, pivotLows } = findPivots(high, low, lb, rb);
    // Flat highs + rising lows
    for (let i = 1; i < Math.min(pivotHighs.length, pivotLows.length); i++) {
      const h1 = pivotHighs[i - 1], h2 = pivotHighs[i];
      if (Math.abs(h1.val - h2.val) / h1.val < 0.015) {
        // Find corresponding rising lows
        for (let j = 1; j < pivotLows.length; j++) {
          const l1 = pivotLows[j - 1], l2 = pivotLows[j];
          if (l2.val > l1.val && l2.idx > h1.idx && l2.idx <= h2.idx) {
            out[h2.idx] = 1;
            break;
          }
        }
      }
    }
    return toResult(out);
  },
);

/* Descending Triangle */
const descTriangleDef = chartPatternDef('pat_descendingTriangle', 'Descending Triangle',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs, pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 1; i < Math.min(pivotHighs.length, pivotLows.length); i++) {
      const l1 = pivotLows[i - 1], l2 = pivotLows[i];
      if (Math.abs(l1.val - l2.val) / l1.val < 0.015) {
        for (let j = 1; j < pivotHighs.length; j++) {
          const h1 = pivotHighs[j - 1], h2 = pivotHighs[j];
          if (h2.val < h1.val && h2.idx > l1.idx && h2.idx <= l2.idx) {
            out[l2.idx] = -1;
            break;
          }
        }
      }
    }
    return toResult(out);
  },
);

/* Symmetrical Triangle */
const symTriangleDef = chartPatternDef('pat_symmetricalTriangle', 'Symmetrical Triangle',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs, pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 1; i < pivotHighs.length && i < pivotLows.length; i++) {
      const h1 = pivotHighs[i - 1], h2 = pivotHighs[i];
      const l1 = pivotLows[i - 1], l2 = pivotLows[i];
      if (h2.val < h1.val && l2.val > l1.val) {
        out[Math.max(h2.idx, l2.idx)] = 1;
      }
    }
    return toResult(out);
  },
);

/* Rising Wedge */
const risingWedgeDef = chartPatternDef('pat_risingWedge', 'Rising Wedge',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs, pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 1; i < pivotHighs.length && i < pivotLows.length; i++) {
      const h1 = pivotHighs[i - 1], h2 = pivotHighs[i];
      const l1 = pivotLows[i - 1], l2 = pivotLows[i];
      if (h2.val > h1.val && l2.val > l1.val) {
        const hSlope = (h2.val - h1.val) / (h2.idx - h1.idx);
        const lSlope = (l2.val - l1.val) / (l2.idx - l1.idx);
        if (lSlope > hSlope) out[Math.max(h2.idx, l2.idx)] = -1;
      }
    }
    return toResult(out);
  },
);

/* Falling Wedge */
const fallingWedgeDef = chartPatternDef('pat_fallingWedge', 'Falling Wedge',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs, pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 1; i < pivotHighs.length && i < pivotLows.length; i++) {
      const h1 = pivotHighs[i - 1], h2 = pivotHighs[i];
      const l1 = pivotLows[i - 1], l2 = pivotLows[i];
      if (h2.val < h1.val && l2.val < l1.val) {
        const hSlope = Math.abs(h2.val - h1.val) / (h2.idx - h1.idx);
        const lSlope = Math.abs(l2.val - l1.val) / (l2.idx - l1.idx);
        if (hSlope > lSlope) out[Math.max(h2.idx, l2.idx)] = 1;
      }
    }
    return toResult(out);
  },
);

/* Bull Flag */
const bullFlagDef = chartPatternDef('pat_bullFlag', 'Bull Flag',
  [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 5 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20, 5);
    const n = close.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      if (!close[i] || !close[i - p]) continue;
      const halfP = Math.floor(p / 2);
      // First half: strong uptrend
      let firstHalfUp = true;
      for (let j = i - p; j < i - halfP; j++) {
        if (close[j + 1] == null || close[j] == null) continue;
        if (close[j + 1]! < close[j]!) { firstHalfUp = false; break; }
      }
      if (!firstHalfUp) continue;
      // Second half: gentle pullback (lower highs, higher lows)
      let flag = true;
      let maxH = -Infinity, minL = Infinity;
      for (let j = i - halfP; j <= i; j++) {
        if (high[j] != null) maxH = Math.max(maxH, high[j]!);
        if (low[j] != null) minL = Math.min(minL, low[j]!);
      }
      const flagRange = maxH - minL;
      const poleRange = (high[i - halfP] ?? 0) - (low[i - p] ?? 0);
      if (flagRange < poleRange * 0.5 && close[i]! > close[i - 1]!) out[i] = 1;
    }
    return toResult(out);
  },
);

/* Bear Flag */
const bearFlagDef = chartPatternDef('pat_bearFlag', 'Bear Flag',
  [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 5 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20, 5);
    const n = close.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      if (!close[i] || !close[i - p]) continue;
      const halfP = Math.floor(p / 2);
      let firstHalfDown = true;
      for (let j = i - p; j < i - halfP; j++) {
        if (close[j + 1] == null || close[j] == null) continue;
        if (close[j + 1]! > close[j]!) { firstHalfDown = false; break; }
      }
      if (!firstHalfDown) continue;
      let maxH = -Infinity, minL = Infinity;
      for (let j = i - halfP; j <= i; j++) {
        if (high[j] != null) maxH = Math.max(maxH, high[j]!);
        if (low[j] != null) minL = Math.min(minL, low[j]!);
      }
      const flagRange = maxH - minL;
      const poleRange = (high[i - p] ?? 0) - (low[i - halfP] ?? 0);
      if (flagRange < poleRange * 0.5 && close[i]! < close[i - 1]!) out[i] = -1;
    }
    return toResult(out);
  },
);

/* Pennant */
const pennantDef = chartPatternDef('pat_pennant', 'Pennant',
  [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 5 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 20, 5);
    const n = close.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      const halfP = Math.floor(p / 2);
      let converging = true;
      const startRange = (high[i - halfP] ?? 0) - (low[i - halfP] ?? 0);
      const endRange = (high[i] ?? 0) - (low[i] ?? 0);
      if (endRange < startRange * 0.5 && close[i] != null && close[i - 1] != null) {
        out[i] = close[i]! > close[i - 1]! ? 1 : -1;
      }
    }
    return toResult(out);
  },
);

/* Rectangle */
const rectangleDef = chartPatternDef('pat_rectangle', 'Rectangle',
  [{ name: 'period', label: 'Period', type: 'number', default: 30, min: 10 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 30, 10);
    const n = close.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      let hh: number | null = null, ll: number | null = null;
      for (let j = i - p; j <= i; j++) {
        if (high[j] != null) hh = hh == null ? high[j]! : Math.max(hh, high[j]!);
        if (low[j] != null) ll = ll == null ? low[j]! : Math.min(ll, low[j]!);
      }
      if (hh == null || ll == null || hh === ll) continue;
      // Check if breakout
      if (close[i] != null && close[i]! > hh) out[i] = 1;
      else if (close[i] != null && close[i]! < ll) out[i] = -1;
    }
    return toResult(out);
  },
);

/* Cup and Handle */
const cupAndHandleDef = chartPatternDef('pat_cupAndHandle', 'Cup and Handle',
  [{ name: 'period', label: 'Period', type: 'number', default: 50, min: 20 }],
  ({ high, low, close, params }) => {
    const p = clampInt(params.period, 50, 20);
    const n = close.length;
    const out = nulls(n);
    for (let i = p; i < n; i++) {
      if (!close[i]) continue;
      // Find the lowest point in the cup
      let minIdx = i - p, minVal = Infinity;
      for (let j = i - p; j <= i; j++) {
        if (low[j] != null && low[j]! < minVal) { minVal = low[j]!; minIdx = j; }
      }
      // Cup should be roughly in the middle
      const leftRim = close[i - p] ?? 0;
      const rightRim = close[i] ?? 0;
      if (Math.abs(leftRim - rightRim) / leftRim < 0.03 && rightRim > minVal * 1.05) {
        out[i] = 1;
      }
    }
    return toResult(out);
  },
);

/* Broadening Pattern */
const broadeningDef = chartPatternDef('pat_broadening', 'Broadening Pattern',
  pivotBars(5),
  ({ high, low, params }) => {
    const lb = clampInt(params.leftBars, 5, 2);
    const rb = clampInt(params.rightBars, 5, 2);
    const n = high.length;
    const out = nulls(n);
    const { pivotHighs, pivotLows } = findPivots(high, low, lb, rb);
    for (let i = 1; i < pivotHighs.length && i < pivotLows.length; i++) {
      const h1 = pivotHighs[i - 1], h2 = pivotHighs[i];
      const l1 = pivotLows[i - 1], l2 = pivotLows[i];
      if (h2.val > h1.val && l2.val < l1.val) {
        out[Math.max(h2.idx, l2.idx)] = -1;
      }
    }
    return toResult(out);
  },
);

export const allChartPatterns: IndicatorDefinition[] = [
  headAndShouldersDef,
  inverseHeadShouldersDef,
  doubleTopDef,
  doubleBottomDef,
  tripleTopDef,
  tripleBottomDef,
  ascTriangleDef,
  descTriangleDef,
  symTriangleDef,
  risingWedgeDef,
  fallingWedgeDef,
  bullFlagDef,
  bearFlagDef,
  pennantDef,
  rectangleDef,
  cupAndHandleDef,
  broadeningDef,
];
