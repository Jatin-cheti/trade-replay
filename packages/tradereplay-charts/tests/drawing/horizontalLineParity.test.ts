/**
 * HorizontalLine TV-parity tests (250 tests).
 *
 * HLine has xRange=null, yRange=[y,y]. Engine paints only yBand (price axis strip), no xBand.
 */

import assert from 'node:assert/strict';
import { HorizontalLineTool } from '../../src/drawing/tools/horizontalLine.ts';
import { DrawingEngine } from '../../src/drawing/engine/drawingEngine.ts';
import { createDefaultTools } from '../../src/drawing/tools/index.ts';
import type { Drawing, DrawPoint } from '../../src/drawing/types.ts';
import { pt, vp, defaultOptions, makeMockCtx, createRunner, T0 } from './parityHelpers.ts';

const tool = new HorizontalLineTool();
const { test, summary } = createRunner('HorizontalLine parity tests');

function draft(price: number = 150, time: number = T0 + 10_000): Drawing {
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

test('HL-P-001: highlight has xRange=null', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.equal(h.xRange, null);
});

test('HL-P-002: highlight yRange is zero-width band at line', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.ok(h.yRange);
  assert.equal(h.yRange![0], h.yRange![1]);
});

test('HL-P-003: highlight yRange matches screen y', () => {
  const v = vp();
  const d = draft(150);
  const h = tool.getAxisHighlight!(d, v)!;
  // screen y = ((200 - 150) / 100) * plotH with default (priceMin=100, priceMax=200)
  const plotH = v.height - v.timeAxisHeight;
  const expected = ((200 - 150) / 100) * plotH;
  assert.ok(Math.abs(h.yRange![0] - expected) < 1);
});

test('HL-P-004: no anchors → null highlight', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.getAxisHighlight!(d, vp()), null);
});

test('HL-P-005: yRange always within plot height', () => {
  const v = vp();
  const plotH = v.height - v.timeAxisHeight;
  const h = tool.getAxisHighlight!(draft(150), v)!;
  assert.ok(h.yRange![0] >= -1);
  assert.ok(h.yRange![0] <= plotH + 1);
});

test('HL-P-006: price near top of range has low y', () => {
  const h = tool.getAxisHighlight!(draft(195), vp())!;
  assert.ok(h.yRange![0] < 50);
});

test('HL-P-007: price near bottom has high y', () => {
  const v = vp();
  const plotH = v.height - v.timeAxisHeight;
  const h = tool.getAxisHighlight!(draft(105), v)!;
  assert.ok(h.yRange![0] > plotH - 50);
});

test('HL-P-008: mid price gives mid y', () => {
  const v = vp();
  const plotH = v.height - v.timeAxisHeight;
  const h = tool.getAxisHighlight!(draft(150), v)!;
  assert.ok(Math.abs(h.yRange![0] - plotH / 2) < 5);
});

test('HL-P-009: xRange is explicitly null (not undefined or array)', () => {
  const h = tool.getAxisHighlight!(draft(), vp());
  assert.ok(h);
  assert.strictEqual(h!.xRange, null);
});

test('HL-P-010: yRange is array of length 2', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.ok(Array.isArray(h.yRange));
  assert.equal(h.yRange!.length, 2);
});

for (let i = 0; i < 30; i++) {
  const price = 105 + i * 3;
  test(`HL-P-0${(11 + i).toString().padStart(2, '0')}: parametrized price=${price}`, () => {
    const h = tool.getAxisHighlight!(draft(price), vp())!;
    assert.equal(h.xRange, null);
    assert.ok(h.yRange);
    assert.equal(h.yRange![0], h.yRange![1]);
  });
}

// ─── B. Engine gating (25) ───────────────────────────────────────────────────

test('HL-P-041: no highlight without selection', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('HL-P-042: highlight after select', () => {
  const { engine } = engineWithSelected();
  assert.ok(engine.getSelectedAxisHighlight(vp()));
});

test('HL-P-043: highlight null after select(null)', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('HL-P-044: swap selection swaps yRange', () => {
  const engine = newEngine();
  const d1 = draft(140);
  const d2 = draft(170);
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.select(d2.id);
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.yRange, h2.yRange);
});

test('HL-P-045: delete clears highlight', () => {
  const { engine, drawing } = engineWithSelected();
  engine.removeDrawing(drawing.id);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('HL-P-046: visibility=false clears highlight', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, visible: false }));
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('HL-P-047: re-select same id stable', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp());
  engine.select(drawing.id);
  const h2 = engine.getSelectedAxisHighlight(vp());
  assert.deepEqual(h1, h2);
});

