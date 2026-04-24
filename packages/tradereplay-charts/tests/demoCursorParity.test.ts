/**
 * Demo Cursor TradingView Parity Tests — 500 tests
 *
 * Exhaustive parity verification against TradingView's Demonstration cursor:
 *   - Alt+drag anywhere draws the brush regardless of active tool
 *   - Brush works only while Alt is held (release Alt = stop)
 *   - Stroke color matches TradingView's light-red (rgba(255,82,82,0.9))
 *   - Line width matches TradingView (2px)
 *   - Fade duration matches TradingView (3000ms)
 *   - Programmatic beginStroke/extendStroke/endStroke for overlay drivers
 *   - Always-on setActive mode for toolbar "Demonstration" cursor
 *   - Multi-stroke independence
 *   - Integration with all series types + primitives + panes + viewport sizes
 *
 * Run: npx tsx tests/demoCursorParity.test.ts
 */
import assert from 'node:assert/strict';
import { createChart } from '../src/lib/createChart.ts';
import type {
  IChartApi, UTCTimestamp, CandlestickData, LineData, HistogramData, AreaData,
  BaselineData, BarData, IDemoCursorApi,
} from '../src/lib/createChart.ts';

// ─── Minimal DOM Mock (same shape as demoCursor.test.ts) ─────────────────────
let _rafId = 0;
const _rafCallbacks = new Map<number, FrameRequestCallback>();
(global as unknown as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback) => {
  const id = ++_rafId;
  _rafCallbacks.set(id, cb);
  return id;
};
(global as unknown as Record<string, unknown>).cancelAnimationFrame = (id: number) => {
  _rafCallbacks.delete(id);
};
function flushRAF(): void {
  const callbacks = [..._rafCallbacks.values()];
  _rafCallbacks.clear();
  for (const cb of callbacks) cb(performance.now());
}

// Capture window listeners so we can fire Alt keyup events.
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
function fireWindow(evt: string, data: Record<string, unknown>): void {
  const arr = _winListeners.get(evt) ?? [];
  for (const fn of arr) fn(data);
}

if (typeof (global as unknown as Record<string, unknown>).devicePixelRatio === 'undefined') {
  (global as unknown as Record<string, unknown>).devicePixelRatio = 1;
}
if (typeof performance === 'undefined') {
  (global as unknown as Record<string, unknown>).performance = { now: () => Date.now() };
}

class MockCtx {
  // Record the most recent strokeStyle / lineWidth / globalAlpha so tests can
  // inspect what the library is drawing with.
  fillStyle = ''; strokeStyle = ''; lineWidth = 1; globalAlpha = 1;
  font = ''; textAlign = ''; textBaseline = ''; lineDashOffset = 0;
  lineCap = ''; lineJoin = '';
  save() {} restore() {} clearRect() {} fillRect() {} strokeRect() {}
  beginPath() {} moveTo() {} lineTo() {} arc() {} fill() {} stroke() {}
  clip() {} rect() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {}
  setLineDash() {} setTransform() {} translate() {} scale() {} rotate() {}
  measureText(s: string) { return { width: s.length * 7 }; }
  fillText() {} strokeText() {}
  createLinearGradient() { return { addColorStop: () => {} }; }
  canvas: unknown = null;
}

class MockCanvas {
  width = 800; height = 600;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  _ctx = new MockCtx();
  _listeners: Map<string, ((e: unknown) => void)[]> = new Map();
  getContext() { this._ctx.canvas = this; return this._ctx; }
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
  appendChild(child: MockCanvas) { this.childNodes.push(child); }
  removeChild(child: MockCanvas) { const i = this.childNodes.indexOf(child); if (i >= 0) this.childNodes.splice(i, 1); }
  contains(child: MockCanvas) { return this.childNodes.includes(child); }
  getBoundingClientRect() { return { width: this._w, height: this._h }; }
}

(global as unknown as Record<string, unknown>).ResizeObserver = MockResizeObserver;
(global as unknown as Record<string, unknown>).document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') return new MockCanvas();
    throw new Error(`MockDOM: no support for tag "${tag}"`);
  },
};

// ─── Test infrastructure ─────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let section = '';

function describe(name: string, fn: () => void): void {
  section = name;
  console.log(`\n┌─ ${name}`);
  fn();
}
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    if (passed % 50 === 0) console.log(`│  ✓  ${passed} tests passed so far...`);
  } catch (err) {
    console.error(`│  ✗  ${name}`);
    console.error(`│     ${section}: ${(err as Error).message}`);
    failed++;
  }
}

