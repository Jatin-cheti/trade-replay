// Standalone Playwright script: capture screenshots of every Fib/Gann tool
// in TradingView's drawing toolbar from the public chart URL.
//
// Run from harshit-repo:
//   node scripts/capture-tv-fib-tools.mjs
//
// Output: docs/tv-fib-screenshots/<tool-slug>.png + manifest.json
//
// Strategy:
//   1. Launch Chromium (non-headless for TV's bot-detection tolerance).
//   2. Navigate to the public chart link.
//   3. Dismiss any login/cookie/promo modals (best-effort, repeated).
//   4. Click the Fib drawing-tool group icon in the left rail.
//   5. For each Fib/Gann sub-tool, click it, take a screenshot of the
//      toolbar (with the tooltip visible) and a screenshot of the chart
//      after a draft drawing is placed via two clicks at known coordinates.
//   6. Capture the right-click "edit" panel for the placed drawing.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'tv-fib-screenshots');

// Public Supercharts URL — no login required, shows full TradingView UI.
// (The /chart/<id>/ link the user provided is a private layout and 403s.)
const TARGET_URL = 'https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE';

// Tooltip / submenu label text exactly as TradingView renders it (verified
// against the captured _group-menu.png submenu).
const FIB_GANN_TOOLS = [
  // Fibonacci group
  { slug: 'fib-retracement', tooltip: 'Fib retracement', group: 'fib' },
  { slug: 'trend-based-fib-extension', tooltip: 'Trend-based fib extension', group: 'fib' },
  { slug: 'fib-channel', tooltip: 'Fib channel', group: 'fib' },
  { slug: 'fib-time-zone', tooltip: 'Fib time zone', group: 'fib' },
  { slug: 'fib-speed-resistance-fan', tooltip: 'Fib speed resistance fan', group: 'fib' },
  { slug: 'trend-based-fib-time', tooltip: 'Trend-based fib time', group: 'fib' },
  { slug: 'fib-circles', tooltip: 'Fib circles', group: 'fib' },
  { slug: 'fib-spiral', tooltip: 'Fib spiral', group: 'fib' },
  { slug: 'fib-speed-resistance-arcs', tooltip: 'Fib speed resistance arcs', group: 'fib' },
  { slug: 'fib-wedge', tooltip: 'Fib wedge', group: 'fib' },
  { slug: 'pitchfan', tooltip: 'Pitchfan', group: 'fib' },
  // Gann group (same submenu)
  { slug: 'gann-box', tooltip: 'Gann box', group: 'gann' },
  { slug: 'gann-square-fixed', tooltip: 'Gann square fixed', group: 'gann' },
  { slug: 'gann-square', tooltip: 'Gann square', group: 'gann' },
  { slug: 'gann-fan', tooltip: 'Gann fan', group: 'gann' },
];

async function dismissModals(page) {
  // TV shows: cookie banner, sign-in nudge, "save your work" promo, and a
  // "Press and hold to see detailed chart values" tutorial bubble.
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(180);
  }
  // Click "Got it!" tutorial bubble if present (may appear multiple times).
  for (let i = 0; i < 3; i += 1) {
    const gotIt = page.getByRole('button', { name: /Got it/i });
    if (await gotIt.count().catch(() => 0)) {
      await gotIt.first().click({ timeout: 600 }).catch(() => {});
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }
  const closeButtons = page.locator('button[aria-label="Close"], div[data-name="close"], button[data-name="close"]');
  const count = await closeButtons.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    await closeButtons.nth(i).click({ timeout: 500 }).catch(() => {});
  }
}

async function ensureChartReady(page) {
  // Wait for TV's main chart canvas to render. TV is often slow on first
  // load behind bot-detection — fall back to a long fixed delay if no canvas
  // appears (still capture screenshots so the user can see what loaded).
  try {
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await page.waitForTimeout(4_000);
  } catch (err) {
    console.warn('[capture] no canvas yet, taking diagnostic screenshot');
    await page.screenshot({ path: path.join(OUT_DIR, '_diagnostic-no-canvas.png'), fullPage: true }).catch(() => {});
    await page.waitForTimeout(8_000);
  }
}

