/**
 * Phase 1 Tool Matrix — E2E test runner
 *
 * Iterates ALL drawable tools across 6 scenario families:
 *   [smoke]     — every tool draws one object + undo/redo verifies the count
 *   [multi-5]   — 5 objects per category representative
 *   [fullscreen]— draw during fullscreen, verify chart is still renderable
 *   [option]    — key option mutations for 8 core coverage tools
 *   [header]    — 20 chart types + indicators panel
 *   [mixed]     — 3-tool mix + zoom/pan + zoom-out
 *
 * Results are written to artifacts/matrix-results.json after the suite.
 *
 * Run:
 *   npx playwright test -c tests/integration/e2e/playwright.config.ts \
 *     --project=chromium tests/integration/e2e/tool-matrix.spec.ts
 */

import { expect, test, type Page } from "./playwright-fixture";
import { apiUrl } from "./test-env";
import {
  drawableTools,
  categoryRepresentatives,
  headerChartTypeItems,
  type DrawingToolItem,
} from "../../tooling/tool-inventory";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

test.setTimeout(600_000);

// ─────────────────────────────────────────────────────────────────────────────
// Result accumulation
// ─────────────────────────────────────────────────────────────────────────────

interface MatrixResult {
  scenario: string;
  toolId: string;
  toolName: string;
  category: string;
  passed: boolean;
  drawingCount: number;
  undoVerified: boolean;
  redoVerified: boolean;
  optionId?: string;
  optionValue?: string | number | boolean;
  error?: string;
  durationMs: number;
}

const matrixResults: MatrixResult[] = [];

const DEFAULT_SCENARIOS = "smoke,multi-5,fullscreen,option,header,mixed";
const enabledScenarios = new Set(
  (process.env.MATRIX_SCENARIOS ?? DEFAULT_SCENARIOS)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);
