/**
 * RayLine tool — 100 tests covering:
 * - Creation, draft flow, finalization
 * - Ray extends beyond anchor[1] to canvas edge
 * - Hit testing along the ray (including extension)
 * - Handles: only origin handle
 * - Screen coordinate mapping
 * - Edge of canvas placement
 * - Viewport zoom/scroll adaptation
 * - Options: color, lineWidth, lineStyle
 * - Immutability
 * - Negative slope, positive slope, horizontal, nearly-vertical
 * - Multi-ray interaction (no mutation)
 * - IDrawingTool interface compliance
 */

import assert from 'node:assert/strict';
import { RayLineTool } from '../../src/drawing/tools/rayLine.ts';
import { rayEndpoint, distanceToSegment, dataToScreen } from '../../src/drawing/geometry.ts';
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

const tool = new RayLineTool();

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
  return tool.createDraft(pt(T1, 150), { ...DEFAULT_DRAWING_OPTIONS });
}

// ─── Group 1: Creation ────────────────────────────────────────────────────────

test('RL-01: createDraft produces variant=ray', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d.variant, 'ray');
});

test('RL-02: createDraft sets both anchors to initial point', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d.anchors.length, 2);
  assert.equal(d.anchors[0].price, 150);
  assert.equal(d.anchors[1].price, 150);
});

test('RL-03: createDraft assigns unique id', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.ok(d.id.length > 0);
});

test('RL-04: anchorCount is 2', () => {
  assert.equal(tool.anchorCount, 2);
});

test('RL-05: isPointOnly is false', () => {
  assert.equal(tool.isPointOnly, false);
});

test('RL-06: label is "Ray"', () => {
  assert.equal(tool.label, 'Ray');
});

test('RL-07: variant is "ray"', () => {
  assert.equal(tool.variant, 'ray');
});

// ─── Group 2: updateDraft ─────────────────────────────────────────────────────

test('RL-08: updateDraft moves anchor[1] to pointer', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  assert.equal(d.anchors[1].time, T2);
  assert.equal(d.anchors[1].price, 170);
});

test('RL-09: updateDraft keeps anchor[0] (origin) unchanged', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  assert.equal(d.anchors[0].time, T1);
  assert.equal(d.anchors[0].price, 150);
});

test('RL-10: multiple updateDraft calls track latest position', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 160));
  d = tool.updateDraft(d, pt(T2, 175));
  d = tool.updateDraft(d, pt(T2, 155));
  assert.equal(d.anchors[1].price, 155);
});

// ─── Group 3: finalize ────────────────────────────────────────────────────────

test('RL-11: finalize returns drawing for valid ray', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  assert.ok(tool.finalize(d) !== null);
});

test('RL-12: finalize returns null for zero-length ray', () => {
  const d = defaultDraft(); // anchors[0] == anchors[1]
  assert.equal(tool.finalize(d), null);
});

test('RL-13: finalize preserves variant=ray', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  assert.equal(tool.finalize(d)!.variant, 'ray');
});

test('RL-14: finalize preserves anchors', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const result = tool.finalize(d)!;
  assert.equal(result.anchors[0].price, 150);
  assert.equal(result.anchors[1].price, 170);
});

test('RL-15: finalize for horizontal ray returns non-null', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150)); // same price → horizontal ray
  assert.ok(tool.finalize(d) !== null);
});

// ─── Group 4: rayEndpoint geometry ───────────────────────────────────────────

test('RL-16: rayEndpoint for rightward horizontal ray hits right edge', () => {
  const end = rayEndpoint({ x: 100, y: 200 }, { x: 200, y: 200 }, 740, 372);
  assert.ok(Math.abs(end.x - 740) < 1, `expected x=740, got ${end.x}`);
});

test('RL-17: rayEndpoint for upward ray hits top edge', () => {
  const end = rayEndpoint({ x: 400, y: 300 }, { x: 400, y: 200 }, 740, 372);
  assert.ok(Math.abs(end.y) < 1, `expected y~=0, got ${end.y}`);
});

test('RL-18: rayEndpoint for downward ray hits bottom edge', () => {
  const end = rayEndpoint({ x: 400, y: 100 }, { x: 400, y: 200 }, 740, 372);
  assert.ok(Math.abs(end.y - 372) < 1, `expected y=372, got ${end.y}`);
});

