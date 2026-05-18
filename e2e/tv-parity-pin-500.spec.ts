/**
 * TV-Parity 500 Tests — Pin (text category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "pin",
  testId: "tool-pin",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
