/**
 * HorizontalRay TV-parity tests (500 cases).
 *
 * Tests `getRaySegment` from drawingGeometry.ts for the horizontal-ray use-case
 * (single anchor, extends to the RIGHT edge of the canvas).
 *
 * TV signature: a ray starting at anchor point extending horizontally to the
 * right canvas edge (x=width), price stays constant.
 *
 * Categories:
 *   A. Basic structure – returns 2 points (30)
 *   B. Ray starts at anchor (60)
 *   C. Ray ends at canvas right/bottom edge (60)
 *   D. Y-coordinate constant for horizontal input (80)
 *   E. getRaySegment extends in the direction of travel (60)
 *   F. In-bounds check (50)
 *   G. Slope preserved (50)
 *   H. Degenerate inputs (40)
 *   I. Leftward vs rightward (40)
 *   J. Stress (30)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

import { getRaySegment } from '../../../../frontend/services/tools/drawingGeometry.ts';

type CP = { x: number; y: number };

const { test, summary } = createRunner('HorizontalRay parity (500)');

const W = 800; const H = 400;

function cp(x: number, y: number): CP { return { x, y }; }

function ray(a: CP, b: CP) { return getRaySegment(a, b, W, H); }

const TOL = 1.5;

function onEdge(p: CP): boolean {
  return Math.abs(p.x) < TOL || Math.abs(p.x - W) < TOL ||
         Math.abs(p.y) < TOL || Math.abs(p.y - H) < TOL;
}

function inBounds(p: CP): boolean {
  return p.x >= -TOL && p.x <= W + TOL && p.y >= -TOL && p.y <= H + TOL;
}

// ─── A. Basic structure (30) ──────────────────────────────────────────────────

test('HR-A-001: returns 2-element array', () => {
  const result = ray(cp(100, 200), cp(400, 200));
  assert.ok(Array.isArray(result) && result.length === 2);
});

test('HR-A-002: both elements have x and y', () => {
  const [a, b] = ray(cp(100, 200), cp(400, 200));
  assert.ok(typeof a.x === 'number' && typeof b.y === 'number');
});

for (let i = 3; i <= 30; i++) {
  const seed = i * 17 + 3;
  const ax = (seed * 3) % 600 + 100; const ay = (seed * 7) % 300 + 50;
  const bx = ax + (seed % 3 + 1) * 80; // always rightward
  const by = ay;
  test(`HR-A-${String(i).padStart(3,'0')}: returns 2-element array seed=${seed}`, () => {
    const r = ray(cp(ax, ay), cp(bx, by));
    assert.ok(Array.isArray(r) && r.length === 2);
  });
}

// ─── B. Ray starts at anchor (60) ─────────────────────────────────────────────

test('HR-B-001: ray[0] === anchor point (exact)', () => {
  const a = cp(100, 200);
  const [start] = ray(a, cp(400, 200));
  assert.ok(Math.abs(start.x - a.x) < 0.5 && Math.abs(start.y - a.y) < 0.5,
    `start=(${start.x},${start.y}) expected (${a.x},${a.y})`);
});

test('HR-B-002: horizontal ray starts at anchor x', () => {
  const a = cp(250, 150);
  const [start] = ray(a, cp(400, 150));
  assert.ok(Math.abs(start.x - 250) < 0.5);
});

test('HR-B-003: horizontal ray starts at anchor y', () => {
  const a = cp(250, 150);
  const [start] = ray(a, cp(400, 150));
  assert.ok(Math.abs(start.y - 150) < 0.5);
});

for (let i = 4; i <= 60; i++) {
  const seed = i * 19 + 5;
  const ax = (seed * 3) % 500 + 100; const ay = (seed * 7) % 300 + 50;
  const bx = ax + (seed % 4 + 1) * 60; const by = ay;
  test(`HR-B-${String(i).padStart(3,'0')}: ray starts at anchor seed=${seed}`, () => {
    const [start] = ray(cp(ax, ay), cp(bx, by));
    assert.ok(Math.abs(start.x - ax) < 0.5, `start.x=${start.x} expected ${ax}`);
    assert.ok(Math.abs(start.y - ay) < 0.5, `start.y=${start.y} expected ${ay}`);
  });
}

// ─── C. Ray ends at canvas edge (60) ──────────────────────────────────────────

test('HR-C-001: rightward horizontal ray ends at x=W', () => {
  const [, end] = ray(cp(100, 200), cp(400, 200));
  assert.ok(Math.abs(end.x - W) < TOL, `end.x=${end.x} expected ${W}`);
});

test('HR-C-002: downward ray ends at y=H or right edge', () => {
  const [, end] = ray(cp(100, 100), cp(200, 300));
  assert.ok(onEdge(end), `end=(${end.x.toFixed(1)},${end.y.toFixed(1)}) not on edge`);
});

test('HR-C-003: upward ray ends at y=0 or side edge', () => {
  const [, end] = ray(cp(100, 300), cp(200, 100));
  assert.ok(onEdge(end), `end=(${end.x.toFixed(1)},${end.y.toFixed(1)}) not on edge`);
});

for (let i = 4; i <= 60; i++) {
  const seed = i * 23 + 7;
  const ax = (seed * 3) % 400 + 150; const ay = (seed * 7) % 200 + 80;
  const bx = ax + (seed % 5 + 1) * 50; const by = ay + ((seed % 7) - 3) * 30;
  test(`HR-C-${String(i).padStart(3,'0')}: ray endpoint on canvas edge seed=${seed}`, () => {
    const [, end] = ray(cp(ax, ay), cp(bx, by));
    assert.ok(inBounds(end), `end out of bounds: (${end.x.toFixed(1)},${end.y.toFixed(1)})`);
    assert.ok(onEdge(end), `end not on edge: (${end.x.toFixed(1)},${end.y.toFixed(1)}) seed=${seed}`);
  });
}

// ─── D. Y constant for horizontal rays (80) ───────────────────────────────────

for (let i = 1; i <= 80; i++) {
  const seed = i * 29 + 11;
  const ax = (seed * 3) % 600 + 100; const ay = (seed * 7) % 360 + 20;
  const bx = ax + (seed % 4 + 1) * 80; // same y → horizontal
  test(`HR-D-${String(i).padStart(3,'0')}: horizontal ray y constant seed=${seed}`, () => {
    const [start, end] = ray(cp(ax, ay), cp(bx, ay));
    assert.ok(Math.abs(start.y - ay) < 0.5, `start.y=${start.y} expected ${ay}`);
    assert.ok(Math.abs(end.y - ay) < 0.5, `end.y=${end.y} expected ${ay}`);
    assert.ok(Math.abs(end.x - W) < TOL, `end.x=${end.x} should reach right edge`);
  });
}

// ─── E. Extends in direction of travel (60) ───────────────────────────────────

test('HR-E-001: rightward ray endpoint.x > anchor.x', () => {
  const [start, end] = ray(cp(200, 200), cp(400, 200));
  assert.ok(end.x > start.x, `end.x=${end.x} should > start.x=${start.x}`);
});

test('HR-E-002: downward ray endpoint.y > anchor.y', () => {
  const [start, end] = ray(cp(100, 100), cp(150, 300));
  assert.ok(end.y > start.y, `end.y=${end.y} should > start.y=${start.y}`);
});

test('HR-E-003: upward ray endpoint.y < anchor.y', () => {
  const [start, end] = ray(cp(100, 300), cp(200, 100));
  assert.ok(end.y < start.y, `end.y=${end.y} should < start.y=${start.y}`);
});

for (let i = 4; i <= 60; i++) {
  const seed = i * 31 + 13;
  const ax = (seed * 3) % 400 + 100; const ay = (seed * 7) % 200 + 80;
  const bx = ax + (seed % 4 + 1) * 50; // always rightward
  const by = ay + ((seed % 9) - 4) * 25;
  test(`HR-E-${String(i).padStart(3,'0')}: rightward ray end.x > start.x seed=${seed}`, () => {
    const [start, end] = ray(cp(ax, ay), cp(bx, by));
    assert.ok(end.x > start.x - 1, `end.x=${end.x} should > start.x=${start.x}`);
  });
}

// ─── F. In-bounds (50) ────────────────────────────────────────────────────────

for (let i = 1; i <= 50; i++) {
  const seed = i * 37 + 17;
  const ax = (seed * 3) % 600 + 100; const ay = (seed * 7) % 320 + 40;
  const bx = (seed * 11) % 600 + 100; const by = (seed * 13) % 320 + 40;
  if (ax === bx && ay === by) continue;
  test(`HR-F-${String(i).padStart(3,'0')}: ray in bounds seed=${seed}`, () => {
    const [start, end] = ray(cp(ax, ay), cp(bx, by));
    assert.ok(inBounds(start), `start=(${start.x.toFixed(1)},${start.y.toFixed(1)}) oob`);
    assert.ok(inBounds(end), `end=(${end.x.toFixed(1)},${end.y.toFixed(1)}) oob`);
  });
}

// ─── G. Slope preserved (50) ─────────────────────────────────────────────────

for (let i = 1; i <= 50; i++) {
  const seed = i * 41 + 19;
  const ax = (seed * 3) % 400 + 150; const ay = (seed * 7) % 200 + 80;
  const bx = ax + (seed % 4 + 1) * 60; const by = ay + ((seed % 7) - 3) * 30;
  if (Math.abs(bx - ax) < 1) continue;
  const expectedSlope = (by - ay) / (bx - ax);
  test(`HR-G-${String(i).padStart(3,'0')}: slope preserved seed=${seed}`, () => {
    const [start, end] = ray(cp(ax, ay), cp(bx, by));
    const dx = end.x - start.x; const dy = end.y - start.y;
    if (Math.abs(dx) > 1) {
      const actualSlope = dy / dx;
      assert.ok(Math.abs(actualSlope - expectedSlope) < 0.05,
        `slope: expected=${expectedSlope.toFixed(3)} actual=${actualSlope.toFixed(3)} seed=${seed}`);
    }
  });
}

// ─── H. Degenerate inputs (40) ────────────────────────────────────────────────

test('HR-H-001: zero-length does not throw', () => {
  assert.doesNotThrow(() => ray(cp(200, 200), cp(200, 200)));
});

test('HR-H-002: zero-length returns finite values', () => {
  const [a, b] = ray(cp(200, 200), cp(200, 200));
  assert.ok(isFinite(a.x) && isFinite(b.x));
});

test('HR-H-003: anchor on canvas edge', () => {
  assert.doesNotThrow(() => ray(cp(0, 200), cp(200, 200)));
});

test('HR-H-004: anchor at corner', () => {
  assert.doesNotThrow(() => ray(cp(0, 0), cp(100, 100)));
});

for (let i = 5; i <= 40; i++) {
  const seed = i * 43 + 21;
  const edgeVals = [0, 1, W / 2, W - 1, W, H / 2, H - 1, H];
  const ax = edgeVals[seed % edgeVals.length]; const ay = edgeVals[(seed * 7) % edgeVals.length];
  const bx = edgeVals[(seed * 11) % edgeVals.length]; const by = edgeVals[(seed * 13) % edgeVals.length];
  test(`HR-H-${String(i).padStart(3,'0')}: edge coords no throw seed=${seed}`, () => {
    assert.doesNotThrow(() => ray(cp(ax, ay), cp(bx, by)));
  });
}

// ─── I. Leftward vs rightward (40) ────────────────────────────────────────────

test('HR-I-001: leftward ray starts at anchor, extends to x=0', () => {
  const [start, end] = ray(cp(600, 200), cp(400, 200));
  assert.ok(Math.abs(start.x - 600) < 0.5);
  assert.ok(Math.abs(end.x) < TOL, `end.x=${end.x} should be near 0`);
});

test('HR-I-002: upward-left diagonal ends on left or top edge', () => {
  const [, end] = ray(cp(400, 300), cp(200, 100));
  assert.ok(onEdge(end), `end=(${end.x.toFixed(1)},${end.y.toFixed(1)}) not on edge`);
});

for (let i = 3; i <= 40; i++) {
  const seed = i * 47 + 23;
  // Use various directions
  const ax = (seed * 3) % 400 + 200; const ay = (seed * 7) % 200 + 100;
  const dirX = (seed % 2 === 0 ? 1 : -1) * ((seed % 4 + 1) * 50);
  const dirY = ((seed * 11) % 7 - 3) * 30;
  const bx = ax + dirX; const by = ay + dirY;
  test(`HR-I-${String(i).padStart(3,'0')}: arbitrary direction end on edge seed=${seed}`, () => {
    const [, end] = ray(cp(ax, ay), cp(bx, by));
    assert.ok(inBounds(end), `end oob seed=${seed}`);
    assert.ok(onEdge(end), `end not on edge seed=${seed}: (${end.x.toFixed(1)},${end.y.toFixed(1)})`);
  });
}

// ─── J. Stress (30) ──────────────────────────────────────────────────────────

for (let i = 1; i <= 30; i++) {
  const seed = i * 53 + 27;
  const ax = (seed * 3) % 700 + 50; const ay = (seed * 7) % 360 + 20;
  const bx = (seed * 11) % 700 + 50; const by = (seed * 13) % 360 + 20;
  test(`HR-J-${String(i).padStart(3,'0')}: stress seed=${seed}`, () => {
    if (ax === bx && ay === by) return;
    const [start, end] = ray(cp(ax, ay), cp(bx, by));
    assert.ok(isFinite(start.x) && isFinite(start.y));
    assert.ok(isFinite(end.x) && isFinite(end.y));
    assert.ok(inBounds(end), `end oob seed=${seed}`);
  });
}

summary();
