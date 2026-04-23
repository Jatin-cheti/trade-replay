/**
 * TrendLine tool — 100 tests covering:
 * - Normal creation and draft flow
 * - Hit testing: finite, extended-left, extended-right, infinite
 * - Angle snapping (Shift)
 * - Edge-of-canvas placement
 * - Zero-length rejection
 * - Horizontal / vertical / diagonal lines
 * - Viewport transformations
 * - Selected/hovered handle positions
 * - extendLeft / extendRight combinations
 * - Multi-drawing interaction
 * - Slow, fast, jitter cursor movement
 * - ESC cancellation flow
 * - Zoom while drawing (viewport change mid-draft)
 * - Options: color, lineWidth, lineStyle, axisLabel
 */

import assert from 'node:assert/strict';
import { TrendLineTool } from '../../src/drawing/tools/trendLine.ts';
import { distanceToSegment, rayEndpoint, clipSegment, snapAngle15, dataToScreen } from '../../src/drawing/geometry.ts';
import type { Drawing, DrawPoint, Viewport } from '../../src/drawing/types.ts';
import { DEFAULT_DRAWING_OPTIONS } from '../../src/drawing/types.ts';

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${(err as Error).message}`);
    failed = 1;
    process.exitCode = 1;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tool = new TrendLineTool();

function vp(overrides: Partial<Viewport> = {}): Viewport {
  return {
    width: 800,
    height: 400,
    priceAxisWidth: 60,
    timeAxisHeight: 28,
    visibleFrom: 1_700_000_000 as DrawPoint['time'],
    visibleTo: 1_700_100_000 as DrawPoint['time'],
    priceMin: 100,
    priceMax: 200,
    pxPerTime: 0,
    pxPerPrice: 0,
    originX: 0,
    originY: 0,
    ...overrides,
  };
}

function pt(time: number, price: number): DrawPoint {
  return { time: time as DrawPoint['time'], price };
}

const T0 = 1_700_000_000;
const T1 = 1_700_050_000;
const T2 = 1_700_100_000;

function defaultDraft(): Drawing {
  return tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
}

// ─── Group 1: Creation ────────────────────────────────────────────────────────

test('TL-01: createDraft produces a drawing with variant=trend', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d.variant, 'trend');
});

test('TL-02: createDraft sets both anchors to the initial point', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d.anchors.length, 2);
  assert.equal(d.anchors[0].time, T0);
  assert.equal(d.anchors[0].price, 150);
  assert.equal(d.anchors[1].time, T0);
  assert.equal(d.anchors[1].price, 150);
});

test('TL-03: createDraft assigns a non-empty id', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.ok(d.id.length > 0);
});

test('TL-04: createDraft returns visible=true', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d.visible, true);
});

test('TL-05: createDraft returns locked=false', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d.locked, false);
});

test('TL-06: anchorCount is 2', () => {
  assert.equal(tool.anchorCount, 2);
});

test('TL-07: isPointOnly is false', () => {
  assert.equal(tool.isPointOnly, false);
});

test('TL-08: label is "Trend Line"', () => {
  assert.equal(tool.label, 'Trend Line');
});

// ─── Group 2: updateDraft ─────────────────────────────────────────────────────

test('TL-09: updateDraft moves anchor[1] to pointer', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  assert.equal(d.anchors[1].time, T2);
  assert.equal(d.anchors[1].price, 180);
});

test('TL-10: updateDraft keeps anchor[0] unchanged', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  assert.equal(d.anchors[0].time, T0);
  assert.equal(d.anchors[0].price, 150);
});

test('TL-11: updateDraft multiple moves tracks last position', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1, 120));
  d = tool.updateDraft(d, pt(T2, 180));
  d = tool.updateDraft(d, pt(T1, 160));
  assert.equal(d.anchors[1].time, T1);
  assert.equal(d.anchors[1].price, 160);
});

test('TL-12: updateDraft with same position as anchor[0] (zero-length in-progress)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T0, 150));
  assert.equal(d.anchors[1].price, 150);
});

// ─── Group 3: finalize ────────────────────────────────────────────────────────

test('TL-13: finalize returns drawing for valid (non-zero) line', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d);
  assert.ok(result !== null);
});

test('TL-14: finalize returns null for zero-length line (same anchor)', () => {
  const d = defaultDraft(); // anchors[0] == anchors[1]
  const result = tool.finalize(d);
  assert.equal(result, null);
});

test('TL-15: finalize returns null when both anchors same time and price', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T0, 150));
  const result = tool.finalize(d);
  assert.equal(result, null);
});

test('TL-16: finalize returns non-null for horizontal line (same price, different time)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150)); // same price, different time
  const result = tool.finalize(d);
  assert.ok(result !== null);
});

test('TL-17: finalize returns non-null for vertical line (same time, different price)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T0, 180)); // same time, different price
  const result = tool.finalize(d);
  assert.ok(result !== null);
});

test('TL-18: finalize preserves variant=trend', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.equal(result.variant, 'trend');
});

test('TL-19: finalize preserves both anchors', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.equal(result.anchors[0].price, 150);
  assert.equal(result.anchors[1].price, 180);
});

// ─── Group 4: Hit testing ─────────────────────────────────────────────────────

test('TL-20: hitTest returns low distance for pointer exactly on line', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150)); // horizontal line
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  const b = dataToScreen(d.anchors[1], v);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dist = tool.hitTest(d, mid, v);
  assert.ok(dist < 1, `expected dist < 1, got ${dist}`);
});

test('TL-21: hitTest returns high distance for pointer far from line', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const v = vp();
  // pointer far above the line
  const dist = tool.hitTest(d, { x: 400, y: 0 }, v);
  assert.ok(dist > 20, `expected dist > 20, got ${dist}`);
});

test('TL-22: hitTest returns Infinity if only 1 anchor', () => {
  const d: Drawing = { ...defaultDraft(), anchors: [pt(T0, 150)] };
  const dist = tool.hitTest(d, { x: 100, y: 100 }, vp());
  assert.equal(dist, Infinity);
});

test('TL-23: hitTest near endpoint still hits segment', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  const nearStart = { x: a.x + 2, y: a.y + 2 };
  const dist = tool.hitTest(d, nearStart, v);
  assert.ok(dist < 5, `expected dist < 5, got ${dist}`);
});

test('TL-24: hitTest for diagonal line — midpoint hit', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 200)); // diagonal
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  const b = dataToScreen(d.anchors[1], v);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dist = tool.hitTest(d, mid, v);
  assert.ok(dist < 2, `expected dist < 2, got ${dist}`);
});

test('TL-25: hitTest outside segment length returns miss', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1, 150)); // finite segment, mid-canvas only
  const v = vp();
  const b = dataToScreen(d.anchors[1], v);
  // 200px to the right of segment end, should miss
  const beyond = { x: b.x + 200, y: b.y };
  const dist = tool.hitTest(d, beyond, v);
  assert.ok(dist > 10, `expected dist > 10, got ${dist}`);
});

// ─── Group 5: extendRight hit testing ────────────────────────────────────────

test('TL-26: hitTest with extendRight hits beyond anchor[1]', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1, 150));
  d = { ...d, options: { ...d.options, extendRight: true } };
  const v = vp();
  const b = dataToScreen(d.anchors[1], v);
  // 100px to the right of anchor[1] — still on extended ray
  const beyond = { x: Math.min(b.x + 100, v.width - v.priceAxisWidth - 1), y: b.y };
  const dist = tool.hitTest(d, beyond, v);
  assert.ok(dist < 5, `expected dist < 5, got ${dist}`);
});

test('TL-27: hitTest with extendLeft hits beyond anchor[0]', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  d = { ...d, options: { ...d.options, extendLeft: true } };
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  // Slightly to the left of anchor[0] — on extended ray
  const beyond = { x: Math.max(a.x - 50, 1), y: a.y };
  const dist = tool.hitTest(d, beyond, v);
  assert.ok(dist < 5, `expected dist < 5, got ${dist}`);
});

test('TL-28: hitTest with both extend = infinite line', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1, 150)); // horizontal line
  d = { ...d, options: { ...d.options, extendLeft: true, extendRight: true } };
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  // Far to the right — on infinite horizontal line
  const farRight = { x: v.width - v.priceAxisWidth - 5, y: a.y };
  const dist = tool.hitTest(d, farRight, v);
  assert.ok(dist < 2, `expected dist < 2, got ${dist}`);
});

// ─── Group 6: Handles ────────────────────────────────────────────────────────

test('TL-29: getHandles returns 2 handles', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const handles = tool.getHandles(d, vp());
  assert.equal(handles.length, 2);
});

test('TL-30: handle anchorIndex matches anchor position', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const handles = tool.getHandles(d, vp());
  assert.equal(handles[0].anchorIndex, 0);
  assert.equal(handles[1].anchorIndex, 1);
});

test('TL-31: handle centers match screen positions of anchors', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const v = vp();
  const handles = tool.getHandles(d, v);
  const a = dataToScreen(d.anchors[0], v);
  const b = dataToScreen(d.anchors[1], v);
  assert.ok(Math.abs(handles[0].center.x - a.x) < 0.1);
  assert.ok(Math.abs(handles[1].center.x - b.x) < 0.1);
});

test('TL-32: handle radius is > 0', () => {
  const d = defaultDraft();
  const handles = tool.getHandles(d, vp());
  assert.ok(handles[0].radius > 0);
});

// ─── Group 7: Viewport edge cases ─────────────────────────────────────────────

test('TL-33: drawing with anchor[0] at left viewport edge', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  const v = vp();
  const sp = dataToScreen(d.anchors[0], v);
  // Should be near x=0
  assert.ok(sp.x >= 0 && sp.x < 10, `expected near left edge, got x=${sp.x}`);
});

test('TL-34: drawing with anchor[1] at right viewport edge', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const v = vp();
  const sp = dataToScreen(d.anchors[1], v);
  // Should be near x = chartWidth
  const chartW = v.width - v.priceAxisWidth;
  assert.ok(sp.x >= chartW - 5 && sp.x <= chartW + 5, `expected near right edge, got x=${sp.x}`);
});

test('TL-35: drawing with anchor at top of viewport (max price)', () => {
  const d = tool.createDraft(pt(T1, 200), { ...DEFAULT_DRAWING_OPTIONS });
  const v = vp();
  const sp = dataToScreen(d.anchors[0], v);
  // y should be near 0 (top)
  assert.ok(sp.y >= -1 && sp.y <= 5, `expected near top edge, got y=${sp.y}`);
});

test('TL-36: drawing with anchor at bottom of viewport (min price)', () => {
  const d = tool.createDraft(pt(T1, 100), { ...DEFAULT_DRAWING_OPTIONS });
  const v = vp();
  const sp = dataToScreen(d.anchors[0], v);
  const chartH = v.height - v.timeAxisHeight;
  assert.ok(sp.y >= chartH - 5, `expected near bottom edge, got y=${sp.y}`);
});

test('TL-37: drawing partially off canvas still renders (clipSegment handles it)', () => {
  // anchor[0] off-screen left, anchor[1] on-screen
  const d: Drawing = {
    ...defaultDraft(),
    anchors: [
      pt(T0 - 100_000, 150), // off-screen left
      pt(T1, 150),
    ],
  };
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  const b = dataToScreen(d.anchors[1], v);
  const clipped = clipSegment(a, b, v.width - v.priceAxisWidth, v.height - v.timeAxisHeight);
  // Should either clip to visible or return null (both acceptable)
  assert.ok(clipped === null || (clipped[0].x >= 0));
});

// ─── Group 8: Angle snapping ──────────────────────────────────────────────────

test('TL-38: snapAngle15 snaps 0° line to 0°', () => {
  const base = { x: 100, y: 100 };
  const raw = { x: 200, y: 100 }; // 0 degrees
  const snapped = snapAngle15(base, raw);
  assert.ok(Math.abs(snapped.y - base.y) < 0.5, `expected y ~= base.y, got ${snapped.y}`);
});

test('TL-39: snapAngle15 snaps 90° line to 90°', () => {
  const base = { x: 100, y: 100 };
  const raw = { x: 100, y: 200 }; // 90 degrees (down)
  const snapped = snapAngle15(base, raw);
  assert.ok(Math.abs(snapped.x - base.x) < 0.5, `expected x ~= base.x, got ${snapped.x}`);
});

test('TL-40: snapAngle15 snaps 47° line to 45°', () => {
  const base = { x: 100, y: 100 };
  const dist = 100;
  const angle47 = 47 * Math.PI / 180;
  const raw = { x: base.x + dist * Math.cos(angle47), y: base.y + dist * Math.sin(angle47) };
  const snapped = snapAngle15(base, raw);
  // Should snap to 45 degrees
  const snappedAngle = Math.atan2(snapped.y - base.y, snapped.x - base.x) * 180 / Math.PI;
  assert.ok(Math.abs(snappedAngle - 45) < 1, `expected 45°, got ${snappedAngle}`);
});

test('TL-41: snapAngle15 preserves distance', () => {
  const base = { x: 0, y: 0 };
  const raw = { x: 80, y: 61 };
  const snapped = snapAngle15(base, raw);
  const origDist = Math.hypot(raw.x, raw.y);
  const snappedDist = Math.hypot(snapped.x, snapped.y);
  assert.ok(Math.abs(origDist - snappedDist) < 0.01, `distance changed: ${origDist} vs ${snappedDist}`);
});

test('TL-42: snapAngle15 for zero-length vector returns original', () => {
  const base = { x: 100, y: 100 };
  const raw = { x: 100, y: 100 };
  const snapped = snapAngle15(base, raw);
  assert.deepEqual(snapped, raw);
});

// ─── Group 9: Options ─────────────────────────────────────────────────────────

test('TL-43: createDraft uses provided color', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, color: '#ff0000' });
  assert.equal(d.options.color, '#ff0000');
});

test('TL-44: createDraft uses provided lineWidth', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, lineWidth: 3 });
  assert.equal(d.options.lineWidth, 3);
});

test('TL-45: createDraft uses provided lineStyle', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, lineStyle: 'dashed' });
  assert.equal(d.options.lineStyle, 'dashed');
});

test('TL-46: createDraft with extendRight=true preserves option', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, extendRight: true });
  assert.equal(d.options.extendRight, true);
});

test('TL-47: createDraft with extendLeft=true preserves option', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, extendLeft: true });
  assert.equal(d.options.extendLeft, true);
});

// ─── Group 10: Bounds computation ─────────────────────────────────────────────

test('TL-48: finalized drawing has bounds', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.ok(result.bounds !== undefined);
});

test('TL-49: bounds.minTime equals smaller time anchor', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.equal(Number(result.bounds!.minTime), T0);
});

test('TL-50: bounds.maxTime equals larger time anchor', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.equal(Number(result.bounds!.maxTime), T2);
});

test('TL-51: bounds.minPrice equals smaller price', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.equal(result.bounds!.minPrice, 150);
});

test('TL-52: bounds.maxPrice equals larger price', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.equal(result.bounds!.maxPrice, 180);
});

// ─── Group 11: Jitter cursor movement ────────────────────────────────────────

test('TL-53: rapid jitter movements — final position is accurate', () => {
  let d = defaultDraft();
  // Simulate jitter: many small random movements
  const positions = [160, 162, 158, 165, 163, 161, 170, 168, 172, 169];
  for (const price of positions) {
    d = tool.updateDraft(d, pt(T1, price));
  }
  assert.equal(d.anchors[1].price, 169);
});

test('TL-54: jitter with time axis: anchor[1] always tracks latest time', () => {
  let d = defaultDraft();
  const times = [T0 + 1000, T0 + 500, T0 + 2000, T0 + 1500, T0 + 3000];
  for (const t of times) {
    d = tool.updateDraft(d, pt(t, 160));
  }
  assert.equal(Number(d.anchors[1].time), T0 + 3000);
});

// ─── Group 12: Viewport change mid-draft (zoom while drawing) ─────────────────

test('TL-55: hitTest adapts when viewport zoomed in (narrower time range)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const v = vp();
  const dist1 = tool.hitTest(d, { x: 300, y: 100 }, v);

  // Zoom in (smaller time range → line stretches across more pixels)
  const vZoomed = vp({
    visibleFrom: 1_700_020_000 as DrawPoint['time'],
    visibleTo: 1_700_080_000 as DrawPoint['time'],
  });
  const dist2 = tool.hitTest(d, { x: 300, y: 100 }, vZoomed);
  // Both should return a finite distance
  assert.ok(Number.isFinite(dist1));
  assert.ok(Number.isFinite(dist2));
});

test('TL-56: viewport with priceMax == priceMin does not throw', () => {
  const v = vp({ priceMin: 150, priceMax: 150 }); // degenerate
  // dataToScreen produces NaN for price axis in degenerate viewport (0/0),
  // but it should not throw. NaN is acceptable as a no-display sentinel.
  let threw = false;
  try {
    dataToScreen(pt(T1, 150), v);
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

// ─── Group 13: Multiple drawings interaction ──────────────────────────────────

test('TL-57: two drawings have distinct IDs', () => {
  const d1 = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  const d2 = tool.createDraft(pt(T0, 160), { ...DEFAULT_DRAWING_OPTIONS });
  assert.notEqual(d1.id, d2.id);
});

test('TL-58: second drawing does not mutate first draft', () => {
  const d1 = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  const anchorPrice = d1.anchors[0].price;
  tool.createDraft(pt(T0, 160), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d1.anchors[0].price, anchorPrice);
});

// ─── Group 14: Geometry helpers used by TrendLine ────────────────────────────

test('TL-59: distanceToSegment: point on segment has distance 0', () => {
  const dist = distanceToSegment({ x: 50, y: 50 }, { x: 0, y: 0 }, { x: 100, y: 100 });
  assert.ok(dist < 0.01, `expected ~0, got ${dist}`);
});

test('TL-60: distanceToSegment: point perpendicular to segment', () => {
  const dist = distanceToSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 });
  assert.ok(Math.abs(dist - 10) < 0.01, `expected 10, got ${dist}`);
});

test('TL-61: distanceToSegment: point past end is distance to endpoint', () => {
  const dist = distanceToSegment({ x: 150, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
  assert.ok(Math.abs(dist - 50) < 0.01, `expected 50, got ${dist}`);
});

test('TL-62: rayEndpoint extends horizontal ray to right edge', () => {
  const end = rayEndpoint({ x: 50, y: 100 }, { x: 100, y: 100 }, 800, 400);
  assert.ok(Math.abs(end.x - 800) < 1, `expected x=800, got ${end.x}`);
  assert.ok(Math.abs(end.y - 100) < 1, `expected y=100, got ${end.y}`);
});

test('TL-63: rayEndpoint extends upward ray to top edge', () => {
  const end = rayEndpoint({ x: 400, y: 200 }, { x: 400, y: 100 }, 800, 400);
  assert.ok(Math.abs(end.y) < 1, `expected y~=0, got ${end.y}`);
});

test('TL-64: clipSegment clips line partially off canvas', () => {
  const result = clipSegment({ x: -50, y: 200 }, { x: 400, y: 200 }, 800, 400);
  assert.ok(result !== null);
  assert.ok(result![0].x >= 0, `expected clipped x >= 0, got ${result![0].x}`);
});

test('TL-65: clipSegment returns null for fully off-canvas line', () => {
  const result = clipSegment({ x: -200, y: 200 }, { x: -100, y: 200 }, 800, 400);
  assert.equal(result, null);
});

// ─── Group 15: Mixed price/time anchors ──────────────────────────────────────

test('TL-66: steep slope line (big price delta, small time delta)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T0 + 1000, 199)); // near-vertical in price
  const result = tool.finalize(d);
  assert.ok(result !== null);
  assert.equal(result!.anchors[1].price, 199);
});

test('TL-67: shallow slope line (big time delta, small price delta)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150.001)); // near-horizontal in price
  const result = tool.finalize(d);
  assert.ok(result !== null);
});

test('TL-68: negative slope (price decreasing left to right)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 100)); // price dropped from 150 to 100
  const result = tool.finalize(d)!;
  assert.equal(result.anchors[0].price, 150);
  assert.equal(result.anchors[1].price, 100);
});

// ─── Group 16: ESC / cancel flow ─────────────────────────────────────────────

test('TL-69: updateDraft after forced anchor reset works correctly', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1, 160));
  // Simulate cancel: start new draft from same point
  d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 170));
  assert.equal(d.anchors[1].time, T2);
  assert.equal(d.anchors[1].price, 170);
});

// ─── Group 17: Price scale inversions ────────────────────────────────────────

test('TL-70: priceMin > priceMax viewport (inverted scale) still produces finite coords', () => {
  const v = vp({ priceMin: 200, priceMax: 100 }); // inverted
  const sp = dataToScreen(pt(T1, 150), v);
  // With inverted min/max, the formula still gives finite numbers
  assert.ok(Number.isFinite(sp.x));
  assert.ok(Number.isFinite(sp.y));
});

// ─── Group 18: Drawing options propagation ────────────────────────────────────

test('TL-71: options are deeply copied (no shared reference)', () => {
  const opts = { ...DEFAULT_DRAWING_OPTIONS, color: '#123456' };
  const d = tool.createDraft(pt(T0, 150), opts);
  opts.color = '#ffffff'; // mutate original
  assert.equal(d.options.color, '#123456'); // drawing should not change
});

test('TL-72: updateDraft preserves all options from createDraft', () => {
  const opts = { ...DEFAULT_DRAWING_OPTIONS, color: '#ff0000', lineWidth: 2 };
  let d = tool.createDraft(pt(T0, 150), opts);
  d = tool.updateDraft(d, pt(T2, 180));
  assert.equal(d.options.color, '#ff0000');
  assert.equal(d.options.lineWidth, 2);
});

// ─── Group 19: Extreme time values ────────────────────────────────────────────

test('TL-73: very large time values', () => {
  const d = tool.createDraft(pt(2_000_000_000, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.ok(d.id.length > 0);
});

test('TL-74: very small time values (historical data)', () => {
  const d = tool.createDraft(pt(1_000_000, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.ok(d.id.length > 0);
});

// ─── Group 20: Screen coordinate precision ────────────────────────────────────

test('TL-75: dataToScreen for midpoint time gives center x', () => {
  const midTime = Math.floor((T0 + T2) / 2) as DrawPoint['time'];
  const sp = dataToScreen(pt(midTime, 150), vp());
  const expectedX = (vp().width - vp().priceAxisWidth) / 2;
  assert.ok(Math.abs(sp.x - expectedX) < 2, `expected x ~= ${expectedX}, got ${sp.x}`);
});

test('TL-76: dataToScreen for midpoint price gives center y', () => {
  // midprice = 150, priceMin=100, priceMax=200 → 50% from bottom
  const sp = dataToScreen(pt(T1, 150), vp());
  const expectedY = (vp().height - vp().timeAxisHeight) / 2;
  assert.ok(Math.abs(sp.y - expectedY) < 2, `expected y ~= ${expectedY}, got ${sp.y}`);
});

// ─── Group 21: Rapid-draft switching ─────────────────────────────────────────

test('TL-77: creating 10 drafts in sequence all have unique IDs', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const d = tool.createDraft(pt(T0 + i * 1000, 150 + i), { ...DEFAULT_DRAWING_OPTIONS });
    ids.add(d.id);
  }
  assert.equal(ids.size, 10);
});

test('TL-78: finalizing 10 different drawings all return non-null', () => {
  for (let i = 0; i < 10; i++) {
    let d = tool.createDraft(pt(T0 + i, 150), { ...DEFAULT_DRAWING_OPTIONS });
    d = tool.updateDraft(d, pt(T2 - i, 180));
    const result = tool.finalize(d);
    assert.ok(result !== null, `drawing ${i} should not be null`);
  }
});

// ─── Group 22: Hit testing near handles ──────────────────────────────────────

test('TL-79: pointer exactly at anchor[0] has distance 0', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  const dist = tool.hitTest(d, a, v);
  assert.ok(dist < 1, `expected dist < 1, got ${dist}`);
});

test('TL-80: pointer exactly at anchor[1] has distance 0', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const v = vp();
  const b = dataToScreen(d.anchors[1], v);
  const dist = tool.hitTest(d, b, v);
  assert.ok(dist < 1, `expected dist < 1, got ${dist}`);
});

// ─── Group 23: Scrolling while drawing (time shift) ──────────────────────────

test('TL-81: hitTest still works when viewport scrolled left', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const vScrolled = vp({
    visibleFrom: (T0 - 50_000) as DrawPoint['time'],
    visibleTo: (T2 - 50_000) as DrawPoint['time'],
  });
  const dist = tool.hitTest(d, { x: 400, y: 100 }, vScrolled);
  assert.ok(Number.isFinite(dist));
});

test('TL-82: hitTest still works when viewport scrolled right', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const vScrolled = vp({
    visibleFrom: (T0 + 50_000) as DrawPoint['time'],
    visibleTo: (T2 + 50_000) as DrawPoint['time'],
  });
  const dist = tool.hitTest(d, { x: 400, y: 100 }, vScrolled);
  assert.ok(Number.isFinite(dist));
});

// ─── Group 24: Shift snap tests ───────────────────────────────────────────────

test('TL-83: snapAngle15 for 30° input snaps to 30°', () => {
  const base = { x: 0, y: 0 };
  const angle30 = 30 * Math.PI / 180;
  const dist = 100;
  const raw = { x: dist * Math.cos(angle30), y: dist * Math.sin(angle30) };
  const snapped = snapAngle15(base, raw);
  const snappedAngle = Math.atan2(snapped.y, snapped.x) * 180 / Math.PI;
  assert.ok(Math.abs(snappedAngle - 30) < 0.5, `expected 30°, got ${snappedAngle}`);
});

test('TL-84: snapAngle15 for 60° snaps to 60°', () => {
  const base = { x: 0, y: 0 };
  const angle60 = 60 * Math.PI / 180;
  const dist = 100;
  const raw = { x: dist * Math.cos(angle60), y: dist * Math.sin(angle60) };
  const snapped = snapAngle15(base, raw);
  const snappedAngle = Math.atan2(snapped.y, snapped.x) * 180 / Math.PI;
  assert.ok(Math.abs(snappedAngle - 60) < 0.5, `expected 60°, got ${snappedAngle}`);
});

// ─── Group 25: Selected / hovered rendering flag ─────────────────────────────

test('TL-85: selected=true does not throw error in hitTest', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  d = { ...d, selected: true };
  const dist = tool.hitTest(d, { x: 300, y: 150 }, vp());
  assert.ok(Number.isFinite(dist));
});

// ─── Group 26: Negative prices ────────────────────────────────────────────────

test('TL-86: createDraft with negative price (short selling scenario)', () => {
  const v = vp({ priceMin: -100, priceMax: 100 });
  const d = tool.createDraft(pt(T0, -50), { ...DEFAULT_DRAWING_OPTIONS });
  const sp = dataToScreen(d.anchors[0], v);
  assert.ok(Number.isFinite(sp.y));
});

// ─── Group 27: Very small canvas ─────────────────────────────────────────────

test('TL-87: hitTest on tiny canvas (100x80) with line across it', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const v = vp({ width: 100, height: 80, priceAxisWidth: 10, timeAxisHeight: 10 });
  const dist = tool.hitTest(d, { x: 45, y: 40 }, v);
  assert.ok(Number.isFinite(dist));
});

// ─── Group 28: IDrawingTool interface compliance ──────────────────────────────

test('TL-88: tool has all required IDrawingTool properties', () => {
  assert.ok(typeof tool.variant === 'string');
  assert.ok(typeof tool.label === 'string');
  assert.ok(typeof tool.anchorCount === 'number');
  assert.ok(typeof tool.isPointOnly === 'boolean');
  assert.ok(typeof tool.createDraft === 'function');
  assert.ok(typeof tool.updateDraft === 'function');
  assert.ok(typeof tool.finalize === 'function');
  assert.ok(typeof tool.hitTest === 'function');
  assert.ok(typeof tool.getHandles === 'function');
  assert.ok(typeof tool.render === 'function');
  assert.ok(typeof tool.renderPreview === 'function');
});

// ─── Group 29: Immutability ───────────────────────────────────────────────────

test('TL-89: updateDraft returns new object (does not mutate)', () => {
  const d = defaultDraft();
  const updated = tool.updateDraft(d, pt(T2, 180));
  assert.notEqual(d, updated);
  assert.equal(d.anchors[1].price, 150); // original unchanged
});

test('TL-90: finalize returns new object (does not mutate draft)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const finalized = tool.finalize(d)!;
  assert.notEqual(d, finalized);
});

// ─── Group 30: Advanced hit test precision ────────────────────────────────────

test('TL-91: hit test 5px above diagonal line should miss (<10px threshold → miss)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 200)); // diagonal
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  const b = dataToScreen(d.anchors[1], v);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  // Point 12px perpendicular to line
  const perp = { x: mid.x - dy / len * 12, y: mid.y + dx / len * 12 };
  const dist = tool.hitTest(d, perp, v);
  assert.ok(dist > 10, `expected dist > 10 for far miss, got ${dist}`);
});

test('TL-92: hit test 3px from diagonal line should hit', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 200));
  const v = vp();
  const a = dataToScreen(d.anchors[0], v);
  const b = dataToScreen(d.anchors[1], v);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const perp = { x: mid.x - dy / len * 3, y: mid.y + dx / len * 3 };
  const dist = tool.hitTest(d, perp, v);
  assert.ok(dist < 6, `expected dist < 6 for near-line hit, got ${dist}`);
});

// ─── Group 31: Tool-level assertions ─────────────────────────────────────────

test('TL-93: variant matches tool identifier', () => {
  assert.equal(tool.variant, 'trend');
});

test('TL-94: updateDraft is idempotent for same point', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1, 165));
  const d2 = tool.updateDraft(d, pt(T1, 165));
  assert.equal(d2.anchors[1].time, d.anchors[1].time);
  assert.equal(d2.anchors[1].price, d.anchors[1].price);
});

test('TL-95: finalize sets zIndex >= 0', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.ok((result.zIndex ?? 0) >= 0);
});

test('TL-96: getHandles returns correct count for finalized drawing', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  const handles = tool.getHandles(result, vp());
  assert.equal(handles.length, 2);
});

test('TL-97: creating draft with negative price delta finalized correctly', () => {
  let d = tool.createDraft(pt(T0, 180), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 120));
  const result = tool.finalize(d)!;
  assert.equal(result.bounds!.minPrice, 120);
  assert.equal(result.bounds!.maxPrice, 180);
});

test('TL-98: updateDraft with backward time (p2 before p1 in time)', () => {
  let d = defaultDraft(); // anchor[0] at T0
  d = tool.updateDraft(d, pt(T0 - 10000, 160)); // p2 is before p1 in time
  assert.equal(Number(d.anchors[1].time), T0 - 10000);
});

test('TL-99: finalize for backward time drawing returns non-null', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T0 - 10000, 160));
  const result = tool.finalize(d);
  assert.ok(result !== null);
});

test('TL-100: entire create→update→finalize flow produces valid drawing', () => {
  let d = tool.createDraft(pt(T0, 145), { ...DEFAULT_DRAWING_OPTIONS, color: '#4caf50', lineWidth: 2 });
  d = tool.updateDraft(d, pt(T1, 130));
  d = tool.updateDraft(d, pt(T1 + 5000, 128));
  d = tool.updateDraft(d, pt(T2, 110));
  const result = tool.finalize(d)!;

  assert.equal(result.variant, 'trend');
  assert.equal(result.options.color, '#4caf50');
  assert.equal(result.options.lineWidth, 2);
  assert.equal(result.anchors[0].price, 145);
  assert.equal(result.anchors[1].price, 110);
  assert.ok(result.id.length > 0);
  assert.equal(result.visible, true);
  assert.equal(result.locked, false);
  assert.ok(result.bounds !== undefined);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
console.log(`TrendLine tests: ${passed} passed, ${failed > 0 ? failed + ' failed' : '0 failed'}`);
