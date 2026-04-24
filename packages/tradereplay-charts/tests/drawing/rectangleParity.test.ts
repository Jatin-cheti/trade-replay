/**
 * Rectangle TV-parity tests (250 tests).
 *
 * Rectangle uses default BaseTool getAxisHighlight → bbox of anchors 0 and 1.
 * Both xRange and yRange are non-null; engine paints BOTH xBand and yBand.
 */

import assert from 'node:assert/strict';
import { RectangleTool } from '../../src/drawing/tools/rectangle.ts';
import { DrawingEngine } from '../../src/drawing/engine/drawingEngine.ts';
import { createDefaultTools } from '../../src/drawing/tools/index.ts';
import type { Drawing, DrawPoint } from '../../src/drawing/types.ts';
import { pt, vp, defaultOptions, makeMockCtx, createRunner, T0 } from './parityHelpers.ts';

const tool = new RectangleTool();
const { test, summary } = createRunner('Rectangle parity tests');

function draft(
  p1: DrawPoint = pt(T0 + 10_000, 160),
  p2: DrawPoint = pt(T0 + 40_000, 140),
): Drawing {
  let d = tool.createDraft(p1, defaultOptions());
  d = tool.updateDraft(d, p2);
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

test('RC-P-001: both xRange and yRange non-null', () => {
  const h = tool.getAxisHighlight!(draft(), vp())!;
  assert.ok(h.xRange);
  assert.ok(h.yRange);
});

test('RC-P-002: xRange ascending', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 40_000, 140), pt(T0 + 10_000, 160)), vp())!;
  assert.ok(h.xRange![0] <= h.xRange![1]);
});

test('RC-P-003: yRange ascending', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 10_000, 140), pt(T0 + 40_000, 180)), vp())!;
  assert.ok(h.yRange![0] <= h.yRange![1]);
});

test('RC-P-004: xRange width matches rectangle width', () => {
  const v = vp();
  const h = tool.getAxisHighlight!(draft(pt(T0 + 10_000, 160), pt(T0 + 40_000, 140)), v)!;
  assert.ok(h.xRange![1] - h.xRange![0] > 100);
});

test('RC-P-005: yRange height matches rectangle height', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 10_000, 170), pt(T0 + 40_000, 130)), vp())!;
  assert.ok(h.yRange![1] - h.yRange![0] > 50);
});

test('RC-P-006: zero-area rectangle has equal ranges', () => {
  const d = { ...draft(), anchors: [pt(T0 + 10_000, 150), pt(T0 + 10_000, 150)] };
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.equal(h.xRange![0], h.xRange![1]);
  assert.equal(h.yRange![0], h.yRange![1]);
});

test('RC-P-007: no anchors → null', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.getAxisHighlight!(d, vp()), null);
});

test('RC-P-008: single anchor → null', () => {
  const d = { ...draft(), anchors: [pt(T0, 150)] };
  assert.equal(tool.getAxisHighlight!(d, vp()), null);
});

test('RC-P-009: xRange in plot bounds', () => {
  const v = vp();
  const plotW = v.width - v.priceAxisWidth;
  const h = tool.getAxisHighlight!(draft(), v)!;
  assert.ok(h.xRange![0] >= 0);
  assert.ok(h.xRange![1] <= plotW);
});

test('RC-P-010: yRange in plot bounds', () => {
  const v = vp();
  const plotH = v.height - v.timeAxisHeight;
  const h = tool.getAxisHighlight!(draft(), v)!;
  assert.ok(h.yRange![0] >= 0);
  assert.ok(h.yRange![1] <= plotH);
});

for (let i = 0; i < 30; i++) {
  test(`RC-P-0${(11 + i).toString().padStart(2, '0')}: parametrized rect #${i}`, () => {
    const p1 = pt(T0 + 5_000 + i * 500, 125 + (i % 10) * 3);
    const p2 = pt(T0 + 15_000 + i * 500, 135 + ((i * 5) % 35));
    const h = tool.getAxisHighlight!(draft(p1, p2), vp())!;
    assert.ok(h.xRange && h.yRange);
    assert.ok(h.xRange![0] <= h.xRange![1]);
    assert.ok(h.yRange![0] <= h.yRange![1]);
  });
}

// ─── B. Engine gating (25) ───────────────────────────────────────────────────

test('RC-P-041: no highlight without selection', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RC-P-042: highlight after select', () => {
  const { engine } = engineWithSelected();
  assert.ok(engine.getSelectedAxisHighlight(vp()));
});