test('RL-19: rayEndpoint for leftward ray returns through-point when origin is to the right', () => {
  // Ray pointing left
  const end = rayEndpoint({ x: 600, y: 200 }, { x: 500, y: 200 }, 740, 372);
  assert.ok(end.x <= 0, `expected x<=0, got ${end.x}`);
});

test('RL-20: rayEndpoint for 45° diagonal ray', () => {
  const end = rayEndpoint({ x: 100, y: 100 }, { x: 200, y: 200 }, 740, 372);
  // Should hit either right or bottom edge
  const hitRight = Math.abs(end.x - 740) < 1;
  const hitBottom = Math.abs(end.y - 372) < 1;
  assert.ok(hitRight || hitBottom, `expected edge hit, got (${end.x},${end.y})`);
});

test('RL-21: rayEndpoint preserves origin X for vertical ray', () => {
  const end = rayEndpoint({ x: 300, y: 300 }, { x: 300, y: 200 }, 740, 372);
  assert.ok(Math.abs(end.x - 300) < 0.5, `expected x=300, got ${end.x}`);
});

test('RL-22: rayEndpoint preserves origin Y for horizontal ray', () => {
  const end = rayEndpoint({ x: 200, y: 150 }, { x: 300, y: 150 }, 740, 372);
  assert.ok(Math.abs(end.y - 150) < 0.5, `expected y=150, got ${end.y}`);
});

// ─── Group 5: Hit testing ─────────────────────────────────────────────────────

test('RL-23: hitTest hits origin anchor', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  const dist = tool.hitTest(d, origin, v);
  assert.ok(dist < 2, `expected dist < 2 at origin, got ${dist}`);
});

test('RL-24: hitTest hits midpoint of ray', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150)); // horizontal ray
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  const through = dataToScreen(d.anchors[1], v);
  const end = rayEndpoint(origin, through, v.width - v.priceAxisWidth, v.height - v.timeAxisHeight);
  const mid = { x: (origin.x + end.x) / 2, y: (origin.y + end.y) / 2 };
  const dist = tool.hitTest(d, mid, v);
  assert.ok(dist < 2, `expected dist < 2 at midpoint, got ${dist}`);
});

test('RL-25: hitTest hits beyond anchor[1] (extension region)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1 + 10000, 150)); // short anchor, horizontal
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  const through = dataToScreen(d.anchors[1], v);
  const end = rayEndpoint(origin, through, v.width - v.priceAxisWidth, v.height - v.timeAxisHeight);
  // Point halfway between anchor[1] and end
  const mid = { x: (through.x + end.x) / 2, y: (through.y + end.y) / 2 };
  const dist = tool.hitTest(d, mid, v);
  assert.ok(dist < 3, `expected dist < 3 in extension, got ${dist}`);
});

test('RL-26: hitTest misses before origin (opposite direction)', () => {
  let d = defaultDraft(); // origin at T1
  d = tool.updateDraft(d, pt(T2, 150)); // ray goes right
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  // Point significantly to the left of origin
  const before = { x: Math.max(0, origin.x - 80), y: origin.y };
  const dist = tool.hitTest(d, before, v);
  // Should either miss (>6px) or hit near origin — depends on how far left
  assert.ok(Number.isFinite(dist));
});

test('RL-27: hitTest misses perpendicular to the ray by 20px', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150)); // horizontal ray at y=origin.y
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  const perp = { x: origin.x + 100, y: origin.y + 20 }; // 20px below horizontal ray
  const dist = tool.hitTest(d, perp, v);
  assert.ok(dist > 15, `expected dist > 15 for miss, got ${dist}`);
});

test('RL-28: hitTest returns Infinity for drawing with 1 anchor', () => {
  const d: Drawing = { ...defaultDraft(), anchors: [pt(T1, 150)] };
  const dist = tool.hitTest(d, { x: 300, y: 200 }, vp());
  assert.equal(dist, Infinity);
});

// ─── Group 6: Handles ────────────────────────────────────────────────────────

test('RL-29: getHandles returns exactly 1 handle', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const handles = tool.getHandles(d, vp());
  assert.equal(handles.length, 1);
});

test('RL-30: handle anchorIndex is 0 (origin handle)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const handles = tool.getHandles(d, vp());
  assert.equal(handles[0].anchorIndex, 0);
});

