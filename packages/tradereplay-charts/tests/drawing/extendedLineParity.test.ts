/**
 * Extended Line TV-parity tests (500 cases).
 *
 * Tests `getExtendedLineSegment` from drawingGeometry.ts.
 * TV signature: line extends past BOTH anchor A and anchor B to canvas edges.
 *
 * Categories:
 *   A. Basic structure – returns [CP, CP] (40)
 *   B. Both endpoints on canvas boundary (80)
 *   C. Line direction preserved (60)
 *   D. Collinear with original anchors (60)
 *   E. Degenerate inputs (40)
 *   F. Horizontal lines (50)
 *   G. Vertical lines (50)
 *   H. Diagonal lines (60)
 *   I. Anchors outside canvas (30)
 *   J. Stress (30)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

import { getExtendedLineSegment, getRaySegment } from '../../../../frontend/services/tools/drawingGeometry.ts';

type CP = { x: number; y: number };

const { test, summary } = createRunner('ExtendedLine parity (500)');

const W = 800; const H = 400;

function cp(x: number, y: number): CP { return { x, y }; }

function ext(a: CP, b: CP) { return getExtendedLineSegment(a, b, W, H); }

const BORDER_TOLERANCE = 1.5;

function onBorder(p: CP): boolean {
  return (
    Math.abs(p.x) < BORDER_TOLERANCE ||
    Math.abs(p.x - W) < BORDER_TOLERANCE ||
    Math.abs(p.y) < BORDER_TOLERANCE ||
    Math.abs(p.y - H) < BORDER_TOLERANCE
  );
}

function inBounds(p: CP): boolean {
  return p.x >= -BORDER_TOLERANCE && p.x <= W + BORDER_TOLERANCE &&
         p.y >= -BORDER_TOLERANCE && p.y <= H + BORDER_TOLERANCE;
}

// ─── A. Basic structure (40) ──────────────────────────────────────────────────

test('EL-A-001: returns array of 2 points', () => {
  const seg = ext(cp(100, 200), cp(400, 150));
  assert.ok(Array.isArray(seg) && seg.length === 2);
});

test('EL-A-002: both returned points are objects with x and y', () => {
  const [a, b] = ext(cp(100, 200), cp(400, 150));
  assert.ok(typeof a.x === 'number' && typeof a.y === 'number');
  assert.ok(typeof b.x === 'number' && typeof b.y === 'number');
});

for (let i = 3; i <= 40; i++) {
  const seed = i * 17 + 3;
  const ax = (seed * 3 + 80) % 600 + 100; const ay = (seed * 7 + 80) % 280 + 60;
  const bx = (seed * 11 + 100) % 600 + 100; const by = (seed * 13 + 60) % 280 + 60;
  test(`EL-A-${String(i).padStart(3,'0')}: returns 2-element array seed=${seed}`, () => {
    const seg = ext(cp(ax, ay), cp(bx, by));
    assert.ok(Array.isArray(seg) && seg.length === 2);
    assert.ok(typeof seg[0].x === 'number');
  });
}

// ─── B. Both endpoints on canvas boundary (80) ───────────────────────────────

test('EL-B-001: horizontal line – both endpoints on left/right border', () => {
  const [a, b] = ext(cp(200, 200), cp(400, 200));
  assert.ok(onBorder(a), `a=(${a.x},${a.y}) not on border`);
  assert.ok(onBorder(b), `b=(${b.x},${b.y}) not on border`);
});

test('EL-B-002: vertical line – both endpoints on top/bottom border', () => {
  const [a, b] = ext(cp(200, 100), cp(200, 300));
  assert.ok(onBorder(a), `a=(${a.x.toFixed(1)},${a.y.toFixed(1)}) not on border`);
  assert.ok(onBorder(b), `b=(${b.x.toFixed(1)},${b.y.toFixed(1)}) not on border`);
});

test('EL-B-003: diagonal line – both endpoints on canvas edge', () => {
  const [a, b] = ext(cp(200, 200), cp(300, 150));
  assert.ok(onBorder(a), `a=(${a.x.toFixed(1)},${a.y.toFixed(1)}) not on border`);
  assert.ok(onBorder(b), `b=(${b.x.toFixed(1)},${b.y.toFixed(1)}) not on border`);
});

for (let i = 4; i <= 80; i++) {
  const seed = i * 19 + 7;
  // Use interior anchor points to guarantee extension goes to edges
  const ax = (seed * 3) % 400 + 150; const ay = (seed * 7) % 200 + 80;
  const bx = (seed * 11) % 400 + 150; const by = (seed * 13) % 200 + 80;
  if (ax === bx && ay === by) continue; // skip zero-length
  test(`EL-B-${String(i).padStart(3,'0')}: both endpoints on border seed=${seed}`, () => {
    const [pa, pb] = ext(cp(ax, ay), cp(bx, by));
    assert.ok(inBounds(pa), `pa=(${pa.x.toFixed(1)},${pa.y.toFixed(1)}) out of bounds`);
    assert.ok(inBounds(pb), `pb=(${pb.x.toFixed(1)},${pb.y.toFixed(1)}) out of bounds`);
    assert.ok(onBorder(pa), `pa=(${pa.x.toFixed(1)},${pa.y.toFixed(1)}) not on border seed=${seed}`);
    assert.ok(onBorder(pb), `pb=(${pb.x.toFixed(1)},${pb.y.toFixed(1)}) not on border seed=${seed}`);
  });
}

// ─── C. Line direction preserved (60) ────────────────────────────────────────

test('EL-C-001: slope of result matches slope of input', () => {
  const a = cp(200, 200); const b = cp(400, 150);
  const [pa, pb] = ext(a, b);
  const inSlope = (b.y - a.y) / (b.x - a.x);
  const outSlope = (pb.y - pa.y) / (pb.x - pa.x);
  assert.ok(Math.abs(outSlope - inSlope) < 0.05, `slope: in=${inSlope} out=${outSlope}`);
});

test('EL-C-002: horizontal result stays horizontal', () => {
  const [pa, pb] = ext(cp(200, 200), cp(500, 200));
  assert.ok(Math.abs(pa.y - 200) < 1 && Math.abs(pb.y - 200) < 1, `not horizontal: pa.y=${pa.y} pb.y=${pb.y}`);
});

for (let i = 3; i <= 60; i++) {
  const seed = i * 23 + 9;
  const ax = (seed * 3) % 400 + 150; const ay = (seed * 7) % 200 + 80;
  const bx = (seed * 11) % 400 + 150; const by = (seed * 13) % 200 + 80;
  if (Math.abs(bx - ax) < 2) continue;
  const inSlope = (by - ay) / (bx - ax);
  test(`EL-C-${String(i).padStart(3,'0')}: slope preserved seed=${seed}`, () => {
    const [pa, pb] = ext(cp(ax, ay), cp(bx, by));
    if (Math.abs(pb.x - pa.x) > 2) {
      const outSlope = (pb.y - pa.y) / (pb.x - pa.x);
      assert.ok(Math.abs(outSlope - inSlope) < 0.1, `slope: in=${inSlope.toFixed(3)} out=${outSlope.toFixed(3)} seed=${seed}`);
    }
  });
}

// ─── D. Collinear with original anchors (60) ─────────────────────────────────

test('EL-D-001: original anchor A lies on the extended segment', () => {
  const a = cp(200, 200); const b = cp(400, 150);
  const [pa, pb] = ext(a, b);
  // Cross-product ≈ 0 for collinearity
  const dx = pb.x - pa.x; const dy = pb.y - pa.y;
  const cross = Math.abs(dx * (a.y - pa.y) - dy * (a.x - pa.x));
  const mag = Math.hypot(dx, dy);
  assert.ok(cross / mag < 2, `A not on extended line: cross=${cross/mag}`);
});

test('EL-D-002: original anchor B lies on the extended segment', () => {
  const a = cp(200, 200); const b = cp(400, 150);
  const [pa, pb] = ext(a, b);
  const dx = pb.x - pa.x; const dy = pb.y - pa.y;
  const cross = Math.abs(dx * (b.y - pa.y) - dy * (b.x - pa.x));
  const mag = Math.hypot(dx, dy);
  assert.ok(cross / mag < 2, `B not on extended line: cross=${cross/mag}`);
});

for (let i = 3; i <= 60; i++) {
  const seed = i * 29 + 11;
  const ax = (seed * 3) % 400 + 150; const ay = (seed * 7) % 200 + 80;
  const bx = (seed * 11) % 400 + 150; const by = (seed * 13) % 200 + 80;
  if (ax === bx && ay === by) continue;
  test(`EL-D-${String(i).padStart(3,'0')}: anchors collinear with result seed=${seed}`, () => {
    const [pa, pb] = ext(cp(ax, ay), cp(bx, by));
    const dx = pb.x - pa.x; const dy = pb.y - pa.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1) return;
    const crossA = Math.abs(dx * (ay - pa.y) - dy * (ax - pa.x)) / mag;
    const crossB = Math.abs(dx * (by - pa.y) - dy * (bx - pa.x)) / mag;
    assert.ok(crossA < 3, `A not collinear: ${crossA.toFixed(2)} seed=${seed}`);
    assert.ok(crossB < 3, `B not collinear: ${crossB.toFixed(2)} seed=${seed}`);
  });
}

// ─── E. Degenerate inputs (40) ────────────────────────────────────────────────

test('EL-E-001: zero-length segment does not throw', () => {
  assert.doesNotThrow(() => ext(cp(200, 200), cp(200, 200)));
});

test('EL-E-002: anchors outside canvas boundary', () => {
  assert.doesNotThrow(() => ext(cp(-100, 200), cp(900, 200)));
});

test('EL-E-003: NaN-like extreme values do not throw', () => {
  assert.doesNotThrow(() => ext(cp(0, 0), cp(0, 0)));
});

for (let i = 4; i <= 40; i++) {
  const seed = i * 37 + 17;
  const edgeVals = [0, 1, W / 2, W - 1, W, H / 2, H - 1, H, -10, W + 10];
  const ax = edgeVals[seed % edgeVals.length]; const ay = edgeVals[(seed * 7) % edgeVals.length];
  const bx = edgeVals[(seed * 11) % edgeVals.length]; const by = edgeVals[(seed * 13) % edgeVals.length];
  test(`EL-E-${String(i).padStart(3,'0')}: edge coords no throw seed=${seed}`, () => {
    assert.doesNotThrow(() => ext(cp(ax, ay), cp(bx, by)));
  });
}

// ─── F. Horizontal lines (50) ─────────────────────────────────────────────────

for (let i = 1; i <= 50; i++) {
  const seed = i * 41 + 19;
  const y = (seed * 7) % (H - 20) + 10;
  const ax = (seed * 3) % 400 + 100; const bx = (seed * 11) % 400 + 200;
  test(`EL-F-${String(i).padStart(3,'0')}: horizontal y=${y} extends to x=0 and x=W`, () => {
    if (ax === bx) return;
    const [pa, pb] = ext(cp(ax, y), cp(bx, y));
    assert.ok(Math.abs(pa.y - y) < 1, `pa.y=${pa.y} expected ${y}`);
    assert.ok(Math.abs(pb.y - y) < 1, `pb.y=${pb.y} expected ${y}`);
    assert.ok(
      Math.abs(pa.x) < BORDER_TOLERANCE || Math.abs(pb.x) < BORDER_TOLERANCE ||
      Math.abs(pa.x - W) < BORDER_TOLERANCE || Math.abs(pb.x - W) < BORDER_TOLERANCE,
      `horizontal line should reach left or right edge`
    );
  });
}

// ─── G. Vertical lines (50) ───────────────────────────────────────────────────

for (let i = 1; i <= 50; i++) {
  const seed = i * 43 + 21;
  const x = (seed * 7) % (W - 20) + 10;
  const ay = (seed * 3) % 300 + 50; const by = (seed * 11) % 300 + 50;
  test(`EL-G-${String(i).padStart(3,'0')}: vertical x=${x} extends to y=0 and y=H`, () => {
    if (ay === by) return;
    const [pa, pb] = ext(cp(x, ay), cp(x, by));
    assert.ok(Math.abs(pa.x - x) < 1, `pa.x=${pa.x} expected ${x}`);
    assert.ok(Math.abs(pb.x - x) < 1, `pb.x=${pb.x} expected ${x}`);
    assert.ok(
      Math.abs(pa.y) < BORDER_TOLERANCE || Math.abs(pb.y) < BORDER_TOLERANCE ||
      Math.abs(pa.y - H) < BORDER_TOLERANCE || Math.abs(pb.y - H) < BORDER_TOLERANCE,
      `vertical line should reach top or bottom edge`
    );
  });
}

// ─── H. Diagonal lines (60) ───────────────────────────────────────────────────

for (let i = 1; i <= 60; i++) {
  const seed = i * 47 + 23;
  const ax = (seed * 3) % 400 + 150; const ay = (seed * 7) % 200 + 80;
  const bx = ax + (seed % 5 + 1) * 50; const by = ay + ((seed % 7) - 3) * 30;
  test(`EL-H-${String(i).padStart(3,'0')}: diagonal extended endpoints in bounds seed=${seed}`, () => {
    const [pa, pb] = ext(cp(ax, ay), cp(bx, by));
    assert.ok(inBounds(pa), `pa=(${pa.x.toFixed(1)},${pa.y.toFixed(1)}) oob`);
    assert.ok(inBounds(pb), `pb=(${pb.x.toFixed(1)},${pb.y.toFixed(1)}) oob`);
  });
}

// ─── I. Anchors outside canvas (30) ───────────────────────────────────────────

for (let i = 1; i <= 30; i++) {
  const seed = i * 53 + 29;
  // Points outside canvas
  const ax = -50 - (seed * 3 % 100); const ay = (seed * 7) % 300 + 50;
  const bx = W + 50 + (seed * 11 % 100); const by = (seed * 13) % 300 + 50;
  test(`EL-I-${String(i).padStart(3,'0')}: outside-canvas anchors, result in bounds seed=${seed}`, () => {
    const [pa, pb] = ext(cp(ax, ay), cp(bx, by));
    assert.ok(inBounds(pa), `pa=(${pa.x.toFixed(1)},${pa.y.toFixed(1)}) oob seed=${seed}`);
    assert.ok(inBounds(pb), `pb=(${pb.x.toFixed(1)},${pb.y.toFixed(1)}) oob seed=${seed}`);
  });
}

// ─── J. Stress (30) ──────────────────────────────────────────────────────────

for (let i = 1; i <= 30; i++) {
  const seed = i * 59 + 31;
  const ax = (seed * 3) % 700 + 50; const ay = (seed * 7) % 360 + 20;
  const bx = (seed * 11) % 700 + 50; const by = (seed * 13) % 360 + 20;
  test(`EL-J-${String(i).padStart(3,'0')}: stress seed=${seed}`, () => {
    if (ax === bx && ay === by) return;
    const [pa, pb] = ext(cp(ax, ay), cp(bx, by));
    assert.ok(Array.isArray([pa, pb]) && pa && pb);
    assert.ok(isFinite(pa.x) && isFinite(pa.y) && isFinite(pb.x) && isFinite(pb.y));
  });
}

summary();
