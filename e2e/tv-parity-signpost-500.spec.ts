/**
 * TV-Parity 500 Tests — Signpost (text category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "signpost",
  testId: "tool-signpost",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
