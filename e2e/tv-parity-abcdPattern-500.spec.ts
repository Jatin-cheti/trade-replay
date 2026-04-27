/**
 * TV-Parity 500 Tests — ABCD pattern (4-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "abcdPattern",
  testId: "tool-abcdPattern",
  railTestId: "rail-patterns",
  anchorCount: 4,
  commitMode: "click-sequence",
});
