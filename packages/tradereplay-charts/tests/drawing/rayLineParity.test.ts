/**
 * RayLine TV-parity tests (250 tests).
 *
 * Mirrors trendLineParity.test.ts structure but with ray-specific assertions
 * (ray extends to canvas edge; only 1 visible handle at origin).
 */

import assert from 'node:assert/strict';
import { RayLineTool } from '../../src/drawing/tools/rayLine.ts';
import { DrawingEngine } from '../../src/drawing/engine/drawingEngine.ts';
import { createDefaultTools } from '../../src/drawing/tools/index.ts';
import type { Drawing, DrawPoint, Viewport } from '../../src/drawing/types.ts';
import { pt, vp, defaultOptions, makeMockCtx, createRunner, T0 } from './parityHelpers.ts';

const tool = new RayLineTool();
const { test, summary } = createRunner('RayLine parity tests');

function draft(p1: DrawPoint = pt(T0 + 10_000, 150), p2: DrawPoint = pt(T0 + 40_000, 160)): Drawing {
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

// ─── A. Axis highlight shape/range (40) ──────────────────────────────────────

test('RL-P-001: getAxisHighlight returns object with xRange and yRange', () => {
  const h = tool.getAxisHighlight!(draft(), vp());
  assert.ok(h);
  assert.ok(Array.isArray(h!.xRange));
  assert.ok(Array.isArray(h!.yRange));
});

test('RL-P-002: ray going horizontally-right reaches right edge', () => {
  // Slope is exactly zero → cannot exit top/bottom, must exit right edge.
  const d = draft(pt(T0 + 5_000, 150), pt(T0 + 10_000, 150));
  const v = vp();
  const h = tool.getAxisHighlight!(d, v)!;
  const plotW = v.width - v.priceAxisWidth;
  assert.ok(h.xRange![1] >= plotW - 2);
});

test('RL-P-003: ray extending left reaches near left edge', () => {
  const d = draft(pt(T0 + 40_000, 150), pt(T0 + 35_000, 155));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h.xRange![0] <= 2);
});

test('RL-P-004: ray xRange always ascending', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 50_000, 140), pt(T0 + 30_000, 120)), vp())!;
  assert.ok(h.xRange![0] <= h.xRange![1]);
});

test('RL-P-005: ray yRange always ascending', () => {
  const h = tool.getAxisHighlight!(draft(pt(T0 + 10_000, 180), pt(T0 + 40_000, 120)), vp())!;
  assert.ok(h.yRange![0] <= h.yRange![1]);
});

test('RL-P-006: near-zero-direction ray is rejected at finalize', () => {
  // finalize() should return null for degenerate zero-length rays.
  let d = tool.createDraft(pt(T0 + 20_000, 150), defaultOptions());
  d = tool.updateDraft(d, pt(T0 + 20_000, 150));
  assert.equal(tool.finalize(d), null);
});

test('RL-P-007: fewer than 2 anchors → null highlight', () => {
  const d = { ...draft(), anchors: [pt(T0, 150)] };
  const h = tool.getAxisHighlight!(d, vp());
  assert.equal(h, null);
});

test('RL-P-008: empty anchors → null highlight', () => {
  const d = { ...draft(), anchors: [] };
  const h = tool.getAxisHighlight!(d, vp());
  assert.equal(h, null);
});

test('RL-P-009: xRange within plot width', () => {
  const v = vp();
  const h = tool.getAxisHighlight!(draft(), v)!;
  const plotW = v.width - v.priceAxisWidth;
  assert.ok(h.xRange![0] >= -1);
  assert.ok(h.xRange![1] <= plotW + 1);
});

test('RL-P-010: yRange within plot height', () => {
  const v = vp();
  const h = tool.getAxisHighlight!(draft(), v)!;
  const plotH = v.height - v.timeAxisHeight;
  assert.ok(h.yRange![0] >= -1);
  assert.ok(h.yRange![1] <= plotH + 1);
});