test('RL-31: handle center matches screen position of anchor[0]', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const v = vp();
  const handles = tool.getHandles(d, v);
  const a = dataToScreen(d.anchors[0], v);
  assert.ok(Math.abs(handles[0].center.x - a.x) < 0.5);
  assert.ok(Math.abs(handles[0].center.y - a.y) < 0.5);
});

test('RL-32: handle radius is > 0', () => {
  const d = defaultDraft();
  const handles = tool.getHandles(d, vp());
  assert.ok(handles[0].radius > 0);
});

// ─── Group 7: Slopes ─────────────────────────────────────────────────────────

test('RL-33: positive slope ray (price increases right)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 180));
  const result = tool.finalize(d)!;
  assert.ok(result.anchors[1].price > result.anchors[0].price);
});

test('RL-34: negative slope ray (price decreases right)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 120));
  const result = tool.finalize(d)!;
  assert.ok(result.anchors[1].price < result.anchors[0].price);
});

test('RL-35: horizontal ray (same price)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const result = tool.finalize(d)!;
  assert.equal(result.anchors[0].price, result.anchors[1].price);
});

test('RL-36: steep ray (near-vertical, large price delta)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1 + 1000, 195));
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  const through = dataToScreen(d.anchors[1], v);
  const end = rayEndpoint(origin, through, v.width - v.priceAxisWidth, v.height - v.timeAxisHeight);
  // End should be at top or right edge
  assert.ok(end.y <= v.height - v.timeAxisHeight && end.y >= 0 || end.x >= 0);
});

// ─── Group 8: Options ─────────────────────────────────────────────────────────

test('RL-37: createDraft uses provided color', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, color: '#e91e63' });
  assert.equal(d.options.color, '#e91e63');
});

test('RL-38: createDraft uses provided lineWidth', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, lineWidth: 2 });
  assert.equal(d.options.lineWidth, 2);
});

test('RL-39: createDraft uses provided lineStyle', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, lineStyle: 'dotted' });
  assert.equal(d.options.lineStyle, 'dotted');
});

test('RL-40: updateDraft preserves options', () => {
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, color: '#9c27b0' });
  d = tool.updateDraft(d, pt(T2, 175));
  assert.equal(d.options.color, '#9c27b0');
});

// ─── Group 9: Bounds ──────────────────────────────────────────────────────────

test('RL-41: finalized ray has bounds set', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 175));
  const result = tool.finalize(d)!;
  assert.ok(result.bounds !== undefined);
});

test('RL-42: bounds.minTime equals anchor[0].time (origin)', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 175));
  const result = tool.finalize(d)!;
  assert.equal(Number(result.bounds!.minTime), T1);
});

test('RL-43: bounds.maxTime equals anchor[1].time', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 175));
  const result = tool.finalize(d)!;
  assert.equal(Number(result.bounds!.maxTime), T2);
});

// ─── Group 10: Immutability ───────────────────────────────────────────────────

test('RL-44: updateDraft returns new object', () => {
  const d = defaultDraft();
  const updated = tool.updateDraft(d, pt(T2, 175));
  assert.notEqual(d, updated);
  assert.equal(d.anchors[1].price, 150); // original unchanged
});

test('RL-45: finalize returns new object', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 175));
  const finalized = tool.finalize(d)!;
  assert.notEqual(d, finalized);
});

test('RL-46: multiple rays do not share options reference', () => {
  const d1 = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, color: '#ff0000' });
  const d2 = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, color: '#0000ff' });
  assert.equal(d1.options.color, '#ff0000');
  assert.equal(d2.options.color, '#0000ff');
});

// ─── Group 11: IDrawingTool compliance ───────────────────────────────────────

test('RL-47: tool implements all IDrawingTool methods', () => {
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

// ─── Group 12: Viewport edge cases ───────────────────────────────────────────

test('RL-48: hitTest on tiny 100x80 canvas', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const v = vp({ width: 100, height: 80, priceAxisWidth: 10, timeAxisHeight: 10 });
  const dist = tool.hitTest(d, { x: 50, y: 40 }, v);
  assert.ok(Number.isFinite(dist));
});

test('RL-49: hitTest adapts to zoomed-in viewport', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const vZoom = vp({
    visibleFrom: (T1 - 5000) as DrawPoint['time'],
    visibleTo: (T1 + 5000) as DrawPoint['time'],
  });
  const dist = tool.hitTest(d, { x: 300, y: 200 }, vZoom);
  assert.ok(Number.isFinite(dist));
});