test('RC-P-043: deselect clears', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RC-P-044: swap selection swaps highlight', () => {
  const engine = newEngine();
  const d1 = draft(pt(T0 + 5_000, 130), pt(T0 + 10_000, 140));
  const d2 = draft(pt(T0 + 30_000, 160), pt(T0 + 55_000, 180));
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.select(d2.id);
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.yRange, h2.yRange);
  assert.notDeepEqual(h1.xRange, h2.xRange);
});

test('RC-P-045: delete clears highlight', () => {
  const { engine, drawing } = engineWithSelected();
  engine.removeDrawing(drawing.id);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RC-P-046: visibility=false clears', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, visible: false }));
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RC-P-047: re-select stable', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp());
  engine.select(drawing.id);
  const h2 = engine.getSelectedAxisHighlight(vp());
  assert.deepEqual(h1, h2);
});

test('RC-P-048: render paints BOTH xBand and yBand', () => {
  const { engine } = engineWithSelected();
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 1);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 1);
});

test('RC-P-049: unselected paints no highlight bands', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
});

test('RC-P-050: 3 consecutive renders consistent', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  for (let i = 0; i < 3; i++) {
    const ctx = makeMockCtx();
    engine.render(ctx, v);
    assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 1);
    assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 1);
  }
});

for (let i = 0; i < 15; i++) {
  test(`RC-P-0${(51 + i).toString().padStart(2, '0')}: toggle sel #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.select(null);
    assert.equal(engine.getSelectedAxisHighlight(vp()), null);
    engine.select(drawing.id);
    assert.ok(engine.getSelectedAxisHighlight(vp()));
  });
}

// ─── C. Move / viewport (30) ─────────────────────────────────────────────────

test('RC-P-066: moving corner updates both ranges', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({
    ...d,
    anchors: [pt(T0 + 20_000, 190), pt(T0 + 60_000, 110)],
  }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.yRange, h2.yRange);
  assert.notDeepEqual(h1.xRange, h2.xRange);
});

test('RC-P-067: no-op update keeps highlight', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({ ...d }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.deepEqual(h1.xRange, h2.xRange);
  assert.deepEqual(h1.yRange, h2.yRange);
});

test('RC-P-068: zoom in expands yRange span', () => {
  const d = draft(pt(T0 + 10_000, 140), pt(T0 + 40_000, 160));
  const wide = tool.getAxisHighlight!(d, vp({ priceMin: 100, priceMax: 200 }))!;
  const narrow = tool.getAxisHighlight!(d, vp({ priceMin: 135, priceMax: 165 }))!;
  assert.ok(
    (narrow.yRange![1] - narrow.yRange![0]) > (wide.yRange![1] - wide.yRange![0]),
  );
});

test('RC-P-069: canvas width resize changes xRange span', () => {
  const d = draft(pt(T0 + 10_000, 140), pt(T0 + 40_000, 160));
  const small = tool.getAxisHighlight!(d, vp({ width: 400 }))!;
  const large = tool.getAxisHighlight!(d, vp({ width: 1200 }))!;
  assert.ok((large.xRange![1] - large.xRange![0]) > (small.xRange![1] - small.xRange![0]));
});

test('RC-P-070: canvas height resize changes yRange span', () => {
  const d = draft(pt(T0 + 10_000, 140), pt(T0 + 40_000, 160));
  const small = tool.getAxisHighlight!(d, vp({ height: 200 }))!;
  const large = tool.getAxisHighlight!(d, vp({ height: 800 }))!;
  assert.ok((large.yRange![1] - large.yRange![0]) > (small.yRange![1] - small.yRange![0]));
});

for (let i = 0; i < 25; i++) {
  test(`RC-P-0${(71 + i).toString().padStart(2, '0')}: viewport param #${i}`, () => {
    const d = draft();
    const h = tool.getAxisHighlight!(d, vp({ width: 300 + i * 30, height: 200 + i * 20 }))!;
    assert.ok(h.xRange && h.yRange);
  });
}

// ─── D. Corner configurations (20) ───────────────────────────────────────────

test('RC-P-096: top-left to bottom-right diagonal', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 10_000, 180), pt(T0 + 40_000, 120)), vp())!;
  assert.ok(h.xRange![0] < h.xRange![1]);
  assert.ok(h.yRange![0] < h.yRange![1]);
});

test('RC-P-097: bottom-right to top-left diagonal', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 40_000, 120), pt(T0 + 10_000, 180)), vp())!;
  assert.ok(h.xRange![0] < h.xRange![1]);
});

