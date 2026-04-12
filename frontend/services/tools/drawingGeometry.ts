import type { DrawPoint, ToolVariant } from './toolRegistry.ts';

export type CanvasPoint = { x: number; y: number };

export type PitchforkVariant = Extract<ToolVariant, 'pitchfork' | 'schiffPitchfork' | 'modifiedSchiffPitchfork' | 'insidePitchfork'>;

const EPSILON = 1e-6;

function add(a: CanvasPoint, b: CanvasPoint): CanvasPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: CanvasPoint, b: CanvasPoint): CanvasPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(point: CanvasPoint, factor: number): CanvasPoint {
  return { x: point.x * factor, y: point.y * factor };
}

function length(point: CanvasPoint): number {
  return Math.hypot(point.x, point.y);
}

function normalize(point: CanvasPoint): CanvasPoint {
  const magnitude = length(point);
  if (magnitude < EPSILON) return { x: 0, y: 0 };
  return { x: point.x / magnitude, y: point.y / magnitude };
}

function perpendicular(point: CanvasPoint): CanvasPoint {
  return { x: -point.y, y: point.x };
}

function signedDistanceToLine(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint): number {
  const direction = subtract(end, start);
  const magnitude = length(direction);
  if (magnitude < EPSILON) return 0;
  return ((point.x - start.x) * direction.y - (point.y - start.y) * direction.x) / magnitude;
}

function shiftSegment(start: CanvasPoint, end: CanvasPoint, offset: number): [CanvasPoint, CanvasPoint] {
  const normal = normalize(perpendicular(subtract(end, start)));
  const delta = scale(normal, offset);
  return [add(start, delta), add(end, delta)];
}

function uniquePush(results: Array<{ point: CanvasPoint; t: number }>, candidate: { point: CanvasPoint; t: number }): void {
  if (results.some((existing) => Math.abs(existing.point.x - candidate.point.x) < 0.5 && Math.abs(existing.point.y - candidate.point.y) < 0.5)) {
    return;
  }
  results.push(candidate);
}

export function interpolateCanvasPoint(start: CanvasPoint, end: CanvasPoint, t: number): CanvasPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

export function interpolateDrawPoint(start: DrawPoint, end: DrawPoint, t: number): DrawPoint {
  return {
    time: (start.time + (end.time - start.time) * t) as DrawPoint['time'],
    price: start.price + (end.price - start.price) * t,
  };
}