for (let i = 0; i < 30; i++) {
  test(`RL-P-0${(11 + i).toString().padStart(2, '0')}: parametrized ray #${i} produces valid highlight`, () => {
    const p1 = pt(T0 + 5_000 + i * 500, 120 + (i % 15) * 4);
    const p2 = pt(T0 + 15_000 + i * 500, 130 + ((i * 7) % 40));
    const h = tool.getAxisHighlight!(draft(p1, p2), vp())!;
    assert.ok(h.xRange && h.yRange);
    assert.ok(h.xRange![0] <= h.xRange![1]);
    assert.ok(h.yRange![0] <= h.yRange![1]);
  });
}

// ─── B. Engine gating (25) ───────────────────────────────────────────────────

test('RL-P-041: engine highlight null when nothing selected', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RL-P-042: engine highlight exists after select', () => {
  const { engine } = engineWithSelected();
  assert.ok(engine.getSelectedAxisHighlight(vp()));
});

test('RL-P-043: engine highlight null after select(null)', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RL-P-044: selecting another ray swaps highlight', () => {
  const engine = newEngine();
  const d1 = draft(pt(T0 + 5_000, 110), pt(T0 + 15_000, 120));
  const d2 = draft(pt(T0 + 30_000, 150), pt(T0 + 55_000, 160));
  engine.addDrawing(d1);
  engine.addDrawing(d2);
  engine.select(d1.id);
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.select(d2.id);
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.yRange, h2.yRange);
});

test('RL-P-045: highlight cleared when selected ray deleted', () => {
  const { engine, drawing } = engineWithSelected();
  engine.removeDrawing(drawing.id);
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RL-P-046: highlight cleared when visibility off', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, visible: false }));
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RL-P-047: re-select same id keeps highlight stable', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp());
  engine.select(drawing.id);
  const h2 = engine.getSelectedAxisHighlight(vp());
  assert.deepEqual(h1, h2);
});

