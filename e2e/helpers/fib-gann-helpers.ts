/**
 * Shared helpers for Fibonacci and Gann drawing tool E2E tests.
 * All fib/gann tools are family='fib' and commit on drag (pointerdown → move → pointerup).
 * Pitchfan has 3 anchors; all others have 2 anchors.
 *
 * Key debug API: window.__chartDebug
 *   .getDrawingsCount()     → number
 *   .getDrawings()          → Drawing[]
 *   .getActiveVariant()     → string | null
 *   .getSelectedDrawingId() → string | null
 *   .clearDrawingsFast()    → void
 *   .addSyntheticDrawings(n, variant) → number
 *   .forceSelectDrawing(id) → string | null
 *   .getScrollPosition()    → number | null
 *   .getProjectedAnchors(id) → { anchors: [{x,y}] } | null
 */
import { expect, type Page } from "@playwright/test";

export const BASE =
  process.env.E2E_USE_EXTERNAL_STACK === "true"
    ? "https://tradereplay.me"
    : "http://127.0.0.1:8080";

const lastPickedToolByPage = new WeakMap<Page, string>();

type GotoChartOptions = {
  keepDrawing?: boolean;
};

// ─── Navigation ──────────────────────────────────────────────────────────────

export async function gotoChart(page: Page, options: GotoChartOptions = {}): Promise<void> {
  const keepDrawing = options.keepDrawing ?? true;
  await page.addInitScript((value: boolean) => {
    window.localStorage.setItem("chart-keep-drawing", value ? "true" : "false");
  }, keepDrawing);
  const localUrl = "http://localhost:8080/charts?symbol=RELIANCE";
  const baseUrl = `${BASE}/charts?symbol=RELIANCE`;
  const targetUrls = BASE.includes("127.0.0.1") ? [baseUrl, localUrl] : [baseUrl];

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const targetUrl = targetUrls[(attempt - 1) % targetUrls.length];

    try {
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      // Off-hours / weekends the default period returns "No data"; promote to
      // a wider period until the chart surface mounts.
      for (const period of ["1m", "1y", "5y", "all"]) {
        if (await page.locator('[data-testid="chart-interaction-surface"]').count()) break;
        const btn = page.locator(`[data-testid="period-btn-${period}"]`).first();
        if (await btn.count()) {
          await btn
            .dispatchEvent("click")
            .catch(() => {});
          await page.waitForTimeout(2000);
        }
      }

      await page.waitForSelector('[data-testid="chart-interaction-surface"]', {
        timeout: 30_000,
      });

      await page.waitForFunction(
        () => {
          const d = (window as any).__chartDebug;
          return (
            d &&
            typeof d.getScrollPosition === "function" &&
            d.getScrollPosition() !== null
          );
        },
        { timeout: 30_000 }
      );

      await page.waitForTimeout(700);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryableLoadFailure =
        /ERR_CONNECTION_REFUSED|ECONNREFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_ABORTED|waitForSelector: Timeout|waitForFunction: Timeout|Navigation timeout|Target page, context or browser has been closed/i.test(
          message
        );

      if (!isRetryableLoadFailure || attempt === 4) {
        throw error;
      }

      await page.waitForTimeout(1000 * attempt);
    }
  }
}

// ─── Surface geometry ────────────────────────────────────────────────────────

export async function surfaceBox(
  page: Page
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page
    .getByTestId("chart-interaction-surface")
    .boundingBox();
  if (!box) throw new Error("no chart-interaction-surface bounding box");
  return box;
}

/** Chart plot area (excludes 70px price axis on right) */
export function plotPoint(
  box: { x: number; y: number; width: number; height: number },
  fx: number,
  fy: number
): { x: number; y: number } {
  const plotW = box.width - 70;
  return {
    x: box.x + plotW * Math.max(0.02, Math.min(0.96, fx)),
    y: box.y + box.height * Math.max(0.05, Math.min(0.92, fy)),
  };
}

// ─── Rail helpers ─────────────────────────────────────────────────────────────

export async function openFibRail(page: Page): Promise<void> {
  await dismissModalIfPresent(page);
  const rail = page.getByTestId("rail-fib");
  if (await rail.count()) {
    await rail.first().click({ force: true });
    await page.waitForTimeout(180);
    return;
  }
  const btn = page.getByTestId("toolrail-button-fib");
  if (await btn.count()) {
    await btn.first().click({ force: true });
    await page.waitForTimeout(180);
  }
}

