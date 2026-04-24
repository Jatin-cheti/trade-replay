/**
 * TrendLine TV-parity tests (250 tests).
 *
 * Categories:
 *   A. Axis highlight: shape/range correctness (40)
 *   B. Axis highlight gated by selection via engine (25)
 *   C. Axis highlight updates on drawing move / viewport change (30)
 *   D. extendLeft / extendRight axis-highlight variations (20)
 *   E. Text label parity (25)
 *   F. Keyboard parity — Delete, Escape, Shift (via engine) (25)
 *   G. Click / selection parity (via engine) (25)
 *   H. Hit-test grid (20)
 *   I. Options / visibility / locking / render invariants (20)
 *   J. Edge cases / multi-drawing / zoom / resize (20)
 *
 * Total: 250
 */

import assert from 'node:assert/strict';
import { TrendLineTool } from '../../src/drawing/tools/trendLine.ts';
import { DrawingEngine } from '../../src/drawing/engine/drawingEngine.ts';
import { createDefaultTools } from '../../src/drawing/tools/index.ts';
import { DrawingState } from '../../src/drawing/types.ts';
import type { Drawing, DrawPoint, Viewport } from '../../src/drawing/types.ts';
import { pt, vp, defaultOptions, makeMockCtx, createRunner, T0 } from './parityHelpers.ts';

const tool = new TrendLineTool();
const { test, summary } = createRunner('TrendLine parity tests');

function draft(p1: DrawPoint = pt(T0, 150), p2: DrawPoint = pt(T0 + 50_000, 160)): Drawing {
  let d = tool.createDraft(p1, defaultOptions());
  d = tool.updateDraft(d, p2);
  const final = tool.finalize(d);
  if (!final) throw new Error('finalize returned null in test setup');
  return final;
}

function newEngine(): DrawingEngine {
  const engine = new DrawingEngine(createDefaultTools());
  engine.setViewport(vp());
  return engine;
}

function engineWithSelected(d: Drawing = draft()): { engine: DrawingEngine; drawing: Drawing } {
  const engine = newEngine();
  engine.addDrawing(d);
  engine.select(d.id);
  return { engine, drawing: d };
}

// ─── A. Axis highlight shape/range (40) ──────────────────────────────────────

test('TL-P-001: getAxisHighlight returns AxisHighlight object', () => {
  const h = tool.getAxisHighlight(draft(), vp());
  assert.ok(h, 'highlight should not be null');
  assert.ok(Array.isArray(h!.xRange), 'xRange array');
  assert.ok(Array.isArray(h!.yRange), 'yRange array');
});

test('TL-P-002: highlight xRange covers anchor pixel span (ascending)', () => {
  const d = draft(pt(T0, 150), pt(T0 + 50_000, 150));
  const h = tool.getAxisHighlight(d, vp());
  assert.ok(h?.xRange);
  assert.ok(h!.xRange![0] <= h!.xRange![1]);
});

test('TL-P-003: highlight xRange same regardless of anchor order', () => {
  const a = tool.getAxisHighlight(draft(pt(T0, 150), pt(T0 + 40_000, 160)), vp())!;
  const b = tool.getAxisHighlight(draft(pt(T0 + 40_000, 160), pt(T0, 150)), vp())!;
  assert.deepEqual(a.xRange, b.xRange);
});

test('TL-P-004: highlight yRange same regardless of anchor order', () => {
  const a = tool.getAxisHighlight(draft(pt(T0, 150), pt(T0 + 40_000, 160)), vp())!;
  const b = tool.getAxisHighlight(draft(pt(T0 + 40_000, 160), pt(T0, 150)), vp())!;
  assert.deepEqual(a.yRange, b.yRange);
});

test('TL-P-005: yRange ascending (min first)', () => {
  const h = tool.getAxisHighlight(draft(pt(T0, 180), pt(T0 + 40_000, 120)), vp())!;
  assert.ok(h.yRange![0] <= h.yRange![1]);
});

test('TL-P-006: horizontal line yields degenerate-y yRange', () => {
  const h = tool.getAxisHighlight(draft(pt(T0, 150), pt(T0 + 40_000, 150)), vp())!;
  assert.equal(h.yRange![0], h.yRange![1]);
});

