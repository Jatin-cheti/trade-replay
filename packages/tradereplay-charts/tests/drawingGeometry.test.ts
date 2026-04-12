import assert from 'node:assert/strict';
import {
  getParallelChannelGeometry,
  getPitchforkGeometry,
  getRegressionTrendGeometry,
  getRaySegment,
  snapTrendAngleSegment,
  type CanvasPoint,
} from '../../../frontend/services/tools/drawingGeometry.ts';
import { selectNearestDrawingId } from '../../../frontend/services/tools/toolEngine.ts';
import { buildToolOptions, type Drawing, type DrawPoint } from '../../../frontend/services/tools/toolRegistry.ts';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK  ${name}`);
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    console.error(`      ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function slope(segment: [CanvasPoint, CanvasPoint]): number {
  return (segment[1].y - segment[0].y) / ((segment[1].x - segment[0].x) || 1);
}

function makeDrawing(variant: Drawing['variant'], id: string, anchors: DrawPoint[]): Drawing {
  return {
    id,
    type: 'line',
    variant,
    anchors,
    options: buildToolOptions(variant),
    selected: false,
    locked: false,
    visible: true,
  };
}

test('getRaySegment extends toward the canvas edge', () => {
  const segment = getRaySegment({ x: 40, y: 40 }, { x: 120, y: 120 }, 220, 220);
  assert.ok(Math.abs(segment[0].x - 40) < 0.001);
  assert.ok(Math.abs(segment[0].y - 40) < 0.001);
  assert.ok(segment[1].x > 219 || segment[1].y > 219);
});

test('getParallelChannelGeometry keeps all channel lines parallel', () => {
  const geometry = getParallelChannelGeometry([{ x: 40, y: 180 }, { x: 180, y: 80 }], 260, 220);
  assert.equal(geometry.fill.length, 4);
  assert.ok(Math.abs(slope(geometry.center) - slope(geometry.upper)) < 1e-6);
  assert.ok(Math.abs(slope(geometry.center) - slope(geometry.lower)) < 1e-6);
  assert.notEqual(geometry.upper[0].y, geometry.lower[0].y);
});

test('getPitchforkGeometry uses the expected origin for pitchfork variants', () => {
  const points: [CanvasPoint, CanvasPoint, CanvasPoint] = [
    { x: 40, y: 170 },
    { x: 120, y: 90 },
    { x: 200, y: 140 },
  ];

  const standard = getPitchforkGeometry(points, 'pitchfork', 320, 240);
  const schiff = getPitchforkGeometry(points, 'schiffPitchfork', 320, 240);
  const modified = getPitchforkGeometry(points, 'modifiedSchiffPitchfork', 320, 240);
  const inside = getPitchforkGeometry(points, 'insidePitchfork', 320, 240);

  assert.ok(Math.abs(standard.median[0].x - points[0].x) < 0.001);
  assert.ok(Math.abs(schiff.median[0].x - (points[0].x + points[1].x) / 2) < 0.001);
  assert.ok(Math.abs(standard.median[0].y - points[0].y) < 0.001);
  assert.ok(Math.abs(schiff.median[0].y - (points[0].y + points[1].y) / 2) < 0.001);
  assert.ok(Math.abs(slope(standard.median) - slope(standard.upper)) < 1e-6);
  assert.ok(Math.abs(slope(schiff.median) - slope(schiff.lower)) < 1e-6);
  assert.ok(Math.abs(modified.upper[0].y - modified.median[0].y) < Math.abs(schiff.upper[0].y - schiff.median[0].y));
  assert.ok(Math.abs(inside.upper[0].y - inside.median[0].y) < Math.abs(modified.upper[0].y - modified.median[0].y));
});

test('getRegressionTrendGeometry fits a positive slope with a visible band', () => {
  const points: CanvasPoint[] = Array.from({ length: 18 }, (_, index) => ({
    x: index * 12,
    y: 60 + index * 3 + (index % 2 === 0 ? 5 : -2),
  }));
  const geometry = getRegressionTrendGeometry(points);
  assert.ok(geometry);
  if (!geometry) return;
  assert.ok(geometry.slope > 0);
  assert.ok(geometry.deviation >= 6);
  assert.ok(geometry.upper[0].y < geometry.median[0].y);
  assert.ok(geometry.lower[0].y > geometry.median[0].y);
});

test('snapTrendAngleSegment snaps to a 15 degree increment', () => {
  const [start, end] = snapTrendAngleSegment({ x: 12, y: 12 }, { x: 120, y: 88 });
  const angle = Math.atan2(-(end.y - start.y), end.x - start.x) * (180 / Math.PI);
  const snapped = Math.round(angle / 15) * 15;
  assert.ok(Math.abs(angle - snapped) < 0.001);
});

test('selectNearestDrawingId prefers the visible line body over anchor-only hits', () => {
  const ray = makeDrawing('ray', 'ray', [
    { time: 1_700_000_000 as DrawPoint['time'], price: 100 },
    { time: 1_700_086_400 as DrawPoint['time'], price: 112 },
  ]);
  const distantTrend = makeDrawing('trend', 'trend', [
    { time: 1_700_863_999 as DrawPoint['time'], price: 260 },
    { time: 1_700_950_399 as DrawPoint['time'], price: 275 },
  ]);

  const selected = selectNearestDrawingId([distantTrend, ray], { time: 1_700_043_200 as DrawPoint['time'], price: 106 });
  assert.equal(selected, 'ray');
});

test('selectNearestDrawingId returns null when nothing is close enough', () => {
  const ray = makeDrawing('ray', 'ray', [
    { time: 1_700_000_000 as DrawPoint['time'], price: 100 },
    { time: 1_700_086_400 as DrawPoint['time'], price: 112 },
  ]);

  const selected = selectNearestDrawingId([ray], { time: 1_710_000_000 as DrawPoint['time'], price: 400 });
  assert.equal(selected, null);
});