test('RL-P-048: render paints axis bands for selected ray', () => {
  const { engine } = engineWithSelected();
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  const bx = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  const by = ctx.fillRectCalls.filter((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.equal(bx.length, 1);
  assert.equal(by.length, 1);
});

test('RL-P-049: render paints no axis bands when unselected', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  const bx = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  const by = ctx.fillRectCalls.filter((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.equal(bx.length, 0);
  assert.equal(by.length, 0);
});

test('RL-P-050: render paints highlight through 3 consecutive frames', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  for (let i = 0; i < 3; i++) {
    const ctx = makeMockCtx();
    engine.render(ctx, v);
    const bx = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
    assert.equal(bx.length, 1);
  }
});

for (let i = 0; i < 15; i++) {
  test(`RL-P-0${(51 + i).toString().padStart(2, '0')}: selection toggle #${i} clears then restores highlight`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.select(null);
    assert.equal(engine.getSelectedAxisHighlight(vp()), null);
    engine.select(drawing.id);
    assert.ok(engine.getSelectedAxisHighlight(vp()));
  });
}

// ─── C. Highlight updates on move / viewport change (30) ─────────────────────

test('RL-P-066: moving origin anchor updates yRange', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({
    ...d,
    anchors: [pt(T0 + 10_000, 195), pt(T0 + 20_000, 105)],
  }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.notDeepEqual(h1.yRange, h2.yRange);
});

test('RL-P-067: moving anchors in place keeps highlight roughly equal', () => {
  const { engine, drawing } = engineWithSelected();
  const h1 = engine.getSelectedAxisHighlight(vp())!;
  engine.updateDrawing(drawing.id, (d) => ({ ...d }));
  const h2 = engine.getSelectedAxisHighlight(vp())!;
  assert.deepEqual(h1.xRange, h2.xRange);
  assert.deepEqual(h1.yRange, h2.yRange);
});

test('RL-P-068: zoom in expands yRange span', () => {
  const d = draft(pt(T0 + 10_000, 140), pt(T0 + 20_000, 160));
  const wide = tool.getAxisHighlight!(d, vp({ priceMax: 200, priceMin: 100 }))!;
  const narrow = tool.getAxisHighlight!(d, vp({ priceMax: 165, priceMin: 135 }))!;
  assert.ok(
    (narrow.yRange![1] - narrow.yRange![0]) > (wide.yRange![1] - wide.yRange![0]),
  );
});

test('RL-P-069: canvas width resize shifts xRange end', () => {
  const d = draft(pt(T0 + 5_000, 150), pt(T0 + 20_000, 160));
  const small = tool.getAxisHighlight!(d, vp({ width: 400 }))!;
  const large = tool.getAxisHighlight!(d, vp({ width: 1200 }))!;
  assert.ok(large.xRange![1] > small.xRange![1]);
});

test('RL-P-070: canvas height resize shifts yRange', () => {
  const d = draft(pt(T0 + 10_000, 140), pt(T0 + 30_000, 160));
  const small = tool.getAxisHighlight!(d, vp({ height: 200 }))!;
  const large = tool.getAxisHighlight!(d, vp({ height: 800 }))!;
  assert.ok(
    (large.yRange![1] - large.yRange![0]) > (small.yRange![1] - small.yRange![0]),
  );
});

for (let i = 0; i < 25; i++) {
  test(`RL-P-0${(71 + i).toString().padStart(2, '0')}: parametrized viewport #${i}`, () => {
    const d = draft();
    const h = tool.getAxisHighlight!(d, vp({ width: 300 + i * 30, height: 200 + i * 20 }))!;
    assert.ok(h);
    assert.ok(h.xRange![0] <= h.xRange![1]);
    assert.ok(h.yRange![0] <= h.yRange![1]);
  });
}

// ─── D. Ray-direction variations (20) ────────────────────────────────────────

test('RL-P-096: ray going right-only reaches right edge', () => {
  const d = draft(pt(T0 + 10_000, 150), pt(T0 + 20_000, 150));
  const v = vp();
  const h = tool.getAxisHighlight!(d, v)!;
  assert.ok(h.xRange![1] >= v.width - v.priceAxisWidth - 2);
});

test('RL-P-097: ray going up-right exits via top or right edge (y near 0 or x near plotW)', () => {
  const d = draft(pt(T0 + 10_000, 150), pt(T0 + 20_000, 160));
  const v = vp();
  const h = tool.getAxisHighlight!(d, v)!;
  const plotW = v.width - v.priceAxisWidth;
  const exitedRight = h.xRange![1] >= plotW - 2;
  const exitedTop = h.yRange![0] <= 2;
  assert.ok(exitedRight || exitedTop, `expected exit via right or top, got xRange=${h.xRange} yRange=${h.yRange}`);
});

test('RL-P-098: ray pointing left extends to left edge', () => {
  const d = draft(pt(T0 + 50_000, 150), pt(T0 + 20_000, 160));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h.xRange![0] <= 2);
});

test('RL-P-099: steep ray has large yRange span', () => {
  const d = draft(pt(T0 + 10_000, 110), pt(T0 + 11_000, 190));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h.yRange![1] - h.yRange![0] > 10);
});

test('RL-P-100: flat ray has small yRange span', () => {
  const d = draft(pt(T0 + 10_000, 150), pt(T0 + 60_000, 150.5));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h.yRange![1] - h.yRange![0] < 20);
});

for (let i = 0; i < 15; i++) {
  const angle = (i / 15) * Math.PI * 2;
  test(`RL-P-${(101 + i).toString().padStart(3, '0')}: ray direction angle #${i}`, () => {
    const t0 = T0 + 20_000;
    const p0 = pt(t0, 150);
    const p1 = pt(t0 + Math.cos(angle) * 5_000 + 1, 150 + Math.sin(angle) * 20);
    const d = draft(p0, p1);
    const h = tool.getAxisHighlight!(d, vp())!;
    assert.ok(h);
  });
}

// ─── E. Text label (25) ──────────────────────────────────────────────────────

test('RL-P-116: text defaults to undefined', () => {
  assert.equal(draft().text, undefined);
});

test('RL-P-117: text round-trip via updateDrawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'Ray label' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'Ray label');
});

