/**
 * TV-Parity 500 Tests — Emoji (icon category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "emoji",
  testId: "tool-emoji",
  railTestId: "rail-icon",
  anchorCount: 1,
  commitMode: "click",
});
