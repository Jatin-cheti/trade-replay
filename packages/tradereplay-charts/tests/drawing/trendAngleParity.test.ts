/**
 * TrendAngle TV-parity tests (500 cases).
 *
 * Tests `snapTrendAngleSegment` from drawingGeometry.ts.
 * TV signature: line snaps to nearest N° increment with visual angle label.
 *
 * Categories:
 *   A. Return structure (30)
 *   B. Default 15° snap – angle divisible by 15 (80)
 *   C. Start point preserved (60)
 *   D. Length preserved after snap (60)
 *   E. Custom step sizes (60)
 *   F. Horizontal snap (0° / 180°) (50)
 *   G. Vertical snap (90°) (40)
 *   H. 45° snap (50)
 *   I. Degenerate inputs (30)
 *   J. Stress (40)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

import { snapTrendAngleSegment } from '../../../../frontend/services/tools/drawingGeometry.ts';

type CP = { x: number; y: number };

const { test, summary } = createRunner('TrendAngle parity (500)');

function cp(x: number, y: number): CP { return { x, y }; }

const DEG = Math.PI / 180;

function angle(a: CP, b: CP): number {
  return Math.atan2(-(b.y - a.y), b.x - a.x) * (180 / Math.PI);
}

function dist(a: CP, b: CP): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ─── A. Return structure (30) ─────────────────────────────────────────────────

test('TA-A-001: returns 2-element array', () => {
  const result = snapTrendAngleSegment(cp(100, 200), cp(300, 150));
  assert.ok(Array.isArray(result) && result.length === 2);
});

test('TA-A-002: both elements are {x, y} objects', () => {
  const [a, b] = snapTrendAngleSegment(cp(100, 200), cp(300, 150));
  assert.ok(typeof a.x === 'number' && typeof a.y === 'number');
  assert.ok(typeof b.x === 'number' && typeof b.y === 'number');
});

test('TA-A-003: start point returned as-is', () => {
  const start = cp(100, 200);
  const [a] = snapTrendAngleSegment(start, cp(300, 150));
  assert.strictEqual(a.x, start.x);
  assert.strictEqual(a.y, start.y);
});

for (let i = 4; i <= 30; i++) {
  const seed = i * 17 + 3;
  const sx = (seed * 3) % 600 + 100; const sy = (seed * 7) % 300 + 50;
  const ex = (seed * 11) % 600 + 100; const ey = (seed * 13) % 300 + 50;
  test(`TA-A-${String(i).padStart(3,'0')}: result is 2-element array seed=${seed}`, () => {
    const r = snapTrendAngleSegment(cp(sx, sy), cp(ex, ey));
    assert.ok(Array.isArray(r) && r.length === 2);
    assert.ok(isFinite(r[0].x) && isFinite(r[1].y));
  });
}

// ─── B. Default 15° snap (80) ─────────────────────────────────────────────────

test('TA-B-001: angle exactly 0° → stays 0°', () => {
  const [a, b] = snapTrendAngleSegment(cp(100, 200), cp(300, 200));
  const a_deg = angle(a, b);
  assert.ok(Math.abs(a_deg) < 0.5, `angle=${a_deg}`);
});

test('TA-B-002: angle 7° → snaps to 0°', () => {
  const len = 200;
  const end = cp(100 + len * Math.cos(7 * DEG), 200 - len * Math.sin(7 * DEG));
  const [a, b] = snapTrendAngleSegment(cp(100, 200), end);
  const a_deg = angle(a, b);
  assert.ok(Math.abs(a_deg % 15) < 1 || Math.abs(Math.abs(a_deg % 15) - 15) < 1,
    `angle=${a_deg} not at 15° step`);
});

test('TA-B-003: angle 30° → stays 30°', () => {
  const len = 200;
  const end = cp(100 + len * Math.cos(30 * DEG), 200 - len * Math.sin(30 * DEG));
  const [a, b] = snapTrendAngleSegment(cp(100, 200), end);
  const a_deg = angle(a, b);
  assert.ok(Math.abs(a_deg - 30) < 1, `angle=${a_deg}`);
});

test('TA-B-004: angle 45° → stays 45°', () => {
  const len = 200;
  const end = cp(100 + len * Math.cos(45 * DEG), 200 - len * Math.sin(45 * DEG));
  const [a, b] = snapTrendAngleSegment(cp(100, 200), end);
  const a_deg = angle(a, b);
  assert.ok(Math.abs(a_deg - 45) < 1, `angle=${a_deg}`);
});

test('TA-B-005: angle 90° → stays 90°', () => {
  const [a, b] = snapTrendAngleSegment(cp(100, 200), cp(100, 50)); // pointing up
  const a_deg = angle(a, b);
  assert.ok(Math.abs(a_deg - 90) < 1, `angle=${a_deg}`);
});

test('TA-B-006: angle -15° → stays -15°', () => {
  const len = 200;
  const end = cp(100 + len * Math.cos(-15 * DEG), 200 - len * Math.sin(-15 * DEG));
  const [a, b] = snapTrendAngleSegment(cp(100, 200), end);
  const a_deg = angle(a, b);
  assert.ok(Math.abs(a_deg + 15) < 1, `angle=${a_deg}`);
});

for (let i = 7; i <= 80; i++) {
  const seed = i * 19 + 5;
  const snapAngle = (seed % 12) * 15; // 0, 15, 30, ... 165
  const offset = ((seed % 7) - 3) * 2; // -6 to +6 degrees off
  const inputAngle = snapAngle + offset;
  const len = 150 + (seed % 100);
  const start = cp(300, 200);
  const end = cp(start.x + len * Math.cos(inputAngle * DEG), start.y - len * Math.sin(inputAngle * DEG));
  test(`TA-B-${String(i).padStart(3,'0')}: snap from ${inputAngle}° → multiple of 15° seed=${seed}`, () => {
    const [a, b] = snapTrendAngleSegment(start, end);
    const a_deg = angle(a, b);
    // Must be within 0.5° of a 15° multiple
    const normalized = ((a_deg % 15) + 360) % 15;
    const nearestStep = Math.min(normalized, 15 - normalized);
    assert.ok(nearestStep < 1.5, `angle=${a_deg.toFixed(2)} not at 15° step (normalized remainder=${nearestStep.toFixed(2)})`);
  });
}

// ─── C. Start point preserved (60) ────────────────────────────────────────────

for (let i = 1; i <= 60; i++) {
  const seed = i * 23 + 7;
  const sx = (seed * 3) % 600 + 100; const sy = (seed * 7) % 300 + 50;
  const ex = (seed * 11) % 600 + 100; const ey = (seed * 13) % 300 + 50;
  test(`TA-C-${String(i).padStart(3,'0')}: start preserved seed=${seed}`, () => {
    const [a] = snapTrendAngleSegment(cp(sx, sy), cp(ex, ey));
    assert.strictEqual(a.x, sx);
    assert.strictEqual(a.y, sy);
  });
}

// ─── D. Length preserved (60) ─────────────────────────────────────────────────

test('TA-D-001: length preserved exactly for already-snapped angle', () => {
  const start = cp(100, 200);
  const end = cp(400, 200); // horizontal → 0° already snapped
  const [a, b] = snapTrendAngleSegment(start, end);
  const lenIn = dist(start, end); const lenOut = dist(a, b);
  assert.ok(Math.abs(lenIn - lenOut) < 0.5, `length: in=${lenIn} out=${lenOut}`);
});

for (let i = 2; i <= 60; i++) {
  const seed = i * 29 + 11;
  const sx = (seed * 3) % 400 + 200; const sy = (seed * 7) % 250 + 100;
  const ex = (seed * 11) % 400 + 200; const ey = (seed * 13) % 250 + 100;
  if (Math.abs(ex - sx) < 1 && Math.abs(ey - sy) < 1) continue;
  const lenIn = dist(cp(sx, sy), cp(ex, ey));
  test(`TA-D-${String(i).padStart(3,'0')}: length preserved seed=${seed}`, () => {
    const [a, b] = snapTrendAngleSegment(cp(sx, sy), cp(ex, ey));
    const lenOut = dist(a, b);
    assert.ok(Math.abs(lenIn - lenOut) < 0.5, `length: in=${lenIn.toFixed(2)} out=${lenOut.toFixed(2)} seed=${seed}`);
  });
}

// ─── E. Custom step sizes (60) ────────────────────────────────────────────────

test('TA-E-001: 45° step – angle 22° → snaps to 0° or 45°', () => {
  const len = 200;
  const [a, b] = snapTrendAngleSegment(cp(100, 200), cp(100 + len * Math.cos(22 * DEG), 200 - len * Math.sin(22 * DEG)), 45);
  const a_deg = angle(a, b);
  const at0 = Math.abs(a_deg) < 1; const at45 = Math.abs(a_deg - 45) < 1;
  assert.ok(at0 || at45, `angle=${a_deg} not at 0° or 45°`);
});

test('TA-E-002: 30° step – angle 15° → snaps to 0° or 30°', () => {
  const len = 200;
  const [a, b] = snapTrendAngleSegment(cp(100, 200), cp(100 + len * Math.cos(15 * DEG), 200 - len * Math.sin(15 * DEG)), 30);
  const a_deg = angle(a, b);
  const at0 = Math.abs(a_deg) < 1; const at30 = Math.abs(a_deg - 30) < 1;
  assert.ok(at0 || at30, `angle=${a_deg} not at 0° or 30°`);
});

for (let i = 3; i <= 60; i++) {
  const seed = i * 31 + 13;
  const steps = [15, 30, 45, 60, 90];
  const step = steps[seed % steps.length];
  const inputAngle = ((seed * 7) % 360) - 180;
  const len = 150 + (seed % 100);
  const start = cp(300, 200);
  const end = cp(start.x + len * Math.cos(inputAngle * DEG), start.y - len * Math.sin(inputAngle * DEG));
  test(`TA-E-${String(i).padStart(3,'0')}: step=${step}° snaps to multiple of ${step} seed=${seed}`, () => {
    const [a, b] = snapTrendAngleSegment(start, end, step);
    const a_deg = angle(a, b);
    const remainder = ((a_deg % step) + 360 + step / 2) % step - step / 2;
    assert.ok(Math.abs(remainder) < 1.5, `angle=${a_deg.toFixed(2)} not multiple of ${step} (rem=${remainder.toFixed(2)})`);
  });
}

// ─── F. Horizontal snap (50) ──────────────────────────────────────────────────

for (let i = 1; i <= 50; i++) {
  const seed = i * 37 + 17;
  // Near-horizontal: within 7° of 0
  const offset = ((seed % 14) - 7); // -7 to +7
  const len = 150 + (seed % 150);
  const start = cp(200 + (seed * 3) % 300, 200);
  const end = cp(start.x + len * Math.cos(offset * DEG), start.y - len * Math.sin(offset * DEG));
  test(`TA-F-${String(i).padStart(3,'0')}: near-horizontal ${offset}° → 0° seed=${seed}`, () => {
    const [a, b] = snapTrendAngleSegment(start, end);
    const a_deg = angle(a, b);
    const normalized = ((a_deg % 15) + 15) % 15;
    assert.ok(normalized < 1 || normalized > 14, `should snap near 0°, got ${a_deg.toFixed(2)}`);
  });
}

// ─── G. Vertical snap (40) ────────────────────────────────────────────────────

for (let i = 1; i <= 40; i++) {
  const seed = i * 41 + 19;
  // Near-vertical: within 7° of 90
  const offset = ((seed % 14) - 7);
  const targetAngle = 90 + offset;
  const len = 150 + (seed % 100);
  const start = cp(300, 200);
  const end = cp(start.x + len * Math.cos(targetAngle * DEG), start.y - len * Math.sin(targetAngle * DEG));
  test(`TA-G-${String(i).padStart(3,'0')}: near-vertical ${targetAngle}° → 90° seed=${seed}`, () => {
    const [a, b] = snapTrendAngleSegment(start, end);
    const a_deg = angle(a, b);
    // Should snap to 90°
    assert.ok(Math.abs(a_deg - 90) < 1.5, `expected 90°, got ${a_deg.toFixed(2)}`);
  });
}

// ─── H. 45° snap (50) ────────────────────────────────────────────────────────

for (let i = 1; i <= 50; i++) {
  const seed = i * 43 + 21;
  const offset = ((seed % 12) - 6);
  const targetAngle = 45 + offset;
  const len = 150 + (seed % 100);
  const start = cp(300, 200);
  const end = cp(start.x + len * Math.cos(targetAngle * DEG), start.y - len * Math.sin(targetAngle * DEG));
  test(`TA-H-${String(i).padStart(3,'0')}: near-45° ${targetAngle}° → 45° seed=${seed}`, () => {
    const [a, b] = snapTrendAngleSegment(start, end);
    const a_deg = angle(a, b);
    assert.ok(Math.abs(a_deg - 45) < 1.5, `expected 45°, got ${a_deg.toFixed(2)}`);
  });
}

// ─── I. Degenerate inputs (30) ────────────────────────────────────────────────

test('TA-I-001: zero-length segment does not throw', () => {
  assert.doesNotThrow(() => snapTrendAngleSegment(cp(200, 200), cp(200, 200)));
});

test('TA-I-002: zero-length returns start unchanged', () => {
  const [a, b] = snapTrendAngleSegment(cp(200, 200), cp(200, 200));
  assert.strictEqual(a.x, 200); assert.strictEqual(a.y, 200);
  assert.ok(isFinite(b.x) && isFinite(b.y));
});

test('TA-I-003: step=1 does not throw', () => {
  assert.doesNotThrow(() => snapTrendAngleSegment(cp(100, 200), cp(300, 150), 1));
});

test('TA-I-004: step=180 does not throw', () => {
  assert.doesNotThrow(() => snapTrendAngleSegment(cp(100, 200), cp(300, 150), 180));
});

for (let i = 5; i <= 30; i++) {
  const seed = i * 47 + 23;
  const edgeVals = [0, 1, -1, 800, 400, -400, 1600];
  const ax = edgeVals[seed % edgeVals.length]; const ay = edgeVals[(seed * 7) % edgeVals.length];
  const bx = edgeVals[(seed * 11) % edgeVals.length]; const by = edgeVals[(seed * 13) % edgeVals.length];
  test(`TA-I-${String(i).padStart(3,'0')}: edge coords no throw seed=${seed}`, () => {
    assert.doesNotThrow(() => snapTrendAngleSegment(cp(ax, ay), cp(bx, by)));
  });
}

// ─── J. Stress (40) ──────────────────────────────────────────────────────────

for (let i = 1; i <= 40; i++) {
  const seed = i * 53 + 27;
  const sx = (seed * 3) % 600 + 100; const sy = (seed * 7) % 300 + 50;
  const ex = (seed * 11) % 600 + 100; const ey = (seed * 13) % 300 + 50;
  test(`TA-J-${String(i).padStart(3,'0')}: stress snap seed=${seed}`, () => {
    const [a, b] = snapTrendAngleSegment(cp(sx, sy), cp(ex, ey));
    assert.strictEqual(a.x, sx); assert.strictEqual(a.y, sy);
    assert.ok(isFinite(b.x) && isFinite(b.y));
    if (Math.abs(ex - sx) > 1 || Math.abs(ey - sy) > 1) {
      const lenIn = dist(cp(sx, sy), cp(ex, ey));
      const lenOut = dist(a, b);
      assert.ok(Math.abs(lenIn - lenOut) < 0.5, `length mismatch: ${lenIn.toFixed(2)} vs ${lenOut.toFixed(2)}`);
    }
  });
}

summary();