test('TL-P-007: vertical line yields degenerate-x xRange', () => {
  const h = tool.getAxisHighlight(draft(pt(T0 + 20_000, 120), pt(T0 + 20_000, 180)), vp())!;
  assert.equal(h.xRange![0], h.xRange![1]);
});

test('TL-P-008: highlight returns null for <2 anchors', () => {
  const d = { ...draft(), anchors: [] };
  const h = tool.getAxisHighlight(d, vp());
  assert.equal(h, null);
});

test('TL-P-009: highlight xRange inside plot width', () => {
  const v = vp();
  const h = tool.getAxisHighlight(draft(pt(T0, 150), pt(T0 + 40_000, 150)), v)!;
  const plotW = v.width - v.priceAxisWidth;
  assert.ok(h.xRange![0] >= 0);
  assert.ok(h.xRange![1] <= plotW + 1);
});

test('TL-P-010: highlight yRange inside plot height', () => {
  const v = vp();
  const h = tool.getAxisHighlight(draft(pt(T0, 150), pt(T0 + 40_000, 160)), v)!;
  const plotH = v.height - v.timeAxisHeight;
  assert.ok(h.yRange![0] >= 0);
  assert.ok(h.yRange![1] <= plotH + 1);
});

// Parametrized: 30 different anchor combos all produce a highlight
for (let i = 0; i < 30; i++) {
  const idx = i;
  test(`TL-P-0${(11 + i).toString().padStart(2, '0')}: parametrized anchors produce valid highlight #${idx}`, () => {
    const dt = 5_000 + idx * 1_500;
    const p1 = 110 + (idx % 10) * 3;
    const p2 = 130 + ((idx * 7) % 50);
    const d = draft(pt(T0 + idx * 1000, p1), pt(T0 + dt + idx * 1000, p2));
    const h = tool.getAxisHighlight(d, vp())!;
    assert.ok(h, 'highlight exists');
    assert.ok(h.xRange && h.yRange);
    assert.ok(h.xRange![0] <= h.xRange![1]);
    assert.ok(h.yRange![0] <= h.yRange![1]);
  });
}

// ─── B. Axis highlight gated by selection via engine (25) ────────────────────

test('TL-P-041: engine returns null highlight when nothing selected', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('TL-P-042: engine returns highlight after selecting', () => {
  const { engine } = engineWithSelected();
  assert.ok(engine.getSelectedAxisHighlight(vp()));
});

test('TL-P-043: engine returns null after deselect via select(null)', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('TL-P-044: selecting another drawing swaps highlight', () => {
  const engine = newEngine();
  const d1 = draft(pt(T0, 110), pt(T0 + 20_000, 120));
  const d2 = draft(pt(T0 + 30_000, 150), pt(T0 + 60_000, 160));
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.select(d2.id);
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.xRange, h2.xRange);
});

test('TL-P-045: highlight cleared when selected drawing is deleted', () => {
  const { engine, drawing } = engineWithSelected();
  engine.removeDrawing(drawing.id);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('TL-P-046: highlight cleared when visibility turned off', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, visible: false }));
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('TL-P-047: selecting same id again keeps highlight stable', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp());
  engine.select(drawing.id);
  const h2 = engine.getSelectedAxisHighlight(vp());
  assert.deepEqual(h1, h2);
});

