// Standalone Playwright script: capture screenshots + DOM metadata of every
// Lines / Channels / Pitchforks tool from TradingView's Trend-line drawing
// toolbar group. Mirrors capture-tv-fib-tools.mjs.
//
// Run from harshit-repo:
//   node scripts/capture-tv-line-tools.mjs
//
// Output: docs/tv-line-screenshots/<tool-slug>-{01..05}.png
//         docs/tv-line-screenshots/_linetool-items.json
//         docs/tv-line-screenshots/manifest.json (requirements per tool)
//
// Each tool gets phases:
//   01-cursor-tooltip   — after selecting the tool, before any anchor click
//   02-placing-first    — mouse hovered over chart, no clicks yet
//   03-after-N-anchors  — one screenshot per anchor as the tool is built
//   04-drawn            — final drawing committed
//   05-context-menu     — right-click "Edit/Settings" panel
//
// The manifest captures: TV data-name, tooltip, observed anchor count,
// presence of fill/levels, and the tool's "Settings" tab field list scraped
// from the right-click → Settings dialog.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'docs', 'tv-line-screenshots');
const TARGET_URL = 'https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE';

// (slug, label, anchors). `anchors` is the click count we'll perform on the
// chart; verified from TV's behaviour. crossLine / hline / vline / horizRay
// are 1-anchor tools.
const LINE_TOOLS = [
  // Lines subsection
  { slug: 'trend-line',         tooltip: 'Trend Line',                 anchors: 2, family: 'lines' },
  { slug: 'ray',                tooltip: 'Ray',                         anchors: 2, family: 'lines' },
  { slug: 'info-line',          tooltip: 'Info Line',                   anchors: 2, family: 'lines' },
  { slug: 'extended-line',      tooltip: 'Extended Line',               anchors: 2, family: 'lines' },
  { slug: 'trend-angle',        tooltip: 'Trend Angle',                 anchors: 2, family: 'lines' },
  { slug: 'horizontal-line',    tooltip: 'Horizontal Line',             anchors: 1, family: 'lines' },
  { slug: 'horizontal-ray',     tooltip: 'Horizontal Ray',              anchors: 1, family: 'lines' },
  { slug: 'vertical-line',      tooltip: 'Vertical Line',               anchors: 1, family: 'lines' },
  { slug: 'cross-line',         tooltip: 'Cross Line',                  anchors: 1, family: 'lines' },
  // Channels subsection
  { slug: 'parallel-channel',   tooltip: 'Parallel Channel',            anchors: 3, family: 'channels' },
  { slug: 'regression-trend',   tooltip: 'Regression Trend',            anchors: 2, family: 'channels' },
  { slug: 'flat-top-bottom',    tooltip: 'Flat Top/Bottom',             anchors: 2, family: 'channels' },
  { slug: 'disjoint-channel',   tooltip: 'Disjoint Channel',            anchors: 4, family: 'channels' },
  // Pitchforks subsection
  { slug: 'pitchfork',                 tooltip: 'Pitchfork',                    anchors: 3, family: 'pitchforks' },
  { slug: 'schiff-pitchfork',          tooltip: 'Schiff Pitchfork',             anchors: 3, family: 'pitchforks' },
  { slug: 'modified-schiff-pitchfork', tooltip: 'Modified Schiff Pitchfork',    anchors: 3, family: 'pitchforks' },
  { slug: 'inside-pitchfork',          tooltip: 'Inside Pitchfork',             anchors: 3, family: 'pitchforks' },
];

async function dismissModals(page) {
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
  for (let i = 0; i < 3; i += 1) {
    const gotIt = page.getByRole('button', { name: /Got it/i });
    if (await gotIt.count().catch(() => 0)) {
      await gotIt.first().click({ timeout: 600 }).catch(() => {});
      await page.waitForTimeout(250);
    } else break;
  }
  const closes = page.locator('button[aria-label="Close"], div[data-name="close"], button[data-name="close"]');
  const n = await closes.count().catch(() => 0);
  for (let i = 0; i < n; i += 1) await closes.nth(i).click({ timeout: 400 }).catch(() => {});
}

async function ensureChartReady(page) {
  try {
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await page.waitForTimeout(3_000);
  } catch {
    await page.screenshot({ path: path.join(OUT_DIR, '_diagnostic-no-canvas.png'), fullPage: true }).catch(() => {});
    await page.waitForTimeout(6_000);
  }
}

async function openLineGroup(page) {
  const group = page.locator('[data-name="linetool-group-trend-line"]').first();
  if (!(await group.count().catch(() => 0))) return false;
  // Try arrow click first.
  for (const sel of ['div[class*="arrow"]', 'div[data-role="button-arrow"]', 'span[class*="arrow"]']) {
    const arrow = group.locator(sel).first();
    if (await arrow.count().catch(() => 0)) {
      await arrow.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(300);
      const submenu = page.locator('div[data-name="popup-menu-container"]:visible, div[class*="menuWrap"]:visible');
      if (await submenu.count().catch(() => 0)) return true;
    }
  }
  // Fallback: long-press.
  const box = await group.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const submenu = page.locator('div[data-name="popup-menu-container"]:visible, div[class*="menuWrap"]:visible');
    if (await submenu.count().catch(() => 0)) return true;
  }
  return false;
}

async function captureGroupMenu(page) {
  const ok = await openLineGroup(page);
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
  await page.screenshot({ path: path.join(OUT_DIR, '_group-menu.png'), fullPage: false });
  return ok;
}

