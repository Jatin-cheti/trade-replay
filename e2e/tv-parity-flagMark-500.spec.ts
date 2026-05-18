/**
 * TV-Parity 500 Tests — Flag Mark (text category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "flagMark",
  testId: "tool-flagMark",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