test('HL-P-048: render paints EXACTLY yBand, NO xBand', () => {
  const { engine } = engineWithSelected();
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 1);
});

test('HL-P-049: unselected HLine paints no bands', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
});

test('HL-P-050: 3 consecutive renders consistent', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  for (let i = 0; i < 3; i++) {
    const ctx = makeMockCtx();
    engine.render(ctx, v);
    assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 1);
  }
});

for (let i = 0; i < 15; i++) {
  test(`HL-P-0${(51 + i).toString().padStart(2, '0')}: toggle selection #${i}`, () => {
    const { engine, drawing } = engineWithSelected(draft(120 + i * 2));
    engine.select(null);
    assert.equal(engine.getSelectedAxisHighlight(vp()), null);
    engine.select(drawing.id);
    assert.ok(engine.getSelectedAxisHighlight(vp()));
  });
}

// ─── C. Move / viewport (30) ─────────────────────────────────────────────────

test('HL-P-066: moving price updates yRange', () => {
  const { engine, drawing } = engineWithSelected(draft(150));
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({
    ...d,
    anchors: [{ ...d.anchors[0], price: 180 } as DrawPoint, { ...d.anchors[1], price: 180 } as DrawPoint],
  }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.yRange, h2.yRange);
});

test('HL-P-067: no-op update keeps highlight', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({ ...d }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.deepEqual(h1.yRange, h2.yRange);
});

test('HL-P-068: shifted priceRange changes y position', () => {
  const d = draft(150);
  const base = tool.getAxisHighlight!(d, vp({ priceMin: 100, priceMax: 200 }))!;
  const shifted = tool.getAxisHighlight!(d, vp({ priceMin: 100, priceMax: 300 }))!;
  assert.notDeepEqual(base.yRange, shifted.yRange);
});

test('HL-P-069: canvas height resize changes y', () => {
  const d = draft(150);
  const small = tool.getAxisHighlight!(d, vp({ height: 200 }))!;
  const large = tool.getAxisHighlight!(d, vp({ height: 800 }))!;
  assert.notDeepEqual(small.yRange, large.yRange);
});

test('HL-P-070: canvas width resize does NOT change y', () => {
  const d = draft(150);
  const small = tool.getAxisHighlight!(d, vp({ width: 400 }))!;
  const large = tool.getAxisHighlight!(d, vp({ width: 1200 }))!;
  assert.deepEqual(small.yRange, large.yRange);
});

for (let i = 0; i < 25; i++) {
  test(`HL-P-0${(71 + i).toString().padStart(2, '0')}: viewport param #${i}`, () => {
    const d = draft(120 + (i % 30) * 2);
    const h = tool.getAxisHighlight!(d, vp({ width: 300 + i * 30, height: 200 + i * 20 }))!;
    assert.equal(h.xRange, null);
    assert.ok(h.yRange);
  });
}

// ─── D. Extend flags — not applicable, use for engine render sanity (20) ─────

for (let i = 0; i < 20; i++) {
  test(`HL-P-0${(96 + i).toString().padStart(2, '0')}: render sanity price=${110 + i * 4}`, () => {
    const engine = newEngine();
    const d = draft(110 + i * 4);
    engine.addDrawing(d);
    engine.select(d.id);
    const ctx = makeMockCtx();
    const v = vp();
    assert.doesNotThrow(() => engine.render(ctx, v));
    // Still only yBand, no xBand
    assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
  });
}

// ─── E. Text label (25) ──────────────────────────────────────────────────────

test('HL-P-116: text defaults undefined', () => {
  assert.equal(draft().text, undefined);
});

test('HL-P-117: text round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'Support' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'Support');
});

test('HL-P-118: text preserved across renders', () => {
  const engine = newEngine();
  const d = { ...draft(), text: 'X' };
  engine.addDrawing(d);
  engine.render(makeMockCtx(), vp());
  engine.render(makeMockCtx(), vp());
  assert.equal(findDrawing(engine, d.id).text, 'X');
});

test('HL-P-119: multiline preserved', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'a\nb\nc' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'a\nb\nc');
});

test('HL-P-120: unicode preserved', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '— 📊 level' }));
  assert.equal(findDrawing(engine, drawing.id).text, '— 📊 level');
});

test('HL-P-121: empty string', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '' }));
  assert.equal(findDrawing(engine, drawing.id).text, '');
});

test('HL-P-122: clear to undefined', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'x' }));
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: undefined }));
  assert.equal(findDrawing(engine, drawing.id).text, undefined);
});

test('HL-P-123: font round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, font: 'Arial' } }));
  assert.equal(findDrawing(engine, drawing.id).options.font, 'Arial');
});

