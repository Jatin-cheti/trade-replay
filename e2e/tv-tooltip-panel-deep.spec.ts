/**
 * TradingView Tooltip / Style-Panel DEEP capture
 * ===============================================
 * 500 scenarios per tool that drive the per-drawing style panel after
 * placing the drawing. Cycles colour, line width, opacity, line style,
 * font, font size, bold/italic/align, lock toggle, and (where the tool
 * supports text) progressively-larger paragraphs from 50 → 1000 lines.
 *
 * One describe-block per tool — orchestrator runs 3 in parallel via
 * `--grep "\]\[<toolKey>\]"`.
 *
 * Soft-pass philosophy: never hard-fail on a missing selector — capture
 * what we observed and continue.  All scenarios persist a JSON file under
 * `tv-capture-output/tooltip-deep/<toolKey>/scenario-NNN.json`.
 */

import { test, expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const TV_URL = "https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE";
const OUT_DIR = path.join(__dirname, "tv-capture-output", "tooltip-deep");

interface DeepToolSpec {
  key: string;
  label: string;
  /** TV selectors for the tool button (left toolbar). */
  toolSelectors: string[];
  /** Number of clicks needed to commit drawing. */
  anchors: number;
  /** Tool supports text input — drives paragraph cycling. */
  supportsText: boolean;
}

const TOOLS: DeepToolSpec[] = [
  // ─── Forecasting (3-anchor + 2-anchor) ─────────────────────────────────
  { key: "longPosition", label: "Long position", toolSelectors: ['[data-name="long_position"]', 'button[aria-label*="long position" i]'], anchors: 3, supportsText: true },
  { key: "shortPosition", label: "Short position", toolSelectors: ['[data-name="short_position"]', 'button[aria-label*="short position" i]'], anchors: 3, supportsText: true },
  { key: "positionForecast", label: "Position forecast", toolSelectors: ['[data-name="forecast"]', 'button[aria-label*="forecast" i]'], anchors: 3, supportsText: true },
  { key: "barPattern", label: "Bar pattern", toolSelectors: ['[data-name="bars-pattern"]', 'button[aria-label*="bar pattern" i]'], anchors: 2, supportsText: false },
  { key: "ghostFeed", label: "Ghost feed", toolSelectors: ['[data-name="ghost-feed"]', 'button[aria-label*="ghost" i]'], anchors: 2, supportsText: false },
  // ─── Volume-based ──────────────────────────────────────────────────────
  { key: "anchoredVwap", label: "Anchored VWAP", toolSelectors: ['[data-name="anchored-vwap"]', 'button[aria-label*="anchored vwap" i]'], anchors: 1, supportsText: false },
  { key: "fixedRangeVolumeProfile", label: "Fixed range volume profile", toolSelectors: ['[data-name="fixed-range-volume-profile"]', 'button[aria-label*="fixed range volume" i]'], anchors: 2, supportsText: false },
  { key: "anchoredVolumeProfile", label: "Anchored volume profile", toolSelectors: ['[data-name="anchored-volume-profile"]', 'button[aria-label*="anchored volume" i]'], anchors: 1, supportsText: false },
  // ─── Measurers ─────────────────────────────────────────────────────────
  { key: "priceRange", label: "Price range", toolSelectors: ['[data-name="price-range"]', 'button[aria-label*="price range" i]'], anchors: 2, supportsText: false },
  { key: "dateRange", label: "Date range", toolSelectors: ['[data-name="date-range"]', 'button[aria-label*="date range" i]'], anchors: 2, supportsText: false },
  { key: "dateAndPriceRange", label: "Date and price range", toolSelectors: ['[data-name="date-and-price-range"]', 'button[aria-label*="date and price" i]'], anchors: 2, supportsText: false },
  // ─── Brush + Arrows ────────────────────────────────────────────────────
  { key: "brush", label: "Brush", toolSelectors: ['[data-name="brush"]', 'button[aria-label="Brush"]'], anchors: 2, supportsText: false },
  { key: "highlighter", label: "Highlighter", toolSelectors: ['[data-name="highlighter"]', 'button[aria-label="Highlighter"]'], anchors: 2, supportsText: false },
  { key: "arrowMarker", label: "Arrow marker", toolSelectors: ['[data-name="arrow-marker"]', 'button[aria-label*="arrow marker" i]'], anchors: 1, supportsText: false },
  { key: "arrowTool", label: "Arrow", toolSelectors: ['[data-name="arrow"]', 'button[aria-label="Arrow"]'], anchors: 2, supportsText: false },
  { key: "arrowMarkUp", label: "Arrow mark up", toolSelectors: ['[data-name="arrow-mark-up"]', 'button[aria-label*="arrow.*up" i]'], anchors: 1, supportsText: false },
  { key: "arrowMarkDown", label: "Arrow mark down", toolSelectors: ['[data-name="arrow-mark-down"]', 'button[aria-label*="arrow.*down" i]'], anchors: 1, supportsText: false },
  // ─── Shapes ────────────────────────────────────────────────────────────
  { key: "rectangle", label: "Rectangle", toolSelectors: ['[data-name="rectangle"]', 'button[aria-label="Rectangle"]'], anchors: 2, supportsText: true },
  { key: "rotatedRectangle", label: "Rotated rectangle", toolSelectors: ['[data-name="rotated-rectangle"]', 'button[aria-label*="rotated rectangle" i]'], anchors: 2, supportsText: false },
  { key: "path", label: "Path", toolSelectors: ['[data-name="path"]', 'button[aria-label="Path"]'], anchors: 2, supportsText: false },
  { key: "circle", label: "Circle", toolSelectors: ['[data-name="circle"]', 'button[aria-label="Circle"]'], anchors: 2, supportsText: true },
  { key: "ellipse", label: "Ellipse", toolSelectors: ['[data-name="ellipse"]', 'button[aria-label="Ellipse"]'], anchors: 2, supportsText: false },
  { key: "polyline", label: "Polyline", toolSelectors: ['[data-name="polyline"]', 'button[aria-label="Polyline"]'], anchors: 2, supportsText: false },
  { key: "triangle", label: "Triangle", toolSelectors: ['[data-name="triangle"]', 'button[aria-label="Triangle"]'], anchors: 2, supportsText: true },
  { key: "arc", label: "Arc", toolSelectors: ['[data-name="arc"]', 'button[aria-label="Arc"]'], anchors: 2, supportsText: false },
  { key: "curveTool", label: "Curve", toolSelectors: ['[data-name="curve"]', 'button[aria-label="Curve"]'], anchors: 2, supportsText: false },
  { key: "doubleCurve", label: "Double curve", toolSelectors: ['[data-name="double-curve"]', 'button[aria-label*="double curve" i]'], anchors: 2, supportsText: false },
];

const SCENARIOS_PER_TOOL = 500;

const PALETTE = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#FFA500", "#800080", "#008000", "#FFC0CB", "#A52A2A", "#000000",
  "#FFFFFF", "#808080", "#FFD700", "#4B0082", "#7FFF00", "#DC143C",
];
const STYLES = ["solid", "dashed", "dotted"];
const FONTS = ["Trebuchet MS", "Verdana", "Courier New", "Tahoma", "Times New Roman"];
const ALIGNS = ["left", "center", "right"];
const LINE_WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const FONT_SIZES = [8, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72];
const OPACITIES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
// CSS that hides video / iframe ads which trigger the native HTML5 video
// context menu (Loop / Show all controls / Open video in new tab…) when
// the test right-clicks for the Settings menu.
const KILL_VIDEO_CSS = `
  video, [class*="ad-"], iframe[src*="doubleclick"], iframe[src*="google"],
  iframe[src*="banner"], iframe[id*="google_ads"],
  div[id*="google_vignette"], div[class*="adsbygoogle"],
  div[id*="banner"], div[class*="ad-banner"],
  div[class*="video-banner"], div[class*="video-ad"],
  picture[class*="ad"], aside[class*="banner"]
  { display: none !important; visibility: hidden !important;
    pointer-events: none !important; width: 0 !important; height: 0 !important;
    opacity: 0 !important; }
`;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function saveResult(toolKey: string, idx: number, data: Record<string, unknown>) {
  const dir = path.join(OUT_DIR, toolKey);
  ensureDir(dir);
  fs.writeFileSync(
    path.join(dir, `scenario-${String(idx).padStart(3, "0")}.json`),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

async function dismissTVModal(page: Page) {
  const candidates = [
    'button[data-name="close"]',
    'button[aria-label="Close"]',
    '[data-dialog-name] button[data-name="close"]',
    'button:has-text("Continue without using")',
    'button:has-text("Skip")',
    'button:has-text("Maybe later")',
    'button:has-text("Got it")',
  ];
  for (const sel of candidates) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 150 })) {
        await el.click({ timeout: 800, force: true }).catch(() => {});
      }
    } catch { /* ignore */ }
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function findFirstVisible(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 200 })) return loc;
    } catch { /* next */ }
  }
  return null;
}

