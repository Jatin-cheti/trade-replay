/**
 * TV-Parity 500 Tests — XABCD pattern (5-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "xabcd",
  testId: "tool-xabcd",
  railTestId: "rail-patterns",
  anchorCount: 5,
  commitMode: "click-sequence",
});
