/**
 * tv-research-gap-tools-pass3-icons.spec.ts
 * ==========================================
 * Pass 3: Targeted research for the 3 icon tools (emoji, sticker, iconTool).
 * These were excluded from pass2 because they require a 5-step picker flow
 * (rail → tab → item → canvas click → ChartPromptModal OK) before any drawing
 * exists to research.
 *
 * Focus areas:
 *  A. Icon picker panel: tabs, items, search, layout
 *  B. ChartPromptModal behavior on canvas click
 *  C. Floating toolbar after placement (improved DOM search)
 *  D. Context menu via right-click at exact placement coords
 *  E. Settings modal via right-click > Edit Object
 *
 * Run:
 *   npx playwright test e2e/tv-research-gap-tools-pass3-icons.spec.ts \
 *     --config=e2e/playwright.tv-research.config.ts \
 *     --project=chromium --headed --timeout=300000
 */

import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const TV_URL = "https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE";
const OUT_ROOT = path.join(__dirname, "tv-research-output");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pass3Result {
  tool: string;
  // A: Icon picker
  picker: {
    railSelector: string | null;
    railClickSuccess: boolean;
    panelFound: boolean;
    panelClass: string | null;
    tabs: Array<{ text: string; ariaLabel: string; testId: string | null }>;
    activeTabText: string | null;
    itemCount: number;
    searchInputPresent: boolean;
    selectedItemText: string | null;
    selectedItemSelector: string | null;
    panelScreenshot: string | null;
    tabClickSuccess: boolean;
    itemClickSuccess: boolean;
  };
  // B: ChartPromptModal
  promptModal: {
    appearsAfterCanvasClick: boolean;
    title: string | null;
    bodyText: string | null;
    buttons: string[];
    okSelector: string | null;
    cancelSelector: string | null;
    confirmClickSuccess: boolean;
    screenshotPath: string | null;
  };
  // C: Floating toolbar after placement
  drawingToolbar: {
    found: boolean;
    buttons: Array<{ aria: string; title: string; dn: string; x: number; y: number }>;
    newElementsFromDiff: number;
    containerInfo: string | null;
    screenshotPath: string | null;
    note: string;
  };
  // D: Context menu
  contextMenu: {
    items: string[];
    hasEditObject: boolean;
    hasClone: boolean;
    hasDelete: boolean;
    hasLock: boolean;
    hasHide: boolean;
    rightClickAttempts: number;
    screenshotPath: string | null;
    note: string;
  };
  // E: Settings modal
  settingsModal: {
    opened: boolean;
    openedVia: string;
    title: string | null;
    tabs: string[];
    allFieldLabels: string[];
    hasOk: boolean;
    hasCancel: boolean;
    screenshotPath: string | null;
    note: string;
  };
  // F: Placement coordinates (for future hit-testing reference)
  placement: {
    canvasX: number | null;
    canvasY: number | null;
    iconPlaced: boolean;
  };
}

