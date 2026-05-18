/**
 * TV-Parity 500 Tests — Price Label (text category)
 * 1-anchor click-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "priceLabel",
  testId: "tool-priceLabel",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
});