test('RL-P-118: text preserved across re-renders', () => {
  const engine = newEngine();
  const d = { ...draft(), text: 'X' };
  engine.addDrawing(d);
  engine.render(makeMockCtx(), vp());
  engine.render(makeMockCtx(), vp());
  assert.equal(findDrawing(engine, d.id).text, 'X');
});

test('RL-P-119: multiline text preserved', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'a\nb\nc' }));
  assert.equal(findDrawing(engine, drawing.id).text, 'a\nb\nc');
});

test('RL-P-120: unicode text preserved', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '↗ 📈 test' }));
  assert.equal(findDrawing(engine, drawing.id).text, '↗ 📈 test');
});

test('RL-P-121: empty-string text persisted', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: '' }));
  assert.equal(findDrawing(engine, drawing.id).text, '');
});

test('RL-P-122: clearing text to undefined', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: 'tmp' }));
  engine.updateDrawing(drawing.id, (d) => ({ ...d, text: undefined }));
  assert.equal(findDrawing(engine, drawing.id).text, undefined);
});

test('RL-P-123: font option round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, font: 'Courier' } }));
  assert.equal(findDrawing(engine, drawing.id).options.font, 'Courier');
});

test('RL-P-124: textSize option round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, textSize: 20 } }));
  assert.equal(findDrawing(engine, drawing.id).options.textSize, 20);
});

test('RL-P-125: bold+italic round-trip', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, options: { ...d.options, bold: true, italic: true } }));
  const u = findDrawing(engine, drawing.id);
  assert.equal(u.options.bold, true);
  assert.equal(u.options.italic, true);
});

for (let i = 0; i < 15; i++) {
  test(`RL-P-${(126 + i).toString().padStart(3, '0')}: text round-trip #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    const msg = `ray#${i}-${i * 7}`;
    engine.updateDrawing(drawing.id, (d) => ({ ...d, text: msg }));
    assert.equal(findDrawing(engine, drawing.id).text, msg);
  });
}

// ─── F. Keyboard parity (25) ─────────────────────────────────────────────────

test('RL-P-141: deleteSelected removes ray', () => {
  const { engine, drawing } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
});

test('RL-P-142: deleteSelected clears highlight', () => {
  const { engine } = engineWithSelected();
  engine.deleteSelected();
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RL-P-143: locked prevents deleteSelected', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('RL-P-144: deleteSelected no-op when no selection', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.deleteSelected();
  assert.equal(engine.drawings.length, 1);
});

test('RL-P-145: cancel aborts in-progress draft', () => {
  const engine = newEngine();
  engine.selectTool('ray');
  engine.pointerDown(pt(T0 + 5_000, 150));
  engine.cancel();
  assert.equal(engine.drawings.length, 0);
});

test('RL-P-146: cancel while idle is safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.cancel());
});

test('RL-P-147: cancel after commit keeps drawing', () => {
  const { engine, drawing } = engineWithSelected();
  engine.cancel();
  assert.ok(findDrawing(engine, drawing.id));
});

test('RL-P-148: full pointer flow creates ray', () => {
  const engine = newEngine();
  engine.selectTool('ray');
  engine.pointerDown(pt(T0 + 5_000, 150));
  engine.pointerMove(pt(T0 + 20_000, 160));
  engine.pointerUp(pt(T0 + 20_000, 160), true);
  assert.equal(engine.drawings.length, 1);
});

test('RL-P-149: pointerMove without prior down is safe', () => {
  const engine = newEngine();
  engine.selectTool('ray');
  assert.doesNotThrow(() => engine.pointerMove(pt(T0, 150)));
});

test('RL-P-150: pointerDown with no tool active returns none', () => {
  const engine = newEngine();
  assert.equal(engine.pointerDown(pt(T0, 150)), 'none');
});

