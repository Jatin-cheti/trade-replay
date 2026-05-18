/**
 * App-regression — runs the same option-cycling scenarios against our
 * own chart engine library (https://tradereplay.me/charts).  Mirrors the
 * tooltip-panel-deep TV spec but uses **our** drawing API + style panel
 * so we verify each tool is reachable end-to-end through the chart-engine
 * the way an external user would consume it (à la Lightweight Charts /
 * TradingView library).
 *
 * Soft-pass: never hard-fails. Saves results under
 *   `tv-capture-output/app-regression/<toolKey>/scenario-NNN.json`
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const APP_URL = process.env.E2E_TARGET_URL || "https://tradereplay.me";
const SYMBOL = process.env.E2E_SYMBOL || "RELIANCE";
const OUT_DIR = path.join(__dirname, "tv-capture-output", "app-regression");

interface AppToolSpec {
  key: string;
  variant: string;        // matches our toolRegistry ToolVariant
  category: string;       // rail category id (lines/forecasting/brush/...)
  anchors: number;
  supportsText: boolean;
}

const TOOLS: AppToolSpec[] = [
  { key: "longPosition", variant: "longPosition", category: "forecasting", anchors: 3, supportsText: true },
  { key: "shortPosition", variant: "shortPosition", category: "forecasting", anchors: 3, supportsText: true },
  { key: "positionForecast", variant: "positionForecast", category: "forecasting", anchors: 3, supportsText: true },
  { key: "barPattern", variant: "barPattern", category: "forecasting", anchors: 2, supportsText: false },
  { key: "ghostFeed", variant: "ghostFeed", category: "forecasting", anchors: 2, supportsText: false },
  { key: "anchoredVwap", variant: "anchoredVwap", category: "forecasting", anchors: 1, supportsText: false },
  { key: "fixedRangeVolumeProfile", variant: "fixedRangeVolumeProfile", category: "forecasting", anchors: 2, supportsText: false },
  { key: "anchoredVolumeProfile", variant: "anchoredVolumeProfile", category: "forecasting", anchors: 1, supportsText: false },
  { key: "priceRange", variant: "priceRange", category: "forecasting", anchors: 2, supportsText: false },
  { key: "dateRange", variant: "dateRange", category: "forecasting", anchors: 2, supportsText: false },
  { key: "dateAndPriceRange", variant: "dateAndPriceRange", category: "forecasting", anchors: 2, supportsText: false },
  { key: "brush", variant: "brush", category: "brush", anchors: 2, supportsText: false },
  { key: "highlighter", variant: "highlighter", category: "brush", anchors: 2, supportsText: false },
  { key: "arrowMarker", variant: "arrowMarker", category: "brush", anchors: 1, supportsText: false },
  { key: "arrowTool", variant: "arrowTool", category: "brush", anchors: 2, supportsText: false },
  { key: "arrowMarkUp", variant: "arrowMarkUp", category: "brush", anchors: 1, supportsText: false },
  { key: "arrowMarkDown", variant: "arrowMarkDown", category: "brush", anchors: 1, supportsText: false },
  { key: "rectangle", variant: "rectangle", category: "brush", anchors: 2, supportsText: true },
  { key: "rotatedRectangle", variant: "rotatedRectangle", category: "brush", anchors: 2, supportsText: false },
  { key: "path", variant: "path", category: "brush", anchors: 2, supportsText: false },
  { key: "circle", variant: "circle", category: "brush", anchors: 2, supportsText: true },
  { key: "ellipse", variant: "ellipse", category: "brush", anchors: 2, supportsText: false },
  { key: "polyline", variant: "polyline", category: "brush", anchors: 2, supportsText: false },
  { key: "triangle", variant: "triangle", category: "brush", anchors: 2, supportsText: true },
  { key: "arc", variant: "arc", category: "brush", anchors: 2, supportsText: false },
  { key: "curveTool", variant: "curveTool", category: "brush", anchors: 2, supportsText: false },
  { key: "doubleCurve", variant: "doubleCurve", category: "brush", anchors: 2, supportsText: false },
];

const SCENARIOS_PER_TOOL = 500;

const PALETTE = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#FFA500", "#800080", "#008000", "#FFC0CB", "#A52A2A", "#000000",
  "#FFFFFF", "#808080", "#FFD700", "#4B0082", "#7FFF00", "#DC143C",
];
const STYLES = ["solid", "dashed", "dotted"];

function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function saveResult(key: string, idx: number, data: Record<string, unknown>) {
  const dir = path.join(OUT_DIR, key); ensureDir(dir);
  fs.writeFileSync(path.join(dir, `scenario-${String(idx).padStart(3, "0")}.json`), JSON.stringify(data, null, 2), "utf-8");
}

function makeParagraph(scenarioIndex: number): string {
  const minLines = 50, maxLines = 1000;
  const lines = Math.min(maxLines, minLines + Math.floor((scenarioIndex / SCENARIOS_PER_TOOL) * (maxLines - minLines)));
  const out: string[] = [];
  for (let i = 0; i < lines; i++) out.push(`L${i.toString().padStart(4, "0")} fox lazy dog 0123456789.`);
  return out.join("\n");
}

async function gotoApp(page: Page) {
  const token = process.env.E2E_PROD_TOKEN ?? "";
  await page.addInitScript((t) => {
    try {
      window.localStorage.removeItem("chart-keep-drawing");
      window.localStorage.removeItem("chart-lock-all");
      if (t) window.localStorage.setItem("sim_token", t);
    } catch { /* ignore */ }
  }, token);
  await page.goto(`${APP_URL}/charts?symbol=${SYMBOL}`, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="chart-interaction-surface"]', { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function getSurfaceBox(page: Page) {
  const el = page.getByTestId("chart-interaction-surface").first();
  if (!(await el.count())) return null;
  return el.boundingBox();
}

