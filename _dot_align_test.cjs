const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  
  await page.goto('https://tradereplay.me/screener/stocks?view=chart', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  // Find first visible chart card container
  const cards = await page.$$('[data-testid="screener-chart-card"]');
  if (!cards.length) {
    console.log('No chart cards found');
    await browser.close();
    return;
  }
  
  const card = cards[0];
  const bbox = await card.boundingBox();
  if (!bbox) {
    console.log('No bbox for card');
    await browser.close();
    return;
  }
  
  console.log(`Card bbox: x=${bbox.x} y=${bbox.y} w=${bbox.width} h=${bbox.height}`);
  
  // Find the overlay canvas within the card
  const overlayCanvas = await card.$('canvas');
  
  // Hover at center of chart
  const hoverX = bbox.x + bbox.width / 2;
  const hoverY = bbox.y + bbox.height / 2;
  
  await page.mouse.move(hoverX, hoverY);
  await page.waitForTimeout(500);
  
  // Take screenshot with dot visible
  const screenshotPath = '_dot_align_test_hover.png';
  await page.screenshot({ path: screenshotPath, clip: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height + 50 } });
  console.log(`Screenshot saved: ${screenshotPath}`);
  
  // Now test scroll at 5 different speeds and take screenshots
  const scrollDeltas = [30, 50, 100, 200, 500];
  for (const delta of scrollDeltas) {
    await page.mouse.move(hoverX, hoverY);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(300);
    const screenshotName = `_dot_align_scroll_${delta}.png`;
    await page.screenshot({ path: screenshotName, clip: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height + 50 } });
    console.log(`Scroll delta=${delta} screenshot saved`);
  }
  
  // Also test negative scroll
  for (const delta of [-30, -50, -100]) {
    await page.mouse.move(hoverX, hoverY);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(300);
    const screenshotName = `_dot_align_scroll_neg${Math.abs(delta)}.png`;
    await page.screenshot({ path: screenshotName, clip: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height + 50 } });
    console.log(`Scroll delta=${delta} screenshot saved`);
  }
  
  console.log('All screenshots taken.');
  await browser.close();
})();
