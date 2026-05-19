/**
 * TV-Parity V2 — 500 comprehensive tests for "longPosition".
 * Tests: geometry(100), selection(50), edge-persistence(40), undo(50),
 *        toolbar(40), multi(30), delete(30), drag-anchor(30), escape(30),
 *        rr-label/fill-zone(100) = 500
 *
 * Draw: single drag from entry (left) to target (right); stop is mirrored.
 * Green zone = entry→target, Red zone = entry→stop.
 * Floating label: R:R ratio + target/stop prices.
 * Rail: rail-forecasting  testId: tool-longPosition
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "longPosition",
  testId: "tool-longPosition",
  railTestId: "rail-forecasting",
  kind: "position",
  anchorCount: 3,
  commitMode: "click-sequence",
});