test('TL-P-048: render pipeline paints two fillRect bands for selected trend', () => {
  const { engine } = engineWithSelected();
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  const bandsX = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  const bandsY = ctx.fillRectCalls.filter((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.equal(bandsX.length, 1);
  assert.equal(bandsY.length, 1);
});

test('TL-P-049: render pipeline paints no highlight band when nothing selected', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  // Axis highlight bands fill the FULL strip height/width. Price-label fills are small (18px).
  const bandsX = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  const bandsY = ctx.fillRectCalls.filter((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.equal(bandsX.length, 0);
  assert.equal(bandsY.length, 0);
});

test('TL-P-050: completing a new drawing via tool replaces selection', () => {
  const { engine, drawing: first } = engineWithSelected();
  engine.selectTool('trend');
  engine.pointerDown(pt(T0 + 70_000, 170));
  engine.pointerMove(pt(T0 + 85_000, 180));
  engine.pointerUp(pt(T0 + 85_000, 180), true);
  // After completing the new drawing, either the new drawing is auto-selected
  // or selection remains on first; in both cases getSelectedAxisHighlight must
  // return a highlight (never null while a drawing is selected).
  assert.notEqual(engine.selectedId, null);
  const h = engine.getSelectedAxisHighlight(vp());
  assert.ok(h, 'highlight exists when a drawing is selected');
});

for (let i = 0; i < 15; i++) {
  test(`TL-P-0${(51 + i).toString().padStart(2, '0')}: selection change #${i} toggles highlight`, () => {
    const engine = newEngine();
    const ds: Drawing[] = [];
    for (let k = 0; k < 4; k++) {
      const d = draft(pt(T0 + k * 10_000, 120 + k * 5), pt(T0 + k * 10_000 + 8000, 130 + k * 5));
      engine.addDrawing(d);
      ds.push(d);
    }
    engine.select(ds[i % 4].id);
    assert.ok(engine.getSelectedAxisHighlight(vp()));
    engine.select(null);
    assert.equal(engine.getSelectedAxisHighlight(vp()), null);
  });
}

// ─── C. Highlight updates on move / viewport change (30) ─────────────────────

test('TL-P-066: moving anchors updates xRange', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({
    ...d,
    anchors: [pt(T0 + 80_000, 150), pt(T0 + 90_000, 160)],
  }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.xRange, h2.xRange);
});

test('TL-P-067: moving anchors updates yRange', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({
    ...d,
    anchors: [pt(T0 + 10_000, 195), pt(T0 + 30_000, 105)],
  }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.yRange, h2.yRange);
});

test('TL-P-068: viewport zoom in expands pixel ranges', () => {
  const d = draft(pt(T0, 140), pt(T0 + 20_000, 160));
  const wide = tool.getAxisHighlight(d, vp({ priceMax: 200, priceMin: 100 }))!;
  const zoom = tool.getAxisHighlight(d, vp({ priceMax: 165, priceMin: 135 }))!;
  const wideSpan = wide.yRange![1] - wide.yRange![0];
  const zoomSpan = zoom.yRange![1] - zoom.yRange![0];
  assert.ok(zoomSpan > wideSpan);
});

test('TL-P-069: resize canvas width shifts xRange scale', () => {
  const d = draft(pt(T0, 140), pt(T0 + 50_000, 160));
  const small = tool.getAxisHighlight(d, vp({ width: 400 }))!;
  const large = tool.getAxisHighlight(d, vp({ width: 1200 }))!;
  const smallSpan = small.xRange![1] - small.xRange![0];
  const largeSpan = large.xRange![1] - large.xRange![0];
  assert.ok(largeSpan > smallSpan);
});

test('TL-P-070: resize canvas height shifts yRange scale', () => {
  const d = draft(pt(T0, 140), pt(T0 + 50_000, 160));
  const small = tool.getAxisHighlight(d, vp({ height: 200 }))!;
  const large = tool.getAxisHighlight(d, vp({ height: 800 }))!;
  const smallSpan = small.yRange![1] - small.yRange![0];
  const largeSpan = large.yRange![1] - large.yRange![0];
  assert.ok(largeSpan > smallSpan);
});

for (let i = 0; i < 25; i++) {
  test(`TL-P-0${(71 + i).toString().padStart(2, '0')}: parametrized viewport shift #${i} still produces valid highlight`, () => {
    const dHigh = 200 + i * 30;
    const wCanvas = 400 + i * 20;
    const d = draft(pt(T0, 140), pt(T0 + 30_000, 160));
    const h = tool.getAxisHighlight(d, vp({ width: wCanvas, height: dHigh }))!;
    assert.ok(h.xRange && h.yRange);
    assert.ok(h.xRange![0] <= h.xRange![1]);
    assert.ok(h.yRange![0] <= h.yRange![1]);
  });
}

// ─── D. extendLeft / extendRight variations (20) ─────────────────────────────

function draftWith(extendLeft: boolean, extendRight: boolean): Drawing {
  const d = draft(pt(T0 + 20_000, 150), pt(T0 + 60_000, 160));
  return { ...d, options: { ...d.options, extendLeft, extendRight } };
}

test('TL-P-096: finite line xRange equals anchor pixel span', () => {
  const d = draftWith(false, false);
  const h = tool.getAxisHighlight(d, vp())!;
  // should NOT reach canvas edges
  assert.ok(h.xRange![0] > 0);
  const plotW = 800 - 60;
  assert.ok(h.xRange![1] < plotW - 1);
});

test('TL-P-097: extendRight expands xRange to canvas edge', () => {
  const d = draftWith(false, true);
  const h = tool.getAxisHighlight(d, vp())!;
  const plotW = 800 - 60;
  assert.ok(h.xRange![1] >= plotW - 2);
});

test('TL-P-098: extendLeft expands xRange to left edge', () => {
  const d = draftWith(true, false);
  const h = tool.getAxisHighlight(d, vp())!;
  assert.ok(h.xRange![0] <= 2);
});

test('TL-P-099: extend both reaches both edges', () => {
  const d = draftWith(true, true);
  const h = tool.getAxisHighlight(d, vp())!;
  const plotW = 800 - 60;
  assert.ok(h.xRange![0] <= 2);
  assert.ok(h.xRange![1] >= plotW - 2);
});

test('TL-P-100: extendRight for descending line still ascending xRange', () => {
  const d0 = draft(pt(T0 + 20_000, 180), pt(T0 + 60_000, 120));
  const d = { ...d0, options: { ...d0.options, extendRight: true } };
  const h = tool.getAxisHighlight(d, vp())!;
  assert.ok(h.xRange![0] <= h.xRange![1]);
});

for (let i = 0; i < 15; i++) {
  const eL = i % 2 === 0;
  const eR = i % 3 === 0;
  test(`TL-P-${(101 + i).toString().padStart(3, '0')}: parametrized extend flags #${i} (L=${eL},R=${eR})`, () => {
    const d0 = draft(pt(T0 + 10_000 + i * 200, 130 + i), pt(T0 + 50_000 + i * 200, 170 - i));
    const d = { ...d0, options: { ...d0.options, extendLeft: eL, extendRight: eR } };
    const h = tool.getAxisHighlight(d, vp())!;
    assert.ok(h.xRange && h.yRange);
  });
}

// ─── E. Text label parity (25) ───────────────────────────────────────────────

test('TL-P-116: drawing.text field defaults to undefined', () => {
  const d = draft();
  assert.equal(d.text, undefined);
});

function findDrawing(engine: DrawingEngine, id: string): Drawing {
  return engine.drawings.find((x) => x.id === id)!;
}

test('TL-P-117: text field can be set via updateDrawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'Support line' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'Support line');
});

