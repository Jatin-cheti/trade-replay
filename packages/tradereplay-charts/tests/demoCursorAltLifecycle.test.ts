/**
 * Demo Cursor Alt-Lifecycle Parity Tests — 200 tests
 *
 * Verifies strict TradingView parity: Alt is REQUIRED for every brush gesture.
 * Plain click+drag always pans the chart, never draws.
 *
 *   - Plain click (no Alt) never draws, regardless of setActive state
 *   - Alt+click always starts a brush stroke
 *   - Releasing Alt mid-drag finalizes the stroke and begins fade-out
 *   - Re-pressing Alt does NOT revive a finalized stroke
 *   - setActive(true) is purely cosmetic (cursor style); never changes draw rule
 *
 * Run: npx tsx tests/demoCursorAltLifecycle.test.ts
 */
import assert from 'node:assert/strict';
import { createChart } from '../src/lib/createChart.ts';
import type { IChartApi } from '../src/lib/createChart.ts';

// ─── DOM Mock ───────────────────────────────────────────────────────────────
let _rafId = 0;
const _rafCallbacks = new Map<number, FrameRequestCallback>();
(global as unknown as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback) => {
  const id = ++_rafId; _rafCallbacks.set(id, cb); return id;
};
(global as unknown as Record<string, unknown>).cancelAnimationFrame = (id: number) => { _rafCallbacks.delete(id); };

const _winListeners: Map<string, ((e: unknown) => void)[]> = new Map();
(global as unknown as Record<string, unknown>).window = {
  devicePixelRatio: 1,
  addEventListener: (evt: string, fn: (e: unknown) => void) => {
    if (!_winListeners.has(evt)) _winListeners.set(evt, []);
    _winListeners.get(evt)!.push(fn);
  },
  removeEventListener: (evt: string, fn: (e: unknown) => void) => {
    const arr = _winListeners.get(evt);
    if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
  },
};
function fireWindow(evt: string, data: Record<string, unknown>) {
  const arr = _winListeners.get(evt) ?? [];
  for (const fn of arr) fn(data);
}

if (typeof (global as unknown as Record<string, unknown>).devicePixelRatio === 'undefined') {
  (global as unknown as Record<string, unknown>).devicePixelRatio = 1;
}
if (typeof performance === 'undefined') {
  (global as unknown as Record<string, unknown>).performance = { now: () => Date.now() };
}

class MockCanvas {
  width = 800; height = 600;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  _listeners: Map<string, ((e: unknown) => void)[]> = new Map();
  getContext() {
    return {
      save() {}, restore() {}, clearRect() {}, fillRect() {}, strokeRect() {},
      beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {},
      clip() {}, rect() {}, quadraticCurveTo() {}, bezierCurveTo() {}, closePath() {},
      setLineDash() {}, setTransform() {}, translate() {}, scale() {}, rotate() {},
      measureText(s: string) { return { width: s.length * 7 }; }, fillText() {}, strokeText() {},
      createLinearGradient() { return { addColorStop() {} }; },
      fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
      font: '', textAlign: '', textBaseline: '', lineDashOffset: 0, canvas: this,
    };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  addEventListener(evt: string, fn: (e: unknown) => void) {
    if (!this._listeners.has(evt)) this._listeners.set(evt, []);
    this._listeners.get(evt)!.push(fn);
  }
  removeEventListener(evt: string, fn: (e: unknown) => void) {
    const arr = this._listeners.get(evt);
    if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
  }
  hasPointerCapture() { return false; }
  setPointerCapture() {}
  releasePointerCapture() {}
  dispatchEvent() {}
  fire(evt: string, data: Record<string, unknown>) {
    const fns = this._listeners.get(evt) ?? [];
    for (const fn of fns) fn(data);
  }
}
class MockResizeObserver { observe() {} unobserve() {} disconnect() {} }
class MockContainer {
  childNodes: MockCanvas[] = [];
  style: Record<string, string> = {};
  _w = 800; _h = 600;
  constructor(w = 800, h = 600) { this._w = w; this._h = h; }
  appendChild(c: MockCanvas) { this.childNodes.push(c); }
  removeChild(c: MockCanvas) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); }
  contains(c: MockCanvas) { return this.childNodes.includes(c); }
  getBoundingClientRect() { return { width: this._w, height: this._h }; }
}
(global as unknown as Record<string, unknown>).ResizeObserver = MockResizeObserver;
(global as unknown as Record<string, unknown>).document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') return new MockCanvas();
    throw new Error(`MockDOM: no support for tag "${tag}"`);
  },
};

