/**
 * tv-capture-slot2.spec.ts
 * ========================
 * TV Capture automation — SLOT 2 of 3 (runs in Browser 2)
 * Covers 9 of the 27 tools (indices 1,4,7,10,13,16,19,22,25 from ALL_CAPTURE_TOOLS)
 * → 9 tools × 500 scenarios = 4,500 tests per cycle on tradingview.com
 *
 * Run:
 *   cd tradereplay
 *   npx playwright test e2e/tv-capture-slot2.spec.ts \
 *     --config=e2e/playwright.tv-capture-slots.config.ts \
 *     --project=chromium --headed --workers=1
 */
import { ALL_CAPTURE_TOOLS, registerCaptureSuite } from "./tv-capture-factory";

// Slot 2 = every 3rd tool starting at index 1
const SLOT_TOOLS = ALL_CAPTURE_TOOLS.filter((_, i) => i % 3 === 1);
// Tools: shortPosition(1), ghostFeed(4), anchoredVolumeProfile(7),
//        dateAndPriceRange(10), arrowMarker(13), arrowMarkDown(16),
//        path(19), polyline(22), curveTool(25)

registerCaptureSuite(SLOT_TOOLS);
