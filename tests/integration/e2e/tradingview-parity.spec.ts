import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from './playwright-fixture';
import { apiUrl } from './test-env';

test.setTimeout(420_000);

const OUTPUT_DIR = path.resolve(process.cwd(), process.env.PARITY_OURS_DIR ?? 'docs/tradingview-parity/ours');
const PARITY_SYMBOL = process.env.PARITY_SYMBOL ?? 'SPY';
const PARITY_TIMEFRAME = process.env.PARITY_TIMEFRAME ?? '1m';
const PARITY_INTERVAL_VALUE = process.env.PARITY_INTERVAL_VALUE ?? '1';
const PARITY_DEBUG_DPR = process.env.PARITY_DEBUG_DPR === '1';
const PARITY_DEBUG_VISUAL = process.env.PARITY_DEBUG_VISUAL === '1';
const PARITY_VIEWPORT_FILTER = new Set(
  (process.env.PARITY_VIEWPORTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const PARITY_ROUTE_FILTER = new Set(
  (process.env.PARITY_ROUTES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
] as const;

function routeRootTestId(route: '/simulation' | '/live-market'): 'simulation-page' | 'live-market-page' {
  return route === '/simulation' ? 'simulation-page' : 'live-market-page';
}

async function registerAndLogin(page: Page): Promise<void> {
  const uid = Date.now();
  const email = `tv_parity_${uid}@example.com`;
  const password = 'pass1234';

  await expect
    .poll(async () => {
      const response = await page.request.get(apiUrl('/api/health'));
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post(apiUrl('/api/auth/register'), {
    data: { email, password, name: `tv_parity_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post(apiUrl('/api/auth/login'), {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByPlaceholder('trader@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.locator('form').getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/homepage|\/$/);
}

async function clickByTestId(page: Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
    const target = nodes.find((node) => node instanceof HTMLElement && node.offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) target.click();
  }, testId);
}

async function clickVisible(page: Page, testId: string): Promise<void> {
  try {
    await page.locator(`[data-testid="${testId}"]:visible`).first().click({ timeout: 5_000 });
  } catch {
    await clickByTestId(page, testId);
  }
}

async function dismissBlockingOverlays(page: Page): Promise<void> {
  // Best-effort dismiss for symbol/modal backdrops that can intercept clicks.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(60);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(60);
}

async function waitForChart(page: Page, route: '/simulation' | '/live-market'): Promise<void> {
  await page.goto(`${route}?parityData=1`);
  await expect
    .poll(async () => {
      try {
        return new URL(page.url()).pathname;
      } catch {
        return '';
      }
    }, { timeout: 15_000 })
    .toBe(route);

  const rootTestId = routeRootTestId(route);
  await expect(page.getByTestId(rootTestId).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible({ timeout: 25_000 });
  await expect(page.locator(`[data-testid="${rootTestId}"] [data-testid="chart-container"]:visible`).first()).toBeVisible({ timeout: 10_000 });
}

async function setTimeframeTo1m(page: Page): Promise<void> {
  await dismissBlockingOverlays(page);
  await clickVisible(page, 'timeframe-current');
  const oneMinuteOption = page.locator(`[data-testid="interval-${PARITY_INTERVAL_VALUE}"]:visible`).first();
  if (await oneMinuteOption.count()) {
    try {
      await oneMinuteOption.click({ timeout: 5_000 });
    } catch {
      await page.evaluate((intervalValue) => {
        const target = Array.from(document.querySelectorAll(`[data-testid="interval-${intervalValue}"]`))
          .find((node) => node instanceof HTMLElement && node.offsetParent !== null) as HTMLElement | undefined;
        target?.click();
      }, PARITY_INTERVAL_VALUE);
    }
    return;
  }
  await page.keyboard.press('Escape');
}

async function setChartTypeVolumeCandles(page: Page): Promise<void> {
  await dismissBlockingOverlays(page);
  const toggle = page.locator('[data-testid="charttype-dropdown"] > button').first();
  if (!(await toggle.isVisible().catch(() => false))) return;
  try {
    await toggle.click({ timeout: 5_000 });
  } catch {
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="charttype-dropdown"] > button');
      if (button instanceof HTMLElement) button.click();
    });
  }

  const option = page.locator('[data-testid="chart-type-volumeCandles"]:visible').first();
  if (await option.isVisible().catch(() => false)) {
    try {
      await option.click({ timeout: 5_000 });
    } catch {
      await page.evaluate(() => {
        const target = Array.from(document.querySelectorAll('[data-testid="chart-type-volumeCandles"]'))
          .find((node) => node instanceof HTMLElement && node.offsetParent !== null) as HTMLElement | undefined;
        target?.click();
      });
    }
  } else {
    await page.keyboard.press('Escape');
  }
}

async function chooseSymbolFromModal(page: Page, symbol: string): Promise<void> {
  const modal = page.locator('[data-testid="symbol-search-modal"]:visible').first();
  await expect(modal).toBeVisible({ timeout: 10_000 });

  const stocksCategory = page.getByTestId('symbol-category-stocks').first();
  if (await stocksCategory.isVisible().catch(() => false)) {
    await stocksCategory.click({ force: true });
  }

  await page.getByTestId('symbol-search-input').first().fill(symbol);
  const row = page.locator(`[data-testid="symbol-result-row"][data-symbol="${symbol}"]`).first();
  await expect(row).toBeVisible({ timeout: 12_000 });
  await row.evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
    }
  });

  const listingRow = page.locator('[data-testid="symbol-listing-row"]').first();
  if (await listingRow.isVisible().catch(() => false)) {
    await listingRow.click({ timeout: 5_000 });
  }

  const visibleModalCount = async () => page.locator('[data-testid="symbol-search-modal"]:visible').count();
  if (await visibleModalCount()) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }
  if (await visibleModalCount()) {
    await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="symbol-search-modal"]');
      if (!(modal instanceof HTMLElement)) return;
      const closeButton = modal.querySelector('button[aria-label="Close"], [data-testid="symbol-search-close"]');
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
    });
    await page.waitForTimeout(120);
  }
}

async function setSimulationToLatestCandle(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const slider = Array.from(document.querySelectorAll('input[type="range"]'))
      .find((node) => node instanceof HTMLInputElement && Number(node.max) > 0 && node.offsetParent !== null) as HTMLInputElement | undefined;
    if (!slider) {
      return { moved: false, target: 0 };
    }

    const target = Number(slider.max);
    if (!Number.isFinite(target) || target <= 0) {
      return { moved: false, target: 0 };
    }

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(slider, String(target));
    } else {
      slider.value = String(target);
    }

    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    return { moved: true, target };
  });

  if (!result.moved) return;

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const slider = Array.from(document.querySelectorAll('input[type="range"]'))
          .find((node) => node instanceof HTMLInputElement && Number(node.max) > 0 && node.offsetParent !== null) as HTMLInputElement | undefined;
        if (!slider) return -1;
        return Number(slider.value);
      });
    }, { timeout: 8_000 })
    .toBe(result.target);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const badge = document.querySelector('[data-testid="drawing-badge"]');
        const text = badge?.textContent ?? '';
        const match = text.match(/visible\s+(\d+)/i);
        return match ? Number(match[1]) : -1;
      });
    }, { timeout: 8_000 })
    .toBeGreaterThan(1);

  await page.waitForTimeout(220);
}

async function waitForChartStable(
  page: Page,
  options: {
    route: '/simulation' | '/live-market';
    fullscreen: boolean;
    minBarsLoaded?: number;
    minVisibleBars?: number;
    stableFrameTarget?: number;
    finalFrameCount?: number;
    finalSettleMs?: number;
  },
): Promise<void> {
  const minBarsLoaded = options.minBarsLoaded ?? 120;
  const minVisibleBars = options.minVisibleBars ?? 24;
  const stableFrameTarget = options.stableFrameTarget ?? 2;
  const finalFrameCount = options.finalFrameCount ?? 2;
  const finalSettleMs = options.finalSettleMs ?? 0;
  const readState = async () => {
    return page.evaluate(({ route, fullscreen }) => {
      const routeRoot = route === '/simulation'
        ? '[data-testid="simulation-page"]'
        : '[data-testid="live-market-page"]';
      const containerSelector = fullscreen
        ? '[data-testid="chart-full-view-overlay"] [data-testid="chart-container"]'
        : `${routeRoot} [data-testid="chart-container"]`;
      const container = Array.from(document.querySelectorAll(containerSelector))
        .find((node) => node instanceof HTMLElement && node.offsetParent !== null) as HTMLElement | undefined;
      if (!container) {
        return {
          ready: false,
          renderSeq: -1,
          barCount: 0,
          totalBars: 0,
          barWindow: '',
          priceScale: '',
          paneLayout: '',
          syncMode: '',
          dataLen: 0,
          visibleLen: 0,
          width: 0,
          height: 0,
        };
      }

      const canvas = Array.from(container.querySelectorAll('canvas'))
        .find((node) => node.getAttribute('aria-label') !== 'chart-drawing-overlay' && node.getClientRects().length > 0) as HTMLCanvasElement | undefined;
      if (!canvas) {
        return {
          ready: false,
          renderSeq: -1,
          barCount: 0,
          totalBars: 0,
          barWindow: '',
          priceScale: '',
          paneLayout: '',
          syncMode: '',
          dataLen: 0,
          visibleLen: 0,
          width: container.clientWidth,
          height: container.clientHeight,
        };
      }

      const renderSeq = Number.parseInt(canvas.dataset.renderSeq ?? '-1', 10);
      const barCount = Number.parseInt(canvas.dataset.barCount ?? '0', 10);
      const totalBars = Number.parseInt(
        canvas.dataset.totalBars ?? canvas.dataset.timeIndexLength ?? String(Math.max(0, barCount)),
        10,
      );
      return {
        ready: Number.isFinite(renderSeq)
          && renderSeq >= 0
          && Number.isFinite(barCount)
          && barCount > 0
          && Number.isFinite(totalBars)
          && totalBars > 0
          && Boolean(canvas.dataset.priceScale),
        renderSeq,
        barCount,
        totalBars,
        barWindow: canvas.dataset.barWindow ?? '',
        priceScale: canvas.dataset.priceScale ?? '',
        paneLayout: canvas.dataset.paneLayout ?? '',
        syncMode: container.dataset.chartSyncMode ?? '',
        dataLen: Number.parseInt(container.dataset.chartDataLength ?? '0', 10),
        visibleLen: Number.parseInt(container.dataset.chartVisibleLength ?? '0', 10),
        width: container.clientWidth,
        height: container.clientHeight,
      };
    }, { route: options.route, fullscreen: options.fullscreen });
  };

  const waitForAnimationFrames = async (frameCount: number) => {
    await page.evaluate(async (count) => {
      for (let i = 0; i < count; i += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }, frameCount);
  };

  let stableFrames = 0;
  let last = await readState();
  let lastSnapshot = last;

  for (let i = 0; i < 320; i += 1) {
    const current = await readState();
    // For live-market, renderSeq may advance continuously due to live-data polling
    // and portal/Framer-Motion resize interactions.  The visual layout indicators
    // (barWindow, priceScale, paneLayout) are what actually determine screenshot
    // stability, so allow a small renderSeq drift on that route.
    const renderSeqStable = options.route === '/live-market'
      ? (current.renderSeq - last.renderSeq <= 3)
      : current.renderSeq === last.renderSeq;
    const unchanged =
      current.ready
      && last.ready
      && renderSeqStable
      && current.barWindow === last.barWindow
      && current.priceScale === last.priceScale
      && current.paneLayout === last.paneLayout;

    stableFrames = unchanged ? stableFrames + 1 : 0;
    const hasEnoughLoadedBars = current.totalBars >= minBarsLoaded;
    const hasEnoughVisibleBars = current.barCount >= minVisibleBars;
    const validSurface = current.width > 120 && current.height > 120;

    if (current.ready && validSurface && hasEnoughLoadedBars && hasEnoughVisibleBars && stableFrames >= stableFrameTarget) {
      if (process.env.PARITY_DEBUG_NET === '1') {
        console.log(
          `[parity-state] route=${options.route} full=${options.fullscreen ? '1' : '0'} `
          + `bars=${current.barCount}/${current.totalBars} `
          + `window=${current.barWindow || 'n/a'} `
          + `dataLen=${current.dataLen} visibleLen=${current.visibleLen} `
          + `priceScale=${current.priceScale || 'n/a'} `
          + `pane=${current.paneLayout || 'n/a'}`,
        );
      }
      await waitForAnimationFrames(finalFrameCount);
      if (finalSettleMs > 0) {
        await page.waitForTimeout(finalSettleMs);
      }
      return;
    }

    last = current;
    lastSnapshot = current;
    await page.waitForTimeout(40);
  }

  throw new Error(
    `Chart did not stabilize before capture; `
      + `ready=${lastSnapshot.ready} `
      + `stableFrames=${stableFrames} `
      + `renderSeq=${lastSnapshot.renderSeq} `
      + `barCount=${lastSnapshot.barCount} `
      + `totalBars=${lastSnapshot.totalBars} `
      + `barWindow=${lastSnapshot.barWindow || 'n/a'} `
      + `priceScale=${lastSnapshot.priceScale || 'n/a'} `
      + `paneLayout=${lastSnapshot.paneLayout || 'n/a'} `
      + `sync=${lastSnapshot.syncMode || 'n/a'} `
      + `dataLen=${lastSnapshot.dataLen} `
      + `visibleLen=${lastSnapshot.visibleLen} `
      + `surface=${lastSnapshot.width}x${lastSnapshot.height} `
      + `thresholds(loaded=${minBarsLoaded},visible=${minVisibleBars})`,
  );
}

async function clearCrosshair(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const overlay = document.querySelector('canvas[aria-label="chart-drawing-overlay"]') as HTMLCanvasElement | null;
    if (!overlay) return;
    overlay.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  });
}

async function prepareRouteForParity(page: Page, route: '/simulation' | '/live-market'): Promise<void> {
  await setFullView(page, false);
  await dismissBlockingOverlays(page);
  const triggerTestId = route === '/simulation' ? 'scenario-symbol-trigger' : 'live-market-symbol-trigger';
  const trigger = page.getByTestId(triggerTestId).first();
  const triggerText = (await trigger.textContent().catch(() => '')) ?? '';

  await setTimeframeTo1m(page);
  await setChartTypeVolumeCandles(page);

  if (route === '/simulation') {
    if (!new RegExp(PARITY_SYMBOL, 'i').test(triggerText)) {
      await clickVisible(page, 'scenario-symbol-trigger');
      await chooseSymbolFromModal(page, PARITY_SYMBOL);
    }
    await setSimulationToLatestCandle(page);
    await waitForChartStable(page, { route, fullscreen: false, minBarsLoaded: 120, minVisibleBars: 24 });
    return;
  }

  const activeSymbolText = (await page.getByTestId('live-market-active-symbol').first().textContent().catch(() => '')) ?? '';
  if (!new RegExp(PARITY_SYMBOL, 'i').test(activeSymbolText)) {
    await clickVisible(page, 'live-market-symbol-trigger');
    await chooseSymbolFromModal(page, PARITY_SYMBOL);
  }
  await waitForChartStable(page, { route, fullscreen: false, minBarsLoaded: 120, minVisibleBars: 24 });
}

async function setFullView(page: Page, open: boolean): Promise<void> {
  const overlay = page.locator('[data-testid="chart-full-view-overlay"]:visible').first();
  const isOpen = await overlay.isVisible().catch(() => false);
  if (isOpen === open) return;
  await clickVisible(page, 'chart-toggle-full-view');
  if (open) {
    await expect(overlay).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(overlay).toBeHidden({ timeout: 5_000 });
  }
}

async function screenshotLocatorClip(_page: Page, locator: ReturnType<Page['locator']>, outputPath: string): Promise<void> {
  await locator.screenshot({ path: outputPath, animations: 'disabled' });
}

async function setParityCaptureChromeHidden(
  page: Page,
  options: { route: '/simulation' | '/live-market'; fullscreen: boolean; hidden: boolean },
): Promise<void> {
  await page.evaluate(({ route, fullscreen, hidden }) => {
    const styleId = 'parity-capture-hide-ui-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        [data-testid="chart-root"][data-parity-hide-ui="1"] [data-testid="chart-top-bar"],
        [data-testid="chart-root"][data-parity-hide-ui="1"] [data-testid="tool-rail"],
        [data-testid="chart-root"][data-parity-hide-ui="1"] [data-testid="ohlc-status"],
        [data-testid="chart-root"][data-parity-hide-ui="1"] [data-testid="drawing-badge"],
        [data-testid="chart-root"][data-parity-hide-ui="1"] [data-testid="pattern-wizard-hint"],
        [data-testid="chart-root"][data-parity-hide-ui="1"] [data-testid="values-tooltip"],
        [data-testid="chart-root"][data-parity-hide-ui="1"] [data-testid="chart-go-live"] {
          display: none !important;
        }

        body[data-parity-hide-ui-global="1"] nav.sticky.top-0 {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const routeRoot = route === '/simulation' ? '[data-testid="simulation-page"]' : '[data-testid="live-market-page"]';
    const chartRootSelector = fullscreen
      ? '[data-testid="chart-full-view-overlay"] [data-testid="chart-root"]'
      : `${routeRoot} [data-testid="chart-root"]`;

    const chartRoot = Array.from(document.querySelectorAll(chartRootSelector))
      .find((node) => node instanceof HTMLElement && node.offsetParent !== null) as HTMLElement | undefined;
    if (!chartRoot) return;

    if (hidden) {
      chartRoot.setAttribute('data-parity-hide-ui', '1');
      document.body?.setAttribute('data-parity-hide-ui-global', '1');
    } else {
      chartRoot.removeAttribute('data-parity-hide-ui');
      document.body?.removeAttribute('data-parity-hide-ui-global');
    }
  }, options);
}

async function captureChartSurface(page: Page, route: '/simulation' | '/live-market', outputPath: string, fullscreen: boolean): Promise<void> {
  const logChartBadge = async () => {
    if (process.env.PARITY_DEBUG_NET !== '1') return;
    const badge = await page.locator('[data-testid="drawing-badge"]:visible').first().textContent().catch(() => null);
    const text = (badge ?? '').replace(/\s+/g, ' ').trim();
    if (text) {
      console.log(`[parity-ui] route=${route} full=${fullscreen ? '1' : '0'} badge=${text}`);
    }
  };

  if (fullscreen) {
    await setFullView(page, true);
    const fullSurface = page.locator('[data-testid="chart-full-view-overlay"] [data-testid="chart-interaction-surface"]:visible').first();
    await expect(fullSurface).toBeVisible({ timeout: 5_000 });
    // Extra settle time for live-market: the portal + Framer-Motion resize loop
    // takes a few hundred ms to quiesce after entering full view.
    if (route === '/live-market') await page.waitForTimeout(400);
    await waitForChartStable(page, { route, fullscreen: true, minBarsLoaded: 120, minVisibleBars: 24 });
    await logChartBadge();
    await clearCrosshair(page);
    await page.waitForTimeout(80);
    await setParityCaptureChromeHidden(page, { route, fullscreen: true, hidden: true });
    await page.waitForTimeout(80);
    await screenshotLocatorClip(page, fullSurface, outputPath);
    await setParityCaptureChromeHidden(page, { route, fullscreen: true, hidden: false });
    await setFullView(page, false);
    return;
  }

  await setFullView(page, false);
  const rootTestId = routeRootTestId(route);
  const surface = page.locator(`[data-testid="${rootTestId}"] [data-testid="chart-interaction-surface"]:visible`).first();
  await expect(surface).toBeVisible({ timeout: 5_000 });

  const viewportWidth = await page.evaluate(() => window.innerWidth || document.documentElement.clientWidth || 0);
  const useStrictMobileStability = viewportWidth <= 420;

  await waitForChartStable(page, {
    route,
    fullscreen: false,
    minBarsLoaded: 120,
    minVisibleBars: 24,
    stableFrameTarget: useStrictMobileStability ? 4 : 2,
    finalFrameCount: useStrictMobileStability ? 8 : 2,
    finalSettleMs: useStrictMobileStability ? 220 : 0,
  });
  await logChartBadge();
  await clearCrosshair(page);
  await page.waitForTimeout(80);
  await setParityCaptureChromeHidden(page, { route, fullscreen: false, hidden: true });
  await page.waitForTimeout(80);
  await screenshotLocatorClip(page, surface, outputPath);
  await setParityCaptureChromeHidden(page, { route, fullscreen: false, hidden: false });
}

test('capture tradingview parity screenshots (normal and fullscreen)', async ({ page }) => {
  if (PARITY_DEBUG_DPR || PARITY_DEBUG_VISUAL) {
    await page.addInitScript((showVisualDebug) => {
      (globalThis as { __TRADEREPLAY_PARITY_DEBUG__?: unknown }).__TRADEREPLAY_PARITY_DEBUG__ = {
        enabled: true,
        showPaneBounds: showVisualDebug,
        showScaleValues: showVisualDebug,
        showCursor: showVisualDebug,
      };
    }, PARITY_DEBUG_VISUAL);
  }

  if (PARITY_DEBUG_DPR) {
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[parity:canvas-setup]')) {
        console.log(text);
      }
    });
  }

  if (process.env.PARITY_DEBUG_NET === '1') {
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/live/candles')) {
        const payload = await response.json().catch(() => null) as {
          source?: string;
          candles?: Array<{ time?: string; close?: number }>;
        } | null;
        const candles = payload?.candles ?? [];
        const first = candles[0]?.time ?? 'n/a';
        const last = candles[candles.length - 1]?.time ?? 'n/a';
        console.log(`[parity-net] ${response.status()} ${url} source=${payload?.source ?? 'n/a'} candles=${candles.length} first=${first} last=${last}`);
        return;
      }

      if (url.includes('/api/chart/bundle')) {
        console.log(`[parity-net] ${response.status()} ${url}`);
      }

      if (url.includes('/api/sim/init')) {
        const payload = await response.json().catch(() => null) as {
          source?: string;
          simulation?: { candles?: Array<{ time?: string; close?: number }> };
        } | null;
        const candles = payload?.simulation?.candles ?? [];
        const first = candles[0]?.time ?? 'n/a';
        const last = candles[candles.length - 1]?.time ?? 'n/a';
        console.log(`[parity-net] ${response.status()} ${url} source=${payload?.source ?? 'n/a'} candles=${candles.length} first=${first} last=${last}`);
      }
    });
  }

  await registerAndLogin(page);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const existing = await fs.readdir(OUTPUT_DIR);
  await Promise.all(
    existing
      .filter((name) => name.toLowerCase().endsWith('.png'))
      .map((name) => fs.rm(path.join(OUTPUT_DIR, name), { force: true })),
  );

  const routes: Array<'/simulation' | '/live-market'> = ['/simulation', '/live-market']
    .filter((route) => {
      if (!PARITY_ROUTE_FILTER.size) return true;
      const routeKey = route.replace('/', '');
      return PARITY_ROUTE_FILTER.has(route) || PARITY_ROUTE_FILTER.has(routeKey);
    });
  expect(routes.length, 'No parity routes matched PARITY_ROUTES filter').toBeGreaterThan(0);

  const targetViewports = VIEWPORTS.filter((viewport) => {
    if (!PARITY_VIEWPORT_FILTER.size) return true;
    const label = `${viewport.width}x${viewport.height}`;
    return PARITY_VIEWPORT_FILTER.has(label);
  });
  expect(targetViewports.length, 'No parity viewports matched PARITY_VIEWPORTS filter').toBeGreaterThan(0);

  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      await waitForChart(page, route);
      await prepareRouteForParity(page, route);
      const routeLabel = route.replace('/', '');
      const viewportLabel = `${viewport.width}x${viewport.height}`;

      const normalPath = path.join(
        OUTPUT_DIR,
        `${PARITY_SYMBOL}_${PARITY_TIMEFRAME}_${routeLabel}_normal_${viewportLabel}.png`,
      );
      const fullPath = path.join(
        OUTPUT_DIR,
        `${PARITY_SYMBOL}_${PARITY_TIMEFRAME}_${routeLabel}_full_${viewportLabel}.png`,
      );

      await captureChartSurface(page, route, normalPath, false);
      await captureChartSurface(page, route, fullPath, true);
    }
  }
});
