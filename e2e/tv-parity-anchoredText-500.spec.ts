/**
 * TV-Parity 500 Tests — Anchored Text (text category)
 * 1-anchor click-commit drawing. Opens text editor after placement.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "anchoredText",
  testId: "tool-anchoredText",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
