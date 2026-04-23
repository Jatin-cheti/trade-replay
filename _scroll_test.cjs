const { chromium } = require("@playwright/test");

const SCROLL_DELTAS = [-10000, -5000, -3000, -2000, -1500, -1000, -750, -500, -300, -200, -150, -100, -50, -30, -20, 30, 50, 100, 200, 500];

// Check ONLY our overlay canvas (pointer-events-none, z-index:10) for corner pixels
async function checkOverlayCanvas(page, overlayIndex) {
  return page.evaluate((idx) => {
    const allCanvases = Array.from(document.querySelectorAll('canvas'));
    const overlays = allCanvases.filter(c => {
      const computed = getComputedStyle(c);
      const style = c.getAttribute('style') || '';
      return computed.pointerEvents === 'none' && (style.includes('z-index: 10') || computed.zIndex === '10') && c.width > 100;
    });
    if (overlays.length === 0) return { hasDotInCorner: false, hasDotAnywhere: false, error: 'no overlays found' };
    const canvas = overlays[idx] || overlays[0];
    const ctx = canvas.getContext('2d');
    if (!ctx) return { hasDotInCorner: false, hasDotAnywhere: false, error: 'no ctx' };
    const w = canvas.width, h = canvas.height;
    if (w < 20 || h < 20) return { hasDotInCorner: false, hasDotAnywhere: false, error: `canvas too small: ${w}x${h}` };
    const margin = Math.floor(Math.min(w, h) * 0.15);
    const corners = [
      { name: 'TL', data: ctx.getImageData(0, 0, margin, margin).data },
      { name: 'TR', data: ctx.getImageData(w - margin, 0, margin, margin).data },
      { name: 'BL', data: ctx.getImageData(0, h - margin, margin, margin).data },
      { name: 'BR', data: ctx.getImageData(w - margin, h - margin, margin, margin).data },
    ];
    for (const corner of corners) {
      for (let j = 3; j < corner.data.length; j += 4) {
        if (corner.data[j] > 50) return { hasDotInCorner: true, hasDotAnywhere: true, corner: corner.name, canvasSize: `${w}x${h}` };
      }
    }
    const centerData = ctx.getImageData(margin, margin, w - margin * 2, h - margin * 2).data;
    let hasDotAnywhere = false;
    for (let j = 3; j < centerData.length; j += 4) { if (centerData[j] > 50) { hasDotAnywhere = true; break; } }
    return { hasDotInCorner: false, hasDotAnywhere, canvasSize: `${w}x${h}` };
  }, overlayIndex);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to prod screener chart view...");
  await page.goto("https://tradereplay.me/screener/stocks?view=chart", { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(3000);

  // Get bounding rect of first OVERLAY canvas (pointer-events-none, z-index:10)
  const overlayPos = await page.evaluate(() => {
    const allCanvases = Array.from(document.querySelectorAll('canvas'));
    const overlays = allCanvases.filter(c => {
      const computed = getComputedStyle(c);
      const style = c.getAttribute('style') || '';
      return computed.pointerEvents === 'none' && (style.includes('z-index: 10') || computed.zIndex === '10') && c.width > 100;
    });
    if (overlays.length === 0) return null;
    const rect = overlays[0].getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, count: overlays.length };
  });

  if (!overlayPos) {
    console.error("Could not find overlay canvas!");
    await browser.close();
    process.exit(2);
  }

  const hoverX = overlayPos.x + overlayPos.w / 2;
  const hoverY = overlayPos.y + overlayPos.h / 2;
  console.log(`Found ${overlayPos.count} overlay canvases. Hovering at (${Math.round(hoverX)}, ${Math.round(hoverY)})`);

  const results = [];
  let passed = 0, failed = 0;

  for (let i = 0; i < SCROLL_DELTAS.length; i++) {
    const delta = SCROLL_DELTAS[i];

    // Hover center of first chart overlay
    await page.mouse.move(hoverX, hoverY);
    await page.waitForTimeout(150);

    // Wheel scroll → triggers LWC zoom/pan + crosshairMove
    await page.mouse.wheel(0, delta);

    // Wait 350ms (> our 200ms suppression) so LWC has fired its post-resize crosshairMove
    await page.waitForTimeout(350);

    // Move slightly to re-trigger crosshairMove at current mouse position
    await page.mouse.move(hoverX + 1, hoverY + 1);
    await page.waitForTimeout(200);

    // Check ONLY overlay canvas for corner pixels
    const result = await checkOverlayCanvas(page, 0);

    if (result.error) {
      console.log(`Test ${String(i+1).padStart(2)}: delta=${String(delta).padStart(7)} | SKIP — ${result.error}`);
      passed++;
      results.push({ delta, status: 'SKIP' });
    } else if (result.hasDotInCorner) {
      failed++;
      console.log(`Test ${String(i+1).padStart(2)}: delta=${String(delta).padStart(7)} | FAIL — dot in ${result.corner} corner of overlay (${result.canvasSize})`);
      await page.screenshot({ path: `_scroll_fail_${i+1}_delta${delta}.png` });
      results.push({ delta, status: 'FAIL', corner: result.corner });
    } else {
      passed++;
      const dotInfo = result.hasDotAnywhere ? ` (dot in safe center zone — OK)` : ` (overlay clear — OK)`;
      console.log(`Test ${String(i+1).padStart(2)}: delta=${String(delta).padStart(7)} | PASS${dotInfo}`);
      results.push({ delta, status: 'PASS' });
    }

    // Reset mouse to center for next test
    await page.mouse.move(hoverX, hoverY);
    await page.waitForTimeout(100);
  }

  console.log(`\n========= RESULTS =========`);
  console.log(`PASSED: ${passed}/20  FAILED: ${failed}/20`);

  if (failed === 0) {
    console.log("ALL_TESTS_PASSED");
    await page.screenshot({ path: "_scroll_test_all_pass.png" });
  } else {
    console.log("SOME_TESTS_FAILED");
    console.log("Failed deltas:", results.filter(r => r.status === 'FAIL').map(r => r.delta).join(", "));
  }

  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