async function openFibGroup(page) {
  // TV's left rail group buttons have an *expand arrow* sub-element. Clicking
  // the main button activates the previously-selected tool; clicking the
  // arrow opens the submenu. We try the arrow first, then fall back to a
  // long-press on the main button.
  const groupSelectors = [
    '[data-name="linetool-group-gann-and-fibonacci"]', // TV's stable id (verified via DOM dump)
    'div[role="button"][aria-label*="Gann" i]',
    'div[data-tooltip*="Gann" i]',
  ];
  let group = null;
  for (const sel of groupSelectors) {
    const loc = page.locator(sel).first();
    if (await loc.count().catch(() => 0)) { group = loc; break; }
  }
  if (!group) return false;

  let opened = false;
  for (const sel of ['div[class*="arrow"]', 'div[data-role="button-arrow"]', 'span[class*="arrow"]']) {
    const arrow = group.locator(sel).first();
    if (await arrow.count().catch(() => 0)) {
      await arrow.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(350);
      const submenu = page.locator('div[data-name="popup-menu-container"]:visible, div[class*="menuWrap"]:visible');
      if (await submenu.count().catch(() => 0)) { opened = true; break; }
    }
  }
  if (!opened) {
    const box = await group.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await page.waitForTimeout(300);
      const submenu = page.locator('div[data-name="popup-menu-container"]:visible, div[class*="menuWrap"]:visible');
      if (await submenu.count().catch(() => 0)) opened = true;
    }
  }
  return opened;
}

async function captureGroupScreenshot(page) {
  const ok = await openFibGroup(page);
  // After opening, dump every visible item's data-name + label so we can map
  // tools by their stable TV identifier.
  try {
    const items = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-name^="linetool-"]'));
      return rows.map((el) => ({
        dn: el.getAttribute('data-name') || '',
        text: (el.textContent || '').trim().slice(0, 80),
        aria: el.getAttribute('aria-label') || '',
        tip: el.getAttribute('data-tooltip') || '',
        rect: (() => { const r = el.getBoundingClientRect(); return { x: r.x|0, y: r.y|0, w: r.width|0, h: r.height|0 }; })(),
      })).filter((r) => r.rect.w > 0 && r.rect.h > 0);
    });
    await fs.writeFile(path.join(OUT_DIR, '_linetool-items.json'), JSON.stringify(items, null, 2), 'utf8');
  } catch {}
  const file = path.join(OUT_DIR, '_group-menu.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[capture] group-menu opened=${ok} → ${file}`);
  return file;
}

