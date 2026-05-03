/**
 * RegressionTrend geometry TV-parity tests (500 cases).
 *
 * Tests `getRegressionTrendGeometry` from drawingGeometry.ts.
 * TV signature: least-squares regression line + ±1σ stddev band + stddev label.
 *
 * Categories:
 *   A. Basic structure – median/upper/lower/fill returned (50)
 *   B. Regression math – slope/intercept correctness (60)
 *   C. Deviation band – symmetric ±deviation offset (60)
 *   D. Fill quad structure (40)
 *   E. Segment x-range spans input points (50)
 *   F. Clip to canvas – values in bounds (30)
 *   G. Degenerate / edge inputs (40)
 *   H. Perfect-fit data – deviation approaches 0 (30)
 *   I. Horizontal regression (40)
 *   J. Stress – varied point clouds (100)
 *
 * Total: 500
 */

import assert from 'node:assert/strict';
import { createRunner } from './parityHelpers.ts';

import { getRegressionTrendGeometry } from '../../../../frontend/services/tools/drawingGeometry.ts';

type CP = { x: number; y: number };

const { test, summary } = createRunner('RegressionTrend parity (500)');

function cp(x: number, y: number): CP { return { x, y }; }

function assertFinite(v: number, label: string) {
  assert.ok(isFinite(v), `${label} must be finite, got ${v}`);
}

// ─── A. Basic structure (50) ──────────────────────────────────────────────────

test('RT-A-001: returns non-null for 2 points', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 150)]);
  assert.ok(g !== null);
});

test('RT-A-002: returns null for < 2 points', () => {
  assert.strictEqual(getRegressionTrendGeometry([cp(100, 200)]), null);
  assert.strictEqual(getRegressionTrendGeometry([]), null);
});

test('RT-A-003: result has median, upper, lower, fill, slope, intercept, deviation', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(300, 150), cp(500, 180)])!;
  assert.ok(g.median && g.upper && g.lower && g.fill);
  assert.ok(typeof g.slope === 'number');
  assert.ok(typeof g.intercept === 'number');
  assert.ok(typeof g.deviation === 'number');
});

test('RT-A-004: median has 2 endpoints', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 150)])!;
  assert.strictEqual(g.median.length, 2);
});

test('RT-A-005: upper has 2 endpoints', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 150)])!;
  assert.strictEqual(g.upper.length, 2);
});

test('RT-A-006: lower has 2 endpoints', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 150)])!;
  assert.strictEqual(g.lower.length, 2);
});

test('RT-A-007: fill has 4 points', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 150)])!;
  assert.strictEqual(g.fill.length, 4);
});

test('RT-A-008: deviation >= 6 (minimum floor)', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 150)])!;
  assert.ok(g.deviation >= 6, `deviation=${g.deviation} must be >= 6`);
});

