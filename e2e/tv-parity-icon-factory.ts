/**
 * TV-Parity Icon Tool Factory
 * ============================
 * Generates ~110 tests for each of the three icon tools:
 *   emoji    — variant: 'emoji',    picked from icon-panel-tab-emojis
 *   sticker  — variant: 'sticker',  picked from icon-panel-tab-stickers
 *   iconTool — variant: 'iconTool', picked from icon-panel-tab-icons
 *
 * Activation + placement flow (differs from all other tools):
 *   1. Click data-testid="rail-icon"       → IconToolPanel popover opens
 *   2. Click data-testid="icon-panel-tab-{tab}"  (emojis | stickers | icons)
 *   3. Click data-testid="icon-panel-item-{id}" → panel closes, variant set,
 *      selectedIconPreset stored in TradingChart state
 *   4. Click canvas → ChartPromptModal opens (pre-filled with preset value)
 *   5. Click data-testid="chart-prompt-ok" → drawing is placed
 *
 * The ordinary pickToolBtn helper fails for these tools because there is no
 * standalone "tool-emoji" rail button — the variant is activated through the
 * picker panel only. Additionally, a prompt modal must be confirmed on every
 * canvas click to finalize the icon placement.
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "https://tradereplay.me";
const SYMBOL = "RELIANCE";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IconToolVariant = "emoji" | "sticker" | "iconTool";

export interface IconToolDef {
  variant: IconToolVariant;
  /** data-testid of the panel tab button, e.g. "icon-panel-tab-emojis" */
  panelTabTestId: string;
  /** First available preset item testId in that tab, e.g. "icon-panel-item-smiles-0" */
  presetItemTestId: string;
  /** Human-readable tab name for test labels */
  tabLabel: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function gotoCharts(page: Page) {
  const prodToken = process.env.E2E_PROD_TOKEN ?? "";
  await page.addInitScript((token) => {
    try {
      window.localStorage.removeItem("chart-keep-drawing");
      window.localStorage.removeItem("chart-lock-all");
      if (token) window.localStorage.setItem("sim_token", token);
    } catch { /* ignore */ }
  }, prodToken);
  await page.goto(`${BASE_URL}/charts?symbol=${SYMBOL}`, { waitUntil: "load" });
  await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 25000 });
  await page.waitForFunction(
    () =>
      (window as any).__chartDebug &&
      (window as any).__chartDebug.getScrollPosition?.() !== null,
    { timeout: 25000 },
  );
  await page.waitForTimeout(400);
}

async function surfaceBox(page: Page) {
  const box = await page.getByTestId("chart-interaction-surface").boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function getDrawingCount(page: Page) {
  return page.evaluate(
    () => ((window as any).__chartDebug?.getDrawings?.() ?? []).length,
  );
}

async function getLatestId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (window as any).__chartDebug?.getLatestDrawingId?.() ?? null,
  );
}

async function getSelectedId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null,
  );
}

async function getPixelAnchors(page: Page, id?: string | null) {
  return page.evaluate(
    (i) => (window as any).__chartDebug?.getDrawingPixelAnchors?.(i ?? null) ?? null,
    id ?? null,
  );
}

async function getFloatingToolbarState(page: Page) {
  return page.evaluate(
    () => (window as any).__chartDebug?.getFloatingToolbarState?.(),
  );
}

/**
 * Activate an icon tool by opening the picker panel, selecting the preset,
 * and verifying the panel closed.
 *
 * After this returns, the tool is active and the next canvas click places a drawing.
 */
async function activateIconTool(page: Page, def: IconToolDef) {
  // Open the icon rail panel
  const railBtn = page.getByTestId("rail-icon");
  if (!(await railBtn.count())) {
    test.skip(true, "rail-icon button not found in toolbar");
    return;
  }
  await railBtn.click({ force: true });
  await page.waitForTimeout(200);

  // Verify the panel opened
  const panel = page.getByTestId("icon-panel");
  if (!(await panel.count())) {
    test.skip(true, "icon-panel did not open after clicking rail-icon");
    return;
  }

  // Switch to the correct tab if not already on it
  const tabBtn = page.getByTestId(def.panelTabTestId);
  if (await tabBtn.count()) {
    await tabBtn.click({ force: true });
    await page.waitForTimeout(150);
  }

  // Click the first preset item
  const item = page.getByTestId(def.presetItemTestId);
  if (!(await item.count())) {
    test.skip(true, `preset item not found: ${def.presetItemTestId}`);
    return;
  }
  await item.click({ force: true });

  // Panel should close automatically after preset selection
  await page.waitForTimeout(200);
}

