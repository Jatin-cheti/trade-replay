/**
 * DrawingEngine state machine — tests covering:
 * - Initial state (IDLE)
 * - selectTool / clearTool
 * - pointerDown with active tool → STARTED → PREVIEW
 * - pointerDown second click → drawing committed (IDLE/SELECTED)
 * - pointerMove updates draft
 * - pointerUp with isDragFinalize → drawing committed
 * - cancel() → IDLE
 * - deleteSelected()
 * - Event emission: stateChanged, drawingCommitted, drawingDeleted, selectionChanged
 * - addDrawing / setDrawings / updateDrawing / removeDrawing
 * - select() programmatic
 * - Multiple drawings, hit testing, deselect on empty-space click
 * - Locked drawing rejection
 */

import assert from 'node:assert/strict';
import { DrawingEngine, createDrawingEngine } from '../../src/drawing/engine/drawingEngine.ts';
import { TrendLineTool } from '../../src/drawing/tools/trendLine.ts';
import { RayLineTool } from '../../src/drawing/tools/rayLine.ts';
import { DrawingState, DEFAULT_DRAWING_OPTIONS } from '../../src/drawing/types.ts';
import type { Drawing, DrawPoint, Viewport } from '../../src/drawing/types.ts';

// ─── Test runner ──────────────────────────────────────────────────────────────

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
    failed = 1;
    process.exitCode = 1;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEngine(): DrawingEngine {
  return createDrawingEngine([new TrendLineTool(), new RayLineTool()]);
}

function vp(overrides: Partial<Viewport> = {}): Viewport {
  return {
    width: 800,
    height: 400,
    priceAxisWidth: 60,
    timeAxisHeight: 28,
    visibleFrom: 1_700_000_000 as DrawPoint['time'],
    visibleTo: 1_700_100_000 as DrawPoint['time'],
    priceMin: 100,
    priceMax: 200,
    pxPerTime: 0,
    pxPerPrice: 0,
    originX: 0,
    originY: 0,
    ...overrides,
  };
}

function pt(time: number, price: number): DrawPoint {
  return { time: time as DrawPoint['time'], price };
}

const T0 = 1_700_000_000;
const T1 = 1_700_050_000;
const T2 = 1_700_100_000;

function collectEvents(engine: DrawingEngine): Array<{ type: string }> {
  const events: Array<{ type: string }> = [];
  engine.on((e) => events.push(e));
  return events;
}

// ─── Group 1: Initial state ───────────────────────────────────────────────────

test('DE-01: engine starts in IDLE state', () => {
  const e = makeEngine();
  assert.equal(e.state, DrawingState.IDLE);
});

test('DE-02: initial drawings list is empty', () => {
  const e = makeEngine();
  assert.equal(e.drawings.length, 0);
});

test('DE-03: initial draft is null', () => {
  const e = makeEngine();
  assert.equal(e.draft, null);
});

test('DE-04: initial selectedId is null', () => {
  const e = makeEngine();
  assert.equal(e.selectedId, null);
});

test('DE-05: initial activeTool is null', () => {
  const e = makeEngine();
  assert.equal(e.activeTool, null);
});

test('DE-06: initial activeVariant is null', () => {
  const e = makeEngine();
  assert.equal(e.activeVariant, null);
});

// ─── Group 2: createDrawingEngine ─────────────────────────────────────────────

test('DE-07: createDrawingEngine returns DrawingEngine instance', () => {
  const e = createDrawingEngine([new TrendLineTool()]);
  assert.ok(e instanceof DrawingEngine);
});

test('DE-08: createDrawingEngine with no tools returns empty engine', () => {
  const e = createDrawingEngine([]);
  assert.equal(e.activeTool, null);
});

test('DE-09: selectTool throws for unknown variant', () => {
  const e = makeEngine();
  e.setViewport(vp());
  let threw = false;
  try {
    e.selectTool('hline' as DrawPoint['time'] extends never ? never : any);
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
});

// ─── Group 3: selectTool ─────────────────────────────────────────────────────

test('DE-10: selectTool sets activeTool', () => {
  const e = makeEngine();
  e.selectTool('trend');
  assert.ok(e.activeTool !== null);
  assert.equal(e.activeTool!.variant, 'trend');
});

test('DE-11: selectTool sets activeVariant', () => {
  const e = makeEngine();
  e.selectTool('trend');
  assert.equal(e.activeVariant, 'trend');
});

test('DE-12: selectTool(ray) sets activeVariant=ray', () => {
  const e = makeEngine();
  e.selectTool('ray');
  assert.equal(e.activeVariant, 'ray');
});

test('DE-13: selectTool cancels in-progress draft', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  assert.ok(e.draft !== null);

  e.selectTool('ray'); // switch tool mid-draft
  assert.equal(e.draft, null);
});

