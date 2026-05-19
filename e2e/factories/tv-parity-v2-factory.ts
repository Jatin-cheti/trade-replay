/**
 * factories/tv-parity-v2-factory.ts
 * ==================================
 * Implements registerV2ToolSuite — the function imported by all
 * tv-parity-v2-*.spec.ts stubs.
 *
 * The "v2" factory delegates to register500ToolSuite for standard 2-anchor
 * line/pattern/fib tools (the ones that were previously stubs). It also
 * re-exports registerExtendedSuite so gap-tool v2 specs can import both
 * from a single factory entry-point.
 *
 * Reason this file lives in `factories/` rather than at the e2e root:
 * tv-parity-v2-factory.ts at the root re-exports from here, keeping
 * the import path in all v2 stubs (`"./tv-parity-v2-factory"`) stable.
 */

import {
  register500ToolSuite,
  type ToolDef,
} from '../tv-parity-500-factory';

import {
  registerExtendedSuite,
  type ExtendedToolDef,
  type ExtendedToolKind,
} from '../tv-parity-extended-factory';

// Re-export everything so gap-tool v2 specs can import from one place.
export { registerExtendedSuite, type ExtendedToolDef, type ExtendedToolKind };

/**
 * V2 tool definition — superset of ToolDef.
 * Adds optional `kind` to route gap tools through registerExtendedSuite.
 */
export type V2ToolDef = ToolDef & {
  /**
   * When provided, routes to registerExtendedSuite instead of
   * register500ToolSuite. Required for position / vwap / volumeProfile /
   * measurer / barPattern / ghostFeed / brush / arrowMark / arrowLine /
   * shape / sector / icon tools.
   */
  kind?: ExtendedToolKind;
};

/**
 * Primary entry-point used by all tv-parity-v2-*.spec.ts files.
 *
 * For line / pattern / fib / gann tools (no `kind`):
 *   delegates to register500ToolSuite — same 500-test geometry/selection/
 *   keyboard/undo suite that the 500 specs use.
 *
 * For gap tools with `kind` set:
 *   delegates to registerExtendedSuite — the kind-aware suite that covers
 *   position R:R labels, VWAP lines, volume histograms, measurer boxes,
 *   brush strokes, arrow stamps, and shape fills.
 */
export function registerV2ToolSuite(def: V2ToolDef): void {
  if (def.kind) {
    registerExtendedSuite(def as ExtendedToolDef);
  } else {
    register500ToolSuite(def);
  }
}
