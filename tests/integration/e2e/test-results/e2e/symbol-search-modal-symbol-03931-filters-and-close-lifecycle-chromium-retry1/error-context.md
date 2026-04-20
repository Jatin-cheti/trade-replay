# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: symbol-search-modal.spec.ts >> symbol search modal supports all categories, filters, and close lifecycle
- Location: tests\integration\e2e\symbol-search-modal.spec.ts:104:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Portfolio Builder').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('Portfolio Builder').first()

```

# Test source

```ts
  9   | }
  10  | 
  11  | async function captureScreenshot(page: Parameters<typeof test>[0]["page"], browserName: string, label: string) {
  12  |   const browserDir = path.join(ARTIFACT_ROOT, browserName);
  13  |   ensureDir(browserDir);
  14  |   const sanitizedLabel = label.replace(/[^a-zA-Z0-9-_]/g, "_");
  15  |   await page.screenshot({ path: path.join(browserDir, `${sanitizedLabel}.png`), fullPage: true });
  16  | }
  17  | 
  18  | function writeJsonReport(browserName: string, fileName: string, data: unknown) {
  19  |   const browserDir = path.join(ARTIFACT_ROOT, browserName);
  20  |   ensureDir(browserDir);
  21  |   fs.writeFileSync(path.join(browserDir, fileName), JSON.stringify(data, null, 2));
  22  | }
  23  | 
  24  | async function registerAndLogin(page: Parameters<typeof test>[0]["page"]): Promise<void> {
  25  |   const uid = Date.now();
  26  |   const email = `modal_parity_${uid}@example.com`;
  27  |   const password = "pass1234";
  28  | 
  29  |   await expect
  30  |     .poll(async () => {
  31  |       const response = await page.request.get("http://127.0.0.1:4000/api/health");
  32  |       return response.status();
  33  |     })
  34  |     .toBe(200);
  35  | 
  36  |   const registerResponse = await page.request.post("http://127.0.0.1:4000/api/auth/register", {
  37  |     data: { email, password, name: `modal_parity_${uid}` },
  38  |   });
  39  | 
  40  |   const authResponse = registerResponse.ok()
  41  |     ? registerResponse
  42  |     : await page.request.post("http://127.0.0.1:4000/api/auth/login", {
  43  |         data: { email, password },
  44  |       });
  45  | 
  46  |   expect(authResponse.ok()).toBeTruthy();
  47  | 
  48  |   await page.goto("/login");
  49  |   await page.getByPlaceholder("trader@example.com").fill(email);
  50  |   await page.getByPlaceholder("••••••••").fill(password);
  51  |   await page.locator("form").getByRole("button", { name: "Login" }).click();
  52  |   await expect(page).toHaveURL(/homepage|\/$/);
  53  | }
  54  | 
  55  | async function getVisibleCategoryIds(page: Parameters<typeof test>[0]["page"]) {
  56  |   return page.locator('[data-testid^="symbol-category-"]').evaluateAll((nodes) =>
  57  |     nodes.map((node) => node.getAttribute("data-testid") ?? "").filter(Boolean),
  58  |   );
  59  | }
  60  | 
  61  | async function collectFilterMetadata(page: Parameters<typeof test>[0]["page"]) {
  62  |   const filterLocator = page.locator('[data-testid^="symbol-filter-"]');
  63  |   const filterCount = await filterLocator.count();
  64  |   const filters: Array<{ testId: string; label: string; optionsCount: number; optionValues: string[] }> = [];
  65  | 
  66  |   for (let index = 0; index < filterCount; index += 1) {
  67  |     const filter = filterLocator.nth(index);
  68  |     const testId = (await filter.getAttribute("data-testid")) ?? "";
  69  |     const label = (await filter.innerText()).trim();
  70  | 
  71  |     await filter.click();
  72  |     await page.waitForTimeout(100);
  73  | 
  74  |     if (testId.endsWith("-modal")) {
  75  |       const modalOptions = page.locator('[data-testid="symbol-modal-option"]');
  76  |       const optionsCount = await modalOptions.count();
  77  |       const optionValues = await modalOptions.evaluateAll((nodes) =>
  78  |         nodes.map((node) => (node as HTMLElement).getAttribute("data-option") ?? "").filter(Boolean),
  79  |       );
  80  | 
  81  |       const backButton = page.getByRole("button", { name: "Back" }).first();
  82  |       if (await backButton.isVisible().catch(() => false)) {
  83  |         await backButton.click();
  84  |       }
  85  | 
  86  |       filters.push({ testId, label, optionsCount, optionValues });
  87  |     } else {
  88  |       const popover = page.locator('div[data-state="open"]').first();
  89  |       await expect(popover).toBeVisible({ timeout: 3000 });
  90  |       const menuOptions = popover.locator("button");
  91  |       const optionsCount = await menuOptions.count();
  92  |       const optionValues = await menuOptions.evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").trim()).filter(Boolean));
  93  |       await page.keyboard.press("Escape");
  94  | 
  95  |       filters.push({ testId, label, optionsCount, optionValues });
  96  |     }
  97  | 
  98  |     await page.waitForTimeout(100);
  99  |   }
  100 | 
  101 |   return filters;
  102 | }
  103 | 
  104 | test("symbol search modal supports all categories, filters, and close lifecycle", async ({ page, browserName }) => {
  105 |   test.setTimeout(180_000);
  106 |   await registerAndLogin(page);
  107 | 
  108 |   await page.goto("/portfolio/create");
> 109 |   await expect(page.getByText("Portfolio Builder").first()).toBeVisible({ timeout: 15000 });
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  110 | 
  111 |   const portfolioSearchTrigger = page.getByTestId("asset-search-trigger").first();
  112 |   const openStart = Date.now();
  113 |   await portfolioSearchTrigger.click();
  114 |   await expect(page.getByTestId("symbol-search-modal")).toBeVisible();
  115 |   const modalOpenMs = Date.now() - openStart;
  116 | 
  117 |   await captureScreenshot(page, browserName, "symbol-search-modal-open");
  118 | 
  119 |   const categoryIds = await getVisibleCategoryIds(page);
  120 |   expect(categoryIds).toEqual([
  121 |     "symbol-category-all",
  122 |     "symbol-category-stocks",
  123 |     "symbol-category-funds",
  124 |     "symbol-category-futures",
  125 |     "symbol-category-forex",
  126 |     "symbol-category-crypto",
  127 |     "symbol-category-indices",
  128 |     "symbol-category-bonds",
  129 |     "symbol-category-economy",
  130 |     "symbol-category-options",
  131 |   ]);
  132 | 
  133 |   const parityReport: Record<string, unknown> = {
  134 |     browserName,
  135 |     modalOpenMs,
  136 |     categoryIds,
  137 |     categories: [],
  138 |     createdAt: new Date().toISOString(),
  139 |   };
  140 | 
  141 |   for (const categoryId of categoryIds) {
  142 |     const categoryKey = categoryId.replace("symbol-category-", "");
  143 |     await page.getByTestId(categoryId).click();
  144 |     await page.waitForTimeout(500);
  145 |     await captureScreenshot(page, browserName, `category-${categoryKey}`);
  146 | 
  147 |     const filters = await collectFilterMetadata(page);
  148 |     parityReport.categories.push({ category: categoryKey, filterCount: filters.length, filters });
  149 |   }
  150 | 
  151 |   await page.keyboard.press("Escape");
  152 |   await expect(page.getByTestId("symbol-search-modal")).toHaveAttribute("data-state", "closed");
  153 | 
  154 |   const performanceMetrics = await page.evaluate(() => {
  155 |     const longTasks = performance.getEntriesByType("longtask").map((entry) => ({ startTime: entry.startTime, duration: entry.duration }));
  156 |     const paints = performance.getEntriesByType("paint").map((entry) => ({ name: entry.name, startTime: entry.startTime }));
  157 |     return {
  158 |       longTasks,
  159 |       paints,
  160 |       memory: (performance as any).memory ? { usedJSHeapSize: (performance as any).memory.usedJSHeapSize, totalJSHeapSize: (performance as any).memory.totalJSHeapSize } : null,
  161 |     };
  162 |   });
  163 | 
  164 |   writeJsonReport(browserName, "symbol-search-parity.json", { ...parityReport, performanceMetrics });
  165 | });
  166 | 
```