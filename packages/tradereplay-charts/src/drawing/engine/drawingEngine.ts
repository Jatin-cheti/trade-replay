/**
 * DrawingEngine — state machine managing the full lifecycle of chart drawings.
 *
 * States: IDLE → STARTED → PREVIEW → COMPLETED → SELECTED → EDITING
 *
 * This class is framework-agnostic (no React, no DOM) and is designed to be
 * driven by an InteractionManager that translates pointer/key events into
 * engine method calls.
 */

import type {
  Drawing,
  DrawPoint,
  DrawingVariant,
  HitResult,
  HandleDescriptor,
  Viewport,
  DrawingOptions,
} from '../types.ts';
import { DrawingState, DEFAULT_DRAWING_OPTIONS } from '../types.ts';
import type { IDrawingTool } from '../types.ts';
import type { ScreenPoint } from '../types.ts';
import { dataToScreen } from '../geometry.ts';

// ─── Internal helpers ──────────────────────────────────────────────────────

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function computeBounds(anchors: DrawPoint[]): Drawing['bounds'] {
  if (!anchors.length) return undefined;
  let minTime = Infinity, maxTime = -Infinity;
  let minPrice = Infinity, maxPrice = -Infinity;
  for (const a of anchors) {
    const t = Number(a.time);
    if (!Number.isFinite(t)) continue;
    minTime = Math.min(minTime, t);
    maxTime = Math.max(maxTime, t);
    minPrice = Math.min(minPrice, a.price);
    maxPrice = Math.max(maxPrice, a.price);
  }
  if (!Number.isFinite(minTime)) return undefined;
  return {
    minTime: minTime as DrawPoint['time'],
    maxTime: maxTime as DrawPoint['time'],
    minPrice,
    maxPrice,
  };
}

// ─── Engine event types ────────────────────────────────────────────────────

export type DrawingEngineEvent =
  | { type: 'stateChanged'; state: DrawingState; prevState: DrawingState }
  | { type: 'draftUpdated'; draft: Drawing }
  | { type: 'drawingCommitted'; drawing: Drawing }
  | { type: 'drawingUpdated'; drawing: Drawing }
  | { type: 'drawingDeleted'; id: string }
  | { type: 'selectionChanged'; selectedId: string | null; prevId: string | null }
  | { type: 'renderRequested' };

export type DrawingEngineListener = (event: DrawingEngineEvent) => void;

// ─── DrawingEngine class ───────────────────────────────────────────────────

export class DrawingEngine {
  private _state: DrawingState = DrawingState.IDLE;
  private _drawings: Drawing[] = [];
  private _draft: Drawing | null = null;
  private _selectedId: string | null = null;
  private _hoveredId: string | null = null;
  private _activeTool: IDrawingTool | null = null;
  private _activeOptions: DrawingOptions = { ...DEFAULT_DRAWING_OPTIONS };
  private _dragAnchorIndex: number = -1;
  private _dragAnchorOriginals: DrawPoint[] = [];
  private _dragMoveStartPoint: DrawPoint | null = null;
  private _dragMoveOriginals: DrawPoint[] = [];
  private _viewport: Viewport | null = null;
  private _renderSeq = 0;
  private _listeners = new Set<DrawingEngineListener>();
  private readonly _toolRegistry: Map<DrawingVariant, IDrawingTool>;

  constructor(tools: IDrawingTool[]) {
    this._toolRegistry = new Map(tools.map((t) => [t.variant, t]));
  }

  // ─── Public getters ──────────────────────────────────────────────────────

  get state(): DrawingState { return this._state; }
  get drawings(): readonly Drawing[] { return this._drawings; }
  get draft(): Drawing | null { return this._draft; }
  get selectedId(): string | null { return this._selectedId; }
  get hoveredId(): string | null { return this._hoveredId; }
  get activeTool(): IDrawingTool | null { return this._activeTool; }
  get activeVariant(): DrawingVariant | null { return this._activeTool?.variant ?? null; }

  // ─── Viewport ────────────────────────────────────────────────────────────

  setViewport(vp: Viewport): void {
    this._viewport = vp;
  }

  // ─── Tool selection ──────────────────────────────────────────────────────

  /** Activate a drawing tool. Cancels any in-progress draft. */
  selectTool(variant: DrawingVariant, options?: Partial<DrawingOptions>): void {
    this._cancelDraft();
    const tool = this._toolRegistry.get(variant);
    if (!tool) throw new Error(`Unknown drawing variant: ${variant}`);
    this._activeTool = tool;
    if (options) {
      this._activeOptions = { ...this._activeOptions, ...options };
    }
  }

