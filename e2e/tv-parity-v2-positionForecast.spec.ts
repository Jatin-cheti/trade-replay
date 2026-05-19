/**
 * TV-Parity V2 — 500 comprehensive tests for "positionForecast".
 * Tests: geometry(100), selection(50), edge-persistence(40), undo(50),
 *        toolbar(40), multi(30), delete(30), drag-anchor(30), escape(30),
 *        rr-label/fill-zone(100) = 500
 *
 * 3-anchor position forecast tool. Blue default (#2962ff).
 * Rail: rail-forecasting  testId: tool-positionForecast
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "positionForecast",
  testId: "tool-positionForecast",
  railTestId: "rail-forecasting",
  kind: "position",
  anchorCount: 3,
  commitMode: "click-sequence",
});
