/**
 * tv-capture-slot3.spec.ts
 * ========================
 * TV Capture automation — SLOT 3 of 3 (runs in Browser 3)
 * Covers 9 of the 27 tools (indices 2,5,8,11,14,17,20,23,26 from ALL_CAPTURE_TOOLS)
 * → 9 tools × 500 scenarios = 4,500 tests per cycle on tradingview.com
 *
 * Run:
 *   cd tradereplay
 *   npx playwright test e2e/tv-capture-slot3.spec.ts \
 *     --config=e2e/playwright.tv-capture-slots.config.ts \
 *     --project=chromium --headed --workers=1
 */
import { ALL_CAPTURE_TOOLS, registerCaptureSuite } from "./tv-capture-factory";

// Slot 3 = every 3rd tool starting at index 2
const SLOT_TOOLS = ALL_CAPTURE_TOOLS.filter((_, i) => i % 3 === 2);
// Tools: positionForecast(2), anchoredVwap(5), priceRange(8),
//        brush(11), arrowTool(14), rectangle(17),
//        circle(20), triangle(23), doubleCurve(26)

registerCaptureSuite(SLOT_TOOLS);
