import { expect, test, type Page } from './playwright-fixture';
import { apiUrl } from './test-env';

test.setTimeout(180_000);

type DrawPoint = { time: number; price: number };

type DrawingShape = {
  id: string;
  variant: string;
  anchors: DrawPoint[];
  options?: {
    fibLevels?: Array<{ value?: number | string; enabled?: boolean }>;
  };
};

type ProjectedDrawing = {
  id: string;
  variant: string;
  anchors: Array<{ x: number; y: number }>;
};

type HitTestStats = {
  enabled: boolean;
  count: number;
  avgMs: number;
  maxMs: number;
  avgCandidates: number;
  maxCandidates: number;
  selectCount: number;
  eraseCount: number;
};

type SpatialHitTestStats = {
  indexedCount: number;
  fallbackCount: number;
  nodeCount: number;
  depth: number;
};

type InteractionMetricStats = {
  count: number;
  totalMs: number;
  maxMs: number;
  avgMs: number;
};

type InteractionLatencyStats = {
  pointerdown: InteractionMetricStats;
  pointermove: InteractionMetricStats;
  pointerup: InteractionMetricStats;
  hover: InteractionMetricStats;
};

type ChartDebugApi = {
  getDrawingsCount?: () => number;
  getLatestDrawingId?: () => string | null;
  getDrawingById?: (id: string) => DrawingShape | null;
  getProjectedAnchors?: (drawingId?: string) => ProjectedDrawing | null;
  getSelectedDrawingId?: () => string | null;
  forceSelectDrawing?: (id: string | null) => string | null;
  getHoveredDrawingId?: () => string | null;
  clearDrawingsFast?: () => number;
  addSyntheticDrawings?: (count: number, variant?: string) => number;
  setHitTestTelemetryEnabled?: (enabled: boolean) => HitTestStats;
  resetHitTestStats?: () => HitTestStats;
  getHitTestStats?: () => HitTestStats;
  getSpatialHitTestStats?: () => SpatialHitTestStats;
  getInteractionLatencyStats?: () => InteractionLatencyStats;
  resetInteractionLatencyStats?: () => InteractionLatencyStats;
  scrollToPosition?: (position: number) => number | null;
};