export function midpoint(a: CanvasPoint, b: CanvasPoint): CanvasPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function distance(a: CanvasPoint, b: CanvasPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function getLineIntersections(start: CanvasPoint, end: CanvasPoint, width: number, height: number): Array<{ point: CanvasPoint; t: number }> {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return [];

  const results: Array<{ point: CanvasPoint; t: number }> = [];
  const push = (t: number) => {
    const point = interpolateCanvasPoint(start, end, t);
    if (point.x < -0.5 || point.x > width + 0.5 || point.y < -0.5 || point.y > height + 0.5) return;
    uniquePush(results, { point, t });
  };

  if (Math.abs(dx) >= EPSILON) {
    push((0 - start.x) / dx);
    push((width - start.x) / dx);
  }

  if (Math.abs(dy) >= EPSILON) {
    push((0 - start.y) / dy);
    push((height - start.y) / dy);
  }

  return results.sort((a, b) => a.t - b.t);
}

export function getExtendedLineSegment(start: CanvasPoint, end: CanvasPoint, width: number, height: number): [CanvasPoint, CanvasPoint] {
  const intersections = getLineIntersections(start, end, width, height);
  if (intersections.length >= 2) {
    return [intersections[0].point, intersections[intersections.length - 1].point];
  }
  return [start, end];
}

export function getRaySegment(start: CanvasPoint, end: CanvasPoint, width: number, height: number): [CanvasPoint, CanvasPoint] {
  const intersections = getLineIntersections(start, end, width, height).filter((entry) => entry.t > EPSILON);
  if (!intersections.length) {
    return [start, end];
  }

  const target = intersections.sort((a, b) => b.t - a.t)[0].point;
  return [start, target];
}

function offsetSegment(start: CanvasPoint, end: CanvasPoint, offset: number, width: number, height: number, mode: 'ray' | 'extended'): [CanvasPoint, CanvasPoint] {
  const [shiftedStart, shiftedEnd] = shiftSegment(start, end, offset);
  return mode === 'ray'
    ? getRaySegment(shiftedStart, shiftedEnd, width, height)
    : getExtendedLineSegment(shiftedStart, shiftedEnd, width, height);
}

export function getParallelChannelGeometry(points: [CanvasPoint, CanvasPoint], width: number, height: number): {
  center: [CanvasPoint, CanvasPoint];
  upper: [CanvasPoint, CanvasPoint];
  lower: [CanvasPoint, CanvasPoint];
  fill: [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint];
} {
  const [start, end] = points;
  const span = Math.max(12, distance(start, end));
  const offset = span * 0.24;
  const center = getExtendedLineSegment(start, end, width, height);
  const upper = offsetSegment(start, end, offset, width, height, 'extended');
  const lower = offsetSegment(start, end, -offset, width, height, 'extended');
  return {
    center,
    upper,
    lower,
    fill: [upper[0], upper[1], lower[1], lower[0]],
  };
}

export function getPitchforkGeometry(points: [CanvasPoint, CanvasPoint, CanvasPoint], variant: PitchforkVariant, width: number, height: number): {
  median: [CanvasPoint, CanvasPoint];
  upper: [CanvasPoint, CanvasPoint];
  lower: [CanvasPoint, CanvasPoint];
  fill: [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint];
} {
  const [first, second, third] = points;
  const span = Math.max(distance(first, second), distance(second, third), distance(first, third));
  const offsetFallback = Math.max(14, span * 0.22);

  const config = variant === 'pitchfork'
    ? { origin: first, target: midpoint(second, third), upperAnchor: second, lowerAnchor: third, offsetScale: 1 }
    : variant === 'schiffPitchfork'
      ? { origin: midpoint(first, second), target: third, upperAnchor: first, lowerAnchor: second, offsetScale: 1 }
      : variant === 'modifiedSchiffPitchfork'
        ? { origin: midpoint(first, second), target: third, upperAnchor: first, lowerAnchor: second, offsetScale: 0.82 }
        : { origin: midpoint(first, second), target: third, upperAnchor: first, lowerAnchor: second, offsetScale: 0.62 };

  const axis = subtract(config.target, config.origin);
  const normal = normalize(perpendicular(axis));
  let upperOffset = signedDistanceToLine(config.upperAnchor, config.origin, config.target) * config.offsetScale;
  let lowerOffset = signedDistanceToLine(config.lowerAnchor, config.origin, config.target) * config.offsetScale;

  if (Math.abs(upperOffset) < EPSILON) upperOffset = offsetFallback;
  if (Math.abs(lowerOffset) < EPSILON) lowerOffset = -offsetFallback;

  const median = getRaySegment(config.origin, config.target, width, height);
  const upper = getRaySegment(add(config.origin, scale(normal, upperOffset)), add(config.target, scale(normal, upperOffset)), width, height);
  const lower = getRaySegment(add(config.origin, scale(normal, lowerOffset)), add(config.target, scale(normal, lowerOffset)), width, height);

  return {
    median,
    upper,
    lower,
    fill: [upper[0], upper[1], lower[1], lower[0]],
  };
}

export function getRegressionTrendGeometry(points: CanvasPoint[]): {
  median: [CanvasPoint, CanvasPoint];
  upper: [CanvasPoint, CanvasPoint];
  lower: [CanvasPoint, CanvasPoint];
  fill: [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint];
  slope: number;
  intercept: number;
  deviation: number;
} | null {
  if (points.length < 2) return null;

  const ordered = [...points].sort((a, b) => a.x - b.x);
  const n = ordered.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;

  for (const point of ordered) {
    sumX += point.x;
    sumY += point.y;
    sumXX += point.x * point.x;
    sumXY += point.x * point.y;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = Math.abs(denominator) < EPSILON ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = sumY / n - slope * (sumX / n);

  let variance = 0;
  for (const point of ordered) {
    const fitted = slope * point.x + intercept;
    const residual = point.y - fitted;
    variance += residual * residual;
  }

  const deviation = Math.max(6, Math.sqrt(variance / n) * 1.25);
  const startX = ordered[0].x;
  const endX = ordered[ordered.length - 1].x;

  const median: [CanvasPoint, CanvasPoint] = [
    { x: startX, y: slope * startX + intercept },
    { x: endX, y: slope * endX + intercept },
  ];
  const upper: [CanvasPoint, CanvasPoint] = median.map((point) => ({ x: point.x, y: point.y - deviation })) as [CanvasPoint, CanvasPoint];
  const lower: [CanvasPoint, CanvasPoint] = median.map((point) => ({ x: point.x, y: point.y + deviation })) as [CanvasPoint, CanvasPoint];

  return {
    median,
    upper,
    lower,
    fill: [upper[0], upper[1], lower[1], lower[0]],
    slope,
    intercept,
    deviation,
  };
}

export function snapTrendAngleSegment(start: CanvasPoint, end: CanvasPoint, angleStepDegrees = 15): [CanvasPoint, CanvasPoint] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const span = Math.hypot(dx, dy);
  if (span < EPSILON) return [start, end];

  const currentAngle = Math.atan2(-(dy), dx);
  const step = (Math.max(1, angleStepDegrees) * Math.PI) / 180;
  const snappedAngle = Math.round(currentAngle / step) * step;
  return [
    start,
    {
      x: start.x + Math.cos(snappedAngle) * span,
      y: start.y - Math.sin(snappedAngle) * span,
    },
  ];
}