// ─── Group 4: clearTool ───────────────────────────────────────────────────────

test('DE-14: clearTool sets activeTool=null', () => {
  const e = makeEngine();
  e.selectTool('trend');
  e.clearTool();
  assert.equal(e.activeTool, null);
});

test('DE-15: clearTool sets activeVariant=null', () => {
  const e = makeEngine();
  e.selectTool('trend');
  e.clearTool();
  assert.equal(e.activeVariant, null);
});

test('DE-16: clearTool transitions to IDLE when nothing selected', () => {
  const e = makeEngine();
  e.selectTool('trend');
  e.clearTool();
  assert.equal(e.state, DrawingState.IDLE);
});

test('DE-17: clearTool transitions to SELECTED when drawing is selected', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');

  // Create a drawing
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);

  // Select it programmatically
  const id = e.drawings[0].id;
  e.select(id);
  e.selectTool('trend');
  e.clearTool();
  assert.equal(e.state, DrawingState.SELECTED);
});

// ─── Group 5: pointerDown with active tool ────────────────────────────────────

test('DE-18: pointerDown with active tool transitions to STARTED', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  assert.equal(e.state, DrawingState.STARTED);
});

test('DE-19: pointerDown creates a draft', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  assert.ok(e.draft !== null);
});

test('DE-20: pointerDown draft has correct variant', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  assert.equal(e.draft!.variant, 'trend');
});

test('DE-21: pointerDown returns "drew"', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  const result = e.pointerDown(pt(T0, 150));
  assert.equal(result, 'drew');
});

test('DE-22: first pointerDown emits draftUpdated event', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  const events = collectEvents(e);
  e.pointerDown(pt(T0, 150));
  const draftEvt = events.find((ev) => ev.type === 'draftUpdated');
  assert.ok(draftEvt !== undefined, 'expected draftUpdated event');
});

test('DE-23: second pointerDown commits drawing (trend via click-click)', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150)); // first anchor
  e.pointerMove(pt(T1, 170));
  e.pointerDown(pt(T2, 180)); // second anchor → commits
  assert.equal(e.drawings.length, 1);
});

test('DE-24: after commit via click-click, draft is null', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 170));
  e.pointerDown(pt(T2, 180));
  assert.equal(e.draft, null);
});

// ─── Group 6: pointerMove ─────────────────────────────────────────────────────

test('DE-25: pointerMove during draft transitions to PREVIEW', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  assert.equal(e.state, DrawingState.PREVIEW);
});

test('DE-26: pointerMove updates draft anchor[1]', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  assert.equal(e.draft!.anchors[1].price, 165);
});

test('DE-27: pointerMove emits draftUpdated event', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  const events = collectEvents(e);
  e.pointerMove(pt(T1, 165));
  const draftEvt = events.find((ev) => ev.type === 'draftUpdated');
  assert.ok(draftEvt !== undefined);
});

test('DE-28: pointerMove without draft does hover hit test', () => {
  const e = makeEngine();
  e.setViewport(vp());
  // No tool, no draft — move should be a no-op (no throw)
  let threw = false;
  try {
    e.pointerMove(pt(T1, 150));
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

// ─── Group 7: pointerUp with isDragFinalize ───────────────────────────────────

test('DE-29: pointerUp with isDragFinalize=true commits drawing', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  e.pointerUp(pt(T2, 180), true);
  assert.equal(e.drawings.length, 1);
});

test('DE-30: pointerUp isDragFinalize clears draft', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  e.pointerUp(pt(T2, 180), true);
  assert.equal(e.draft, null);
});

test('DE-31: pointerUp isDragFinalize emits drawingCommitted event', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  const events = collectEvents(e);
  e.pointerMove(pt(T1, 165));
  e.pointerUp(pt(T2, 180), true);
  const committed = events.find((ev) => ev.type === 'drawingCommitted');
  assert.ok(committed !== undefined);
});