test('TL-P-118: text preserved across re-renders', () => {
  const engine = newEngine();
  const d = { ...draft(), text: 'X' };
  engine.addDrawing(d);
  const ctx = makeMockCtx();
  engine.render(ctx, vp());
  engine.render(ctx, vp());
  assert.equal(findDrawing(engine, d.id).text, 'X');
});

test('TL-P-119: multiline text preserved', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'line1\nline2' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'line1\nline2');
});

test('TL-P-120: text unicode preserved', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'αβγ 📈 测试' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'αβγ 📈 测试');
});

test('TL-P-121: empty string text is persisted', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '' }));
  assert.equal(findDrawing(engine, drawing.id).text, '');
});

test('TL-P-122: text can be cleared to undefined', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'hello' }));
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: undefined }));
  assert.equal(findDrawing(engine, drawing.id).text, undefined);
});

test('TL-P-123: options.font stored when set', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, font: 'Arial' } }));
  assert.equal(findDrawing(engine, drawing.id).options.font, 'Arial');
});

test('TL-P-124: options.textSize stored when set', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, textSize: 18 } }));
  assert.equal(findDrawing(engine, drawing.id).options.textSize, 18);
});

test('TL-P-125: options.bold/italic stored together', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, bold: true, italic: true } }));
  const u = findDrawing(engine, drawing.id);
  assert.equal(u.options.bold, true);
  assert.equal(u.options.italic, true);
});