  /** Deactivate the current tool, return to IDLE/SELECTED. */
  clearTool(): void {
    this._cancelDraft();
    this._activeTool = null;
    this._transition(this._selectedId ? DrawingState.SELECTED : DrawingState.IDLE);
    this._emit({ type: 'renderRequested' });
  }

  setOptions(partial: Partial<DrawingOptions>): void {
    this._activeOptions = { ...this._activeOptions, ...partial };
  }

  // ─── Pointer interaction ─────────────────────────────────────────────────

  /**
   * Handle pointer-down at a data-space point.
   * Returns 'drew', 'selected', 'editingAnchor', 'moved', or 'none'.
   */
  pointerDown(point: DrawPoint): 'drew' | 'selected' | 'editingAnchor' | 'moved' | 'none' {
    if (!this._viewport) return 'none';

    // --- Active drawing tool → start/continue draft ---
    if (this._activeTool) {
      const tool = this._activeTool;

      if (tool.isPointOnly) {
        const drawing = tool.createDraft(point, { ...this._activeOptions });
        const finalized = tool.finalize(drawing);
        if (finalized) {
          this._commitDrawing(finalized);
          this._emit({ type: 'drawingCommitted', drawing: finalized });
        }
        return 'drew';
      }

      if (this._draft) {
        // Second+ click: update draft then finalize if non-wizard
        this._draft = tool.updateDraft(this._draft, point);
        this._transition(DrawingState.PREVIEW);
        this._emit({ type: 'draftUpdated', draft: this._draft });
        const finalized = tool.finalize(this._draft);
        if (finalized) {
          this._commitDrawing(finalized);
          this._cancelDraft();
          return 'drew';
        }
        return 'drew';
      }

      // First click: create draft
      this._draft = tool.createDraft(point, { ...this._activeOptions });
      this._transition(DrawingState.STARTED);
      this._emit({ type: 'draftUpdated', draft: this._draft });
      return 'drew';
    }

    // --- No active tool → hit test existing drawings ---
    const sp = dataToScreen(point, this._viewport);
    const hit = this._hitTest(sp);

    if (hit.drawing) {
      const prevId = this._selectedId;
      this._selectedId = hit.drawing.id;
      this._emit({ type: 'selectionChanged', selectedId: this._selectedId, prevId });

      if (hit.anchorIndex >= 0 && !hit.drawing.locked) {
        // Start anchor drag
        this._dragAnchorIndex = hit.anchorIndex;
        this._dragAnchorOriginals = hit.drawing.anchors.map((a) => ({ ...a }));
        this._transition(DrawingState.EDITING);
        return 'editingAnchor';
      } else if (!hit.drawing.locked) {
        // Start body drag
        this._dragMoveStartPoint = point;
        this._dragMoveOriginals = hit.drawing.anchors.map((a) => ({ ...a }));
        this._transition(DrawingState.EDITING);
        return 'moved';
      }
      this._transition(DrawingState.SELECTED);
      return 'selected';
    }

    // Clicked empty space → deselect
    const prevId = this._selectedId;
    this._selectedId = null;
    if (prevId) {
      this._emit({ type: 'selectionChanged', selectedId: null, prevId });
    }
    this._transition(DrawingState.IDLE);
    this._emit({ type: 'renderRequested' });
    return 'none';
  }

  /**
   * Handle pointer-move at a data-space point (called on every mouse/pointer move).
   */
  pointerMove(point: DrawPoint): void {
    if (!this._viewport) return;

    if (this._state === DrawingState.EDITING) {
      if (this._dragAnchorIndex >= 0) {
        this._updateAnchorDrag(point);
      } else if (this._dragMoveStartPoint) {
        this._updateBodyDrag(point);
      }
      return;
    }

    if (this._draft && this._activeTool) {
      this._draft = this._activeTool.updateDraft(this._draft, point);
      this._transition(DrawingState.PREVIEW);
      this._emit({ type: 'draftUpdated', draft: this._draft });
      return;
    }

    // Hover hit test for cursor changes
    const sp = dataToScreen(point, this._viewport);
    const hit = this._hitTest(sp);
    const prevHovered = this._hoveredId;
    this._hoveredId = hit.drawing?.id ?? null;
    if (prevHovered !== this._hoveredId) {
      this._emit({ type: 'renderRequested' });
    }
  }

