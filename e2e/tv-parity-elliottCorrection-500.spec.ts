/**
 * TV-Parity 500 Tests — Elliott Correction (3-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "elliottCorrection",
  testId: "tool-elliottCorrection",
  railTestId: "rail-patterns",
  anchorCount: 3,
  commitMode: "click-sequence",
});