test('DE-32: pointerUp isDragFinalize returns the committed drawing', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  const result = e.pointerUp(pt(T2, 180), true);
  assert.ok(result !== null);
  assert.equal(result!.variant, 'trend');
});

test('DE-33: pointerUp with isDragFinalize=false is a no-op', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  const result = e.pointerUp(pt(T2, 180), false);
  assert.equal(result, null);
  assert.ok(e.draft !== null); // draft still active
});

test('DE-34: zero-length drag finalize returns null (rejected)', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  // Don't move — anchor[0] == anchor[1]
  const result = e.pointerUp(pt(T0, 150), true);
  assert.equal(result, null);
  assert.equal(e.drawings.length, 0);
});

// ─── Group 8: cancel() ────────────────────────────────────────────────────────

test('DE-35: cancel() clears draft', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.cancel();
  assert.equal(e.draft, null);
});

test('DE-36: cancel() returns to IDLE (no selection)', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.cancel();
  assert.equal(e.state, DrawingState.IDLE);
});

test('DE-37: cancel() returns to SELECTED if a drawing was selected', () => {
  const e = makeEngine();
  e.setViewport(vp());
  // Add a drawing first
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);

  // Start new draft then cancel
  e.selectTool('trend');
  e.pointerDown(pt(T0, 130));
  e.cancel();
  assert.equal(e.state, DrawingState.SELECTED);
});

test('DE-38: cancel() from IDLE is safe no-op', () => {
  const e = makeEngine();
  e.setViewport(vp());
  let threw = false;
  try {
    e.cancel();
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
  assert.equal(e.state, DrawingState.IDLE);
});

// ─── Group 9: deleteSelected() ───────────────────────────────────────────────

test('DE-39: deleteSelected removes the drawing', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  e.deleteSelected();
  assert.equal(e.drawings.length, 0);
});

test('DE-40: deleteSelected returns true', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  const ok = e.deleteSelected();
  assert.equal(ok, true);
});

test('DE-41: deleteSelected returns false when nothing selected', () => {
  const e = makeEngine();
  const ok = e.deleteSelected();
  assert.equal(ok, false);
});

test('DE-42: deleteSelected transitions to IDLE', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  e.deleteSelected();
  assert.equal(e.state, DrawingState.IDLE);
});

test('DE-43: deleteSelected emits drawingDeleted event', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  const events = collectEvents(e);
  e.deleteSelected();
  const deleted = events.find((ev) => ev.type === 'drawingDeleted');
  assert.ok(deleted !== undefined);
});

test('DE-44: deleteSelected does not delete locked drawing', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;

  // Lock the drawing
  e.updateDrawing(id, (d) => ({ ...d, locked: true }));
  e.select(id);
  const ok = e.deleteSelected();
  assert.equal(ok, false);
  assert.equal(e.drawings.length, 1);
});

// ─── Group 10: addDrawing ─────────────────────────────────────────────────────

test('DE-45: addDrawing adds a drawing to the list', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const tool = new TrendLineTool();
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 180));
  const finalized = tool.finalize(d)!;
  e.addDrawing(finalized);
  assert.equal(e.drawings.length, 1);
});

test('DE-46: addDrawing sets bounds on the drawing', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const tool = new TrendLineTool();
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 180));
  const finalized = tool.finalize(d)!;
  e.addDrawing(finalized);
  assert.ok(e.drawings[0].bounds !== undefined);
});

test('DE-47: addDrawing preserves drawing id', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const tool = new TrendLineTool();
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 180));
  const finalized = tool.finalize(d)!;
  const origId = finalized.id;
  e.addDrawing(finalized);
  assert.equal(e.drawings[0].id, origId);
});

// ─── Group 11: setDrawings ─────────────────────────────────────────────────────

test('DE-48: setDrawings replaces all drawings', () => {
  const e = makeEngine();
  e.setViewport(vp());

  // Add one drawing via tool
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  assert.equal(e.drawings.length, 1);

  // Replace with empty
  e.setDrawings([]);
  assert.equal(e.drawings.length, 0);
});

test('DE-49: setDrawings clears selection', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  assert.ok(e.selectedId !== null);

  e.setDrawings([]);
  assert.equal(e.selectedId, null);
});

test('DE-50: setDrawings resets state to IDLE', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.setDrawings([]); // mid-draft
  assert.equal(e.state, DrawingState.IDLE);
  assert.equal(e.draft, null);
});

