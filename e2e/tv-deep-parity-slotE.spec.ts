/**
 * tv-deep-parity-slotE.spec.ts
 * ─────────────────────────────
 * Slot E — Browser 5 of 6.
 * Runs the NEW 500-scenario deep-parity suite against tradingview.com
 * for tools at indices 1, 4, 7, 10, 13, 16, 19, 22, 25 (9 tools × 500 = 4 500 tests).
 *
 * Tools: shortPosition, ghostFeed, anchoredVolumeProfile, dateAndPriceRange,
 *        arrowMarker, arrowMarkDown, path, polyline, curveTool
 */

import { ALL_DEEP_TOOLS, registerDeepParitySuite } from "./tv-deep-parity-factory";

const SLOT_E_INDICES = [1, 4, 7, 10, 13, 16, 19, 22, 25];

for (const idx of SLOT_E_INDICES) {
  registerDeepParitySuite(ALL_DEEP_TOOLS[idx]);
}
