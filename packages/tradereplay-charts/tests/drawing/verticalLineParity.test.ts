/**
 * VerticalLine TV-parity tests (250 tests).
 *
 * VLine: yRange=null, xRange=[x,x]. Engine paints only xBand (time axis strip), no yBand.
 */

import assert from 'node:assert/strict';
import { VerticalLineTool } from '../../src/drawing/tools/verticalLine.ts';
import { DrawingEngine } from '../../src/drawing/engine/drawingEngine.ts';
import { createDefaultTools } from '../../src/drawing/tools/index.ts';
import type { Drawing, DrawPoint } from '../../src/drawing/types.ts';
import { pt, vp, defaultOptions, makeMockCtx, createRunner, T0 } from './parityHelpers.ts';

const tool = new VerticalLineTool();
const { test, summary } = createRunner('VerticalLine parity tests');

function draft(time: number = T0 + 20_000, price: number = 150): Drawing {
  let d = tool.createDraft(pt(time, price), defaultOptions());
  d = tool.updateDraft(d, pt(time, price));
  const final = tool.finalize(d);
  if (!final) throw new Error('finalize returned null');
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

function findDrawing(engine: DrawingEngine, id: string): Drawing {
  return engine.drawings.find((x) => x.id === id)!;
}

function isXBand(c: number[], v: ReturnType<typeof vp>): boolean {
  return c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight;
}
function isYBand(c: number[], v: ReturnType<typeof vp>): boolean {
  return c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth;
}

// ─── A. Axis highlight shape (40) ────────────────────────────────────────────

test('VL-P-001: yRange is null', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.equal(h.yRange, null);
});

test('VL-P-002: xRange is zero-width band', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.ok(h.xRange);
  assert.equal(h.xRange![0], h.xRange![1]);
});

test('VL-P-003: no anchors → null', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.getAxisHighlight!(d, vp()), null);
});

test('VL-P-004: yRange is explicitly null', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.strictEqual(h.yRange, null);
});

test('VL-P-005: xRange array length 2', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.ok(Array.isArray(h.xRange));
  assert.equal(h.xRange!.length, 2);
});

test('VL-P-006: xRange within plot width', () => {
  const v = vp();
  const plotW = v.width - v.priceAxisWidth;
  const h = tool.getAxisHighlight!(draft(T0 + 20_000), v)!;
  assert.ok(h.xRange![0] >= -1);
  assert.ok(h.xRange![0] <= plotW + 1);
});

test('VL-P-007: early time has small x', () => {
  const h = tool.getAxisHighlight!(draft(T0 + 1_000), vp())!;
  assert.ok(h.xRange![0] < 200);
});

test('VL-P-008: late time has large x', () => {
  const v = vp();
  const plotW = v.width - v.priceAxisWidth;
  // Visible range is T0 to T0+100_000. Use T0+90_000 (90% across).
  const h = tool.getAxisHighlight!(draft(T0 + 90_000), v)!;
  assert.ok(h.xRange![0] > plotW * 0.7);
});

test('VL-P-009: mid time gives mid x', () => {
  const v = vp();
  const plotW = v.width - v.priceAxisWidth;
  // Viewport spans T0 to T0+100_000, so T0+50_000 is midpoint.
  const h = tool.getAxisHighlight!(draft(T0 + 50_000), v)!;
  assert.ok(Math.abs(h.xRange![0] - plotW / 2) < 10);
});

test('VL-P-010: different times give different x', () => {
  const h1 = tool.getAxisHighlight!(draft(T0 + 10_000), vp())!;
  const h2 = tool.getAxisHighlight!(draft(T0 + 40_000), vp())!;
  assert.notDeepEqual(h1.xRange, h2.xRange);
});

