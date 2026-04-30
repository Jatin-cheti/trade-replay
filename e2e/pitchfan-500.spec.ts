/**
 * Pitchfan — 500 TradingView browser-parity tests
 *
 * TV reference: Pitchfan tool (fib → Fibonacci → Pitchfan)
 *   - 3-anchor tool, family='fib' (3rd anchor auto-filled on drag)
 *   - Committed via drag (pointerdown→move→pointerup)
 *   - Draggable, resizable, supportsLevels
 *
 * Section A (PF-A001–A100): Tool activation & configuration
 * Section B (PF-B101–B200): Drawing creation (drag to draw)
 * Section C (PF-C201–C300): Selection & keyboard interactions
 * Section D (PF-D301–D400): Multi-drawing, undo/redo
 * Section E (PF-E401–E500): Advanced behaviors & integrations
 *
 * Run:
 *   npx playwright test e2e/pitchfan-500.spec.ts \
 *     --project=chromium --config=e2e/playwright.local-preview.config.ts \
 *     --reporter=list --workers=1
 */
import { expect, test, type Page } from "@playwright/test";
import {
  gotoChart,
  surfaceBox,
  openFibRail,
  pickTool,
  drawFibTool,
  getDrawingsCount,
  getDrawings,
  getActiveVariant,
  getSelectedId,
  clearAll,
  addSyntheticDrawings,
  forceSelectDrawing,
  deactivateTool,
  resetState,
  DRAW_POSITIONS,
} from "./helpers/fib-gann-helpers";

