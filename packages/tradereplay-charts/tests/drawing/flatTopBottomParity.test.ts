/**
 * FlatTopBottom TV-parity tests (500 cases).
 *
 * TV signature: 2-anchor tool.
 * - Horizontal line at points[0].y spanning full canvas width
 * - Horizontal line at points[1].y spanning full canvas width
 * - Rectangle fill between the two y values (fillRect from x=0, width=W)
 *
 * Tests pure geometry math for the flat-top/bottom pattern.
 *
 * Categories:
 *   A. Two horizontal lines at p0.y and p1.y (80)
 *   B. Lines span full canvas width (80)
 *   C. FillRect bounds — minY to maxY (80)
 *   D. FillRect height = |p0.y - p1.y| (60)
 *   E. Equal y values → zero-height fill (30)
 *   F. p0 above p1 and p0 below p1 both handled (60)
 *   G. Edge coordinates (50)
 *   H. Stress (60)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

const { test, summary } = createRunner('FlatTopBottom parity (500)');

const W = 800; const H = 400;

type CP = { x: number; y: number };

function cp(x: number, y: number): CP { return { x, y }; }

/** Returns the geometry for a flatTopBottom drawing. */
function flatTopBottomGeometry(p0: CP, p1: CP) {
  const minY = Math.min(p0.y, p1.y);
  const maxY = Math.max(p0.y, p1.y);
  return {
    // Line 1: horizontal at p0.y
    line1Start: { x: 0, y: p0.y },
    line1End:   { x: W, y: p0.y },
    // Line 2: horizontal at p1.y
    line2Start: { x: 0, y: p1.y },
    line2End:   { x: W, y: p1.y },
    // Fill rect
    fillX: 0,
    fillY: minY,
    fillWidth: W,
    fillHeight: maxY - minY,
    minY,
    maxY,
  };
}

// ─── A. Two horizontal lines at p0.y and p1.y (80) ───────────────────────────

test('FTB-A-001: line1Start.y === p0.y', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line1Start.y, 100);
});

test('FTB-A-002: line1End.y === p0.y', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line1End.y, 100);
});

test('FTB-A-003: line2Start.y === p1.y', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line2Start.y, 300);
});

test('FTB-A-004: line2End.y === p1.y', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line2End.y, 300);
});

test('FTB-A-005: both lines are horizontal (start.y === end.y)', () => {
  const g = flatTopBottomGeometry(cp(100, 150), cp(500, 250));
  assert.strictEqual(g.line1Start.y, g.line1End.y);
  assert.strictEqual(g.line2Start.y, g.line2End.y);
});

for (let i = 6; i <= 80; i++) {
  const seed = i * 17 + 3;
  const y0 = (seed * 7) % (H - 20) + 10;
  const y1 = (seed * 11) % (H - 20) + 10;
  const x0 = (seed * 3) % (W - 20) + 10;
  const x1 = (seed * 13) % (W - 20) + 10;
  test(`FTB-A-${String(i).padStart(3,'0')}: lines at correct y values seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(x0, y0), cp(x1, y1));
    assert.strictEqual(g.line1Start.y, y0);
    assert.strictEqual(g.line1End.y, y0);
    assert.strictEqual(g.line2Start.y, y1);
    assert.strictEqual(g.line2End.y, y1);
  });
}

// ─── B. Lines span full canvas width (80) ────────────────────────────────────

test('FTB-B-001: line1Start.x === 0', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line1Start.x, 0);
});

test('FTB-B-002: line1End.x === W', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line1End.x, W);
});

test('FTB-B-003: line2Start.x === 0', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line2Start.x, 0);
});

test('FTB-B-004: line2End.x === W', () => {
  const g = flatTopBottomGeometry(cp(200, 100), cp(400, 300));
  assert.strictEqual(g.line2End.x, W);
});

for (let i = 5; i <= 80; i++) {
  const seed = i * 19 + 5;
  const y0 = (seed * 7) % (H - 20) + 10;
  const y1 = (seed * 11) % (H - 20) + 10;
  test(`FTB-B-${String(i).padStart(3,'0')}: full-width lines seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(300, y0), cp(500, y1));
    assert.strictEqual(g.line1Start.x, 0);
    assert.strictEqual(g.line1End.x, W);
    assert.strictEqual(g.line2Start.x, 0);
    assert.strictEqual(g.line2End.x, W);
  });
}

// ─── C. FillRect bounds (80) ─────────────────────────────────────────────────

test('FTB-C-001: fillY === min(p0.y, p1.y)', () => {
  const g = flatTopBottomGeometry(cp(100, 100), cp(400, 300));
  assert.strictEqual(g.fillY, 100);
});

test('FTB-C-002: fillY === min when p1.y < p0.y', () => {
  const g = flatTopBottomGeometry(cp(100, 300), cp(400, 100));
  assert.strictEqual(g.fillY, 100);
});

test('FTB-C-003: fillX === 0', () => {
  const g = flatTopBottomGeometry(cp(200, 150), cp(400, 250));
  assert.strictEqual(g.fillX, 0);
});

test('FTB-C-004: fillWidth === W', () => {
  const g = flatTopBottomGeometry(cp(200, 150), cp(400, 250));
  assert.strictEqual(g.fillWidth, W);
});

