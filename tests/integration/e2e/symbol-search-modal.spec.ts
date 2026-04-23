import fs from "fs";
import path from "path";
import { expect, test } from "./playwright-fixture";

const ARTIFACT_ROOT = path.join(process.cwd(), "test-results", "symbol-search-parity");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function captureScreenshot(page: Parameters<typeof test>[0]["page"], browserName: string, label: string) {
  const browserDir = path.join(ARTIFACT_ROOT, browserName);
  ensureDir(browserDir);
  const sanitizedLabel = label.replace(/[^a-zA-Z0-9-_]/g, "_");
  await page.screenshot({ path: path.join(browserDir, `${sanitizedLabel}.png`), fullPage: true });
}

function writeJsonReport(browserName: string, fileName: string, data: unknown) {
  const browserDir = path.join(ARTIFACT_ROOT, browserName);
  ensureDir(browserDir);
  fs.writeFileSync(path.join(browserDir, fileName), JSON.stringify(data, null, 2));
}

async function registerAndLogin(page: Parameters<typeof test>[0]["page"]): Promise<void> {
  const uid = Date.now();
  const email = `modal_parity_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const response = await page.request.get(`${process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4100"}/api/health`);
      return response.status();
    })
    .toBe(200);

  const registerResponse = await page.request.post(`${process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4100"}/api/auth/register`, {
    data: { email, password, name: `modal_parity_${uid}` },
  });

  const authResponse = registerResponse.ok()
    ? registerResponse
    : await page.request.post(`${process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4100"}/api/auth/login`, {
        data: { email, password },
      });

  expect(authResponse.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);
}

async function getVisibleCategoryIds(page: Parameters<typeof test>[0]["page"]) {
  return page.locator('[data-testid^="symbol-category-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-testid") ?? "").filter(Boolean),
  );
}

async function collectFilterMetadata(page: Parameters<typeof test>[0]["page"]) {
  const filterLocator = page.locator('[data-testid^="symbol-filter-"]');
  const filterCount = await filterLocator.count();
  const filters: Array<{ testId: string; label: string; optionsCount: number; optionValues: string[] }> = [];

  for (let index = 0; index < filterCount; index += 1) {
    const filter = filterLocator.nth(index);
    const testId = (await filter.getAttribute("data-testid")) ?? "";
    const label = (await filter.innerText()).trim();

    await filter.click();
    await page.waitForTimeout(100);

    if (testId.endsWith("-modal")) {
      const modalOptions = page.locator('[data-testid="symbol-modal-option"]');
      const optionsCount = await modalOptions.count();
      const optionValues = await modalOptions.evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).getAttribute("data-option") ?? "").filter(Boolean),
      );

      const backButton = page.getByRole("button", { name: "Back" }).first();
      if (await backButton.isVisible().catch(() => false)) {
        await backButton.click();
      }

      filters.push({ testId, label, optionsCount, optionValues });
    } else {
      const popover = page.locator('div[data-state="open"]').first();
      await expect(popover).toBeVisible({ timeout: 3000 });
      const menuOptions = popover.locator("button");
      const optionsCount = await menuOptions.count();
      const optionValues = await menuOptions.evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").trim()).filter(Boolean));
      await page.keyboard.press("Escape");

      filters.push({ testId, label, optionsCount, optionValues });
    }

    await page.waitForTimeout(100);
  }

  return filters;
}

test("symbol search modal supports all categories, filters, and close lifecycle", async ({ page, browserName }) => {
  test.setTimeout(180_000);
  await registerAndLogin(page);

  await page.goto("/portfolio/create");
  await expect(page.getByText("Portfolio Builder").first()).toBeVisible({ timeout: 15000 });

  const portfolioSearchTrigger = page.getByTestId("asset-search-trigger").first();
  const openStart = Date.now();
  await portfolioSearchTrigger.click();
  await expect(page.getByTestId("symbol-search-modal")).toBeVisible();
  const modalOpenMs = Date.now() - openStart;

  await captureScreenshot(page, browserName, "symbol-search-modal-open");

  const categoryIds = await getVisibleCategoryIds(page);
  expect(categoryIds).toEqual([
    "symbol-category-all",
    "symbol-category-stocks",
    "symbol-category-funds",
    "symbol-category-futures",
    "symbol-category-forex",
    "symbol-category-crypto",
    "symbol-category-indices",
    "symbol-category-bonds",
    "symbol-category-economy",
    "symbol-category-options",
  ]);

  const parityReport: Record<string, unknown> = {
    browserName,
    modalOpenMs,
    categoryIds,
    categories: [],
    createdAt: new Date().toISOString(),
  };

  for (const categoryId of categoryIds) {
    const categoryKey = categoryId.replace("symbol-category-", "");
    await page.getByTestId(categoryId).click();
    await page.waitForTimeout(500);
    await captureScreenshot(page, browserName, `category-${categoryKey}`);

    const filters = await collectFilterMetadata(page);
    parityReport.categories.push({ category: categoryKey, filterCount: filters.length, filters });
  }

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("symbol-search-modal")).toHaveAttribute("data-state", "closed");

  const performanceMetrics = await page.evaluate(() => {
    const longTasks = performance.getEntriesByType("longtask").map((entry) => ({ startTime: entry.startTime, duration: entry.duration }));
    const paints = performance.getEntriesByType("paint").map((entry) => ({ name: entry.name, startTime: entry.startTime }));
    return {
      longTasks,
      paints,
      memory: (performance as any).memory ? { usedJSHeapSize: (performance as any).memory.usedJSHeapSize, totalJSHeapSize: (performance as any).memory.totalJSHeapSize } : null,
    };
  });

  writeJsonReport(browserName, "symbol-search-parity.json", { ...parityReport, performanceMetrics });
});