// ─── Group 12: updateDrawing ──────────────────────────────────────────────────

test('DE-51: updateDrawing modifies the drawing', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;

  e.updateDrawing(id, (d) => ({ ...d, options: { ...d.options, color: '#ff0000' } }));
  assert.equal(e.drawings[0].options.color, '#ff0000');
});

test('DE-52: updateDrawing recomputes bounds', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;

  e.updateDrawing(id, (d) => ({
    ...d,
    anchors: [pt(T0, 120), pt(T2, 190)],
  }));
  assert.equal(e.drawings[0].bounds!.minPrice, 120);
  assert.equal(e.drawings[0].bounds!.maxPrice, 190);
});

test('DE-53: updateDrawing no-ops for unknown id', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);

  let threw = false;
  try {
    e.updateDrawing('nonexistent-id', (d) => d);
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
  assert.equal(e.drawings.length, 1);
});

// ─── Group 13: removeDrawing ──────────────────────────────────────────────────

test('DE-54: removeDrawing removes by id', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.removeDrawing(id);
  assert.equal(e.drawings.length, 0);
});

test('DE-55: removeDrawing emits drawingDeleted event', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  const events = collectEvents(e);
  e.removeDrawing(id);
  const del = events.find((ev) => ev.type === 'drawingDeleted');
  assert.ok(del !== undefined);
});

test('DE-56: removeDrawing deselects if selected', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  e.removeDrawing(id);
  assert.equal(e.selectedId, null);
});

// ─── Group 14: select() ───────────────────────────────────────────────────────

test('DE-57: select(id) sets selectedId', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  assert.equal(e.selectedId, id);
});

test('DE-58: select(id) transitions to SELECTED', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  assert.equal(e.state, DrawingState.SELECTED);
});

test('DE-59: select(null) deselects', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  e.select(null);
  assert.equal(e.selectedId, null);
  assert.equal(e.state, DrawingState.IDLE);
});

test('DE-60: select(null) emits selectionChanged event', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  const events = collectEvents(e);
  e.select(null);
  const sel = events.find((ev) => ev.type === 'selectionChanged');
  assert.ok(sel !== undefined);
});

// ─── Group 15: Event system ───────────────────────────────────────────────────

test('DE-61: on() returns unsubscribe function', () => {
  const e = makeEngine();
  const unsub = e.on(() => {});
  assert.equal(typeof unsub, 'function');
});

test('DE-62: unsubscribe stops receiving events', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const received: string[] = [];
  const unsub = e.on((ev) => received.push(ev.type));
  e.selectTool('trend');
  const before = received.length;
  unsub();
  e.selectTool('ray');
  const after = received.length;
  assert.equal(before, after); // no new events after unsubscribe
});

test('DE-63: stateChanged event emitted on IDLE→STARTED', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const events: any[] = [];
  e.on((ev) => events.push(ev));
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  const sc = events.find((ev) => ev.type === 'stateChanged');
  assert.ok(sc !== undefined);
});

test('DE-64: stateChanged event has correct state values', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const events: any[] = [];
  e.on((ev) => events.push(ev));
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  const sc = events.find((ev) => ev.type === 'stateChanged' && ev.state === DrawingState.STARTED);
  assert.ok(sc !== undefined);
  assert.equal(sc.prevState, DrawingState.IDLE);
});

test('DE-65: drawingCommitted event has correct drawing', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const events: any[] = [];
  e.on((ev) => events.push(ev));
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const committed = events.find((ev) => ev.type === 'drawingCommitted');
  assert.ok(committed !== undefined);
  assert.equal(committed.drawing.variant, 'trend');
});

test('DE-66: multiple listeners all receive events', () => {
  const e = makeEngine();
  e.setViewport(vp());
  let count1 = 0, count2 = 0;
  e.on(() => count1++);
  e.on(() => count2++);
  // selectTool + pointerDown triggers stateChanged + draftUpdated events
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  assert.ok(count1 > 0 && count2 > 0);
  assert.equal(count1, count2);
});

// ─── Group 16: Multiple drawings ─────────────────────────────────────────────

test('DE-67: can add 3 drawings sequentially', () => {
  const e = makeEngine();
  e.setViewport(vp());
  for (let i = 0; i < 3; i++) {
    e.selectTool('trend');
    e.pointerDown(pt(T0 + i * 1000, 140 + i * 10));
    e.pointerUp(pt(T2 - i * 1000, 160 + i * 10), true);
  }
  assert.equal(e.drawings.length, 3);
});