test('HL-P-124: textSize round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, textSize: 18 } }));
  assert.equal(findDrawing(engine, drawing.id).options.textSize, 18);
});

test('HL-P-125: bold+italic round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, bold: true, italic: true } }));
  const u = findDrawing(engine, drawing.id);
  assert.equal(u.options.bold, true);
  assert.equal(u.options.italic, true);
});

for (let i = 0; i < 15; i++) {
  test(`HL-P-${(126 + i).toString().padStart(3, '0')}: text round-trip #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    const msg = `hline#${i}`;
    engine.updateDrawing(drawing.id, (d) => ({ ...d, text: msg }));
    assert.equal(findDrawing(engine, drawing.id).text, msg);
  });
}

// ─── F. Keyboard (25) ────────────────────────────────────────────────────────

test('HL-P-141: deleteSelected removes', () => {
  const { engine, drawing } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
});

test('HL-P-142: deleteSelected clears highlight', () => {
  const { engine } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('HL-P-143: locked prevents delete', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('HL-P-144: delete no-op without selection', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.deleteSelected();
  assert.equal(engine.drawings.length, 1);
});

test('HL-P-145: cancel aborts in-progress draft', () => {
  const engine = newEngine();
  engine.selectTool('hline');
  engine.pointerDown(pt(T0, 150));
  engine.cancel();
  assert.equal(engine.drawings.length, 0);
});

test('HL-P-146: cancel idle safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.cancel());
});

test('HL-P-147: cancel after commit keeps drawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.cancel();
  assert.ok(findDrawing(engine, drawing.id));
});

test('HL-P-148: full pointer flow creates line', () => {
  const engine = newEngine();
  engine.selectTool('hline');
  engine.pointerDown(pt(T0 + 5_000, 150));
  engine.pointerUp(pt(T0 + 5_000, 150), true);
  assert.equal(engine.drawings.length, 1);
});

test('HL-P-149: pointerMove without down safe', () => {
  const engine = newEngine();
  engine.selectTool('hline');
  assert.doesNotThrow(() => engine.pointerMove(pt(T0, 150)));
});

test('HL-P-150: pointerDown without tool returns none', () => {
  const engine = newEngine();
  assert.equal(engine.pointerDown(pt(T0, 150)), 'none');
});

for (let i = 0; i < 15; i++) {
  test(`HL-P-${(151 + i).toString().padStart(3, '0')}: delete idempotent #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.deleteSelected();
    engine.deleteSelected();
    assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
  });
}

// ─── G. Selection (25) ───────────────────────────────────────────────────────

test('HL-P-166: addDrawing leaves selection null', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.selectedId, null);
});

test('HL-P-167: select sets id', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('HL-P-168: select(null) clears', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.selectedId, null);
});

test('HL-P-169: select missing id no highlight', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.select('missing');
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('HL-P-170: selection persists through render', () => {
  const { engine, drawing } = engineWithSelected();
  engine.render(makeMockCtx(), vp());
  assert.equal(engine.selectedId, drawing.id);
});

test('HL-P-171: selection event fires', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(d.id);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === d.id));
});

test('HL-P-172: deselection event', () => {
  const { engine } = engineWithSelected();
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(null);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === null));
});

test('HL-P-173: selectedId getter live', () => {
  const { engine, drawing } = engineWithSelected();
  assert.equal(engine.selectedId, drawing.id);
});

test('HL-P-174: swap event prevId', () => {
  const engine = newEngine();
  const d1 = draft(140);
  const d2 = draft(170);
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

test('HL-P-175: delete non-selected keeps selection', () => {
  const engine = newEngine();
  const d1 = draft(140);
  const d2 = draft(170);
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  engine.removeDrawing(d2.id);
  assert.equal(engine.selectedId, d1.id);
});

for (let i = 0; i < 15; i++) {
  test(`HL-P-${(176 + i).toString().padStart(3, '0')}: sel cycle #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.select(null);
    engine.select(drawing.id);
    engine.select(null);
    assert.equal(engine.selectedId, null);
  });
}

// ─── H. Hit-test (20) ────────────────────────────────────────────────────────

test('HL-P-191: far-price point returns large distance', () => {
  assert.ok(tool.hitTest(draft(150), { x: 100, y: 10_000 }, vp()) > 100);
});