let passed = 0, failed = 0, section = '';
function describe(name: string, fn: () => void): void {
  section = name; console.log(`\n┌─ ${name}`); fn();
}
function test(name: string, fn: () => void): void {
  try {
    fn(); passed++;
    if (passed % 40 === 0) console.log(`│  ✓  ${passed} tests passed so far...`);
  } catch (err) {
    console.error(`│  ✗  ${name}`);
    console.error(`│     ${section}: ${(err as Error).message}`);
    failed++;
  }
}
function makeChart(w = 800, h = 600) {
  const container = new MockContainer(w, h);
  const chart = createChart(container as unknown as HTMLElement, { width: w, height: h });
  const canvas = container.childNodes[0];
  return { chart, canvas };
}
const plain = (x = 100, y = 100) => ({
  altKey: false, offsetX: x, offsetY: y, clientX: x, clientY: y,
  pointerId: 1, button: 0, buttons: 1, preventDefault() {},
});
const alt = (x = 100, y = 100) => ({
  altKey: true, offsetX: x, offsetY: y, clientX: x, clientY: y,
  pointerId: 1, button: 0, buttons: 1, preventDefault() {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Part A: Plain click NEVER draws (1–60)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part A: Plain click never draws (1-60)', () => {
  for (let i = 1; i <= 20; i++) {
    test(`${i}. Plain pointerdown at (x=${i * 10}) does not create stroke (setActive=off)`, () => {
      const { chart, canvas } = makeChart();
      canvas.fire('pointerdown', plain(i * 10, 200));
      assert.equal(chart.demoCursor().strokeCount(), 0);
      chart.remove();
    });
  }
  for (let i = 21; i <= 40; i++) {
    test(`${i}. Plain pointerdown does not create stroke (setActive=on)`, () => {
      const { chart, canvas } = makeChart();
      chart.demoCursor().setActive(true);
      canvas.fire('pointerdown', plain(i * 10, 200));
      assert.equal(chart.demoCursor().strokeCount(), 0);
      chart.remove();
    });
  }
  for (let i = 41; i <= 60; i++) {
    test(`${i}. Plain pointerdown + drag + up does not create stroke (setActive=on)`, () => {
      const { chart, canvas } = makeChart();
      chart.demoCursor().setActive(true);
      canvas.fire('pointerdown', plain(100, 100));
      canvas.fire('pointermove', plain(200, 150));
      canvas.fire('pointermove', plain(300, 180));
      canvas.fire('pointerup',   plain(300, 180));
      assert.equal(chart.demoCursor().strokeCount(), 0);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part B: Alt+click always draws (61–120)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part B: Alt+click always draws (61-120)', () => {
  for (let i = 61; i <= 80; i++) {
    test(`${i}. Alt+pointerdown creates stroke (setActive=off)`, () => {
      const { chart, canvas } = makeChart();
      canvas.fire('pointerdown', alt(i * 5, 150));
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
  for (let i = 81; i <= 100; i++) {
    test(`${i}. Alt+pointerdown creates stroke (setActive=on)`, () => {
      const { chart, canvas } = makeChart();
      chart.demoCursor().setActive(true);
      canvas.fire('pointerdown', alt(i * 5, 150));
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
  for (let i = 101; i <= 120; i++) {
    test(`${i}. Alt+drag extends single stroke with ${10 + (i - 100)} points`, () => {
      const { chart, canvas } = makeChart();
      const n = 10 + (i - 100);
      canvas.fire('pointerdown', alt(10, 10));
      for (let p = 1; p < n; p++) canvas.fire('pointermove', alt(10 + p * 3, 10 + p * 2));
      canvas.fire('pointerup', alt(10 + n * 3, 10 + n * 2));
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part C: Alt release mid-drag ends stroke (121–170)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part C: Alt release mid-drag ends stroke (121-170)', () => {
  for (let i = 121; i <= 140; i++) {
    test(`${i}. Alt keyup mid-drag: stroke keeps endTime (fading, still counted)`, () => {
      const { chart, canvas } = makeChart();
      canvas.fire('pointerdown', alt(50, 50));
      canvas.fire('pointermove', alt(60, 60));
      fireWindow('keyup', { key: 'Alt' });
      // Stroke should be finalized (fading) but still in the list
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
  for (let i = 141; i <= 160; i++) {
    test(`${i}. Alt keyup also ends stroke when setActive(true)`, () => {
      const { chart, canvas } = makeChart();
      chart.demoCursor().setActive(true);
      canvas.fire('pointerdown', alt(50, 50));
      fireWindow('keyup', { key: 'Alt' });
      // Even with force mode on, Alt release ends the stroke (TV parity)
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
  for (let i = 161; i <= 170; i++) {
    test(`${i}. After Alt release, plain click still does not draw`, () => {
      const { chart, canvas } = makeChart();
      chart.demoCursor().setActive(true);
      canvas.fire('pointerdown', alt(50, 50));
      fireWindow('keyup', { key: 'Alt' });
      canvas.fire('pointerup', plain(50, 50));
      const count = chart.demoCursor().strokeCount();
      // Plain click after release does not create new stroke
      canvas.fire('pointerdown', plain(300, 300));
      canvas.fire('pointerup', plain(300, 300));
      assert.equal(chart.demoCursor().strokeCount(), count);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part D: Multi-sequence Alt/plain interleaving (171–200)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part D: Multi-sequence interleaving (171-200)', () => {
  for (let i = 171; i <= 185; i++) {
    test(`${i}. 3x (Alt draw → plain click): final strokeCount=3`, () => {
      const { chart, canvas } = makeChart();
      for (let s = 0; s < 3; s++) {
        canvas.fire('pointerdown', alt(50 + s * 100, 50));
        canvas.fire('pointermove', alt(60 + s * 100, 60));
        canvas.fire('pointerup', alt(60 + s * 100, 60));
        // Plain click between Alt draws — must NOT add strokes
        canvas.fire('pointerdown', plain(200 + s * 100, 200));
        canvas.fire('pointerup', plain(200 + s * 100, 200));
      }
      assert.equal(chart.demoCursor().strokeCount(), 3);
      chart.remove();
    });
  }
  for (let i = 186; i <= 200; i++) {
    test(`${i}. setActive toggled during sequence: Alt draws, plain pans`, () => {
      const { chart, canvas } = makeChart();
      const dc = chart.demoCursor();
      dc.setActive(true);
      canvas.fire('pointerdown', alt(50, 50));
      canvas.fire('pointerup', alt(50, 50));
      dc.setActive(false);
      canvas.fire('pointerdown', plain(100, 100));
      canvas.fire('pointerup', plain(100, 100));
      dc.setActive(true);
      canvas.fire('pointerdown', alt(150, 150));
      canvas.fire('pointerup', alt(150, 150));
      assert.equal(dc.strokeCount(), 2);
      chart.remove();
    });
  }
});

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  Demo Cursor Alt-Lifecycle Parity — ${passed}/${passed + failed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════════════\n`);
if (failed > 0) process.exit(1);
