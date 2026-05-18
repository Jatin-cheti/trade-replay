/**
 * tv-deep-parity-slotF.spec.ts
 * ─────────────────────────────
 * Slot F — Browser 6 of 6.
 * Runs the NEW 500-scenario deep-parity suite against tradingview.com
 * for tools at indices 2, 5, 8, 11, 14, 17, 20, 23, 26 (9 tools × 500 = 4 500 tests).
 *
 * Tools: positionForecast, anchoredVwap, priceRange, brush,
 *        arrowTool, rectangle, circle, triangle, doubleCurve
 */

import { ALL_DEEP_TOOLS, registerDeepParitySuite } from "./tv-deep-parity-factory";

const SLOT_F_INDICES = [2, 5, 8, 11, 14, 17, 20, 23, 26];

for (const idx of SLOT_F_INDICES) {
  registerDeepParitySuite(ALL_DEEP_TOOLS[idx]);
}
