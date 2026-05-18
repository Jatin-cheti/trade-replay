/**
 * tv-capture-slot1.spec.ts
 * ========================
 * TV Capture automation — SLOT 1 of 3 (runs in Browser 1)
 * Covers 9 of the 27 tools (indices 0,3,6,9,12,15,18,21,24 from ALL_CAPTURE_TOOLS)
 * → 9 tools × 500 scenarios = 4,500 tests per cycle on tradingview.com
 *
 * Run:
 *   cd tradereplay
 *   npx playwright test e2e/tv-capture-slot1.spec.ts \
 *     --config=e2e/playwright.tv-capture-slots.config.ts \
 *     --project=chromium --headed --workers=1
 */
import { ALL_CAPTURE_TOOLS, registerCaptureSuite } from "./tv-capture-factory";

// Slot 1 = every 3rd tool starting at index 0
const SLOT_TOOLS = ALL_CAPTURE_TOOLS.filter((_, i) => i % 3 === 0);
// Tools: longPosition(0), barPattern(3), fixedRangeVolumeProfile(6),
//        dateRange(9), highlighter(12), arrowMarkUp(15),
//        rotatedRectangle(18), ellipse(21), arc(24)

registerCaptureSuite(SLOT_TOOLS);
