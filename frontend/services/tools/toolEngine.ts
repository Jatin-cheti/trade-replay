import type { UTCTimestamp } from '@tradereplay/charts';
import { buildToolOptions, getToolDefinition, type DrawPoint, type Drawing, type ToolVariant } from './toolRegistry';
import type { ToolOptions } from './toolOptions';

export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type TimeLike = UTCTimestamp | string | { year: number; month: number; day: number };

export function toTimestampFromTime(value: TimeLike | null): UTCTimestamp | null {
  if (value == null) return null;
  if (typeof value === 'number') return value as UTCTimestamp;
  if (typeof value === 'string') {
    const parsed = Math.floor(new Date(value).getTime() / 1000);
    return Number.isFinite(parsed) ? (parsed as UTCTimestamp) : null;
  }
  if (typeof value === 'object' && 'year' in value && 'month' in value && 'day' in value) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000) as UTCTimestamp;
  }
  return null;
}

export function nearestCandleIndex(times: UTCTimestamp[], target: UTCTimestamp): number {
  if (!times.length) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] === target) return mid;
    if (times[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  const left = Math.max(0, hi);
  const right = Math.min(times.length - 1, lo);
  return Math.abs(times[left] - target) <= Math.abs(times[right] - target) ? left : right;
}

export function isPointOnlyVariant(variant: ToolVariant): boolean {
  const def = getToolDefinition(variant);
  return Boolean(def && def.capabilities.anchors <= 1);
}

export function createDrawing(variant: Exclude<ToolVariant, 'none'>, options: ToolOptions, p1: DrawPoint, p2?: DrawPoint, text?: string): Drawing {
  const definition = getToolDefinition(variant);
  const anchorCount = definition?.capabilities.anchors ?? 2;
  const anchors: DrawPoint[] = [p1];
  while (anchors.length < anchorCount) {
    anchors.push(p2 || p1);
  }

  return {
    id: makeId(),
    type: definition?.family ?? 'line',
    variant,
    anchors,
    text,
    options: { ...buildToolOptions(variant), ...options },
    selected: false,
    locked: options.locked,
    visible: options.visible,
  };
}

export function updateDraftDrawing(draft: Drawing, point: DrawPoint): Drawing {
  if (draft.variant === 'brush') {
    const last = draft.anchors[draft.anchors.length - 1];
    if (last && Math.abs(last.time - point.time) === 0 && Math.abs(last.price - point.price) < 0.0001) {
      return draft;
    }
    return { ...draft, anchors: [...draft.anchors, point] };
  }

  const anchors = [...draft.anchors];
  anchors[anchors.length - 1] = point;
  return { ...draft, anchors };
}

export function selectNearestDrawingId(drawings: Drawing[], point: DrawPoint): string | null {
  if (!drawings.length) return null;
  const pool = drawings.filter((d) => d.visible !== false).slice().reverse();
  return pool.find((d) => {
    const p = d.anchors[0];
    return Math.abs(p.time - point.time) < 172800 && Math.abs(p.price - point.price) < Math.max(0.5, point.price * 0.03);
  })?.id ?? pool[0]?.id ?? null;
}