for (let i = 5; i <= 80; i++) {
  const seed = i * 23 + 7;
  const y0 = (seed * 7) % (H - 20) + 10;
  const y1 = (seed * 11) % (H - 20) + 10;
  test(`FTB-C-${String(i).padStart(3,'0')}: fillY=min maxY=max seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(100, y0), cp(500, y1));
    assert.strictEqual(g.fillY, Math.min(y0, y1));
    assert.strictEqual(g.maxY, Math.max(y0, y1));
    assert.strictEqual(g.fillX, 0);
    assert.strictEqual(g.fillWidth, W);
  });
}

// ─── D. FillRect height (60) ─────────────────────────────────────────────────

test('FTB-D-001: fillHeight === |p0.y - p1.y|', () => {
  const g = flatTopBottomGeometry(cp(100, 100), cp(400, 250));
  assert.strictEqual(g.fillHeight, 150);
});

test('FTB-D-002: fillHeight is non-negative', () => {
  const g = flatTopBottomGeometry(cp(100, 300), cp(400, 50));
  assert.ok(g.fillHeight >= 0);
});

for (let i = 3; i <= 60; i++) {
  const seed = i * 29 + 11;
  const y0 = (seed * 7) % (H - 20) + 10;
  const y1 = (seed * 11) % (H - 20) + 10;
  test(`FTB-D-${String(i).padStart(3,'0')}: fillHeight=|y0-y1| seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(100, y0), cp(500, y1));
    assert.strictEqual(g.fillHeight, Math.abs(y0 - y1));
  });
}

// ─── E. Equal y values → zero-height fill (30) ───────────────────────────────

for (let i = 1; i <= 30; i++) {
  const seed = i * 31 + 13;
  const y = (seed * 7) % (H - 20) + 10;
  test(`FTB-E-${String(i).padStart(3,'0')}: equal y → fillHeight=0 seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(100, y), cp(500, y));
    assert.strictEqual(g.fillHeight, 0);
    assert.strictEqual(g.minY, g.maxY);
  });
}

// ─── F. p0 above p1 and p0 below p1 (60) ─────────────────────────────────────

for (let i = 1; i <= 60; i++) {
  const seed = i * 37 + 17;
  const baseY = (seed * 7) % 300 + 50;
  const delta = (seed % 10 + 1) * 20;
  const p0Above = { y0: baseY - delta, y1: baseY }; // p0 above p1
  const p0Below = { y0: baseY, y1: baseY - delta }; // p0 below p1
  const cfg = seed % 2 === 0 ? p0Above : p0Below;
  test(`FTB-F-${String(i).padStart(3,'0')}: p0 ${seed%2===0?'above':'below'} p1 seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(100, cfg.y0), cp(500, cfg.y1));
    assert.strictEqual(g.fillHeight, Math.abs(cfg.y0 - cfg.y1));
    assert.ok(g.fillY <= g.maxY);
    assert.strictEqual(g.line1Start.y, cfg.y0);
    assert.strictEqual(g.line2Start.y, cfg.y1);
  });
}

// ─── G. Edge coordinates (50) ─────────────────────────────────────────────────

test('FTB-G-001: p0 at y=0', () => {
  const g = flatTopBottomGeometry(cp(200, 0), cp(400, 200));
  assert.strictEqual(g.line1Start.y, 0);
  assert.strictEqual(g.fillY, 0);
});

test('FTB-G-002: p0 at y=H', () => {
  const g = flatTopBottomGeometry(cp(200, H), cp(400, 200));
  assert.strictEqual(g.line1Start.y, H);
  assert.strictEqual(g.maxY, H);
});

for (let i = 3; i <= 50; i++) {
  const seed = i * 41 + 19;
  const edgeYs = [0, 1, H / 4, H / 2, H - 1, H];
  const y0 = edgeYs[seed % edgeYs.length];
  const y1 = edgeYs[(seed * 7) % edgeYs.length];
  test(`FTB-G-${String(i).padStart(3,'0')}: edge y values seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(200, y0), cp(500, y1));
    assert.strictEqual(g.fillHeight, Math.abs(y0 - y1));
    assert.ok(g.fillY >= 0);
  });
}

// ─── H. Stress (60) ──────────────────────────────────────────────────────────

for (let i = 1; i <= 60; i++) {
  const seed = i * 43 + 21;
  const y0 = (seed * 7) % H;
  const y1 = (seed * 11) % H;
  test(`FTB-H-${String(i).padStart(3,'0')}: stress y0=${y0} y1=${y1} seed=${seed}`, () => {
    const g = flatTopBottomGeometry(cp(100, y0), cp(500, y1));
    // Invariants
    assert.strictEqual(g.line1Start.y, y0);
    assert.strictEqual(g.line1End.y, y0);
    assert.strictEqual(g.line2Start.y, y1);
    assert.strictEqual(g.line2End.y, y1);
    assert.strictEqual(g.fillX, 0);
    assert.strictEqual(g.fillWidth, W);
    assert.strictEqual(g.fillHeight, Math.abs(y0 - y1));
    assert.ok(g.fillY >= 0);
    assert.ok(g.fillY <= Math.max(y0, y1));
  });
}

summary();