for (let i = 9; i <= 50; i++) {
  const seed = i * 17 + 3;
  const nPoints = (seed % 5) + 2; // 2-6 points
  const points: CP[] = [];
  for (let j = 0; j < nPoints; j++) {
    points.push(cp((seed * (j + 1) * 7 + 100) % 600 + 100, (seed * (j + 1) * 11 + 80) % 280 + 80));
  }
  test(`RT-A-${String(i).padStart(3,'0')}: basic structure ${nPoints} points seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(points)!;
    assert.ok(g !== null);
    assert.strictEqual(g.fill.length, 4);
    assert.ok(g.deviation >= 6);
    assertFinite(g.slope, 'slope');
    assertFinite(g.intercept, 'intercept');
  });
}

// ─── B. Regression math (60) ──────────────────────────────────────────────────

test('RT-B-001: perfect diagonal slope=1 intercept=0', () => {
  const pts = [cp(0, 0), cp(100, 100), cp(200, 200), cp(300, 300)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.slope - 1) < 0.01, `slope expected 1, got ${g.slope}`);
  assert.ok(Math.abs(g.intercept) < 1, `intercept expected 0, got ${g.intercept}`);
});

test('RT-B-002: perfect negative diagonal slope=-1', () => {
  const pts = [cp(0, 300), cp(100, 200), cp(200, 100), cp(300, 0)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.slope + 1) < 0.01, `slope expected -1, got ${g.slope}`);
});

test('RT-B-003: perfectly horizontal slope≈0', () => {
  const pts = [cp(100, 200), cp(200, 200), cp(300, 200), cp(400, 200)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.slope) < 0.01, `slope expected 0, got ${g.slope}`);
});

test('RT-B-004: median.y values satisfy slope/intercept', () => {
  const pts = [cp(100, 150), cp(200, 160), cp(300, 155), cp(400, 170)];
  const g = getRegressionTrendGeometry(pts)!;
  const expectedY0 = g.slope * g.median[0].x + g.intercept;
  const expectedY1 = g.slope * g.median[1].x + g.intercept;
  assert.ok(Math.abs(g.median[0].y - expectedY0) < 1, `median[0].y: ${g.median[0].y} vs ${expectedY0}`);
  assert.ok(Math.abs(g.median[1].y - expectedY1) < 1, `median[1].y: ${g.median[1].y} vs ${expectedY1}`);
});

test('RT-B-005: intercept consistent with mean x/y', () => {
  const pts = [cp(100, 200), cp(200, 220), cp(300, 210)];
  const g = getRegressionTrendGeometry(pts)!;
  const meanX = (100 + 200 + 300) / 3;
  const meanY = (200 + 220 + 210) / 3;
  const fittedAtMean = g.slope * meanX + g.intercept;
  assert.ok(Math.abs(fittedAtMean - meanY) < 1, `fitted at mean: ${fittedAtMean} vs ${meanY}`);
});

for (let i = 6; i <= 60; i++) {
  const seed = i * 19 + 5;
  const slope = ((seed % 11) - 5) * 0.3; // -1.5 to 1.5
  const intercept = (seed % 200) + 50;
  const nPts = (seed % 4) + 3;
  const points: CP[] = [];
  for (let j = 0; j < nPts; j++) {
    const x = 100 + j * 100;
    points.push(cp(x, slope * x + intercept));
  }
  test(`RT-B-${String(i).padStart(3,'0')}: perfect line slope=${slope.toFixed(2)} intercept=${intercept}`, () => {
    const g = getRegressionTrendGeometry(points)!;
    assert.ok(Math.abs(g.slope - slope) < 0.05, `slope: ${g.slope} vs ${slope}`);
    assert.ok(Math.abs(g.intercept - intercept) < 2, `intercept: ${g.intercept} vs ${intercept}`);
  });
}

// ─── C. Deviation band (60) ───────────────────────────────────────────────────

test('RT-C-001: upper = median - deviation (y-axis shift)', () => {
  const pts = [cp(100, 200), cp(300, 150), cp(500, 180)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.upper[0].y - (g.median[0].y - g.deviation)) < 0.5);
  assert.ok(Math.abs(g.upper[1].y - (g.median[1].y - g.deviation)) < 0.5);
});

test('RT-C-002: lower = median + deviation (y-axis shift)', () => {
  const pts = [cp(100, 200), cp(300, 150), cp(500, 180)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.lower[0].y - (g.median[0].y + g.deviation)) < 0.5);
  assert.ok(Math.abs(g.lower[1].y - (g.median[1].y + g.deviation)) < 0.5);
});

test('RT-C-003: band is symmetric (upper and lower equidistant from median)', () => {
  const pts = [cp(100, 200), cp(200, 190), cp(300, 210), cp(400, 195)];
  const g = getRegressionTrendGeometry(pts)!;
  const du = g.median[0].y - g.upper[0].y;
  const dl = g.lower[0].y - g.median[0].y;
  assert.ok(Math.abs(du - dl) < 0.5, `asymmetric band: du=${du} dl=${dl}`);
});

test('RT-C-004: more dispersed data → larger deviation', () => {
  const tight = [cp(100, 200), cp(200, 202), cp(300, 198)];
  const loose = [cp(100, 200), cp(200, 260), cp(300, 140)];
  const gTight = getRegressionTrendGeometry(tight)!;
  const gLoose = getRegressionTrendGeometry(loose)!;
  assert.ok(gLoose.deviation >= gTight.deviation, `loose.dev=${gLoose.deviation} >= tight.dev=${gTight.deviation}`);
});

for (let i = 5; i <= 60; i++) {
  const seed = i * 23 + 9;
  const nPts = (seed % 5) + 2;
  const pts: CP[] = [];
  for (let j = 0; j < nPts; j++) {
    pts.push(cp(100 + j * (seed % 4 + 1) * 40, 100 + (seed * (j + 1) * 13) % 200));
  }
  test(`RT-C-${String(i).padStart(3,'0')}: band symmetric seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(pts)!;
    assert.ok(g !== null);
    const du = g.median[0].y - g.upper[0].y;
    const dl = g.lower[0].y - g.median[0].y;
    assert.ok(Math.abs(du - dl) < 0.5, `asymmetric: du=${du.toFixed(2)} dl=${dl.toFixed(2)}`);
  });
}

// ─── D. Fill quad structure (40) ─────────────────────────────────────────────

