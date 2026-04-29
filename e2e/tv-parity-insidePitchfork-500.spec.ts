/**
 * TV-Parity 500 Tests — Inside pitchfork (3-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

// Pitchforks are family='fib' with 3 anchors that commit on a single
// pointer drag (down → move → up); remaining anchors auto-fill.
register500ToolSuite({
  variant: "insidePitchfork",
  testId: "tool-inside-pitchfork",
  anchorCount: 3,
});