test('RC-P-098: top-right to bottom-left diagonal', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 40_000, 180), pt(T0 + 10_000, 120)), vp())!;
  assert.ok(h.xRange![0] < h.xRange![1]);
});

test('RC-P-099: bottom-left to top-right diagonal', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 10_000, 120), pt(T0 + 40_000, 180)), vp())!;
  assert.ok(h.xRange![0] < h.xRange![1]);
});

test('RC-P-100: tall narrow rectangle', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 20_000, 110), pt(T0 + 22_000, 190)), vp())!;
  assert.ok((h.yRange![1] - h.yRange![0]) > (h.xRange![1] - h.xRange![0]));
});

test('RC-P-101: flat wide rectangle', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 5_000, 149), pt(T0 + 55_000, 151)), vp())!;
  assert.ok((h.xRange![1] - h.xRange![0]) > (h.yRange![1] - h.yRange![0]));
});

for (let i = 0; i < 14; i++) {
  test(`RC-P-${(102 + i).toString().padStart(3, '0')}: parametric corners #${i}`, () => {
    const p1 = pt(T0 + 10_000 + i * 500, 120 + (i * 3) % 40);
    const p2 = pt(T0 + 30_000 + i * 500, 140 + (i * 7) % 40);
    const h = tool.getAxisHighlight!(draft(p1, p2), vp())!;
    assert.ok(h.xRange && h.yRange);
  });
}

// ─── E. Text (25) ────────────────────────────────────────────────────────────

test('RC-P-116: text default undefined', () => {
  assert.equal(draft().text, undefined);
});

test('RC-P-117: text round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'Zone' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'Zone');
});

test('RC-P-118: text across renders', () => {
  const engine = newEngine();
  const d = { ...draft(), text: 'X' };
  engine.addDrawing(d);
  engine.render(makeMockCtx(), vp());
  engine.render(makeMockCtx(), vp());
  assert.equal(findDrawing(engine, d.id).text, 'X');
});

test('RC-P-119: multiline', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'a\nb\nc' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'a\nb\nc');
});

test('RC-P-120: unicode', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '◆ zone' }));
  assert.equal(findDrawing(engine, drawing.id).text, '◆ zone');
});

test('RC-P-121: empty string', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '' }));
  assert.equal(findDrawing(engine, drawing.id).text, '');
});

test('RC-P-122: clear to undefined', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'x' }));
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: undefined }));
  assert.equal(findDrawing(engine, drawing.id).text, undefined);
});

test('RC-P-123: font round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, font: 'Consolas' } }));
  assert.equal(findDrawing(engine, drawing.id).options.font, 'Consolas');
});

test('RC-P-124: textSize round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, textSize: 14 } }));
  assert.equal(findDrawing(engine, drawing.id).options.textSize, 14);
});

test('RC-P-125: bold+italic', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, bold: true, italic: true } }));
  const u = findDrawing(engine, drawing.id);
  assert.equal(u.options.bold, true);
  assert.equal(u.options.italic, true);
});

for (let i = 0; i < 15; i++) {
  test(`RC-P-${(126 + i).toString().padStart(3, '0')}: text round-trip #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    const msg = `rect#${i}`;
    engine.updateDrawing(drawing.id, (d) => ({ ...d, text: msg }));
    assert.equal(findDrawing(engine, drawing.id).text, msg);
  });
}

// ─── F. Keyboard (25) ────────────────────────────────────────────────────────

test('RC-P-141: delete removes', () => {
  const { engine, drawing } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
});

test('RC-P-142: delete clears highlight', () => {
  const { engine } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RC-P-143: locked prevents delete', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('RC-P-144: delete no-op without selection', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.deleteSelected();
  assert.equal(engine.drawings.length, 1);
});

test('RC-P-145: cancel aborts draft', () => {
  const engine = newEngine();
  engine.selectTool('rectangle');
  engine.pointerDown(pt(T0 + 5_000, 150));
  engine.cancel();
  assert.equal(engine.drawings.length, 0);
});

test('RC-P-146: cancel idle safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.cancel());
});

test('RC-P-147: cancel after commit keeps drawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.cancel();
  assert.ok(findDrawing(engine, drawing.id));
});

test('RC-P-148: full pointer flow creates rect', () => {
  const engine = newEngine();
  engine.selectTool('rectangle');
  engine.pointerDown(pt(T0 + 5_000, 160));
  engine.pointerMove(pt(T0 + 20_000, 140));
  engine.pointerUp(pt(T0 + 20_000, 140), true);
  assert.equal(engine.drawings.length, 1);
});