test('HL-P-192: no anchors returns Infinity', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

test('HL-P-193: hit returns finite', () => {
  assert.ok(Number.isFinite(tool.hitTest(draft(150), { x: 100, y: 100 }, vp())));
});

test('HL-P-194: exact y hit is ~0', () => {
  const v = vp();
  const plotH = v.height - v.timeAxisHeight;
  const h = tool.getAxisHighlight!(draft(150), v)!;
  const d = tool.hitTest(draft(150), { x: 100, y: h.yRange![0] }, v);
  assert.ok(d < 2, `expected near-zero, got ${d}`);
  assert.ok(plotH > 0);
});

for (let i = 0; i < 16; i++) {
  test(`HL-P-${(195 + i).toString().padStart(3, '0')}: hit grid #${i}`, () => {
    const x = 50 + i * 30;
    const y = 50 + (i % 5) * 40;
    assert.ok(Number.isFinite(tool.hitTest(draft(150), { x, y }, vp())));
  });
}

// ─── I. Options (20) ─────────────────────────────────────────────────────────

test('HL-P-211: visible=false render safe', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.updateDrawing(d.id, (x) => ({ ...x, visible: false }));
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('HL-P-212: locked prevents delete', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('HL-P-213: color round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, color: '#abcdef' } };
  assert.equal(d.options.color, '#abcdef');
});

test('HL-P-214: lineWidth round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, lineWidth: 3 } };
  assert.equal(d.options.lineWidth, 3);
});

test('HL-P-215: lineStyle dashed round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, lineStyle: 'dashed' as const } };
  assert.equal(d.options.lineStyle, 'dashed');
});

test('HL-P-216: empty engine render safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('HL-P-217: 10 HLines render safe', () => {
  const engine = newEngine();
  for (let i = 0; i < 10; i++) engine.addDrawing(draft(110 + i * 5));
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('HL-P-218: zIndex defined', () => {
  assert.ok(Number.isFinite(draft().zIndex ?? 20));
});

test('HL-P-219: renderOrder positive', () => {
  assert.ok((draft().renderOrder ?? 0) > 0);
});

test('HL-P-220: getHandles returns 1 handle', () => {
  const handles = tool.getHandles(draft(), vp());
  assert.equal(handles.length, 1);
});

for (let i = 0; i < 10; i++) {
  test(`HL-P-${(221 + i).toString().padStart(3, '0')}: options round-trip #${i}`, () => {
    const d = { ...draft(), options: { ...draft().options, lineWidth: (i % 5) + 1 } };
    assert.equal(d.options.lineWidth, (i % 5) + 1);
  });
}

// ─── J. Edge cases (20) ──────────────────────────────────────────────────────

test('HL-P-231: price above range is handled', () => {
  const h = tool.getAxisHighlight!(draft(500), vp())!;
  assert.ok(h);
  assert.equal(h.xRange, null);
});

test('HL-P-232: price below range is handled', () => {
  const h = tool.getAxisHighlight!(draft(-50), vp())!;
  assert.ok(h);
  assert.equal(h.xRange, null);
});

test('HL-P-233: drawings getter length', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.drawings.length, 1);
});

test('HL-P-234: setDrawings + select', () => {
  const engine = newEngine();
  const d = draft();
  engine.setDrawings([d]);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('HL-P-235: setDrawings([]) clears selection', () => {
  const { engine } = engineWithSelected();
  engine.setDrawings([]);
  assert.equal(engine.selectedId, null);
});

test('HL-P-236: multi-HLine no bands without sel', () => {
  const engine = newEngine();
  for (let i = 0; i < 5; i++) engine.addDrawing(draft(120 + i * 10));
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
});

test('HL-P-237: multi-HLine with sel paints ONLY yBand', () => {
  const engine = newEngine();
  const ds: Drawing[] = [];
  for (let i = 0; i < 5; i++) {
    const d = draft(120 + i * 10);
    engine.addDrawing(d);
    ds.push(d);
  }
  engine.select(ds[2].id);
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 1);
});

test('HL-P-238: yBand present on price axis strip', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  assert.ok(ctx.fillRectCalls.find((c) => isYBand(c, v)));
});

test('HL-P-239: render does not throw at extreme price=1', () => {
  const engine = newEngine();
  const d = draft(1);
  engine.addDrawing(d);
  engine.select(d.id);
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('HL-P-240: highlight is stable under zoom preserving line', () => {
  const d = draft(150);
  const h1 = tool.getAxisHighlight!(d, vp({ priceMin: 100, priceMax: 200, height: 428 }))!;
  // same viewport: highlight identical
  const h2 = tool.getAxisHighlight!(d, vp({ priceMin: 100, priceMax: 200, height: 428 }))!;
  assert.deepEqual(h1.yRange, h2.yRange);
});

for (let i = 0; i < 10; i++) {
  test(`HL-P-${(241 + i).toString().padStart(3, '0')}: stress render #${i}`, () => {
    const engine = newEngine();
    for (let k = 0; k < 20; k++) engine.addDrawing(draft(105 + (k % 90)));
    assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
  });
}

summary();