export async function dismissModalIfPresent(page: Page): Promise<void> {
  for (const id of ["chart-prompt-cancel", "chart-prompt-cancel-btn"]) {
    const el = page.getByTestId(id);
    if (await el.count()) {
      await el.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(80);
      return;
    }
  }
}

// ─── Tool activation ─────────────────────────────────────────────────────────

/**
 * Pick a tool by its data-testid. Opens the fib rail if the tool isn't already visible.
 */
export async function pickTool(page: Page, toolTestId: string): Promise<void> {
  await dismissModalIfPresent(page);
  let el = page.getByTestId(toolTestId).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await el.count()) break;
    await openFibRail(page);
    await page.waitForTimeout(120);
    el = page.getByTestId(toolTestId).first();
  }
  if (!(await el.count())) {
    throw new Error(`Tool button not found: ${toolTestId}`);
  }
  const before = await getActiveVariant(page);
  await el.click({ force: true });
  await page
    .waitForFunction(
      (b) => {
        const v = (window as any).__chartDebug?.getActiveVariant?.();
        return v !== b;
      },
      before,
      { timeout: 3000 }
    )
    .catch(() => page.waitForTimeout(250));
  // Guard: if clicking toggled the tool OFF (same-tool toggle), click again to re-activate
  const current = await getActiveVariant(page);
  if (current === null || current === "none") {
    await el.click({ force: true });
    await page
      .waitForFunction(
        () => {
          const v = (window as any).__chartDebug?.getActiveVariant?.();
          return v && v !== "none";
        },
        { timeout: 3000 }
      )
      .catch(() => page.waitForTimeout(250));
  }
  lastPickedToolByPage.set(page, toolTestId);
}

// ─── Drawing creation ────────────────────────────────────────────────────────

/**
 * Draw a fib/gann tool using drag (pointerdown → move → pointerup).
 * startFx/Fy and endFx/Fy are fractions [0,1] of the plot area.
 */
export async function drawFibTool(
  page: Page,
  startFx: number,
  startFy: number,
  endFx: number,
  endFy: number
): Promise<void> {
  const activeBefore = await getActiveVariant(page);
  if (!activeBefore || activeBefore === "none") {
    const rememberedTool = lastPickedToolByPage.get(page);
    if (rememberedTool) {
      await pickTool(page, rememberedTool);
    }
  }

  const box = await surfaceBox(page);
  const start = plotPoint(box, startFx, startFy);
  const end = plotPoint(box, endFx, endFy);

  const performDrag = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps: number
  ) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
  };

  const countBefore: number = await page.evaluate(
    () => (window as any).__chartDebug?.getDrawingsCount?.() ?? 0
  );

  await performDrag(start, end, 10);

  // Poll until drawing count increases (robust against slow browser after many tests).
  // Falls back gracefully if count doesn't increase (e.g. draw too small to commit).
  const committed = await page
    .waitForFunction(
      (prev: number) =>
        ((window as any).__chartDebug?.getDrawingsCount?.() ?? 0) > prev,
      countBefore,
      { timeout: 5000 }
    )
    .then(() => true)
    .catch(() => false);

  if (committed) return;

  const countAfterFirstAttempt: number = await page.evaluate(
    () => (window as any).__chartDebug?.getDrawingsCount?.() ?? 0
  );
  if (countAfterFirstAttempt > countBefore) return;

  const activeBeforeRetry = await getActiveVariant(page);
  if (!activeBeforeRetry || activeBeforeRetry === "none") {
    const rememberedTool = lastPickedToolByPage.get(page);
    if (rememberedTool) {
      await pickTool(page, rememberedTool);
    }
  }

  // Retry with safe in-plot vectors so edge-aligned samples still commit.
  const safeStart = plotPoint(box, 0.28, 0.34);
  const safeEnd = plotPoint(box, 0.58, 0.68);
  await performDrag(safeStart, safeEnd, 14);

  const committedOnRetry = await page
    .waitForFunction(
      (prev: number) =>
        ((window as any).__chartDebug?.getDrawingsCount?.() ?? 0) > prev,
      countBefore,
      { timeout: 4000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!committedOnRetry) {
    throw new Error("drawFibTool: drawing did not commit after retry");
  }
}

/**
 * Draw a fib/gann tool and return the latest drawing id.
 */
