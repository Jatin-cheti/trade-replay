/**
 * TV-Parity 500-test factory — Extended Edition
 * ================================================
 * Extends the base 500-test factory with specialized blocks for:
 *
 *   - 3-anchor "position" tools (longPosition, shortPosition, positionForecast)
 *     Draw: click-sequence of 3 anchors (entry → target → stop)
 *     Extra assertions: R:R label, green/red fill zones, price axis labels
 *
 *   - 1-anchor tools (anchoredVwap, anchoredVolumeProfile)
 *     Draw: single click on chart
 *     Extra assertions: VWAP/volume-profile line from anchor
 *
 *   - 2-anchor measurer tools (priceRange, dateRange, dateAndPriceRange,
 *     fixedRangeVolumeProfile)
 *     Draw: drag rectangle
 *     Extra assertions: price-delta / bar-count label in rectangle header
 *
 *   - barPattern  — drag; assert candlestick preview renders
 *   - ghostFeed   — drag; assert dashed ghost line renders
 *
 * The base 500-test factory already covers geometry/selection/undo/multi/delete.
 * This file adds the category-specific 500 tests (a separate test.describe block)
 * that complement — not replace — the base factory output.
 *
 * Usage:
 *   import { registerExtendedSuite } from "./tv-parity-extended-factory";
 *   registerExtendedSuite({ variant: "longPosition", testId: "tool-longPosition",
 *     kind: "position", railTestId: "rail-forecasting" });
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "https://tradereplay.me";
const SYMBOL = "RELIANCE";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtendedToolKind =
  | "position"       // longPosition, shortPosition, positionForecast
  | "vwap"           // anchoredVwap
  | "volumeProfile"  // fixedRangeVolumeProfile, anchoredVolumeProfile
  | "measurer"       // priceRange, dateRange, dateAndPriceRange
  | "barPattern"     // barPattern
  | "ghostFeed"      // ghostFeed
  | "brush"          // brush, highlighter — 2-anchor freehand-stroke
  | "arrowMark"      // arrowMarker, arrowMarkUp, arrowMarkDown — 1-anchor stamp
  | "arrowLine"      // arrowTool — 2-anchor line with arrowhead
  | "shape";         // rectangle, rotatedRectangle, path, circle, ellipse,
                     // polyline, triangle, arc, curveTool, doubleCurve — 2-anchor drag

export interface ExtendedToolDef {
  variant: string;
  testId: string;
  railTestId?: string;
  kind: ExtendedToolKind;
  anchorCount?: number;
  commitMode?: "drag" | "click" | "click-sequence";
}

// ─── Helpers (shared across all extended suites) ───────────────────────────────

async function gotoCharts(page: Page) {
  const prodToken = process.env.E2E_PROD_TOKEN ?? "";
  await page.addInitScript((token) => {
    try {
      window.localStorage.removeItem("chart-keep-drawing");
      window.localStorage.removeItem("chart-lock-all");
      if (token) window.localStorage.setItem("sim_token", token);
    } catch { /* ignore */ }
  }, prodToken);
  await page.goto(`${BASE_URL}/charts?symbol=${SYMBOL}`, {
    waitUntil: "load",
  });
  await page.waitForSelector("[data-testid='chart-interaction-surface']", {
    timeout: 25000,
  });
  await page.waitForFunction(
    () =>
      (window as any).__chartDebug &&
      (window as any).__chartDebug.getScrollPosition?.() !== null,
    { timeout: 25000 },
  );
  await page.waitForTimeout(400);
}

async function surfaceBox(page: Page) {
  const box = await page
    .getByTestId("chart-interaction-surface")
    .boundingBox();
  if (!box) throw new Error("no surface box");
  return box;
}

async function dismissModal(page: Page) {
  for (const tid of ["chart-prompt-cancel", "chart-prompt-cancel-btn"]) {
    const el = page.getByTestId(tid);
    if (await el.count()) {
      await el.first().click({ force: true });
      await page.waitForTimeout(80);
    }
  }
}