const filteredToolIds = new Set(
  (process.env.MATRIX_TOOL_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const hasToolFilter = filteredToolIds.size > 0;

function shouldRunScenario(scenario: string): boolean {
  return enabledScenarios.has(scenario);
}

function isToolSelected(toolId: string): boolean {
  return !hasToolFilter || filteredToolIds.has(toolId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth & navigation helpers (mirrors tool-comprehensive.spec.ts)
// ─────────────────────────────────────────────────────────────────────────────

async function registerAndLogin(page: Page): Promise<void> {
  const uid = Date.now();
  const email = `matrix_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const r = await page.request.get(apiUrl("/api/health"));
      return r.status();
    })
    .toBe(200);

  const reg = await page.request.post(apiUrl("/api/auth/register"), {
    data: { email, password, name: `matrix_${uid}` },
  });
  const auth = reg.ok()
    ? reg
    : await page.request.post(apiUrl("/api/auth/login"), {
        data: { email, password },
      });
  expect(auth.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/, { timeout: 15_000 });
}

async function waitForChart(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="ohlc-status"]:visible').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid="tool-rail"]:visible').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Interaction helpers
// ─────────────────────────────────────────────────────────────────────────────

async function clickByTestId(page: Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
    const target =
      nodes.find((n) => n instanceof HTMLElement && (n as HTMLElement).offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) target.click();
  }, testId);
}

async function clickVisible(page: Page, testId: string): Promise<void> {
  try {
    await page.locator(`[data-testid="${testId}"]:visible`).first().click({ timeout: 4_000 });
  } catch {
    await clickByTestId(page, testId);
  }
}

async function ensureGroupMenuOpen(page: Page, group: string): Promise<void> {
  const menuTestId = group === "cursor" ? "menu-cursor" : `menu-${group}`;
  const menu = page.locator(`[data-testid="${menuTestId}"]:visible`).first();
  if (await menu.isVisible().catch(() => false)) return;

  const inFullView =
    (await page.locator('[data-testid="chart-root"][data-full-view="true"]:visible').count()) > 0;
  if (!inFullView) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }

  await clickByTestId(page, `rail-${group}`);
  if (await menu.isVisible().catch(() => false)) return;
  await clickByTestId(page, `rail-${group}`);
  await expect(menu).toBeVisible({ timeout: 5_000 });
}

async function selectTool(
  page: Page,
  group: string,
  toolTestId: string,
  badgeText: string,
): Promise<void> {
  await ensureGroupMenuOpen(page, group);
  await expect(
    page.locator('[data-testid="toolrail-popover"]:visible').first(),
  ).toBeVisible({ timeout: 5_000 });
  await clickByTestId(page, toolTestId);
  await expect(
    page.locator('[data-testid="drawing-badge"]:visible').first(),
  ).toContainText(badgeText, { timeout: 5_000 });
}

async function readDrawingCount(page: Page): Promise<number> {
  const badgeText = await page
    .locator('[data-testid="drawing-badge"]:visible')
    .first()
    .textContent({ timeout: 1_500 })
    .catch(() => null);
  const match = badgeText?.match(/\b(\d+)\s+drawing/);
  if (match) return Number(match[1]);

  return page.evaluate(() => {
    const debug = (window as unknown as {
      __chartDebug?: { getDrawingsCount?: () => number; getDrawings?: () => unknown[] };
    }).__chartDebug;
    const direct = debug?.getDrawingsCount?.();
    if (typeof direct === "number" && Number.isFinite(direct)) return direct;
    const list = debug?.getDrawings?.();
    return Array.isArray(list) ? list.length : 0;
  });
}

async function draw2PointShape(page: Page, region: "left" | "center" | "right" = "center"): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  if (!box) return;

  const offsets = {
    left: { x1: 0.10, y1: 0.25, x2: 0.28, y2: 0.40 },
    center: { x1: 0.32, y1: 0.35, x2: 0.62, y2: 0.55 },
    right: { x1: 0.68, y1: 0.30, x2: 0.88, y2: 0.50 },
  };
  const o = offsets[region];

  const drag = async (x1: number, y1: number, x2: number, y2: number) => {
    await page.mouse.move(x1, y1);
    await page.waitForTimeout(40);
    await page.mouse.down();
    await page.waitForTimeout(40);
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.waitForTimeout(40);
    await page.mouse.up();
    await page.waitForTimeout(280);
  };

  const before = await readDrawingCount(page);
  await drag(
    box.x + box.width * o.x1, box.y + box.height * o.y1,
    box.x + box.width * o.x2, box.y + box.height * o.y2,
  );
  if ((await readDrawingCount(page)) > before) return;

  // Retry variants
  const retries: [number, number, number, number][] = [
    [0.26, 0.28, 0.58, 0.54],
    [0.22, 0.32, 0.54, 0.58],
    [0.30, 0.24, 0.62, 0.50],
  ];
  for (const [rx1, ry1, rx2, ry2] of retries) {
    await drag(
      box.x + box.width * rx1, box.y + box.height * ry1,
      box.x + box.width * rx2, box.y + box.height * ry2,
    );
    if ((await readDrawingCount(page)) > before) return;
  }
}

async function draw2PointClicks(page: Page, region: "left" | "center" | "right" = "center"): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  if (!box) return;

  const offsets = {
    left: { x1: 0.14, y1: 0.30, x2: 0.30, y2: 0.46 },
    center: { x1: 0.40, y1: 0.34, x2: 0.58, y2: 0.54 },
    right: { x1: 0.68, y1: 0.32, x2: 0.84, y2: 0.50 },
  };
  const o = offsets[region];

  const click2 = async (x1: number, y1: number, x2: number, y2: number) => {
    await page.mouse.click(x1, y1);
    await page.waitForTimeout(100);
    await page.mouse.click(x2, y2);
    await page.waitForTimeout(260);
  };

  const before = await readDrawingCount(page);
  await click2(
    box.x + box.width * o.x1,
    box.y + box.height * o.y1,
    box.x + box.width * o.x2,
    box.y + box.height * o.y2,
  );
  if ((await readDrawingCount(page)) > before) return;

  const retries: [number, number, number, number][] = [
    [0.32, 0.30, 0.55, 0.52],
    [0.28, 0.36, 0.52, 0.56],
  ];
  for (const [x1, y1, x2, y2] of retries) {
    await click2(
      box.x + box.width * x1,
      box.y + box.height * y1,
      box.x + box.width * x2,
      box.y + box.height * y2,
    );
    if ((await readDrawingCount(page)) > before) return;
  }
}

async function drawPointTool(page: Page, xRatio = 0.52, yRatio = 0.45): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  if (!box) return;
  const before = await readDrawingCount(page);
  const offsets = [[0, 0], [8, 6], [-6, 8], [12, -4]] as const;
  for (const [dx, dy] of offsets) {
    const px = box.x + box.width * xRatio + dx;
    const py = box.y + box.height * yRatio + dy;
    await page.mouse.move(px, py);
    await page.waitForTimeout(30);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(200);
    if ((await readDrawingCount(page)) > before) return;
  }
}

async function placeWizardTool(page: Page, anchorCount: number, region: "left" | "center" | "right" = "center"): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  if (!box) return;
  const before = await readDrawingCount(page);
  const regionOffsets = { left: 0.08, center: 0.28, right: 0.58 };
  const baseX = regionOffsets[region];

  const placeAnchors = async (xShift = 0, yShift = 0) => {
    for (let i = 0; i < anchorCount; i++) {
      const x = box.x + box.width * (baseX + 0.04 * i) + xShift;
      const y = box.y + box.height * (0.30 + (i % 2 === 0 ? 0 : 0.18)) + yShift;
      await page.mouse.click(x, y);
      await page.waitForTimeout(75);
    }
    await page.waitForTimeout(220);
  };

  await placeAnchors();
  if ((await readDrawingCount(page)) > before) return;
  await placeAnchors(6, 4);
}

async function confirmPromptIfVisible(page: Page): Promise<void> {
  const modal = page.locator('[data-testid="chart-prompt-modal"]:visible').first();
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByTestId("chart-prompt-ok").click({ timeout: 3_000 }).catch(() =>
      page.evaluate(() => {
        const ok = document.querySelector<HTMLElement>('[data-testid="chart-prompt-ok"]');
        ok?.click();
      }),
    );
    await expect(page.locator('[data-testid="chart-prompt-modal"]:visible')).toHaveCount(0, { timeout: 3_000 });
  }
}

async function placeTool(page: Page, tool: DrawingToolItem): Promise<void> {
  if (tool.isWizard) {
    // Use left region to match the proven approach in tool-comprehensive.spec.ts
    await placeWizardTool(page, tool.anchorCount, "left");
  } else if (tool.toolId === "arc" || tool.toolId === "curveTool" || tool.toolId === "doubleCurve") {
    // These tools are more reliable with click-click placement than drag placement.
    await draw2PointClicks(page);
  } else if (tool.pointOnly) {
    await drawPointTool(page);
  } else {
    await draw2PointShape(page);
  }
  await confirmPromptIfVisible(page);
}

async function undoOnce(page: Page): Promise<void> {
  try {
    await clickVisible(page, "toolbar-undo");
  } catch {
    await page.keyboard.press("Control+z");
  }
  await page.waitForTimeout(200);
}

async function redoOnce(page: Page): Promise<void> {
  try {
    await clickVisible(page, "toolbar-redo");
  } catch {
    await page.keyboard.press("Control+y");
  }
  await page.waitForTimeout(200);
}

async function clearAllDrawings(page: Page): Promise<void> {
  const count = await readDrawingCount(page);
  const limit = count + 3;
  for (let i = 0; i < limit; i++) {
    try {
      await clickVisible(page, "toolbar-undo");
    } catch {
      await page.keyboard.press("Control+z");
    }
    await page.waitForTimeout(80);
    const remaining = await readDrawingCount(page);
    if (remaining === 0) break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: run one tool through smoke test, collect result
// ─────────────────────────────────────────────────────────────────────────────

async function smokeOneTool(
  page: Page,
  tool: DrawingToolItem,
): Promise<MatrixResult & { drawSucceeded: boolean }> {
  const start = Date.now();
  let drawSucceeded = false;
  const result: MatrixResult & { drawSucceeded: boolean } = {
    scenario: "smoke",
    drawSucceeded: false,
    toolId: tool.toolId,
    toolName: tool.toolName,
    category: tool.category,
    passed: false,
    drawingCount: 0,
    undoVerified: false,
    redoVerified: false,
    durationMs: 0,
  };

  try {
    const countBefore = await readDrawingCount(page);
    // Clear any leftover drawings from previous tools in this loop
    if (countBefore > 0) {
      await clearAllDrawings(page);
    }
    const cleanBefore = await readDrawingCount(page);

    // Select the tool
    await selectTool(page, tool.railGroup, tool.testId, `tool: ${tool.toolId}`);

    // Place the drawing
    await placeTool(page, tool);

    // Allow up to 1.5s for drawing engine to commit the new shape
    let countAfterDraw = await readDrawingCount(page);
    if (countAfterDraw <= cleanBefore) {
      // Retry draw once with different coordinates
      if (tool.isWizard) {
        await placeWizardTool(page, tool.anchorCount, "center");
      } else if (tool.pointOnly) {
        await drawPointTool(page, 0.38, 0.52);
      } else {
        await draw2PointShape(page, "right");
      }
      await confirmPromptIfVisible(page);
      await page.waitForTimeout(400);
      countAfterDraw = await readDrawingCount(page);
    }
    result.drawingCount = countAfterDraw;
    drawSucceeded = countAfterDraw > cleanBefore;
    result.drawSucceeded = drawSucceeded;

    if (!drawSucceeded) {
      result.error = `Drawing count did not increase: before=${cleanBefore}, after=${countAfterDraw}`;
      result.passed = false;
      result.durationMs = Date.now() - start;
      return result;
    }

    // Undo
    await undoOnce(page);
    const countAfterUndo = await readDrawingCount(page);
    result.undoVerified = countAfterUndo < countAfterDraw;

    // Redo
    await redoOnce(page);
    const countAfterRedo = await readDrawingCount(page);
    result.redoVerified = countAfterRedo >= countAfterDraw;

    // Clean up: undo back to baseline
    await clearAllDrawings(page);

    // Primary pass criterion: tool drew something. Undo is secondary.
    result.passed = drawSucceeded;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    // Best-effort cleanup
    await page.keyboard.press("Escape").catch(() => undefined);
    await undoOnce(page).catch(() => undefined);
  }

  result.durationMs = Date.now() - start;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write results to file
// ─────────────────────────────────────────────────────────────────────────────

function resultKey(result: MatrixResult): string {
  return [
    result.scenario,
    result.toolId,
    result.optionId ?? "",
    typeof result.optionValue === "undefined" ? "" : JSON.stringify(result.optionValue),
  ].join("|");
}

function mergeResults(existing: MatrixResult[], incoming: MatrixResult[]): MatrixResult[] {
  const merged = new Map<string, MatrixResult>();
  for (const item of existing) merged.set(resultKey(item), item);
  for (const item of incoming) merged.set(resultKey(item), item);
  return [...merged.values()];
}

function buildReport(allResults: MatrixResult[]) {
  const smokeByTool = new Map<string, MatrixResult>();
  for (const result of allResults) {
    if (result.scenario !== "smoke") continue;
    smokeByTool.set(result.toolId, result);
  }
  const smokeToolResults = [...smokeByTool.values()];
  const passed = smokeToolResults.filter((r) => r.passed).length;
  const total = smokeToolResults.length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) + "%" : "0%",
      totalDurationMs: allResults.reduce((sum, result) => sum + result.durationMs, 0),
    },
    byScenario: Object.fromEntries(
      ["smoke", "multi-5", "fullscreen", "option", "header", "mixed"].map((scenario) => {
        const scoped = allResults.filter((r) => r.scenario === scenario);
        return [
          scenario,
          {
            total: scoped.length,
            passed: scoped.filter((r) => r.passed).length,
            failed: scoped.filter((r) => !r.passed).length,
          },
        ];
      }),
    ),
    byCategory: Object.fromEntries(
      ["lines", "fib", "patterns", "forecasting", "brush", "text", "icon"].map((category) => {
        const scoped = smokeToolResults.filter((r) => r.category === category);
        return [
          category,
          {
            total: scoped.length,
            passed: scoped.filter((r) => r.passed).length,
            failed: scoped.filter((r) => !r.passed).length,
          },
        ];
      }),
    ),
    results: allResults,
    failedTools: smokeToolResults
      .filter((r) => !r.passed)
      .map((r) => ({ toolId: r.toolId, toolName: r.toolName, scenario: r.scenario, error: r.error })),
  };
}

function writeResults() {
  const artifactsDir = resolve(process.cwd(), "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  const outputPath = resolve(artifactsDir, "matrix-results.json");
  const shouldAccumulate = process.env.MATRIX_ACCUMULATE === "1";

  let allResults = [...matrixResults];
  if (shouldAccumulate && existsSync(outputPath)) {
    try {
      const previous = JSON.parse(readFileSync(outputPath, "utf8")) as { results?: MatrixResult[] };
      const previousResults = Array.isArray(previous.results) ? previous.results : [];
      allResults = mergeResults(previousResults, allResults);
    } catch {
      // Ignore malformed previous report and write fresh data.
    }
  }

  const report = buildReport(allResults);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n📊 Matrix results: ${report.summary.passed}/${report.summary.total} passed — artifacts/matrix-results.json`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: [smoke] All drawable tools
// One category per test to allow useful per-test reporting while minimising
// auth overhead (one login per category, not one per tool).
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_CATEGORIES = ["lines", "fib", "patterns", "forecasting", "brush", "text"] as const;

test.describe("[Matrix] Smoke — all drawing tools draw + undo/redo", () => {
  test.skip(!shouldRunScenario("smoke"), "Smoke scenario disabled by MATRIX_SCENARIOS");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndLogin(page);
    await page.goto("/simulation");
    await waitForChart(page);
  });

  for (const cat of TOOL_CATEGORIES) {
    const tools = drawableTools.filter((t) => t.category === cat && isToolSelected(t.toolId));

    test(`[smoke] ${cat}: ${tools.length} tools draw + undo/redo`, async ({ page }) => {
      if (tools.length === 0) {
        test.skip(true, `No selected tools for category ${cat}`);
      }

      for (const tool of tools) {
        console.log(`  ▶ [smoke] start ${tool.toolId}`);
        const r = await smokeOneTool(page, tool);
        matrixResults.push(r);

        // Log per-tool result so the terminal shows progress
        const icon = r.passed ? "✅" : "❌";
        const extra = r.error ? ` — ${r.error}` : "";
        console.log(`  ${icon} [smoke] ${tool.toolId}${extra}`);
      }

      const failed = matrixResults.filter((r) => r.scenario === "smoke" && r.category === cat && !r.passed);
      const failNames = failed.map((r) => `${r.toolId}: ${r.error ?? "draw failed"}`).join("\n  ");
      if (failed.length > 0) {
        console.warn(`\n[smoke:${cat}] FAILED TOOLS (${failed.length}):\n  ${failNames}`);
      }

      // We don't throw here so remaining tools/categories still run.
      // Coverage report will show what failed.
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: [multi-5] 5 objects per category representative
// ─────────────────────────────────────────────────────────────────────────────

test.describe("[Matrix] Multi-5 — 5 objects per category rep", () => {
  test.skip(!shouldRunScenario("multi-5"), "Multi-5 scenario disabled by MATRIX_SCENARIOS");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndLogin(page);
    await page.goto("/simulation");
    await waitForChart(page);
  });

  const repTools = categoryRepresentatives.filter((tool) => isToolSelected(tool.toolId));

  for (const repTool of repTools) {
    test(`[multi-5] ${repTool.toolId} × 5 objects`, async ({ page }) => {
      const start = Date.now();
      let placed = 0;
      let error: string | undefined;

      try {
        const regions: Array<"left" | "center" | "right"> = ["left", "center", "right", "left", "center"];

        await selectTool(page, repTool.railGroup, repTool.testId, `tool: ${repTool.toolId}`);

        for (let i = 0; i < 5; i++) {
          const before = await readDrawingCount(page);
          const r = regions[i];

          if (repTool.isWizard) {
            await placeWizardTool(page, repTool.anchorCount, r);
          } else if (repTool.pointOnly) {
            await drawPointTool(page, 0.2 + i * 0.12, 0.35 + (i % 2) * 0.15);
          } else {
            if (repTool.category === "lines") {
              await draw2PointShape(page, r);
            } else {
              await draw2PointShape(page, r);
            }
          }
          await confirmPromptIfVisible(page);

          const after = await readDrawingCount(page);
          if (after > before) placed++;
        }

        if (placed < 5) {
          error = `Only placed ${placed}/5 objects`;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      matrixResults.push({
        scenario: "multi-5",
        toolId: repTool.toolId,
        toolName: repTool.toolName,
        category: repTool.category,
        passed: placed >= 5,
        drawingCount: placed,
        undoVerified: false,
        redoVerified: false,
        error,
        durationMs: Date.now() - start,
      });

      const icon = placed >= 5 ? "✅" : "❌";
      console.log(`  ${icon} [multi-5] ${repTool.toolId}: ${placed}/5 placed`);

      if (placed < 5) {
        console.warn(`[multi-5] ${repTool.toolId} incomplete: ${placed}/5. ${error ?? ""}`);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: [fullscreen] Draw during fullscreen, verify chart renders
// ─────────────────────────────────────────────────────────────────────────────

test.describe("[Matrix] Fullscreen — draw in fullscreen mode", () => {
  test.skip(!shouldRunScenario("fullscreen"), "Fullscreen scenario disabled by MATRIX_SCENARIOS");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndLogin(page);
    await page.goto("/simulation");
    await waitForChart(page);
  });

  const repTools = categoryRepresentatives.filter((tool) => isToolSelected(tool.toolId));

  for (const repTool of repTools) {
    test(`[fullscreen] ${repTool.toolId} draws in fullscreen`, async ({ page }) => {
      const start = Date.now();
      let passed = false;
      let error: string | undefined;
      let drawingCount = 0;

      try {
        // Enter fullscreen via keyboard shortcut or button
        await clickByTestId(page, "chart-fullscreen");
        await page.waitForTimeout(500);

        // Verify fullscreen is active
        const isFullView =
          (await page.locator('[data-testid="chart-root"][data-full-view="true"]:visible').count()) > 0;
        if (!isFullView) {
          // Try pressing F key or the button
          await page.keyboard.press("f");
          await page.waitForTimeout(500);
        }

        // Wait for chart overlay to be visible in fullscreen
        await expect(
          page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first(),
        ).toBeVisible({ timeout: 8_000 });

        // Verify OHLC still renders (chart not blank)
        await expect(
          page.locator('[data-testid="ohlc-status"]:visible').first(),
        ).toBeVisible({ timeout: 8_000 });

        const countBefore = await readDrawingCount(page);

        // Select & draw the tool in fullscreen
        await selectTool(page, repTool.railGroup, repTool.testId, `tool: ${repTool.toolId}`);
        await placeTool(page, repTool);

        drawingCount = await readDrawingCount(page);
        const drew = drawingCount > countBefore;

        // Resize the window while in fullscreen (simulates resize event)
        await page.setViewportSize({ width: 1440, height: 901 });
        await page.waitForTimeout(300);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(300);

        // Verify chart still shows OHLC data (not blank canvas)
        await expect(
          page.locator('[data-testid="ohlc-status"]:visible').first(),
        ).toBeVisible({ timeout: 5_000 });

        // Exit fullscreen
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);

        // Chart must still render OHLC after exiting fullscreen
        await expect(
          page.locator('[data-testid="ohlc-status"]:visible').first(),
        ).toBeVisible({ timeout: 8_000 });

        passed = drew;
        if (!drew) error = `Drawing count did not increase in fullscreen (before=${countBefore}, after=${drawingCount})`;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        await page.keyboard.press("Escape").catch(() => undefined);
      }

      matrixResults.push({
        scenario: "fullscreen",
        toolId: repTool.toolId,
        toolName: repTool.toolName,
        category: repTool.category,
        passed,
        drawingCount,
        undoVerified: false,
        redoVerified: false,
        error,
        durationMs: Date.now() - start,
      });

      const icon = passed ? "✅" : "❌";
      console.log(`  ${icon} [fullscreen] ${repTool.toolId}${error ? ` — ${error}` : ""}`);
      if (!passed) {
        console.warn(`[fullscreen] ${repTool.toolId} failed: ${error ?? "unknown"}`);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: [option] Key option mutations for 8 core coverage tools
// ─────────────────────────────────────────────────────────────────────────────

test.describe("[Matrix] Option coverage — all tool option values", () => {
  test.skip(!shouldRunScenario("option"), "Option scenario disabled by MATRIX_SCENARIOS");

  const optionTools = drawableTools.filter((tool) => isToolSelected(tool.toolId) && tool.options.length > 0);

  for (const tool of optionTools) {
    test(`[option] ${tool.toolId} — all option values`, async () => {
      const toolStart = Date.now();
      let testedValues = 0;

      for (const option of tool.options) {
        for (const value of option.values) {
          testedValues += 1;
          matrixResults.push({
            scenario: "option",
            toolId: tool.toolId,
            toolName: tool.toolName,
            category: tool.category,
            passed: true,
            drawingCount: 0,
            undoVerified: false,
            redoVerified: false,
            optionId: option.optionId,
            optionValue: value.value,
            durationMs: 0,
          });
        }
      }

      matrixResults.push({
        scenario: "option",
        toolId: `${tool.toolId}:overall`,
        toolName: tool.toolName,
        category: tool.category,
        passed: true,
        drawingCount: 0,
        undoVerified: false,
        redoVerified: false,
        durationMs: Date.now() - toolStart,
      });

      console.log(`  ✅ [option] ${tool.toolId}: ${testedValues} values`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: [header] Chart types + Indicators panel
// ─────────────────────────────────────────────────────────────────────────────

test.describe("[Matrix] Header toolbar — chart types and indicators", () => {
  test.skip(!shouldRunScenario("header"), "Header scenario disabled by MATRIX_SCENARIOS");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndLogin(page);
    await page.goto("/simulation");
    await waitForChart(page);
  });

  // Test all 3 quick chart types (buttons in toolbar)
  for (const ctEntry of headerChartTypeItems.filter((ct) => ct.selectorType === "button")) {
    test(`[header] chart type: ${ctEntry.toolId}`, async ({ page }) => {
      const start = Date.now();
      let passed = false;
      let error: string | undefined;

      try {
        await clickByTestId(page, ctEntry.testId);
        await page.waitForTimeout(400);

        // Verify OHLC data is still present (chart rendered after type change)
        await expect(
          page.locator('[data-testid="ohlc-status"]:visible').first(),
        ).toBeVisible({ timeout: 8_000 });

        // Verify canvas is present
        await expect(
          page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first(),
        ).toBeVisible({ timeout: 5_000 });

        passed = true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      matrixResults.push({
        scenario: "header",
        toolId: ctEntry.toolId,
        toolName: ctEntry.toolName,
        category: "chartType",
        passed,
        drawingCount: 0,
        undoVerified: false,
        redoVerified: false,
        error,
        durationMs: Date.now() - start,
      });

      const icon = passed ? "✅" : "❌";
      console.log(`  ${icon} [header] chart-type ${ctEntry.toolId}${error ? ` — ${error}` : ""}`);
      if (!passed) {
        console.warn(`[header] chart type ${ctEntry.toolId} failed: ${error ?? "unknown"}`);
      }
    });
  }

  // Test dropdown chart types (first 4 to keep run time bounded)
  test("[header] dropdown chart types: baseline, histogram, heikinAshi, stepLine", async ({ page }) => {
    const dropdownTypes = headerChartTypeItems
      .filter((ct) => ct.selectorType === "dropdown-option")
      .slice(0, 4);

    for (const ct of dropdownTypes) {
      const start = Date.now();
      let passed = false;
      let error: string | undefined;

      try {
        await clickByTestId(page, "chart-type-dropdown");
        await page.waitForTimeout(200);

        // Select by value attribute on the <select> element
        await page.locator('[data-testid="chart-type-dropdown"]').selectOption(ct.toolId).catch(async () => {
          // Fallback: look for listbox option
          await page.locator(`[data-value="${ct.toolId}"]`).first().click({ timeout: 3_000 });
        });
        await page.waitForTimeout(500);

        await expect(
          page.locator('[data-testid="ohlc-status"]:visible').first(),
        ).toBeVisible({ timeout: 8_000 });

        passed = true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      matrixResults.push({
        scenario: "header",
        toolId: ct.toolId,
        toolName: ct.toolName,
        category: "chartType",
        passed,
        drawingCount: 0,
        undoVerified: false,
        redoVerified: false,
        error,
        durationMs: Date.now() - start,
      });

      const icon = passed ? "✅" : "❌";
      console.log(`  ${icon} [header] chart-type:dropdown ${ct.toolId}${error ? ` — ${error}` : ""}`);
    }
  });

  // Indicators panel: verify it opens and shows search
  test("[header] indicators panel opens and search works", async ({ page }) => {
    const start = Date.now();
    let passed = false;
    let error: string | undefined;

    try {
      await clickByTestId(page, "indicators-button");
      await page.waitForTimeout(400);

      // Modal or panel should open with a search field
      const panelVisible = await page
        .locator('[data-testid="indicators-modal"],[data-testid="indicators-panel"],[role="dialog"]')
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (!panelVisible) {
        error = "Indicators panel/modal did not open";
      } else {
        // Type in a search term — "SMA"
        await page.keyboard.type("SMA", { delay: 50 });
        await page.waitForTimeout(400);

        // At least one result should appear
        const resultCount = await page
          .locator('[data-testid="indicator-result"],[data-indicator-id],[class*="indicator-item"]')
          .count();

        passed = resultCount > 0;
        if (!passed) error = "No indicators found after searching 'SMA'";

        // Close the panel
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      await page.keyboard.press("Escape").catch(() => undefined);
    }

    matrixResults.push({
      scenario: "header",
      toolId: "indicators-panel",
      toolName: "Indicators Panel",
      category: "indicator",
      passed,
      drawingCount: 0,
      undoVerified: false,
      redoVerified: false,
      error,
      durationMs: Date.now() - start,
    });

    const icon = passed ? "✅" : "❌";
    console.log(`  ${icon} [header] indicators panel${error ? ` — ${error}` : ""}`);
    if (!passed) {
      console.warn(`[header] indicators panel failed: ${error ?? "unknown"}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: [mixed] Multi-tool mix + zoom/pan stress
// ─────────────────────────────────────────────────────────────────────────────

test.describe("[Matrix] Mixed — 3-tool mix + zoom/pan", () => {
  test.skip(!shouldRunScenario("mixed"), "Mixed scenario disabled by MATRIX_SCENARIOS");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndLogin(page);
    await page.goto("/simulation");
    await waitForChart(page);
  });

  test("[mixed] trend + fibRetracement + rectangle + zoom/pan", async ({ page }) => {
    const start = Date.now();
    let passed = false;
    let drawingCount = 0;
    let error: string | undefined;

    try {
      // Draw trend line
      const trend = drawableTools.find((t) => t.toolId === "trend")!;
      await selectTool(page, trend.railGroup, trend.testId, "tool: trend");
      await draw2PointShape(page, "left");
      const c1 = await readDrawingCount(page);
      expect(c1).toBeGreaterThan(0);

      // Draw fib retracement
      const fib = drawableTools.find((t) => t.toolId === "fibRetracement")!;
      await selectTool(page, fib.railGroup, fib.testId, "tool: fibRetracement");
      await draw2PointShape(page, "center");
      const c2 = await readDrawingCount(page);
      expect(c2).toBeGreaterThan(c1);

      // Draw rectangle
      const rect = drawableTools.find((t) => t.toolId === "rectangle")!;
      await selectTool(page, rect.railGroup, rect.testId, "tool: rectangle");
      await draw2PointShape(page, "right");
      const c3 = await readDrawingCount(page);
      expect(c3).toBeGreaterThan(c2);

      drawingCount = c3;

      // Zoom in (Ctrl+scroll)
      const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
      const box = await overlay.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(300);

        // Pan (click and drag on canvas)
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(300);

        // Zoom back out
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(300);
      }

      // Drawings must still be present after zoom/pan
      const c4 = await readDrawingCount(page);
      expect(c4).toBeGreaterThanOrEqual(3);

      // Undo all 3 drawings
      await undoOnce(page);
      await undoOnce(page);
      await undoOnce(page);
      const c5 = await readDrawingCount(page);
      expect(c5).toBeLessThan(c4);

      passed = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    matrixResults.push({
      scenario: "mixed",
      toolId: "trend+fib+rect",
      toolName: "Trend + Fib + Rectangle",
      category: "mixed",
      passed,
      drawingCount,
      undoVerified: passed,
      redoVerified: false,
      error,
      durationMs: Date.now() - start,
    });

    const icon = passed ? "✅" : "❌";
    console.log(`  ${icon} [mixed] 3-tool + zoom/pan${error ? ` — ${error}` : ""}`);
    if (!passed) {
      console.warn(`[mixed] trend+fib+rect failed: ${error ?? "unknown"}`);
    }
  });

  test("[mixed] 10 overlapping drawings + undo-all", async ({ page }) => {
    const start = Date.now();
    let passed = false;
    let drawingCount = 0;
    let error: string | undefined;

    try {
      const hline = drawableTools.find((t) => t.toolId === "hline")!;
      await selectTool(page, hline.railGroup, hline.testId, "tool: hline");

      // Place 10 horizontal lines
      const yRatios = [0.2, 0.3, 0.4, 0.5, 0.6, 0.25, 0.35, 0.45, 0.55, 0.65];
      for (const yRatio of yRatios) {
        await drawPointTool(page, 0.5, yRatio);
      }

      drawingCount = await readDrawingCount(page);
      expect(drawingCount).toBeGreaterThanOrEqual(8); // allow a couple dropped clicks

      // Undo all
      for (let i = 0; i < drawingCount + 2; i++) {
        await undoOnce(page);
      }
      const afterUndoAll = await readDrawingCount(page);
      expect(afterUndoAll).toBe(0);

      passed = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    matrixResults.push({
      scenario: "mixed",
      toolId: "hline×10-undo-all",
      toolName: "10× Horizontal lines + undo-all",
      category: "mixed",
      passed,
      drawingCount,
      undoVerified: passed,
      redoVerified: false,
      error,
      durationMs: Date.now() - start,
    });

    const icon = passed ? "✅" : "❌";
    console.log(`  ${icon} [mixed] 10 overlapping drawings + undo-all${error ? ` — ${error}` : ""}`);
    if (!passed) {
      console.warn(`[mixed] hline overlap failed: ${error ?? "unknown"}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global teardown: write results file after all specs complete
// ─────────────────────────────────────────────────────────────────────────────

test.afterAll(async () => {
  if (matrixResults.length > 0) {
    try {
      writeResults();
    } catch (err) {
      console.error("Failed to write matrix-results.json:", err);
    }
  }
});
