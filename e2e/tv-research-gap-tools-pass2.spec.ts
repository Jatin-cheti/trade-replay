/**
 * tv-research-gap-tools-pass2.spec.ts
 * =====================================
 * Second-pass deep research: fixes the three gaps from pass1:
 *
 * Gap 1 — Floating drawing toolbar: uses DOM-diff (before-select vs after-select)
 *          to find ONLY the elements that appear when a drawing is selected.
 *
 * Gap 2 — Drawing context menu: right-clicks at the EXACT draw center immediately
 *          after placing the tool so we hit the drawing, not empty chart space.
 *
 * Gap 3 — Settings modal: opens via gear button found in the post-select DOM diff
 *          so we target the correct element, not the chart settings.
 *
 * Run:
 *   npx playwright test e2e/tv-research-gap-tools-pass2.spec.ts \
 *     --config=e2e/playwright.tv-research.config.ts \
 *     --project=chromium --headed --timeout=300000
 *
 * Single tool:
 *   --grep "\[PASS2\]\[rectangle\]"
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const TV_URL = "https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE";
const OUT_ROOT = path.join(__dirname, "tv-research-output");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pass2Result {
  tool: string;
  // Gap 1: actual floating drawing toolbar buttons
  drawingToolbar: {
    found: boolean;
    buttons: Array<{ ariaLabel: string; title: string; dataName: string; type: string }>;
    containerClass: string | null;
    containerDataName: string | null;
    screenshotPath: string | null;
    note: string;
  };
  // Gap 2: drawing-level context menu
  drawingContextMenu: {
    items: string[];
    hasEditObject: boolean;
    hasClone: boolean;
    hasDelete: boolean;
    hasLock: boolean;
    hasHide: boolean;
    hasBringToFront: boolean;
    hasSendToBack: boolean;
    screenshotPath: string | null;
    note: string;
  };
  // Gap 3: settings modal real content
  settingsModal: {
    opened: boolean;
    openedVia: string;
    title: string | null;
    tabs: string[];
    allFieldLabels: string[];
    hasOk: boolean;
    hasCancel: boolean;
    hasApply: boolean;
    hasDefaults: boolean;
    screenshotPath: string | null;
    note: string;
  };
  // Additional: default colors from TV's SVG/DOM (not canvas)
  defaultColors: {
    strokeColor: string | null;
    fillColor: string | null;
    lineWidth: string | null;
    screenshotPath: string | null;
  };
  // Additional: handle details
  handles: {
    countFromDomDiff: number | null;
    svgCircleCount: number | null;
    svgRectCount: number | null;
    handleColorSamples: string[];
    handleSizeSamples: string[];
    screenshotPath: string | null;
  };
  // Tool activation details
  activation: {
    tooltipText: string | null;
    helperText: string | null;
    cursorDuringDraw: string | null;
    activationPersistsAfterOnePlace: boolean | null;
  };
}

interface ToolDef {
  key: string;
  label: string;
  railSelector: string;
  toolSelector: string;
  commitMode: "drag" | "click" | "click-sequence";
  anchorCount: number;
  tvShortcut?: string;
  endsWithRightClick?: boolean;
}

const ALL_TOOLS: ToolDef[] = [
  { key: "longPosition", label: "Long position", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Long position"]', commitMode: "click-sequence", anchorCount: 3, tvShortcut: "Alt+L" },
  { key: "shortPosition", label: "Short position", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Short position"]', commitMode: "click-sequence", anchorCount: 3, tvShortcut: "Alt+S" },
  { key: "positionForecast", label: "Forecast", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Forecast"]', commitMode: "click-sequence", anchorCount: 3 },
  { key: "barPattern", label: "Bars Pattern", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Bars Pattern"]', commitMode: "drag", anchorCount: 2 },
  { key: "ghostFeed", label: "Ghost Feed", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Ghost Feed"]', commitMode: "drag", anchorCount: 2 },
  { key: "sector", label: "Sector", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Sector"]', commitMode: "click-sequence", anchorCount: 3 },
  { key: "anchoredVwap", label: "Anchored VWAP", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Anchored VWAP"]', commitMode: "click", anchorCount: 1, tvShortcut: "Alt+W" },
  { key: "fixedRangeVolumeProfile", label: "Fixed Range", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Fixed Range"]', commitMode: "drag", anchorCount: 2 },
  { key: "anchoredVolumeProfile", label: "Anchored Volume Profile", railSelector: '[aria-label="Forecasting and measurement tools"]', toolSelector: '[aria-label="Anchored Volume Profile"]', commitMode: "click", anchorCount: 1 },
  { key: "priceRange", label: "Price Range", railSelector: '[aria-label="Measure"]', toolSelector: '[aria-label="Price Range"]', commitMode: "drag", anchorCount: 2, tvShortcut: "Alt+P" },
  { key: "dateRange", label: "Date Range", railSelector: '[aria-label="Measure"]', toolSelector: '[aria-label="Date Range"]', commitMode: "drag", anchorCount: 2 },
  { key: "dateAndPriceRange", label: "Date and Price Range", railSelector: '[aria-label="Measure"]', toolSelector: '[aria-label="Date and Price Range"]', commitMode: "drag", anchorCount: 2 },
  { key: "brush", label: "Brush", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Brush"]', commitMode: "drag", anchorCount: 2 },
  { key: "highlighter", label: "Highlighter", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Highlighter"]', commitMode: "drag", anchorCount: 2 },
  { key: "arrowMarker", label: "Arrow marker", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Arrow marker"]', commitMode: "click", anchorCount: 1 },
  { key: "arrowTool", label: "Arrow", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Arrow"]', commitMode: "drag", anchorCount: 2 },
  { key: "arrowMarkUp", label: "Arrow mark up", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Arrow mark up"]', commitMode: "click", anchorCount: 1 },
  { key: "arrowMarkDown", label: "Arrow mark down", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Arrow mark down"]', commitMode: "click", anchorCount: 1 },
  { key: "rectangle", label: "Rectangle", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Rectangle"]', commitMode: "drag", anchorCount: 2, tvShortcut: "Alt+R" },
  { key: "rotatedRectangle", label: "Rotated rectangle", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Rotated rectangle"]', commitMode: "drag", anchorCount: 2 },
  { key: "path", label: "Path", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Path"]', commitMode: "click-sequence", anchorCount: 3, endsWithRightClick: true },
  { key: "circle", label: "Circle", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Circle"]', commitMode: "drag", anchorCount: 2 },
  { key: "ellipse", label: "Ellipse", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Ellipse"]', commitMode: "drag", anchorCount: 2 },
  { key: "polyline", label: "Polyline", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Polyline"]', commitMode: "click-sequence", anchorCount: 3, endsWithRightClick: true },
  { key: "triangle", label: "Triangle", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Triangle"]', commitMode: "click-sequence", anchorCount: 3, endsWithRightClick: true },
  { key: "arc", label: "Arc", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Arc"]', commitMode: "click-sequence", anchorCount: 2 },
  { key: "curveTool", label: "Curve", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Curve"]', commitMode: "click-sequence", anchorCount: 2 },
  { key: "doubleCurve", label: "Double curve", railSelector: '[aria-label="Geometric shapes"]', toolSelector: '[aria-label="Double curve"]', commitMode: "click-sequence", anchorCount: 3 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function mergeResult(toolKey: string, pass2: Pass2Result) {
  const file = path.join(OUT_ROOT, toolKey, "audit.json");
  if (!fs.existsSync(file)) return;
  const existing = JSON.parse(fs.readFileSync(file, "utf-8"));
  existing.pass2 = pass2;
  fs.writeFileSync(file, JSON.stringify(existing, null, 2), "utf-8");
}

async function scrot(page: Page, toolKey: string, label: string): Promise<string> {
  const dir = path.join(OUT_ROOT, toolKey, "screenshots");
  ensureDir(dir);
  const file = path.join(dir, `p2-${label}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => null);
  return file;
}

async function dismissModals(page: Page) {
  try {
    await page.evaluate((): void => {
      const texts = new Set(["maybe later","no, thanks","not now","skip","dismiss","continue","got it","accept","close","ok"]);
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("button,[role='button']"))) {
        const s = window.getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const txt = (el.textContent ?? "").trim().toLowerCase();
        const lbl = (el.getAttribute("aria-label") ?? "").trim().toLowerCase();
        if (texts.has(txt) || lbl.includes("close")) { el.click(); return; }
      }
      document.querySelectorAll<HTMLElement>('[class*="mask"],[class*="backdrop"],[class*="scrim"]')
        .forEach(e => { e.style.setProperty("display","none","important"); });
    });
  } catch { /* ignore */ }
  try { await page.keyboard.press("Escape"); } catch { /* ignore */ }
  await page.waitForTimeout(150);
}

