/**
 * TV-Parity V2 — 500 comprehensive tests for "highlighter".
 * Semi-transparent wide freehand stroke. Default color #ffeb3b (yellow).
 * Rail: rail-brush  testId: tool-highlighter
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "highlighter",
  testId: "tool-highlighter",
  railTestId: "rail-brush",
  kind: "brush",
  anchorCount: 2,
  commitMode: "drag",
});