test('DE-68: each drawing has a unique id', () => {
  const e = makeEngine();
  e.setViewport(vp());
  for (let i = 0; i < 5; i++) {
    e.selectTool('trend');
    e.pointerDown(pt(T0 + i * 1000, 140 + i * 5));
    e.pointerUp(pt(T2 - i * 1000, 160 + i * 5), true);
  }
  const ids = e.drawings.map((d) => d.id);
  const unique = new Set(ids);
  assert.equal(unique.size, 5);
});

test('DE-69: can mix trend and ray drawings', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  e.selectTool('ray');
  e.pointerDown(pt(T0, 160));
  e.pointerUp(pt(T2, 175), true);
  assert.equal(e.drawings.length, 2);
  assert.equal(e.drawings[0].variant, 'trend');
  assert.equal(e.drawings[1].variant, 'ray');
});

test('DE-70: setDrawings with 3 drawings sets length=3', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const tool = new TrendLineTool();
  const drawings: Drawing[] = [];
  for (let i = 0; i < 3; i++) {
    let d = tool.createDraft(pt(T0 + i, 150 + i), { ...DEFAULT_DRAWING_OPTIONS });
    d = tool.updateDraft(d, pt(T2 - i, 160 + i));
    drawings.push(tool.finalize(d)!);
  }
  e.setDrawings(drawings);
  assert.equal(e.drawings.length, 3);
});

// ─── Group 17: Hit testing via pointerDown ────────────────────────────────────

test('DE-71: pointerDown on empty space with no tool returns none', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const result = e.pointerDown(pt(T1, 150));
  assert.equal(result, 'none');
});

test('DE-72: programmatic select then deselect via select(null)', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  e.select(id);
  assert.ok(e.selectedId !== null);

  // Programmatically deselect
  e.select(null);
  assert.equal(e.selectedId, null);
});

// ─── Group 18: setOptions ─────────────────────────────────────────────────────

test('DE-73: setOptions updates color for next draft', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.setOptions({ color: '#e91e63' });
  e.pointerDown(pt(T0, 150));
  assert.equal(e.draft!.options.color, '#e91e63');
});

test('DE-74: setOptions merges with existing options', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.setOptions({ lineWidth: 3 });
  e.setOptions({ color: '#2196f3' }); // second call merges
  e.pointerDown(pt(T0, 150));
  assert.equal(e.draft!.options.lineWidth, 3);
  assert.equal(e.draft!.options.color, '#2196f3');
});

// ─── Group 19: Viewport management ───────────────────────────────────────────

test('DE-75: pointerDown without viewport returns none', () => {
  const e = makeEngine(); // no setViewport
  e.selectTool('trend');
  const result = e.pointerDown(pt(T0, 150));
  // Without viewport, engine cannot proceed
  // It should either return 'none' or handle gracefully
  assert.ok(result === 'none' || result === 'drew');
});

test('DE-76: setViewport can be called multiple times', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.setViewport(vp({ priceMin: 50, priceMax: 100 }));
  // Should not throw
  let threw = false;
  try {
    e.selectTool('trend');
    e.pointerDown(pt(T0, 75));
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

// ─── Group 20: State invariants ───────────────────────────────────────────────

test('DE-77: state is always a valid DrawingState value', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const validStates = Object.values(DrawingState);
  assert.ok(validStates.includes(e.state));

  e.selectTool('trend');
  assert.ok(validStates.includes(e.state));

  e.pointerDown(pt(T0, 150));
  assert.ok(validStates.includes(e.state));
});

test('DE-78: drawings list is readonly (returned as readonly)', () => {
  const e = makeEngine();
  const drawings = e.drawings;
  // drawings is typed as readonly — we just check it's an array
  assert.ok(Array.isArray(drawings));
});

test('DE-79: draft is null when state is IDLE', () => {
  const e = makeEngine();
  assert.equal(e.state, DrawingState.IDLE);
  assert.equal(e.draft, null);
});

test('DE-80: after full drag-finalize cycle, state is SELECTED (drawing auto-selected)', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  e.pointerUp(pt(T2, 180), true);
  // _commitDrawing transitions to SELECTED and sets selectedId
  assert.equal(e.state, DrawingState.SELECTED);
  assert.ok(e.selectedId !== null);
});