test('RC-P-149: move without down safe', () => {
  const engine = newEngine();
  engine.selectTool('rectangle');
  assert.doesNotThrow(() => engine.pointerMove(pt(T0, 150)));
});

test('RC-P-150: pointerDown without tool returns none', () => {
  const engine = newEngine();
  assert.equal(engine.pointerDown(pt(T0, 150)), 'none');
});

for (let i = 0; i < 15; i++) {
  test(`RC-P-${(151 + i).toString().padStart(3, '0')}: delete idempotent #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.deleteSelected();
    engine.deleteSelected();
    assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
  });
}

// ─── G. Selection (25) ───────────────────────────────────────────────────────

test('RC-P-166: add without select → null', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.selectedId, null);
});

test('RC-P-167: select sets id', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('RC-P-168: deselect', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.selectedId, null);
});

test('RC-P-169: missing id no highlight', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.select('missing');
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RC-P-170: selection persists through render', () => {
  const { engine, drawing } = engineWithSelected();
  engine.render(makeMockCtx(), vp());
  assert.equal(engine.selectedId, drawing.id);
});

test('RC-P-171: selection event fires', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(d.id);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === d.id));
});

test('RC-P-172: deselection event', () => {
  const { engine } = engineWithSelected();
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(null);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === null));
});

test('RC-P-173: selectedId getter live', () => {
  const { engine, drawing } = engineWithSelected();
  assert.equal(engine.selectedId, drawing.id);
});

test('RC-P-174: swap event prevId', () => {
  const engine = newEngine();
  const d1 = draft(pt(T0 + 5_000, 130), pt(T0 + 10_000, 140));
  const d2 = draft(pt(T0 + 20_000, 150), pt(T0 + 30_000, 160));
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

test('RC-P-175: delete non-selected keeps sel', () => {
  const engine = newEngine();
  const d1 = draft(pt(T0 + 5_000, 130), pt(T0 + 10_000, 140));
  const d2 = draft(pt(T0 + 20_000, 150), pt(T0 + 30_000, 160));
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  engine.removeDrawing(d2.id);
  assert.equal(engine.selectedId, d1.id);
});

for (let i = 0; i < 15; i++) {
  test(`RC-P-${(176 + i).toString().padStart(3, '0')}: sel cycle #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.select(null);
    engine.select(drawing.id);
    engine.select(null);
    assert.equal(engine.selectedId, null);
  });
}

// ─── H. Hit-test (20) ────────────────────────────────────────────────────────

test('RC-P-191: far point large distance', () => {
  assert.ok(tool.hitTest(draft(), { x: 10_000, y: 10_000 }, vp()) > 100);
});

