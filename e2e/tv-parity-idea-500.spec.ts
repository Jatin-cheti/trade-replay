/**
 * TV-Parity 500 Tests — Idea (text/content category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "idea",
  testId: "tool-idea",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
