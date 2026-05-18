/**
 * TV-Parity 500 Tests — Table (text category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "table",
  testId: "tool-table",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