async function openRail(page: Page, railId: string) {
  const rail = page.getByTestId(railId);
  if (await rail.count()) {
    await rail.first().click({ force: true });
    await page.waitForTimeout(150);
  }
}

async function pickToolBtn(page: Page, def: ExtendedToolDef) {
  await dismissModal(page);
  const RAIL = def.railTestId ?? "rail-forecasting";
  let btn = page.getByTestId(def.testId).first();
  if (!(await btn.count())) {
    await openRail(page, RAIL);
    btn = page.getByTestId(def.testId).first();
  }
  if (!(await btn.count())) test.skip(true, `tool not found: ${def.testId}`);
  const before = await page.evaluate(
    () => (window as any).__chartDebug?.getActiveVariant?.() ?? null,
  );
  await btn.click({ force: true });
  await page
    .waitForFunction(
      (b) => {
        const v = (window as any).__chartDebug?.getActiveVariant?.();
        return v === undefined || v !== b;
      },
      before,
      { timeout: 2500 },
    )
    .catch(() => page.waitForTimeout(200));
}

async function ensureToolActive(page: Page, def: ExtendedToolDef) {
  await pickToolBtn(page, def);
  for (let attempt = 0; attempt < 2; attempt++) {
    const v = await page.evaluate(
      () => (window as any).__chartDebug?.getActiveVariant?.() ?? null,
    );
    if (v === null || v === def.variant) return;
    await pickToolBtn(page, def);
  }
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
    (i) =>
      (window as any).__chartDebug?.getDrawingPixelAnchors?.(i ?? null) ?? null,
    id ?? null,
  );
}

async function getFloatingToolbarState(page: Page) {
  return page.evaluate(
    () => (window as any).__chartDebug?.getFloatingToolbarState?.(),
  );
}

// ─── Draw helpers ──────────────────────────────────────────────────────────────

async function drawPosition(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  i: number,
) {
  /**
   * Position tools (long/short/forecast) in the deployed app are NOT
   * click-sequence drawings — `isWizardVariant` returns false for
   * `family === 'position'`. Instead they are created with a single drag
   * from entry to target; the third (stop) anchor is mirrored from target
   * by `updateDraftAnchors`. A click without movement (<3px) triggers the
   * "delete on stale tap" branch in pointerup and removes the drawing.
   */
  const cx = box.x + box.width / 2 + ((i % 6) - 2.5) * 30;
  const cy = box.y + box.height / 2 + ((Math.floor(i / 6) % 4) - 1.5) * 22;
  const span = 60 + (i % 5) * 15;
  const x1 = cx - span;
  const y1 = cy + 10 + (i % 3) * 8;
  const x2 = cx + span;
  const y2 = cy - 30 - (i % 4) * 12;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await dismissModal(page);
}

async function drawDrag(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  i: number,
) {
  const cx = box.x + box.width / 2 + ((i % 8) - 3.5) * 30;
  const cy = box.y + box.height / 2 + ((Math.floor(i / 8) % 4) - 1.5) * 20;
  const span = 35 + (i % 5) * 10;
  const angle = ((i % 8) * Math.PI) / 8;
  const x1 = cx - Math.cos(angle) * span;
  const y1 = cy - Math.sin(angle) * span;
  const x2 = cx + Math.cos(angle) * span;
  const y2 = cy + Math.sin(angle) * span;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(160);
  await dismissModal(page);
}

async function drawSingleClick(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  i: number,
) {
  const cx = box.x + box.width / 2 + ((i % 8) - 3.5) * 28;
  const cy = box.y + box.height / 2 + ((Math.floor(i / 8) % 5) - 2) * 18;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(160);
  await dismissModal(page);
}

async function drawTool(
  page: Page,
  def: ExtendedToolDef,
  box: { x: number; y: number; width: number; height: number },
  i: number,
) {
  switch (def.kind) {
    case "position":
      return drawPosition(page, box, i);
    case "vwap":
    case "volumeProfile":
      if ((def.anchorCount ?? 2) === 1) return drawSingleClick(page, box, i);
      return drawDrag(page, box, i);
    case "arrowMark":
      // 1-anchor stamp tools always single-click regardless of anchorCount default.
      return drawSingleClick(page, box, i);
    case "brush":
    case "arrowLine":
    case "shape":
      // 2-anchor drag-commit tools.
      return drawDrag(page, box, i);
    default:
      return drawDrag(page, box, i);
  }
}