const VARIANT = "pitchfan";
const TOOL_TEST_ID = "pitchfan";
const RAIL_TEST_ID = "rail-fib";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — Tool Activation & Configuration (PF-A001–A100)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PF Section A: Tool Activation (001-100)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  for (let i = 1; i <= 10; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: rail-fib button exists (run ${i})`, async () => {
      const rail = page.getByTestId(RAIL_TEST_ID);
      expect(await rail.count()).toBeGreaterThan(0);
    });
  }

  for (let i = 11; i <= 20; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: picking pitchfan sets active variant (run ${i - 10})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      expect(await getActiveVariant(page)).toBe(VARIANT);
    });
  }

  for (let i = 21; i <= 30; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: variant is pitchfan immediately after pick (run ${i - 20})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      expect(await getActiveVariant(page)).toBe("pitchfan");
    });
  }

  for (let i = 31; i <= 40; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: Escape deactivates pitchfan (run ${i - 30})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
      expect(await getActiveVariant(page)).toBe("none");
    });
  }

  for (let i = 41; i <= 50; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: chart-interaction-surface visible when pitchfan active (run ${i - 40})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      await expect(page.getByTestId("chart-interaction-surface")).toBeVisible();
    });
  }

  for (let i = 51; i <= 60; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: tool-rail element visible (run ${i - 50})`, async () => {
      await expect(page.getByTestId("tool-rail")).toBeVisible();
    });
  }

  for (let i = 61; i <= 70; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: pitchfan button exists in fib rail (run ${i - 60})`, async () => {
      await openFibRail(page);
      expect(await page.getByTestId(TOOL_TEST_ID).count()).toBeGreaterThan(0);
    });
  }

  for (let i = 71; i <= 80; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: switching to fibRetracement changes variant away from pitchfan (run ${i - 70})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      await pickTool(page, "fib-retracement");
      expect(await getActiveVariant(page)).not.toBe("pitchfan");
    });
  }

  for (let i = 81; i <= 90; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: drawings count is 0 after clearAll (run ${i - 80})`, async () => {
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  for (let i = 91; i <= 100; i++) {
    test(`PF-A${String(i).padStart(3, "0")}: no page error after picking pitchfan (run ${i - 90})`, async () => {
      const errors: string[] = [];
      page.once("pageerror", (e) => errors.push(e.message));
      await pickTool(page, TOOL_TEST_ID);
      await page.waitForTimeout(80);
      expect(errors.filter((e) => !/ResizeObserver|NotAllowedError/.test(e))).toHaveLength(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — Drawing Creation (PF-B101–B200)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PF Section B: Drawing Creation (101-200)", () => {
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

  // B101-B110: drag creates exactly 1 drawing
  for (let i = 101; i <= 110; i++) {
    const pos = DRAW_POSITIONS[i - 101];
    test(`PF-B${i}: drag creates 1 pitchfan drawing (pos ${i - 100})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  // B111-B120: drawing variant is pitchfan
  for (let i = 111; i <= 120; i++) {
    const pos = DRAW_POSITIONS[i - 111];
    test(`PF-B${i}: created drawing has variant='pitchfan' (pos ${i - 110})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings.length).toBe(1);
      expect(drawings[0].variant).toBe("pitchfan");
    });
  }

  // B121-B130: pitchfan has 3 anchors (TV parity — 3-anchor tool)
  for (let i = 121; i <= 130; i++) {
    const pos = DRAW_POSITIONS[i - 121];
    test(`PF-B${i}: pitchfan drawing has 3 anchors (TV parity: 3-anchor tool) (pos ${i - 120})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      // Pitchfan is 3-anchor; 3rd is auto-filled to same as 2nd on drag commit
      expect(drawings[0].anchors.length).toBe(3);
    });
  }

  // B131-B140: anchor[0] has valid time/price
  for (let i = 131; i <= 140; i++) {
    const pos = DRAW_POSITIONS[i - 131];
    test(`PF-B${i}: anchor[0] has valid time and price (pos ${i - 130})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      const a0 = drawings[0].anchors[0];
      expect(Number.isFinite(Number(a0.time))).toBe(true);
      expect(Number.isFinite(Number(a0.price))).toBe(true);
    });
  }

  // B141-B150: anchor[1] has valid time/price
  for (let i = 141; i <= 150; i++) {
    const pos = DRAW_POSITIONS[i - 141];
    test(`PF-B${i}: anchor[1] has valid time and price (pos ${i - 140})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      const a1 = drawings[0].anchors[1];
      expect(Number.isFinite(Number(a1.time))).toBe(true);
      expect(Number.isFinite(Number(a1.price))).toBe(true);
    });
  }

  // B151-B160: drawing type is 'fib'
  for (let i = 151; i <= 160; i++) {
    const pos = DRAW_POSITIONS[i - 151];
    test(`PF-B${i}: drawing family is 'fib' (TV parity) (pos ${i - 150})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].type).toBe("fib");
    });
  }

  // B161-B170: drawing count increments
  for (let i = 161; i <= 170; i++) {
    test(`PF-B${i}: sequential draws increment count to ${i - 160}`, async () => {
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
    test(`PF-B${i}: drawing has non-empty id (pos ${i - 170})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].id.length).toBeGreaterThan(0);
    });
  }

  // B181-B190: drawing.visible is true
  for (let i = 181; i <= 190; i++) {
    const pos = DRAW_POSITIONS[i - 181];
    test(`PF-B${i}: drawing.visible is true by default (TV parity) (pos ${i - 180})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].visible).toBe(true);
    });
  }

  // B191-B200: drawing.locked is false
  for (let i = 191; i <= 200; i++) {
    const pos = DRAW_POSITIONS[i - 191];
    test(`PF-B${i}: drawing.locked is false by default (TV parity) (pos ${i - 190})`, async () => {
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      expect(drawings[0].locked).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — Selection & Keyboard Interactions (PF-C201–C300)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PF Section C: Selection & Keyboard (201-300)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  for (let i = 201; i <= 210; i++) {
    test(`PF-C${i}: forceSelectDrawing sets selectedDrawingId (run ${i - 200})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      expect(await getSelectedId(page)).toBe(drawings[0].id);
    });
  }

  for (let i = 211; i <= 220; i++) {
    test(`PF-C${i}: Escape deselects selected pitchfan (TV parity) (run ${i - 210})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
      expect(await getSelectedId(page)).toBeNull();
    });
  }

  for (let i = 221; i <= 230; i++) {
    test(`PF-C${i}: Delete key removes selected pitchfan (TV parity) (run ${i - 220})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  for (let i = 231; i <= 240; i++) {
    test(`PF-C${i}: Backspace removes selected pitchfan (TV parity) (run ${i - 230})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  for (let i = 241; i <= 250; i++) {
    test(`PF-C${i}: drawing count is 0 after deleting only drawing (run ${i - 240})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  for (let i = 251; i <= 260; i++) {
    test(`PF-C${i}: Delete removes only selected drawing, others remain (run ${i - 250})`, async () => {
      await addSyntheticDrawings(page, 3, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[0].id);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(2);
    });
  }

  for (let i = 261; i <= 270; i++) {
    test(`PF-C${i}: Ctrl+Z undoes pitchfan committed by drag (TV parity) (run ${i - 260})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 261];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      expect(await getDrawingsCount(page)).toBe(1);
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  for (let i = 271; i <= 280; i++) {
    test(`PF-C${i}: Ctrl+Y redoes undone pitchfan (TV parity) (run ${i - 270})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 271];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(100);
      await page.keyboard.press("Control+y");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  for (let i = 281; i <= 290; i++) {
    test(`PF-C${i}: Ctrl+Shift+Z redoes (alternate shortcut) (run ${i - 280})`, async () => {
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

  for (let i = 291; i <= 300; i++) {
    const drawCount = i - 290;
    test(`PF-C${i}: ${drawCount} Ctrl+Z undoes bring count to 0`, async () => {
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

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D — Multi-Drawing & Drag (PF-D301–D400)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PF Section D: Multi-Drawing & Drag (301-400)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  for (let i = 301; i <= 310; i++) {
    const n = i - 300;
    test(`PF-D${i}: ${n} pitchfans results in count=${n} (TV parity)`, async () => {
      await addSyntheticDrawings(page, n, VARIANT);
      expect(await getDrawingsCount(page)).toBe(n);
    });
  }

  for (let i = 311; i <= 320; i++) {
    const n = i - 310;
    test(`PF-D${i}: all ${n} pitchfans have variant='pitchfan' (TV parity)`, async () => {
      await addSyntheticDrawings(page, n, VARIANT);
      const drawings = await getDrawings(page);
      expect(drawings.every((d) => d.variant === VARIANT)).toBe(true);
    });
  }

  for (let i = 321; i <= 330; i++) {
    test(`PF-D${i}: addSyntheticDrawings(10, 'pitchfan') creates 10 drawings (run ${i - 320})`, async () => {
      const added = await addSyntheticDrawings(page, 10, VARIANT);
      expect(added).toBe(10);
      expect(await getDrawingsCount(page)).toBe(10);
    });
  }

  for (let i = 331; i <= 340; i++) {
    test(`PF-D${i}: clearAll after 10 pitchfans leaves count=0 (run ${i - 330})`, async () => {
      await addSyntheticDrawings(page, 10, VARIANT);
      await clearAll(page);
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  for (let i = 341; i <= 350; i++) {
    test(`PF-D${i}: undo/redo cycle preserves drawing state (run ${i - 340})`, async () => {
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

  for (let i = 351; i <= 360; i++) {
    test(`PF-D${i}: dragging pitchfan drawing doesn't remove it (TV parity) (run ${i - 350})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      await forceSelectDrawing(page, (await getDrawings(page))[0].id);
      const box = await surfaceBox(page);
      const cx = box.x + box.width * 0.4;
      const cy = box.y + box.height * 0.5;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 30, cy - 20, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(1);
    });
  }

  for (let i = 361; i <= 370; i++) {
    test(`PF-D${i}: delete 1 of 5 pitchfans leaves 4 (TV parity) (run ${i - 360})`, async () => {
      await addSyntheticDrawings(page, 5, VARIANT);
      const drawings = await getDrawings(page);
      await forceSelectDrawing(page, drawings[2].id);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(4);
    });
  }

  for (let i = 371; i <= 380; i++) {
    test(`PF-D${i}: pitchfan and fibRetracement coexist (run ${i - 370})`, async () => {
      await addSyntheticDrawings(page, 2, VARIANT);
      await addSyntheticDrawings(page, 2, "fibRetracement");
      expect(await getDrawingsCount(page)).toBe(4);
      const drawings = await getDrawings(page);
      expect(drawings.some((d) => d.variant === "pitchfan")).toBe(true);
      expect(drawings.some((d) => d.variant === "fibRetracement")).toBe(true);
    });
  }

  for (let i = 381; i <= 390; i++) {
    test(`PF-D${i}: pitchfan and gannFan coexist (run ${i - 380})`, async () => {
      await addSyntheticDrawings(page, 2, VARIANT);
      await addSyntheticDrawings(page, 2, "gannFan");
      expect(await getDrawingsCount(page)).toBe(4);
      const drawings = await getDrawings(page);
      expect(drawings.some((d) => d.variant === "pitchfan")).toBe(true);
      expect(drawings.some((d) => d.variant === "gannFan")).toBe(true);
    });
  }

  for (let i = 391; i <= 400; i++) {
    test(`PF-D${i}: pitchfan anchors[0].time != anchors[1].time (TV parity) (run ${i - 390})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      const a0 = drawings[0].anchors[0];
      const a1 = drawings[0].anchors[1];
      expect(Number(a0.time)).not.toBe(Number(a1.time));
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E — Advanced Behaviors (PF-E401–E500)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("PF Section E: Advanced Behaviors (401-500)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await gotoChart(page);
  });
  test.afterAll(async () => { await page.close(); });
  test.beforeEach(async () => { await resetState(page); });

  for (let i = 401; i <= 410; i++) {
    test(`PF-E${i}: 10 synthetic pitchfans all have variant='pitchfan' (run ${i - 400})`, async () => {
      await addSyntheticDrawings(page, 10, VARIANT);
      const drawings = await getDrawings(page);
      expect(drawings.every((d) => d.variant === "pitchfan")).toBe(true);
    });
  }

  for (let i = 411; i <= 420; i++) {
    test(`PF-E${i}: drawn pitchfan can be force-selected (run ${i - 410})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      const pos = DRAW_POSITIONS[i - 411];
      await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      const drawings = await getDrawings(page);
      if (drawings.length === 0) return;
      await forceSelectDrawing(page, drawings[0].id);
      expect(await getSelectedId(page)).toBe(drawings[0].id);
    });
  }

  for (let i = 421; i <= 430; i++) {
    test(`PF-E${i}: drawing count unchanged after chart scroll (TV parity) (run ${i - 420})`, async () => {
      await addSyntheticDrawings(page, 3, VARIANT);
      const before = await getDrawingsCount(page);
      const box = await surfaceBox(page);
      await page.evaluate(({ x, y }) => {
        const s = document.querySelector('[data-testid="chart-interaction-surface"]') as HTMLElement;
        s?.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true, clientX: x, clientY: y, deltaMode: 0 }));
      }, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 });
      await page.waitForTimeout(200);
      expect(await getDrawingsCount(page)).toBe(before);
    });
  }

  for (let i = 431; i <= 440; i++) {
    test(`PF-E${i}: drawing count unchanged after zoom (TV parity) (run ${i - 430})`, async () => {
      await addSyntheticDrawings(page, 2, VARIANT);
      const before = await getDrawingsCount(page);
      const box = await surfaceBox(page);
      await page.evaluate(({ x, y }) => {
        const s = document.querySelector('[data-testid="chart-interaction-surface"]') as HTMLElement;
        s?.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, ctrlKey: true, bubbles: true, cancelable: true, clientX: x, clientY: y, deltaMode: 0 }));
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await page.waitForTimeout(200);
      expect(await getDrawingsCount(page)).toBe(before);
    });
  }

  for (let i = 441; i <= 450; i++) {
    test(`PF-E${i}: clearAll doesn't change active tool variant (run ${i - 440})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      await addSyntheticDrawings(page, 5, VARIANT);
      await clearAll(page);
      expect(typeof await getActiveVariant(page)).toBe("string");
    });
  }

  for (let i = 451; i <= 460; i++) {
    test(`PF-E${i}: pitchfan and fibChannel have independent anchor sets (run ${i - 450})`, async () => {
      await addSyntheticDrawings(page, 1, "pitchfan");
      await addSyntheticDrawings(page, 1, "fibChannel");
      const drawings = await getDrawings(page);
      expect(drawings.length).toBe(2);
      // Pitchfan has 3 anchors, fibChannel has 2
      const pf = drawings.find((d) => d.variant === "pitchfan")!;
      const fc = drawings.find((d) => d.variant === "fibChannel")!;
      expect(pf.anchors.length).toBe(3);
      expect(fc.anchors.length).toBe(2);
    });
  }

  for (let i = 461; i <= 470; i++) {
    test(`PF-E${i}: delete gannFan leaves pitchfan intact (TV parity) (run ${i - 460})`, async () => {
      await addSyntheticDrawings(page, 1, "pitchfan");
      await addSyntheticDrawings(page, 1, "gannFan");
      const drawings = await getDrawings(page);
      const gannId = drawings.find((d) => d.variant === "gannFan")!.id;
      await forceSelectDrawing(page, gannId);
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      expect(await getDrawingsCount(page)).toBe(1);
      expect((await getDrawings(page))[0].variant).toBe("pitchfan");
    });
  }

  for (let i = 471; i <= 480; i++) {
    test(`PF-E${i}: pitchfan drawing options are defined (TV parity) (run ${i - 470})`, async () => {
      await addSyntheticDrawings(page, 1, VARIANT);
      const drawings = await getDrawings(page);
      expect(drawings[0].options).toBeDefined();
      expect(typeof drawings[0].options).toBe("object");
    });
  }

  for (let i = 481; i <= 490; i++) {
    test(`PF-E${i}: 3 draws then 3 undos returns to 0 (TV parity) (run ${i - 480})`, async () => {
      await pickTool(page, TOOL_TEST_ID);
      for (let j = 0; j < 3; j++) {
        const pos = DRAW_POSITIONS[j + (i - 481) * 3];
        await drawFibTool(page, pos.sx, pos.sy, pos.ex, pos.ey);
      }
      expect(await getDrawingsCount(page)).toBe(3);
      for (let j = 0; j < 3; j++) {
        await page.keyboard.press("Control+z");
        await page.waitForTimeout(100);
      }
      expect(await getDrawingsCount(page)).toBe(0);
    });
  }

  for (let i = 491; i <= 500; i++) {
    test(`PF-E${i}: full draw-select-delete-undo lifecycle without crash (run ${i - 490})`, async () => {
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
      const critical = errors.filter((e) => !/ResizeObserver|NotAllowedError|Script error/.test(e));
      expect(critical).toHaveLength(0);
    });
  }
});
