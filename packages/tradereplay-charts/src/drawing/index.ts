/**
 * Drawing module public API.
 *
 * Import from '@tradereplay/charts/drawing' or via the main package export.
 *
 * Architecture: ALL drawing logic lives here in the library.
 * React components only call library APIs — they never implement canvas drawing.
 */

// ─── Core types ──────────────────────────────────────────────────────────────
export type {
  DrawPoint,
  ScreenPoint,
  DataBounds,
  Viewport,
  Drawing,
  DrawingOptions,
  DrawingVariant,
  HitResult,
  HandleDescriptor,
  IDrawingTool,
} from './types.ts';

export type { AxisHighlight } from './types.ts';

export { DrawingState, DEFAULT_DRAWING_OPTIONS } from './types.ts';

// ─── Geometry utilities ───────────────────────────────────────────────────────
export {
  clamp,
  lerp,
  distancePx,
  dataToScreen,
  screenToData,
  distanceToLine,
  distanceToSegment,
  rayEndpoint,
  reverseRayEndpoint,
  clipSegment,
  snapAngle15,
  snapHV,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
  hexToRgba,
  isInsideDrawingArea,
} from './geometry.ts';

// ─── Engine ───────────────────────────────────────────────────────────────────
export {
  DrawingEngine,
  createDrawingEngine,
  type DrawingEngineEvent,
  type DrawingEngineListener,
} from './engine/drawingEngine.ts';

export {
  InteractionManager,
  type InteractionManagerOptions,
} from './engine/interactionManager.ts';

// ─── Tools ───────────────────────────────────────────────────────────────────
export { BaseTool } from './tools/base.ts';
export {
  TrendLineTool,
  RayLineTool,
  HorizontalLineTool,
  VerticalLineTool,
  RectangleTool,
  createDefaultTools,
} from './tools/index.ts';

// ─── Convenience factory ──────────────────────────────────────────────────────
import { createDrawingEngine } from './engine/drawingEngine.ts';
import { createDefaultTools } from './tools/index.ts';
import type { IDrawingTool } from './types.ts';

/**
 * Create a DrawingEngine with all default tools pre-registered.
 * This is the recommended entry point for most use cases.
 *
 * @example
 * ```ts
 * const engine = createDefaultDrawingEngine();
 * engine.setViewport(viewport);
 * engine.selectTool('trend');
 * engine.on(event => { if (event.type === 'renderRequested') canvas.render(); });
 * ```
 */
export function createDefaultDrawingEngine(extraTools: IDrawingTool[] = []) {
  return createDrawingEngine([...createDefaultTools(), ...extraTools]);
}
