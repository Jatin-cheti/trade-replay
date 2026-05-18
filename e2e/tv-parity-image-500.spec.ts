/**
 * TV-Parity 500 Tests — Image (text/content category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "image",
  testId: "tool-image",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
