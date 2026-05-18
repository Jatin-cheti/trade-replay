/**
 * TV-Parity 500 Tests — Callout (text category)
 * 1-anchor click-commit drawing. Opens text editor after placement.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "callout",
  testId: "tool-callout",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
