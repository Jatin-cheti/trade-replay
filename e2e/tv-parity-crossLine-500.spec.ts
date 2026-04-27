/** TV-Parity 500 Tests — CROSS LINE (1-anchor click-commit, infinite both axes). */
import { register500ToolSuite } from "./tv-parity-500-factory";
register500ToolSuite({
  variant: "crossLine",
  testId: "tool-cross-line",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "cross",
});
