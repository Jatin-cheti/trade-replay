/**
 * TV-Parity 500 Tests — Elliott Triple Combo (5-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "elliottTripleCombo",
  testId: "tool-elliottTripleCombo",
  railTestId: "rail-patterns",
  anchorCount: 5,
  commitMode: "click-sequence",
});