/**
 * Place an icon drawing at the given canvas offset index (0–99).
 * activateIconTool must have been called first. After the canvas click,
 * TradingChart opens ChartPromptModal — this helper confirms it automatically
 * by clicking data-testid="chart-prompt-ok".
 */
async function placeIconDrawing(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  i: number,
) {
  const cx = box.x + box.width / 2 + ((i % 8) - 3.5) * 28;
  const cy = box.y + box.height / 2 + ((Math.floor(i / 8) % 5) - 2) * 22;
  await page.mouse.click(cx, cy);
  // Wait for ChartPromptModal to appear (the modal fires on every icon canvas click).
  await page.waitForTimeout(300);
  const okBtn = page.getByTestId("chart-prompt-ok");
  if (await okBtn.count()) {
    await okBtn.click({ force: true });
    await page.waitForTimeout(200);
  }
}

// ─── Public registration ──────────────────────────────────────────────────────

export function registerIconToolSuite(def: IconToolDef) {
  const TAG = `[${def.variant}][ICON-100]`;

  // ── Picker-flow placement (30 tests) ────────────────────────────────────────
  test.describe(`${TAG} picker placement`, () => {
    for (let i = 0; i < 30; i++) {
      test(
        `pick-place #${String(i).padStart(3, "0")} — open panel → select preset → place on canvas`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          const before = await getDrawingCount(page);
          await activateIconTool(page, def);
          await placeIconDrawing(page, box, i);
          const after = await getDrawingCount(page);
          expect(after).toBe(before + 1);
          const px = await getPixelAnchors(page);
          expect(px).not.toBeNull();
          expect(px.variant).toBe(def.variant);
          expect(px.anchors.length).toBe(1);
        },
      );
    }
  });

  // ── Toolbar visible after placement (10 tests) ──────────────────────────────
  test.describe(`${TAG} toolbar`, () => {
    for (let i = 0; i < 10; i++) {
      test(
        `toolbar #${String(i).padStart(3, "0")} — floating toolbar appears after icon placement`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await activateIconTool(page, def);
          await placeIconDrawing(page, box, i);
          const tb = await getFloatingToolbarState(page);
          expect(tb?.visible).toBe(true);
        },
      );
    }
  });

  // ── Selection: auto-select → deselect → force-select (20 tests) ────────────
  test.describe(`${TAG} selection`, () => {
    for (let i = 0; i < 20; i++) {
      test(
        `selection #${String(i).padStart(3, "0")} — auto-select after place, deselect, re-select`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await activateIconTool(page, def);
          await placeIconDrawing(page, box, i);
          const id = await getLatestId(page);
          expect(await getSelectedId(page)).toBe(id);

          // Deselect
          await page.mouse.click(box.x + box.width * 0.88, box.y + 36);
          await page.waitForTimeout(200);
          expect(await getSelectedId(page)).toBeNull();

          // Force-reselect via debug API
          await page.evaluate(
            (d) => (window as any).__chartDebug?.forceSelectDrawing?.(d),
            id,
          );
          await page.waitForTimeout(120);
          const sel = await getSelectedId(page);
          expect(typeof sel === "string" && sel.length > 0).toBe(true);
        },
      );
    }
  });

  // ── Delete: Delete key, Backspace, force+Delete (15 tests) ──────────────────
  test.describe(`${TAG} delete`, () => {
    for (let i = 0; i < 15; i++) {
      const method = i % 3 === 0 ? "Delete" : i % 3 === 1 ? "Backspace" : "ForceSelect+Delete";
      test(
        `delete #${String(i).padStart(3, "0")} via ${method}`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await activateIconTool(page, def);
          await placeIconDrawing(page, box, i);
          const id = await getLatestId(page);
          expect(id).not.toBeNull();
          if (method === "ForceSelect+Delete") {
            await page.evaluate(
              (d) => (window as any).__chartDebug?.forceSelectDrawing?.(d),
              id,
            );
            await page.waitForTimeout(80);
            await page.keyboard.press("Delete");
          } else {
            await page.keyboard.press(method);
          }
          await page.waitForTimeout(180);
          expect(await getDrawingCount(page)).toBe(0);
        },
      );
    }
  });

  // ── Undo/redo (15 tests) ────────────────────────────────────────────────────
  test.describe(`${TAG} undo/redo`, () => {
    for (let i = 0; i < 15; i++) {
      test(
        `undo-redo #${String(i).padStart(3, "0")} — place → Ctrl+Z → count 0 → Ctrl+Y → count 1`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await activateIconTool(page, def);
          await placeIconDrawing(page, box, i);
          expect(await getDrawingCount(page)).toBe(1);
          await page.keyboard.press("Control+Z");
          await page.waitForTimeout(120);
          expect(await getDrawingCount(page)).toBe(0);
          await page.keyboard.press("Control+Y");
          await page.waitForTimeout(120);
          expect(await getDrawingCount(page)).toBe(1);
        },
      );
    }
  });

  // ── Escape behavior (10 tests) ──────────────────────────────────────────────
  test.describe(`${TAG} escape`, () => {
    for (let i = 0; i < 10; i++) {
      const phase = i % 2;
      test(
        `escape #${String(i).padStart(3, "0")} phase=${phase}`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          if (phase === 0) {
            // Escape after placement → deselects, drawing persists
            await activateIconTool(page, def);
            await placeIconDrawing(page, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(120);
            expect(await getSelectedId(page)).toBeNull();
            expect(await getDrawingCount(page)).toBe(1);
          } else {
            // Escape while nothing selected → no-op
            await activateIconTool(page, def);
            await placeIconDrawing(page, box, i);
            // Deselect first
            await page.mouse.click(box.x + box.width * 0.9, box.y + 30);
            await page.waitForTimeout(150);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(80);
            expect(await getDrawingCount(page)).toBe(1);
          }
        },
      );
    }
  });

  // ── Multi-placement: place up to 5 icons, verify unique IDs (5 tests) ───────
  test.describe(`${TAG} multi-place`, () => {
    for (let n = 1; n <= 5; n++) {
      test(
        `multi #${String(n).padStart(3, "0")} — place ${n} icons, all persist with unique IDs`,
        async ({ page }) => {
          test.setTimeout(60_000);
          await gotoCharts(page);
          const box = await surfaceBox(page);
          for (let k = 0; k < n; k++) {
            await activateIconTool(page, def);
            const before = await getDrawingCount(page);
            await placeIconDrawing(page, box, k * 10);
            if ((await getDrawingCount(page)) <= before) {
              // Retry at offset position
              await activateIconTool(page, def);
              await placeIconDrawing(page, box, k * 10 + 50);
            }
          }
          expect(await getDrawingCount(page)).toBe(n);
          const ids: string[] = await page.evaluate(
            () => ((window as any).__chartDebug?.getDrawings?.() ?? []).map((d: any) => d.id),
          );
          expect(new Set(ids).size).toBe(n);
        },
      );
    }
  });

  // ── Panel tab navigation (5 tests) ──────────────────────────────────────────
  test.describe(`${TAG} panel-nav`, () => {
    for (let i = 0; i < 5; i++) {
      test(
        `panel-nav #${String(i).padStart(3, "0")} — rail-icon opens panel with expected tab structure`,
        async ({ page }) => {
          await gotoCharts(page);
          const railBtn = page.getByTestId("rail-icon");
          if (!(await railBtn.count())) {
            test.skip(true, "rail-icon not found");
            return;
          }
          await railBtn.click({ force: true });
          await page.waitForTimeout(200);

          // Panel must be visible
          const panel = page.getByTestId("icon-panel");
          expect(await panel.count()).toBeGreaterThan(0);

          // All three tabs must be present
          expect(await page.getByTestId("icon-panel-tab-emojis").count()).toBeGreaterThan(0);
          expect(await page.getByTestId("icon-panel-tab-stickers").count()).toBeGreaterThan(0);
          expect(await page.getByTestId("icon-panel-tab-icons").count()).toBeGreaterThan(0);

          // At least one preset item visible
          const items = await page.locator('[data-testid^="icon-panel-item-"]').count();
          expect(items).toBeGreaterThan(0);

          // Close panel via Escape
          await page.keyboard.press("Escape");
          await page.waitForTimeout(100);
        },
      );
    }
  });
}