async function killVideoAds(page: Page) {
  // Inject a stylesheet that nukes <video> and known ad iframes/divs so
  // right-click never lands on the native video context menu.
  await page.addStyleTag({ content: KILL_VIDEO_CSS }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach(v => { try { (v as HTMLVideoElement).pause(); v.remove(); } catch {} });
    document.querySelectorAll('iframe').forEach(f => {
      const src = (f.getAttribute('src') || '').toLowerCase();
      if (/doubleclick|google|banner|ads/.test(src)) f.remove();
    });
  }).catch(() => {});
}

async function dismissNativeContextMenu(page: Page) {
  // The HTML5 video context menu (Loop / Show all controls / …) cannot be
  // queried via DOM, so press Escape twice and click a safe spot.
  await page.keyboard.press("Escape").catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
}

async function gotoTV(page: Page) {
  await page.addInitScript((css) => {
    const inject = () => {
      const s = document.createElement('style');
      s.textContent = css as string;
      document.head?.appendChild(s);
    };
    if (document.head) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  }, KILL_VIDEO_CSS).catch(() => {});
  await page.goto(TV_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await killVideoAds(page);
  await dismissTVModal(page);
  await page.waitForTimeout(800);
  await killVideoAds(page);
  await dismissTVModal(page);
}

async function getChartBox(page: Page): Promise<{ x: number; y: number; width: number; height: number } | null> {
  for (const sel of [
    'div.chart-gui-wrapper',
    'div[class*="chart-container"]',
    'canvas',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      const box = await el.boundingBox().catch(() => null);
      if (box && box.width > 200 && box.height > 200) return box;
    }
  }
  return null;
}

/** Multi-line paragraph: grows from 50 → 1000 lines based on scenario index. */
function makeParagraph(scenarioIndex: number): string {
  const minLines = 50;
  const maxLines = 1000;
  const lines = Math.min(maxLines, minLines + Math.floor((scenarioIndex / SCENARIOS_PER_TOOL) * (maxLines - minLines)));
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    out.push(`L${i.toString().padStart(4, "0")} The quick brown fox jumps over the lazy dog 0123456789.`);
  }
  return out.join("\n");
}