async function captureTool(page, tool) {
  // Re-open the fib group menu so the sub-tool is reachable.
  await openFibGroup(page);
  await page.waitForTimeout(300);

  // The submenu items have aria-label or visible text matching the tooltip.
  const candidates = [
    page.getByRole('menuitem', { name: new RegExp(`^${tool.tooltip}$`, 'i') }),
    page.getByRole('button', { name: new RegExp(`^${tool.tooltip}$`, 'i') }),
    page.locator(`[aria-label="${tool.tooltip}"]:visible`).first(),
    page.locator(`text=${tool.tooltip}`).first(),
  ];

  let clicked = false;
  for (const loc of candidates) {
    if (await loc.count().catch(() => 0)) {
      try {
        await loc.first().click({ timeout: 2_000 });
        clicked = true;
        break;
      } catch {
        // try next
      }
    }
  }

  const result = { slug: tool.slug, tooltip: tool.tooltip, group: tool.group, clicked, files: {} };
  if (!clicked) {
    return result;
  }

  await page.waitForTimeout(400);

  // Take screenshot of cursor-tooltip state (after selecting tool, before drawing).
  const toolbarShot = path.join(OUT_DIR, `${tool.slug}-01-cursor-tooltip.png`);
  await page.screenshot({ path: toolbarShot, fullPage: false });
  result.files.cursorTooltip = path.relative(path.resolve(OUT_DIR, '..'), toolbarShot);

  // Move mouse over chart to trigger TV's "Click to set first point" tooltip.
  const chart = page.locator('canvas').nth(1); // main chart canvas
  const box = await chart.boundingBox().catch(() => null);
  if (box) {
    const x1 = box.x + box.width * 0.45;
    const y1 = box.y + box.height * 0.35;
    const x2 = box.x + box.width * 0.65;
    const y2 = box.y + box.height * 0.55;
    await page.mouse.move(x1, y1);
    await page.waitForTimeout(300);
    const placingShot = path.join(OUT_DIR, `${tool.slug}-02-placing-first-point.png`);
    await page.screenshot({ path: placingShot, fullPage: false });
    result.files.placingFirstPoint = path.relative(path.resolve(OUT_DIR, '..'), placingShot);

    // Click first anchor.
    await page.mouse.click(x1, y1);
    await page.waitForTimeout(200);
    await page.mouse.move(x2, y2);
    await page.waitForTimeout(300);
    const placingShot2 = path.join(OUT_DIR, `${tool.slug}-03-placing-second-point.png`);
    await page.screenshot({ path: placingShot2, fullPage: false });
    result.files.placingSecondPoint = path.relative(path.resolve(OUT_DIR, '..'), placingShot2);

    // Click second anchor (commits 2-anchor tools).
    await page.mouse.click(x2, y2);
    await page.waitForTimeout(300);

    // 3-anchor tools (Trend-based fib extension / time) require a third click.
    const threeAnchor = tool.slug === 'trend-based-fib-extension' || tool.slug === 'trend-based-fib-time';
    if (threeAnchor) {
      const x3 = box.x + box.width * 0.80;
      const y3 = box.y + box.height * 0.30;
      await page.mouse.move(x3, y3);
      await page.waitForTimeout(250);
      await page.mouse.click(x3, y3);
      await page.waitForTimeout(400);
    }

    const drawnShot = path.join(OUT_DIR, `${tool.slug}-04-drawn.png`);
    await page.screenshot({ path: drawnShot, fullPage: false });
    result.files.drawn = path.relative(path.resolve(OUT_DIR, '..'), drawnShot);

    // Right-click on the drawing for the edit menu.
    await page.mouse.click((x1 + x2) / 2, (y1 + y2) / 2, { button: 'right' });
    await page.waitForTimeout(400);
    const editShot = path.join(OUT_DIR, `${tool.slug}-05-context-menu.png`);
    await page.screenshot({ path: editShot, fullPage: false });
    result.files.contextMenu = path.relative(path.resolve(OUT_DIR, '..'), editShot);

    // Dismiss menu and undo the drawing for next iteration.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+Z').catch(() => {});
    await page.waitForTimeout(300);
  }

  // Esc to deselect the tool before next loop iteration.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
  return result;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    locale: 'en-IN',
  });
  const page = await context.newPage();

  console.log(`[capture] navigating to ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  // Snapshot immediately after DOMContentLoaded so we can debug bot walls.
  await page.screenshot({ path: path.join(OUT_DIR, '_01-after-domcontentloaded.png'), fullPage: false }).catch(() => {});

  await dismissModals(page);
  await ensureChartReady(page);
  await dismissModals(page);
  // After the chart canvas appears, TV often pops the "Press and hold..."
  // tutorial bubble a few seconds later. Wait + dismiss again to catch it.
  await page.waitForTimeout(3_500);
  await dismissModals(page);

  const baseShot = path.join(OUT_DIR, '_00-baseline.png');
  await page.screenshot({ path: baseShot, fullPage: false });
  console.log(`[capture] baseline → ${baseShot}`);

  await captureGroupScreenshot(page).catch((err) => {
    console.error('[capture] could not open fib group menu:', err.message);
  });

  const results = [];
  for (const tool of FIB_GANN_TOOLS) {
    console.log(`[capture] ${tool.slug}…`);
    try {
      const r = await captureTool(page, tool);
      results.push(r);
    } catch (err) {
      console.error(`[capture] ${tool.slug} failed:`, err.message);
      results.push({ slug: tool.slug, tooltip: tool.tooltip, group: tool.group, error: err.message });
    }
    await dismissModals(page);
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    sourceUrl: TARGET_URL,
    tools: results,
  };
  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  console.log(`[capture] manifest → ${path.join(OUT_DIR, 'manifest.json')}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