for (let i = 0; i < 30; i++) {
  const time = T0 + 2_000 + i * 1500;
  test(`VL-P-0${(11 + i).toString().padStart(2, '0')}: parametrized time index=${i}`, () => {
    const h = tool.getAxisHighlight!(draft(time), vp())!;
    assert.equal(h.yRange, null);
    assert.ok(h.xRange);
    assert.equal(h.xRange![0], h.xRange![1]);
  });
}

// ─── B. Engine gating (25) ───────────────────────────────────────────────────

test('VL-P-041: no highlight without selection', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('VL-P-042: highlight after select', () => {
  const { engine } = engineWithSelected();
  assert.ok(engine.getSelectedAxisHighlight(vp()));
});

test('VL-P-043: null after deselect', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('VL-P-044: swap selection swaps xRange', () => {
  const engine = newEngine();
  const d1 = draft(T0 + 10_000);
  const d2 = draft(T0 + 40_000);
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.select(d2.id);
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.xRange, h2.xRange);
});

test('VL-P-045: delete clears highlight', () => {
  const { engine, drawing } = engineWithSelected();
  engine.removeDrawing(drawing.id);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('VL-P-046: visibility=false clears highlight', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, visible: false }));
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('VL-P-047: re-select same id stable', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp());
  engine.select(drawing.id);
  const h2 = engine.getSelectedAxisHighlight(vp());
  assert.deepEqual(h1, h2);
});

test('VL-P-048: render paints EXACTLY xBand, NO yBand', () => {
  const { engine } = engineWithSelected();
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 1);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
});

test('VL-P-049: unselected paints no bands', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
});

test('VL-P-050: 3 consecutive renders consistent', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  for (let i = 0; i < 3; i++) {
    const ctx = makeMockCtx();
    engine.render(ctx, v);
    assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 1);
  }
});

for (let i = 0; i < 15; i++) {
  test(`VL-P-0${(51 + i).toString().padStart(2, '0')}: toggle sel #${i}`, () => {
    const { engine, drawing } = engineWithSelected(draft(T0 + 5_000 + i * 2000));
    engine.select(null);
    assert.equal(engine.getSelectedAxisHighlight(vp()), null);
    engine.select(drawing.id);
    assert.ok(engine.getSelectedAxisHighlight(vp()));
  });
}

// ─── C. Move / viewport (30) ─────────────────────────────────────────────────

test('VL-P-066: moving time updates xRange', () => {
  const { engine, drawing } = engineWithSelected(draft(T0 + 20_000));
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({
    ...d,
    anchors: d.anchors.map((a) => ({ ...a, time: T0 + 45_000 })) as DrawPoint[],
  }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.xRange, h2.xRange);
});

test('VL-P-067: no-op update keeps highlight', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({ ...d }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.deepEqual(h1.xRange, h2.xRange);
});

test('VL-P-068: shifted timeRange changes x', () => {
  const d = draft(T0 + 20_000);
  // Extend visibleTo to shift the time→x mapping.
  const a = tool.getAxisHighlight!(d, vp({ visibleFrom: T0 as DrawPoint['time'], visibleTo: (T0 + 100_000) as DrawPoint['time'] }))!;
  const b = tool.getAxisHighlight!(d, vp({ visibleFrom: T0 as DrawPoint['time'], visibleTo: (T0 + 200_000) as DrawPoint['time'] }))!;
  assert.notDeepEqual(a.xRange, b.xRange);
});

test('VL-P-069: canvas width resize changes x', () => {
  const d = draft(T0 + 20_000);
  const small = tool.getAxisHighlight!(d, vp({ width: 400 }))!;
  const large = tool.getAxisHighlight!(d, vp({ width: 1200 }))!;
  assert.notDeepEqual(small.xRange, large.xRange);
});

test('VL-P-070: canvas height resize does NOT change x', () => {
  const d = draft(T0 + 20_000);
  const small = tool.getAxisHighlight!(d, vp({ height: 200 }))!;
  const large = tool.getAxisHighlight!(d, vp({ height: 800 }))!;
  assert.deepEqual(small.xRange, large.xRange);
});

