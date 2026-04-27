/** TV-Parity 500 Tests — HLINE (1-anchor click-commit, infinite horizontal). */
import { register500ToolSuite } from "./tv-parity-500-factory";
register500ToolSuite({
  variant: "hline",
  testId: "tool-horizontal-line",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
