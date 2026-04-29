/**
 * TV-Parity 500 Tests — Pitchfork (3-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

// Pitchforks are family='fib' with 3 anchors that commit on a single
// pointer drag (down → move → up); remaining anchors auto-fill.
register500ToolSuite({
  variant: "pitchfork",
  testId: "tool-pitchfork",
  anchorCount: 3,
});