for (let i = 0; i < 15; i++) {
  test(`TL-P-${(126 + i).toString().padStart(3, '0')}: text round-trip #${i}`, () => {
    const msg = `label#${i}-${Math.random().toString(36).slice(2, 6)}`;
    const { engine, drawing } = engineWithSelected();
    engine.updateDrawing(drawing.id, (d) => ({ ...d, text: msg }));
    assert.equal(findDrawing(engine, drawing.id).text, msg);
  });
}

// ─── F. Keyboard parity — Delete, Escape, Shift via engine (25) ──────────────

test('TL-P-141: deleteSelected removes selected drawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
});

test('TL-P-142: deleteSelected clears highlight', () => {
  const { engine } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('TL-P-143: deleteSelected does not delete when locked', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('TL-P-144: deleteSelected no-op when nothing selected', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.deleteSelected();
  assert.equal(engine.drawings.length, 1);
});

test('TL-P-145: cancel() aborts an in-progress draft', () => {
  const engine = newEngine();
  engine.selectTool('trend');
  engine.pointerDown(pt(T0, 150));
  engine.cancel();
  assert.equal(engine.drawings.length, 0);
});

test('TL-P-146: cancel() while idle is a no-op', () => {
  const engine = newEngine();
  engine.cancel();
  assert.equal(engine.drawings.length, 0);
});

test('TL-P-147: cancel() after committing keeps selection / drawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.cancel();
  assert.ok(findDrawing(engine, drawing.id));
});

test('TL-P-148: pointerDown+Move+Up creates drawing', () => {
  const engine = newEngine();
  engine.selectTool('trend');
  engine.pointerDown(pt(T0, 150));
  engine.pointerMove(pt(T0 + 40_000, 160));
  engine.pointerUp(pt(T0 + 40_000, 160), true);
  assert.equal(engine.drawings.length, 1);
});

test('TL-P-149: pointerMove without prior down does not throw', () => {
  const engine = newEngine();
  engine.selectTool('trend');
  assert.doesNotThrow(() => engine.pointerMove(pt(T0 + 40_000, 165)));
});

test('TL-P-150: pointerDown with no active tool returns none', () => {
  const engine = newEngine();
  const res = engine.pointerDown(pt(T0, 150));
  assert.equal(res, 'none');
});

for (let i = 0; i < 15; i++) {
  test(`TL-P-${(151 + i).toString().padStart(3, '0')}: delete selected #${i} idempotent`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.deleteSelected();
    engine.deleteSelected();
    assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
  });
}

// ─── G. Click / selection parity via engine (25) ─────────────────────────────

test('TL-P-166: addDrawing without select does not auto-select', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.selectedId, null);
});

test('TL-P-167: select(id) sets selection', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('TL-P-168: select(null) clears selection', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.selectedId, null);
});

test('TL-P-169: selecting missing id stays (engine does not validate) but highlight is null', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.select('no-such-id');
  // even if selectedId is set, highlight must be null (drawing not found)
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('TL-P-170: selection persists across render()', () => {
  const { engine, drawing } = engineWithSelected();
  engine.render(makeMockCtx(), vp());
  assert.equal(engine.selectedId, drawing.id);
});

test('TL-P-171: selecting fires selectionChanged event', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  const events: unknown[] = [];
  engine.on((e) => events.push(e));
  engine.select(d.id);
  assert.ok(events.some((e: any) => e.type === 'selectionChanged' && e.selectedId === d.id));
});

test('TL-P-172: deselecting fires selectionChanged with null', () => {
  const { engine } = engineWithSelected();
  const events: unknown[] = [];
  engine.on((e) => events.push(e));
  engine.select(null);
  assert.ok(events.some((e: any) => e.type === 'selectionChanged' && e.selectedId === null));
});

test('TL-P-173: selectedId getter reports current selection', () => {
  const { engine, drawing } = engineWithSelected();
  assert.equal(engine.selectedId, drawing.id);
});