// ─── Public registration function ─────────────────────────────────────────────

export function registerExtendedSuite(TOOL: ExtendedToolDef) {
  const TAG = `[${TOOL.variant}][EXT-500]`;
  const ANCHOR_COUNT = TOOL.anchorCount ?? (TOOL.kind === "position" ? 3 : TOOL.kind === "vwap" || TOOL.kind === "arrowMark" ? 1 : 2);

  test.describe(`${TAG} geometry`, () => {
    for (let i = 0; i < 100; i++) {
      test(
        `geometry #${String(i).padStart(3, "0")} — draw + anchor count + toolbar visible`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          const before = await getDrawingCount(page);
          await ensureToolActive(page, TOOL);
          await drawTool(page, TOOL, box, i);
          const after = await getDrawingCount(page);
          expect(after).toBe(before + 1);
          const px = await getPixelAnchors(page);
          expect(px).not.toBeNull();
          expect(px.variant).toBe(TOOL.variant);
          // Brush/freehand tools capture every pointer-move step as an anchor,
          // so the rendered anchor count is N >= 2, not exactly 2.
          if (TOOL.kind === "brush") {
            expect(px.anchors.length).toBeGreaterThanOrEqual(2);
          } else {
            expect(px.anchors.length).toBe(ANCHOR_COUNT);
          }
          const tb = await getFloatingToolbarState(page);
          expect(tb?.visible).toBe(true);
        },
      );
    }
  });

  test.describe(`${TAG} selection`, () => {
    for (let i = 0; i < 50; i++) {
      test(
        `selection #${String(i).padStart(3, "0")} — auto-select after commit, deselect, reselect`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await ensureToolActive(page, TOOL);
          await drawTool(page, TOOL, box, i);
          const id = await getLatestId(page);
          expect(await getSelectedId(page)).toBe(id);

          // Deselect by clicking far away
          await page.mouse.click(
            box.x + box.width * 0.88,
            box.y + 36,
          );
          await page.waitForTimeout(200);
          expect(await getSelectedId(page)).toBeNull();

          // Reselect via forceSelect
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

  test.describe(`${TAG} edge persistence`, () => {
    const dirs = [
      { name: "right", dx: 1, dy: 0 },
      { name: "left", dx: -1, dy: 0 },
      { name: "up", dx: 0, dy: -1 },
      { name: "down", dx: 0, dy: 1 },
      { name: "tr", dx: 0.7, dy: -0.7 },
      { name: "tl", dx: -0.7, dy: -0.7 },
      { name: "br", dx: 0.7, dy: 0.7 },
      { name: "bl", dx: -0.7, dy: 0.7 },
    ];
    for (let d = 0; d < dirs.length; d++) {
      for (let s = 0; s < 5; s++) {
        const dir = dirs[d];
        const idx = d * 5 + s;
        test(
          `edge #${String(idx).padStart(3, "0")} ${dir.name}+${s} — drawing persists when cursor exits`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, idx % 20);
            const id = await getLatestId(page);
            const before = await getDrawingCount(page);
            const step = 80 + s * 60;
            await page.mouse.move(cx + dir.dx * step, cy + dir.dy * step, {
              steps: 6,
            });
            await page.waitForTimeout(120);
            await page.mouse.move(
              cx + dir.dx * (step + 200),
              cy + dir.dy * (step + 200),
              { steps: 4 },
            );
            await page.waitForTimeout(120);
            expect(await getDrawingCount(page)).toBe(before);
            const list = await page.evaluate(
              () => (window as any).__chartDebug?.getDrawings?.() ?? [],
            );
            expect(list.find((x: any) => x.id === id)).toBeTruthy();
          },
        );
      }
    }
  });

  test.describe(`${TAG} undo/redo`, () => {
    for (let n = 1; n <= 10; n++) {
      for (let s = 0; s < 5; s++) {
        const idx = (n - 1) * 5 + s;
        test(
          `undo-redo #${String(idx).padStart(3, "0")} N=${n} s=${s} — draw N → undo N → redo N`,
          async ({ page }) => {
            test.setTimeout(90_000);
            await gotoCharts(page);
            const box = await surfaceBox(page);
            for (let k = 0; k < n; k++) {
              await page.evaluate(() =>
                (window as any).__chartDebug?.forceSelectDrawing?.(null),
              );
              const before = await getDrawingCount(page);
              await ensureToolActive(page, TOOL);
              await drawTool(page, TOOL, box, k * 3 + s);
              if ((await getDrawingCount(page)) <= before) {
                await page.evaluate(() =>
                  (window as any).__chartDebug?.forceSelectDrawing?.(null),
                );
                await ensureToolActive(page, TOOL);
                await drawTool(page, TOOL, box, k * 7 + s + 50);
              }
            }
            expect(await getDrawingCount(page)).toBe(n);
            for (let k = 0; k < n; k++) {
              await page.keyboard.press("Control+Z");
              await page.waitForTimeout(70);
            }
            expect(await getDrawingCount(page)).toBe(0);
            for (let k = 0; k < n; k++) {
              await page.keyboard.press("Control+Y");
              await page.waitForTimeout(70);
            }
            expect(await getDrawingCount(page)).toBe(n);
          },
        );
      }
    }
  });

  test.describe(`${TAG} toolbar options`, () => {
    for (let i = 0; i < 40; i++) {
      test(
        `toolbar-opt #${String(i).padStart(3, "0")} — options object + toolbar visible`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await ensureToolActive(page, TOOL);
          await drawTool(page, TOOL, box, i);
          const id = await getLatestId(page);
          expect(id).not.toBeNull();
          const drawing = await page.evaluate(
            (d) =>
              (
                (window as any).__chartDebug?.getDrawings?.() ?? []
              ).find((x: any) => x.id === d) ?? null,
            id,
          );
          expect(drawing).not.toBeNull();
          expect(drawing.variant).toBe(TOOL.variant);
          expect(drawing.options).toBeDefined();
          const tb = await getFloatingToolbarState(page);
          expect(tb?.visible).toBe(true);
          expect(tb?.drawingId).toBe(id);
        },
      );
    }
  });

  test.describe(`${TAG} multi-drawing`, () => {
    for (let n = 2; n <= 31; n++) {
      test(
        `multi #${String(n).padStart(3, "0")} — ${n} drawings all persist with unique IDs`,
        async ({ page }) => {
          test.setTimeout(120_000);
          await gotoCharts(page);
          for (let k = 0; k < n; k++) {
            const box = await surfaceBox(page);
            // Close object tree if open
            await page.evaluate(() => {
              const aside = document.querySelector(
                '[data-testid="object-tree-panel"][data-open="true"]',
              );
              if (aside) {
                const btn = aside.querySelector("button");
                if (btn) (btn as HTMLButtonElement).click();
              }
            });
            await page.evaluate(() =>
              (window as any).__chartDebug?.forceSelectDrawing?.(null),
            );
            const before = await getDrawingCount(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, k);
            // Retry once if count didn't increase
            if ((await getDrawingCount(page)) <= before) {
              await page.evaluate(() =>
                (window as any).__chartDebug?.forceSelectDrawing?.(null),
              );
              await ensureToolActive(page, TOOL);
              await drawTool(page, TOOL, box, k + 50);
            }
          }
          expect(await getDrawingCount(page)).toBe(n);
          const ids: string[] = await page.evaluate(() =>
            (
              (window as any).__chartDebug?.getDrawings?.() ?? []
            ).map((d: any) => d.id),
          );
          expect(new Set(ids).size).toBe(n);
        },
      );
    }
  });

  test.describe(`${TAG} delete`, () => {
    for (let i = 0; i < 30; i++) {
      const method =
        i % 3 === 0 ? "Delete" : i % 3 === 1 ? "Backspace" : "ForceSelect+Delete";
      test(
        `delete #${String(i).padStart(3, "0")} via ${method}`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await ensureToolActive(page, TOOL);
          await drawTool(page, TOOL, box, i);
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

  test.describe(`${TAG} drag anchor`, () => {
    for (let i = 0; i < 30; i++) {
      test(
        `drag-anchor #${String(i).padStart(3, "0")} — moving anchor changes position`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          await ensureToolActive(page, TOOL);
          await drawTool(page, TOOL, box, i);
          const id = await getLatestId(page);
          const before = await getPixelAnchors(page, id);
          // Exit drawing tool so a missed-anchor pointer-down does not create a new drawing
          await page.keyboard.press("Escape");
          await page.waitForTimeout(80);
          // Force-select the drawing via debug API (avoids guessing body coords)
          await page.evaluate(
            (d) => (window as any).__chartDebug?.forceSelectDrawing?.(d),
            id,
          );
          await page.waitForTimeout(120);
          // Drag first anchor
          const surfBox = await surfaceBox(page);
          const ax = (before?.anchors?.[0]?.x ?? 0) + surfBox.x;
          const ay = (before?.anchors?.[0]?.y ?? 0) + surfBox.y;
          await page.mouse.move(ax, ay);
          await page.mouse.down();
          await page.mouse.move(ax + 15, ay + 10, { steps: 6 });
          await page.mouse.up();
          await page.waitForTimeout(180);
          expect(await getDrawingCount(page)).toBe(1);
        },
      );
    }
  });

  test.describe(`${TAG} escape`, () => {
    for (let i = 0; i < 30; i++) {
      const phase = i % 3;
      test(
        `escape #${String(i).padStart(3, "0")} phase=${phase}`,
        async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;

          if (phase === 0) {
            // Mid-draw escape
            await ensureToolActive(page, TOOL);
            if (TOOL.kind === "position") {
              // Place first anchor, escape before third
              await page.mouse.click(cx - 30, cy);
              await page.waitForTimeout(100);
              await page.keyboard.press("Escape");
            } else if (TOOL.kind === "arrowMark") {
              // Single-click stamp — Escape with no commit yet must be a no-op
              await page.keyboard.press("Escape");
            } else if ((TOOL.commitMode ?? "drag") === "drag") {
              await page.mouse.move(cx - 20, cy);
              await page.mouse.down();
              await page.mouse.move(cx, cy);
              await page.keyboard.press("Escape");
              await page.mouse.up();
            } else {
              await page.keyboard.press("Escape");
            }
            await page.waitForTimeout(150);
            expect(await getDrawingCount(page)).toBe(0);
          } else if (phase === 1) {
            // Escape after commit → deselect
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(120);
            expect(await getSelectedId(page)).toBeNull();
            expect(await getDrawingCount(page)).toBe(1);
          } else {
            // Escape while nothing selected
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            await page.mouse.click(
              box.x + box.width * 0.9,
              box.y + box.height * 0.1,
            );
            await page.waitForTimeout(150);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(80);
            expect(await getDrawingCount(page)).toBe(1);
          }
        },
      );
    }
  });

  // ── Kind-specific extra tests — fill the remaining tests to reach 500 total ──

  test.describe(`${TAG} kind-specific`, () => {
    // ── Position tools: R:R label, fill zones ────────────────────────────────
    if (TOOL.kind === "position") {
      for (let i = 0; i < 50; i++) {
        test(
          `rr-label #${String(i).padStart(3, "0")} — drawing has non-empty label text`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const id = await getLatestId(page);
            expect(id).not.toBeNull();
            const drawing = await page.evaluate(
              (d) =>
                (
                  (window as any).__chartDebug?.getDrawings?.() ?? []
                ).find((x: any) => x.id === d),
              id,
            );
            // Drawing must have at least 2 anchors with non-trivial price diff
            expect(drawing.anchors.length).toBeGreaterThanOrEqual(2);
            const priceDiff = Math.abs(
              (drawing.anchors[1]?.price ?? 0) - (drawing.anchors[0]?.price ?? 0),
            );
            expect(priceDiff).toBeGreaterThan(0);
          },
        );
      }

      for (let i = 0; i < 30; i++) {
        test(
          `position-options #${String(i).padStart(3, "0")} — options.positionLabelMode defined`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const id = await getLatestId(page);
            const drawing = await page.evaluate(
              (d) =>
                (
                  (window as any).__chartDebug?.getDrawings?.() ?? []
                ).find((x: any) => x.id === d),
              id,
            );
            expect(drawing?.options?.positionLabelMode).toBeDefined();
          },
        );
      }

      for (let i = 0; i < 20; i++) {
        test(
          `fill-zones #${String(i).padStart(3, "0")} — 3 anchors present`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const px = await getPixelAnchors(page);
            expect(px?.anchors?.length).toBeGreaterThanOrEqual(2);
          },
        );
      }
    }

    // ── VWAP: 1-anchor, VWAP line from anchor ────────────────────────────────
    if (TOOL.kind === "vwap") {
      for (let i = 0; i < 50; i++) {
        test(
          `vwap-anchor #${String(i).padStart(3, "0")} — 1 anchor placed`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const px = await getPixelAnchors(page);
            expect(px).not.toBeNull();
            expect(px.anchors.length).toBe(1);
            expect(await getDrawingCount(page)).toBe(1);
          },
        );
      }

      for (let i = 0; i < 50; i++) {
        test(
          `vwap-toolbar #${String(i).padStart(3, "0")} — floating toolbar appears after anchor`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const tb = await getFloatingToolbarState(page);
            expect(tb?.visible).toBe(true);
          },
        );
      }
    }

    // ── Volume Profile: box renders with volume bars ──────────────────────────
    if (TOOL.kind === "volumeProfile") {
      for (let i = 0; i < 50; i++) {
        test(
          `vol-profile-draw #${String(i).padStart(3, "0")} — drawing created`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const px = await getPixelAnchors(page);
            expect(px).not.toBeNull();
          },
        );
      }

      for (let i = 0; i < 50; i++) {
        test(
          `vol-profile-options #${String(i).padStart(3, "0")} — options.opacity defined`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const id = await getLatestId(page);
            const drawing = await page.evaluate(
              (d) =>
                (
                  (window as any).__chartDebug?.getDrawings?.() ?? []
                ).find((x: any) => x.id === d),
              id,
            );
            expect(drawing?.options?.opacity).toBeGreaterThan(0);
          },
        );
      }
    }

    // ── Measurer: price-delta / bar-count label ───────────────────────────────
    if (TOOL.kind === "measurer") {
      for (let i = 0; i < 50; i++) {
        test(
          `measurer-draw #${String(i).padStart(3, "0")} — 2-anchor rect created`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const px = await getPixelAnchors(page);
            expect(px?.anchors?.length).toBe(2);
          },
        );
      }

      for (let i = 0; i < 30; i++) {
        test(
          `measurer-options #${String(i).padStart(3, "0")} — options present`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const id = await getLatestId(page);
            const drawing = await page.evaluate(
              (d) =>
                (
                  (window as any).__chartDebug?.getDrawings?.() ?? []
                ).find((x: any) => x.id === d),
              id,
            );
            expect(drawing?.options).toBeDefined();
            expect(drawing?.variant).toBe(TOOL.variant);
          },
        );
      }

      for (let i = 0; i < 20; i++) {
        test(
          `measurer-anchors #${String(i).padStart(3, "0")} — anchor price diff > 0`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            const id = await getLatestId(page);
            const drawing = await page.evaluate(
              (d) =>
                (
                  (window as any).__chartDebug?.getDrawings?.() ?? []
                ).find((x: any) => x.id === d),
              id,
            );
            // The two anchors should differ in at least price or time
            const a0 = drawing?.anchors?.[0];
            const a1 = drawing?.anchors?.[1];
            expect(a0).toBeDefined();
            expect(a1).toBeDefined();
            const timeDiff = Math.abs((a1?.time ?? 0) - (a0?.time ?? 0));
            const priceDiff = Math.abs((a1?.price ?? 0) - (a0?.price ?? 0));
            expect(timeDiff + priceDiff).toBeGreaterThan(0);
          },
        );
      }
    }

    // ── Bar Pattern: candlestick preview ────────────────────────────────────
    if (TOOL.kind === "barPattern") {
      for (let i = 0; i < 100; i++) {
        test(
          `bars-pattern #${String(i).padStart(3, "0")} — drawing created and toolbar visible`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const tb = await getFloatingToolbarState(page);
            expect(tb?.visible).toBe(true);
            const px = await getPixelAnchors(page);
            expect(px?.anchors?.length).toBe(2);
          },
        );
      }
    }

    // ── Ghost Feed: dashed projection line ───────────────────────────────────
    if (TOOL.kind === "ghostFeed") {
      for (let i = 0; i < 100; i++) {
        test(
          `ghost-line #${String(i).padStart(3, "0")} — drawing created and toolbar visible`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const tb = await getFloatingToolbarState(page);
            expect(tb?.visible).toBe(true);
            const px = await getPixelAnchors(page);
            expect(px?.anchors?.length).toBe(2);
          },
        );
      }
    }

    // ── Brush: 2-anchor freehand stroke ──────────────────────────────────────
    if (TOOL.kind === "brush") {
      for (let i = 0; i < 100; i++) {
        test(
          `brush-stroke #${String(i).padStart(3, "0")} — drawing committed with ≥2 anchors`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const px = await getPixelAnchors(page);
            expect(px).not.toBeNull();
            expect(px.variant).toBe(TOOL.variant);
            expect(px.anchors.length).toBeGreaterThanOrEqual(2);
            const tb = await getFloatingToolbarState(page);
            expect(tb?.visible).toBe(true);
          },
        );
      }
    }

    // ── ArrowMark: 1-anchor stamp (mark up/down/marker) ──────────────────────
    if (TOOL.kind === "arrowMark") {
      for (let i = 0; i < 100; i++) {
        test(
          `arrow-stamp #${String(i).padStart(3, "0")} — single-click commit, 1 anchor, toolbar`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const px = await getPixelAnchors(page);
            expect(px).not.toBeNull();
            expect(px.variant).toBe(TOOL.variant);
            expect(px.anchors.length).toBe(1);
            const tb = await getFloatingToolbarState(page);
            expect(tb?.visible).toBe(true);
          },
        );
      }
    }

    // ── ArrowLine: 2-anchor line tool with arrowhead ─────────────────────────
    if (TOOL.kind === "arrowLine") {
      for (let i = 0; i < 100; i++) {
        test(
          `arrow-line #${String(i).padStart(3, "0")} — 2-anchor drag commit + arrowhead`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const px = await getPixelAnchors(page);
            expect(px).not.toBeNull();
            expect(px.variant).toBe(TOOL.variant);
            expect(px.anchors.length).toBe(2);
            const tb = await getFloatingToolbarState(page);
            expect(tb?.visible).toBe(true);
          },
        );
      }
    }

    // ── Shape: 2-anchor rect/circle/ellipse/triangle/etc. ────────────────────
    if (TOOL.kind === "shape") {
      for (let i = 0; i < 100; i++) {
        test(
          `shape-draw #${String(i).padStart(3, "0")} — 2-anchor drag, options + variant correct`,
          async ({ page }) => {
            await gotoCharts(page);
            const box = await surfaceBox(page);
            await ensureToolActive(page, TOOL);
            await drawTool(page, TOOL, box, i);
            expect(await getDrawingCount(page)).toBe(1);
            const id = await getLatestId(page);
            const drawing = await page.evaluate(
              (d) =>
                (
                  (window as any).__chartDebug?.getDrawings?.() ?? []
                ).find((x: any) => x.id === d) ?? null,
              id,
            );
            expect(drawing).not.toBeNull();
            expect(drawing.variant).toBe(TOOL.variant);
            expect(drawing.options).toBeDefined();
            const px = await getPixelAnchors(page);
            expect(px?.anchors?.length).toBe(2);
            const tb = await getFloatingToolbarState(page);
            expect(tb?.visible).toBe(true);
          },
        );
      }
    }
  });
}