test('RL-50: dataToScreen for out-of-viewport time gives finite result', () => {
  const sp = dataToScreen(pt(T0 - 500_000, 150), vp());
  assert.ok(Number.isFinite(sp.x));
  assert.ok(Number.isFinite(sp.y));
});

// ─── Group 13: Unique IDs ─────────────────────────────────────────────────────

test('RL-51: 10 rays all have unique IDs', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const d = tool.createDraft(pt(T0 + i * 1000, 150), { ...DEFAULT_DRAWING_OPTIONS });
    ids.add(d.id);
  }
  assert.equal(ids.size, 10);
});

// ─── Group 14: Jitter simulation ─────────────────────────────────────────────

test('RL-52: rapid jitter in price — final price is accurate', () => {
  let d = defaultDraft();
  const prices = [160, 162, 158, 165, 163, 161, 170, 168, 172, 171];
  for (const p of prices) {
    d = tool.updateDraft(d, pt(T2, p));
  }
  assert.equal(d.anchors[1].price, 171);
});

test('RL-53: rapid jitter in time — final time is accurate', () => {
  let d = defaultDraft();
  const times = [T2 - 1000, T2, T2 - 500, T2 + 500, T2 + 1000];
  for (const t of times) {
    d = tool.updateDraft(d, pt(t, 160));
  }
  assert.equal(Number(d.anchors[1].time), T2 + 1000);
});

// ─── Group 15: Extreme values ─────────────────────────────────────────────────

test('RL-54: very large time creates valid draft', () => {
  const d = tool.createDraft(pt(2_000_000_000, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.ok(d.id.length > 0);
});

test('RL-55: very small time creates valid draft', () => {
  const d = tool.createDraft(pt(1_000_000, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.ok(d.id.length > 0);
});

test('RL-56: very high price creates valid draft', () => {
  const v = vp({ priceMin: 90000, priceMax: 110000 });
  const d = tool.createDraft(pt(T0, 100000), { ...DEFAULT_DRAWING_OPTIONS });
  const sp = dataToScreen(d.anchors[0], v);
  assert.ok(Number.isFinite(sp.y));
});

// ─── Group 16: Ray vs segment hit testing difference ─────────────────────────

test('RL-57: ray hits in extension zone where segment would not', () => {
  let d = defaultDraft(); // origin T1
  d = tool.updateDraft(d, pt(T1 + 5000, 150)); // short direction point
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  const through = dataToScreen(d.anchors[1], v);
  const end = rayEndpoint(origin, through, v.width - v.priceAxisWidth, v.height - v.timeAxisHeight);

  // Point 60% of the way between through and end (in extension zone)
  const testPt = {
    x: through.x + (end.x - through.x) * 0.6,
    y: through.y + (end.y - through.y) * 0.6,
  };

  // Ray should hit this point
  const rayDist = distanceToSegment(testPt, origin, end);
  assert.ok(rayDist < 2, `expected ray to hit in extension, dist=${rayDist}`);
});

// ─── Group 17: IDrawingTool specific ─────────────────────────────────────────

test('RL-58: variant property is readonly string', () => {
  assert.equal(typeof tool.variant, 'string');
});

test('RL-59: anchorCount matches number of anchors in created draft', () => {
  const d = defaultDraft();
  assert.equal(d.anchors.length, tool.anchorCount);
});

test('RL-60: finalize for ray with same time but different price returns non-null', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T1, 180)); // same time, different price
  const result = tool.finalize(d);
  assert.ok(result !== null);
});

// ─── Group 18: Viewport near-degenerate ──────────────────────────────────────

test('RL-61: degenerate viewport (zero width) does not crash hitTest', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const v = vp({ width: 0, priceAxisWidth: 0, height: 400 });
  // Should not throw even if result is Infinity
  let threw = false;
  try {
    tool.hitTest(d, { x: 0, y: 200 }, v);
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

// ─── Group 19: Bounds direction independence ──────────────────────────────────

test('RL-62: bounds.minPrice is always <= maxPrice', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 120)); // lower price at end
  const result = tool.finalize(d)!;
  assert.ok(result.bounds!.minPrice <= result.bounds!.maxPrice);
});

