import { expect, test } from "@playwright/test";
import {
  gotoChart,
  plotPoint,
  pickTool,
  getDrawingsCount,
  getDrawings,
  getActiveVariant,
  getLatestDrawingId,
  getProjectedAnchors,
  forceSelectDrawing,
  resetState,
} from "./helpers/fib-gann-helpers";

type ToolCase = {
  label: string;
  variant: string;
  toolTestId: string;
};

const TOOL_CASES: ToolCase[] = [
  { label: "Fib Retracement", variant: "fibRetracement", toolTestId: "fib-retracement" },
  { label: "Gann Box", variant: "gannBox", toolTestId: "gann-box" },
];
const PRICE_AXIS_TARGET_OFFSET = 52;

async function chartBox(page: import("@playwright/test").Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.evaluate(
    () => (window as any).__chartDebug?.getChartBounds?.() ?? null
  );
  if (!box) throw new Error("no chart bounds from __chartDebug");
  return box;
}

async function ensureObjectTreeCollapsed(page: import("@playwright/test").Page): Promise<void> {
  const panel = page.getByTestId("object-tree-panel").first();
  if (!(await panel.count())) return;
  const open = await panel.getAttribute("data-open");
  if (open !== "true") return;

  const toggle = page.getByTestId("chart-objects-toggle").first();
  if (await toggle.count()) {
    await toggle.click({ force: true });
    await expect(panel).toHaveAttribute("data-open", "false");
  }
}

for (const tool of TOOL_CASES) {
  test.describe(`Axis parity - ${tool.label}`, () => {
    for (let run = 1; run <= 10; run++) {
      test(`FG-AX-${tool.variant}-D${String(run).padStart(2, "0")}: clicking price-axis clears selection`, async ({ page }) => {
        await gotoChart(page, { keepDrawing: false });
        await resetState(page);
        await ensureObjectTreeCollapsed(page);

        await pickTool(page, tool.toolTestId);

        const box = await chartBox(page);
        const start = plotPoint(box, 0.2 + run * 0.01, 0.25 + run * 0.01);
        const end = plotPoint(box, 0.7, 0.6);

        const before = await getDrawingsCount(page);

        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 12 });
        await page.mouse.up();

        await page.waitForFunction(
          (prev) => ((window as any).__chartDebug?.getDrawingsCount?.() ?? 0) > prev,
          before,
          { timeout: 5000 }
        );

        const drawId = await getLatestDrawingId(page);
        expect(drawId).not.toBeNull();

        await forceSelectDrawing(page, drawId);
        const selectedBefore = await page.evaluate(
          () => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null
        );
        expect(selectedBefore).toBe(drawId);

        const activeBeforeAxis = await getActiveVariant(page);
        expect(activeBeforeAxis).toBe("none");

        const axisX = box.x + box.width - PRICE_AXIS_TARGET_OFFSET;
        const axisY = box.y + box.height * (0.2 + run * 0.05);
        const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
        await page.mouse.click(axisX, axisY);
        await page.waitForTimeout(80);

        const pointerDebug = await page.evaluate(
          () => (window as any).__chartDebug?.getLastPointerDownDebug?.() ?? null
        );
        expect(
          pointerDebug?.clickedPriceAxis,
          JSON.stringify({ axisX, axisY, viewport, box, pointerDebug })
        ).toBeTruthy();

        const selectedAfter = await page.evaluate(
          () => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null
        );
        expect(selectedAfter).toBeNull();
        expect(await getDrawingsCount(page)).toBe(before + 1);
      });
    }

    for (let run = 1; run <= 10; run++) {
      test(`FG-AX-${tool.variant}-R${String(run).padStart(2, "0")}: drag ending on price-axis still commits visible drawing`, async ({ page }) => {
        await gotoChart(page, { keepDrawing: false });
        await resetState(page);
        await ensureObjectTreeCollapsed(page);

        await pickTool(page, tool.toolTestId);

        const box = await chartBox(page);
        const start = plotPoint(box, 0.2 + run * 0.01, 0.35 + run * 0.02);

        const axisX = box.x + box.width - PRICE_AXIS_TARGET_OFFSET;
        const axisY = box.y + box.height * (0.15 + run * 0.06);

        const before = await getDrawingsCount(page);

        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(axisX, axisY, { steps: 16 });
        await page.mouse.up();

        await page.waitForFunction(
          (prev) => ((window as any).__chartDebug?.getDrawingsCount?.() ?? 0) > prev,
          before,
          { timeout: 5000 }
        );

        expect(await getDrawingsCount(page)).toBe(before + 1);

        const drawings = await getDrawings(page);
        const last = drawings[drawings.length - 1];
        expect(last).toBeDefined();
        expect(last.variant).toBe(tool.variant);
        expect(last.anchors.length).toBeGreaterThanOrEqual(2);

        const distance =
          Math.abs(last.anchors[0].time - last.anchors[1].time)
          + Math.abs(last.anchors[0].price - last.anchors[1].price);
        expect(distance).toBeGreaterThan(0);

        const projected = await getProjectedAnchors(page, last.id);
        expect(projected).not.toBeNull();
        expect(projected?.anchors.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(
          (projected?.anchors ?? []).every(
            (anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
          )
        ).toBeTruthy();
      });
    }
  });
}
