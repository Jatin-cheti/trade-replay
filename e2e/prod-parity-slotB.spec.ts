/**
 * Prod Parity — Slot B (Browser 2)
 * =================================
 * Runs on tradereplay.me — shared-page pattern (no browser close/reopen per test).
 * Tools: shortPosition, ghostFeed, anchoredVolumeProfile, dateAndPriceRange,
 *        arrowMarker, arrowMarkDown, path, polyline, curveTool
 *
 * Each tool: 500 scenarios on ONE persistent page.
 * Total: 9 tools × 500 = 4,500 tests
 */

import { ALL_PROD_TOOLS, registerProdParitySharedSuite } from "./prod-parity-shared-factory";

// Slot B = indices 1,4,7,10,13,16,19,22,25
const SLOT_TOOLS = ALL_PROD_TOOLS.filter((_, i) => i % 3 === 1);

for (const tool of SLOT_TOOLS) {
  registerProdParitySharedSuite(tool);
}
