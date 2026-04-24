/**
 * Shared helpers for TV-parity tests across all line tools.
 *
 * Each tool has its own parity test file (trendLineParity.test.ts,
 * rayLineParity.test.ts, etc.) but they all consume these helpers
 * to keep the assertions consistent and concise.
 */

import type { DrawPoint, Viewport, Drawing } from '../../src/drawing/types.ts';
import { DEFAULT_DRAWING_OPTIONS } from '../../src/drawing/types.ts';

export const T0 = 1_700_000_000;
export const T_STEP = 100_000;

export function pt(time: number, price: number): DrawPoint {
  return { time: time as DrawPoint['time'], price };
}

export function vp(overrides: Partial<Viewport> = {}): Viewport {
  return {
    width: 800,
    height: 400,
    priceAxisWidth: 60,
    timeAxisHeight: 28,
    visibleFrom: 1_700_000_000 as DrawPoint['time'],
    visibleTo: 1_700_100_000 as DrawPoint['time'],
    priceMin: 100,
    priceMax: 200,
    pxPerTime: (800 - 60) / 100_000,
    pxPerPrice: (400 - 28) / 100,
    originX: 0,
    originY: 400 - 28,
    ...overrides,
  };
}

/** Tiny mock canvas context that records draw calls without touching DOM. */
export function makeMockCtx(): CanvasRenderingContext2D & {
  calls: string[];
  fillRectCalls: Array<[number, number, number, number]>;
  strokeRectCalls: Array<[number, number, number, number]>;
} {
  const calls: string[] = [];
  const fillRectCalls: Array<[number, number, number, number]> = [];
  const strokeRectCalls: Array<[number, number, number, number]> = [];
  const ctx: Record<string, unknown> = {
    calls,
    fillRectCalls,
    strokeRectCalls,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
    fillRect: (x: number, y: number, w: number, h: number) => {
      fillRectCalls.push([x, y, w, h]);
      calls.push('fillRect');
    },
    strokeRect: (x: number, y: number, w: number, h: number) => {
      strokeRectCalls.push([x, y, w, h]);
      calls.push('strokeRect');
    },
    clearRect: () => calls.push('clearRect'),
    arc: () => calls.push('arc'),
    closePath: () => calls.push('closePath'),
    setLineDash: () => calls.push('setLineDash'),
    fillText: () => calls.push('fillText'),
    strokeText: () => calls.push('strokeText'),
    measureText: () => ({ width: 10 }),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    scale: () => calls.push('scale'),
    rect: () => calls.push('rect'),
    clip: () => calls.push('clip'),
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
  return ctx as CanvasRenderingContext2D & {
    calls: string[];
    fillRectCalls: Array<[number, number, number, number]>;
    strokeRectCalls: Array<[number, number, number, number]>;
  };
}

export function defaultOptions() {
  return { ...DEFAULT_DRAWING_OPTIONS };
}

export function assertDrawingInvariants(d: Drawing, variant: string): void {
  if (d.variant !== variant) throw new Error(`variant ${d.variant} !== ${variant}`);
  if (!Array.isArray(d.anchors)) throw new Error('anchors not array');
  if (typeof d.id !== 'string' || !d.id) throw new Error('id missing');
  if (typeof d.visible !== 'boolean') throw new Error('visible missing');
  if (typeof d.locked !== 'boolean') throw new Error('locked missing');
}

/** Minimal test-runner utilities (shared pattern). */
export function createRunner(suiteName: string) {
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
      failed++;
      process.exitCode = 1;
    }
  }
  function summary(): void {
    console.log(`\n${suiteName}: ${passed} passed, ${failed} failed`);
  }
  return { test, summary, get passed() { return passed; }, get failed() { return failed; } };
}