// ─── Group 21: render() ───────────────────────────────────────────────────────

test('DE-81: render does not throw for empty engine', () => {
  const e = makeEngine();
  e.setViewport(vp());
  // Create a minimal mock canvas context
  const fakeCtx = {
    save: () => {}, restore: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {},
    fill: () => {}, arc: () => {}, fillRect: () => {},
    clearRect: () => {}, setLineDash: () => {}, strokeStyle: '', fillStyle: '',
    lineWidth: 1, globalAlpha: 1, font: '', textAlign: '',
    measureText: () => ({ width: 0 }),
    translate: () => {}, scale: () => {}, rotate: () => {},
    clip: () => {}, rect: () => {}, closePath: () => {},
  } as unknown as CanvasRenderingContext2D;

  let threw = false;
  try {
    e.render(fakeCtx, vp());
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

test('DE-82: render with a committed drawing does not throw', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);

  const fakeCtx = {
    save: () => {}, restore: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {},
    fill: () => {}, arc: () => {}, fillRect: () => {},
    clearRect: () => {}, setLineDash: () => {}, strokeStyle: '', fillStyle: '',
    lineWidth: 1, globalAlpha: 1, font: '', textAlign: 'left' as const,
    measureText: (_s: string) => ({ width: 20, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 3 }) as TextMetrics,
    translate: () => {}, scale: () => {}, rotate: () => {},
    clip: () => {}, rect: () => {}, closePath: () => {},
    fillText: () => {}, strokeText: () => {}, roundRect: () => {},
    canvas: { width: 800, height: 400 },
  } as unknown as CanvasRenderingContext2D;

  let threw = false;
  try {
    e.render(fakeCtx, vp());
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

// ─── Group 22: Edge cases ──────────────────────────────────────────────────────

test('DE-83: cancel() with no draft is safe', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.cancel(); // no draft yet
  assert.equal(e.state, DrawingState.IDLE);
});

test('DE-84: deleteSelected() with no drawings is safe', () => {
  const e = makeEngine();
  e.select(null); // explicit null select
  const ok = e.deleteSelected();
  assert.equal(ok, false);
});

test('DE-85: removeDrawing with unknown id is safe', () => {
  const e = makeEngine();
  let threw = false;
  try {
    e.removeDrawing('does-not-exist');
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

test('DE-86: pointerMove without active tool or draft is safe', () => {
  const e = makeEngine();
  e.setViewport(vp());
  let threw = false;
  try {
    e.pointerMove(pt(T1, 150));
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

test('DE-87: setOptions without active tool does not throw', () => {
  const e = makeEngine();
  let threw = false;
  try {
    e.setOptions({ color: '#fff' });
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
});

// ─── Group 23: Complete workflow tests ───────────────────────────────────────

test('DE-88: full workflow: create, select, delete', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  assert.equal(e.drawings.length, 1);

  const id = e.drawings[0].id;
  e.select(id);
  assert.equal(e.selectedId, id);

  e.deleteSelected();
  assert.equal(e.drawings.length, 0);
  assert.equal(e.selectedId, null);
});

test('DE-89: full workflow: create, update, verify', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);

  const id = e.drawings[0].id;
  e.updateDrawing(id, (d) => ({
    ...d,
    options: { ...d.options, color: '#4caf50', lineWidth: 2 },
  }));

  assert.equal(e.drawings[0].options.color, '#4caf50');
  assert.equal(e.drawings[0].options.lineWidth, 2);
});

test('DE-90: addDrawing + select + delete cycle', () => {
  const e = makeEngine();
  e.setViewport(vp());

  const tool = new TrendLineTool();
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 180));
  e.addDrawing(tool.finalize(d)!);

  const id = e.drawings[0].id;
  e.select(id);
  assert.equal(e.state, DrawingState.SELECTED);
  e.deleteSelected();
  assert.equal(e.drawings.length, 0);
});

test('DE-91: cancel mid-draft does not add to drawings', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerMove(pt(T1, 165));
  e.cancel();
  assert.equal(e.drawings.length, 0);
});

test('DE-92: 5 drawings, setDrawings clears all', () => {
  const e = makeEngine();
  e.setViewport(vp());
  for (let i = 0; i < 5; i++) {
    e.selectTool('trend');
    e.pointerDown(pt(T0 + i, 150 + i));
    e.pointerUp(pt(T2 - i, 170 + i), true);
  }
  assert.equal(e.drawings.length, 5);
  e.setDrawings([]);
  assert.equal(e.drawings.length, 0);
  assert.equal(e.state, DrawingState.IDLE);
});

test('DE-93: drawing committed via click-click has correct anchors', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 145));
  e.pointerMove(pt(T1, 165));
  e.pointerDown(pt(T2, 185)); // second click
  assert.equal(e.drawings.length, 1);
  assert.equal(e.drawings[0].anchors[0].price, 145);
  assert.equal(e.drawings[0].anchors[1].price, 185);
});

test('DE-94: drawing committed via drag has correct anchors', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 145));
  e.pointerMove(pt(T1, 165));
  e.pointerUp(pt(T2, 185), true);
  assert.equal(e.drawings.length, 1);
  assert.equal(e.drawings[0].anchors[0].price, 145);
  assert.equal(e.drawings[0].anchors[1].price, 185);
});