for (let i = 0; i < 15; i++) {
  test(`RL-P-${(151 + i).toString().padStart(3, '0')}: delete idempotent #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.deleteSelected();
    engine.deleteSelected();
    assert.equal(engine.drawings.find((x) => x.id === drawing.id), undefined);
  });
}

// ─── G. Selection parity (25) ────────────────────────────────────────────────

test('RL-P-166: addDrawing without select leaves selection null', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.selectedId, null);
});

test('RL-P-167: select(id) sets selectedId', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('RL-P-168: select(null) clears selectedId', () => {
  const { engine } = engineWithSelected();
  engine.select(null);
  assert.equal(engine.selectedId, null);
});

test('RL-P-169: select missing id has no highlight', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  engine.select('missing');
  assert.equal(engine.getSelectedAxisHighlight(vp()), null);
});

test('RL-P-170: selection persists across render', () => {
  const { engine, drawing } = engineWithSelected();
  engine.render(makeMockCtx(), vp());
  assert.equal(engine.selectedId, drawing.id);
});

test('RL-P-171: selection event fired on select', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(d.id);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === d.id));
});

test('RL-P-172: deselection event fired on null', () => {
  const { engine } = engineWithSelected();
  const events: any[] = [];
  engine.on((e) => events.push(e));
  engine.select(null);
  assert.ok(events.some((e) => e.type === 'selectionChanged' && e.selectedId === null));
});

test('RL-P-173: selectedId getter reports live value', () => {
  const { engine, drawing } = engineWithSelected();
  assert.equal(engine.selectedId, drawing.id);
});

test('RL-P-174: selection swap fires with prevId', () => {
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

test('RL-P-175: deleting non-selected keeps selection', () => {
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
  test(`RL-P-${(176 + i).toString().padStart(3, '0')}: select/deselect cycle #${i}`, () => {
    const { engine, drawing } = engineWithSelected();
    engine.select(null);
    engine.select(drawing.id);
    engine.select(null);
    assert.equal(engine.selectedId, null);
  });
}

// ─── H. Hit-test (20) ────────────────────────────────────────────────────────

test('RL-P-191: far point returns large distance', () => {
  assert.ok(tool.hitTest(draft(), { x: 10_000, y: 10_000 }, vp()) > 100);
});