interface IconToolDef {
  key: "emoji" | "sticker" | "iconTool";
  label: string;
  railSelector: string;
  tabSelectors: string[];
  tabTexts: string[];
  targetTabText: string;
  itemSelectors: string[];
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const ICON_TOOLS: IconToolDef[] = [
  {
    key: "emoji",
    label: "Emoji",
    railSelector: '[aria-label="Icons, signs, anchored text and notes"]',
    tabSelectors: ['[role="tab"]', '[class*="tab"]'],
    tabTexts: ["Emojis", "emoji", "Emoji"],
    targetTabText: "Emojis",
    itemSelectors: [
      '[class*="emojiItem"]', '[class*="emoji-item"]',
      '[class*="iconItem"]', '[class*="icon-item"]',
      '[class*="item"]',
    ],
  },
  {
    key: "sticker",
    label: "Sticker",
    railSelector: '[aria-label="Icons, signs, anchored text and notes"]',
    tabSelectors: ['[role="tab"]', '[class*="tab"]'],
    tabTexts: ["Stickers", "sticker", "Sticker"],
    targetTabText: "Stickers",
    itemSelectors: [
      '[class*="stickerItem"]', '[class*="sticker-item"]',
      '[class*="iconItem"]', '[class*="icon-item"]',
      '[class*="item"]',
    ],
  },
  {
    key: "iconTool",
    label: "Icon",
    railSelector: '[aria-label="Icons, signs, anchored text and notes"]',
    tabSelectors: ['[role="tab"]', '[class*="tab"]'],
    tabTexts: ["Icons", "icon", "Icon"],
    targetTabText: "Icons",
    itemSelectors: [
      '[class*="svgIcon"]', '[class*="svg-icon"]',
      '[class*="iconItem"]', '[class*="icon-item"]',
      '[class*="item"]',
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(d: string) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

async function scrot(page: Page, toolKey: string, label: string): Promise<string> {
  const dir = path.join(OUT_ROOT, toolKey, "screenshots");
  ensureDir(dir);
  const file = path.join(dir, `p3-${label}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => null);
  return file;
}

async function dismissModals(page: Page) {
  try {
    await page.evaluate((): void => {
      const texts = new Set(["maybe later", "no, thanks", "not now", "skip", "dismiss", "continue", "got it", "accept", "close", "ok"]);
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
        .forEach(e => { e.style.setProperty("display", "none", "important"); });
    });
  } catch { /* ignore */ }
  try { await page.keyboard.press("Escape"); } catch { /* ignore */ }
  await page.waitForTimeout(150);
}

async function openChart(page: Page) {
  await page.goto(TV_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 3; i++) { await dismissModals(page); await page.waitForTimeout(400); }
  await page.waitForSelector("canvas", { timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await dismissModals(page);
}

async function chartBox(page: Page) {
  for (const s of ["canvas.chart-gui-wrapper", "canvas[class*=chart]", "canvas"]) {
    try {
      const b = await page.locator(s).first().boundingBox({ timeout: 2000 });
      if (b && b.width > 100) return b;
    } catch { /* try next */ }
  }
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  return { x: 60, y: 60, width: vp.width - 120, height: vp.height - 120 };
}

async function domSnapshot(page: Page) {
  return page.evaluate(() => {
    const els = document.querySelectorAll<HTMLElement>("button,[role='button'],div[tabindex]");
    return Array.from(els).flatMap(el => {
      const s = window.getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return [];
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return [];
      return [{
        cls: (el.className || "").slice(0, 80),
        aria: (el.getAttribute("aria-label") || "").slice(0, 60),
        dn: (el.getAttribute("data-name") || "").slice(0, 40),
        title: (el.getAttribute("title") || "").slice(0, 60),
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
      }];
    });
  }).catch(() => [] as Array<{ cls: string; aria: string; dn: string; title: string; x: number; y: number; w: number; h: number }>);
}

type Snap = Array<{ cls: string; aria: string; dn: string; title: string; x: number; y: number; w: number; h: number }>;

function diffSnaps(s1: Snap, s2: Snap): Snap {
  const keys1 = new Set(s1.map(e => `${e.cls}|${e.aria}|${e.dn}|${e.x}|${e.y}`));
  return s2.filter(e => !keys1.has(`${e.cls}|${e.aria}|${e.dn}|${e.x}|${e.y}`));
}

async function clearChart(page: Page, n = 8) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Control+z").catch(() => null);
    await page.waitForTimeout(60);
  }
  await page.keyboard.press("Escape").catch(() => null);
  await page.waitForTimeout(300);
  await dismissModals(page);
}

// ─── Main research function ───────────────────────────────────────────────────

async function runPass3Icon(page: Page, tool: IconToolDef): Promise<Pass3Result> {
  const result: Pass3Result = {
    tool: tool.key,
    picker: {
      railSelector: null, railClickSuccess: false, panelFound: false, panelClass: null,
      tabs: [], activeTabText: null, itemCount: 0, searchInputPresent: false,
      selectedItemText: null, selectedItemSelector: null, panelScreenshot: null,
      tabClickSuccess: false, itemClickSuccess: false,
    },
    promptModal: {
      appearsAfterCanvasClick: false, title: null, bodyText: null,
      buttons: [], okSelector: null, cancelSelector: null, confirmClickSuccess: false,
      screenshotPath: null,
    },
    drawingToolbar: {
      found: false, buttons: [], newElementsFromDiff: 0,
      containerInfo: null, screenshotPath: null, note: "",
    },
    contextMenu: {
      items: [], hasEditObject: false, hasClone: false, hasDelete: false,
      hasLock: false, hasHide: false, rightClickAttempts: 0,
      screenshotPath: null, note: "",
    },
    settingsModal: {
      opened: false, openedVia: "", title: null, tabs: [],
      allFieldLabels: [], hasOk: false, hasCancel: false,
      screenshotPath: null, note: "",
    },
    placement: { canvasX: null, canvasY: null, iconPlaced: false },
  };

  await clearChart(page);
  await dismissModals(page);

  const box = await chartBox(page);
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.45;

  // ── A: Open the icon picker panel ─────────────────────────────────────────

  // Click the rail button
  const railSels = [
    tool.railSelector,
    '[aria-label*="icon" i]',
    '[aria-label*="sign" i]',
    '[data-name="icons-toolbar"]',
  ];

  for (const sel of railSels) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        result.picker.railSelector = sel;
        await btn.click({ force: true });
        await page.waitForTimeout(600);
        result.picker.railClickSuccess = true;
        break;
      }
    } catch { /* try next */ }
  }

  if (!result.picker.railClickSuccess) {
    // Try clicking by position — icons rail is usually near bottom of left rail
    const railX = box.x - 30;
    const railYBottomArea = box.y + box.height * 0.85;
    await page.mouse.click(railX, railYBottomArea).catch(() => null);
    await page.waitForTimeout(500);
  }

  await scrot(page, tool.key, "p3-after-rail-click");

  // Detect the picker panel
  const panelSelectors = [
    '[class*="iconPanel"]', '[class*="icon-panel"]', '[class*="emojiPanel"]',
    '[class*="emoji-panel"]', '[class*="stickerPanel"]', '[class*="sticker-panel"]',
    '[data-name="icon-panel"]', '[class*="drawingIcons"]',
    '[class*="drawing-icons"]', '[class*="picker"]',
  ];

  for (const sel of panelSelectors) {
    try {
      const panel = page.locator(sel).first();
      if (await panel.isVisible({ timeout: 1000 })) {
        result.picker.panelFound = true;
        const cls = await panel.getAttribute("class");
        result.picker.panelClass = cls;
        break;
      }
    } catch { /* try next */ }
  }

  // Extract tabs from picker panel
  const tabData = await page.evaluate((): Array<{ text: string; aria: string; testId: string | null }> => {
    const results: Array<{ text: string; aria: string; testId: string | null }> = [];
    const tabEls = document.querySelectorAll<HTMLElement>('[role="tab"]');
    for (const el of Array.from(tabEls)) {
      const s = window.getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const text = (el.textContent ?? "").trim();
      const aria = el.getAttribute("aria-label") ?? "";
      const testId = el.getAttribute("data-testid");
      if (text || aria) results.push({ text, aria, testId });
    }
    return results;
  });

  result.picker.tabs = tabData.map(t => ({ text: t.text, ariaLabel: t.aria, testId: t.testId }));
  result.picker.panelScreenshot = await scrot(page, tool.key, "p3-picker-panel");

  // Try to click the target tab
  const targetTexts = tool.tabTexts;
  for (const t of tabData) {
    if (targetTexts.some(tt => t.text.toLowerCase().includes(tt.toLowerCase()) || t.aria.toLowerCase().includes(tt.toLowerCase()))) {
      try {
        await page.getByRole("tab", { name: new RegExp(t.text || t.aria, "i") }).first().click({ force: true, timeout: 2000 });
        await page.waitForTimeout(400);
        result.picker.tabClickSuccess = true;
        result.picker.activeTabText = t.text || t.aria;
        break;
      } catch { /* try next */ }
    }
  }

  await scrot(page, tool.key, "p3-after-tab-click");

  // Check for search input
  try {
    const searchVis = await page.locator('input[type="search"], input[placeholder*="search" i]').first().isVisible({ timeout: 500 });
    result.picker.searchInputPresent = searchVis;
  } catch { /* no search */ }

  // Count items in the panel
  const allItemSelectors = [
    '[class*="item"]', '[class*="icon"]', '[class*="emoji"]',
    '[class*="sticker"]', 'img', 'svg',
  ];
  for (const sel of allItemSelectors) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0 && count < 500) {
        result.picker.itemCount = count;
        break;
      }
    } catch { /* try next */ }
  }

  // Click the first visible item in the panel
  const itemSels = tool.itemSelectors;
  let itemClicked = false;
  for (const sel of itemSels) {
    if (itemClicked) break;
    try {
      const items = page.locator(sel);
      const n = await items.count();
      for (let i = 0; i < Math.min(n, 20); i++) {
        const item = items.nth(i);
        const b = await item.boundingBox().catch(() => null);
        if (!b || b.width === 0) continue;
        // Must be in the panel area (right side of screen or floating)
        if (b.x < 80) continue;
        const txt = await item.textContent().catch(() => "");
        const aria = await item.getAttribute("aria-label").catch(() => "");
        result.picker.selectedItemText = (txt || aria || sel).slice(0, 40);
        result.picker.selectedItemSelector = sel;
        await item.click({ force: true });
        await page.waitForTimeout(400);
        itemClicked = true;
        result.picker.itemClickSuccess = true;
        break;
      }
    } catch { /* try next */ }
  }

  await scrot(page, tool.key, "p3-after-item-click");

  // ── B: Click canvas and handle ChartPromptModal ────────────────────────────

  // Take pre-placement DOM snapshot
  const snapBefore = await domSnapshot(page);

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(600);

  result.placement.canvasX = cx;
  result.placement.canvasY = cy;

  // Check for ChartPromptModal
  const promptSelectors = [
    '[data-testid="chart-prompt-modal"]',
    '[class*="chartPrompt"]', '[class*="chart-prompt"]',
    '[class*="promptModal"]', '[class*="prompt-modal"]',
    '[class*="dialog"]', '[role="dialog"]',
    '[class*="modal"]',
  ];

  let modalFound = false;
  for (const sel of promptSelectors) {
    try {
      const modal = page.locator(sel).first();
      if (await modal.isVisible({ timeout: 1500 })) {
        modalFound = true;
        result.promptModal.appearsAfterCanvasClick = true;
        result.promptModal.title = await modal.locator("h1,h2,h3,[class*='title']").first().textContent().catch(() => null);
        result.promptModal.bodyText = await modal.textContent().catch(() => null);
        result.promptModal.screenshotPath = await scrot(page, tool.key, "p3-chart-prompt-modal");

        // Extract button labels
        const btns = await modal.locator("button").all();
        for (const btn of btns) {
          const txt = await btn.textContent().catch(() => "");
          if (txt?.trim()) result.promptModal.buttons.push(txt.trim());
        }

        // Find and click OK
        const okSelectors = ['button:has-text("OK")', 'button:has-text("Ok")', 'button:has-text("Confirm")', '[class*="ok"]'];
        for (const okSel of okSelectors) {
          try {
            const okBtn = modal.locator(okSel).first();
            if (await okBtn.isVisible({ timeout: 500 })) {
              result.promptModal.okSelector = okSel;
              await okBtn.click({ force: true });
              await page.waitForTimeout(500);
              result.promptModal.confirmClickSuccess = true;
              result.placement.iconPlaced = true;
              break;
            }
          } catch { /* try next */ }
        }
        break;
      }
    } catch { /* try next */ }
  }

  if (!modalFound) {
    // No modal — icon may have been placed directly (or picker already selected item that auto-arms)
    result.promptModal.appearsAfterCanvasClick = false;
    result.promptModal.note = "No ChartPromptModal appeared — icon may have been placed directly";
    result.placement.iconPlaced = true;
  }

  await page.waitForTimeout(800);
  await scrot(page, tool.key, "p3-after-placement");

  // ── C: Floating toolbar (improved DOM diff) ────────────────────────────────

  // Click on the icon to select it
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);

  const snapAfterSelect = await domSnapshot(page);
  const newEls = diffSnaps(snapBefore, snapAfterSelect);

  result.drawingToolbar.newElementsFromDiff = newEls.length;

  // Filter for likely toolbar elements (not in left rail x < 80, not page-level)
  const toolbarCandidates = newEls.filter(el => {
    const notLeftRail = el.x > 80;
    const notTopBar = el.y > 50;
    const smallEnough = el.w < 400 && el.h < 200;
    return notLeftRail && notTopBar && smallEnough;
  });

  if (toolbarCandidates.length > 0) {
    result.drawingToolbar.found = true;
    result.drawingToolbar.buttons = toolbarCandidates.map(el => ({
      aria: el.aria, title: el.title, dn: el.dn, x: el.x, y: el.y,
    }));
    result.drawingToolbar.containerInfo = toolbarCandidates.map(el => el.cls).join(" | ").slice(0, 200);
    result.drawingToolbar.note = `DOM diff found ${toolbarCandidates.length} candidate toolbar elements`;
  } else {
    // Try looking for ALL elements that appear floating near placement coords
    const floatingEls = await page.evaluate(
      ({ pcx, pcy }: { pcx: number; pcy: number }) => {
        const results: Array<{ cls: string; aria: string; dn: string; title: string; x: number; y: number; w: number; h: number }> = [];
        const els = document.querySelectorAll<HTMLElement>("button,[role='button'],div[tabindex='0']");
        for (const el of Array.from(els)) {
          const s = window.getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden") continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // Look for elements within 200px of placement coords
          const dx = Math.abs(r.x + r.width / 2 - pcx);
          const dy = Math.abs(r.y + r.height / 2 - pcy);
          if (dx < 200 && dy < 200) {
            results.push({
              cls: (el.className || "").slice(0, 80),
              aria: (el.getAttribute("aria-label") || "").slice(0, 60),
              dn: (el.getAttribute("data-name") || "").slice(0, 40),
              title: (el.getAttribute("title") || "").slice(0, 60),
              x: Math.round(r.x), y: Math.round(r.y),
              w: Math.round(r.width), h: Math.round(r.height),
            });
          }
        }
        return results;
      },
      { pcx: cx, pcy: cy },
    );

    if (floatingEls.length > 0) {
      result.drawingToolbar.found = true;
      result.drawingToolbar.buttons = floatingEls.map(el => ({
        aria: el.aria, title: el.title, dn: el.dn, x: el.x, y: el.y,
      }));
      result.drawingToolbar.note = `Found ${floatingEls.length} elements near placement coords (proximity method)`;
    } else {
      result.drawingToolbar.note = "No toolbar candidates found via DOM diff or proximity search";
    }
  }

  result.drawingToolbar.screenshotPath = await scrot(page, tool.key, "p3-drawing-toolbar");

  // ── D: Context menu (right-click at exact placement) ──────────────────────

  const rightClickPositions = [
    [cx, cy],
    [cx + 5, cy],
    [cx - 5, cy],
    [cx, cy + 5],
    [cx, cy - 5],
  ];

  for (const [rcx, rcy] of rightClickPositions) {
    result.contextMenu.rightClickAttempts++;
    await page.mouse.click(rcx, rcy); // select first
    await page.waitForTimeout(300);
    await page.mouse.click(rcx, rcy, { button: "right" });
    await page.waitForTimeout(500);

    const menuItems = await page.evaluate((): string[] => {
      const items: string[] = [];
      const selectors = [
        '[class*="menuItem"]', '[class*="menu-item"]', '[class*="contextMenu"] li',
        '[role="menuitem"]', '[role="menu"] > *', '[class*="popup"] > *',
        'li[class*="item"]', '[class*="dropdown"] li',
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll<HTMLElement>(sel);
        for (const el of Array.from(els)) {
          const s = window.getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden") continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const txt = (el.textContent ?? "").trim();
          if (txt && txt.length < 50) items.push(txt);
        }
        if (items.length > 0) break;
      }
      return [...new Set(items)].slice(0, 20);
    });

    if (menuItems.length > 0) {
      result.contextMenu.items = menuItems;
      result.contextMenu.hasEditObject = menuItems.some(i => i.toLowerCase().includes("edit"));
      result.contextMenu.hasClone = menuItems.some(i => i.toLowerCase().includes("clone"));
      result.contextMenu.hasDelete = menuItems.some(i => i.toLowerCase().includes("delete"));
      result.contextMenu.hasLock = menuItems.some(i => i.toLowerCase().includes("lock"));
      result.contextMenu.hasHide = menuItems.some(i => i.toLowerCase().includes("hide"));
      result.contextMenu.screenshotPath = await scrot(page, tool.key, "p3-context-menu");
      result.contextMenu.note = `Context menu found on attempt ${result.contextMenu.rightClickAttempts} at (${rcx},${rcy})`;
      await page.keyboard.press("Escape");
      break;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  if (result.contextMenu.items.length === 0) {
    result.contextMenu.screenshotPath = await scrot(page, tool.key, "p3-no-context-menu");
    result.contextMenu.note = `No drawing-level context menu found after ${result.contextMenu.rightClickAttempts} attempts`;
  }

  // ── E: Settings modal via right-click > Edit Object ───────────────────────

  if (result.contextMenu.hasEditObject) {
    // Right-click, then click Edit Object
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);
    await page.mouse.click(cx, cy, { button: "right" });
    await page.waitForTimeout(500);

    try {
      const editBtn = page.locator('[class*="menuItem"]:has-text("Edit"), [role="menuitem"]:has-text("Edit")').first();
      if (await editBtn.isVisible({ timeout: 1000 })) {
        await editBtn.click();
        await page.waitForTimeout(800);
        result.settingsModal.openedVia = "right-click > Edit";
      }
    } catch { /* not found */ }
  }

  // Also try gear button from toolbar candidates
  if (!result.settingsModal.opened) {
    const gearCandidates = result.drawingToolbar.buttons.filter(b =>
      b.aria.toLowerCase().includes("setting") ||
      b.aria.toLowerCase().includes("gear") ||
      b.title.toLowerCase().includes("setting") ||
      b.dn.toLowerCase().includes("setting"),
    );
    for (const gear of gearCandidates) {
      await page.mouse.click(gear.x + 4, gear.y + 4).catch(() => null);
      await page.waitForTimeout(600);
      const modalVisible = await page.locator('[class*="dialog"],[role="dialog"],[class*="modal"]').first().isVisible({ timeout: 500 }).catch(() => false);
      if (modalVisible) {
        result.settingsModal.openedVia = `gear button at (${gear.x},${gear.y})`;
        break;
      }
    }
  }

  // Check if any modal is open
  const dialogVisible = await page.locator('[role="dialog"], [class*="dialog"], [class*="modal"]').first().isVisible({ timeout: 500 }).catch(() => false);
  if (dialogVisible) {
    result.settingsModal.opened = true;
    const dialog = page.locator('[role="dialog"], [class*="dialog"], [class*="modal"]').first();
    result.settingsModal.title = await dialog.locator("h1,h2,h3,[class*='title']").first().textContent().catch(() => null);

    // Extract tabs
    const dialogTabs = await dialog.locator('[role="tab"]').allTextContents().catch(() => [] as string[]);
    result.settingsModal.tabs = dialogTabs;

    // Extract field labels
    const labels = await dialog.locator("label, [class*='label'], [class*='field']").allTextContents().catch(() => [] as string[]);
    result.settingsModal.allFieldLabels = labels.map(l => l.trim()).filter(l => l).slice(0, 30);

    result.settingsModal.hasOk = await dialog.locator('button:has-text("OK"), button:has-text("Ok")').first().isVisible({ timeout: 300 }).catch(() => false);
    result.settingsModal.hasCancel = await dialog.locator('button:has-text("Cancel")').first().isVisible({ timeout: 300 }).catch(() => false);

    result.settingsModal.screenshotPath = await scrot(page, tool.key, "p3-settings-modal");
    result.settingsModal.note = `Settings opened via: ${result.settingsModal.openedVia}. Tabs: [${result.settingsModal.tabs.join(",")}]`;

    await page.keyboard.press("Escape").catch(() => null);
  } else {
    result.settingsModal.screenshotPath = await scrot(page, tool.key, "p3-no-settings-modal");
    result.settingsModal.note = "Settings modal did not open";
  }

  // ── Merge into audit.json ─────────────────────────────────────────────────

  const auditFile = path.join(OUT_ROOT, tool.key, "audit.json");
  if (fs.existsSync(auditFile)) {
    const existing = JSON.parse(fs.readFileSync(auditFile, "utf-8"));
    existing.pass3 = result;
    fs.writeFileSync(auditFile, JSON.stringify(existing, null, 2), "utf-8");
  }

  // Write standalone pass3.json
  const p3File = path.join(OUT_ROOT, tool.key, "pass3.json");
  fs.writeFileSync(p3File, JSON.stringify(result, null, 2), "utf-8");

  return result;
}

// ─── Test registration ────────────────────────────────────────────────────────

for (const tool of ICON_TOOLS) {
  test(`[PASS3][${tool.key}] icon picker, prompt, toolbar, context-menu, settings`, async ({ page }) => {
    test.setTimeout(240_000);
    await openChart(page);
    const result = await runPass3Icon(page, tool);
    console.log(`[PASS3][${tool.key}] picker.railClickSuccess=${result.picker.railClickSuccess}`);
    console.log(`[PASS3][${tool.key}] picker.panelFound=${result.picker.panelFound}`);
    console.log(`[PASS3][${tool.key}] picker.tabs=${result.picker.tabs.map(t => t.text).join(",")}`);
    console.log(`[PASS3][${tool.key}] picker.itemClickSuccess=${result.picker.itemClickSuccess}`);
    console.log(`[PASS3][${tool.key}] promptModal.appears=${result.promptModal.appearsAfterCanvasClick}`);
    console.log(`[PASS3][${tool.key}] placement.iconPlaced=${result.placement.iconPlaced}`);
    console.log(`[PASS3][${tool.key}] toolbar.found=${result.drawingToolbar.found}(${result.drawingToolbar.buttons.length}btn)`);
    console.log(`[PASS3][${tool.key}] contextMenu.items=${result.contextMenu.items.length}`);
    console.log(`[PASS3][${tool.key}] settings.opened=${result.settingsModal.opened}`);
  });
}