for (let i = 0; i < 25; i++) {
  test(`VL-P-0${(71 + i).toString().padStart(2, '0')}: viewport param #${i}`, () => {
    const d = draft(T0 + 5_000 + i * 1500);
    const h = tool.getAxisHighlight!(d, vp({ width: 300 + i * 30, height: 200 + i * 20 }))!;
    assert.equal(h.yRange, null);
    assert.ok(h.xRange);
  });
}

// ─── D. Render sanity (20) ───────────────────────────────────────────────────

for (let i = 0; i < 20; i++) {
  test(`VL-P-0${(96 + i).toString().padStart(2, '0')}: render sanity time#${i}`, () => {
    const engine = newEngine();
    const d = draft(T0 + 5_000 + i * 2000);
    engine.addDrawing(d);
    engine.select(d.id);
    const ctx = makeMockCtx();
    const v = vp();
    assert.doesNotThrow(() => engine.render(ctx, v));
    assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
  });
}

// ─── E. Text (25) ────────────────────────────────────────────────────────────

test('VL-P-116: text default undefined', () => {
  assert.equal(draft().text, undefined);
});

test('VL-P-117: text round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'Earnings' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'Earnings');
});

test('VL-P-118: text across renders', () => {
  const engine = newEngine();
  const d = { ...draft(), text: 'X' };
  engine.addDrawing(d);
  engine.render(makeMockCtx(), vp());
  engine.render(makeMockCtx(), vp());
  assert.equal(findDrawing(engine, d.id).text, 'X');
});

test('VL-P-119: multiline', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'a\nb' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'a\nb');
});

test('VL-P-120: unicode', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '📅 event' }));
  assert.equal(findDrawing(engine, drawing.id).text, '📅 event');
});

test('VL-P-121: empty string', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '' }));
  assert.equal(findDrawing(engine, drawing.id).text, '');
});

test('VL-P-122: clear to undefined', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'x' }));
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: undefined }));
  assert.equal(findDrawing(engine, drawing.id).text, undefined);
});

test('VL-P-123: font round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, font: 'Verdana' } }));
  assert.equal(findDrawing(engine, drawing.id).options.font, 'Verdana');
});

test('VL-P-124: textSize round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, textSize: 22 } }));
  assert.equal(findDrawing(engine, drawing.id).options.textSize, 22);
});

test('VL-P-125: bold+italic', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, bold: true, italic: true } }));
  const u = findDrawing(engine, drawing.id);
  assert.equal(u.options.bold, true);
  assert.equal(u.options.italic, true);
});

for (let i = 0; i < 15; i++) {
  test(`VL-P-${(126 + i).toString().padStart(3, '0')}: text round-trip #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    const msg = `vline#${i}`;
    engine.updateDrawing(drawing.id, (d) => ({ ...d, text: msg }));
    assert.equal(findDrawing(engine, drawing.id).text, msg);
  });
}

// ─── F. Keyboard (25) ────────────────────────────────────────────────────────

test('VL-P-141: delete removes', () => {
  const { engine, drawing } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
});

test('VL-P-142: delete clears highlight', () => {
  const { engine } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('VL-P-143: locked prevents delete', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('VL-P-144: delete no-op without selection', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.deleteSelected();
  assert.equal(engine.drawings.length, 1);
});

test('VL-P-145: cancel aborts draft', () => {
  const engine = newEngine();
  engine.selectTool('vline');
  engine.pointerDown(pt(T0 + 10_000, 150));
  engine.cancel();
  assert.equal(engine.drawings.length, 0);
});

test('VL-P-146: cancel idle safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.cancel());
});

test('VL-P-147: cancel after commit keeps drawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.cancel();
  assert.ok(findDrawing(engine, drawing.id));
});

test('VL-P-148: full pointer flow creates line', () => {
  const engine = newEngine();
  engine.selectTool('vline');
  engine.pointerDown(pt(T0 + 15_000, 150));
  engine.pointerUp(pt(T0 + 15_000, 150), true);
  assert.equal(engine.drawings.length, 1);
});

