/**
 * Prod Parity — Slot C (Browser 3)
 * =================================
 * Runs on tradereplay.me — shared-page pattern (no browser close/reopen per test).
 * Tools: positionForecast, anchoredVwap, priceRange, brush,
 *        arrowTool, rectangle, circle, triangle, doubleCurve
 *
 * Each tool: 500 scenarios on ONE persistent page.
 * Total: 9 tools × 500 = 4,500 tests
 */

import { ALL_PROD_TOOLS, registerProdParitySharedSuite } from "./prod-parity-shared-factory";

// Slot C = indices 2,5,8,11,14,17,20,23,26
const SLOT_TOOLS = ALL_PROD_TOOLS.filter((_, i) => i % 3 === 2);

for (const tool of SLOT_TOOLS) {
  registerProdParitySharedSuite(tool);
}
