/**
 * TV-Parity V2 — 500 comprehensive tests for "ghostFeed".
 * Drag-commit tool projecting a dashed forward price path.
 * Rail: rail-forecasting  testId: tool-ghostFeed
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "ghostFeed",
  testId: "tool-ghostFeed",
  railTestId: "rail-forecasting",
  kind: "ghostFeed",
  anchorCount: 2,
  commitMode: "drag",
});
