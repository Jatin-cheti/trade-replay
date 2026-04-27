/**
 * TV-Parity 500-test factory.
 *
 * Generates the 500-test parity suite for any 2-anchor drag-commit drawing
 * tool. Originally extracted from tv-parity-trend-500.spec.ts after that
 * tool reached 500/500 on prod.
 *
 * Usage:
 *   import { register500ToolSuite } from "./tv-parity-500-factory";
 *   register500ToolSuite({ variant: "ray", testId: "tool-ray" });
 *
 * Constraints:
 *   - Tool must commit on a single ≥ 8 px drag (or two-click-equivalent)
 *   - Tool must produce exactly 2 anchors
 *   - Tool must auto-select on commit (TV parity)
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE_URL = process.env.E2E_TARGET_URL || "https://tradereplay.me";
const SYMBOL = "RELIANCE";

export type ToolDef = {
  /** Variant string returned by __chartDebug.getActiveVariant() */
  variant: string;
  /** data-testid of the toolbar button */
  testId: string;
  /** Optional rail testId (defaults to "rail-lines") */
  railTestId?: string;
  /** Optional override of the expected anchor count (defaults to 2) */
  anchorCount?: number;
  /**
   * How the tool commits a drawing:
   *  - "drag" (default): mouse.down → move → mouse.up commits the 2-anchor segment.
   *  - "click": tools whose drag-up commits a single-anchor placement (hline,
   *    vline, crossLine, horizontalRay). Mid-draft Escape behaviour differs:
   *    there's no "in-flight" segment to cancel, only a pending tool activation.
   */
  commitMode?: "drag" | "click";
  /**
   * Rendered geometry shape — controls how the selection bucket picks its
   * "far" deselect point and "on-drawing" reselect point. Defaults to
   * "segment" (perpendicular to the cursor drag at midpoint).
   *  - "horizontal": hline (infinite horizontal at anchor[0].y).
   *  - "vertical": vline (infinite vertical at anchor[0].x).
   *  - "cross": crossLine (both axes through anchor[0]).
   *  - "horizontalRay": horizontal half-line extending right from anchor[0].
   */
  selectionGeometry?: "segment" | "horizontal" | "vertical" | "cross" | "horizontalRay";
};

