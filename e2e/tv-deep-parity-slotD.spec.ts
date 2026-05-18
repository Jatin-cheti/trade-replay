/**
 * tv-deep-parity-slotD.spec.ts
 * ─────────────────────────────
 * Slot D — Browser 4 of 6.
 * Runs the NEW 500-scenario deep-parity suite against tradingview.com
 * for tools at indices 0, 3, 6, 9, 12, 15, 18, 21, 24 (9 tools × 500 = 4 500 tests).
 *
 * Tools: longPosition, barPattern, fixedRangeVolumeProfile, dateRange,
 *        highlighter, arrowMarkUp, rotatedRectangle, ellipse, arc
 */

import { ALL_DEEP_TOOLS, registerDeepParitySuite } from "./tv-deep-parity-factory";

const SLOT_D_INDICES = [0, 3, 6, 9, 12, 15, 18, 21, 24];

for (const idx of SLOT_D_INDICES) {
  registerDeepParitySuite(ALL_DEEP_TOOLS[idx]);
}