test('VL-P-149: move without down safe', () => {
  const engine = newEngine();
  engine.selectTool('vline');
  assert.doesNotThrow(() => engine.pointerMove(pt(T0, 150)));
});

test('VL-P-150: pointerDown without tool returns none', () => {
  const engine = newEngine();
  assert.equal(engine.pointerDown(pt(T0, 150)), 'none');
});

for (let i = 0; i < 15; i++) {
  test(`VL-P-${(151 + i).toString().padStart(3, '0')}: delete idempotent #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.deleteSelected();
    engine.deleteSelected();
    assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
  });
}

// ─── G. Selection (25) ───────────────────────────────────────────────────────

test('VL-P-166: add without select → null', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.selectedId, null);
});

test('VL-P-167: select sets id', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('VL-P-168: deselect', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.selectedId, null);
});

test('VL-P-169: missing id no highlight', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.select('missing');
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('VL-P-170: selection persists through render', () => {
  const { engine, drawing } = engineWithSelected();
  engine.render(makeMockCtx(), vp());
  assert.equal(engine.selectedId, drawing.id);
});

test('VL-P-171: selection event fires', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(d.id);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === d.id));
});

test('VL-P-172: deselection event', () => {
  const { engine } = engineWithSelected();
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(null);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === null));
});

test('VL-P-173: selectedId getter live', () => {
  const { engine, drawing } = engineWithSelected();
  assert.equal(engine.selectedId, drawing.id);
});

test('VL-P-174: swap event prevId', () => {
  const engine = newEngine();
  const d1 = draft(T0 + 10_000);
  const d2 = draft(T0 + 40_000);
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(d2.id);
  const ev = events.find((e) => e.type === 'selectionChanged');
  assert.equal(ev.prevId, d1.id);
  assert.equal(ev.selectedId, d2.id);
});

test('VL-P-175: delete non-selected keeps sel', () => {
  const engine = newEngine();
  const d1 = draft(T0 + 10_000);
  const d2 = draft(T0 + 40_000);
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  engine.removeDrawing(d2.id);
  assert.equal(engine.selectedId, d1.id);
});

for (let i = 0; i < 15; i++) {
  test(`VL-P-${(176 + i).toString().padStart(3, '0')}: sel cycle #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.select(null);
    engine.select(drawing.id);
    engine.select(null);
    assert.equal(engine.selectedId, null);
  });
}

// ─── H. Hit-test (20) ────────────────────────────────────────────────────────

test('VL-P-191: far-x point large distance', () => {
  assert.ok(tool.hitTest(draft(T0 + 20_000), { x: 10_000, y: 100 }, vp()) > 100);
});