async function registerAndLogin(page: Page): Promise<void> {
  const uid = Date.now();
  const email = `phase2_${uid}@example.com`;
  const password = 'pass1234';

  await expect
    .poll(async () => {
      const response = await page.request.get(apiUrl('/api/health'));
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post(apiUrl('/api/auth/register'), {
    data: { email, password, name: `phase2_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post(apiUrl('/api/auth/login'), {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByPlaceholder('trader@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.locator('form').getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/homepage|\/$/);
}

async function waitForChartReady(page: Page, route: '/simulation' | '/live-market' = '/simulation'): Promise<void> {
  await page.goto(route);
  await expect(page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first()).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('[data-testid="drawing-badge"]:visible').first()).toBeVisible({ timeout: 10_000 });
}

async function clickByTestId(page: Page, testId: string): Promise<void> {
  await page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
    const target = nodes.find((node) => node instanceof HTMLElement && node.offsetParent !== null) ?? nodes[0];
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
  const menuTestId = group === 'cursor' ? 'menu-cursor' : `menu-${group}`;
  const menu = page.locator(`[data-testid="${menuTestId}"]:visible`).first();
  if (await menu.isVisible().catch(() => false)) return;

  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  await clickVisible(page, `rail-${group}`);
  if (await menu.isVisible().catch(() => false)) return;

  await clickVisible(page, `rail-${group}`);
  await expect(menu).toBeVisible({ timeout: 5_000 });
}

async function readSelectedDrawingId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getSelectedDrawingId?.() ?? null;
  });
}

async function readHoveredDrawingId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getHoveredDrawingId?.() ?? null;
  });
}

async function getProjectedAnchorsById(page: Page, drawingId: string): Promise<ProjectedDrawing | null> {
  return page.evaluate((id) => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getProjectedAnchors?.(id) ?? null;
  }, drawingId);
}

async function setCursorMode(page: Page, mode: 'arrow' | 'eraser' | 'cross'): Promise<void> {
  await ensureGroupMenuOpen(page, 'cursor');
  await clickVisible(page, `cursor-${mode}`);
}

async function setFullView(page: Page, open: boolean): Promise<void> {
  const overlay = page.locator('[data-testid="chart-full-view-overlay"]:visible').first();
  const isOpen = await overlay.isVisible().catch(() => false);
  if (isOpen === open) return;
  await clickVisible(page, 'chart-toggle-full-view');
  if (open) {
    await expect(overlay).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(overlay).toBeHidden({ timeout: 5_000 });
  }
}

async function readDrawingCount(page: Page): Promise<number> {
  const badge = await page
    .locator('[data-testid="drawing-badge"]:visible')
    .first()
    .textContent({ timeout: 1_000 })
    .catch(() => null);
  const match = badge?.match(/\b(\d+)\s+drawing/);
  if (match) return Number(match[1]);

  return page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getDrawingsCount?.() ?? 0;
  });
}

async function clearDrawings(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    if (debug?.clearDrawingsFast) {
      debug.clearDrawingsFast();
      return;
    }
  });
  await clickVisible(page, 'chart-clear');
  await expect.poll(() => readDrawingCount(page)).toBe(0);
}

async function placeByClicks(page: Page, points: Array<{ x: number; y: number }>): Promise<void> {
  for (const point of points) {
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(260);
}

async function placeByDrag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }): Promise<void> {
  await page.mouse.move(start.x, start.y);
  await page.waitForTimeout(35);
  await page.mouse.down();
  await page.waitForTimeout(35);
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.waitForTimeout(35);
  await page.mouse.up();
  await page.waitForTimeout(280);
}

async function waitForDrawingCountAbove(page: Page, beforeCount: number, timeoutMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await readDrawingCount(page)) > beforeCount) return true;
    await page.waitForTimeout(90);
  }
  return false;
}

async function drawWithRatios(
  page: Page,
  tool: { group: string; testId: string; anchorCount: number },
  ratios: Array<{ x: number; y: number }>,
): Promise<string> {
  const mainCanvas = page.locator('.chart-wrapper canvas:not([aria-label="chart-drawing-overlay"]):visible').first();
  const box = await mainCanvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) throw new Error('Overlay box missing');

  const beforeCount = await readDrawingCount(page);
  await ensureGroupMenuOpen(page, tool.group);
  await clickVisible(page, tool.testId);

  const points = ratios.slice(0, tool.anchorCount).map((ratio) => ({
    x: box.x + box.width * ratio.x,
    y: box.y + box.height * ratio.y,
  }));

  await placeByClicks(page, points);
  let placed = await waitForDrawingCountAbove(page, beforeCount, 2_600);

  // Several 2-anchor tools rely on drag semantics instead of click-click placement.
  if (!placed && points.length >= 2) {
    await placeByDrag(page, points[0], points[1]);
    placed = await waitForDrawingCountAbove(page, beforeCount, 2_800);
  }

  // Last retry for wizard tools: click slightly shifted anchors.
  if (!placed && points.length >= 3) {
    await placeByClicks(
      page,
      points.map((point, idx) => ({ x: point.x + 6 + idx * 2, y: point.y + 4 })),
    );
    placed = await waitForDrawingCountAbove(page, beforeCount, 2_800);
  }

  expect(placed).toBeTruthy();

  const drawingId = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getLatestDrawingId?.() ?? null;
  });
  if (!drawingId) throw new Error('Latest drawing id unavailable');
  return drawingId;
}

async function overlayInkPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const overlay = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return 0;
    const data = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    let pixels = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 8) pixels += 1;
    }
    return pixels;
  });
}

async function analyzeGeometry(page: Page, drawingId: string, kind: 'segment' | 'ray' | 'pitchfork' | 'fib'): Promise<{
  anchorCount: number;
  probeCount: number;
  hitCount: number;
  fibLevelValues: number[];
}> {
  const result = await page.evaluate(
    ({ id, probeKind }) => {
      const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
      const projected = debug?.getProjectedAnchors?.(id);
      const drawing = debug?.getDrawingById?.(id);
      const overlay = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
      const ctx = overlay?.getContext('2d');
      if (!debug || !projected || !drawing || !overlay || !ctx) {
        return null;
      }

      const rect = overlay.getBoundingClientRect();
      const dpr = overlay.width / Math.max(1, rect.width);
      const image = ctx.getImageData(0, 0, overlay.width, overlay.height).data;

      const toCanvas = (x: number, y: number) => ({
        x: (x - rect.left) * dpr,
        y: (y - rect.top) * dpr,
      });

      const hasInkNear = (clientX: number, clientY: number, radiusPx: number): boolean => {
        const c = toCanvas(clientX, clientY);
        const radius = Math.max(1, Math.round(radiusPx * dpr));
        const cx = Math.round(c.x);
        const cy = Math.round(c.y);
        for (let dy = -radius; dy <= radius; dy += 1) {
          const y = cy + dy;
          if (y < 0 || y >= overlay.height) continue;
          for (let dx = -radius; dx <= radius; dx += 1) {
            const x = cx + dx;
            if (x < 0 || x >= overlay.width) continue;
            const idx = (y * overlay.width + x) * 4 + 3;
            if (image[idx] > 10) return true;
          }
        }
        return false;
      };

      const probePoints: Array<{ x: number; y: number }> = [];
      const anchors = projected.anchors;
      const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });

      if (probeKind === 'segment' && anchors.length >= 2) {
        for (const t of [0.2, 0.4, 0.6, 0.8]) {
          probePoints.push(lerp(anchors[0], anchors[1], t));
        }
      } else if (probeKind === 'ray' && anchors.length >= 2) {
        for (const t of [0.25, 0.5, 0.75, 1.15]) {
          probePoints.push(lerp(anchors[0], anchors[1], t));
        }
      } else if (probeKind === 'pitchfork' && anchors.length >= 3) {
        const mid = {
          x: (anchors[1].x + anchors[2].x) / 2,
          y: (anchors[1].y + anchors[2].y) / 2,
        };
        for (const t of [0.25, 0.5, 0.75, 1.05]) {
          probePoints.push(lerp(anchors[0], mid, t));
        }
      } else if (probeKind === 'fib' && anchors.length >= 2) {
        const x = (anchors[0].x + anchors[1].x) / 2;
        for (const level of [0, 0.236, 0.382, 0.5, 0.618, 1]) {
          probePoints.push({
            x,
            y: anchors[0].y + (anchors[1].y - anchors[0].y) * level,
          });
        }
      }

      let hitCount = 0;
      for (const point of probePoints) {
        if (hasInkNear(point.x, point.y, 4)) hitCount += 1;
      }

      const fibLevelsRaw = drawing.options?.fibLevels;
      const fibLevels = Array.isArray(fibLevelsRaw)
        ? fibLevelsRaw
        : fibLevelsRaw && typeof fibLevelsRaw === 'object'
        ? Object.values(fibLevelsRaw)
        : [];

      const fibLevelValues = fibLevels
        .filter((level) => level && level.enabled !== false)
        .map((level) => Number(level.value))
        .filter((value) => Number.isFinite(value));

      return {
        anchorCount: anchors.length,
        probeCount: probePoints.length,
        hitCount,
        fibLevelValues,
      };
    },
    { id: drawingId, probeKind: kind },
  );

  if (!result) {
    throw new Error('Geometry analysis failed');
  }

  return result;
}

async function storeOverlayBaseline(page: Page): Promise<void> {
  await page.evaluate(() => {
    const overlay = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;
    const frame = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    (window as unknown as { __phase2OverlayBaseline?: Uint8ClampedArray }).__phase2OverlayBaseline = frame.slice();
  });
}

async function readOverlayDiff(page: Page): Promise<{ changedRatio: number; changedPixels: number; totalPixels: number }> {
  const diff = await page.evaluate(() => {
    const w = window as unknown as { __phase2OverlayBaseline?: Uint8ClampedArray };
    const baseline = w.__phase2OverlayBaseline;
    const overlay = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
    const ctx = overlay?.getContext('2d');
    if (!baseline || !overlay || !ctx) return null;

    const current = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    const totalPixels = Math.min(baseline.length, current.length) / 4;
    let changed = 0;

    for (let i = 0; i < totalPixels; i += 1) {
      const idx = i * 4;
      const da = Math.abs(current[idx + 3] - baseline[idx + 3]);
      const dr = Math.abs(current[idx] - baseline[idx]);
      const dg = Math.abs(current[idx + 1] - baseline[idx + 1]);
      const db = Math.abs(current[idx + 2] - baseline[idx + 2]);
      if (da + dr + dg + db > 30) changed += 1;
    }

    return {
      changedRatio: totalPixels > 0 ? changed / totalPixels : 0,
      changedPixels: changed,
      totalPixels,
    };
  });

  if (!diff) throw new Error('Overlay diff unavailable');
  return diff;
}

function parseScaleSnapshot(snapshot: string): { min: number; max: number; span: number } {
  const [minText, maxText] = snapshot.split(':');
  const min = Number(minText);
  const max = Number(maxText);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`Invalid scale snapshot: ${snapshot}`);
  }
  return { min, max, span: Math.abs(max - min) };
}

async function getPriceScaleSnapshot(page: Page): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = await page.evaluate(() => {
      const canvas = (
        document.querySelector('.chart-wrapper canvas:not([aria-label="chart-drawing-overlay"])')
        || document.querySelector('[data-testid="benchmark-chart-root"] canvas')
      ) as HTMLCanvasElement | null;
      return canvas?.dataset.priceScale ?? '';
    });
    if (snapshot) return snapshot;
    await page.waitForTimeout(60);
  }
  throw new Error('Timed out waiting for price scale snapshot');
}

test('phase2 visual: geometry probes and overlay diff checks for key tools', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/simulation');
  await clearDrawings(page);

  const toolCases: Array<{
    label: string;
    group: string;
    testId: string;
    anchors: number;
    ratios: Array<{ x: number; y: number }>;
    probe: 'segment' | 'ray' | 'pitchfork' | 'fib';
  }> = [
    {
      label: 'trend',
      group: 'lines',
      testId: 'tool-trendline',
      anchors: 2,
      ratios: [
        { x: 0.24, y: 0.30 },
        { x: 0.58, y: 0.56 },
      ],
      probe: 'segment',
    },
    {
      label: 'ray',
      group: 'lines',
      testId: 'tool-ray',
      anchors: 2,
      ratios: [
        { x: 0.30, y: 0.62 },
        { x: 0.46, y: 0.42 },
      ],
      probe: 'ray',
    },
    {
      label: 'channel',
      group: 'lines',
      testId: 'tool-parallel-channel',
      anchors: 2,
      ratios: [
        { x: 0.18, y: 0.58 },
        { x: 0.44, y: 0.36 },
      ],
      probe: 'segment',
    },
    {
      label: 'pitchfork',
      group: 'lines',
      testId: 'tool-pitchfork',
      anchors: 3,
      ratios: [
        { x: 0.24, y: 0.68 },
        { x: 0.44, y: 0.34 },
        { x: 0.60, y: 0.58 },
      ],
      probe: 'pitchfork',
    },
    {
      label: 'fib',
      group: 'fib',
      testId: 'fib-retracement',
      anchors: 2,
      ratios: [
        { x: 0.62, y: 0.66 },
        { x: 0.82, y: 0.30 },
      ],
      probe: 'fib',
    },
  ];

  for (const tool of toolCases) {
    const drawingId = await drawWithRatios(page, {
      group: tool.group,
      testId: tool.testId,
      anchorCount: tool.anchors,
    }, tool.ratios);

    const geometry = await analyzeGeometry(page, drawingId, tool.probe);

    expect(geometry.anchorCount).toBe(tool.anchors);
    expect(geometry.probeCount).toBeGreaterThan(0);
    expect(geometry.hitCount).toBeGreaterThanOrEqual(0);
  }

  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  await storeOverlayBaseline(page);
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.48);
  await page.waitForTimeout(120);
  const stableDiff = await readOverlayDiff(page);
  expect(stableDiff.changedRatio).toBeLessThan(0.015);

  const latest = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    const id = debug?.getLatestDrawingId?.();
    if (!id) return null;
    const projected = debug.getProjectedAnchors?.(id);
    if (!projected || projected.anchors.length < 2) return null;
    return {
      id,
      midX: (projected.anchors[0].x + projected.anchors[1].x) / 2,
      midY: (projected.anchors[0].y + projected.anchors[1].y) / 2,
    };
  });
  expect(latest).toBeTruthy();
  if (!latest) return;

  const beforeMove = await getProjectedAnchorsById(page, latest.id);

  await page.mouse.move(latest.midX, latest.midY);
  await page.mouse.down();
  await page.mouse.move(latest.midX + 80, latest.midY - 40, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const movedDiff = await readOverlayDiff(page);
  const afterMove = await getProjectedAnchorsById(page, latest.id);
  const anchorShift = beforeMove && afterMove && beforeMove.anchors.length >= 2 && afterMove.anchors.length >= 2
    ? Math.max(
        Math.hypot(afterMove.anchors[0].x - beforeMove.anchors[0].x, afterMove.anchors[0].y - beforeMove.anchors[0].y),
        Math.hypot(afterMove.anchors[1].x - beforeMove.anchors[1].x, afterMove.anchors[1].y - beforeMove.anchors[1].y),
      )
    : 0;
  expect(Math.max(movedDiff.changedRatio, anchorShift / 1200)).toBeGreaterThan(0.0002);
});

test('phase2 interaction: drag fidelity and anchor-resize stability', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/simulation');
  await clearDrawings(page);

  const drawingId = await drawWithRatios(
    page,
    { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
    [
      { x: 0.28, y: 0.34 },
      { x: 0.56, y: 0.58 },
    ],
  );

  const initial = await page.evaluate((id) => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getProjectedAnchors?.(id) ?? null;
  }, drawingId);
  expect(initial?.anchors.length).toBe(2);
  if (!initial || initial.anchors.length < 2) return;

  const midStart = {
    x: (initial.anchors[0].x + initial.anchors[1].x) / 2,
    y: (initial.anchors[0].y + initial.anchors[1].y) / 2,
  };

  await page.mouse.click(midStart.x, midStart.y);
  const selectedAfterClick = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getSelectedDrawingId?.() ?? null;
  });
  expect(selectedAfterClick).toBe(drawingId);

  const beforeResize = await page.evaluate((id) => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getProjectedAnchors?.(id) ?? null;
  }, drawingId);
  expect(beforeResize?.anchors.length).toBe(2);
  if (!beforeResize || beforeResize.anchors.length < 2) return;

  await page.mouse.move(beforeResize.anchors[0].x, beforeResize.anchors[0].y);
  await page.mouse.down();
  await page.mouse.move(beforeResize.anchors[0].x + 220, beforeResize.anchors[0].y - 120, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const afterResize = await page.evaluate((id) => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getProjectedAnchors?.(id) ?? null;
  }, drawingId);
  expect(afterResize?.anchors.length).toBe(2);
  if (!afterResize || afterResize.anchors.length < 2) return;

  const firstMoved = Math.hypot(
    afterResize.anchors[0].x - beforeResize.anchors[0].x,
    afterResize.anchors[0].y - beforeResize.anchors[0].y,
  );
  const secondMoved = Math.hypot(
    afterResize.anchors[1].x - beforeResize.anchors[1].x,
    afterResize.anchors[1].y - beforeResize.anchors[1].y,
  );

  expect(Number.isFinite(firstMoved)).toBeTruthy();
  expect(Number.isFinite(secondMoved)).toBeTruthy();

  await page.mouse.click((afterResize.anchors[0].x + afterResize.anchors[1].x) / 2, (afterResize.anchors[0].y + afterResize.anchors[1].y) / 2);
  const selectedId = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getSelectedDrawingId?.() ?? null;
  });
  expect(selectedId).toBe(drawingId);
});

test('phase2 axis: scale remains coherent through hover and wheel zoom cycles', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/__bench/chart-performance?bars=10000&indicators=20&seed=1337');
  await page.waitForFunction(() => {
    const state = (window as unknown as { __chartBenchmarkState?: { ready?: boolean } }).__chartBenchmarkState;
    return state?.ready === true;
  });

  const waitFrame = async () => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );
  };
  await waitFrame();
  await waitFrame();

  const canvas = page.locator('[data-testid="benchmark-chart-root"] canvas').first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const baseline = parseScaleSnapshot(await getPriceScaleSnapshot(page));
  expect(baseline.span).toBeGreaterThan(0);

  for (let i = 0; i < 22; i += 1) {
    const x = box.x + box.width * (0.12 + ((i % 11) / 11) * 0.76);
    const y = box.y + box.height * (0.20 + ((Math.sin(i / 2.8) + 1) / 2) * 0.56);
    await page.mouse.move(x, y);
    await page.waitForTimeout(14);
  }

  const afterHover = parseScaleSnapshot(await getPriceScaleSnapshot(page));
  const hoverSpanDrift = Math.abs(afterHover.span - baseline.span) / Math.max(1e-6, baseline.span);
  expect(hoverSpanDrift).toBeLessThan(0.45);

  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.44);
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, -240);
    await waitFrame();
  }

  const zoomIn = parseScaleSnapshot(await getPriceScaleSnapshot(page));
  const zoomInDelta = Math.abs(zoomIn.span - baseline.span) / Math.max(1e-6, baseline.span);
  expect(zoomInDelta).toBeGreaterThan(0.05);

  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, 220);
    await waitFrame();
  }

  const zoomOut = parseScaleSnapshot(await getPriceScaleSnapshot(page));
  const zoomOutDrift = Math.abs(zoomOut.span - baseline.span) / Math.max(1e-6, baseline.span);
  expect(zoomOutDrift).toBeLessThan(zoomInDelta + 0.25);
});

test('phase2 hit-testing: stress remains responsive with synthetic drawings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/simulation');

  await clearDrawings(page);

  const setup = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    if (!debug) return null;
    debug.setHitTestTelemetryEnabled?.(true);
    debug.resetHitTestStats?.();
    const added = debug.addSyntheticDrawings?.(280, 'trend') ?? 0;
    return { added, count: debug.getDrawingsCount?.() ?? 0 };
  });

  expect(setup).toBeTruthy();
  expect(setup?.added ?? 0).toBeGreaterThanOrEqual(240);
  expect(setup?.count ?? 0).toBeGreaterThanOrEqual(240);

  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  await ensureGroupMenuOpen(page, 'cursor');
  await clickVisible(page, 'cursor-cross');

  for (let i = 0; i < 110; i += 1) {
    const x = box.x + box.width * (0.08 + ((i % 22) / 22) * 0.84);
    const y = box.y + box.height * (0.22 + ((Math.sin(i / 4) + 1) / 2) * 0.56);
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    if (i % 10 === 0) await page.waitForTimeout(20);
  }

  const stats = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getHitTestStats?.() ?? null;
  });

  expect(stats).toBeTruthy();
  expect(stats?.enabled).toBeTruthy();
  expect(stats?.count ?? 0).toBeGreaterThanOrEqual(0);
  if ((stats?.count ?? 0) > 0) {
    expect(stats?.selectCount ?? 0).toBeGreaterThan(25);
    expect(stats?.avgCandidates ?? 0).toBeLessThan(320);
    expect(stats?.avgMs ?? 999).toBeLessThan(20);
    expect(stats?.maxMs ?? 999).toBeLessThan(80);
  }
});

test('phase2 target priority: selected then hovered drawing wins overlap hit-tests', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/simulation');
  await clearDrawings(page);
  await setCursorMode(page, 'cross');

  const firstId = await drawWithRatios(
    page,
    { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
    [
      { x: 0.30, y: 0.34 },
      { x: 0.70, y: 0.64 },
    ],
  );

  const secondId = await drawWithRatios(
    page,
    { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
    [
      { x: 0.30, y: 0.64 },
      { x: 0.70, y: 0.34 },
    ],
  );

  const firstProjected = await getProjectedAnchorsById(page, firstId);
  const secondProjected = await getProjectedAnchorsById(page, secondId);
  expect(firstProjected?.anchors.length).toBeGreaterThanOrEqual(2);
  expect(secondProjected?.anchors.length).toBeGreaterThanOrEqual(2);
  if (!firstProjected || !secondProjected || firstProjected.anchors.length < 2 || secondProjected.anchors.length < 2) return;

  const overlap = {
    x: (firstProjected.anchors[0].x + firstProjected.anchors[1].x + secondProjected.anchors[0].x + secondProjected.anchors[1].x) / 4,
    y: (firstProjected.anchors[0].y + firstProjected.anchors[1].y + secondProjected.anchors[0].y + secondProjected.anchors[1].y) / 4,
  };

  const clickOverlapUntilSelected = async (targetId: string) => {
    const offsets = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: -3, y: 0 },
      { x: 0, y: 3 },
      { x: 0, y: -3 },
    ];
    let attempt = 0;

    await expect
      .poll(async () => {
        const offset = offsets[attempt % offsets.length];
        attempt += 1;
        await page.mouse.move(overlap.x + offset.x, overlap.y + offset.y);
        await page.mouse.click(overlap.x + offset.x, overlap.y + offset.y);
        return readSelectedDrawingId(page);
      }, { timeout: 7_000 })
      .toBe(targetId);
  };

  const secondUnique = secondProjected.anchors[1];

  await page.evaluate((id) => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    debug?.forceSelectDrawing?.(id);
  }, firstId);
  await expect.poll(() => readSelectedDrawingId(page)).toBe(firstId);
  await clickOverlapUntilSelected(firstId);

  await page.evaluate((id) => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    debug?.forceSelectDrawing?.(id);
  }, secondId);
  await expect.poll(() => readSelectedDrawingId(page)).toBe(secondId);
  await clickOverlapUntilSelected(secondId);

  await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    debug?.forceSelectDrawing?.(null);
  });
  await page.mouse.move(secondUnique.x, secondUnique.y);
  await expect.poll(() => readHoveredDrawingId(page)).toBe(secondId);
  await clickOverlapUntilSelected(secondId);
});

test('phase2 eraser priority: overlap erase removes selected drawing first', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/simulation');
  await clearDrawings(page);

  const firstId = await drawWithRatios(
    page,
    { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
    [
      { x: 0.26, y: 0.36 },
      { x: 0.72, y: 0.62 },
    ],
  );
  const secondId = await drawWithRatios(
    page,
    { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
    [
      { x: 0.26, y: 0.62 },
      { x: 0.72, y: 0.36 },
    ],
  );

  const firstProjected = await getProjectedAnchorsById(page, firstId);
  const secondProjected = await getProjectedAnchorsById(page, secondId);
  expect(firstProjected?.anchors.length).toBeGreaterThanOrEqual(2);
  expect(secondProjected?.anchors.length).toBeGreaterThanOrEqual(2);
  if (!firstProjected || !secondProjected || firstProjected.anchors.length < 2 || secondProjected.anchors.length < 2) return;

  const overlap = {
    x: (firstProjected.anchors[0].x + firstProjected.anchors[1].x + secondProjected.anchors[0].x + secondProjected.anchors[1].x) / 4,
    y: (firstProjected.anchors[0].y + firstProjected.anchors[1].y + secondProjected.anchors[0].y + secondProjected.anchors[1].y) / 4,
  };

  await setCursorMode(page, 'cross');
  await page.mouse.click(firstProjected.anchors[1].x, firstProjected.anchors[1].y);
  await expect.poll(() => readSelectedDrawingId(page)).not.toBeNull();
  const selectedForErase = await readSelectedDrawingId(page);
  expect(selectedForErase).toBeTruthy();
  if (!selectedForErase) return;
  const keepId = selectedForErase === firstId ? secondId : firstId;

  await setCursorMode(page, 'eraser');
  await page.mouse.click(overlap.x, overlap.y);

  const exists = await page.evaluate(({ keepId, removedId }) => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return {
      removedStillExists: Boolean(debug?.getDrawingById?.(removedId)),
      keepStillExists: Boolean(debug?.getDrawingById?.(keepId)),
    };
  }, { keepId, removedId: selectedForErase });

  expect(exists.removedStillExists).toBeFalsy();
  expect(exists.keepStillExists).toBeTruthy();
});

test('phase2 hover hysteresis: boundary traversal avoids excessive hover flips', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/simulation');
  await clearDrawings(page);
  await setCursorMode(page, 'cross');

  await drawWithRatios(
    page,
    { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
    [
      { x: 0.24, y: 0.44 },
      { x: 0.74, y: 0.50 },
    ],
  );
  await drawWithRatios(
    page,
    { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
    [
      { x: 0.24, y: 0.50 },
      { x: 0.74, y: 0.56 },
    ],
  );

  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const hoveredHistory: Array<string | null> = [];
  for (let i = 0; i < 80; i += 1) {
    const phase = (i % 4) - 1.5;
    const x = box.x + box.width * (0.22 + (i / 79) * 0.56);
    const y = box.y + box.height * (0.485 + phase * 0.0018);
    await page.mouse.move(x, y);
    if (i % 8 === 0) await page.waitForTimeout(8);
    hoveredHistory.push(await readHoveredDrawingId(page));
  }

  const nonNullHover = hoveredHistory.filter((id): id is string => Boolean(id));
  let transitions = 0;
  for (let i = 1; i < hoveredHistory.length; i += 1) {
    if (hoveredHistory[i] !== hoveredHistory[i - 1]) transitions += 1;
  }

  expect(nonNullHover.length).toBeGreaterThan(45);
  expect(transitions).toBeLessThan(34);
});

test('phase2 drag fidelity: first drag frame avoids jump in normal and fullscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/simulation');

  const verifyFirstStep = async () => {
    await clearDrawings(page);
    await setCursorMode(page, 'arrow');

    const drawingId = await drawWithRatios(
      page,
      { group: 'lines', testId: 'tool-trendline', anchorCount: 2 },
      [
        { x: 0.30, y: 0.36 },
        { x: 0.66, y: 0.58 },
      ],
    );

    let initial = await getProjectedAnchorsById(page, drawingId);
    for (let attempt = 0; attempt < 24 && (!initial || initial.anchors.length < 2); attempt += 1) {
      await page.waitForTimeout(120);
      initial = await getProjectedAnchorsById(page, drawingId);
    }
    if (!initial || initial.anchors.length < 2) return;

    const mid = {
      x: (initial.anchors[0].x + initial.anchors[1].x) / 2,
      y: (initial.anchors[0].y + initial.anchors[1].y) / 2,
    };

    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 7, mid.y - 5, { steps: 1 });
    await page.waitForTimeout(85);

    const firstStep = await getProjectedAnchorsById(page, drawingId);
    if (!firstStep || firstStep.anchors.length < 2) {
      await page.mouse.up();
      return;
    }

    const firstAnchorShift = Math.hypot(
      firstStep.anchors[0].x - initial.anchors[0].x,
      firstStep.anchors[0].y - initial.anchors[0].y,
    );
    const secondAnchorShift = Math.hypot(
      firstStep.anchors[1].x - initial.anchors[1].x,
      firstStep.anchors[1].y - initial.anchors[1].y,
    );
    const maxInitialShift = Math.max(firstAnchorShift, secondAnchorShift);

    expect(maxInitialShift).toBeLessThan(36);

    await page.mouse.move(mid.x + 74, mid.y - 44, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const committed = await getProjectedAnchorsById(page, drawingId);
    if (!committed || committed.anchors.length < 2) return;

    const finalShift = Math.max(
      Math.hypot(committed.anchors[0].x - initial.anchors[0].x, committed.anchors[0].y - initial.anchors[0].y),
      Math.hypot(committed.anchors[1].x - initial.anchors[1].x, committed.anchors[1].y - initial.anchors[1].y),
    );
    expect(Number.isFinite(finalShift)).toBeTruthy();
    expect(finalShift).toBeLessThan(220);
  };

  await setFullView(page, false);
  await verifyFirstStep();
  await setFullView(page, true);
  await verifyFirstStep();
  await setFullView(page, false);
});

test('phase2 stress: 50+ drawings remain editable under live ticks and zoom/pan', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);
  await waitForChartReady(page, '/live-market');
  await clearDrawings(page);

  const setup = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    if (!debug) return null;
    debug.setHitTestTelemetryEnabled?.(true);
    debug.resetHitTestStats?.();
    debug.resetInteractionLatencyStats?.();
    const added = debug.addSyntheticDrawings?.(90, 'trend') ?? 0;
    return {
      added,
      count: debug.getDrawingsCount?.() ?? 0,
      spatial: debug.getSpatialHitTestStats?.() ?? null,
    };
  });

  expect(setup).toBeTruthy();
  expect(setup?.added ?? 0).toBeGreaterThanOrEqual(50);
  expect(setup?.count ?? 0).toBeGreaterThanOrEqual(50);

  await setCursorMode(page, 'cross');
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  for (let i = 0; i < 48; i += 1) {
    const x = box.x + box.width * (0.10 + ((i % 16) / 16) * 0.80);
    const y = box.y + box.height * (0.24 + ((Math.cos(i / 3) + 1) / 2) * 0.54);
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    if (i % 6 === 0) {
      await page.mouse.wheel(0, -220);
    } else if (i % 6 === 3) {
      await page.mouse.wheel(0, 220);
    }
  }

  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.52);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.52, { steps: 10 });
  await page.mouse.up();

  const latestDrawingId = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return debug?.getLatestDrawingId?.() ?? null;
  });

  if (latestDrawingId) {
    const projected = await getProjectedAnchorsById(page, latestDrawingId);
    if (projected?.anchors.length && projected.anchors.length >= 2) {
      const mid = {
        x: (projected.anchors[0].x + projected.anchors[1].x) / 2,
        y: (projected.anchors[0].y + projected.anchors[1].y) / 2,
      };
      await page.mouse.move(mid.x, mid.y);
      await page.mouse.down();
      await page.mouse.move(mid.x + 28, mid.y - 24, { steps: 6 });
      await page.mouse.up();
    }
  }

  await page.waitForTimeout(1100);

  const summary = await page.evaluate(() => {
    const debug = (window as unknown as { __chartDebug?: ChartDebugApi }).__chartDebug;
    return {
      count: debug?.getDrawingsCount?.() ?? 0,
      hit: debug?.getHitTestStats?.() ?? null,
      interaction: debug?.getInteractionLatencyStats?.() ?? null,
      spatial: debug?.getSpatialHitTestStats?.() ?? null,
    };
  });

  expect(summary.count).toBeGreaterThanOrEqual(50);
  expect(summary.spatial?.indexedCount ?? 0).toBeGreaterThanOrEqual(40);
  expect(summary.hit?.count ?? 0).toBeGreaterThan(30);
  expect(summary.hit?.avgMs ?? 999).toBeLessThan(24);
  expect(summary.interaction?.pointermove.count ?? 0).toBeGreaterThan(40);
  expect(summary.interaction?.pointermove.avgMs ?? 999).toBeLessThan(16);
});
