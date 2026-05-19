/**
 * TV-Parity V2 — 500 comprehensive tests for "sticker".
 * Single-click sticker/badge marker placed on chart.
 * Default color #2962ff. Rail: rail-icon  testId: tool-sticker
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "sticker",
  testId: "tool-sticker",
  railTestId: "rail-icon",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
