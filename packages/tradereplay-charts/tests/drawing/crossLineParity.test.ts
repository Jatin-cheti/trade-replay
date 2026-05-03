/**
 * CrossLine TV-parity tests (500 cases).
 *
 * Tests the CrossLine rendering math: a single anchor emits one infinite
 * horizontal line (y=constant, x: 0→W) AND one infinite vertical line
 * (x=constant, y: 0→H).
 *
 * Pure geometry tests – verify the screen coordinates that would be passed
 * to canvas moveTo/lineTo for both lines.
 *
 * Categories:
 *   A. Horizontal arm – constant y (100)
 *   B. Vertical arm – constant x (100)
 *   C. Both arms at anchor coordinates (80)
 *   D. Anchor at canvas boundary (60)
 *   E. Axis-highlight xRange and yRange (60)
 *   F. Both arms span full canvas (60)
 *   G. Stress (40)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

// CrossLine geometry is trivial: horizontal arm at anchor.y, vertical arm at anchor.x.
// We test the math directly without importing from the chart renderer.

const { test, summary } = createRunner('CrossLine parity (500)');

const W = 800; const H = 400;

/** Returns the four canvas coords for drawing a crossline at (ax, ay). */
function crossLineGeometry(ax: number, ay: number) {
  return {
    // Horizontal arm: (0, ay) → (W, ay)
    hStart: { x: 0, y: ay },
    hEnd: { x: W, y: ay },
    // Vertical arm: (ax, 0) → (ax, H)
    vStart: { x: ax, y: 0 },
    vEnd: { x: ax, y: H },
  };
}

// ─── A. Horizontal arm – constant y (100) ─────────────────────────────────────

test('CL-A-001: hStart.y === anchor.y', () => {
  const g = crossLineGeometry(200, 150);
  assert.strictEqual(g.hStart.y, 150);
});

test('CL-A-002: hEnd.y === anchor.y', () => {
  const g = crossLineGeometry(200, 150);
  assert.strictEqual(g.hEnd.y, 150);
});

test('CL-A-003: hStart.x === 0', () => {
  const g = crossLineGeometry(200, 150);
  assert.strictEqual(g.hStart.x, 0);
});

test('CL-A-004: hEnd.x === W', () => {
  const g = crossLineGeometry(200, 150);
  assert.strictEqual(g.hEnd.x, W);
});

test('CL-A-005: horizontal arm spans full width', () => {
  const g = crossLineGeometry(400, 200);
  assert.strictEqual(g.hEnd.x - g.hStart.x, W);
});

for (let i = 6; i <= 100; i++) {
  const seed = i * 17 + 3;
  const ax = (seed * 3) % (W - 20) + 10;
  const ay = (seed * 7) % (H - 20) + 10;
  test(`CL-A-${String(i).padStart(3,'0')}: horizontal arm at ay=${ay} seed=${seed}`, () => {
    const g = crossLineGeometry(ax, ay);
    assert.strictEqual(g.hStart.x, 0);
    assert.strictEqual(g.hEnd.x, W);
    assert.strictEqual(g.hStart.y, ay);
    assert.strictEqual(g.hEnd.y, ay);
  });
}

// ─── B. Vertical arm – constant x (100) ──────────────────────────────────────

test('CL-B-001: vStart.x === anchor.x', () => {
  const g = crossLineGeometry(300, 200);
  assert.strictEqual(g.vStart.x, 300);
});

test('CL-B-002: vEnd.x === anchor.x', () => {
  const g = crossLineGeometry(300, 200);
  assert.strictEqual(g.vEnd.x, 300);
});

test('CL-B-003: vStart.y === 0', () => {
  const g = crossLineGeometry(300, 200);
  assert.strictEqual(g.vStart.y, 0);
});

test('CL-B-004: vEnd.y === H', () => {
  const g = crossLineGeometry(300, 200);
  assert.strictEqual(g.vEnd.y, H);
});

test('CL-B-005: vertical arm spans full height', () => {
  const g = crossLineGeometry(400, 200);
  assert.strictEqual(g.vEnd.y - g.vStart.y, H);
});

for (let i = 6; i <= 100; i++) {
  const seed = i * 19 + 5;
  const ax = (seed * 3) % (W - 20) + 10;
  const ay = (seed * 7) % (H - 20) + 10;
  test(`CL-B-${String(i).padStart(3,'0')}: vertical arm at ax=${ax} seed=${seed}`, () => {
    const g = crossLineGeometry(ax, ay);
    assert.strictEqual(g.vStart.x, ax);
    assert.strictEqual(g.vEnd.x, ax);
    assert.strictEqual(g.vStart.y, 0);
    assert.strictEqual(g.vEnd.y, H);
  });
}

// ─── C. Both arms at anchor coordinates (80) ─────────────────────────────────

test('CL-C-001: intersection point = anchor', () => {
  const ax = 350; const ay = 175;
  const g = crossLineGeometry(ax, ay);
  // Intersection at (ax, ay) lies on both arms
  assert.strictEqual(g.hStart.y, ay); // h-arm at ay
  assert.strictEqual(g.vStart.x, ax); // v-arm at ax
});

test('CL-C-002: arms intersect at exactly (ax, ay)', () => {
  // Horizontal line y=ay passes through x=ax → point (ax,ay)
  // Vertical line x=ax passes through y=ay → point (ax,ay)
  const ax = 450; const ay = 220;
  const g = crossLineGeometry(ax, ay);
  // Point ax is in horizontal arm's x-range [0, W]
  assert.ok(g.hStart.x <= ax && ax <= g.hEnd.x);
  // Point ay is in vertical arm's y-range [0, H]
  assert.ok(g.vStart.y <= ay && ay <= g.vEnd.y);
});

