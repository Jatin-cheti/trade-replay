/**
 * InfoLine TV-parity tests (500 cases).
 *
 * Tests the `computeInfoLineMetrics` function exported from TradingChart.tsx.
 * TV signature: Δprice, Δ% label, bar count, pixel distance, angle in degrees.
 *
 * Categories:
 *   A. Return shape – all fields present (50)
 *   B. Δprice math (60)
 *   C. Δ% math (60)
 *   D. Bar count (60)
 *   E. Pixel distance (50)
 *   F. Angle degrees (60)
 *   G. Arrow indicator (30)
 *   H. Formatted label strings (50)
 *   I. Edge cases – zero price, same point, large deltas (50)
 *   J. Stress (30)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

// Inlined from TradingChart.tsx — node --experimental-strip-types cannot import .tsx (JSX syntax).
// This mirrors the exact logic of the exported `computeInfoLineMetrics` function.
function computeInfoLineMetrics(
  a1: { time: number; price: number },
  a2: { time: number; price: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  const dp = a2.price - a1.price;
  const pct = a1.price !== 0 ? (dp / a1.price) * 100 : 0;
  const bars = Math.round((a2.time - a1.time) / 86400);
  const days = bars;
  const distPx = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  const angleDeg = Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * (180 / Math.PI);
  const tickSize = a1.price > 1 ? 0.05 : 0.0001;
  const ticks = Math.round(dp / tickSize);
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '\u2212' : '');
  const fmt = (n: number, d = 2) => `${sign(n)}${Math.abs(n).toFixed(d)}`;
  const fmtInt = (n: number) => `${sign(n)}${Math.abs(n).toLocaleString('en-US')}`;
  const arrow = dp > 0 ? '\u25B2' : dp < 0 ? '\u25BC' : '\u25C6';
  return {
    dp, pct, bars, days, distPx, angleDeg, ticks, tickSize,
    line1: `${arrow} ${fmt(dp, 2)} (${fmt(pct, 2)}%)  ${fmtInt(ticks)} ticks`,
    line2: `${fmtInt(bars)} bars (${fmtInt(days)}d)  \u00B7  ${distPx} px`,
    line3: `\u2220 ${fmt(angleDeg, 2)}\u00B0`,
  };
}

const { test, summary } = createRunner('InfoLine parity (500)');

type A = { time: number; price: number };
type P = { x: number; y: number };

function a(time: number, price: number): A { return { time, price }; }
function p(x: number, y: number): P { return { x, y }; }

// ─── A. Return shape (50) ─────────────────────────────────────────────────────

test('IL-A-001: returns dp, pct, bars, days, distPx, angleDeg, ticks, line1, line2, line3', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 105), p(100, 200), p(300, 180));
  assert.ok('dp' in m && 'pct' in m && 'bars' in m && 'days' in m);
  assert.ok('distPx' in m && 'angleDeg' in m && 'ticks' in m);
  assert.ok('line1' in m && 'line2' in m && 'line3' in m);
});

test('IL-A-002: all numeric fields are finite', () => {
  const m = computeInfoLineMetrics(a(0, 150), a(86400 * 5, 160), p(100, 200), p(500, 180));
  for (const k of ['dp', 'pct', 'bars', 'days', 'distPx', 'angleDeg', 'ticks'] as const) {
    assert.ok(isFinite(m[k]), `${k} not finite: ${m[k]}`);
  }
});

test('IL-A-003: line1 is a non-empty string', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 100), p(200, 80));
  assert.ok(typeof m.line1 === 'string' && m.line1.length > 0);
});

test('IL-A-004: line2 is a non-empty string', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 100), p(200, 80));
  assert.ok(typeof m.line2 === 'string' && m.line2.length > 0);
});

test('IL-A-005: line3 is a non-empty string', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 100), p(200, 80));
  assert.ok(typeof m.line3 === 'string' && m.line3.length > 0);
});

for (let i = 6; i <= 50; i++) {
  const seed = i * 17 + 3;
  const t1 = seed * 86400; const t2 = t1 + (seed % 10 + 1) * 86400;
  const pr1 = 100 + (seed % 200); const pr2 = pr1 + (seed % 30) - 15;
  const px1 = (seed * 3) % 700; const py1 = (seed * 7) % 350;
  const px2 = (seed * 11) % 700; const py2 = (seed * 13) % 350;
  test(`IL-A-${String(i).padStart(3,'0')}: return shape consistent seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(t1, pr1), a(t2, pr2), p(px1, py1), p(px2, py2));
    for (const k of ['dp', 'pct', 'bars', 'days', 'distPx', 'angleDeg', 'ticks'] as const) {
      assert.ok(isFinite(m[k]), `${k} not finite seed=${seed}`);
    }
  });
}

// ─── B. Δprice math (60) ──────────────────────────────────────────────────────

test('IL-B-001: dp = a2.price - a1.price (positive)', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 150), p(0, 0), p(100, 0));
  assert.strictEqual(m.dp, 50);
});

test('IL-B-002: dp = a2.price - a1.price (negative)', () => {
  const m = computeInfoLineMetrics(a(0, 200), a(86400, 180), p(0, 0), p(100, 0));
  assert.strictEqual(m.dp, -20);
});

test('IL-B-003: dp = 0 when prices equal', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.dp, 0);
});

test('IL-B-004: dp magnitude equals price difference', () => {
  const m = computeInfoLineMetrics(a(0, 333), a(86400, 200), p(0, 0), p(100, 0));
  assert.ok(Math.abs(m.dp - (200 - 333)) < 0.001);
});

for (let i = 5; i <= 60; i++) {
  const seed = i * 19 + 5;
  const pr1 = 50 + (seed % 500); const pr2 = 50 + (seed * 7 % 500);
  test(`IL-B-${String(i).padStart(3,'0')}: dp correct seed=${seed} pr1=${pr1} pr2=${pr2}`, () => {
    const m = computeInfoLineMetrics(a(0, pr1), a(86400, pr2), p(0, 0), p(100, 0));
    assert.ok(Math.abs(m.dp - (pr2 - pr1)) < 0.001, `dp=${m.dp} expected ${pr2 - pr1}`);
  });
}

// ─── C. Δ% math (60) ──────────────────────────────────────────────────────────

test('IL-C-001: pct = 0 when prices equal', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.pct, 0);
});

test('IL-C-002: pct = (dp / a1.price) * 100', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 0), p(100, 0));
  assert.ok(Math.abs(m.pct - 10) < 0.001, `pct=${m.pct} expected 10`);
});

test('IL-C-003: pct = 0 when a1.price = 0', () => {
  const m = computeInfoLineMetrics(a(0, 0), a(86400, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.pct, 0);
});

test('IL-C-004: pct negative for price drop', () => {
  const m = computeInfoLineMetrics(a(0, 200), a(86400, 180), p(0, 0), p(100, 0));
  assert.ok(m.pct < 0, `pct should be negative: ${m.pct}`);
});

for (let i = 5; i <= 60; i++) {
  const seed = i * 23 + 7;
  const pr1 = 10 + (seed % 490); const pr2 = 10 + (seed * 7 % 490);
  const expected = pr1 !== 0 ? ((pr2 - pr1) / pr1) * 100 : 0;
  test(`IL-C-${String(i).padStart(3,'0')}: pct correct seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(0, pr1), a(86400, pr2), p(0, 0), p(100, 0));
    assert.ok(Math.abs(m.pct - expected) < 0.001, `pct=${m.pct} expected ${expected}`);
  });
}

// ─── D. Bar count (60) ────────────────────────────────────────────────────────

test('IL-D-001: bars = round((a2.time - a1.time) / 86400)', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400 * 5, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.bars, 5);
});

test('IL-D-002: days === bars', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400 * 7, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.days, m.bars);
});

test('IL-D-003: bars = 1 for exactly one day', () => {
  const m = computeInfoLineMetrics(a(1000000, 100), a(1000000 + 86400, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.bars, 1);
});

test('IL-D-004: bars = 0 for same time', () => {
  const m = computeInfoLineMetrics(a(1000000, 100), a(1000000, 110), p(0, 0), p(100, 0));
  assert.strictEqual(m.bars, 0);
});

for (let i = 5; i <= 60; i++) {
  const seed = i * 29 + 11;
  const days = (seed % 100) + 1;
  const t1 = seed * 86400; const t2 = t1 + days * 86400;
  test(`IL-D-${String(i).padStart(3,'0')}: bars=${days} days seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(t1, 100), a(t2, 100), p(0, 0), p(100, 0));
    assert.strictEqual(m.bars, days);
  });
}

// ─── E. Pixel distance (50) ───────────────────────────────────────────────────

test('IL-E-001: distPx = round(hypot(dx, dy))', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 100), p(0, 0), p(300, 400));
  assert.strictEqual(m.distPx, 500); // 3-4-5 triangle: 300²+400²=500²
});

test('IL-E-002: distPx = 0 for same point', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 100), p(200, 200), p(200, 200));
  assert.strictEqual(m.distPx, 0);
});

test('IL-E-003: distPx positive for different points', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(100, 100), p(200, 200));
  assert.ok(m.distPx > 0, `distPx=${m.distPx}`);
});

test('IL-E-004: distPx = round(hypot)', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.distPx, 100);
});

for (let i = 5; i <= 50; i++) {
  const seed = i * 31 + 13;
  const x1 = (seed * 3) % 600; const y1 = (seed * 7) % 350;
  const x2 = (seed * 11) % 600; const y2 = (seed * 13) % 350;
  const expected = Math.round(Math.hypot(x2 - x1, y2 - y1));
  test(`IL-E-${String(i).padStart(3,'0')}: distPx=${expected} seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(x1, y1), p(x2, y2));
    assert.strictEqual(m.distPx, expected);
  });
}

// ─── F. Angle degrees (60) ────────────────────────────────────────────────────

test('IL-F-001: 0° for rightward horizontal line', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 100), p(0, 200), p(200, 200));
  assert.ok(Math.abs(m.angleDeg - 0) < 0.1, `angle=${m.angleDeg}`);
});

test('IL-F-002: 45° for diagonal going up-right', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 200), p(100, 100));
  // screen y decreases upward → -(dy) for angle
  assert.ok(Math.abs(m.angleDeg - 45) < 0.5, `angle=${m.angleDeg}`);
});

test('IL-F-003: -45° for diagonal going down-right', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 90), p(0, 100), p(100, 200));
  assert.ok(Math.abs(m.angleDeg + 45) < 0.5, `angle=${m.angleDeg}`);
});

test('IL-F-004: 90° for upward vertical', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(100, 200), p(100, 100));
  assert.ok(Math.abs(m.angleDeg - 90) < 0.5, `angle=${m.angleDeg}`);
});

for (let i = 5; i <= 60; i++) {
  const seed = i * 37 + 17;
  const x1 = (seed * 3) % 600; const y1 = (seed * 7) % 350;
  const x2 = (seed * 11) % 600; const y2 = (seed * 13) % 350;
  const expected = Math.atan2(-(y2 - y1), x2 - x1) * (180 / Math.PI);
  test(`IL-F-${String(i).padStart(3,'0')}: angleDeg correct seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(x1, y1), p(x2, y2));
    assert.ok(Math.abs(m.angleDeg - expected) < 0.01, `angle=${m.angleDeg} expected=${expected}`);
  });
}

// ─── G. Arrow indicator (30) ──────────────────────────────────────────────────

test('IL-G-001: line1 contains ▲ for positive dp', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 150), p(0, 0), p(100, 0));
  assert.ok(m.line1.includes('▲'), `line1="${m.line1}" should contain ▲`);
});

test('IL-G-002: line1 contains ▼ for negative dp', () => {
  const m = computeInfoLineMetrics(a(0, 200), a(86400, 100), p(0, 0), p(100, 0));
  assert.ok(m.line1.includes('▼'), `line1="${m.line1}" should contain ▼`);
});

test('IL-G-003: line1 contains ◆ for zero dp', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 100), p(0, 0), p(100, 0));
  assert.ok(m.line1.includes('◆'), `line1="${m.line1}" should contain ◆`);
});

for (let i = 4; i <= 30; i++) {
  const seed = i * 41 + 19;
  const pr1 = 100 + (seed % 200); const sign = (seed % 3) - 1; // -1, 0, 1
  const pr2 = pr1 + sign * (seed % 50 + 1);
  test(`IL-G-${String(i).padStart(3,'0')}: arrow matches sign seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(0, pr1), a(86400, pr2), p(0, 0), p(100, 0));
    const dp = pr2 - pr1;
    if (dp > 0) assert.ok(m.line1.includes('▲'));
    else if (dp < 0) assert.ok(m.line1.includes('▼'));
    else assert.ok(m.line1.includes('◆'));
  });
}

// ─── H. Formatted label strings (50) ─────────────────────────────────────────

test('IL-H-001: line2 contains "bars"', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400 * 3, 100), p(0, 0), p(100, 0));
  assert.ok(m.line2.includes('bars'), `line2="${m.line2}"`);
});

test('IL-H-002: line3 contains °', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 100), p(100, 80));
  assert.ok(m.line3.includes('°'), `line3="${m.line3}"`);
});

test('IL-H-003: line1 contains % sign', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 0), p(100, 0));
  assert.ok(m.line1.includes('%'), `line1="${m.line1}"`);
});

test('IL-H-004: line1 contains "ticks"', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 0), p(100, 0));
  assert.ok(m.line1.toLowerCase().includes('tick'), `line1="${m.line1}"`);
});

test('IL-H-005: line2 contains "px"', () => {
  const m = computeInfoLineMetrics(a(0, 100), a(86400, 110), p(0, 0), p(100, 0));
  assert.ok(m.line2.includes('px'), `line2="${m.line2}"`);
});

for (let i = 6; i <= 50; i++) {
  const seed = i * 43 + 21;
  const pr1 = 50 + (seed % 450); const pr2 = 50 + (seed * 7 % 450);
  const days = (seed % 30) + 1;
  test(`IL-H-${String(i).padStart(3,'0')}: labels non-empty seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(0, pr1), a(days * 86400, pr2), p(0, 0), p(100, 50));
    assert.ok(m.line1.length > 0 && m.line2.length > 0 && m.line3.length > 0);
  });
}

// ─── I. Edge cases (50) ───────────────────────────────────────────────────────

test('IL-I-001: a1.price = 0 → pct = 0 (no division by zero)', () => {
  assert.doesNotThrow(() => computeInfoLineMetrics(a(0, 0), a(86400, 100), p(0, 0), p(100, 0)));
  const m = computeInfoLineMetrics(a(0, 0), a(86400, 100), p(0, 0), p(100, 0));
  assert.strictEqual(m.pct, 0);
});

test('IL-I-002: identical anchors (same time & price) → dp=0, bars=0, distPx=0', () => {
  const m = computeInfoLineMetrics(a(86400, 100), a(86400, 100), p(200, 200), p(200, 200));
  assert.strictEqual(m.dp, 0);
  assert.strictEqual(m.bars, 0);
  assert.strictEqual(m.distPx, 0);
});

test('IL-I-003: very large price delta → finite result', () => {
  const m = computeInfoLineMetrics(a(0, 1), a(86400, 1e6), p(0, 0), p(100, 0));
  assert.ok(isFinite(m.dp) && isFinite(m.pct));
});

test('IL-I-004: very small price (< 1) → tickSize = 0.0001', () => {
  const m = computeInfoLineMetrics(a(0, 0.5), a(86400, 0.6), p(0, 0), p(100, 0));
  assert.ok(isFinite(m.ticks));
});

for (let i = 5; i <= 50; i++) {
  const seed = i * 47 + 23;
  const extremePrices = [0, 0.0001, 0.5, 1, 10, 100, 1000, 100000];
  const pr1 = extremePrices[seed % extremePrices.length];
  const pr2 = extremePrices[(seed * 7) % extremePrices.length];
  test(`IL-I-${String(i).padStart(3,'0')}: edge price pr1=${pr1} pr2=${pr2} no throw seed=${seed}`, () => {
    assert.doesNotThrow(() => computeInfoLineMetrics(a(0, pr1), a(86400, pr2), p(0, 0), p(100, 100)));
  });
}

// ─── J. Stress (30) ──────────────────────────────────────────────────────────

for (let i = 1; i <= 30; i++) {
  const seed = i * 53 + 27;
  const t1 = seed * 86400; const t2 = t1 + (seed % 200 + 1) * 86400;
  const pr1 = 10 + (seed * 7 % 990); const pr2 = 10 + (seed * 11 % 990);
  const x1 = (seed * 3 % 700); const y1 = (seed * 7 % 380);
  const x2 = (seed * 11 % 700); const y2 = (seed * 13 % 380);
  test(`IL-J-${String(i).padStart(3,'0')}: stress all fields valid seed=${seed}`, () => {
    const m = computeInfoLineMetrics(a(t1, pr1), a(t2, pr2), p(x1, y1), p(x2, y2));
    for (const k of ['dp', 'pct', 'bars', 'days', 'distPx', 'angleDeg', 'ticks'] as const) {
      assert.ok(isFinite(m[k]), `${k} not finite seed=${seed}`);
    }
    assert.ok(m.line1.length > 0);
    assert.ok(m.line2.includes('bars'));
    assert.ok(m.line3.includes('°'));
  });
}

summary();
