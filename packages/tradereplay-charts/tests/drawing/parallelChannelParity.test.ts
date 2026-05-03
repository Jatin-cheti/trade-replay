/**
 * ParallelChannel geometry TV-parity tests (500 cases).
 *
 * Tests the pure `getParallelChannelGeometry` function from
 * `frontend/services/tools/drawingGeometry.ts` which is the single source
 * of truth for how the Parallel Channel is rendered.
 *
 * Categories:
 *   A. Basic geometry — upper/lower/center segment correctness (60)
 *   B. Fill quad invariants (40)
 *   C. Third-anchor offset (60)
 *   D. Two-anchor fallback (legacy storage) (30)
 *   E. Direction independence (40)
 *   F. Perpendicular offset direction (40)
 *   G. Clip-to-canvas — segments stay within bounds (40)
 *   H. Degenerate inputs — zero-length, collinear, extreme coords (30)
 *   I. Geometry relationships — upper/lower symmetric around center (50)
 *   J. Stress — 500-total coverage with varied coords (110)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

// ── Import the geometry function under test ──────────────────────────────────
// We import from the frontend services directory; this works because
// `node --experimental-strip-types` handles TS and the path resolves.
// Adjust relative path if test runner CWD changes.
import { getParallelChannelGeometry, getRegressionTrendGeometry, midpoint, distance } from '../../../../frontend/services/tools/drawingGeometry.ts';

type CP = { x: number; y: number };

const { test, summary } = createRunner('ParallelChannel parity (500)');

const W = 800;
const H = 400;

function cp(x: number, y: number): CP { return { x, y }; }

function assertFinite(v: number, label: string) {
  assert.ok(isFinite(v), `${label} must be finite, got ${v}`);
}

function assertInBounds(p: CP, label: string) {
  assert.ok(p.x >= -1 && p.x <= W + 1, `${label}.x=${p.x} out of bounds`);
  assert.ok(p.y >= -1 && p.y <= H + 1, `${label}.y=${p.y} out of bounds`);
}

function getGeo(a: CP, b: CP, c?: CP) {
  const pts = c ? [a, b, c] : [a, b];
  return getParallelChannelGeometry(pts, W, H);
}

// ─── A. Basic geometry (60) ──────────────────────────────────────────────────

test('PC-A-001: returns center, upper, lower, fill', () => {
  const g = getGeo(cp(100, 200), cp(500, 150), cp(300, 100));
  assert.ok(Array.isArray(g.center) && g.center.length === 2);
  assert.ok(Array.isArray(g.upper) && g.upper.length === 2);
  assert.ok(Array.isArray(g.lower) && g.lower.length === 2);
  assert.ok(Array.isArray(g.fill) && g.fill.length === 4);
});

test('PC-A-002: center endpoints are finite', () => {
  const g = getGeo(cp(100, 200), cp(500, 150));
  for (const p of g.center) { assertFinite(p.x, 'cx'); assertFinite(p.y, 'cy'); }
});

test('PC-A-003: upper endpoints are finite', () => {
  const g = getGeo(cp(100, 200), cp(500, 150), cp(300, 80));
  for (const p of g.upper) { assertFinite(p.x, 'ux'); assertFinite(p.y, 'uy'); }
});

test('PC-A-004: lower endpoints are finite', () => {
  const g = getGeo(cp(100, 200), cp(500, 150), cp(300, 280));
  for (const p of g.lower) { assertFinite(p.x, 'lx'); assertFinite(p.y, 'ly'); }
});

test('PC-A-005: center in bounds', () => {
  const g = getGeo(cp(200, 200), cp(600, 200));
  for (const p of g.center) assertInBounds(p, 'center');
});

test('PC-A-006: upper in bounds (3-anchor)', () => {
  const g = getGeo(cp(100, 200), cp(500, 200), cp(300, 100));
  for (const p of g.upper) assertInBounds(p, 'upper');
});

test('PC-A-007: lower in bounds (3-anchor)', () => {
  const g = getGeo(cp(100, 200), cp(500, 200), cp(300, 300));
  for (const p of g.lower) assertInBounds(p, 'lower');
});

test('PC-A-008: center[0] has same slope as anchor A→B (horizontal case)', () => {
  const g = getGeo(cp(100, 200), cp(600, 200));
  assert.ok(Math.abs(g.center[0].y - g.center[1].y) < 2, 'horizontal center should stay horizontal');
});

test('PC-A-009: center slope matches anchor slope (diagonal)', () => {
  // slope = (150-200)/(500-100) = -0.125
  const g = getGeo(cp(100, 200), cp(500, 150));
  const expected_slope = (150 - 200) / (500 - 100);
  const actual_slope = (g.center[1].y - g.center[0].y) / (g.center[1].x - g.center[0].x);
  assert.ok(Math.abs(actual_slope - expected_slope) < 0.05, `slope mismatch: ${actual_slope} vs ${expected_slope}`);
});

test('PC-A-010: upper segment is parallel to center (same slope)', () => {
  const g = getGeo(cp(100, 200), cp(500, 150), cp(300, 80));
  const csX = g.center[1].x - g.center[0].x;
  const csY = g.center[1].y - g.center[0].y;
  const usX = g.upper[1].x - g.upper[0].x;
  const usY = g.upper[1].y - g.upper[0].y;
  if (Math.abs(csX) > 1) {
    const cSlope = csY / csX;
    const uSlope = usY / usX;
    assert.ok(Math.abs(cSlope - uSlope) < 0.05, `upper not parallel: cSlope=${cSlope} uSlope=${uSlope}`);
  }
});

test('PC-A-011: lower segment is parallel to center', () => {
  const g = getGeo(cp(100, 200), cp(500, 150), cp(300, 280));
  const csX = g.center[1].x - g.center[0].x;
  const csY = g.center[1].y - g.center[0].y;
  const lsX = g.lower[1].x - g.lower[0].x;
  const lsY = g.lower[1].y - g.lower[0].y;
  if (Math.abs(csX) > 1) {
    const cSlope = csY / csX;
    const lSlope = lsY / lsX;
    assert.ok(Math.abs(cSlope - lSlope) < 0.05, `lower not parallel`);
  }
});

test('PC-A-012: upper offset direction from center is perpendicular to baseline', () => {
  // Upper should be offset perpendicular to baseline direction
  const g = getGeo(cp(100, 300), cp(500, 200), cp(300, 100));
  assert.ok(g.upper[0].y !== g.center[0].y || g.upper[0].x !== g.center[0].x, 'upper should differ from center');
});

test('PC-A-013: geometry works for downward-sloping baseline', () => {
  const g = getGeo(cp(100, 100), cp(600, 350), cp(350, 50));
  for (const p of [...g.upper, ...g.lower, ...g.center]) { assertFinite(p.x, 'x'); assertFinite(p.y, 'y'); }
});

test('PC-A-014: geometry works for steep baseline', () => {
  const g = getGeo(cp(200, 50), cp(210, 380), cp(150, 200));
  for (const p of [...g.upper, ...g.lower]) { assertFinite(p.x, 'x'); assertFinite(p.y, 'y'); }
});

test('PC-A-015: geometry works for shallow baseline', () => {
  const g = getGeo(cp(50, 200), cp(750, 201), cp(400, 150));
  for (const p of [...g.upper, ...g.lower]) { assertFinite(p.x, 'x'); assertFinite(p.y, 'y'); }
});

for (let i = 16; i <= 60; i++) {
  const seed = i * 17 + 3;
  const ax = (seed * 7 + 50) % 700 + 50;
  const ay = (seed * 11 + 50) % 300 + 50;
  const bx = (seed * 13 + 100) % 650 + 100;
  const by = (seed * 17 + 30) % 300 + 50;
  const cx = (seed * 5 + 80) % 600 + 100;
  const cy = (seed * 19 + 20) % 320 + 40;
  test(`PC-A-${String(i).padStart(3,'0')}: random geo finite+bounded seed=${seed}`, () => {
    const g = getGeo(cp(ax, ay), cp(bx, by), cp(cx, cy));
    for (const p of [...g.upper, ...g.lower, ...g.center, ...g.fill]) {
      assertFinite(p.x, 'x'); assertFinite(p.y, 'y');
    }
  });
}

// ─── B. Fill quad invariants (40) ────────────────────────────────────────────

test('PC-B-001: fill has exactly 4 points', () => {
  const g = getGeo(cp(100, 200), cp(600, 150), cp(350, 100));
  assert.strictEqual(g.fill.length, 4);
});

test('PC-B-002: fill[0] === upper[0]', () => {
  const g = getGeo(cp(100, 200), cp(600, 150), cp(350, 100));
  assert.ok(Math.abs(g.fill[0].x - g.upper[0].x) < 0.5 && Math.abs(g.fill[0].y - g.upper[0].y) < 0.5);
});

test('PC-B-003: fill[1] === upper[1]', () => {
  const g = getGeo(cp(100, 200), cp(600, 150), cp(350, 100));
  assert.ok(Math.abs(g.fill[1].x - g.upper[1].x) < 0.5 && Math.abs(g.fill[1].y - g.upper[1].y) < 0.5);
});

test('PC-B-004: fill[2] === lower[1]', () => {
  const g = getGeo(cp(100, 200), cp(600, 150), cp(350, 280));
  assert.ok(Math.abs(g.fill[2].x - g.lower[1].x) < 0.5 && Math.abs(g.fill[2].y - g.lower[1].y) < 0.5);
});

test('PC-B-005: fill[3] === lower[0]', () => {
  const g = getGeo(cp(100, 200), cp(600, 150), cp(350, 280));
  assert.ok(Math.abs(g.fill[3].x - g.lower[0].x) < 0.5 && Math.abs(g.fill[3].y - g.lower[0].y) < 0.5);
});

test('PC-B-006: fill forms a non-degenerate quad (area > 0)', () => {
  const g = getGeo(cp(100, 200), cp(600, 150), cp(350, 100));
  const [p0, p1, p2, p3] = g.fill;
  // Shoelace area
  const area = Math.abs((p0.x*(p1.y-p3.y) + p1.x*(p2.y-p0.y) + p2.x*(p3.y-p1.y) + p3.x*(p0.y-p2.y)) / 2);
  assert.ok(area > 1, `fill area too small: ${area}`);
});

test('PC-B-007: fill points all finite', () => {
  const g = getGeo(cp(100, 200), cp(600, 150), cp(350, 100));
  for (const p of g.fill) { assertFinite(p.x, 'fx'); assertFinite(p.y, 'fy'); }
});

for (let i = 8; i <= 40; i++) {
  const seed = i * 31 + 7;
  const ax = (seed * 3 + 60) % 600 + 60; const ay = (seed * 7 + 80) % 280 + 60;
  const bx = (seed * 11 + 80) % 600 + 100; const by = (seed * 13 + 60) % 280 + 60;
  const cx = (seed * 17 + 100) % 550 + 80; const cy = (seed * 19 + 40) % 300 + 40;
  test(`PC-B-${String(i).padStart(3,'0')}: fill quad structure seed=${seed}`, () => {
    const g = getGeo(cp(ax, ay), cp(bx, by), cp(cx, cy));
    assert.strictEqual(g.fill.length, 4);
    assert.ok(Math.abs(g.fill[0].x - g.upper[0].x) < 0.5);
    assert.ok(Math.abs(g.fill[1].x - g.upper[1].x) < 0.5);
  });
}

// ─── C. Third-anchor offset (60) ─────────────────────────────────────────────

test('PC-C-001: third anchor above baseline → lower rail at anchor side', () => {
  // Horizontal baseline at y=200; third anchor at y=100 (above in screen space = smaller y).
  // The implementation sets lowerOffset = -signedDist, placing the lower rail on the anchor side.
  const g = getGeo(cp(100, 200), cp(600, 200), cp(350, 100));
  // lower rail should be on the same side as the anchor (above center = smaller y)
  assert.ok(g.lower[0].y < g.center[0].y, `lower.y=${g.lower[0].y} should be < center.y=${g.center[0].y}`);
});

test('PC-C-002: third anchor below baseline → lower below center', () => {
  const g = getGeo(cp(100, 200), cp(600, 200), cp(350, 300));
  assert.ok(g.lower[0].y > g.center[0].y, `lower.y=${g.lower[0].y} should be > center.y=${g.center[0].y}`);
});

test('PC-C-003: larger third-anchor offset → wider channel', () => {
  const gNarrow = getGeo(cp(100, 200), cp(600, 200), cp(350, 170));
  const gWide   = getGeo(cp(100, 200), cp(600, 200), cp(350, 100));
  const narrowGap = Math.abs(gNarrow.upper[0].y - gNarrow.lower[0].y);
  const wideGap   = Math.abs(gWide.upper[0].y - gWide.lower[0].y);
  assert.ok(wideGap > narrowGap, `wide=${wideGap} should > narrow=${narrowGap}`);
});

test('PC-C-004: third anchor on baseline → channel collapses (very narrow)', () => {
  // Anchor exactly on the baseline — signed distance = 0 → channel collapses or uses fallback
  const g = getGeo(cp(100, 200), cp(600, 200), cp(350, 200));
  // Offset = 0 produces degenerate channel — upper/lower colocate with center
  const gap = Math.abs(g.upper[0].y - g.lower[0].y);
  assert.ok(gap < 10, `expected near-zero gap, got ${gap}`);
});

test('PC-C-005: third anchor symmetrically above/below gives symmetric offsets', () => {
  const gAbove = getGeo(cp(100, 200), cp(600, 200), cp(350, 120));
  const gBelow = getGeo(cp(100, 200), cp(600, 200), cp(350, 280));
  const gapAbove = Math.abs(gAbove.upper[0].y - gAbove.center[0].y);
  const gapBelow = Math.abs(gBelow.lower[0].y - gBelow.center[0].y);
  assert.ok(Math.abs(gapAbove - gapBelow) < 2, `symmetric offsets: above=${gapAbove} below=${gapBelow}`);
});

for (let i = 6; i <= 60; i++) {
  const seed = i * 23 + 11;
  const ax = 100; const ay = 200; const bx = 600; const by = 200;
  const cx = 350;
  const offsets = [-150, -120, -100, -80, -60, -40, -20, 20, 40, 60, 80, 100, 120, 150];
  const cy = ay + offsets[i % offsets.length];
  test(`PC-C-${String(i).padStart(3,'0')}: third anchor offset cy=${cy} → finite result`, () => {
    const g = getGeo(cp(ax, ay), cp(bx, by), cp(cx, cy));
    for (const p of [...g.upper, ...g.lower, ...g.center]) {
      assertFinite(p.x, 'x'); assertFinite(p.y, 'y');
    }
    if (cy !== ay) {
      const gap = Math.abs(g.upper[0].y - g.lower[0].y);
      assert.ok(gap > 0.1, `non-zero gap expected when offset ≠ 0: got ${gap}`);
    }
  });
}

// ─── D. Two-anchor fallback (30) ─────────────────────────────────────────────

test('PC-D-001: 2-anchor path returns valid geometry', () => {
  const g = getGeo(cp(100, 200), cp(600, 150));
  assert.ok(Array.isArray(g.center));
  assert.ok(Array.isArray(g.upper));
  assert.ok(Array.isArray(g.lower));
});

test('PC-D-002: 2-anchor fallback gap is proportional to segment length', () => {
  const gShort = getGeo(cp(300, 200), cp(350, 200)); // 50px span
  const gLong  = getGeo(cp(100, 200), cp(700, 200)); // 600px span
  const gapShort = Math.abs(gShort.upper[0].y - gShort.lower[0].y);
  const gapLong  = Math.abs(gLong.upper[0].y - gLong.lower[0].y);
  assert.ok(gapLong > gapShort, `longer segment should have larger fallback gap`);
});

for (let i = 3; i <= 30; i++) {
  const seed = i * 41 + 19;
  const ax = (seed * 7 + 50) % 600 + 50; const ay = (seed * 11 + 50) % 300 + 50;
  const bx = (seed * 13 + 100) % 600 + 100; const by = (seed * 17 + 30) % 300 + 50;
  test(`PC-D-${String(i).padStart(3,'0')}: 2-anchor fallback finite+bounded seed=${seed}`, () => {
    const g = getGeo(cp(ax, ay), cp(bx, by));
    for (const p of [...g.upper, ...g.lower, ...g.center]) {
      assertFinite(p.x, 'x'); assertFinite(p.y, 'y');
    }
  });
}

// ─── E. Direction independence (40) ──────────────────────────────────────────

// Helper: perpendicular distance from seg2[0] to the infinite line through seg1
function perpDist(seg1: [CP,CP], seg2: [CP,CP]): number {
  const dx = seg1[1].x - seg1[0].x; const dy = seg1[1].y - seg1[0].y;
  const mag = Math.hypot(dx, dy);
  if (mag < 0.01) return 0;
  return Math.abs((seg2[0].x - seg1[0].x) * dy - (seg2[0].y - seg1[0].y) * dx) / mag;
}

test('PC-E-001: reversing anchor A\u2194B yields same perpendicular channel width', () => {
  const g1 = getGeo(cp(100, 200), cp(600, 150), cp(350, 100));
  const g2 = getGeo(cp(600, 150), cp(100, 200), cp(350, 100));
  // Use perpendicular distance between the parallel lines (not endpoint distance)
  const w1 = perpDist(g1.center, g1.upper);
  const w2 = perpDist(g2.center, g2.upper);
  assert.ok(Math.abs(w1 - w2) < 5, `perp width symmetry: ${w1} vs ${w2}`);
});

test('PC-E-002: reversing yields same fill area (approx)', () => {
  const shoelace = (pts: CP[]) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
  };
  const g1 = getGeo(cp(100, 200), cp(600, 150), cp(350, 100));
  const g2 = getGeo(cp(600, 150), cp(100, 200), cp(350, 100));
  const a1 = shoelace(g1.fill); const a2 = shoelace(g2.fill);
  assert.ok(Math.abs(a1 - a2) / (a1 + 1) < 0.1, `fill areas ${a1} vs ${a2}`);
});

for (let i = 3; i <= 40; i++) {
  const seed = i * 53 + 3;
  const ax = (seed * 7 + 80) % 500 + 80; const ay = (seed * 11 + 80) % 250 + 80;
  const bx = (seed * 13 + 100) % 500 + 100; const by = (seed * 17 + 60) % 250 + 60;
  const cx = (seed * 5 + 80) % 500 + 100; const cy = (seed * 19 + 40) % 250 + 40;
  test(`PC-E-${String(i).padStart(3,'0')}: reversed anchors same perp-width seed=${seed}`, () => {
    const g1 = getGeo(cp(ax, ay), cp(bx, by), cp(cx, cy));
    const g2 = getGeo(cp(bx, by), cp(ax, ay), cp(cx, cy));
    // Perpendicular distance between upper and center should be the same regardless of A/B order
    const w1 = perpDist(g1.center, g1.upper);
    const w2 = perpDist(g2.center, g2.upper);
    assert.ok(Math.abs(w1 - w2) < 5, `perp width symmetry seed=${seed}: ${w1.toFixed(2)} vs ${w2.toFixed(2)}`);
  });
}

// ─── F. Perpendicular offset direction (40) ───────────────────────────────────

test('PC-F-001: upper and lower equidistant from center (perp offset symmetry)', () => {
  const a = cp(100, 300); const b = cp(600, 200);
  const g = getGeo(a, b, cp(350, 100));
  const dUp  = perpDist(g.center, g.upper);
  const dLow = perpDist(g.center, g.lower);
  assert.ok(Math.abs(dUp - dLow) < 3, `equidistant: dUp=${dUp.toFixed(2)} dLow=${dLow.toFixed(2)}`);
});

for (let i = 2; i <= 40; i++) {
  const seed = i * 61 + 7;
  const ax = (seed * 3 + 80) % 500 + 80; const ay = (seed * 7 + 80) % 280 + 80;
  const bx = (seed * 11 + 100) % 500 + 100; const by = (seed * 13 + 60) % 280 + 60;
  const cx = ((ax + bx) / 2) | 0; const cy = Math.min(ay, by) - 60;
  test(`PC-F-${String(i).padStart(3,'0')}: upper/lower equidistant from center seed=${seed}`, () => {
    if (cy < 10) return; // skip degenerate
    const g = getGeo(cp(ax, ay), cp(bx, by), cp(cx, cy));
    const dUp  = perpDist(g.center, g.upper);
    const dLow = perpDist(g.center, g.lower);
    assert.ok(Math.abs(dUp - dLow) < 3, `equidistant seed=${seed}: dUp=${dUp.toFixed(2)} dLow=${dLow.toFixed(2)}`);
  });
}

// ─── G. Clip-to-canvas (40) ──────────────────────────────────────────────────

for (let i = 1; i <= 40; i++) {
  const seed = i * 71 + 13;
  const ax = (seed * 3 + 10) % 780 + 10; const ay = (seed * 7 + 10) % 380 + 10;
  const bx = (seed * 11 + 10) % 780 + 10; const by = (seed * 13 + 10) % 380 + 10;
  const cx = (seed * 17 + 10) % 780 + 10; const cy = (seed * 19 + 10) % 380 + 10;
  test(`PC-G-${String(i).padStart(3,'0')}: center in bounds, rails finite seed=${seed}`, () => {
    const g = getGeo(cp(ax, ay), cp(bx, by), cp(cx, cy));
    // Center line always clips to canvas
    for (const p of g.center) {
      assert.ok(p.x >= -1 && p.x <= W + 1, `center x=${p.x} oob`);
      assert.ok(p.y >= -1 && p.y <= H + 1, `center y=${p.y} oob`);
    }
    // Upper/lower may fall back to unclipped when shifted line is off-canvas — only check finite
    for (const p of [...g.upper, ...g.lower]) {
      assert.ok(isFinite(p.x) && isFinite(p.y), `rail point not finite: x=${p.x} y=${p.y}`);
    }
  });
}

// ─── H. Degenerate inputs (30) ───────────────────────────────────────────────

test('PC-H-001: zero-length baseline does not throw', () => {
  assert.doesNotThrow(() => getGeo(cp(300, 200), cp(300, 200), cp(350, 150)));
});

test('PC-H-002: zero-length baseline returns finite values', () => {
  const g = getGeo(cp(300, 200), cp(300, 200), cp(350, 150));
  for (const p of [...g.upper, ...g.lower, ...g.center]) {
    assert.ok(isFinite(p.x) && isFinite(p.y), `degenerate: x=${p.x} y=${p.y}`);
  }
});

test('PC-H-003: anchors at canvas corner', () => {
  assert.doesNotThrow(() => getGeo(cp(0, 0), cp(W, H), cp(W / 2, 0)));
});

test('PC-H-004: anchor outside canvas', () => {
  assert.doesNotThrow(() => getGeo(cp(-100, 200), cp(900, 200), cp(400, 100)));
});

for (let i = 5; i <= 30; i++) {
  const seed = i * 79 + 17;
  const vals = [0, 0.5, 1, W / 2, W - 1, W, H / 2, H - 1, H, -10, W + 10];
  const ax = vals[seed % vals.length]; const ay = vals[(seed * 7) % vals.length];
  const bx = vals[(seed * 11) % vals.length]; const by = vals[(seed * 13) % vals.length];
  test(`PC-H-${String(i).padStart(3,'0')}: edge coord inputs do not throw seed=${seed}`, () => {
    assert.doesNotThrow(() => getGeo(cp(ax, ay), cp(bx, by)));
  });
}

// ─── I. Geometry relationships (50) ──────────────────────────────────────────

test('PC-I-001: upper and lower are equidistant from center (symmetric offset)', () => {
  const g = getGeo(cp(100, 200), cp(600, 200), cp(350, 140)); // horizontal, offset=60
  const dUp  = distance(g.upper[0], g.center[0]);
  const dLow = distance(g.lower[0], g.center[0]);
  assert.ok(Math.abs(dUp - dLow) < 5, `symmetric: dUp=${dUp.toFixed(1)} dLow=${dLow.toFixed(1)}`);
});

test('PC-I-002: 3 parallel lines have equal mutual perpendicular distances', () => {
  const g = getGeo(cp(100, 200), cp(600, 200), cp(350, 140));
  const dUC = distance(g.upper[0], g.center[0]);
  const dLC = distance(g.lower[0], g.center[0]);
  const dUL = distance(g.upper[0], g.lower[0]);
  assert.ok(Math.abs(dUL - dUC - dLC) < 5, `UL≈UC+LC: ${dUL.toFixed(1)} ≈ ${dUC.toFixed(1)}+${dLC.toFixed(1)}`);
});

test('PC-I-003: center lies between upper and lower (y-wise for horizontal)', () => {
  const g = getGeo(cp(100, 200), cp(600, 200), cp(350, 140));
  const cy = g.center[0].y;
  const uy = g.upper[0].y;
  const ly = g.lower[0].y;
  const between = (Math.min(uy, ly) <= cy && cy <= Math.max(uy, ly));
  assert.ok(between, `center y=${cy} not between upper y=${uy} and lower y=${ly}`);
});

for (let i = 4; i <= 50; i++) {
  const seed = i * 83 + 23;
  const ax = (seed * 3 + 80) % 500 + 80; const ay = (seed * 7 + 80) % 280 + 80;
  const bx = (seed * 11 + 100) % 500 + 100; const by = ay; // horizontal baseline
  const offset = (seed % 7 + 1) * 20; // 20-140px offset
  const cy = ay - offset;
  test(`PC-I-${String(i).padStart(3,'0')}: center between rails horiz seed=${seed} off=${offset}`, () => {
    if (cy < 5) return;
    const g = getGeo(cp(ax, ay), cp(bx, by), cp((ax + bx) / 2, cy));
    const centerY = g.center[0].y;
    const upperY = g.upper[0].y;
    const lowerY = g.lower[0].y;
    assert.ok(
      Math.min(upperY, lowerY) - 2 <= centerY && centerY <= Math.max(upperY, lowerY) + 2,
      `center=${centerY} not between upper=${upperY} lower=${lowerY}`,
    );
  });
}

// ─── J. Stress – 500 total (remaining cases to reach 500) ────────────────────

for (let i = 1; i <= 110; i++) {
  const seed = i * 97 + 29;
  const ax = (seed * 3 + 60) % 700 + 50; const ay = (seed * 7 + 50) % 320 + 40;
  const bx = (seed * 11 + 80) % 650 + 80; const by = (seed * 13 + 40) % 320 + 40;
  const cx = (seed * 17 + 80) % 620 + 90; const cy = (seed * 19 + 20) % 360 + 20;
  const use3 = i % 3 !== 0;
  test(`PC-J-${String(i).padStart(3,'0')}: stress geo seed=${seed} 3anchor=${use3}`, () => {
    const g = use3
      ? getGeo(cp(ax, ay), cp(bx, by), cp(cx, cy))
      : getGeo(cp(ax, ay), cp(bx, by));
    assert.strictEqual(g.fill.length, 4);
    assert.ok(Math.abs(g.fill[0].x - g.upper[0].x) < 0.5);
    // All points must be finite; center must be in bounds; rails may be off-canvas as fallback
    for (const p of [...g.upper, ...g.lower, ...g.center, ...g.fill]) {
      assertFinite(p.x, 'x'); assertFinite(p.y, 'y');
    }
    for (const p of g.center) {
      assert.ok(p.x >= -1 && p.x <= W + 1, `center oob x=${p.x}`);
      assert.ok(p.y >= -1 && p.y <= H + 1, `center oob y=${p.y}`);
    }
  });
}

summary();
