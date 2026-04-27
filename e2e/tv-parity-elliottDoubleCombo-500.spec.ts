/**
 * TV-Parity 500 Tests — Elliott Double Combo (3-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "elliottDoubleCombo",
  testId: "tool-elliottDoubleCombo",
  railTestId: "rail-patterns",
  anchorCount: 3,
  commitMode: "click-sequence",
});