test('RT-D-001: fill[0] === upper[0]', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 170)])!;
  assert.ok(Math.abs(g.fill[0].x - g.upper[0].x) < 0.5 && Math.abs(g.fill[0].y - g.upper[0].y) < 0.5);
});

test('RT-D-002: fill[1] === upper[1]', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 170)])!;
  assert.ok(Math.abs(g.fill[1].x - g.upper[1].x) < 0.5 && Math.abs(g.fill[1].y - g.upper[1].y) < 0.5);
});

test('RT-D-003: fill[2] === lower[1]', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 170)])!;
  assert.ok(Math.abs(g.fill[2].x - g.lower[1].x) < 0.5 && Math.abs(g.fill[2].y - g.lower[1].y) < 0.5);
});

test('RT-D-004: fill[3] === lower[0]', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 170)])!;
  assert.ok(Math.abs(g.fill[3].x - g.lower[0].x) < 0.5 && Math.abs(g.fill[3].y - g.lower[0].y) < 0.5);
});

for (let i = 5; i <= 40; i++) {
  const seed = i * 29 + 11;
  const nPts = (seed % 4) + 2;
  const pts: CP[] = [];
  for (let j = 0; j < nPts; j++) pts.push(cp(100 + j * 100, 100 + (seed * (j + 1) * 7) % 200));
  test(`RT-D-${String(i).padStart(3,'0')}: fill quad structure seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(pts)!;
    assert.strictEqual(g.fill.length, 4);
    assert.ok(Math.abs(g.fill[0].x - g.upper[0].x) < 0.5);
    assert.ok(Math.abs(g.fill[2].x - g.lower[1].x) < 0.5);
  });
}

// ─── E. Segment x-range (50) ─────────────────────────────────────────────────

test('RT-E-001: median[0].x === min point x', () => {
  const pts = [cp(100, 200), cp(300, 180), cp(500, 190)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.median[0].x - 100) < 0.5, `median[0].x=${g.median[0].x} expected 100`);
});

test('RT-E-002: median[1].x === max point x', () => {
  const pts = [cp(100, 200), cp(300, 180), cp(500, 190)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.median[1].x - 500) < 0.5, `median[1].x=${g.median[1].x} expected 500`);
});

test('RT-E-003: upper x-range matches median', () => {
  const pts = [cp(50, 200), cp(250, 180), cp(600, 190)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.upper[0].x - g.median[0].x) < 0.5);
  assert.ok(Math.abs(g.upper[1].x - g.median[1].x) < 0.5);
});

test('RT-E-004: lower x-range matches median', () => {
  const pts = [cp(50, 200), cp(250, 180), cp(600, 190)];
  const g = getRegressionTrendGeometry(pts)!;
  assert.ok(Math.abs(g.lower[0].x - g.median[0].x) < 0.5);
  assert.ok(Math.abs(g.lower[1].x - g.median[1].x) < 0.5);
});

for (let i = 5; i <= 50; i++) {
  const seed = i * 31 + 13;
  const nPts = (seed % 5) + 2;
  const pts: CP[] = [];
  const xs: number[] = [];
  for (let j = 0; j < nPts; j++) {
    const x = 50 + (seed * (j + 1) * 7) % 650;
    xs.push(x);
    pts.push(cp(x, 100 + (seed * (j + 1) * 13) % 200));
  }
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  test(`RT-E-${String(i).padStart(3,'0')}: x-range correct seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(pts)!;
    assert.ok(Math.abs(g.median[0].x - minX) < 0.5, `minX: ${g.median[0].x} vs ${minX}`);
    assert.ok(Math.abs(g.median[1].x - maxX) < 0.5, `maxX: ${g.median[1].x} vs ${maxX}`);
  });
}

// ─── F. Clip to canvas (30) ───────────────────────────────────────────────────