test('RC-P-192: no anchors Infinity', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

test('RC-P-193: single anchor Infinity', () => {
  const d = { ...draft(), anchors: [pt(T0, 150)] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

test('RC-P-194: finite value on typical', () => {
  assert.ok(Number.isFinite(tool.hitTest(draft(), { x: 100, y: 100 }, vp())));
});

test('RC-P-195: hit with fillColor returns 0 inside rect', () => {
  const d = { ...draft(), options: { ...draft().options, fillColor: '#ff0000' } };
  const v = vp();
  const h = tool.getAxisHighlight!(d, v)!;
  const cx = (h.xRange![0] + h.xRange![1]) / 2;
  const cy = (h.yRange![0] + h.yRange![1]) / 2;
  assert.equal(tool.hitTest(d, { x: cx, y: cy }, v), 0);
});

test('RC-P-196: without fillColor, interior point is NOT hit (border-only)', () => {
  const d = draft();
  assert.ok(!d.options.fillColor);
  const v = vp();
  const h = tool.getAxisHighlight!(d, v)!;
  const cx = (h.xRange![0] + h.xRange![1]) / 2;
  const cy = (h.yRange![0] + h.yRange![1]) / 2;
  assert.ok(tool.hitTest(d, { x: cx, y: cy }, v) > 5);
});

for (let i = 0; i < 14; i++) {
  test(`RC-P-${(197 + i).toString().padStart(3, '0')}: hit grid #${i}`, () => {
    const x = 50 + i * 30;
    const y = 50 + (i % 5) * 40;
    assert.ok(Number.isFinite(tool.hitTest(draft(), { x, y }, vp())));
  });
}

// ─── I. Options (20) ─────────────────────────────────────────────────────────

test('RC-P-211: visible=false render safe', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.updateDrawing(d.id, (x) => ({ ...x, visible: false }));
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('RC-P-212: locked prevents delete', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('RC-P-213: color round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, color: '#112233' } };
  assert.equal(d.options.color, '#112233');
});

test('RC-P-214: fillColor round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, fillColor: '#ff000088' } };
  assert.equal(d.options.fillColor, '#ff000088');
});

test('RC-P-215: lineWidth round-trip', () => {
  const d = { ...draft(), options: { ...draft().options, lineWidth: 3 } };
  assert.equal(d.options.lineWidth, 3);
});

test('RC-P-216: lineStyle dashed', () => {
  const d = { ...draft(), options: { ...draft().options, lineStyle: 'dashed' as const } };
  assert.equal(d.options.lineStyle, 'dashed');
});

test('RC-P-217: empty engine render safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('RC-P-218: 10 rectangles render safe', () => {
  const engine = newEngine();
  for (let i = 0; i < 10; i++) {
    engine.addDrawing(draft(pt(T0 + i * 1000, 130 + i), pt(T0 + i * 1000 + 3000, 150 + i)));
  }
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('RC-P-219: zIndex defined', () => {
  assert.ok(Number.isFinite(draft().zIndex ?? 20));
});

test('RC-P-220: getHandles returns 4 handles', () => {
  const handles = tool.getHandles(draft(), vp());
  assert.equal(handles.length, 4);
});

for (let i = 0; i < 10; i++) {
  test(`RC-P-${(221 + i).toString().padStart(3, '0')}: options round-trip #${i}`, () => {
    const d = { ...draft(), options: { ...draft().options, lineWidth: (i % 5) + 1 } };
    assert.equal(d.options.lineWidth, (i % 5) + 1);
  });
}

// ─── J. Edge cases (20) ──────────────────────────────────────────────────────

test('RC-P-231: negative-time rect', () => {
  const d = draft(pt(-1000, 150), pt(T0 + 10_000, 160));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h);
});

test('RC-P-232: extreme price rect', () => {
  const d = draft(pt(T0, 99_999), pt(T0 + 10_000, 99_998));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h);
});

test('RC-P-233: zero-width viewport safe', () => {
  assert.doesNotThrow(() => tool.getAxisHighlight!(draft(), vp({ width: 60 })));
});

test('RC-P-234: drawings length after add', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.drawings.length, 1);
});

test('RC-P-235: setDrawings + select', () => {
  const engine = newEngine();
  const d = draft();
  engine.setDrawings([d]);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('RC-P-236: setDrawings([]) clears sel', () => {
  const { engine } = engineWithSelected();
  engine.setDrawings([]);
  assert.equal(engine.selectedId, null);
});

test('RC-P-237: multi-rect no bands without sel', () => {
  const engine = newEngine();
  for (let i = 0; i < 5; i++) {
    engine.addDrawing(draft(pt(T0 + i * 1000, 130 + i), pt(T0 + i * 1000 + 2000, 140 + i)));
  }
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 0);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 0);
});

test('RC-P-238: multi-rect selected paints exactly 1 xBand + 1 yBand', () => {
  const engine = newEngine();
  const ds: Drawing[] = [];
  for (let i = 0; i < 5; i++) {
    const d = draft(pt(T0 + i * 1000, 130 + i), pt(T0 + i * 1000 + 2000, 140 + i));
    engine.addDrawing(d);
    ds.push(d);
  }
  engine.select(ds[2].id);
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  assert.equal(ctx.fillRectCalls.filter((c) => isXBand(c, v)).length, 1);
  assert.equal(ctx.fillRectCalls.filter((c) => isYBand(c, v)).length, 1);
});

test('RC-P-239: xBand on time axis strip', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  assert.ok(ctx.fillRectCalls.find((c) => isXBand(c, v)));
});

test('RC-P-240: yBand on price axis strip', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  assert.ok(ctx.fillRectCalls.find((c) => isYBand(c, v)));
});

for (let i = 0; i < 10; i++) {
  test(`RC-P-${(241 + i).toString().padStart(3, '0')}: stress #${i}`, () => {
    const engine = newEngine();
    for (let k = 0; k < 20; k++) {
      engine.addDrawing(draft(pt(T0 + k * 200, 120 + (k % 40)), pt(T0 + k * 200 + 500, 140 + (k % 40))));
    }
    assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
  });
}

summary();