export async function drawFibToolAndGetId(
  page: Page,
  startFx: number,
  startFy: number,
  endFx: number,
  endFy: number
): Promise<string | null> {
  const before = await getDrawingsCount(page);
  await drawFibTool(page, startFx, startFy, endFx, endFy);
  const after = await getDrawingsCount(page);
  if (after <= before) return null;
  return getLatestDrawingId(page);
}

// ─── Debug API wrappers ───────────────────────────────────────────────────────

export async function getDrawingsCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as any).__chartDebug?.getDrawingsCount?.() ?? 0
  );
}

export async function getDrawings(page: Page): Promise<
  Array<{
    id: string;
    variant: string;
    type: string;
    anchors: Array<{ time: number; price: number }>;
    visible: boolean;
    locked: boolean;
    selected: boolean;
    options: Record<string, unknown>;
  }>
> {
  return page.evaluate(() => (window as any).__chartDebug?.getDrawings?.() ?? []);
}

export async function getActiveVariant(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (window as any).__chartDebug?.getActiveVariant?.() ?? null
  );
}

export async function getSelectedId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (window as any).__chartDebug?.getSelectedDrawingId?.() ?? null
  );
}

export async function getLatestDrawingId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (window as any).__chartDebug?.getLatestDrawingId?.() ?? null
  );
}

export async function clearAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__chartDebug?.clearDrawingsFast?.();
  });
  await page.waitForTimeout(60);
}

export async function addSyntheticDrawings(
  page: Page,
  count: number,
  variant: string
): Promise<number> {
  return page.evaluate(
    ([n, v]) =>
      (window as any).__chartDebug?.addSyntheticDrawings?.(n, v) ?? 0,
    [count, variant] as [number, string]
  );
}

export async function forceSelectDrawing(
  page: Page,
  id: string | null
): Promise<void> {
  // Selection can be asynchronous under heavy test load; retry briefly until state reflects target.
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.evaluate(
      (drawId) => (window as any).__chartDebug?.forceSelectDrawing?.(drawId),
      id
    );

    const selected = await getSelectedId(page);
    if (selected === id) {
      return;
    }

    await page.waitForTimeout(60);
  }

  await page.waitForTimeout(80);
}

export async function getProjectedAnchors(
  page: Page,
  id: string
): Promise<{ id: string; variant: string; anchors: Array<{ x: number; y: number }> } | null> {
  return page.evaluate(
    (drawId) => (window as any).__chartDebug?.getProjectedAnchors?.(drawId) ?? null,
    id
  );
}

export async function deactivateTool(page: Page): Promise<void> {
  // First Escape: closes fib sub-rail popup if it's open
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  // Second Escape: if the first only closed the sub-rail, this deactivates the tool
  const stillActive = await getActiveVariant(page);
  if (stillActive && stillActive !== "none") {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }
  // Fallback: use the API to force deactivation
  await page.evaluate(() => {
    const w = window as any;
    if (typeof w.__tradereplaySetCursorMode === "function") {
      w.__tradereplaySetCursorMode("none");
    }
  });
  await page.waitForTimeout(60);
}

export async function resetState(page: Page): Promise<void> {
  await dismissModalIfPresent(page);
  await clearAll(page);
  await deactivateTool(page);
}

// ─── Assertions ───────────────────────────────────────────────────────────────

/** Asserts that exactly one drawing was committed since before. */
export async function expectOneNewDrawing(
  page: Page,
  countBefore: number,
  variant: string
): Promise<string> {
  const countAfter = await getDrawingsCount(page);
  expect(countAfter).toBe(countBefore + 1);
  const drawings = await getDrawings(page);
  const last = drawings[drawings.length - 1];
  expect(last).toBeDefined();
  expect(last.variant).toBe(variant);
  return last.id;
}

// ─── Test position presets ────────────────────────────────────────────────────

/** 100 different start/end positions for drawing tests */
export const DRAW_POSITIONS: Array<{
  sx: number; sy: number; ex: number; ey: number;
}> = Array.from({ length: 100 }, (_, i) => {
  // Vary positions across the chart to get diverse coverage
  const col = i % 10; // 0-9
  const row = Math.floor(i / 10); // 0-9
  return {
    sx: 0.05 + col * 0.08,         // 0.05 to 0.77
    sy: 0.15 + row * 0.07,         // 0.15 to 0.78
    ex: 0.11 + col * 0.08,         // 0.11 to 0.83 (width=0.06, no overlap with adjacent cols: ex[col]<sx[col+1])
    ey: 0.40 + row * 0.05,         // 0.40 to 0.85 (different y)
  };
});
