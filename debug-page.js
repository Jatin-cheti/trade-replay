const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  const networkErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));
  page.on('requestfailed', req => networkErrors.push(`FAIL: ${req.url()} - ${req.failure()?.errorText}`));
  page.on('response', res => {
    if (res.status() >= 400) networkErrors.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  try {
    const resp = await page.goto('http://127.0.0.1:8080/charts?symbol=RELIANCE', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('Initial response status:', resp?.status());
    await page.waitForTimeout(15000);
    await page.screenshot({ path: 'debug-page2.png', fullPage: true });
    const url = page.url();
    const title = await page.title();
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 2000));
    const hasCc = await page.evaluate(() => !!document.querySelector('[data-testid="chart-container"]'));
    console.log('Final URL:', url);
    console.log('Title:', title);
    console.log('Has chart-container:', hasCc);
    console.log('Body HTML:', bodyHTML);
    console.log('Console errors:', consoleErrors.slice(0, 20));
    console.log('Network errors:', networkErrors.slice(0, 20));
  } catch(e) {
    console.error('Error:', e.message);
  }
  await browser.close();
})();
