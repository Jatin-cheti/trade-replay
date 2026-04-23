import { test, expect } from '@playwright/test';

test('screener chart view detailed DOM inspect', async ({ page }) => {
  test.setTimeout(90000);

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[page-${msg.type()}]`, msg.text());
    }
  });

  await page.goto('https://tradereplay.me/screener/stocks', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);
  await page.getByRole('button', { name: /chart/i }).first().click().catch(() => {});
  await page.waitForSelector('[data-testid="screener-chart-card"]', { timeout: 25000 });
  await page.waitForTimeout(4000);

  const domInfo = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="screener-chart-card"]') as HTMLElement | null;
    if (!card) return { error: 'no card found' };

    const cardRect = card.getBoundingClientRect();
    const chartArea = card.children[card.children.length - 1] as HTMLElement;
    const chartAreaRect = chartArea.getBoundingClientRect();

    // Walk all descendants of chart area and capture tag, class, rect, computed style essentials
    const walker: Array<Record<string, unknown>> = [];
    function walk(el: Element, depth: number) {
      const e = el as HTMLElement;
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      walker.push({
        depth,
        tag: e.tagName,
        class: e.className?.toString().slice(0, 120) || '',
        pos: cs.position,
        display: cs.display,
        top: cs.top, bottom: cs.bottom, left: cs.left, right: cs.right,
        w: r.width, h: r.height,
        offW: e.offsetWidth, offH: e.offsetHeight,
        clientW: e.clientWidth, clientH: e.clientHeight,
        styleW: e.style.width, styleH: e.style.height,
      });
      for (const child of Array.from(el.children)) walk(child, depth + 1);
    }
    walk(chartArea, 0);

    return {
      card: { w: cardRect.width, h: cardRect.height },
      chartArea: { w: chartAreaRect.width, h: chartAreaRect.height, clientH: chartArea.clientHeight },
      descendants: walker,
    };
  });

  console.log('[diag] DOM inspection:');
  console.log(JSON.stringify(domInfo, null, 2));

  expect(true).toBe(true);
});