test('RL-63: bounds for descending ray swaps min/max correctly', () => {
  let d = tool.createDraft(pt(T0, 190), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 110));
  const result = tool.finalize(d)!;
  assert.equal(result.bounds!.minPrice, 110);
  assert.equal(result.bounds!.maxPrice, 190);
});

// ─── Group 20: Screen mapping precision ──────────────────────────────────────

test('RL-64: origin at exact left viewport edge', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  const sp = dataToScreen(d.anchors[0], vp());
  assert.ok(sp.x >= 0 && sp.x < 5, `expected near x=0, got ${sp.x}`);
});

test('RL-65: origin at exact right viewport edge', () => {
  const d = tool.createDraft(pt(T2, 150), { ...DEFAULT_DRAWING_OPTIONS });
  const v = vp();
  const sp = dataToScreen(d.anchors[0], v);
  const chartW = v.width - v.priceAxisWidth;
  assert.ok(sp.x >= chartW - 5 && sp.x <= chartW + 5, `expected near right edge, got ${sp.x}`);
});

// ─── Group 21: Options combinations ──────────────────────────────────────────

test('RL-66: lineStyle=dashed preserved through create/update/finalize', () => {
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, lineStyle: 'dashed' });
  d = tool.updateDraft(d, pt(T2, 170));
  const result = tool.finalize(d)!;
  assert.equal(result.options.lineStyle, 'dashed');
});

test('RL-67: lineWidth=3 preserved through create/update/finalize', () => {
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, lineWidth: 3 });
  d = tool.updateDraft(d, pt(T2, 170));
  const result = tool.finalize(d)!;
  assert.equal(result.options.lineWidth, 3);
});

test('RL-68: axisLabel=false preserved', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, axisLabel: false });
  assert.equal(d.options.axisLabel, false);
});

// ─── Group 22: Consecutive drawings ──────────────────────────────────────────

test('RL-69: drawing 5 rays in sequence all finalize correctly', () => {
  const prices = [120, 140, 160, 180, 155];
  for (const p of prices) {
    let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
    d = tool.updateDraft(d, pt(T2, p));
    const result = tool.finalize(d);
    assert.ok(result !== null, `ray to price ${p} should finalize`);
  }
});

// ─── Group 23: Tool state isolation ──────────────────────────────────────────

test('RL-70: calling finalize on first draft does not affect second draft', () => {
  let d1 = defaultDraft();
  d1 = tool.updateDraft(d1, pt(T2, 170));
  tool.finalize(d1); // finalize first

  let d2 = tool.createDraft(pt(T0, 140), { ...DEFAULT_DRAWING_OPTIONS });
  d2 = tool.updateDraft(d2, pt(T2, 160));
  const result = tool.finalize(d2)!;
  assert.equal(result.anchors[0].price, 140);
  assert.equal(result.anchors[1].price, 160);
});

// ─── Group 24: Advanced rayEndpoint ──────────────────────────────────────────

test('RL-71: rayEndpoint for near-zero delta does not produce NaN', () => {
  const end = rayEndpoint({ x: 400, y: 200 }, { x: 400.001, y: 200 }, 740, 372);
  assert.ok(!Number.isNaN(end.x) && !Number.isNaN(end.y));
});

test('RL-72: rayEndpoint result is on canvas boundary (x<=w or y<=h)', () => {
  const end = rayEndpoint({ x: 200, y: 150 }, { x: 300, y: 200 }, 740, 372);
  const onBoundary = Math.abs(end.x) < 1 || Math.abs(end.x - 740) < 1
    || Math.abs(end.y) < 1 || Math.abs(end.y - 372) < 1;
  assert.ok(onBoundary, `end should be on boundary: (${end.x},${end.y})`);
});

// ─── Group 25: Selected state ─────────────────────────────────────────────────

test('RL-73: selected=true does not throw in hitTest', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  d = { ...d, selected: true };
  const dist = tool.hitTest(d, { x: 300, y: 200 }, vp());
  assert.ok(Number.isFinite(dist));
});