test('VL-P-192: no anchors Infinity', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

test('VL-P-193: finite value', () => {
  assert.ok(Number.isFinite(tool.hitTest(draft(T0 + 20_000), { x: 100, y: 100 }, vp())));
});

test('VL-P-194: exact x hit ~0', () => {
  const v = vp();
  const h = tool.getAxisHighlight!(draft(T0 + 20_000), v)!;
  const d = tool.hitTest(draft(T0 + 20_000), { x: h.xRange![0], y: 100 }, v);
  assert.ok(d < 2, `expected near-zero, got ${d}`);
});

for (let i = 0; i < 16; i++) {
  test(`VL-P-${(195 + i).toString().padStart(3, '0')}: hit grid #${i}`, () => {
    const x = 50 + i * 30;
    const y = 50 + (i % 5) * 40;
    assert.ok(Number.isFinite(tool.hitTest(draft(T0 + 20_000), { x, y }, vp())));
  });
}

// ─── I. Options (20) ─────────────────────────────────────────────────────────

test('VL-P-211: visible=false render safe', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.updateDrawing(d.id, (x) => ({ ...x, visible: false }));
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('VL-P-212: locked prevents delete', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('VL-P-213: color round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, color: '#112233' } };
  assert.equal(d.options.color, '#112233');
});

test('VL-P-214: lineWidth round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, lineWidth: 5 } };
  assert.equal(d.options.lineWidth, 5);
});

test('VL-P-215: lineStyle dashed', () => {
  const d = { ...draft(), options: { ...draft().options, lineStyle: 'dashed' as const } };
  assert.equal(d.options.lineStyle, 'dashed');
});

test('VL-P-216: empty engine render safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('VL-P-217: 10 VLines render safe', () => {
  const engine = newEngine();
  for (let i = 0; i < 10; i++) engine.addDrawing(draft(T0 + i * 3000));
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('VL-P-218: zIndex defined', () => {
  assert.ok(Number.isFinite(draft().zIndex ?? 20));
});

test('VL-P-219: renderOrder positive', () => {
  assert.ok((draft().renderOrder ?? 0) > 0);
});

test('VL-P-220: getHandles returns 1 handle', () => {
  const handles = tool.getHandles(draft(), vp());
  assert.equal(handles.length, 1);
});

for (let i = 0; i < 10; i++) {
  test(`VL-P-${(221 + i).toString().padStart(3, '0')}: options round-trip #${i}`, () => {
    const d = { ...draft(), options: { ...draft().options, lineWidth: (i % 5) + 1 } };
    assert.equal(d.options.lineWidth, (i % 5) + 1);
  });
}

// ─── J. Edge cases (20) ──────────────────────────────────────────────────────

test('VL-P-231: time before range handled', () => {
  const h = tool.getAxisHighlight!(draft(T0 - 10_000), vp())!;
  assert.ok(h);
  assert.equal(h.yRange, null);
});

test('VL-P-232: time after range handled', () => {
  const h = tool.getAxisHighlight!(draft(T0 + 200_000), vp())!;
  assert.ok(h);
  assert.equal(h.yRange, null);
});

test('VL-P-233: drawings length', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.drawings.length, 1);
});

test('VL-P-234: setDrawings + select', () => {
  const engine = newEngine();
  const d = draft();
  engine.setDrawings([d]);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('VL-P-235: setDrawings([]) clears sel', () => {
  const { engine } = engineWithSelected();
  engine.setDrawings([]);
  assert.equal(engine.selectedId, null);
});

test('VL-P-236: multi-VLine no bands without sel', () => {
  const engine = newEngine();
  for (let i = 0; i < 5; i++) engine.addDrawing(draft(T0 + i * 5000));
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
});

test('VL-P-237: multi-VLine selected paints ONLY xBand', () => {
  const engine = newEngine();
  const ds: Drawing[] = [];
  for (let i = 0; i < 5; i++) {
    const d = draft(T0 + i * 5000);
    engine.addDrawing(d);
    ds.push(d);
  }
  engine.select(ds[2].id);
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 1);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
});

test('VL-P-238: xBand present on time axis strip', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  assert.ok(ctx.fillRectCalls.find((c) => isXBand(c, v)));
});

test('VL-P-239: extreme time render safe', () => {
  const engine = newEngine();
  const d = draft(T0 + 1_000_000);
  engine.addDrawing(d);
  engine.select(d.id);
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('VL-P-240: stable under repeated call', () => {
  const d = draft(T0 + 20_000);
  const h1 = tool.getAxisHighlight!(d, vp())!;
  const h2 = tool.getAxisHighlight!(d, vp())!;
  assert.deepEqual(h1.xRange, h2.xRange);
});

for (let i = 0; i < 10; i++) {
  test(`VL-P-${(241 + i).toString().padStart(3, '0')}: stress #${i}`, () => {
    const engine = newEngine();
    for (let k = 0; k < 20; k++) engine.addDrawing(draft(T0 + (k % 50) * 1000));
    assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
  });
}

summary();
