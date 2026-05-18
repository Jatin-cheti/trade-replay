/**
 * Prod Parity — Slot A (Browser 1)
 * =================================
 * Runs on tradereplay.me — shared-page pattern (no browser close/reopen per test).
 * Tools: longPosition, barPattern, fixedRangeVolumeProfile, dateRange,
 *        highlighter, arrowMarkUp, rotatedRectangle, ellipse, arc
 *
 * Each tool: 500 scenarios on ONE persistent page.
 * Total: 9 tools × 500 = 4,500 tests
 */

import { ALL_PROD_TOOLS, registerProdParitySharedSuite } from "./prod-parity-shared-factory";

// Slot A = indices 0,3,6,9,12,15,18,21,24
const SLOT_TOOLS = ALL_PROD_TOOLS.filter((_, i) => i % 3 === 0);

for (const tool of SLOT_TOOLS) {
  registerProdParitySharedSuite(tool);
}
