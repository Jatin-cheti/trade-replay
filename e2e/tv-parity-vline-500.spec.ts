/** TV-Parity 500 Tests — VLINE (1-anchor click-commit, infinite vertical). */
import { register500ToolSuite } from "./tv-parity-500-factory";
register500ToolSuite({
  variant: "vline",
  testId: "tool-vertical-line",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "vertical",
});
