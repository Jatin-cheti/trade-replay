/**
 * TV-Parity 500 Tests — Note (text category)
 * 1-anchor click-commit drawing. Opens text editor after placement.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "note",
  testId: "tool-note",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
