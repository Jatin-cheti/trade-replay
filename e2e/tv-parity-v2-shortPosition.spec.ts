/**
 * TV-Parity V2 — 500 comprehensive tests for "shortPosition".
 * Tests: geometry(100), selection(50), edge-persistence(40), undo(50),
 *        toolbar(40), multi(30), delete(30), drag-anchor(30), escape(30),
 *        rr-label/fill-zone(100) = 500
 *
 * Draw: single drag from entry to target; stop mirrored.
 * Red zone = entry→target, Green zone = entry→stop.
 * Rail: rail-forecasting  testId: tool-shortPosition
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "shortPosition",
  testId: "tool-shortPosition",
  railTestId: "rail-forecasting",
  kind: "position",
  anchorCount: 3,
  commitMode: "click-sequence",
});
