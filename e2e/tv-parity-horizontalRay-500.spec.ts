/** TV-Parity 500 Tests — HORIZONTAL RAY tool (1-anchor click-commit, extends right). */
import { register500ToolSuite } from "./tv-parity-500-factory";
register500ToolSuite({
  variant: "horizontalRay",
  testId: "tool-horizontal-ray",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontalRay",
});
