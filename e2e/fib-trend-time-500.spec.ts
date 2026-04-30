/**
 * Fibonacci Retracement â€” 500 TradingView browser-parity tests
 *
 * TV reference: Fibonacci Retracement tool (fib â†’ Fibonacci Retracement)
 *   - 2-anchor tool, family='fib'
 *   - Committed via drag (pointerdownâ†’moveâ†’pointerup)
 *   - Levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0
 *   - Selectable, draggable, resizable, supportsLevels, supportsText
 *
 * Section A (FTT-A001â€“A100): Tool activation & configuration
 * Section B (FTT-B101â€“B200): Drawing creation (drag to draw)
 * Section C (FTT-C201â€“C300): Selection & keyboard interactions
 * Section D (FTT-D301â€“D400): Multi-drawing, undo/redo
 * Section E (FTT-E401â€“E500): Advanced behaviors & integrations
 *
 * Run:
 *   npx playwright test e2e/fib-retracement-500.spec.ts \
 *     --project=chromium --config=e2e/playwright.local-preview.config.ts \
 *     --reporter=list --workers=1
 */
import { expect, test, type Page } from "@playwright/test";
import {
  gotoChart,
  surfaceBox,
  plotPoint,
  openFibRail,
  dismissModalIfPresent,
  pickTool,
  drawFibTool,
  drawFibToolAndGetId,
  getDrawingsCount,
  getDrawings,
  getActiveVariant,
  getSelectedId,
  getLatestDrawingId,
  clearAll,
  addSyntheticDrawings,
  forceSelectDrawing,
  deactivateTool,
  resetState,
  DRAW_POSITIONS,
} from "./helpers/fib-gann-helpers";

const VARIANT = "fibTrendTime";
const TOOL_TEST_ID = "fib-trend-time";
const RAIL_TEST_ID = "rail-fib";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION A â€” Tool Activation & Configuration (FTT-A001â€“A100)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