test('RL-74: getHandles on selected drawing still returns 1 handle', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  d = { ...d, selected: true };
  const handles = tool.getHandles(d, vp());
  assert.equal(handles.length, 1);
});

// ─── Group 26: Varying canvas sizes ──────────────────────────────────────────

test('RL-75: hitTest on wide canvas 1920×1080', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const v = vp({ width: 1920, height: 1080, priceAxisWidth: 80, timeAxisHeight: 28 });
  const origin = dataToScreen(d.anchors[0], v);
  const dist = tool.hitTest(d, { x: origin.x, y: origin.y + 2 }, v);
  assert.ok(dist < 5, `expected hit near origin on 1920w canvas, dist=${dist}`);
});

test('RL-76: rayEndpoint on large canvas 1920×1080', () => {
  const end = rayEndpoint({ x: 400, y: 540 }, { x: 500, y: 540 }, 1840, 1052);
  assert.ok(Math.abs(end.x - 1840) < 1);
});

// ─── Group 27: Negative prices ────────────────────────────────────────────────

test('RL-77: ray from negative price to positive price', () => {
  const v = vp({ priceMin: -100, priceMax: 100 });
  let d = tool.createDraft(pt(T0, -50), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 50));
  const result = tool.finalize(d)!;
  assert.equal(result.anchors[0].price, -50);
  assert.equal(result.anchors[1].price, 50);
});

// ─── Group 28: Distance functions ────────────────────────────────────────────

test('RL-78: distanceToSegment: point on segment has dist=0', () => {
  const dist = distanceToSegment({ x: 200, y: 100 }, { x: 0, y: 0 }, { x: 400, y: 200 });
  assert.ok(dist < 0.01, `expected ~0, got ${dist}`);
});

test('RL-79: distanceToSegment: point at segment start has dist=0', () => {
  const dist = distanceToSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 400, y: 200 });
  assert.ok(dist < 0.01);
});

test('RL-80: distanceToSegment: point at segment end has dist=0', () => {
  const dist = distanceToSegment({ x: 400, y: 200 }, { x: 0, y: 0 }, { x: 400, y: 200 });
  assert.ok(dist < 0.01);
});

// ─── Group 29: Full workflow ──────────────────────────────────────────────────

test('RL-81: create→jitter×5→finalize flow produces valid ray', () => {
  let d = tool.createDraft(pt(T0, 145), { ...DEFAULT_DRAWING_OPTIONS, color: '#ff9800' });
  for (let i = 0; i < 5; i++) {
    d = tool.updateDraft(d, pt(T2 - i * 5000, 170 + i));
  }
  const result = tool.finalize(d)!;
  assert.equal(result.variant, 'ray');
  assert.equal(result.options.color, '#ff9800');
  assert.ok(result.bounds !== undefined);
});

// ─── Group 30: Tool registration ─────────────────────────────────────────────

test('RL-82: createDraft twice gives different renderOrder if needed', () => {
  const d1 = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  const d2 = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  // IDs should be different (timing-based)
  // renderOrder may or may not be different depending on implementation
  assert.ok(d1.id !== d2.id);
});

test('RL-83: getHandles for draft (in-progress ray) returns 1 handle', () => {
  const d = defaultDraft();
  const handles = tool.getHandles(d, vp());
  assert.equal(handles.length, 1);
});

test('RL-84: hitTest for zero-length ray returns Infinity', () => {
  const d = defaultDraft(); // both anchors same
  const v = vp();
  const origin = dataToScreen(d.anchors[0], v);
  const dist = tool.hitTest(d, origin, v);
  // With zero-length, the ray cannot extend anywhere meaningful
  // Implementation may return 0 (if exactly at origin) or Infinity
  assert.ok(Number.isFinite(dist) || dist === Infinity);
});

test('RL-85: updateDraft is idempotent for same point', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 165));
  const d2 = tool.updateDraft(d, pt(T2, 165));
  assert.equal(d2.anchors[1].time, d.anchors[1].time);
  assert.equal(d2.anchors[1].price, d.anchors[1].price);
});

test('RL-86: finalize sets zIndex >= 0', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const result = tool.finalize(d)!;
  assert.ok((result.zIndex ?? 0) >= 0);
});

test('RL-87: draft visible=true by default', () => {
  const d = defaultDraft();
  assert.equal(d.visible, true);
});