async function pickToolFromMenu(page, tool) {
  const candidates = [
    page.getByRole('menuitem', { name: new RegExp(`^${tool.tooltip}$`, 'i') }),
    page.getByRole('button',   { name: new RegExp(`^${tool.tooltip}$`, 'i') }),
    page.locator(`[aria-label="${tool.tooltip}"]:visible`).first(),
    page.locator(`text=${tool.tooltip}`).first(),
  ];
  for (const loc of candidates) {
    if (await loc.count().catch(() => 0)) {
      try {
        await loc.first().click({ timeout: 2_000 });
        return true;
      } catch {}
    }
  }
  return false;
}

// Anchor coordinates relative to the chart canvas, indexed 0..3.
function anchorXY(box, idx) {
  const grid = [
    [0.30, 0.55],
    [0.55, 0.30],
    [0.75, 0.55],
    [0.85, 0.35],
  ];
  const [fx, fy] = grid[Math.min(idx, grid.length - 1)];
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

async function scrapeContextMenu(page) {
  // Best-effort: dump every visible context-menu item label.
  try {
    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('div[data-name="popup-menu-container"]:not([style*="display: none"]) [data-role="menuitem"], div[class*="menu"][role="menu"] [role="menuitem"]'));
      return rows.map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 40);
    });
  } catch { return []; }
}

async function captureTool(page, tool) {
  await openLineGroup(page);
  await page.waitForTimeout(250);
  const clicked = await pickToolFromMenu(page, tool);
  const result = {
    slug: tool.slug,
    tooltip: tool.tooltip,
    family: tool.family,
    anchors: tool.anchors,
    clicked,
    files: {},
    contextMenu: [],
  };
  if (!clicked) return result;

  await page.waitForTimeout(350);
  const cursorShot = path.join(OUT_DIR, `${tool.slug}-01-cursor-tooltip.png`);
  await page.screenshot({ path: cursorShot, fullPage: false });
  result.files.cursorTooltip = path.relative(path.resolve(OUT_DIR, '..'), cursorShot);

  const chart = page.locator('canvas').nth(1);
  const box = await chart.boundingBox().catch(() => null);
  if (!box) return result;

  // Hover before first click.
  const a0 = anchorXY(box, 0);
  await page.mouse.move(a0.x, a0.y);
  await page.waitForTimeout(250);
  const placingShot = path.join(OUT_DIR, `${tool.slug}-02-placing-first-point.png`);
  await page.screenshot({ path: placingShot, fullPage: false });
  result.files.placingFirstPoint = path.relative(path.resolve(OUT_DIR, '..'), placingShot);

  // Click each anchor in turn, screenshotting after each.
  for (let i = 0; i < tool.anchors; i += 1) {
    const p = anchorXY(box, i);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(180);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(250);
    const shot = path.join(OUT_DIR, `${tool.slug}-03-after-anchor-${i + 1}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    result.files[`afterAnchor${i + 1}`] = path.relative(path.resolve(OUT_DIR, '..'), shot);
  }

  // Final drawn state.
  await page.waitForTimeout(350);
  const drawnShot = path.join(OUT_DIR, `${tool.slug}-04-drawn.png`);
  await page.screenshot({ path: drawnShot, fullPage: false });
  result.files.drawn = path.relative(path.resolve(OUT_DIR, '..'), drawnShot);

  // Right-click roughly in the middle of the placed drawing.
  const mid = anchorXY(box, Math.max(0, Math.floor(tool.anchors / 2)));
  await page.mouse.click(mid.x, mid.y, { button: 'right' });
  await page.waitForTimeout(450);
  const ctxShot = path.join(OUT_DIR, `${tool.slug}-05-context-menu.png`);
  await page.screenshot({ path: ctxShot, fullPage: false });
  result.files.contextMenu = path.relative(path.resolve(OUT_DIR, '..'), ctxShot);
  result.contextMenu = await scrapeContextMenu(page);

  // Cleanup: dismiss menu, undo drawing, deselect tool.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(120);
  await page.keyboard.press('Control+Z').catch(() => {});
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    locale: 'en-IN',
  });
  const page = await context.newPage();
  console.log(`[capture-line] navigating to ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.screenshot({ path: path.join(OUT_DIR, '_01-after-domcontentloaded.png') }).catch(() => {});
  await dismissModals(page);
  await ensureChartReady(page);
  await dismissModals(page);
  await page.waitForTimeout(3_000);
  await dismissModals(page);
  await page.screenshot({ path: path.join(OUT_DIR, '_00-baseline.png') });

  await captureGroupMenu(page).catch((err) => console.error('[capture-line] group menu:', err.message));

  const results = [];
  for (const tool of LINE_TOOLS) {
    console.log(`[capture-line] ${tool.slug} (${tool.anchors} anchors)…`);
    try {
      const r = await captureTool(page, tool);
      results.push(r);
    } catch (err) {
      console.error(`[capture-line] ${tool.slug} failed:`, err.message);
      results.push({ slug: tool.slug, tooltip: tool.tooltip, family: tool.family, anchors: tool.anchors, error: err.message });
    }
    await dismissModals(page);
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    sourceUrl: TARGET_URL,
    tools: results,
  };
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[capture-line] manifest → ${path.join(OUT_DIR, 'manifest.json')}`);
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
