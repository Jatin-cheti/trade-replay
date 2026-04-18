#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const ROOT_DIR = process.cwd();
const OURS_DIR = path.resolve(ROOT_DIR, process.env.PARITY_OURS_DIR ?? 'docs/tradingview-parity/ours');
const REFERENCE_DIR = path.resolve(ROOT_DIR, process.env.PARITY_REFERENCE_DIR ?? 'docs/tradingview-parity/tradingview');
const WAIT_MS = Number.parseInt(process.env.PARITY_TV_WAIT_MS ?? '4500', 10);
const NAV_TIMEOUT_MS = Number.parseInt(process.env.PARITY_TV_NAV_TIMEOUT_MS ?? '120000', 10);
const THEME = process.env.PARITY_TV_THEME ?? 'dark';

const SYMBOL_ALIASES = {
  AAPL: 'NASDAQ:AAPL',
  TSLA: 'NASDAQ:TSLA',
  SPY: 'AMEX:SPY',
  BTCUSD: 'BITSTAMP:BTCUSD',
  ETHUSD: 'BITSTAMP:ETHUSD',
};

const INTERVAL_ALIASES = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '45m': '45',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
};

function parseTargetFileName(fileName) {
  const base = path.basename(fileName, '.png');
  const parts = base.split('_');
  if (parts.length < 5) return null;

  const viewport = parts[parts.length - 1];
  const view = parts[parts.length - 2];
  const route = parts[parts.length - 3];
  const timeframe = parts[parts.length - 4];
  const symbol = parts.slice(0, parts.length - 4).join('_');

  const viewportMatch = viewport.match(/^(\d+)x(\d+)$/);
  if (!viewportMatch || !symbol || !timeframe || !route || !view) return null;

  return {
    symbol,
    timeframe,
    route,
    view,
    viewport,
  };
}

function resolveTradingViewSymbol(symbol) {
  const forced = process.env.PARITY_TV_SYMBOL?.trim();
  if (forced) return forced;
  if (symbol.includes(':')) return symbol;
  return SYMBOL_ALIASES[symbol] ?? `NASDAQ:${symbol}`;
}

function resolveTradingViewInterval(timeframe) {
  const forced = process.env.PARITY_TV_INTERVAL?.trim();
  if (forced) return forced;
  return INTERVAL_ALIASES[timeframe] ?? timeframe;
}

function buildWidgetUrl(symbol, interval) {
  const params = new URLSearchParams({
    symbol,
    interval,
    hidesidetoolbar: '1',
    symboledit: '0',
    saveimage: '0',
    toolbarbg: 'f1f3f6',
    studies: '[]',
    theme: THEME,
    style: '1',
    timezone: 'Etc/UTC',
    withdateranges: '0',
    hide_top_toolbar: '1',
    hide_legend: '1',
    hide_bottom_toolbar: '1',
    hideideas: '1',
    locale: 'en',
    utm_source: 'trade-replay-parity',
  });

  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

async function readPngDimensions(filePath) {
  const data = await fs.readFile(filePath);
  const png = PNG.sync.read(data);
  return { width: png.width, height: png.height };
}

async function main() {
  const effectiveWaitMs = Number.isFinite(WAIT_MS) && WAIT_MS >= 0 ? WAIT_MS : 4500;
  const effectiveNavTimeoutMs = Number.isFinite(NAV_TIMEOUT_MS) && NAV_TIMEOUT_MS > 0 ? NAV_TIMEOUT_MS : 120000;

  await fs.mkdir(REFERENCE_DIR, { recursive: true });

  const oursFiles = (await fs.readdir(OURS_DIR))
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort((left, right) => left.localeCompare(right));

  if (oursFiles.length === 0) {
    throw new Error(`No parity targets found in ${path.relative(ROOT_DIR, OURS_DIR)}`);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  let captured = 0;
  try {
    for (const fileName of oursFiles) {
      const targetMeta = parseTargetFileName(fileName);
      if (!targetMeta) {
        console.warn(`[tv-reference] skip unsupported filename pattern: ${fileName}`);
        continue;
      }

      const oursPath = path.join(OURS_DIR, fileName);
      const referencePath = path.join(REFERENCE_DIR, fileName);
      const { width, height } = await readPngDimensions(oursPath);

      const symbol = resolveTradingViewSymbol(targetMeta.symbol);
      const interval = resolveTradingViewInterval(targetMeta.timeframe);
      const url = buildWidgetUrl(symbol, interval);

      // Keep viewport larger than clipping bounds so screenshot clip is always valid.
      const viewportWidth = Math.max(width, 420);
      const viewportHeight = Math.max(height, 320);
      await page.setViewportSize({ width: viewportWidth, height: viewportHeight });

      console.log(`[tv-reference] capture ${fileName} (${symbol} @ ${interval}, ${width}x${height})`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: effectiveNavTimeoutMs,
      });

      await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(effectiveWaitMs);

      await page.screenshot({
        path: referencePath,
        clip: {
          x: 0,
          y: 0,
          width,
          height,
        },
      });

      captured += 1;
    }
  } finally {
    await browser.close();
  }

  console.log(`[tv-reference] wrote ${captured} reference screenshots to ${path.relative(ROOT_DIR, REFERENCE_DIR).replace(/\\/g, '/')}`);
}

main().catch((error) => {
  console.error('[tv-reference] fatal', error);
  process.exitCode = 1;
});