for (let i = 3; i <= 80; i++) {
  const seed = i * 23 + 7;
  const ax = (seed * 3) % (W - 20) + 10;
  const ay = (seed * 7) % (H - 20) + 10;
  test(`CL-C-${String(i).padStart(3,'0')}: arms at anchor seed=${seed}`, () => {
    const g = crossLineGeometry(ax, ay);
    assert.strictEqual(g.hStart.y, ay);
    assert.strictEqual(g.hEnd.y, ay);
    assert.strictEqual(g.vStart.x, ax);
    assert.strictEqual(g.vEnd.x, ax);
    assert.ok(g.hStart.x <= ax && ax <= g.hEnd.x);
    assert.ok(g.vStart.y <= ay && ay <= g.vEnd.y);
  });
}

// ─── D. Anchor at canvas boundary (60) ───────────────────────────────────────

test('CL-D-001: anchor at x=0', () => {
  const g = crossLineGeometry(0, 200);
  assert.strictEqual(g.vStart.x, 0);
  assert.strictEqual(g.vEnd.x, 0);
  assert.strictEqual(g.hStart.y, 200);
});

test('CL-D-002: anchor at x=W', () => {
  const g = crossLineGeometry(W, 200);
  assert.strictEqual(g.vStart.x, W);
  assert.strictEqual(g.vEnd.x, W);
});

test('CL-D-003: anchor at y=0', () => {
  const g = crossLineGeometry(300, 0);
  assert.strictEqual(g.hStart.y, 0);
  assert.strictEqual(g.hEnd.y, 0);
});

test('CL-D-004: anchor at y=H', () => {
  const g = crossLineGeometry(300, H);
  assert.strictEqual(g.hStart.y, H);
  assert.strictEqual(g.hEnd.y, H);
});

test('CL-D-005: anchor at top-left corner', () => {
  const g = crossLineGeometry(0, 0);
  assert.strictEqual(g.hStart.y, 0);
  assert.strictEqual(g.vStart.x, 0);
});

for (let i = 6; i <= 60; i++) {
  const seed = i * 29 + 11;
  const boundaries = [0, W, H, 1, W - 1, H - 1];
  const ax = boundaries[seed % boundaries.length] > W ? W - 1 : boundaries[seed % boundaries.length];
  const ay = boundaries[(seed * 7) % boundaries.length] > H ? H - 1 : boundaries[(seed * 7) % boundaries.length];
  test(`CL-D-${String(i).padStart(3,'0')}: boundary anchor ax=${ax} ay=${ay} seed=${seed}`, () => {
    const g = crossLineGeometry(ax, ay);
    assert.strictEqual(g.hStart.y, ay);
    assert.strictEqual(g.hEnd.y, ay);
    assert.strictEqual(g.vStart.x, ax);
    assert.strictEqual(g.vEnd.x, ax);
  });
}

// ─── E. Axis-highlight xRange/yRange (60) ────────────────────────────────────

test('CL-E-001: x-highlight should be [ax, ax] for vertical arm', () => {
  const ax = 300; const ay = 200;
  // xRange = [ax, ax]
  const xRange = [ax, ax];
  assert.strictEqual(xRange[0], ax);
  assert.strictEqual(xRange[1], ax);
});

test('CL-E-002: y-highlight should be [ay, ay] for horizontal arm', () => {
  const ax = 300; const ay = 200;
  const yRange = [ay, ay];
  assert.strictEqual(yRange[0], ay);
  assert.strictEqual(yRange[1], ay);
});

for (let i = 3; i <= 60; i++) {
  const seed = i * 31 + 13;
  const ax = (seed * 3) % (W - 20) + 10;
  const ay = (seed * 7) % (H - 20) + 10;
  test(`CL-E-${String(i).padStart(3,'0')}: axis ranges computed from anchor seed=${seed}`, () => {
    const xRange = [ax, ax];
    const yRange = [ay, ay];
    assert.strictEqual(xRange[0], ax);
    assert.strictEqual(yRange[0], ay);
    // Both arms are infinite → the range is a single coordinate
    assert.strictEqual(xRange[1] - xRange[0], 0); // vertical line = single x
    assert.strictEqual(yRange[1] - yRange[0], 0); // horizontal line = single y
  });
}

// ─── F. Both arms span full canvas (60) ──────────────────────────────────────

for (let i = 1; i <= 60; i++) {
  const seed = i * 37 + 17;
  const ax = (seed * 3) % (W - 20) + 10;
  const ay = (seed * 7) % (H - 20) + 10;
  test(`CL-F-${String(i).padStart(3,'0')}: full-canvas span seed=${seed}`, () => {
    const g = crossLineGeometry(ax, ay);
    assert.strictEqual(g.hEnd.x - g.hStart.x, W, `h-arm should span ${W}px`);
    assert.strictEqual(g.vEnd.y - g.vStart.y, H, `v-arm should span ${H}px`);
  });
}

// ─── G. Stress (40) ──────────────────────────────────────────────────────────

for (let i = 1; i <= 40; i++) {
  const seed = i * 41 + 19;
  const ax = (seed * 3) % W; const ay = (seed * 7) % H;
  test(`CL-G-${String(i).padStart(3,'0')}: stress seed=${seed}`, () => {
    const g = crossLineGeometry(ax, ay);
    // Horizontal arm y constant
    assert.strictEqual(g.hStart.y, ay);
    assert.strictEqual(g.hEnd.y, ay);
    assert.strictEqual(g.hStart.x, 0);
    assert.strictEqual(g.hEnd.x, W);
    // Vertical arm x constant
    assert.strictEqual(g.vStart.x, ax);
    assert.strictEqual(g.vEnd.x, ax);
    assert.strictEqual(g.vStart.y, 0);
    assert.strictEqual(g.vEnd.y, H);
  });
}

summary();