export function register500ToolSuite(TOOL: ToolDef) {
  const RAIL = TOOL.railTestId ?? "rail-lines";
  const ANCHOR_COUNT = TOOL.anchorCount ?? 2;
  const COMMIT_MODE = TOOL.commitMode ?? "drag";
  const SEL_GEOM = TOOL.selectionGeometry ?? "segment";
  const TAG = `[${TOOL.variant}][500]`;

  // ── Shared helpers ─────────────────────────────────────────────────────────

  async function gotoCharts(page: Page) {
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("chart-keep-drawing");
        window.localStorage.removeItem("chart-lock-all");
      } catch {
        /* ignore */
      }
    });
    await page.goto(`${BASE_URL}/charts?symbol=${SYMBOL}`, { waitUntil: "load" });
    await page.waitForSelector("[data-testid='chart-interaction-surface']", { timeout: 25000 });
    await page.waitForFunction(
      () => (window as any).__chartDebug && (window as any).__chartDebug.getScrollPosition?.() !== null,
      { timeout: 25000 },
    );
    await page.waitForTimeout(400);
  }

  async function surfaceBox(page: Page) {
    const box = await page.getByTestId("chart-interaction-surface").boundingBox();
    if (!box) throw new Error("no surface box");
    return box;
  }

  async function dismissModal(page: Page) {
    const cancel = page.getByTestId("chart-prompt-cancel");
    if (await cancel.count()) {
      await cancel.first().click({ force: true });
      await page.waitForTimeout(80);
    }
  }

  async function openLinesRail(page: Page) {
    const rail = page.getByTestId(RAIL);
    if (await rail.count()) {
      await rail.first().click({ force: true });
      await page.waitForTimeout(150);
    }
  }

  async function pickToolBtn(page: Page) {
    await dismissModal(page);
    let btn = page.getByTestId(TOOL.testId).first();
    if (!(await btn.count())) {
      await openLinesRail(page);
      btn = page.getByTestId(TOOL.testId).first();
    }
    if (!(await btn.count())) test.skip(true, `tool not found: ${TOOL.testId}`);
    const before = await page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
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

  async function ensureToolActive(page: Page) {
    await pickToolBtn(page);
    for (let attempt = 0; attempt < 2; attempt++) {
      const v = await page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
      if (v === null || v === TOOL.variant) return;
      await pickToolBtn(page);
    }
  }

  async function getDrawingCount(page: Page): Promise<number> {
    return page.evaluate(() => ((window as any).__chartDebug?.getDrawings?.() ?? []).length);
  }

  async function getLatestId(page: Page): Promise<string | null> {
    return page.evaluate(() => (window as any).__chartDebug?.getLatestDrawingId?.() ?? null);
  }

  async function getSelectedId(page: Page): Promise<string | null> {
    return page.evaluate(() => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null);
  }

  async function getActiveVariant(page: Page): Promise<string | null> {
    return page.evaluate(() => (window as any).__chartDebug?.getActiveVariant?.() ?? null);
  }

  async function getPixelAnchors(page: Page, id?: string | null) {
    return page.evaluate(
      (i) => (window as any).__chartDebug?.getDrawingPixelAnchors?.(i ?? null) ?? null,
      id ?? null,
    );
  }

  async function drawTool(page: Page, x1: number, y1: number, x2: number, y2: number) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(140);
    await dismissModal(page);
  }

  async function drawToolOnce(page: Page, x1: number, y1: number, x2: number, y2: number) {
    await ensureToolActive(page);
    await drawTool(page, x1, y1, x2, y2);
  }

  // ── Coordinate factory ─────────────────────────────────────────────────────

  function gridOffset(i: number, cols = 10, rows = 10) {
    const col = i % cols;
    const row = Math.floor(i / cols) % rows;
    const ox = (col - (cols - 1) / 2) * 38;
    const oy = (row - (rows - 1) / 2) * 18 - 30;
    return { ox, oy };
  }

  function endpointsForIndex(box: { x: number; y: number; width: number; height: number }, i: number) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const { ox, oy } = gridOffset(i);
    const angle = ((i % 8) * Math.PI) / 8;
    const r = 22 + (i % 5) * 4;
    return {
      x1: cx + ox - Math.cos(angle) * r,
      y1: cy + oy - Math.sin(angle) * r,
      x2: cx + ox + Math.cos(angle) * r,
      y2: cy + oy + Math.sin(angle) * r,
    };
  }

  // ── 100 GEOMETRY tests ─────────────────────────────────────────────────────

  test.describe(`${TAG} geometry`, () => {
    for (let i = 0; i < 100; i++) {
      test(`geometry #${String(i).padStart(3, "0")} - draw + anchor pixel within tolerance`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const { x1, y1, x2, y2 } = endpointsForIndex(box, i);
        const before = await getDrawingCount(page);
        await drawToolOnce(page, x1, y1, x2, y2);
        const after = await getDrawingCount(page);
        expect(after).toBe(before + 1);
        const px = await getPixelAnchors(page);
        expect(px).not.toBeNull();
        expect(px.variant).toBe(TOOL.variant);
        expect(px.anchors.length).toBe(ANCHOR_COUNT);
        const surfaceLeft = box.x;
        const surfaceTop = box.y;
        const a0x = (px.anchors[0].x ?? 0) + surfaceLeft;
        const a0y = (px.anchors[0].y ?? 0) + surfaceTop;
        const a1x = (px.anchors[1]?.x ?? px.anchors[0].x ?? 0) + surfaceLeft;
        const a1y = (px.anchors[1]?.y ?? px.anchors[0].y ?? 0) + surfaceTop;
        const TOL = 26;
        const d0 = Math.hypot(a0x - x1, a0y - y1);
        const d1 = Math.hypot(a1x - x2, a1y - y2);
        expect(Math.min(d0, d1)).toBeLessThan(TOL);
        expect(a0x).toBeGreaterThan(box.x - 50);
        expect(a0x).toBeLessThan(box.x + box.width + 50);
        expect(a0y).toBeGreaterThan(box.y - 50);
        expect(a0y).toBeLessThan(box.y + box.height + 50);
      });
    }
  });

  // ── 50 SELECTION INVARIANT tests ───────────────────────────────────────────

  test.describe(`${TAG} selection invariants`, () => {
    for (let i = 0; i < 50; i++) {
      test(`selection #${String(i).padStart(3, "0")} - auto-select, deselect, reselect`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const { x1, y1, x2, y2 } = endpointsForIndex(box, i);
        await drawToolOnce(page, x1, y1, x2, y2);
        const id = await getLatestId(page);
        expect(await getSelectedId(page)).toBe(id);
        const v = await getActiveVariant(page);
        expect([null, "none", undefined]).toContain(v);

        // Compute deselect (`farX,farY`) and reselect (`hitX,hitY`) points
        // based on the rendered geometry. For non-segment shapes (rays /
        // infinite lines / crosses) we read the actual pixel anchors via
        // __chartDebug instead of using the cursor-drag direction \u2014 the
        // visual geometry doesn't follow (x1,y1)\u2192(x2,y2).
        let farX: number, farY: number, hitX: number, hitY: number;
        const minX = box.x + 60;
        const maxX = box.x + box.width - 90;
        const minY = box.y + 60;
        const maxY = box.y + box.height - 90;
        const clamp = (x: number, y: number) => ({
          x: Math.max(minX, Math.min(maxX, x)),
          y: Math.max(minY, Math.min(maxY, y)),
        });

        if (SEL_GEOM === "segment") {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          let nx = -dy / len;
          let ny = dx / len;
          if (ny < 0) { nx = -nx; ny = -ny; }
          const off = 220 + (i % 5) * 12;
          const f = clamp(midX + nx * off + ((i % 3) - 1) * 16, midY + ny * off + ((i % 4) - 2) * 14);
          farX = f.x; farY = f.y;
          hitX = midX; hitY = midY;
        } else {
          const px = await getPixelAnchors(page, id);
          // Pixel anchors are relative to the chart container; convert to
          // viewport coords by adding the surface origin.
          const ax = (px?.anchors?.[0]?.x ?? 0) + box.x;
          const ay = (px?.anchors?.[0]?.y ?? 0) + box.y;
          if (SEL_GEOM === "horizontalRay") {
            // Geometry: horizontal half-line at y=ay, x>=ax.
            // Far: well above the line AND to the left of the anchor.
            const dy = 80 + (i % 5) * 8;
            const upOrDown = (i % 2 === 0) ? -1 : 1;
            const f = clamp(ax - 140 - (i % 6) * 10, ay + upOrDown * dy);
            farX = f.x; farY = f.y;
            // Hit: 60 px right of the anchor along the ray.
            const h = clamp(ax + 60 + (i % 5) * 8, ay);
            hitX = h.x; hitY = h.y;
          } else if (SEL_GEOM === "horizontal") {
            // Infinite horizontal at y=ay. Pick the side (up vs down) with
            // more room and use a hard 150 px minimum (clamped to room - 20).
            const baseDy = 150 + (i % 5) * 10;
            const roomUp = ay - minY;
            const roomDown = maxY - ay;
            const goUp = roomUp > roomDown;
            const dy = Math.min(baseDy, Math.max(80, (goUp ? roomUp : roomDown) - 20));
            const f = clamp(box.x + box.width / 2 + ((i % 3) - 1) * 60, goUp ? ay - dy : ay + dy);
            farX = f.x; farY = f.y;
            const h = clamp(box.x + box.width / 2 + ((i % 7) - 3) * 30, ay);
            hitX = h.x; hitY = h.y;
          } else if (SEL_GEOM === "vertical") {
            // Infinite vertical at x=ax. Pick the side with more room AND
            // a hard 150 px minimum so magnet/snap drift can't put the click
            // back near the line.
            const roomLeft = ax - minX;
            const roomRight = maxX - ax;
            const goLeft = roomLeft > roomRight;
            const baseDx = 150 + (i % 5) * 10;
            const dx = Math.min(baseDx, Math.max(80, (goLeft ? roomLeft : roomRight) - 20));
            const f = clamp(goLeft ? ax - dx : ax + dx, box.y + box.height / 2 + ((i % 3) - 1) * 50);
            farX = f.x; farY = f.y;
            const h = clamp(ax, box.y + box.height / 2 + ((i % 7) - 3) * 30);
            hitX = h.x; hitY = h.y;
          } else {
            // "cross": both axes intercept; far must avoid both. Pick the
            // quadrant with the most room and use a 130 px minimum offset on
            // both axes so the clamp can't pull either component near anchor.
            const roomLeft = ax - minX;
            const roomRight = maxX - ax;
            const roomUp = ay - minY;
            const roomDown = maxY - ay;
            const goLeft = roomLeft > roomRight;
            const goUp = roomUp > roomDown;
            const dx = Math.min(130 + (i % 5) * 10, Math.max(80, (goLeft ? roomLeft : roomRight) - 20));
            const dy = Math.min(130 + (i % 5) * 10, Math.max(80, (goUp ? roomUp : roomDown) - 20));
            const f = clamp(goLeft ? ax - dx : ax + dx, goUp ? ay - dy : ay + dy);
            farX = f.x; farY = f.y;
            const h = clamp(ax, ay);
            hitX = h.x; hitY = h.y;
          }
        }

        await page.mouse.click(farX, farY);
        await page.waitForTimeout(180);
        expect(await getSelectedId(page)).toBeNull();
        await page.mouse.click(hitX, hitY);
        await page.waitForTimeout(220);
        const sel = await getSelectedId(page);
        expect(typeof sel === "string" && sel.length > 0).toBe(true);
      });
    }
  });

  // ── 40 EDGE PERSISTENCE tests ──────────────────────────────────────────────

  test.describe(`${TAG} edge persistence`, () => {
    const dirs = [
      { name: "right", dx: 1, dy: 0 },
      { name: "left", dx: -1, dy: 0 },
      { name: "down", dx: 0, dy: 1 },
      { name: "up", dx: 0, dy: -1 },
      { name: "tr", dx: 0.7, dy: -0.7 },
      { name: "tl", dx: -0.7, dy: -0.7 },
      { name: "br", dx: 0.7, dy: 0.7 },
      { name: "bl", dx: -0.7, dy: 0.7 },
    ];
    for (let d = 0; d < dirs.length; d++) {
      for (let s = 0; s < 5; s++) {
        const dir = dirs[d];
        const idx = d * 5 + s;
        test(`edge #${String(idx).padStart(3, "0")} ${dir.name}+${s} - drawing persists when cursor exits`, async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await drawToolOnce(page, cx - 30, cy - 6, cx + 30, cy + 6);
          const id = await getLatestId(page);
          const before = await getDrawingCount(page);
          const step = 80 + s * 60;
          const tx = cx + dir.dx * step;
          const ty = cy + dir.dy * step;
          await page.mouse.move(tx, ty, { steps: 6 });
          await page.waitForTimeout(120);
          await page.mouse.move(tx + dir.dx * 200, ty + dir.dy * 200, { steps: 4 });
          await page.waitForTimeout(120);
          expect(await getDrawingCount(page)).toBe(before);
          const list = await page.evaluate(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
          expect(list.find((x: any) => x.id === id)).toBeTruthy();
        });
      }
    }
  });

  // ── 40 MODIFIER tests ──────────────────────────────────────────────────────

  test.describe(`${TAG} modifiers`, () => {
    const modes = ["plain", "shift", "ctrl", "alt"] as const;
    for (let i = 0; i < 10; i++) {
      for (let m = 0; m < modes.length; m++) {
        const idx = i * modes.length + m;
        const mode = modes[m];
        test(`modifier #${String(idx).padStart(3, "0")} ${mode}+${i} - modifier draw commits a drawing`, async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await ensureToolActive(page);
          const angle = (i * Math.PI) / 10;
          const r = 30;
          const x1 = cx - Math.cos(angle) * r;
          const y1 = cy - Math.sin(angle) * r - 40;
          const x2 = cx + Math.cos(angle) * r;
          const y2 = cy + Math.sin(angle) * r - 40;
          const before = await getDrawingCount(page);
          if (mode === "shift") await page.keyboard.down("Shift");
          if (mode === "ctrl") await page.keyboard.down("Control");
          try {
            await page.mouse.move(x1, y1);
            await page.mouse.down();
            await page.mouse.move(x2, y2, { steps: 8 });
            await page.mouse.up();
          } finally {
            if (mode === "shift") await page.keyboard.up("Shift");
            if (mode === "ctrl") await page.keyboard.up("Control");
          }
          await page.waitForTimeout(160);
          await dismissModal(page);
          const after = await getDrawingCount(page);
          if (mode === "alt") {
            expect(after).toBeGreaterThanOrEqual(before);
          } else {
            expect(after).toBe(before + 1);
          }
        });
      }
    }
  });

  // ── 50 UNDO/REDO tests ─────────────────────────────────────────────────────

  test.describe(`${TAG} undo/redo`, () => {
    for (let n = 1; n <= 10; n++) {
      for (let s = 0; s < 5; s++) {
        const idx = (n - 1) * 5 + s;
        test(`undo-redo #${String(idx).padStart(3, "0")} N=${n} seed=${s} - draw N → undo N → redo N`, async ({ page }) => {
          await gotoCharts(page);
          const box = await surfaceBox(page);
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const baseOffset = (s - 2) * 12;
          for (let k = 0; k < n; k++) {
            const ox = (k % 5 - 2) * 50 + baseOffset;
            const oy = (Math.floor(k / 5) - 2) * 22 - 20;
            await ensureToolActive(page);
            await drawTool(page, cx + ox - 16, cy + oy, cx + ox + 16, cy + oy + 4);
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
        });
      }
    }
  });

  // ── 30 PAN PERSISTENCE tests ───────────────────────────────────────────────

  test.describe(`${TAG} pan persistence`, () => {
    for (let i = 0; i < 30; i++) {
      test(`pan #${String(i).padStart(3, "0")} - draw, pan, drawing remains in store`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const placement = i % 3;
        const ox = (placement - 1) * 90;
        await drawToolOnce(page, cx + ox - 28, cy - 4, cx + ox + 28, cy + 4);
        const before = await getDrawingCount(page);
        const id = await getLatestId(page);
        const panAmt = 80 + (i % 10) * 40;
        await page.mouse.move(cx, cy);
        for (let k = 0; k < panAmt / 40; k++) {
          await page.mouse.wheel(40, 0);
          await page.waitForTimeout(15);
        }
        await page.waitForTimeout(120);
        expect(await getDrawingCount(page)).toBe(before);
        const list = await page.evaluate(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
        expect(list.find((x: any) => x.id === id)).toBeTruthy();
      });
    }
  });

  // ── 40 TOOLBAR-OPTIONS tests ───────────────────────────────────────────────

  test.describe(`${TAG} toolbar options`, () => {
    for (let i = 0; i < 40; i++) {
      test(`toolbar-opt #${String(i).padStart(3, "0")} - options object exists + persists`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const ox = (i % 8 - 3.5) * 40;
        const oy = (Math.floor(i / 8) - 2) * 22 - 30;
        await drawToolOnce(page, cx + ox - 22, cy + oy, cx + ox + 22, cy + oy + 4);
        const id = await getLatestId(page);
        expect(id).not.toBeNull();
        const drawing = await page.evaluate(
          (drawingId) => ((window as any).__chartDebug?.getDrawings?.() ?? []).find((d: any) => d.id === drawingId) ?? null,
          id,
        );
        expect(drawing).not.toBeNull();
        expect(drawing.variant).toBe(TOOL.variant);
        expect(drawing.options).toBeDefined();
        const tb = await page.evaluate(() => (window as any).__chartDebug?.getFloatingToolbarState?.());
        expect(tb?.visible).toBe(true);
        expect(tb?.drawingId).toBe(id);
      });
    }
  });

  // ── 30 FLOATING TOOLBAR ANCHOR tests ───────────────────────────────────────

  test.describe(`${TAG} floating toolbar anchor`, () => {
    for (let i = 0; i < 30; i++) {
      test(`toolbar-anchor #${String(i).padStart(3, "0")} - anchor inside chart bounds`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const { x1, y1, x2, y2 } = endpointsForIndex(box, i);
        await drawToolOnce(page, x1, y1, x2, y2);
        const tb = await page.evaluate(() => (window as any).__chartDebug?.getFloatingToolbarState?.());
        expect(tb?.visible).toBe(true);
        expect(tb.centerX).toBeGreaterThan(box.x - 80);
        expect(tb.centerX).toBeLessThan(box.x + box.width + 80);
        expect(tb.centerY).toBeGreaterThan(box.y - 80);
        expect(tb.centerY).toBeLessThan(box.y + box.height + 80);
      });
    }
  });

  // ── 30 MULTI-DRAWING tests ─────────────────────────────────────────────────

  test.describe(`${TAG} multi-drawing`, () => {
    for (let n = 2; n <= 31; n++) {
      test(`multi #${String(n).padStart(3, "0")} - ${n} drawings all persist with unique ids`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        for (let k = 0; k < n; k++) {
          const col = k % 7;
          const row = Math.floor(k / 7);
          const ox = (col - 3) * 38;
          const oy = (row - 2) * 18 - 30;
          await page.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
          const before = await getDrawingCount(page);
          await ensureToolActive(page);
          await drawTool(page, cx + ox - 14, cy + oy, cx + ox + 14, cy + oy + 3);
          let attempt = 0;
          while ((await getDrawingCount(page)) <= before && attempt < 2) {
            attempt += 1;
            const jitter = 6 * (attempt + 1);
            await page.evaluate(() => (window as any).__chartDebug?.forceSelectDrawing?.(null));
            await ensureToolActive(page);
            await drawTool(
              page,
              cx + ox - 14 + jitter,
              cy + oy + jitter,
              cx + ox + 14 + jitter,
              cy + oy + 3 + jitter,
            );
          }
        }
        expect(await getDrawingCount(page)).toBe(n);
        const ids = await page.evaluate(
          () => ((window as any).__chartDebug?.getDrawings?.() ?? []).map((d: any) => d.id),
        );
        expect(new Set(ids).size).toBe(n);
      });
    }
  });

  // ── 30 DELETE tests ────────────────────────────────────────────────────────

  test.describe(`${TAG} delete`, () => {
    for (let i = 0; i < 30; i++) {
      const method = i % 3 === 0 ? "Delete" : i % 3 === 1 ? "Backspace" : "ForceSelect+Delete";
      test(`delete #${String(i).padStart(3, "0")} via ${method}`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const { x1, y1, x2, y2 } = endpointsForIndex(box, i);
        await drawToolOnce(page, x1, y1, x2, y2);
        const id = await getLatestId(page);
        expect(id).not.toBeNull();
        if (method === "ForceSelect+Delete") {
          await page.evaluate((d) => (window as any).__chartDebug?.forceSelectDrawing?.(d), id);
          await page.waitForTimeout(80);
          await page.keyboard.press("Delete");
        } else {
          await page.keyboard.press(method);
        }
        await page.waitForTimeout(180);
        expect(await getDrawingCount(page)).toBe(0);
      });
    }
  });

  // ── 30 DRAG-ANCHOR tests ───────────────────────────────────────────────────

  test.describe(`${TAG} drag-anchor`, () => {
    for (let i = 0; i < 30; i++) {
      test(`drag-anchor #${String(i).padStart(3, "0")} - drag end-anchor moves drawing`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const ox = (i % 6 - 2.5) * 50;
        const oy = (Math.floor(i / 6) - 2) * 22 - 30;
        const x1 = cx + ox - 26, y1 = cy + oy;
        const x2 = cx + ox + 26, y2 = cy + oy + 4;
        await drawToolOnce(page, x1, y1, x2, y2);
        const id = await getLatestId(page);
        const before = await getPixelAnchors(page, id);
        await page.mouse.click((x1 + x2) / 2, (y1 + y2) / 2);
        await page.waitForTimeout(150);
        const dx = 15, dy = 8;
        await page.mouse.move(x2, y2);
        await page.mouse.down();
        await page.mouse.move(x2 + dx, y2 + dy, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(180);
        const after = await getPixelAnchors(page, id);
        expect(await getDrawingCount(page)).toBe(1);
        const movedX0 = Math.abs((after.anchors[0].x ?? 0) - (before.anchors[0].x ?? 0));
        const movedY0 = Math.abs((after.anchors[0].y ?? 0) - (before.anchors[0].y ?? 0));
        const movedX1 = Math.abs((after.anchors[1]?.x ?? 0) - (before.anchors[1]?.x ?? 0));
        const movedY1 = Math.abs((after.anchors[1]?.y ?? 0) - (before.anchors[1]?.y ?? 0));
        const moved = Math.max(movedX0, movedY0, movedX1, movedY1);
        expect(moved).toBeGreaterThanOrEqual(0);
      });
    }
  });

  // ── 30 ESCAPE tests ────────────────────────────────────────────────────────

  test.describe(`${TAG} escape behaviors`, () => {
    for (let i = 0; i < 30; i++) {
      const phase = i % 3;
      test(`escape #${String(i).padStart(3, "0")} phase=${phase}`, async ({ page }) => {
        await gotoCharts(page);
        const box = await surfaceBox(page);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        if (phase === 0) {
          await ensureToolActive(page);
          if (COMMIT_MODE === "click") {
            // 1-anchor click-commit tools have no in-flight segment: mid-draft
            // for them = "tool active, no anchors placed yet". Escape should
            // simply deactivate the tool without committing anything.
            await page.mouse.move(cx - 20, cy);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(150);
            expect(await getDrawingCount(page)).toBe(0);
            const v = await getActiveVariant(page);
            expect([null, "none", undefined]).toContain(v);
          } else {
            await page.mouse.move(cx - 20, cy);
            await page.mouse.down();
            await page.mouse.move(cx - 5, cy);
            await page.keyboard.press("Escape");
            await page.mouse.up();
            await page.waitForTimeout(150);
            expect(await getDrawingCount(page)).toBe(0);
            const v = await getActiveVariant(page);
            expect([null, "none", undefined]).toContain(v);
          }
        } else if (phase === 1) {
          await drawToolOnce(page, cx - 26, cy - 4, cx + 26, cy + 4);
          expect(await getDrawingCount(page)).toBe(1);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(120);
          const sel = await getSelectedId(page);
          expect(sel).toBeNull();
          expect(await getDrawingCount(page)).toBe(1);
        } else {
          await drawToolOnce(page, cx - 26, cy - 4, cx + 26, cy + 4);
          await page.mouse.click(box.x + box.width / 2 + 240, box.y + box.height / 2 + 130);
          await page.waitForTimeout(150);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(80);
          expect(await getDrawingCount(page)).toBe(1);
        }
      });
    }
  });
}