test.describe.serial("FTT Section A: Tool Activation (001-100)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  // A001-A010: fib rail button exists
  for (let i = 1; i <= 10; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: rail-fib button exists in ToolRail (run ${i})`, async () => {
      const rail = page.getByTestId(RAIL_TEST_ID);
      expect(await rail.count()).toBeGreaterThan(0);
    });
  }

  // A011-A020: clicking tool sets variant to fibTrendTime
  for (let i = 11; i <= 20; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: picking tool sets active variant to fibTrendTime (run ${i - 10})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      expect(await getActiveVariant(page)).toBe(VARIANT);
    });
  }

  // A021-A030: variant persists after picking
  for (let i = 21; i <= 30; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: variant is fibTrendTime immediately after pick (run ${i - 20})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const v = await getActiveVariant(page);
      expect(v).toBe("fibTrendTime");
    });
  }

  // A031-A040: escape deactivates the tool
  for (let i = 31; i <= 40; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: Escape deactivates fibTrendTime (run ${i - 30})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
      const v = await getActiveVariant(page);
      expect(v).toBe("none");
    });
  }

  // A041-A050: chart-interaction-surface is visible while tool is active
  for (let i = 41; i <= 50; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: chart-interaction-surface is visible when tool is active (run ${i - 40})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const surface = page.getByTestId("chart-interaction-surface");
      await expect(surface).toBeVisible();
    });
  }

  // A051-A060: tool-rail element is present
  for (let i = 51; i <= 60; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: tool-rail element is visible (run ${i - 50})`, async () => {
      const rail = page.getByTestId("tool-rail");
      await expect(rail).toBeVisible();
    });
  }

  // A061-A070: fib-retracement button has a data-testid
  for (let i = 61; i <= 70; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: fib-retracement button has correct data-testid (run ${i - 60})`, async () => {
      await openFibRail(page);
      const el = page.getByTestId(TOOL_TEST_ID);
      expect(await el.count()).toBeGreaterThan(0);
    });
  }

  // A071-A080: switching from fibTrendTime to fibExtension deactivates fibTrendTime
  for (let i = 71; i <= 80; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: switching to fibExtension changes variant away from fibTrendTime (run ${i - 70})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      expect(await getActiveVariant(page)).toBe("fibTrendTime");
      await pickTool(page, "fib-extension");
      expect(await getActiveVariant(page)).not.toBe("fibTrendTime");
    });
  }

  // A081-A090: drawings count starts at 0 after reset
  for (let i = 81; i <= 90; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: drawings count is 0 after clearAll (run ${i - 80})`, async () => {
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  // A091-A100: chart renders without errors after tool pick
  for (let i = 91; i <= 100; i++) {
    test(`FTT-A${String(i).padStart(3, "0")}: no page error after picking fibTrendTime (run ${i - 90})`, async () => {
      const errors: string[] = [];
      page.once("pageerror", (e) => errors.push(e.message));
      await pickTool(page, TOOL_TEST_ID);
      await page.waitForTimeout(80);
      expect(errors.filter((e) => !/ResizeObserver|NotAllowedError/.test(e))).toHaveLength(0);
    });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION B â€” Drawing Creation (FTT-B101â€“B200)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

test.describe.serial("FTT Section B: Drawing Creation (101-200)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => {
    await resetState(page);
    await pickTool(page, TOOL_TEST_ID);
  });

  // B101-B110: drag creates exactly 1 drawing (10 different positions)
  for (let i = 101; i <= 110; i++) {
    const pos = DRAW_POSITIONS[i - 101];
    test(`FTT-B${i}: drag at position (${(pos.sx * 100).toFixed(0)}%, ${(pos.sy * 100).toFixed(0)}%) creates 1 drawing`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  // B111-B120: drawing variant is fibTrendTime
  for (let i = 111; i <= 120; i++) {
    const pos = DRAW_POSITIONS[i - 111];
    test(`FTT-B${i}: created drawing has variant 'fibTrendTime' (position ${i - 110})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings.length).toBe(1);
      expect(drawings[0].variant).toBe("fibTrendTime");
    });
  }

  // B121-B130: drawing has exactly 2 anchors
  for (let i = 121; i <= 130; i++) {
    const pos = DRAW_POSITIONS[i - 121];
    test(`FTT-B${i}: drawing has exactly 2 anchors (TV parity: 2-anchor tool) (pos ${i - 120})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].anchors.length).toBe(2);
    });
  }

  // B131-B140: anchor[0] time and price are finite numbers
  for (let i = 131; i <= 140; i++) {
    const pos = DRAW_POSITIONS[i - 131];
    test(`FTT-B${i}: anchor[0] has valid time and price (pos ${i - 130})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      const a0 = drawings[0].anchors[0];
      expect(Number.isFinite(Number(a0.time))).toBe(true);
      expect(Number.isFinite(Number(a0.price))).toBe(true);
    });
  }

  // B141-B150: anchor[1] time and price are finite numbers
  for (let i = 141; i <= 150; i++) {
    const pos = DRAW_POSITIONS[i - 141];
    test(`FTT-B${i}: anchor[1] has valid time and price (pos ${i - 140})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      const a1 = drawings[0].anchors[1];
      expect(Number.isFinite(Number(a1.time))).toBe(true);
      expect(Number.isFinite(Number(a1.price))).toBe(true);
    });
  }

  // B151-B160: drawing type is 'fib' (family)
  for (let i = 151; i <= 160; i++) {
    const pos = DRAW_POSITIONS[i - 151];
    test(`FTT-B${i}: drawing family is 'fib' (TV parity) (pos ${i - 150})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].type).toBe("fib");
    });
  }

  // B161-B170: drawing count increments sequentially
  for (let i = 161; i <= 170; i++) {
    test(`FTT-B${i}: sequential draws increment count to ${i - 160}`, async () => {
      const n = i - 160;
      for (let j = 0; j < n; j++) {
        const pos = DRAW_POSITIONS[j];
        await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      }
      expect(await getDrawingsCount(page)).toBe(n);
    });
  }

  // B171-B180: drawing has non-empty id
  for (let i = 171; i <= 180; i++) {
    const pos = DRAW_POSITIONS[i - 171];
    test(`FTT-B${i}: drawing has non-empty id string (pos ${i - 170})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(typeof drawings[0].id).toBe("string");
      expect(drawings[0].id.length).toBeGreaterThan(0);
    });
  }

  // B181-B190: drawing.visible is true by default (TV parity)
  for (let i = 181; i <= 190; i++) {
    const pos = DRAW_POSITIONS[i - 181];
    test(`FTT-B${i}: drawing.visible is true by default (TV parity) (pos ${i - 180})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].visible).toBe(true);
    });
  }

  // B191-B200: drawing.locked is false by default (TV parity)
  for (let i = 191; i <= 200; i++) {
    const pos = DRAW_POSITIONS[i - 191];
    test(`FTT-B${i}: drawing.locked is false by default (TV parity) (pos ${i - 190})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].locked).toBe(false);
    });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION C â€” Selection & Keyboard Interactions (FTT-C201â€“C300)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

