/**
 * TV-Parity 500 Tests — Elliott Triangle (5-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "elliottTriangle",
  testId: "tool-elliottTriangle",
  railTestId: "rail-patterns",
  anchorCount: 5,
  commitMode: "click-sequence",
});