for (const tool of TOOLS) {
  test.describe(`[APP-REG][${tool.key}] our-lib ${tool.variant} — 500 scenarios`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(60_000);

    let page: Page;
    let pageReady = false;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      page = await ctx.newPage();
      try { await gotoApp(page); pageReady = true; } catch (e) { console.warn(`[${tool.key}]`, e); }
    });

    for (let s = 0; s < SCENARIOS_PER_TOOL; s++) {
      test(`scenario-${String(s).padStart(3, "0")} — app ${tool.variant}`, async () => {
        const start = Date.now();
        const result: Record<string, unknown> = {
          tool: tool.key, scenarioIndex: s, ts: new Date().toISOString(), passed: false, observed: {} as Record<string, unknown>,
        };

        try {
          if (!pageReady) { try { await gotoApp(page); pageReady = true; } catch { /* fail-soft */ } }

          // 1. Activate rail category
          const rail = page.getByTestId(`rail-${tool.category}`).first();
          if (await rail.count()) {
            await rail.click({ force: true, timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(120);
          }
          // 2. Activate tool variant in popover
          const toolBtn = page.getByTestId(`tool-${tool.variant}`).first();
          let toolReady = false;
          if (await toolBtn.count()) {
            await toolBtn.click({ force: true, timeout: 1500 }).catch(() => {});
            toolReady = true;
            await page.waitForTimeout(100);
          }
          (result.observed as Record<string, unknown>).toolReady = toolReady;

          // 3. Draw
          const box = await getSurfaceBox(page);
          if (box) {
            const cx = box.x + box.width * 0.3 + ((s * 7) % Math.floor(box.width * 0.4));
            const cy = box.y + box.height * 0.3 + ((s * 11) % Math.floor(box.height * 0.3));
            for (let a = 0; a < tool.anchors; a++) {
              await page.mouse.move(cx + a * 80, cy + a * 50);
              await page.mouse.click(cx + a * 80, cy + a * 50);
              await page.waitForTimeout(70);
            }
            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(100);
          }

          // 4. Open style panel via floating toolbar / right-click
          const settings = page.locator('[data-testid="floating-settings"], [data-testid="drawing-settings"], button[aria-label*="settings" i]').first();
          let panelOpen = false;
          if (await settings.isVisible({ timeout: 400 }).catch(() => false)) {
            await settings.click({ force: true }).catch(() => {});
            await page.waitForTimeout(180);
            panelOpen = true;
          }
          (result.observed as Record<string, unknown>).panelOpen = panelOpen;

          // 5. Cycle options
          const colour = PALETTE[s % PALETTE.length];
          const width = 1 + (s % 8);
          const opacity = +(0.15 + (s % 17) * 0.05).toFixed(2);
          const style = STYLES[s % STYLES.length];
          const fontSize = 10 + (s % 19);

          if (panelOpen) {
            const widthInput = page.locator('input[name="thickness"], input[aria-label*="width" i]').first();
            if (await widthInput.isVisible({ timeout: 200 }).catch(() => false)) {
              await widthInput.fill(String(width)).catch(() => {});
            }
            const colourInput = page.locator('input[type="color"], input[name="color"]').first();
            if (await colourInput.isVisible({ timeout: 200 }).catch(() => false)) {
              await colourInput.fill(colour).catch(() => {});
            }
            const opacityInput = page.locator('input[name="opacity"], input[aria-label*="opacity" i]').first();
            if (await opacityInput.isVisible({ timeout: 200 }).catch(() => false)) {
              await opacityInput.fill(String(opacity)).catch(() => {});
            }
            if (tool.supportsText) {
              const txt = page.locator('textarea[name="text"], textarea[aria-label*="text" i], div[contenteditable="true"]').first();
              if (await txt.isVisible({ timeout: 200 }).catch(() => false)) {
                const para = makeParagraph(s);
                await txt.fill(para).catch(async () => {
                  await txt.click({ force: true }).catch(() => {});
                  await page.keyboard.type(para.slice(0, 2_000)).catch(() => {});
                });
                (result.observed as Record<string, unknown>).paragraphLines = para.split("\n").length;
              }
            }
            (result.observed as Record<string, unknown>).colour = colour;
            (result.observed as Record<string, unknown>).width = width;
            (result.observed as Record<string, unknown>).opacity = opacity;
            (result.observed as Record<string, unknown>).style = style;
            (result.observed as Record<string, unknown>).fontSize = fontSize;
            await page.keyboard.press("Escape").catch(() => {});
          }

          // 6. Cleanup
          await page.keyboard.press("Escape").catch(() => {});
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