  /**
   * Handle pointer-up. For drag-based tools (like TrendLine), finalizes the drawing.
   * For click-based tools, this is a no-op (finalization happens on the second pointerDown).
   */
  pointerUp(point: DrawPoint, isDragFinalize = false): Drawing | null {
    if (this._state === DrawingState.EDITING) {
      this._commitEditing();
      return null;
    }

    if (isDragFinalize && this._draft && this._activeTool) {
      // For drag-based drawing: pointerUp finalizes
      this._draft = this._activeTool.updateDraft(this._draft, point);
      const finalized = this._activeTool.finalize(this._draft);
      this._cancelDraft();
      if (finalized) {
        this._commitDrawing(finalized);
        this._emit({ type: 'drawingCommitted', drawing: finalized });
        return finalized;
      }
      return null;
    }

    return null;
  }

  /**
   * Cancel the current in-progress draft (ESC key).
   */
  cancel(): void {
    this._cancelDraft();
    this._transition(this._selectedId ? DrawingState.SELECTED : DrawingState.IDLE);
    this._emit({ type: 'renderRequested' });
  }

  /**
   * Delete the currently selected drawing (Delete/Backspace key).
   */
  deleteSelected(): boolean {
    if (!this._selectedId) return false;
    const id = this._selectedId;
    const drawing = this._drawings.find((d) => d.id === id);
    if (drawing?.locked) return false;
    this._drawings = this._drawings.filter((d) => d.id !== id);
    this._selectedId = null;
    this._transition(DrawingState.IDLE);
    this._emit({ type: 'drawingDeleted', id });
    this._emit({ type: 'renderRequested' });
    return true;
  }

  // ─── Drawing management ──────────────────────────────────────────────────

  /** Add a drawing that was created externally (e.g., loaded from server). */
  addDrawing(drawing: Drawing): void {
    const withBounds: Drawing = {
      ...drawing,
      bounds: computeBounds(drawing.anchors),
    };
    this._drawings = [...this._drawings, withBounds];
    this._emit({ type: 'renderRequested' });
  }

  /** Replace all drawings (e.g., loading a saved state). */
  setDrawings(drawings: Drawing[]): void {
    this._drawings = drawings.map((d) => ({ ...d, bounds: computeBounds(d.anchors) }));
    this._selectedId = null;
    this._hoveredId = null;
    this._cancelDraft();
    this._transition(DrawingState.IDLE);
    this._emit({ type: 'renderRequested' });
  }

  /** Update a specific drawing by id. */
  updateDrawing(id: string, updater: (d: Drawing) => Drawing): void {
    this._drawings = this._drawings.map((d) => {
      if (d.id !== id) return d;
      const updated = updater(d);
      return { ...updated, bounds: computeBounds(updated.anchors) };
    });
    this._emit({ type: 'renderRequested' });
  }

  /** Remove a drawing by id. */
  removeDrawing(id: string): void {
    this._drawings = this._drawings.filter((d) => d.id !== id);
    if (this._selectedId === id) {
      this._selectedId = null;
      this._transition(DrawingState.IDLE);
    }
    if (this._hoveredId === id) this._hoveredId = null;
    this._emit({ type: 'drawingDeleted', id });
    this._emit({ type: 'renderRequested' });
  }

  /** Select a drawing by id (programmatic). */
  select(id: string | null): void {
    const prevId = this._selectedId;
    this._selectedId = id;
    this._transition(id ? DrawingState.SELECTED : DrawingState.IDLE);
    this._emit({ type: 'selectionChanged', selectedId: id, prevId });
    this._emit({ type: 'renderRequested' });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  /**
   * Render all drawings + draft + handles to the canvas.
   * Call this every animation frame or on each render request.
   */
  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    this._viewport = viewport;
    this._renderSeq++;

    ctx.save();
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    // Render committed drawings (sorted by z-index)
    const sorted = [...this._drawings].sort((a, b) => {
      const za = a.zIndex ?? 20;
      const zb = b.zIndex ?? 20;
      if (za !== zb) return za - zb;
      return (a.renderOrder ?? 0) - (b.renderOrder ?? 0);
    });

    for (const drawing of sorted) {
      if (!drawing.visible) continue;
      const tool = this._toolRegistry.get(drawing.variant);
      if (!tool) continue;
      const isSelected = drawing.id === this._selectedId;
      const isHovered = drawing.id === this._hoveredId;
      tool.render(ctx, drawing, viewport, isSelected, isHovered);

      // Draw handles for selected drawing
      if (isSelected) {
        const handles = tool.getHandles(drawing, viewport);
        for (const handle of handles) {
          this._renderHandle(ctx, handle, drawing.options.color);
        }
      }
    }

    // Render draft preview
    if (this._draft && this._activeTool) {
      this._activeTool.renderPreview(ctx, this._draft, viewport);
    }

    ctx.restore();
  }