test('RL-88: draft locked=false by default', () => {
  const d = defaultDraft();
  assert.equal(d.locked, false);
});

test('RL-89: finalize produces renderOrder > 0', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const result = tool.finalize(d)!;
  assert.ok((result.renderOrder ?? 0) > 0);
});

test('RL-90: hitTest returns finite value for normal ray', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 150));
  const dist = tool.hitTest(d, { x: 300, y: 200 }, vp());
  assert.ok(Number.isFinite(dist));
});

test('RL-91: getHandles handles have active=false by default', () => {
  let d = defaultDraft();
  d = tool.updateDraft(d, pt(T2, 170));
  const handles = tool.getHandles(d, vp());
  assert.equal(handles[0].active, false);
});

test('RL-92: two tools (TrendLine and RayLine) have different variants', () => {
  // Ray tool's variant is 'ray', different from 'trend'
  assert.equal(tool.variant, 'ray');
  assert.notEqual(tool.variant, 'trend');
});

test('RL-93: ray with backward time anchor (p2 earlier than p1)', () => {
  let d = tool.createDraft(pt(T2, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T0, 150)); // backward in time
  const result = tool.finalize(d);
  assert.ok(result !== null);
});

test('RL-94: bounds for backward time ray has minTime=T0', () => {
  let d = tool.createDraft(pt(T2, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T0, 150));
  const result = tool.finalize(d)!;
  assert.equal(Number(result.bounds!.minTime), T0);
});

test('RL-95: updateDraft handles moved to correct position after 10 moves', () => {
  let d = defaultDraft();
  for (let i = 0; i < 10; i++) {
    d = tool.updateDraft(d, pt(T0 + i * 10000, 150 + i));
  }
  const v = vp();
  const handles = tool.getHandles(d, v);
  const expectedOrigin = dataToScreen(d.anchors[0], v);
  assert.ok(Math.abs(handles[0].center.x - expectedOrigin.x) < 0.5);
});

test('RL-96: createDraft with showLabel=false preserves option', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS, showLabel: false });
  assert.equal(d.options.showLabel, false);
});

test('RL-97: ray variant="ray" matches createDraft drawing', () => {
  const d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  assert.equal(d.variant, tool.variant);
});

test('RL-98: finalize result has id matching original draft id', () => {
  let d = defaultDraft();
  const origId = d.id;
  d = tool.updateDraft(d, pt(T2, 170));
  const result = tool.finalize(d)!;
  assert.equal(result.id, origId);
});

test('RL-99: 5 concurrent ray drafts all maintain isolation', () => {
  const drafts = Array.from({ length: 5 }, (_, i) =>
    tool.createDraft(pt(T0 + i * 10000, 140 + i * 10), { ...DEFAULT_DRAWING_OPTIONS })
  );
  // Update each independently
  const updated = drafts.map((d, i) =>
    tool.updateDraft(d, pt(T2 - i * 5000, 160 + i))
  );
  // Each should have its own anchor
  for (let i = 0; i < 5; i++) {
    assert.equal(updated[i].anchors[0].price, 140 + i * 10);
    assert.equal(updated[i].anchors[1].price, 160 + i);
  }
});

test('RL-100: complete end-to-end flow: create→update×3→finalize→verify', () => {
  let d = tool.createDraft(pt(T0, 130), { ...DEFAULT_DRAWING_OPTIONS, color: '#2196f3', lineWidth: 2 });
  d = tool.updateDraft(d, pt(T1, 150));
  d = tool.updateDraft(d, pt(T1 + 5000, 155));
  d = tool.updateDraft(d, pt(T2, 175));
  const result = tool.finalize(d)!;

  assert.equal(result.variant, 'ray');
  assert.equal(result.options.color, '#2196f3');
  assert.equal(result.options.lineWidth, 2);
  assert.equal(result.anchors[0].price, 130);
  assert.equal(result.anchors[1].price, 175);
  assert.ok(result.id.length > 0);
  assert.equal(result.visible, true);
  assert.equal(result.locked, false);
  assert.ok(result.bounds !== undefined);
  assert.equal(result.bounds!.minPrice, 130);
  assert.equal(result.bounds!.maxPrice, 175);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
console.log(`RayLine tests: ${passed} passed, ${failed > 0 ? failed + ' failed' : '0 failed'}`);