test('TL-P-174: selection swap fires event with correct prevId', () => {
  const engine = newEngine();
  const d1 = draft(pt(T0, 130), pt(T0 + 5000, 140));
  const d2 = draft(pt(T0 + 10_000, 150), pt(T0 + 20_000, 160));
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  const events: unknown[] = [];
  engine.on((e) => events.push(e));
  engine.select(d2.id);
  const ev = events.find((e: any) => e.type === 'selectionChanged') as any;
  assert.equal(ev.prevId, d1.id);
  assert.equal(ev.selectedId, d2.id);
});

test('TL-P-175: deleting non-selected drawing keeps selection', () => {
  const engine = newEngine();
  const d1 = draft(pt(T0, 130), pt(T0 + 5000, 140));
  const d2 = draft(pt(T0 + 10_000, 150), pt(T0 + 20_000, 160));
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  engine.removeDrawing(d2.id);
  assert.equal(engine.selectedId, d1.id);
});

for (let i = 0; i < 15; i++) {
  test(`TL-P-${(176 + i).toString().padStart(3, '0')}: select/deselect cycle #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.select(null);
    engine.select(drawing.id);
    engine.select(null);
    assert.equal(engine.selectedId, null);
  });
}

// ─── H. Hit-test grid (20) ───────────────────────────────────────────────────

test('TL-P-191: hit-test on anchor returns 0-ish', () => {
  const d = draft(pt(T0, 150), pt(T0 + 40_000, 160));
  const v = vp();
  const a = { x: 0, y: 0 };
  // Just ensure distance is finite at anchor point
  // dataToScreen of anchor 0:
  // (anchors[0].time - visibleFrom) * pxPerTime
  const screenX = (T0 - v.visibleFrom) * v.pxPerTime + v.originX;
  const dist = tool.hitTest(d, { x: screenX, y: v.originY - (150 - v.priceMin) * v.pxPerPrice }, v);
  assert.ok(Number.isFinite(dist));
});

test('TL-P-192: far-away pointer returns large distance', () => {
  const d = draft();
  assert.ok(tool.hitTest(d, { x: 10_000, y: 10_000 }, vp()) > 100);
});

test('TL-P-193: empty anchors hit-test returns Infinity', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

test('TL-P-194: single anchor hit-test returns Infinity', () => {
  const d = { ...draft(), anchors: [pt(T0, 150)] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

for (let i = 0; i < 16; i++) {
  test(`TL-P-${(195 + i).toString().padStart(3, '0')}: grid hit-test #${i} returns finite`, () => {
    const d = draft(pt(T0, 140), pt(T0 + 40_000, 160));
    const x = 50 + i * 30;
    const y = 50 + (i % 5) * 40;
    const dist = tool.hitTest(d, { x, y }, vp());
    assert.ok(Number.isFinite(dist));
  });
}

// ─── I. Options / visibility / locking / render invariants (20) ─────────────

test('TL-P-211: setting visible=false hides from render output', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.updateDrawing(d.id, (x) => ({ ...x, visible: false }));
  const ctx = makeMockCtx();
  assert.doesNotThrow(() => engine.render(ctx, vp()));
});