async function openChart(page: Page) {
  await page.goto(TV_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { await dismissModals(page); await page.waitForTimeout(300); }
  await page.waitForSelector("canvas", { timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(1000);
  await dismissModals(page);
}

async function chartBox(page: Page) {
  for (const s of ["canvas.chart-gui-wrapper","canvas[class*=chart]","canvas"]) {
    try {
      const b = await page.locator(s).first().boundingBox({ timeout: 2000 });
      if (b && b.width > 100) return b;
    } catch { /* try next */ }
  }
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  return { x: 60, y: 60, width: vp.width - 120, height: vp.height - 120 };
}

async function activateTool(page: Page, tool: ToolDef): Promise<void> {
  await dismissModals(page);
  try {
    const direct = page.locator(tool.toolSelector).first();
    if (await direct.isVisible({ timeout: 500 })) {
      const b = await direct.boundingBox().catch(() => null);
      if (b && b.x < 90) { await direct.click({ force: true }); await page.waitForTimeout(300); return; }
    }
  } catch { /* expand */ }
  try {
    await page.locator(tool.railSelector).first().click({ force: true, timeout: 3000 });
    await page.waitForTimeout(350);
    await dismissModals(page);
  } catch { /* ignore */ }
  try {
    const els = page.locator(tool.toolSelector);
    const n = await els.count();
    for (let i = 0; i < n; i++) {
      const el = els.nth(i);
      const b = await el.boundingBox().catch(() => null);
      if (b && b.x > 40) { await el.click({ force: true }); await page.waitForTimeout(300); return; }
    }
    if (n > 0) { await els.first().click({ force: true }); await page.waitForTimeout(300); }
  } catch { /* keyboard */ }
  if (tool.tvShortcut) {
    const parts = tool.tvShortcut.split("+");
    if (parts.length === 2) {
      await page.keyboard.down(parts[0]);
      await page.keyboard.press(parts[1]);
      await page.keyboard.up(parts[0]);
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Place the tool at a FIXED center position and return the exact draw center.
 * We use a fixed position so we can right-click precisely on the drawing later.
 */
async function placeTool(
  page: Page, tool: ToolDef,
  box: { x: number; y: number; width: number; height: number },
): Promise<{ cx: number; cy: number; x1: number; y1: number; x2: number; y2: number }> {
  // Always use the same position: center of chart, horizontal drag
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.45;
  const x1 = cx - 90;
  const y1 = cy;
  const x2 = cx + 90;
  const y2 = cy + 35;

  await dismissModals(page);

  if (tool.commitMode === "click") {
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(400);
  } else if (tool.commitMode === "drag") {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  } else {
    // click-sequence: always 3 clicks
    await page.mouse.click(x1, y1); await page.waitForTimeout(200);
    await page.mouse.click(cx, cy + 15); await page.waitForTimeout(200);
    if (tool.endsWithRightClick) {
      await page.mouse.click(x2, y2, { button: "right" }); // commits by right-click
    } else {
      await page.mouse.dblclick(x2, y2); // double-click commits
    }
    await page.waitForTimeout(400);
  }
  await dismissModals(page);
  return { cx, cy, x1, y1, x2, y2 };
}

/** Snapshot all visible elements with bounds, class, aria-label, data-name */
async function domSnapshot(page: Page): Promise<Array<{ id: string; cls: string; aria: string; dn: string; x: number; y: number; w: number; h: number }>> {
  return page.evaluate((): Array<{ id: string; cls: string; aria: string; dn: string; x: number; y: number; w: number; h: number }> => {
    const results: Array<{ id: string; cls: string; aria: string; dn: string; x: number; y: number; w: number; h: number }> = [];
    // Only check buttons and interactive elements
    const els = document.querySelectorAll<HTMLElement>("button,[role='button'],div[tabindex]");
    for (const el of Array.from(els)) {
      const s = window.getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      results.push({
        id: el.id || "",
        cls: (el.className || "").slice(0, 80),
        aria: (el.getAttribute("aria-label") || "").slice(0, 60),
        dn: (el.getAttribute("data-name") || "").slice(0, 40),
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    return results;
  }).catch(() => []);
}

/** Extract elements that appeared in snap2 but NOT in snap1 (new after selection) */
function diffSnapshots(
  snap1: Array<{ id: string; cls: string; aria: string; dn: string; x: number; y: number; w: number; h: number }>,
  snap2: Array<{ id: string; cls: string; aria: string; dn: string; x: number; y: number; w: number; h: number }>,
): Array<{ id: string; cls: string; aria: string; dn: string; x: number; y: number; w: number; h: number }> {
  // Build set of keys from snap1
  const snap1Keys = new Set(snap1.map(e => `${e.cls}|${e.aria}|${e.dn}|${e.x}|${e.y}`));
  return snap2.filter(e => {
    const k = `${e.cls}|${e.aria}|${e.dn}|${e.x}|${e.y}`;
    return !snap1Keys.has(k);
  });
}

/** Clear all drawings via repeated Ctrl+Z */
async function clearChart(page: Page, n = 10) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Control+z").catch(() => null);
    await page.waitForTimeout(50);
  }
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(200);
  await dismissModals(page);
}

/** Get tooltip text from element */
async function getTooltip(page: Page, sel: string): Promise<string> {
  try {
    const el = page.locator(sel).first();
    await el.hover({ timeout: 2000 });
    await page.waitForTimeout(800);
    return await page.evaluate((): string => {
      const sels = ['[class*="tooltip"]','[role="tooltip"]','[class*="Tooltip"]'];
      for (const s of sels) {
        const t = document.querySelector(s);
        if (!t) continue;
        const style = window.getComputedStyle(t as HTMLElement);
        if (style.display === "none" || style.opacity === "0") continue;
        const txt = (t.textContent ?? "").trim();
        if (txt) return txt;
      }
      return "";
    });
  } catch { return ""; }
}

// ─── Main research per tool ───────────────────────────────────────────────────

async function runPass2(page: Page, tool: ToolDef): Promise<Pass2Result> {
  const result: Pass2Result = {
    tool: tool.key,
    drawingToolbar: { found: false, buttons: [], containerClass: null, containerDataName: null, screenshotPath: null, note: "" },
    drawingContextMenu: { items: [], hasEditObject: false, hasClone: false, hasDelete: false, hasLock: false, hasHide: false, hasBringToFront: false, hasSendToBack: false, screenshotPath: null, note: "" },
    settingsModal: { opened: false, openedVia: "", title: null, tabs: [], allFieldLabels: [], hasOk: false, hasCancel: false, hasApply: false, hasDefaults: false, screenshotPath: null, note: "" },
    defaultColors: { strokeColor: null, fillColor: null, lineWidth: null, screenshotPath: null },
    handles: { countFromDomDiff: null, svgCircleCount: null, svgRectCount: null, handleColorSamples: [], handleSizeSamples: [], screenshotPath: null },
    activation: { tooltipText: null, helperText: null, cursorDuringDraw: null, activationPersistsAfterOnePlace: null },
  };

  const box = await chartBox(page);
  await clearChart(page, 5);

  // ── 1. Tooltip research ────────────────────────────────────────────────────
  try {
    await page.locator(tool.railSelector).first().click({ force: true, timeout: 2000 });
    await page.waitForTimeout(300);
    const tip = await getTooltip(page, tool.toolSelector);
    result.activation.tooltipText = tip || null;
    // Also get aria-label as backup
    const ariaLabel = await page.locator(tool.toolSelector).first().getAttribute("aria-label").catch(() => null);
    if (!tip && ariaLabel) result.activation.tooltipText = `aria-label: ${ariaLabel}`;
    await page.keyboard.press("Escape").catch(() => null);
    await page.waitForTimeout(200);
  } catch { /* ignore */ }

  // ── 2. Activate + check helper text (TV shows instruction during drawing) ──
  await activateTool(page, tool);
  // Capture helper text shown at bottom of chart during drawing
  try {
    result.activation.helperText = await page.evaluate((): string | null => {
      const helperSels = [
        '[class*="statusbar"]', '[class*="status-bar"]', '[class*="hint"]',
        '[class*="helper"]', '[class*="instruction"]', '[class*="crosshair"]',
      ];
      for (const sel of helperSels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const s = window.getComputedStyle(el as HTMLElement);
        if (s.display === "none") continue;
        const txt = (el.textContent ?? "").trim();
        if (txt && txt.length < 200) return txt;
      }
      return null;
    });
  } catch { /* ignore */ }

  // ── 3. DOM snapshot BEFORE placing (to diff later) ────────────────────────
  await activateTool(page, tool);
  const snapBefore = await domSnapshot(page);

  // ── 4. Place the tool at fixed position ───────────────────────────────────
  const { cx, cy, x1, y1, x2, y2 } = await placeTool(page, tool, box);

  // ── 5. DOM snapshot AFTER placing (find new elements = drawing toolbar) ───
  const snapAfter = await domSnapshot(page);
  const newElements = diffSnapshots(snapBefore, snapAfter);

  // Filter new elements: drawing toolbar buttons are typically:
  // - Not on the left rail (x > 60)
  // - Small buttons (w < 60, h < 60)
  // - NOT the left sidebar
  const toolbarNewElements = newElements.filter(e =>
    e.x > 60 && e.w < 80 && e.h < 80
  );

  if (toolbarNewElements.length > 0) {
    result.drawingToolbar.found = true;
    result.drawingToolbar.buttons = toolbarNewElements.map(e => ({
      ariaLabel: e.aria,
      title: "",
      dataName: e.dn,
      type: e.cls.includes("button") ? "button" : "div",
    }));
    result.drawingToolbar.note = `DOM diff found ${toolbarNewElements.length} new elements after placing drawing`;
    // Find container class from the largest group of new buttons
    if (toolbarNewElements.length > 0) {
      result.drawingToolbar.containerClass = toolbarNewElements[0].cls.slice(0, 100);
    }
  } else {
    result.drawingToolbar.note = `DOM diff found 0 new elements. Drawing may have been selected but toolbar is canvas-rendered or same-class as rail.`;
  }

  const tbPath = await scrot(page, tool.key, "p2-drawing-toolbar");
  result.drawingToolbar.screenshotPath = tbPath;

  // ── 6. Handle count from DOM diff ─────────────────────────────────────────
  // SVG elements count before and after selection
  const handleData = await page.evaluate((): { circles: number; rects: number; colors: string[]; sizes: string[] } => {
    const svgEls = document.querySelectorAll<SVGElement>("svg circle, svg ellipse");
    const rects = document.querySelectorAll<SVGElement>("svg rect");
    const circles: string[] = [];
    const sizes: string[] = [];
    for (const el of Array.from(svgEls)) {
      const r = (el as SVGGraphicsElement).getBoundingClientRect();
      if (r.width === 0) continue;
      const fill = el.getAttribute("fill") || window.getComputedStyle(el).fill;
      circles.push(fill);
      sizes.push(`${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return { circles: svgEls.length, rects: rects.length, colors: circles, sizes };
  }).catch(() => ({ circles: 0, rects: 0, colors: [], sizes: [] }));

  result.handles.svgCircleCount = handleData.circles;
  result.handles.svgRectCount = handleData.rects;
  result.handles.handleColorSamples = [...new Set(handleData.colors)].slice(0, 5);
  result.handles.handleSizeSamples = [...new Set(handleData.sizes)].slice(0, 5);
  result.handles.countFromDomDiff = toolbarNewElements.length; // proxy
  result.handles.screenshotPath = tbPath;

  // ── 7. Drawing color extraction ───────────────────────────────────────────
  const colorData = await page.evaluate((): { stroke: string; fill: string; width: string } => {
    // TV renders most drawings as SVG paths with inline style or computed style
    const svgPaths = document.querySelectorAll<SVGElement>("svg path, svg line, svg polyline");
    for (const p of Array.from(svgPaths)) {
      const s = window.getComputedStyle(p);
      const stroke = s.stroke;
      const fill = s.fill;
      const sw = s.strokeWidth;
      if (stroke && stroke !== "none" && stroke !== "rgba(0, 0, 0, 0)" &&
          !stroke.includes("15, 15, 15")) { // skip near-black (likely chart lines)
        return { stroke, fill: fill || "none", width: sw };
      }
    }
    return { stroke: "not-extracted", fill: "not-extracted", width: "not-extracted" };
  });
  result.defaultColors.strokeColor = colorData.stroke;
  result.defaultColors.fillColor = colorData.fill;
  result.defaultColors.lineWidth = colorData.width;

  // ── 8. Right-click on the ACTUAL drawing (known position) ─────────────────
  // The drawing is at/near (cx, cy) — right-click there immediately
  // First deselect (click elsewhere), then reselect by right-clicking
  await page.mouse.click(box.x + box.width * 0.1, box.y + 20); // click far away to deselect
  await page.waitForTimeout(300);

  // For drag tools: midpoint of drag = (x1+x2)/2, (y1+y2)/2
  const drawMidX = (x1 + x2) / 2;
  const drawMidY = (y1 + y2) / 2;

  // Click to select the drawing first
  await page.mouse.click(drawMidX, drawMidY);
  await page.waitForTimeout(300);

  // Now right-click on the drawing to get drawing context menu
  await page.mouse.click(drawMidX, drawMidY, { button: "right" });
  await page.waitForTimeout(700);

  const ctxPath = await scrot(page, tool.key, "p2-drawing-context-menu");
  result.drawingContextMenu.screenshotPath = ctxPath;

  // Extract context menu - look specifically for TV's drawing context menu pattern
  const menuItems = await page.evaluate((): string[] => {
    // TV drawing context menu uses specific class patterns
    const menuSelectors = [
      // TV's modern context menu
      '[class*="contextmenu"]', '[class*="contextMenu"]',
      '[class*="context-menu"]', '[class*="ContextMenu"]',
      '[data-name="context-menu"]',
      // TV popup/overlay
      '[class*="popup-"]', '[class*="popup"]',
      '[role="menu"]', '[role="listbox"]',
    ];

    // Find all potential menu containers (look for visible ones with reasonable size)
    let bestMenu: Element | null = null;
    let bestItemCount = 0;
    const vw = window.innerWidth, vh = window.innerHeight;

    for (const sel of menuSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const s = window.getComputedStyle(el as HTMLElement);
        if (s.display === "none" || s.visibility === "hidden") continue;
        const r = (el as HTMLElement).getBoundingClientRect();
        // Context menu is typically narrow and positioned within viewport
        if (r.width < 50 || r.height < 20 || r.width > 500) continue;
        if (r.right > vw + 20 || r.bottom > vh + 20) continue;
        const items = el.querySelectorAll<HTMLElement>("li,[class*='item'],[class*='Item'],[class*='row'],[class*='Row']");
        const count = items.length;
        if (count > bestItemCount) { bestItemCount = count; bestMenu = el; }
      }
    }

    if (!bestMenu) {
      // Fallback: look for any list near the center of the screen
      const lists = document.querySelectorAll("ul,ol,[role='menu']");
      for (const list of Array.from(lists)) {
        const s = window.getComputedStyle(list as HTMLElement);
        if (s.display === "none") continue;
        const r = (list as HTMLElement).getBoundingClientRect();
        if (r.width < 50 || r.height < 50) continue;
        const items = list.querySelectorAll<HTMLElement>("li,[class*='item']");
        if (items.length > bestItemCount) { bestItemCount = items.length; bestMenu = list; }
      }
    }

    if (!bestMenu) return [];

    const texts: string[] = [];
    const allItems = bestMenu.querySelectorAll<HTMLElement>(
      "li,[class*='item'],[class*='Item'],[class*='row'],[class*='menuItem'],[class*='MenuItem']"
    );
    for (const item of Array.from(allItems)) {
      const s2 = window.getComputedStyle(item);
      if (s2.display === "none" || s2.visibility === "hidden") continue;
      const r2 = item.getBoundingClientRect();
      if (r2.height < 5) continue;
      const txt = (item.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
      if (txt && !texts.includes(txt)) texts.push(txt);
    }
    return texts;
  }).catch(() => []);

  result.drawingContextMenu.items = menuItems;
  result.drawingContextMenu.note = menuItems.length === 0
    ? "Context menu not found - drawing may not have been hit. Canvas-rendered drawing hit-testing failed."
    : `Found ${menuItems.length} context menu items`;
  result.drawingContextMenu.hasEditObject = menuItems.some(m => m.toLowerCase().includes("edit") || m.toLowerCase().includes("propert"));
  result.drawingContextMenu.hasClone = menuItems.some(m => m.toLowerCase().includes("clone") || m.toLowerCase().includes("duplicate"));
  result.drawingContextMenu.hasDelete = menuItems.some(m => m.toLowerCase().includes("delete"));
  result.drawingContextMenu.hasLock = menuItems.some(m => m.toLowerCase().includes("lock"));
  result.drawingContextMenu.hasHide = menuItems.some(m => m.toLowerCase().includes("hide") || m.toLowerCase().includes("visibility"));
  result.drawingContextMenu.hasBringToFront = menuItems.some(m => m.toLowerCase().includes("front"));
  result.drawingContextMenu.hasSendToBack = menuItems.some(m => m.toLowerCase().includes("back") || m.toLowerCase().includes("behind"));

  // Dismiss context menu
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(200);

  // ── 9. Settings modal (via floating toolbar) ──────────────────────────────
  // Re-select the drawing by clicking on it
  await page.mouse.click(drawMidX, drawMidY);
  await page.waitForTimeout(400);

  // Try to open settings via double-click (TV's primary way)
  await page.mouse.dblclick(drawMidX, drawMidY);
  await page.waitForTimeout(800);

  const settingsPath = await scrot(page, tool.key, "p2-settings-via-dblclick");

  const settingsData = await page.evaluate((): {
    opened: boolean; title: string; tabs: string[]; fields: string[];
    hasOk: boolean; hasCancel: boolean; hasApply: boolean; hasDefaults: boolean;
  } => {
    // Check if a modal/dialog appeared
    const modalSels = [
      '[class*="dialog"]', '[class*="Dialog"]',
      '[class*="modal"]', '[class*="Modal"]',
      '[role="dialog"]', '[role="alertdialog"]',
      '[data-dialog-name]', '[class*="properties"]',
    ];

    let modal: HTMLElement | null = null;
    for (const sel of modalSels) {
      const els = document.querySelectorAll<HTMLElement>(sel);
      for (const el of Array.from(els)) {
        const r = el.getBoundingClientRect();
        if (r.width > 200 && r.height > 100) { modal = el; break; }
      }
      if (modal) break;
    }

    if (!modal) return { opened: false, title: "", tabs: [], fields: [], hasOk: false, hasCancel: false, hasApply: false, hasDefaults: false };

    // Title
    const titleEl = modal.querySelector<HTMLElement>('[class*="title"],[class*="header"] span,h1,h2,h3');
    const title = titleEl ? (titleEl.textContent ?? "").trim() : "";

    // Tabs
    const tabEls = modal.querySelectorAll<HTMLElement>('[role="tab"],[class*="tab"],[class*="Tab"]');
    const tabs: string[] = [];
    for (const t of Array.from(tabEls)) {
      const s = window.getComputedStyle(t);
      if (s.display === "none") continue;
      const txt = (t.textContent ?? "").trim();
      if (txt && txt.length < 30) tabs.push(txt);
    }

    // Field labels
    const labelEls = modal.querySelectorAll<HTMLElement>("label,[class*='label'],[class*='Label']");
    const fields: string[] = [];
    for (const lbl of Array.from(labelEls)) {
      const s = window.getComputedStyle(lbl);
      if (s.display === "none") continue;
      const txt = (lbl.textContent ?? "").trim();
      if (txt && txt.length < 80) fields.push(txt);
    }

    // Buttons
    const btns = Array.from(modal.querySelectorAll<HTMLElement>("button"));
    const btnTexts = btns.map(b => (b.textContent ?? "").trim().toLowerCase());
    const hasOk = btnTexts.includes("ok");
    const hasCancel = btnTexts.includes("cancel");
    const hasApply = btnTexts.includes("apply");
    const hasDefaults = btnTexts.some(t => t.includes("default"));

    return { opened: true, title, tabs: [...new Set(tabs)], fields: [...new Set(fields)], hasOk, hasCancel, hasApply, hasDefaults };
  });

  if (settingsData.opened) {
    result.settingsModal = {
      opened: true, openedVia: "double-click",
      title: settingsData.title || null,
      tabs: settingsData.tabs,
      allFieldLabels: settingsData.fields,
      hasOk: settingsData.hasOk,
      hasCancel: settingsData.hasCancel,
      hasApply: settingsData.hasApply,
      hasDefaults: settingsData.hasDefaults,
      screenshotPath: settingsPath,
      note: `Opened via double-click. Tabs: [${settingsData.tabs.join(",")}]`,
    };
    result.settingsModal.screenshotPath = settingsPath;
    await page.keyboard.press("Escape").catch(() => null);
    await page.waitForTimeout(300);
  } else {
    result.settingsModal.note = "Settings modal did not open via double-click";
    result.settingsModal.screenshotPath = settingsPath;

    // Try via toolbar gear button (find new elements with "settings" in class/aria)
    const settingsBtn = toolbarNewElements.find(e =>
      e.aria.toLowerCase().includes("setting") || e.aria.toLowerCase().includes("propert") ||
      e.dn.toLowerCase().includes("setting")
    );
    if (settingsBtn) {
      try {
        await page.mouse.click(drawMidX, drawMidY); // reselect
        await page.waitForTimeout(300);
        await page.mouse.click(settingsBtn.x + settingsBtn.w / 2, settingsBtn.y + settingsBtn.h / 2);
        await page.waitForTimeout(800);
        const settingsPath2 = await scrot(page, tool.key, "p2-settings-via-toolbar");
        result.settingsModal.screenshotPath = settingsPath2;
        result.settingsModal.openedVia = "toolbar-gear (from DOM diff)";
        await page.keyboard.press("Escape").catch(() => null);
        await page.waitForTimeout(200);
      } catch { /* ignore */ }
    }
  }

  // ── 10. Activation persistence after one draw ──────────────────────────────
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(200);
  // Check if tool is still active (try drawing again without re-activating)
  const snapBeforeSecond = await domSnapshot(page);
  await drawTool2(page, tool, box);
  await page.waitForTimeout(300);
  const snapAfterSecond = await domSnapshot(page);
  const newAfterSecond = diffSnapshots(snapBeforeSecond, snapAfterSecond);
  result.activation.activationPersistsAfterOnePlace = newAfterSecond.length > 0; // proxy

  return result;
}

async function drawTool2(
  page: Page, tool: ToolDef,
  box: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const cx = box.x + box.width * 0.35;
  const cy = box.y + box.height * 0.6;
  const x1 = cx - 60, y1 = cy, x2 = cx + 60, y2 = cy + 25;
  await dismissModals(page);
  if (tool.commitMode === "click") {
    await page.mouse.click(cx, cy); await page.waitForTimeout(300);
  } else if (tool.commitMode === "drag") {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  } else {
    await page.mouse.click(x1, y1); await page.waitForTimeout(150);
    await page.mouse.click(cx, cy + 10); await page.waitForTimeout(150);
    if (tool.endsWithRightClick) {
      await page.mouse.click(x2, y2, { button: "right" });
    } else {
      await page.mouse.dblclick(x2, y2);
    }
    await page.waitForTimeout(300);
  }
}

// ─── Test registration ────────────────────────────────────────────────────────

for (const tool of ALL_TOOLS) {
  test(`[PASS2][${tool.key}] fix toolbar, context-menu, settings extraction`, async ({ page }) => {
    test.setTimeout(300_000);
    await openChart(page);
    const result = await runPass2(page, tool);
    mergeResult(tool.key, result);
    // Save standalone pass2 file too
    ensureDir(path.join(OUT_ROOT, tool.key));
    fs.writeFileSync(
      path.join(OUT_ROOT, tool.key, "pass2.json"),
      JSON.stringify(result, null, 2), "utf-8",
    );
    // Always pass — this is research, not a binary test
    expect(result.tool).toBe(tool.key);
  });
}
