/**
 * TV-Parity 500 Tests — Post (text/content category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "post",
  testId: "tool-post",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