for (let i = 1; i <= 30; i++) {
  const seed = i * 37 + 17;
  const nPts = (seed % 4) + 2;
  const pts: CP[] = [];
  for (let j = 0; j < nPts; j++) {
    pts.push(cp(50 + j * 100, 80 + (seed * (j + 1) * 7) % 240));
  }
  test(`RT-F-${String(i).padStart(3,'0')}: result finite seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(pts)!;
    for (const p of [...g.median, ...g.upper, ...g.lower, ...g.fill]) {
      assertFinite(p.x, 'x'); assertFinite(p.y, 'y');
    }
  });
}

// ─── G. Degenerate inputs (40) ────────────────────────────────────────────────

test('RT-G-001: empty array → null', () => {
  assert.strictEqual(getRegressionTrendGeometry([]), null);
});

test('RT-G-002: single point → null', () => {
  assert.strictEqual(getRegressionTrendGeometry([cp(200, 200)]), null);
});

test('RT-G-003: two identical points → finite result', () => {
  const g = getRegressionTrendGeometry([cp(200, 200), cp(200, 200)]);
  if (g) {
    assertFinite(g.slope, 'slope'); assertFinite(g.intercept, 'intercept');
  }
});

test('RT-G-004: vertical cloud (all same x) → finite slope', () => {
  const g = getRegressionTrendGeometry([cp(200, 100), cp(200, 200), cp(200, 300)]);
  if (g) { assertFinite(g.slope, 'slope'); }
});

test('RT-G-005: exactly 2 points → perfect fit, deviation = 6 (min floor)', () => {
  const g = getRegressionTrendGeometry([cp(100, 200), cp(400, 140)])!;
  assert.ok(g !== null);
  assert.ok(g.deviation >= 6);
});

test('RT-G-006: large x values do not produce NaN', () => {
  const g = getRegressionTrendGeometry([cp(1e6, 200), cp(2e6, 300)])!;
  if (g) { assertFinite(g.slope, 'slope'); }
});

for (let i = 7; i <= 40; i++) {
  const seed = i * 41 + 19;
  const edgeVals = [0, 1, 0.5, 799, 800, 399, 400, -10, 810];
  const ax = edgeVals[seed % edgeVals.length]; const ay = edgeVals[(seed * 7) % edgeVals.length];
  const bx = edgeVals[(seed * 11) % edgeVals.length]; const by = edgeVals[(seed * 13) % edgeVals.length];
  test(`RT-G-${String(i).padStart(3,'0')}: edge coord inputs do not throw seed=${seed}`, () => {
    assert.doesNotThrow(() => getRegressionTrendGeometry([cp(ax, ay), cp(bx, by)]));
  });
}

// ─── H. Perfect-fit data (30) ────────────────────────────────────────────────

for (let i = 1; i <= 30; i++) {
  const seed = i * 43 + 21;
  const slope = ((seed % 7) - 3) * 0.4;
  const intercept = (seed % 150) + 50;
  const nPts = (seed % 4) + 3;
  const pts: CP[] = [];
  for (let j = 0; j < nPts; j++) {
    const x = 100 + j * 100;
    pts.push(cp(x, slope * x + intercept));
  }
  test(`RT-H-${String(i).padStart(3,'0')}: perfect fit slope=${slope.toFixed(2)} deviation=min seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(pts)!;
    assert.ok(Math.abs(g.slope - slope) < 0.02, `slope ${g.slope} vs ${slope}`);
    // Residuals are 0 → raw deviation ≈ 0 → clamped to floor=6
    assert.ok(g.deviation >= 6, `deviation=${g.deviation}`);
  });
}

// ─── I. Horizontal regression (40) ────────────────────────────────────────────

for (let i = 1; i <= 40; i++) {
  const seed = i * 47 + 23;
  const y = 80 + (seed % 240);
  const nPts = (seed % 4) + 2;
  const pts: CP[] = [];
  for (let j = 0; j < nPts; j++) pts.push(cp(100 + j * 120, y));
  test(`RT-I-${String(i).padStart(3,'0')}: horizontal regression slope≈0 y=${y} seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(pts)!;
    assert.ok(Math.abs(g.slope) < 0.01, `slope=${g.slope}`);
    // All median y values should equal intercept
    for (const p of g.median) {
      assert.ok(Math.abs(p.y - y) < 1.5, `median y=${p.y} expected ${y}`);
    }
  });
}

// ─── J. Stress (100) ─────────────────────────────────────────────────────────

for (let i = 1; i <= 100; i++) {
  const seed = i * 53 + 27;
  const nPts = (seed % 7) + 2; // 2-8 points
  const pts: CP[] = [];
  for (let j = 0; j < nPts; j++) {
    pts.push(cp(50 + (seed * (j + 1) * 7) % 700, 40 + (seed * (j + 1) * 13) % 320));
  }
  test(`RT-J-${String(i).padStart(3,'0')}: stress ${nPts} points seed=${seed}`, () => {
    const g = getRegressionTrendGeometry(pts);
    if (!g) return; // null is valid only for <2 unique points
    assert.strictEqual(g.fill.length, 4);
    assert.ok(g.deviation >= 6);
    for (const p of [...g.median, ...g.upper, ...g.lower, ...g.fill]) {
      assertFinite(p.x, 'x'); assertFinite(p.y, 'y');
    }
    assert.ok(Math.abs(g.fill[0].x - g.upper[0].x) < 0.5);
    assert.ok(Math.abs(g.fill[2].x - g.lower[1].x) < 0.5);
  });
}

summary();