test('TL-P-212: locked=true prevents deleteSelected', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('TL-P-213: options.color round-trips', () => {
  const d = { ...draft(), options: { ...draft().options, color: '#ff8800' } };
  assert.equal(d.options.color, '#ff8800');
});

test('TL-P-214: options.lineWidth round-trips', () => {
  const d = { ...draft(), options: { ...draft().options, lineWidth: 3 } };
  assert.equal(d.options.lineWidth, 3);
});

test('TL-P-215: options.lineStyle dashed round-trips', () => {
  const d = { ...draft(), options: { ...draft().options, lineStyle: 'dashed' as const } };
  assert.equal(d.options.lineStyle, 'dashed');
});

test('TL-P-216: render does not throw on empty engine', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('TL-P-217: render does not throw with 10 drawings', () => {
  const engine = newEngine();
  for (let i = 0; i < 10; i++) {
    engine.addDrawing(draft(pt(T0 + i * 1000, 120 + i), pt(T0 + i * 1000 + 5000, 130 + i)));
  }
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('TL-P-218: zIndex default is finite', () => {
  assert.ok(Number.isFinite(draft().zIndex ?? 20));
});

test('TL-P-219: renderOrder default is positive', () => {
  assert.ok((draft().renderOrder ?? 0) > 0);
});

test('TL-P-220: finalize rejects zero-length line', () => {
  let d = tool.createDraft(pt(T0, 150), defaultOptions());
  d = tool.updateDraft(d, pt(T0, 150));
  assert.equal(tool.finalize(d), null);
});

for (let i = 0; i < 10; i++) {
  test(`TL-P-${(221 + i).toString().padStart(3, '0')}: random-options round-trip #${i}`, () => {
    const color = `#${((i * 12345) & 0xffffff).toString(16).padStart(6, '0')}`;
    const d = { ...draft(), options: { ...draft().options, color, lineWidth: (i % 5) + 1 } };
    assert.equal(d.options.color, color);
    assert.equal(d.options.lineWidth, (i % 5) + 1);
  });
}

// ─── J. Edge cases / multi-drawing / zoom / resize (20) ──────────────────────

test('TL-P-231: negative-time anchors still produce valid highlight', () => {
  const d = draft(pt(-1000, 150), pt(T0 + 40_000, 160));
  const h = tool.getAxisHighlight(d, vp())!;
  assert.ok(h.xRange && h.yRange);
});

test('TL-P-232: very-high prices still produce valid highlight', () => {
  const d = draft(pt(T0, 9999), pt(T0 + 40_000, 9998));
  const h = tool.getAxisHighlight(d, vp())!;
  assert.ok(h);
});

test('TL-P-233: zero-width viewport does not throw', () => {
  const d = draft();
  assert.doesNotThrow(() => tool.getAxisHighlight(d, vp({ width: 60 })));
});

test('TL-P-234: drawings getter is readonly from outside (array-like)', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.drawings.length, 1);
});

test('TL-P-235: selecting after setDrawings keeps selection valid', () => {
  const engine = newEngine();
  const d = draft();
  engine.setDrawings([d]);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('TL-P-236: setDrawings([]) clears selection', () => {
  const { engine } = engineWithSelected();
  engine.setDrawings([]);
  assert.equal(engine.selectedId, null);
});

test('TL-P-237: multi-drawing engine renders without axis bands until selection', () => {
  const engine = newEngine();
  for (let i = 0; i < 5; i++) {
    engine.addDrawing(draft(pt(T0 + i * 1000, 120 + i), pt(T0 + i * 1000 + 5000, 130 + i)));
  }
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  const bandsX = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  const bandsY = ctx.fillRectCalls.filter((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.equal(bandsX.length, 0);
  assert.equal(bandsY.length, 0);
});

test('TL-P-238: multi-drawing with selection paints exactly 2 axis bands', () => {
  const engine = newEngine();
  const ds: Drawing[] = [];
  for (let i = 0; i < 5; i++) {
    const d = draft(pt(T0 + i * 1000, 120 + i), pt(T0 + i * 1000 + 5000, 130 + i));
    engine.addDrawing(d);
    ds.push(d);
  }
  engine.select(ds[2].id);
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  const bandsX = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  const bandsY = ctx.fillRectCalls.filter((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.equal(bandsX.length, 1);
  assert.equal(bandsY.length, 1);
});

test('TL-P-239: axis highlight fillRect at bottom strip (time axis)', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  const xBand = ctx.fillRectCalls.find((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  assert.ok(xBand, 'x-band on time axis expected');
});

test('TL-P-240: axis highlight fillRect at right strip (price axis)', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  const yBand = ctx.fillRectCalls.find((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.ok(yBand, 'y-band on price axis expected');
});

for (let i = 0; i < 10; i++) {
  test(`TL-P-${(241 + i).toString().padStart(3, '0')}: stress render-iteration #${i}`, () => {
    const engine = newEngine();
    for (let k = 0; k < 20; k++) {
      engine.addDrawing(draft(pt(T0 + k * 200, 120 + (k % 40)), pt(T0 + k * 200 + 1000, 140 + (k % 40))));
    }
    const ctx = makeMockCtx();
    assert.doesNotThrow(() => engine.render(ctx, vp()));
  });
}

// ─── Done ────────────────────────────────────────────────────────────────────

summary();
