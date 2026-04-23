/**
 * InteractionManager — translates DOM pointer/keyboard events into DrawingEngine calls.
 *
 * Responsibilities:
 * - Convert clientX/Y → data-space DrawPoint using the current Viewport
 * - Detect drag vs click (3px threshold)
 * - Handle Alt key (demo mode temporary drawing)
 * - Handle Shift key (angle snap for lines, H/V snap for axes)
 * - Handle ESC (cancel draft)
 * - Handle Delete/Backspace (delete selected)
 */

import type { DrawPoint, Viewport, DrawingVariant, DrawingOptions } from '../types.ts';
import type { DrawingEngine } from './drawingEngine.ts';
import { screenToData, snapAngle15 } from '../geometry.ts';

export interface InteractionManagerOptions {
  /**
   * When in "demo mode" and Alt is held, clicking activates the lastDrawingVariant
   * for a temporary drawing. After finalization, tool reverts to none.
   */
  demoMode?: boolean;
  /**
   * The fallback variant to use for demo+Alt drawing.
   * @default 'trend'
   */
  lastDrawingVariant?: DrawingVariant;
  /**
   * Allow Shift key to snap drawing angles.
   * @default true
   */
  shiftSnap?: boolean;
}

export class InteractionManager {
  private readonly _engine: DrawingEngine;
  private _viewport: Viewport | null = null;
  private _options: Required<InteractionManagerOptions>;

  // Track pointer position and drag state
  private _pointerDownX: number | null = null;
  private _pointerDownY: number | null = null;
  private _pointerDownPoint: DrawPoint | null = null;
  private _isDragging = false;
  private readonly DRAG_THRESHOLD_PX = 3;

  // Alt/Shift key tracking
  private _altHeld = false;
  private _shiftHeld = false;

  // Demo mode: Alt key held → drawing active
  private _demoAltDrawing = false;

  private readonly _boundKeyDown: (e: KeyboardEvent) => void;
  private readonly _boundKeyUp: (e: KeyboardEvent) => void;

  constructor(engine: DrawingEngine, options: InteractionManagerOptions = {}) {
    this._engine = engine;
    this._options = {
      demoMode: options.demoMode ?? false,
      lastDrawingVariant: options.lastDrawingVariant ?? 'trend',
      shiftSnap: options.shiftSnap ?? true,
    };
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
  }

  /** Attach global keyboard listeners. Call once on mount. */
  attach(): void {
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);
  }

  /** Detach listeners. Call on unmount. */
  detach(): void {
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
  }

  setViewport(vp: Viewport): void {
    this._viewport = vp;
    this._engine.setViewport(vp);
  }

  setOptions(opts: Partial<InteractionManagerOptions>): void {
    this._options = { ...this._options, ...opts };
  }

  // ─── Pointer event handlers ──────────────────────────────────────────────

  handlePointerDown(clientX: number, clientY: number, rectLeft: number, rectTop: number): void {
    if (!this._viewport) return;

    this._pointerDownX = clientX;
    this._pointerDownY = clientY;
    this._isDragging = false;

    // Convert to data point
    const sp = { x: clientX - rectLeft, y: clientY - rectTop };
    let point = screenToData(sp, this._viewport);

    // Demo mode + Alt held → activate last drawing tool temporarily
    if (this._options.demoMode && this._altHeld && this._engine.activeVariant === null) {
      const variant = this._options.lastDrawingVariant;
      this._engine.selectTool(variant);
      this._demoAltDrawing = true;
    }

    this._pointerDownPoint = point;
    const result = this._engine.pointerDown(point);

    // If started a draft, mark as drawing in progress
    if (result === 'drew' && this._engine.draft) {
      // Drag-based drawing: wait for pointerUp
    }
  }

  handlePointerMove(clientX: number, clientY: number, rectLeft: number, rectTop: number): void {
    if (!this._viewport) return;

    if (this._pointerDownX !== null && this._pointerDownY !== null) {
      const d = Math.hypot(clientX - this._pointerDownX, clientY - this._pointerDownY);
      if (d >= this.DRAG_THRESHOLD_PX) this._isDragging = true;
    }

    const sp = { x: clientX - rectLeft, y: clientY - rectTop };
    let point = screenToData(sp, this._viewport);

    // Shift snap: if shift held and we have a draft in progress, snap angle
    if (this._shiftHeld && this._engine.draft && this._options.shiftSnap) {
      const anchors = this._engine.draft.anchors;
      if (anchors.length >= 1) {
        // Snap screen point to 15° increments from anchor[0]
        const a0 = this._dataToScreenRaw(anchors[0]);
        if (a0) {
          const snapped = snapAngle15(a0, sp);
          point = screenToData(snapped, this._viewport);
        }
      }
    }

    this._engine.pointerMove(point);
  }

  handlePointerUp(clientX: number, clientY: number, rectLeft: number, rectTop: number): void {
    if (!this._viewport) return;

    const wasDragging = this._isDragging;
    this._isDragging = false;
    this._pointerDownX = null;
    this._pointerDownY = null;

    const sp = { x: clientX - rectLeft, y: clientY - rectTop };
    const point = screenToData(sp, this._viewport);

    // For drag-based tools (trend line, rectangle), finalize on pointer up
    if (wasDragging && this._engine.draft) {
      const committed = this._engine.pointerUp(point, true);
      if (committed && this._demoAltDrawing) {
        // Revert demo+alt drawing mode
        this._engine.clearTool();
        this._demoAltDrawing = false;
      }
    } else {
      this._engine.pointerUp(point, false);
    }

    this._pointerDownPoint = null;
  }

  // ─── Keyboard handlers ───────────────────────────────────────────────────

  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._engine.cancel();
      if (this._demoAltDrawing) {
        this._engine.clearTool();
        this._demoAltDrawing = false;
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      this._engine.deleteSelected();
      return;
    }

    if (e.key === 'Alt') {
      e.preventDefault();
      this._altHeld = true;
    }

    if (e.key === 'Shift') {
      this._shiftHeld = true;
    }
  }

  private _onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt') {
      this._altHeld = false;
      // If alt released mid-demo-drawing, keep the draft active until pointer up
    }
    if (e.key === 'Shift') {
      this._shiftHeld = false;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _dataToScreenRaw(point: DrawPoint): { x: number; y: number } | null {
    if (!this._viewport) return null;
    const vp = this._viewport;
    const chartW = vp.width - vp.priceAxisWidth;
    const chartH = vp.height - vp.timeAxisHeight;
    const tRange = Number(vp.visibleTo) - Number(vp.visibleFrom);
    if (tRange === 0) return null;
    const x = ((Number(point.time) - Number(vp.visibleFrom)) / tRange) * chartW;
    const pRange = vp.priceMax - vp.priceMin;
    if (pRange === 0) return null;
    const y = chartH - ((point.price - vp.priceMin) / pRange) * chartH;
    return { x, y };
  }
}