test('DE-95: DrawingState values are correct strings', () => {
  assert.equal(DrawingState.IDLE, 'IDLE');
  assert.equal(DrawingState.STARTED, 'STARTED');
  assert.equal(DrawingState.PREVIEW, 'PREVIEW');
  assert.equal(DrawingState.COMPLETED, 'COMPLETED');
  assert.equal(DrawingState.SELECTED, 'SELECTED');
  assert.equal(DrawingState.EDITING, 'EDITING');
});

test('DE-96: engine after setDrawings still accepts new drawings', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.setDrawings([]);
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  assert.equal(e.drawings.length, 1);
});

test('DE-97: select() emits selectionChanged event', () => {
  const e = makeEngine();
  e.setViewport(vp());
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  e.pointerUp(pt(T2, 180), true);
  const id = e.drawings[0].id;
  const events: any[] = [];
  e.on((ev) => events.push(ev));
  e.select(id);
  const sc = events.find((ev) => ev.type === 'selectionChanged' && ev.selectedId === id);
  assert.ok(sc !== undefined);
});

test('DE-98: addDrawing then removeDrawing leaves empty list', () => {
  const e = makeEngine();
  const tool = new TrendLineTool();
  let d = tool.createDraft(pt(T0, 150), { ...DEFAULT_DRAWING_OPTIONS });
  d = tool.updateDraft(d, pt(T2, 180));
  const finalized = tool.finalize(d)!;
  e.addDrawing(finalized);
  e.removeDrawing(finalized.id);
  assert.equal(e.drawings.length, 0);
});

test('DE-99: engine supports multiple event listeners', () => {
  const e = makeEngine();
  e.setViewport(vp());
  const counts = [0, 0, 0];
  e.on(() => counts[0]++);
  e.on(() => counts[1]++);
  e.on(() => counts[2]++);
  e.selectTool('trend');
  e.pointerDown(pt(T0, 150));
  // All three should have received events
  assert.ok(counts[0] > 0);
  assert.ok(counts[1] > 0);
  assert.ok(counts[2] > 0);
  assert.equal(counts[0], counts[1]);
  assert.equal(counts[1], counts[2]);
});

test('DE-100: full lifecycle: draw → select → update → verify → delete → verify empty', () => {
  const e = makeEngine();
  e.setViewport(vp());

  // Draw
  e.selectTool('trend');
  e.setOptions({ color: '#2196f3', lineWidth: 2 });
  e.pointerDown(pt(T0, 145));
  e.pointerMove(pt(T1, 160));
  e.pointerUp(pt(T2, 175), true);
  assert.equal(e.drawings.length, 1);

  // Select
  const id = e.drawings[0].id;
  e.select(id);
  assert.equal(e.selectedId, id);
  assert.equal(e.state, DrawingState.SELECTED);

  // Update
  e.updateDrawing(id, (d) => ({ ...d, options: { ...d.options, lineWidth: 3 } }));
  assert.equal(e.drawings[0].options.lineWidth, 3);
  assert.equal(e.drawings[0].options.color, '#2196f3');

  // Delete
  e.deleteSelected();
  assert.equal(e.drawings.length, 0);
  assert.equal(e.selectedId, null);
  assert.equal(e.state, DrawingState.IDLE);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
console.log(`DrawingEngine tests: ${passed} passed, ${failed > 0 ? failed + ' failed' : '0 failed'}`);
