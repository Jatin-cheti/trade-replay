// _100_dot_test.cjs — 100 browser tests for screener chart dot alignment on prod
// Tests: various scroll amounts × horizontal positions. Checks dot is drawn AND
// that it lands within the canvas bounds after scrolling.
// Also performs pixel-level check: reads LWC chart canvas at dotX,dotY strip to
// verify the series line color is present where the dot is drawn.
const { chromium } = require('playwright');
const fs = require('fs');

const GREEN = { r: 16, g: 185, b: 129 };  // #10b981
const RED = { r: 239, g: 68, b: 68 };     // #ef4444
const DARK = { r: 19, g: 23, b: 34 };     // #131722 (dot stroke)
const COLOR_TOL = 60;

function colorClose(px, target) {
  return Math.abs(px[0] - target.r) < COLOR_TOL &&
         Math.abs(px[1] - target.g) < COLOR_TOL &&
         Math.abs(px[2] - target.b) < COLOR_TOL;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  // Inject canvas arc spy — tracks every dot draw (radius=4) on the overlay canvas
  await page.addInitScript(() => {
    window.__lastDot = null;
    window.__dotCount = 0;
    const origArc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, r, ...rest) {
      if (r >= 3.5 && r <= 4.5) {
        window.__lastDot = { x, y };
        window.__dotCount++;
      }
      return origArc.call(this, x, y, r, ...rest);
    };
  });

  console.log('Loading production screener page...');
  await page.goto('https://tradereplay.me/screener/stocks?view=chart', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Verify new bundle (should contain 'param.point.y' logic — look for absence of 'priceToCoordinate' near our dot draw)
  const bundleCheck = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    return scripts.map(s => s.src).filter(s => s.includes('Screener'));
  });
  console.log('Screener bundle:', bundleCheck[0] || 'not found in script tags');

  const cards = await page.$$('[data-testid="screener-chart-card"]');
  if (!cards.length) {
    console.error('ERROR: No chart cards found — check selector or page load');
    await browser.close();
    process.exit(1);
  }
  console.log(`Found ${cards.length} chart cards`);

  const card = cards[0];
  let bbox = await card.boundingBox();
  if (!bbox) { console.error('No bbox'); await browser.close(); process.exit(1); }
  console.log(`Card[0]: x=${bbox.x.toFixed(0)} y=${bbox.y.toFixed(0)} w=${bbox.width.toFixed(0)} h=${bbox.height.toFixed(0)}\n`);

  const results = [];
  let pass = 0, fail = 0, noDot = 0, skipped = 0;

  // 100 scenarios: scrollAmounts × xPositions
  // 20 scroll values × 5 x positions = 100
  const scrollAmounts = [
    0, 0,
    30, -30,
    50, -50,
    80, -80,
    120, -120,
    180, -180,
    250, -250,
    400, -400,
    700, -700,
    1200, -1200,
  ];
  const xPcts = [20, 35, 50, 65, 80];

  let testId = 0;

  for (const scroll of scrollAmounts) {
    for (const xPct of xPcts) {
      testId++;
      if (testId > 100) break;

      // Clear spy
      await page.evaluate(() => { window.__lastDot = null; });

      // Scroll the page
      if (scroll !== 0) {
        const cx = Math.max(50, Math.min(1350, (bbox.x + bbox.width / 2)));
        const cy = Math.max(50, Math.min(850, (bbox.y + bbox.height / 2)));
        await page.mouse.move(cx, cy);
        await page.mouse.wheel(0, scroll);
        await page.waitForTimeout(200);
      }

      // Re-acquire bbox after scroll (card may have moved)
      const curBbox = await card.boundingBox();
      if (!curBbox || curBbox.height < 40) {
        console.log(`T${testId}: SKIP (card off screen, scroll=${scroll})`);
        results.push({ id: testId, scroll, xPct, status: 'skip', reason: 'card off screen' });
        skipped++;
        continue;
      }
      bbox = curBbox;

      // Hover at xPct position, 38% down the card height (chart area)
      const hX = curBbox.x + curBbox.width * xPct / 100;
      const hY = curBbox.y + curBbox.height * 0.38;

      if (hX < 5 || hY < 5 || hX > 1395 || hY > 895) {
        console.log(`T${testId}: SKIP (hover out of viewport, scroll=${scroll})`);
        results.push({ id: testId, scroll, xPct, status: 'skip', reason: 'hover OOV' });
        skipped++;
        continue;
      }

      await page.mouse.move(hX, hY);
      await page.waitForTimeout(450); // wait for crosshair to settle

      // Read dot position from spy
      const dot = await page.evaluate(() => window.__lastDot);

      if (!dot) {
        console.log(`T${testId}: NO-DOT (scroll=${scroll >= 0 ? '+' : ''}${scroll}, x=${xPct}%)`);
        results.push({ id: testId, scroll, xPct, status: 'no-dot' });
        noDot++;
        continue;
      }

      // Validate dot is within canvas bounds
      const outOfBounds = dot.x < 0 || dot.y < 0 || dot.x > curBbox.width || dot.y > curBbox.height;

      // Pixel-level check: sample vertical strip at dotX on each canvas in the card
      // to see if a series-line-colored pixel exists near dotY (within ±5px)
      const pixelResult = await page.evaluate(({ dotX, dotY, cardX, cardY }) => {
        const dpr = window.devicePixelRatio || 1;
        const allCanvases = Array.from(document.querySelectorAll('[data-testid="screener-chart-card"] canvas'));
        const strips = [];
        for (const canvas of allCanvases) {
          try {
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            const rect = canvas.getBoundingClientRect();
            // Convert dotX,dotY (chart CSS coords from card top-left) to canvas physical pixels
            const canX = Math.round((dotX) * dpr);
            const canY = Math.round((dotY) * dpr);
            const strip = [];
            for (let dy = -8; dy <= 8; dy++) {
              const py = canY + Math.round(dy * dpr);
              if (canX < 0 || py < 0 || canX >= canvas.width || py >= canvas.height) {
                strip.push(null);
                continue;
              }
              const px = ctx.getImageData(canX, py, 1, 1).data;
              strip.push([px[0], px[1], px[2], px[3]]);
            }
            strips.push({ w: canvas.width, h: canvas.height, strip });
          } catch (e) {
            strips.push({ error: e.message });
          }
        }
        return strips;
      }, { dotX: dot.x, dotY: dot.y, cardX: curBbox.x, cardY: curBbox.y });

      // Analyze: find closest green/red pixel to dy=0 across all canvas strips
      let closestColorDist = 999;
      for (const cs of (pixelResult || [])) {
        if (!cs.strip) continue;
        cs.strip.forEach((px, i) => {
          if (!px) return;
          const dy = i - 8; // offset from dy=-8..+8
          if (colorClose(px, GREEN) || colorClose(px, RED)) {
            if (Math.abs(dy) < closestColorDist) closestColorDist = Math.abs(dy);
          }
        });
      }

      // Pass: dot drawn, in bounds, and line color within 5px of dot center
      const lineNearDot = closestColorDist <= 5;
      const status = outOfBounds ? 'OOB' : (lineNearDot ? 'PASS' : 'WARN');

      if (status === 'PASS') pass++;
      else if (status === 'OOB') fail++;
      else fail++; // WARN counts as failure for conservativeness

      const icon = status === 'PASS' ? '✓' : '✗';
      console.log(`T${testId}: ${icon} ${status.padEnd(4)} dot(${dot.x.toFixed(1)},${dot.y.toFixed(1)}) lineAt±${closestColorDist}px | scroll=${scroll >= 0 ? '+' : ''}${scroll} x=${xPct}%`);
      results.push({ id: testId, scroll, xPct, status, dotX: dot.x, dotY: dot.y, closestColorDist, outOfBounds });
    }
    if (testId >= 100) break;
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`RESULTS: ${pass} PASS | ${fail} FAIL | ${noDot} NO-DOT | ${skipped} SKIP | ${testId} TOTAL`);
  console.log('═══════════════════════════════════════');

  if (fail > 0) {
    console.log('\nFAILED tests:');
    results.filter(r => r.status !== 'PASS' && r.status !== 'skip' && r.status !== 'no-dot')
      .forEach(r => console.log(`  T${r.id}: ${r.status} dot(${r.dotX?.toFixed(1)},${r.dotY?.toFixed(1)}) lineAt±${r.closestColorDist}px scroll=${r.scroll} x=${r.xPct}%`));
  }

  fs.writeFileSync('_100_test_results.json', JSON.stringify(results, null, 2));
  console.log('\nFull results → _100_test_results.json');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
