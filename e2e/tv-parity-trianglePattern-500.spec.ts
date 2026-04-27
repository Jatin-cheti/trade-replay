/**
 * TV-Parity 500 Tests — Triangle pattern (3-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "trianglePattern",
  testId: "tool-trianglePattern",
  railTestId: "rail-patterns",
  anchorCount: 3,
  commitMode: "click-sequence",
});