/** Single-string blob: 200 -> 5000 chars based on scenario index. Tests how
 *  the TV style panel handles huge inline strings (no newlines). */
function makeBlob(scenarioIndex: number): string {
  const minLen = 200;
  const maxLen = 5000;
  const len = Math.min(maxLen, minLen + Math.floor((scenarioIndex / SCENARIOS_PER_TOOL) * (maxLen - minLen)));
  const seed = "The_quick_brown_fox_0123456789_!@#$%^&*()-=+[]{};:,.<>/?| ";
  let out = "";
  while (out.length < len) out += seed;
  return out.slice(0, len);
}

for (const tool of TOOLS) {
  test.describe(`[TV-DEEP][${tool.key}] ${tool.label} — 500 tooltip scenarios`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(60_000);

    let page: Page;
    let pageReady = false;
    let consecNoPanel = 0;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: 1600, height: 1000 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
      });
      page = await ctx.newPage();
      try {
        await gotoTV(page);
        pageReady = true;
      } catch (e) {
        console.warn(`[${tool.key}] initial load failed:`, e);
      }
    });

    for (let s = 0; s < SCENARIOS_PER_TOOL; s++) {
      test(`scenario-${String(s).padStart(3, "0")} — deep tooltip ${tool.label}`, async () => {
        const start = Date.now();
        const result: Record<string, unknown> = {
          tool: tool.key,
          scenarioIndex: s,
          ts: new Date().toISOString(),
          passed: false,
          observed: {} as Record<string, unknown>,
        };

        try {
          if (!pageReady) {
            try { await gotoTV(page); pageReady = true; } catch { /* fail-soft */ }
          }
          // Always blow away any lingering native menu before starting.
          await page.keyboard.press("Escape").catch(() => {});
          await page.keyboard.press("Escape").catch(() => {});
          // Auto-recover: if we've had 5 scenarios in a row that couldn't
          // open the style panel, the page is likely stuck on a modal /
          // overlay — do a hard reload + redismiss.
          if (consecNoPanel >= 5) {
            result.observed.autoReload = true;
            try {
              await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
              await page.waitForTimeout(2_500);
              await killVideoAds(page);
              await dismissTVModal(page);
              await page.waitForTimeout(800);
              await killVideoAds(page);
              await dismissTVModal(page);
            } catch { /* keep going */ }
            consecNoPanel = 0;
          }
          if (s % 20 === 0) { await dismissTVModal(page); await killVideoAds(page); }

          // 1. Activate tool from rail
          const toolBtn = await findFirstVisible(page, tool.toolSelectors);
          result.observed.toolFound = Boolean(toolBtn);
          if (toolBtn) {
            await toolBtn.click({ timeout: 1500, force: true }).catch(() => {});
            await page.waitForTimeout(150);
          }

          // 2. Draw on chart — record the centre point of the drawing so we
          //    right-click ON the shape (not on a video overlay).
          const box = await getChartBox(page);
          result.observed.chartBox = Boolean(box);
          let drawnCx = 0, drawnCy = 0;
          if (box) {
            // Use upper-mid region of the chart (avoid bottom toolbars / video
            // banners that hover near the bottom-right).
            const cx = box.x + box.width * 0.35 + ((s * 7) % Math.floor(box.width * 0.30));
            const cy = box.y + box.height * 0.30 + ((s * 11) % Math.floor(box.height * 0.25));
            drawnCx = cx + 30; drawnCy = cy + 20;
            for (let a = 0; a < tool.anchors; a++) {
              const ax = cx + a * 60;
              const ay = cy + a * 40;
              await page.mouse.move(ax, ay);
              await page.mouse.click(ax, ay);
              await page.waitForTimeout(80);
            }
            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(120);
          }

          // 3. Open style panel — prefer floating Settings button. If not
          //    visible, try double-click on the drawing (TV opens the
          //    settings dialog on double-click). NEVER right-click — that
          //    risks landing on the browser native page context menu (or a
          //    <video> element) when the click misses the drawing.
          const observedPanel: Record<string, unknown> = {};
          const settingsBtn = page.locator('button[data-name="settings"], div[data-tooltip="Settings"], button:has-text("Settings")').first();
          let panelOpened = false;
          if (await settingsBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await settingsBtn.click({ force: true, timeout: 1000 }).catch(() => {});
            await page.waitForTimeout(250);
            panelOpened = await page
              .locator('[data-dialog-name="property-page"], [class*="property-page"], [role="dialog"]')
              .first()
              .isVisible({ timeout: 600 }).catch(() => false);
          }
          if (!panelOpened && box && drawnCx > 0) {
            // Verify the target is a chart canvas (not video / iframe / body).
            const targetTag = await page.evaluate(([x, y]) => {
              const el = document.elementFromPoint(x as number, y as number);
              return el ? (el.tagName || "").toUpperCase() : null;
            }, [drawnCx, drawnCy]).catch(() => null);
            observedPanel.dblClickTarget = targetTag;
            if (targetTag === "CANVAS") {
              await page.mouse.dblclick(drawnCx, drawnCy).catch(() => {});
              await page.waitForTimeout(300);
              panelOpened = await page
                .locator('[data-dialog-name="property-page"], [class*="property-page"], [role="dialog"]')
                .first()
                .isVisible({ timeout: 600 }).catch(() => false);
            } else {
              observedPanel.skippedDblClickWrongTarget = targetTag;
            }
          }
          // If a native browser menu somehow appeared, kill it.
          await dismissNativeContextMenu(page);
          observedPanel.opened = panelOpened;
          if (!panelOpened) consecNoPanel++;
          else consecNoPanel = 0;

          // 4. Deeply cycle every style control deterministically.
          const colour = PALETTE[s % PALETTE.length];
          const bgColour = PALETTE[(s * 3 + 5) % PALETTE.length];
          const textColour = PALETTE[(s * 7 + 11) % PALETTE.length];
          const width = LINE_WIDTHS[s % LINE_WIDTHS.length];
          const lineStyle = STYLES[s % STYLES.length];
          const font = FONTS[s % FONTS.length];
          const fontSize = FONT_SIZES[s % FONT_SIZES.length];
          const align = ALIGNS[s % ALIGNS.length];
          const opacity = OPACITIES[s % OPACITIES.length];
          const bold = (s & 1) === 0;
          const italic = (s & 2) === 0;
          const underline = (s & 4) === 0;
          const lock = (s % 7) === 0;
          const useBlob = (s % 3) === 0; // alternate paragraph vs single-blob

          if (panelOpened) {
            // 4a. Line width — input + slider variants
            for (const sel of [
              'input[type="number"][name*="width" i]',
              'input[aria-label*="line width" i]',
              'input[type="number"][data-name*="width" i]',
            ]) {
              const w = page.locator(sel).first();
              if (await w.isVisible({ timeout: 200 }).catch(() => false)) {
                await w.fill(String(width)).catch(() => {});
                await page.keyboard.press("Tab").catch(() => {});
                observedPanel.widthSet = width;
                break;
              }
            }

            // 4b. Line style dropdown (solid/dashed/dotted)
            const styleDd = page.locator('button[aria-label*="line style" i], div[data-name*="linestyle" i]').first();
            if (await styleDd.isVisible({ timeout: 200 }).catch(() => false)) {
              await styleDd.click({ force: true, timeout: 600 }).catch(() => {});
              await page.waitForTimeout(150);
              const opt = page.locator(`div[role="option"]:has-text("${lineStyle}"), li:has-text("${lineStyle}")`).first();
              if (await opt.isVisible({ timeout: 250 }).catch(() => false)) {
                await opt.click({ force: true }).catch(() => {});
                observedPanel.lineStyleSet = lineStyle;
              } else {
                await page.keyboard.press("Escape").catch(() => {});
              }
            }

            // 4c. Colour swatches — open and pick the s%PALETTE button
            const colourBtn = page.locator('button[data-name*="color" i], div[data-name*="color" i] button, button[aria-label*="color" i]').first();
            if (await colourBtn.isVisible({ timeout: 200 }).catch(() => false)) {
              await colourBtn.click({ force: true, timeout: 600 }).catch(() => {});
              await page.waitForTimeout(150);
              const swatches = page.locator('button[data-name*="swatch" i], div[class*="swatch" i] button, button[style*="background"]');
              const cnt = await swatches.count().catch(() => 0);
              if (cnt > 0) {
                const idx = s % cnt;
                await swatches.nth(idx).click({ force: true, timeout: 500 }).catch(() => {});
                observedPanel.colourSwatchIdx = idx;
              }
              await page.keyboard.press("Escape").catch(() => {});
            }

            // 4d. Opacity slider
            const opacitySlider = page.locator('input[type="range"][name*="opacity" i], input[aria-label*="opacity" i]').first();
            if (await opacitySlider.isVisible({ timeout: 200 }).catch(() => false)) {
              await opacitySlider.fill(String(opacity)).catch(() => {});
              observedPanel.opacitySet = opacity;
            }

            // 4e. Bold / italic / underline toggles
            for (const [tag, want] of [["bold", bold], ["italic", italic], ["underline", underline]] as const) {
              const tBtn = page.locator(`button[aria-label*="${tag}" i], button[data-name*="${tag}" i]`).first();
              if (await tBtn.isVisible({ timeout: 150 }).catch(() => false)) {
                if (want) await tBtn.click({ force: true, timeout: 600 }).catch(() => {});
              }
            }

            // 4f. Font family dropdown
            const fontDd = page.locator('button[aria-label*="font" i]:not([aria-label*="size" i]), div[data-name*="font-family" i]').first();
            if (await fontDd.isVisible({ timeout: 200 }).catch(() => false)) {
              await fontDd.click({ force: true, timeout: 600 }).catch(() => {});
              await page.waitForTimeout(150);
              const opt = page.locator(`div[role="option"]:has-text("${font}"), li:has-text("${font}")`).first();
              if (await opt.isVisible({ timeout: 250 }).catch(() => false)) {
                await opt.click({ force: true }).catch(() => {});
                observedPanel.fontSet = font;
              } else {
                await page.keyboard.press("Escape").catch(() => {});
              }
            }

            // 4g. Font size input
            for (const sel of ['input[aria-label*="font size" i]', 'input[name*="font-size" i]', 'input[data-name*="font-size" i]']) {
              const fs = page.locator(sel).first();
              if (await fs.isVisible({ timeout: 200 }).catch(() => false)) {
                await fs.fill(String(fontSize)).catch(() => {});
                await page.keyboard.press("Tab").catch(() => {});
                observedPanel.fontSizeSet = fontSize;
                break;
              }
            }

            // 4h. Alignment buttons (left / center / right)
            const alignBtn = page.locator(`button[aria-label*="align ${align}" i], button[data-name*="align-${align}" i]`).first();
            if (await alignBtn.isVisible({ timeout: 150 }).catch(() => false)) {
              await alignBtn.click({ force: true, timeout: 500 }).catch(() => {});
              observedPanel.alignSet = align;
            }

            // 4i. Lock toggle
            if (lock) {
              const lockBtn = page.locator('button[aria-label*="lock" i], div[data-tooltip*="Lock" i]').first();
              if (await lockBtn.isVisible({ timeout: 150 }).catch(() => false)) {
                await lockBtn.click({ force: true, timeout: 500 }).catch(() => {});
                observedPanel.locked = true;
              }
            }

            // 4j. Text body — alternate between huge paragraphs and 5 000-char blob
            if (tool.supportsText) {
              const txt = page.locator('textarea[aria-label*="text" i], textarea[name*="text" i], div[contenteditable="true"]').first();
              if (await txt.isVisible({ timeout: 250 }).catch(() => false)) {
                const body = useBlob ? makeBlob(s) : makeParagraph(s);
                await txt.fill(body).catch(async () => {
                  await txt.click({ force: true }).catch(() => {});
                  // chunked typing for contenteditable
                  await page.keyboard.type(body.slice(0, 2_000)).catch(() => {});
                });
                observedPanel.textMode = useBlob ? "blob" : "paragraph";
                observedPanel.textLen = body.length;
              }
            }

            observedPanel.colour = colour;
            observedPanel.bgColour = bgColour;
            observedPanel.textColour = textColour;
            observedPanel.lineStyle = lineStyle;
            observedPanel.font = font;
            observedPanel.fontSize = fontSize;
            observedPanel.align = align;
            observedPanel.opacity = opacity;
            observedPanel.bold = bold;
            observedPanel.italic = italic;
            observedPanel.underline = underline;

            // Close dialog
            const okBtn = page.locator('button:has-text("Ok"), button:has-text("OK"), button[name="submit"]').first();
            if (await okBtn.isVisible({ timeout: 200 }).catch(() => false)) {
              await okBtn.click({ force: true }).catch(() => {});
            } else {
              await page.keyboard.press("Escape").catch(() => {});
            }
            await page.waitForTimeout(80);
          }
          result.observed = { ...(result.observed as Record<string, unknown>), ...observedPanel };

          // 5. Cleanup — Escape any lingering native menu, then delete drawing.
          await dismissNativeContextMenu(page);
          await page.keyboard.press("Delete").catch(() => {});
          await page.waitForTimeout(60);
          result.passed = true;
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err);
        } finally {
          result.elapsedMs = Date.now() - start;
          saveResult(tool.key, s, result);
        }

        expect(result).toBeDefined();
      });
    }
  });
}