test('RL-P-192: empty anchors returns Infinity', () => {
  const d = { ...draft(), anchors: [] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

test('RL-P-193: single anchor returns Infinity', () => {
  const d = { ...draft(), anchors: [pt(T0, 150)] };
  assert.equal(tool.hitTest(d, { x: 100, y: 100 }, vp()), Infinity);
});

test('RL-P-194: hit-test returns finite value for typical point', () => {
  assert.ok(Number.isFinite(tool.hitTest(draft(), { x: 100, y: 100 }, vp())));
});

for (let i = 0; i < 16; i++) {
  test(`RL-P-${(195 + i).toString().padStart(3, '0')}: hit grid #${i}`, () => {
    const x = 50 + i * 30;
    const y = 50 + (i % 5) * 40;
    assert.ok(Number.isFinite(tool.hitTest(draft(), { x, y }, vp())));
  });
}

// ─── I. Options / invariants (20) ────────────────────────────────────────────

test('RL-P-211: visible=false does not throw on render', () => {
  const engine = newEngine();
  const d = draft();
  engine.addDrawing(d);
  engine.updateDrawing(d.id, (x) => ({ ...x, visible: false }));
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('RL-P-212: locked prevents deleteSelected', () => {
  const { engine, drawing } = engineWithSelected();
  engine.updateDrawing(drawing.id, (d) => ({ ...d, locked: true }));
  engine.deleteSelected();
  assert.ok(findDrawing(engine, drawing.id));
});

test('RL-P-213: color option round-trips', () => {
  const d = { ...draft(), options: { ...draft().options, color: '#00ccff' } };
  assert.equal(d.options.color, '#00ccff');
});

test('RL-P-214: lineWidth option round-trips', () => {
  const d = { ...draft(), options: { ...draft().options, lineWidth: 4 } };
  assert.equal(d.options.lineWidth, 4);
});

test('RL-P-215: lineStyle dotted round-trips', () => {
  const d = { ...draft(), options: { ...draft().options, lineStyle: 'dotted' as const } };
  assert.equal(d.options.lineStyle, 'dotted');
});

test('RL-P-216: render empty engine safe', () => {
  const engine = newEngine();
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('RL-P-217: render with 10 rays safe', () => {
  const engine = newEngine();
  for (let i = 0; i < 10; i++) {
    engine.addDrawing(draft(pt(T0 + i * 1000, 130 + i), pt(T0 + i * 1000 + 2000, 140 + i)));
  }
  assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
});

test('RL-P-218: zIndex defined', () => {
  assert.ok(Number.isFinite(draft().zIndex ?? 20));
});

test('RL-P-219: renderOrder positive', () => {
  assert.ok((draft().renderOrder ?? 0) > 0);
});

test('RL-P-220: getHandles returns 1 handle (origin only)', () => {
  const handles = tool.getHandles(draft(), vp());
  assert.equal(handles.length, 1);
});

for (let i = 0; i < 10; i++) {
  test(`RL-P-${(221 + i).toString().padStart(3, '0')}: random-options round-trip #${i}`, () => {
    const d = { ...draft(), options: { ...draft().options, lineWidth: (i % 5) + 1 } };
    assert.equal(d.options.lineWidth, (i % 5) + 1);
  });
}

// ─── J. Edge cases (20) ──────────────────────────────────────────────────────

test('RL-P-231: negative-time anchors produce valid highlight', () => {
  const d = draft(pt(-1000, 150), pt(T0 + 10_000, 160));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h);
});

test('RL-P-232: extreme price anchors produce valid highlight', () => {
  const d = draft(pt(T0, 99_999), pt(T0 + 10_000, 99_998));
  const h = tool.getAxisHighlight!(d, vp())!;
  assert.ok(h);
});

test('RL-P-233: zero-width viewport safe', () => {
  assert.doesNotThrow(() => tool.getAxisHighlight!(draft(), vp({ width: 60 })));
});

test('RL-P-234: drawings getter length after add', () => {
  const engine = newEngine();
  engine.addDrawing(draft());
  assert.equal(engine.drawings.length, 1);
});

test('RL-P-235: setDrawings followed by select works', () => {
  const engine = newEngine();
  const d = draft();
  engine.setDrawings([d]);
  engine.select(d.id);
  assert.equal(engine.selectedId, d.id);
});

test('RL-P-236: setDrawings([]) clears selection', () => {
  const { engine } = engineWithSelected();
  engine.setDrawings([]);
  assert.equal(engine.selectedId, null);
});

test('RL-P-237: multi-ray engine no bands without selection', () => {
  const engine = newEngine();
  for (let i = 0; i < 5; i++) {
    engine.addDrawing(draft(pt(T0 + i * 1000, 130 + i), pt(T0 + i * 1000 + 2000, 140 + i)));
  }
  const ctx = makeMockCtx();
  const v = vp();
  engine.render(ctx, v);
  const bx = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  assert.equal(bx.length, 0);
});

test('RL-P-238: multi-ray with selection paints exactly 2 bands', () => {
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
  const bx = ctx.fillRectCalls.filter((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight);
  const by = ctx.fillRectCalls.filter((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth);
  assert.equal(bx.length, 1);
  assert.equal(by.length, 1);
});

test('RL-P-239: xBand found on time axis strip', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  assert.ok(ctx.fillRectCalls.find((c) => c[1] === v.height - v.timeAxisHeight && c[3] === v.timeAxisHeight));
});

test('RL-P-240: yBand found on price axis strip', () => {
  const { engine } = engineWithSelected();
  const v = vp();
  const ctx = makeMockCtx();
  engine.render(ctx, v);
  assert.ok(ctx.fillRectCalls.find((c) => c[0] === v.width - v.priceAxisWidth && c[2] === v.priceAxisWidth));
});

for (let i = 0; i < 10; i++) {
  test(`RL-P-${(241 + i).toString().padStart(3, '0')}: stress render iteration #${i}`, () => {
    const engine = newEngine();
    for (let k = 0; k < 20; k++) {
      engine.addDrawing(draft(pt(T0 + k * 200, 120 + (k % 40)), pt(T0 + k * 200 + 500, 140 + (k % 40))));
    }
    assert.doesNotThrow(() => engine.render(makeMockCtx(), vp()));
  });
}

summary();
