import type { Drawing } from '@/services/tools/toolRegistry';

export interface TimeRange {
  from: number;
  to: number;
}

interface DrawingRange {
  id: string;
  minTime: number;
  maxTime: number;
  visible: boolean;
}

function toRange(drawing: Drawing): DrawingRange {
  if (!drawing.anchors.length) {
    return {
      id: drawing.id,
      minTime: Number.NEGATIVE_INFINITY,
      maxTime: Number.POSITIVE_INFINITY,
      visible: drawing.visible && drawing.options.visible,
    };
  }

  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  for (const anchor of drawing.anchors) {
    const t = Number(anchor.time);
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;
  }

  return {
    id: drawing.id,
    minTime,
    maxTime,
    visible: drawing.visible && drawing.options.visible,
  };
}

export class DrawingTimeIndex {
  private byId = new Map<string, DrawingRange>();

  rebuild(drawings: readonly Drawing[]): void {
    this.byId.clear();
    for (const drawing of drawings) {
      this.byId.set(drawing.id, toRange(drawing));
    }
  }

  upsert(drawing: Drawing): void {
    this.byId.set(drawing.id, toRange(drawing));
  }

  remove(id: string): void {
    this.byId.delete(id);
  }

  query(range: TimeRange): string[] {
    const result: string[] = [];
    for (const entry of this.byId.values()) {
      if (!entry.visible) continue;
      if (entry.maxTime < range.from || entry.minTime > range.to) continue;
      result.push(entry.id);
    }
    return result;
  }
}
