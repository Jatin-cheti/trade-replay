/**
 * TV-Parity 500 Tests — Disjoint channel (4-anchor click-sequence).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

// Disjoint channel has 4 anchors but commits on a single pointer drag
// (down → move → up); remaining anchors auto-fill.
register500ToolSuite({
  variant: "disjointChannel",
  testId: "tool-disjoint-channel",
  anchorCount: 4,
});