  // ─── Event subscription ──────────────────────────────────────────────────

  on(listener: DrawingEngineListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _transition(next: DrawingState): void {
    if (this._state === next) return;
    const prev = this._state;
    this._state = next;
    this._emit({ type: 'stateChanged', state: next, prevState: prev });
  }

  private _emit(event: DrawingEngineEvent): void {
    for (const listener of this._listeners) {
      listener(event);
    }
  }

  private _cancelDraft(): void {
    this._draft = null;
  }

  private _commitDrawing(drawing: Drawing): void {
    const withMeta: Drawing = {
      ...drawing,
      bounds: computeBounds(drawing.anchors),
      renderOrder: (this._drawings.length + 1),
    };
    this._drawings = [...this._drawings, withMeta];
    this._selectedId = withMeta.id;
    this._transition(DrawingState.SELECTED);
  }

  private _hitTest(sp: ScreenPoint): HitResult {
    if (!this._viewport) return { drawing: null, anchorIndex: -1, distancePx: Infinity };

    const HIT_RADIUS = 8; // pixels
    const HANDLE_RADIUS = 6;

    let best: HitResult = { drawing: null, anchorIndex: -1, distancePx: Infinity };

    // Test in reverse render order (top-most first)
    const sorted = [...this._drawings]
      .filter((d) => d.visible)
      .sort((a, b) => (b.zIndex ?? 20) - (a.zIndex ?? 20) || (b.renderOrder ?? 0) - (a.renderOrder ?? 0));

    for (const drawing of sorted) {
      const tool = this._toolRegistry.get(drawing.variant);
      if (!tool) continue;

      // Check handles first (for selected drawing)
      if (drawing.id === this._selectedId) {
        const handles = tool.getHandles(drawing, this._viewport);
        for (const handle of handles) {
          const d = Math.hypot(sp.x - handle.center.x, sp.y - handle.center.y);
          if (d <= HANDLE_RADIUS + 2 && d < best.distancePx) {
            best = { drawing, anchorIndex: handle.anchorIndex, distancePx: d };
          }
        }
      }

      // Check drawing body
      const dist = tool.hitTest(drawing, sp, this._viewport);
      if (dist < HIT_RADIUS && dist < best.distancePx) {
        best = { drawing, anchorIndex: -1, distancePx: dist };
      }
    }

    return best;
  }

  private _updateAnchorDrag(point: DrawPoint): void {
    if (!this._selectedId || this._dragAnchorIndex < 0) return;
    this._drawings = this._drawings.map((d) => {
      if (d.id !== this._selectedId) return d;
      const anchors = [...d.anchors];
      anchors[this._dragAnchorIndex] = point;
      const updated = { ...d, anchors, bounds: computeBounds(anchors) };
      this._emit({ type: 'drawingUpdated', drawing: updated });
      return updated;
    });
    this._emit({ type: 'renderRequested' });
  }

  private _updateBodyDrag(point: DrawPoint): void {
    if (!this._selectedId || !this._dragMoveStartPoint) return;
    const dt = Number(point.time) - Number(this._dragMoveStartPoint.time);
    const dp = point.price - this._dragMoveStartPoint.price;
    this._drawings = this._drawings.map((d) => {
      if (d.id !== this._selectedId) return d;
      const anchors = this._dragMoveOriginals.map((a) => ({
        ...a,
        time: (Number(a.time) + dt) as DrawPoint['time'],
        price: a.price + dp,
      }));
      const updated = { ...d, anchors, bounds: computeBounds(anchors) };
      this._emit({ type: 'drawingUpdated', drawing: updated });
      return updated;
    });
    this._emit({ type: 'renderRequested' });
  }

  private _commitEditing(): void {
    this._dragAnchorIndex = -1;
    this._dragAnchorOriginals = [];
    this._dragMoveStartPoint = null;
    this._dragMoveOriginals = [];
    this._transition(DrawingState.SELECTED);
    this._emit({ type: 'renderRequested' });
  }

  private _renderHandle(ctx: CanvasRenderingContext2D, handle: HandleDescriptor, color: string): void {
    const { center, radius, active } = handle;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke();
  }
}

/** Factory function to create a DrawingEngine with the given tools registered. */
export function createDrawingEngine(tools: IDrawingTool[]): DrawingEngine {
  return new DrawingEngine(tools);
}