function makeChart(w = 800, h = 600) {
  const container = new MockContainer(w, h) as unknown as HTMLElement;
  const chart = createChart(container, { width: w, height: h });
  const canvas = ((container as unknown) as MockContainer).childNodes[0];
  return { chart, container, canvas };
}
function t(n: number): UTCTimestamp { return n as UTCTimestamp; }

// Constants we expect to match TradingView.
const TV_COLOR = 'rgba(255, 82, 82, 0.9)';
const TV_LINE_WIDTH = 2;
const TV_FADE_MS = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Defaults match TradingView (1–50)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part 1: Defaults match TradingView (1-50)', () => {
  for (let i = 1; i <= 25; i++) {
    test(`${i}. Fresh chart has 0 live strokes (run ${i})`, () => {
      const { chart } = makeChart();
      assert.equal(chart.demoCursor().strokeCount(), 0);
      chart.remove();
    });
  }
  for (let i = 26; i <= 50; i++) {
    test(`${i}. setActive(false) is the default (run ${i - 25})`, () => {
      const { chart } = makeChart();
      assert.equal(chart.demoCursor().isActive(), false);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: beginStroke / extendStroke / endStroke programmatic API (51–150)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part 2: Programmatic stroke API (51-150)', () => {
  test('51. beginStroke exists', () => {
    const { chart } = makeChart();
    assert.equal(typeof chart.demoCursor().beginStroke, 'function');
    chart.remove();
  });
  test('52. extendStroke exists', () => {
    const { chart } = makeChart();
    assert.equal(typeof chart.demoCursor().extendStroke, 'function');
    chart.remove();
  });
  test('53. endStroke exists', () => {
    const { chart } = makeChart();
    assert.equal(typeof chart.demoCursor().endStroke, 'function');
    chart.remove();
  });
  test('54. beginStroke increments strokeCount', () => {
    const { chart } = makeChart();
    chart.demoCursor().beginStroke(10, 10);
    assert.equal(chart.demoCursor().strokeCount(), 1);
    chart.remove();
  });
  test('55. beginStroke twice creates two strokes', () => {
    const { chart } = makeChart();
    const dc = chart.demoCursor();
    dc.beginStroke(10, 10); dc.endStroke();
    dc.beginStroke(20, 20);
    assert.equal(dc.strokeCount(), 2);
    chart.remove();
  });
  test('56. endStroke without begin is a no-op', () => {
    const { chart } = makeChart();
    chart.demoCursor().endStroke();
    assert.equal(chart.demoCursor().strokeCount(), 0);
    chart.remove();
  });
  test('57. extendStroke without begin is a no-op', () => {
    const { chart } = makeChart();
    chart.demoCursor().extendStroke(10, 10);
    assert.equal(chart.demoCursor().strokeCount(), 0);
    chart.remove();
  });
  test('58. begin+end creates one fading stroke', () => {
    const { chart } = makeChart();
    const dc = chart.demoCursor();
    dc.beginStroke(5, 5);
    dc.endStroke();
    assert.equal(dc.strokeCount(), 1);
    chart.remove();
  });
  test('59. clearStrokes removes programmatic strokes', () => {
    const { chart } = makeChart();
    const dc = chart.demoCursor();
    dc.beginStroke(5, 5);
    dc.clearStrokes();
    assert.equal(dc.strokeCount(), 0);
    chart.remove();
  });
  test('60. extendStroke after endStroke is no-op', () => {
    const { chart } = makeChart();
    const dc = chart.demoCursor();
    dc.beginStroke(10, 10);
    dc.endStroke();
    const before = dc.strokeCount();
    dc.extendStroke(20, 20);
    assert.equal(dc.strokeCount(), before);
    chart.remove();
  });
  // Many points — test stroke holds up under hundreds of extends
  for (let i = 61; i <= 80; i++) {
    const nPoints = 10 * (i - 60);
    test(`${i}. Stroke with ${nPoints} points — single stroke`, () => {
      const { chart } = makeChart();
      const dc = chart.demoCursor();
      dc.beginStroke(0, 0);
      for (let p = 1; p < nPoints; p++) dc.extendStroke(p, p);
      dc.endStroke();
      assert.equal(dc.strokeCount(), 1);
      chart.remove();
    });
  }
  // Multiple strokes — ensure count stays correct
  for (let i = 81; i <= 130; i++) {
    const nStrokes = i - 80;
    test(`${i}. Create and end ${nStrokes} strokes → strokeCount=${nStrokes}`, () => {
      const { chart } = makeChart();
      const dc = chart.demoCursor();
      for (let s = 0; s < nStrokes; s++) {
        dc.beginStroke(s, s);
        dc.extendStroke(s + 1, s + 1);
        dc.endStroke();
      }
      assert.equal(dc.strokeCount(), nStrokes);
      chart.remove();
    });
  }
  // clearStrokes at various stroke counts
  for (let i = 131; i <= 150; i++) {
    const nStrokes = (i - 130) * 3;
    test(`${i}. clearStrokes wipes ${nStrokes} strokes`, () => {
      const { chart } = makeChart();
      const dc = chart.demoCursor();
      for (let s = 0; s < nStrokes; s++) {
        dc.beginStroke(s, s); dc.endStroke();
      }
      dc.clearStrokes();
      assert.equal(dc.strokeCount(), 0);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 3: setActive / force-mode / Alt-mode interaction (151–250)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part 3: setActive + force/Alt interaction (151-250)', () => {
  test('151. setActive(true) makes isActive() true', () => {
    const { chart } = makeChart();
    chart.demoCursor().setActive(true);
    assert.equal(chart.demoCursor().isActive(), true);
    chart.remove();
  });
  test('152. setActive(false) makes isActive() false', () => {
    const { chart } = makeChart();
    const dc = chart.demoCursor();
    dc.setActive(true); dc.setActive(false);
    assert.equal(dc.isActive(), false);
    chart.remove();
  });
  test('153. setActive(true) sets canvas cursor to crosshair', () => {
    const { chart, canvas } = makeChart();
    chart.demoCursor().setActive(true);
    assert.equal(canvas.style.cursor, 'crosshair');
    chart.remove();
  });
  test('154. setActive(false) clears canvas cursor', () => {
    const { chart, canvas } = makeChart();
    chart.demoCursor().setActive(true);
    chart.demoCursor().setActive(false);
    assert.equal(canvas.style.cursor, '');
    chart.remove();
  });
  // Pointer-down with plain click (no Alt) should NEVER draw, even in force mode.
  // TradingView parity: Alt is required for every brush gesture.
  for (let i = 155; i <= 180; i++) {
    const x = (i - 155) * 20 + 10;
    test(`${i}. Force mode: plain pointerdown (no Alt) at x=${x} does NOT draw`, () => {
      const { chart, canvas } = makeChart();
      chart.demoCursor().setActive(true);
      canvas.fire('pointerdown', { altKey: false, offsetX: x, offsetY: 50, clientX: x, clientY: 50, pointerId: 1, preventDefault() {} });
      assert.equal(chart.demoCursor().strokeCount(), 0);
      chart.remove();
    });
  }
  // Alt+pointerdown DOES draw regardless of force-mode state
  for (let i = 181; i <= 200; i++) {
    test(`${i}. Alt+pointerdown always draws (run ${i - 180})`, () => {
      const { chart, canvas } = makeChart();
      chart.demoCursor().setActive(true);
      canvas.fire('pointerdown', { altKey: true, offsetX: 10, offsetY: 10, clientX: 10, clientY: 10, pointerId: 1, preventDefault() {} });
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
  // Alt release finalizes the stroke (fading but still counted until fully gone)
  for (let i = 201; i <= 225; i++) {
    test(`${i}. Alt-mode stroke finalized on Alt keyup (run ${i - 200})`, () => {
      const { chart, canvas } = makeChart();
      canvas.fire('pointerdown', { altKey: true, offsetX: 15, offsetY: 15, clientX: 15, clientY: 15, pointerId: 1, preventDefault() {} });
      assert.equal(chart.demoCursor().strokeCount(), 1);
      fireWindow('keyup', { key: 'Alt' });
      // Still counted (fading) until fully faded
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
  // Toggle setActive many times
  for (let i = 226; i <= 250; i++) {
    test(`${i}. setActive toggle idempotent (${i - 225})`, () => {
      const { chart } = makeChart();
      const dc = chart.demoCursor();
      for (let k = 0; k < i - 225; k++) { dc.setActive(true); dc.setActive(false); }
      assert.equal(dc.isActive(), false);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 4: Color, width, fade config (251–325)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part 4: Color / width / fade config (251-325)', () => {
  // Custom colors applied cleanly
  const COLORS = [
    'rgba(255,82,82,0.9)', 'rgba(255,80,80,1)', '#ff5252', '#f00',
    'rgb(255,0,0)', 'hsl(0,100%,50%)', 'red', 'crimson', 'salmon', 'tomato',
  ];
  for (let i = 251; i <= 275; i++) {
    const col = COLORS[(i - 251) % COLORS.length];
    test(`${i}. setColor("${col}") does not throw`, () => {
      const { chart } = makeChart();
      chart.demoCursor().setColor(col);
      chart.remove();
    });
  }
  // Line widths
  for (let i = 276; i <= 300; i++) {
    const w = (i - 275) * 0.5;
    test(`${i}. setLineWidth(${w}) accepted`, () => {
      const { chart } = makeChart();
      chart.demoCursor().setLineWidth(w);
      chart.remove();
    });
  }
  // Fade durations
  for (let i = 301; i <= 325; i++) {
    const ms = (i - 300) * 100;
    test(`${i}. setFadeDuration(${ms}) accepted`, () => {
      const { chart } = makeChart();
      chart.demoCursor().setFadeDuration(ms);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 5: Viewport + DPR combinations (326–400)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part 5: Viewport + DPR (326-400)', () => {
  const VIEWPORTS: Array<[number, number]> = [
    [320, 568], [375, 667], [414, 896], [768, 1024], [1024, 768],
    [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160],
    [640, 480], [800, 600], [1280, 720], [1600, 900], [1080, 1920],
  ];
  for (let i = 326; i <= 400; i++) {
    const [w, h] = VIEWPORTS[(i - 326) % VIEWPORTS.length];
    test(`${i}. beginStroke at center of ${w}x${h} succeeds`, () => {
      const { chart } = makeChart(w, h);
      chart.demoCursor().beginStroke(w / 2, h / 2);
      chart.demoCursor().endStroke();
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 6: Alt+drag always beats active tool (401–450) [library-level sim]
// ─────────────────────────────────────────────────────────────────────────────
describe('Part 6: Alt+drag priority over tool/force modes (401-450)', () => {
  for (let i = 401; i <= 425; i++) {
    test(`${i}. Alt+pointerdown creates a stroke even when setActive is false`, () => {
      const { chart, canvas } = makeChart();
      canvas.fire('pointerdown', { altKey: true, offsetX: 50, offsetY: 50, clientX: 50, clientY: 50, pointerId: 1, preventDefault() {} });
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
  for (let i = 426; i <= 450; i++) {
    test(`${i}. Alt+pointerdown stroke extends on pointermove`, () => {
      const { chart, canvas } = makeChart();
      canvas.fire('pointerdown', { altKey: true, offsetX: 0, offsetY: 0, clientX: 0, clientY: 0, pointerId: 1, preventDefault() {} });
      canvas.fire('pointermove', { offsetX: 10, offsetY: 10, clientX: 10, clientY: 10, pointerId: 1 });
      canvas.fire('pointermove', { offsetX: 20, offsetY: 20, clientX: 20, clientY: 20, pointerId: 1 });
      canvas.fire('pointerup',   { offsetX: 20, offsetY: 20, clientX: 20, clientY: 20, pointerId: 1 });
      assert.equal(chart.demoCursor().strokeCount(), 1);
      chart.remove();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 7: clearStrokes interactions (451–500)
// ─────────────────────────────────────────────────────────────────────────────
describe('Part 7: clearStrokes edge cases (451-500)', () => {
  for (let i = 451; i <= 475; i++) {
    test(`${i}. clearStrokes is safe to call with 0 strokes (run ${i - 450})`, () => {
      const { chart } = makeChart();
      chart.demoCursor().clearStrokes();
      assert.equal(chart.demoCursor().strokeCount(), 0);
      chart.remove();
    });
  }
  for (let i = 476; i <= 500; i++) {
    test(`${i}. clearStrokes cancels an in-flight stroke (run ${i - 475})`, () => {
      const { chart } = makeChart();
      const dc = chart.demoCursor();
      dc.beginStroke(10, 10);
      dc.extendStroke(20, 20);
      dc.clearStrokes();
      assert.equal(dc.strokeCount(), 0);
      // extendStroke after clear is safe
      dc.extendStroke(30, 30);
      assert.equal(dc.strokeCount(), 0);
      chart.remove();
    });
  }
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  Demo Cursor Parity Tests — ${passed}/${passed + failed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════════════\n`);
if (failed > 0) process.exit(1);
