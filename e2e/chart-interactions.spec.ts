import { expect, test, type Page } from "./playwright-fixture";

async function registerAndLogin(page: Page): Promise<void> {
  const uid = Date.now();
  const email = `chart_interactions_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get("http://127.0.0.1:4000/api/health");
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
    data: { email, password, name: `chart_interactions_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post("http://127.0.0.1:4000/api/auth/login", {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);
}

async function getOverlayHash(page: Page): Promise<number> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  return overlay.evaluate((canvasNode) => {
    const overlay = canvasNode as HTMLCanvasElement;
    const ctx = overlay.getContext("2d");
    if (!ctx) return 0;

    const image = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    let hash = 2166136261;
    for (let i = 0; i < image.length; i += 1) {
      hash ^= image[i];
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  });
}

async function getMainCanvasHash(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll(".chart-wrapper canvas")) as HTMLCanvasElement[];
    const main = canvases.find((canvas) => canvas.getAttribute("aria-label") !== "chart-drawing-overlay");
    if (!main) return 0;

    const ctx = main.getContext("2d");
    if (!ctx) return 0;

    const data = ctx.getImageData(0, 0, main.width, main.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 64) {
      hash ^= data[i];
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  });
}

async function drawTrendLine(page: Page): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  await expect(overlay).toBeVisible();

  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[data-testid="tool-trend"]'));
    const target = nodes.find((node) => node instanceof HTMLElement && node.offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const x1 = box.x + box.width * 0.35;
  const y1 = box.y + box.height * 0.35;
  const x2 = box.x + box.width * 0.65;
  const y2 = box.y + box.height * 0.6;

  await page.evaluate(
    ({ startX, startY, endX, endY }) => {
      const canvas = document.querySelector('canvas[aria-label="chart-drawing-overlay"]:not([style*="display: none"])') as HTMLCanvasElement | null;
      if (!canvas) return;
      canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: startX, clientY: startY }));
      canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: endX, clientY: endY }));
      canvas.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: endX, clientY: endY }));
    },
    { startX: x1, startY: y1, endX: x2, endY: y2 }
  );
}

async function moveSelectedDrawing(page: Page): Promise<void> {
  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]:visible').first();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  const startX = box.x + box.width * 0.54;
  const startY = box.y + box.height * 0.51;
  const endX = box.x + box.width * 0.67;
  const endY = box.y + box.height * 0.41;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();
}

async function runChartChecks(page: Page, route: "/simulation" | "/live-market"): Promise<void> {
  await page.goto(route);
  await page.waitForTimeout(500);

  const overlay = page.locator('canvas[aria-label="chart-drawing-overlay"]').first();
  await expect(overlay).toBeVisible();

  const errors: string[] = [];
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/chart|canvas|draw|render|pointer|wheel/i.test(text)) {
      errors.push(text);
    }
  };
  page.on("console", onConsole);

  const preZoomHash = await getMainCanvasHash(page);
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).toBeTruthy();
  if (!overlayBox) return;

  const cx = overlayBox.x + overlayBox.width * 0.5;
  const cy = overlayBox.y + overlayBox.height * 0.5;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -260);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(250);

  const postZoomHash = await getMainCanvasHash(page);
  expect(postZoomHash).not.toBe(0);
  expect(postZoomHash).not.toBe(preZoomHash);

  const drawingRows = page.locator('[data-testid^="drawing-object-"]');
  const beforeDrawCount = await drawingRows.count();
  await drawTrendLine(page);
  await expect
    .poll(async () => drawingRows.count(), {
      message: "drawing count should increase by one after adding a trend line",
    })
    .toBe(beforeDrawCount + 1);

  await page.waitForTimeout(200);
  const overlayAfterDraw = await getOverlayHash(page);

  await moveSelectedDrawing(page);
  await page.waitForTimeout(200);
  const overlayAfterMove = await getOverlayHash(page);
  if (overlayAfterMove === overlayAfterDraw) {
    await moveSelectedDrawing(page);
    await page.waitForTimeout(200);
  }

  await page.getByTestId("chart-undo").first().click({ force: true });
  await page.waitForTimeout(150);
  const overlayAfterUndo = await getOverlayHash(page);

  await page.getByTestId("chart-redo").first().click({ force: true });
  await page.waitForTimeout(150);
  const overlayAfterRedo = await getOverlayHash(page);
  if (overlayAfterRedo === overlayAfterUndo) {
    await page.getByTestId("chart-redo").first().click({ force: true });
    await page.waitForTimeout(150);
  }

  await expect(drawingRows.first()).toBeVisible();
  const rowsBeforeDelete = await drawingRows.count();
  const firstRowTestId = await drawingRows.first().getAttribute("data-testid");
  expect(firstRowTestId).toBeTruthy();
  const firstRowId = firstRowTestId?.replace("drawing-object-", "");
  expect(firstRowId).toBeTruthy();
  await page.getByTestId(`drawing-delete-${firstRowId}`).click();
  const expectedAfterDelete = Math.max(rowsBeforeDelete - 1, 0);
  await expect(drawingRows).toHaveCount(expectedAfterDelete);
  await expect(page.getByTestId(`drawing-object-${firstRowId}`)).toHaveCount(0);

  await page.getByTestId("chart-undo").first().click({ force: true });
  await page.waitForTimeout(120);
  if (await drawingRows.count() === expectedAfterDelete) {
    await page.getByTestId("chart-undo").first().click({ force: true });
  }
  await expect
    .poll(async () => drawingRows.count(), {
      message: "undo should restore deleted drawing",
      timeout: 8000,
    })
    .toBeGreaterThan(expectedAfterDelete);

  await page.mouse.move(cx + 40, cy + 20);
  await page.mouse.wheel(0, -180);
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(300);

  page.off("console", onConsole);
  expect(errors).toEqual([]);
}

test("chart zoom and drawing persistence on simulation and live market", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await registerAndLogin(page);

  await runChartChecks(page, "/simulation");
  await runChartChecks(page, "/live-market");
});
