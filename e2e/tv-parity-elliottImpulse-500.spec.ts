/**
 * TV-Parity 500 Tests — Elliott Impulse (5-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "elliottImpulse",
  testId: "tool-elliottImpulse",
  railTestId: "rail-patterns",
  anchorCount: 5,
  commitMode: "click-sequence",
});