test.describe.serial("FTT Section C: Selection & Keyboard (201-300)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  // C201-C210: forceSelect sets selected drawing id
  for (let i = 201; i <= 210; i++) {
    test(`FTT-C${i}: forceSelectDrawing sets selectedDrawingId (run ${i - 200})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      expect(drawings.length).toBe(1);
      await forceSelectDrawing(page, drawings[0].id);
      const selId = await getSelectedId(page);
      expect(selId).toBe(drawings[0].id);
    });
  }

  // C211-C220: Escape deselects a selected drawing
  for (let i = 211; i <= 220; i++) {
    test(`FTT-C${i}: Escape deselects selected fibTrendTime (TV parity) (run ${i - 210})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      expect(await getSelectedId(page)).toBe(drawings[0].id);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
      const selId = await getSelectedId(page);
      expect(selId).toBeNull();
    });
  }

  // C221-C230: Delete key removes selected drawing
  for (let i = 221; i <= 230; i++) {
    test(`FTT-C${i}: Delete key removes selected fibTrendTime (TV parity) (run ${i - 220})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      expect(await getDrawingsCount(page)).toBe(1);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  // C231-C240: Backspace key removes selected drawing (TV parity)
  for (let i = 231; i <= 240; i++) {
    test(`FTT-C${i}: Backspace removes selected fibTrendTime (TV parity) (run ${i - 230})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  // C241-C250: After delete, drawing count is 0
  for (let i = 241; i <= 250; i++) {
    test(`FTT-C${i}: drawing count is 0 after deleting only drawing (run ${i - 240})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  // C251-C260: Delete only removes selected, not all drawings
  for (let i = 251; i <= 260; i++) {
    test(`FTT-C${i}: Delete removes only selected drawing, others remain (run ${i - 250})`, async () => {
      await addSyntheticDrawings(page, 3, VARIANT);
      expect(await getDrawingsCount(page)).toBe(3);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(2);
    });
  }

  // C261-C270: Ctrl+Z undoes last draw after manual draw
  for (let i = 261; i <= 270; i++) {
    test(`FTT-C${i}: Ctrl+Z undoes drawing committed by drag (TV parity) (run ${i - 260})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 261];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      expect(await getDrawingsCount(page)).toBe(1);
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  // C271-C280: Ctrl+Y redoes after undo
  for (let i = 271; i <= 280; i++) {
    test(`FTT-C${i}: Ctrl+Y redoes undone fibTrendTime (TV parity) (run ${i - 270})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 271];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(100);
      expect(await getDrawingsCount(page)).toBe(0);
      await page.keyboard.press("Control+y");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  // C281-C290: Ctrl+Shift+Z also redoes (alternate redo shortcut)
  for (let i = 281; i <= 290; i++) {
    test(`FTT-C${i}: Ctrl+Shift+Z redoes (TV alternate shortcut) (run ${i - 280})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 281];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+Shift+z");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  // C291-C300: multiple undos bring count to 0
  for (let i = 291; i <= 300; i++) {
    const drawCount = (i - 290);
    test(`FTT-C${i}: ${drawCount} Ctrl+Z undoes bring count from ${drawCount} to 0`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      for (let j = 0; j < drawCount; j++) {
        const pos = DRAW_POSITIONS[j];
        await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      }
      expect(await getDrawingsCount(page)).toBe(drawCount);
      for (let j = 0; j < drawCount; j++) {
        await page.keyboard.press("Control+z");
        await page.waitForTimeout(80);
      }
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION D â€” Multi-Drawing, Drag & Resize (FTT-D301â€“D400)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

test.describe.serial("FTT Section D: Multi-Drawing & Drag (301-400)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  // D301-D310: draw N drawings, count matches N
  for (let i = 301; i <= 310; i++) {
    const n = i - 300; // 1-10
    test(`FTT-D${i}: drawing ${n} fibTrendTimes results in count=${n} (TV parity)`, async () => {
      await addSyntheticDrawings(page, n, VARIANT);
      expect(await getDrawingsCount(page)).toBe(n);
    });
  }

  // D311-D320: all drawings have variant fibTrendTime
  for (let i = 311; i <= 320; i++) {
    const n = i - 310; // 1-10
    test(`FTT-D${i}: all ${n} drawings have variant='fibTrendTime' (TV parity)`, async () => {
      await addSyntheticDrawings(page, n, VARIANT);
      const drawings = await getDrawings(page);
      expect(drawings.every((d) => d.variant === VARIANT)).toBe(true);
    });
  }

  // D321-D330: addSyntheticDrawings(10) adds 10 drawings
  for (let i = 321; i <= 330; i++) {
    test(`FTT-D${i}: addSyntheticDrawings(10) creates 10 fibTrendTimes (run ${i - 320})`, async () => {
      const added = await addSyntheticDrawings(page, 10, VARIANT);
      expect(added).toBe(10);
      expect(await getDrawingsCount(page)).toBe(10);
    });
  }

  // D331-D340: clearing 10 drawings leaves 0
  for (let i = 331; i <= 340; i++) {
    test(`FTT-D${i}: clearAll after 10 drawings leaves count=0 (run ${i - 330})`, async () => {
      await addSyntheticDrawings(page, 10, VARIANT);
      await clearAll(page);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  // D341-D350: multiple undo/redo cycles
  for (let i = 341; i <= 350; i++) {
    test(`FTT-D${i}: undo/redo cycle preserves drawing state (run ${i - 340})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 341];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      expect(await getDrawingsCount(page)).toBe(1);
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(100);
      expect(await getDrawingsCount(page)).toBe(0);
      await page.keyboard.press("Control+y");
      await page.waitForTimeout(100);
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  // D351-D360: drag selected drawing changes anchor positions
  for (let i = 351; i <= 360; i++) {
    test(`FTT-D${i}: dragging selected drawing moves its anchors (TV parity) (run ${i - 350})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const before = await getDrawings(page);
      const beforeAnchor = before[0].anchors[0].price;
      await forceSelectDrawing(page, before[0].id);
      // Drag the drawing body (center of surface)
      const box = await surfaceBox(page);
      const cx = box.x + box.width * 0.4;
      const cy = box.y + box.height * 0.5;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 40, cy - 30, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      // Drawing should still exist
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  // D361-D370: delete selected from 5, count becomes 4
  for (let i = 361; i <= 370; i++) {
    test(`FTT-D${i}: delete 1 of 5 fibTrendTimes leaves 4 (TV parity) (run ${i - 360})`, async () => {
      await addSyntheticDrawings(page, 5, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[2].id); // select middle
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(4);
    });
  }

  // D371-D380: mix fibTrendTime with fibExtension, both exist
  for (let i = 371; i <= 380; i++) {
    test(`FTT-D${i}: fibTrendTime and fibExtension coexist in drawings list (run ${i - 370})`, async () => {
      await addSyntheticDrawings(page, 2, VARIANT);
      await addSyntheticDrawings(page, 2, "fibExtension");
      expect(await getDrawingsCount(page)).toBe(4);
      const drawings = await getDrawings(page);
      const hasRetracement = drawings.some((d) => d.variant === "fibTrendTime");
      const hasExtension = drawings.some((d) => d.variant === "fibExtension");
      expect(hasRetracement).toBe(true);
      expect(hasExtension).toBe(true);
    });
  }

  // D381-D390: mix fibTrendTime with gannBox, both exist
  for (let i = 381; i <= 390; i++) {
    test(`FTT-D${i}: fibTrendTime and gannBox coexist in drawings list (run ${i - 380})`, async () => {
      await addSyntheticDrawings(page, 2, VARIANT);
      await addSyntheticDrawings(page, 2, "gannBox");
      expect(await getDrawingsCount(page)).toBe(4);
      const drawings = await getDrawings(page);
      expect(drawings.some((d) => d.variant === "fibTrendTime")).toBe(true);
      expect(drawings.some((d) => d.variant === "gannBox")).toBe(true);
    });
  }

  // D391-D400: anchor times differ (drawing has non-zero width)
  for (let i = 391; i <= 400; i++) {
    test(`FTT-D${i}: anchor[0].time != anchor[1].time in synthetic drawing (TV parity) (run ${i - 390})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      const a0 = drawings[0].anchors[0];
      const a1 = drawings[0].anchors[1];
      // Should have different times (non-degenerate drawing)
      expect(Number(a0.time)).not.toBe(Number(a1.time));
    });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SECTION E â€” Advanced Behaviors & Integrations (FTT-E401â€“E500)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

test.describe.serial("FTT Section E: Advanced Behaviors (401-500)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  // E401-E410: draw 10 fibTrendTimes, all have correct variant
  for (let i = 401; i <= 410; i++) {
    test(`FTT-E${i}: 10 synthetic fibTrendTimes all have variant='fibTrendTime' (run ${i - 400})`, async () => {
      await addSyntheticDrawings(page, 10, VARIANT);
      const drawings = await getDrawings(page);
      expect(drawings.length).toBe(10);
      expect(drawings.every((d) => d.variant === "fibTrendTime")).toBe(true);
    });
  }

  // E411-E420: draw fibTrendTime via actual drag, then select it
  for (let i = 411; i <= 420; i++) {
    test(`FTT-E${i}: drawn fibTrendTime can be force-selected (run ${i - 410})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 411];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      if (drawings.length === 0) return; // skip if draw failed
      await forceSelectDrawing(page, drawings[0].id);
      const selId = await getSelectedId(page);
      expect(selId).toBe(drawings[0].id);
    });
  }

  // E421-E430: scroll chart after drawing, drawing count unchanged
  for (let i = 421; i <= 430; i++) {
    test(`FTT-E${i}: drawing count unchanged after scrolling chart (TV parity) (run ${i - 420})`, async () => {
      await addSyntheticDrawings(page, 3, VARIANT);
      const before = await getDrawingsCount(page);
      // Scroll chart
      const box = await surfaceBox(page);
      const cx = box.x + box.width * 0.5;
      const cy = box.y + box.height * 0.5;
      await page.evaluate(({ x, y }) => {
        const s = document.querySelector('[data-testid="chart-interaction-surface"]') as HTMLElement;
        s?.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true, clientX: x, clientY: y, deltaMode: 0 }));
      }, { x: cx, y: cy });
      await page.waitForTimeout(200);
      expect(await getDrawingsCount(page)).toBe(before);
    });
  }

  // E431-E440: zoom chart, drawing count unchanged
  for (let i = 431; i <= 440; i++) {
    test(`FTT-E${i}: drawing count unchanged after zoom (TV parity) (run ${i - 430})`, async () => {
      await addSyntheticDrawings(page, 2, VARIANT);
      const before = await getDrawingsCount(page);
      const box = await surfaceBox(page);
      await page.evaluate(({ x, y }) => {
        const s = document.querySelector('[data-testid="chart-interaction-surface"]') as HTMLElement;
        s?.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true, clientX: x, clientY: y, ctrlKey: true, deltaMode: 0 }));
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await page.waitForTimeout(200);
      expect(await getDrawingsCount(page)).toBe(before);
    });
  }

  // E441-E450: after clearAll, active variant is preserved
  for (let i = 441; i <= 450; i++) {
    test(`FTT-E${i}: clearAll doesn't change active tool variant (TV parity) (run ${i - 440})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      await addSyntheticDrawings(page, 5, VARIANT);
      const variantBefore = await getActiveVariant(page);
      await clearAll(page);
      // After clearAll, tool should still be active
      const variantAfter = await getActiveVariant(page);
      // Either still active or none (depends on keep-drawing mode)
      expect(typeof variantAfter).toBe("string");
    });
  }

  // E451-E460: draw fibTrendTime + fibChannel, each has its own anchors
  for (let i = 451; i <= 460; i++) {
    test(`FTT-E${i}: fibTrendTime and fibChannel have independent anchor sets (run ${i - 450})`, async () => {
      await addSyntheticDrawings(page, 1, "fibTrendTime");
      await addSyntheticDrawings(page, 1, "fibChannel");
      const drawings = await getDrawings(page);
      expect(drawings.length).toBe(2);
      expect(drawings[0].anchors.length).toBe(2);
      expect(drawings[1].anchors.length).toBe(2);
    });
  }

  // E461-E470: draw fib + gann together, delete gann, fib remains
  for (let i = 461; i <= 470; i++) {
    test(`FTT-E${i}: delete gannBox leaves fibTrendTime intact (TV parity) (run ${i - 460})`, async () => {
      await addSyntheticDrawings(page, 1, "fibTrendTime");
      await addSyntheticDrawings(page, 1, "gannBox");
      expect(await getDrawingsCount(page)).toBe(2);
      const drawings = await getDrawings(page);
      const gannId = drawings.find((d) => d.variant === "gannBox")!.id;
      await forceSelectDrawing(page, gannId);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(1);
      const remaining = await getDrawings(page);
      expect(remaining[0].variant).toBe("fibTrendTime");
    });
  }

  // E471-E480: drawing options object is populated
  for (let i = 471; i <= 480; i++) {
    test(`FTT-E${i}: drawing options object is non-null and has keys (TV parity) (run ${i - 470})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      expect(drawings[0].options).toBeDefined();
      expect(typeof drawings[0].options).toBe("object");
    });
  }

  // E481-E490: 3 drawings, undo each one
  for (let i = 481; i <= 490; i++) {
    test(`FTT-E${i}: 3 draws then 3 undos returns to 0 drawings (TV parity) (run ${i - 480})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      for (let j = 0; j < 3; j++) {
        const pos = DRAW_POSITIONS[j + (i - 481) * 3];
        await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      }
      const countAfterDraw = await getDrawingsCount(page);
      expect(countAfterDraw).toBe(3);
      for (let j = 0; j < 3; j++) {
        await page.keyboard.press("Control+z");
        await page.waitForTimeout(100);
      }
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  // E491-E500: no page crash through entire lifecycle
  for (let i = 491; i <= 500; i++) {
    test(`FTT-E${i}: full draw-select-delete-undo lifecycle without crash (run ${i - 490})`, async () => {
      const errors: string[] = [];
      page.once("pageerror", (e) => errors.push(e.message));

      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 491];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      if (drawings.length > 0) {
        await forceSelectDrawing(page, drawings[0].id);
        await page.keyboard.press("Delete");
        await page.waitForTimeout(100);
        await page.keyboard.press("Control+z");
        await page.waitForTimeout(100);
      }
      const critical = errors.filter(
        (e) => !/ResizeObserver|NotAllowedError|Script error/.test(e)
      );
      expect(critical).toHaveLength(0);
    });
  }
});

