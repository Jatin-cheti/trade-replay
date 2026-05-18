/**
 * TV-Parity 500 Tests — Icon Tool (icon category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "iconTool",
  testId: "tool-iconTool",
  railTestId: "rail-icon",
  anchorCount: 1,
  commitMode: "click",
});
