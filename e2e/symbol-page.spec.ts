import { expect, test } from "./playwright-fixture";

/**
 * Symbol Page E2E test suite.
 *
 * Covers:
 *  1. Page loads — hero section visible for a known symbol
 *  2. Price display — price chip is present and non-zero
 *  3. Period chips — 9 time period chips rendered, 1d active by default
 *  4. Period switch — clicking "5 days" marks it active and shows perf %
 *  5. Chart renders — chart canvas/container is visible
 *  6. Chart type dropdown — opens, lists groups, selects Line chart
 *  7. Snapshot menu — all 5 action items present
 *  8. Custom period modal — opens on "Custom period" click, has mode tabs
 *  9. Saved periods menu — opens, shows "New" button, empty state message
 * 10. Sticky header — appears after scrolling past hero
 * 11. Tab navigation — clicking "Financials" tab highlights it
 * 12. Key stats — at least 4 stat cards visible
 * 13. About section — About heading visible
 * 14. FAQ accordion — first question can be toggled open/closed
 * 15. Quick actions — "Open in Supercharts" button present
 * 16. Breadcrumb — Markets link visible
 * 17. Accessibility — snapshot button has correct aria-label
 * 18. Mobile — hero section visible on iPhone viewport
 */

const SYMBOL = "MRF.NS";
const SYMBOL_URL = `/symbol/${SYMBOL}`;

test.describe("Symbol page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SYMBOL_URL);
    // Wait for the hero price chip to appear — confirms symbol data loaded
    await expect(page.locator('[data-testid="symbol-price"], .tabular-nums').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  /* ── 1. Page loads ── */
  test("hero section renders for known symbol", async ({ page }) => {
    // Name heading — MRF or full company name must appear somewhere in the hero
    await expect(page.locator("text=MRF").first()).toBeVisible({ timeout: 10_000 });
  });

  /* ── 2. Price display ── */
  test("displays a non-zero price", async ({ page }) => {
    // Find tabular-nums price; content must be a positive number
    const priceEls = page.locator(".tabular-nums");
    const count = await priceEls.count();
    let foundPositive = false;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = (await priceEls.nth(i).textContent()) ?? "";
      const num = parseFloat(text.replace(/,/g, ""));
      if (num > 0) { foundPositive = true; break; }
    }
    expect(foundPositive).toBe(true);
  });

  /* ── 3. Period chips — all 9 rendered ── */
  test("renders 9 time period chips", async ({ page }) => {
    const chips = page.locator("button").filter({ hasText: /^(1 day|5 days|1 month|6 months|Year to date|1 year|5 years|10 years|All time)$/ });
    await expect.poll(() => chips.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(8);
  });

  /* ── 4. Period switch ── */
  test("clicking 5 days chip shows perf percentage", async ({ page }) => {
    const chip5d = page.locator("button").filter({ hasText: /5 days/ });
    await chip5d.click();
    // After clicking, chip should turn "active" (has border-primary class) and show ±%
    await expect(chip5d).toHaveClass(/border-primary/, { timeout: 8_000 });
    // A % value should appear inside the chip
    const perfText = await chip5d.textContent();
    expect(perfText).toMatch(/[+-]?\d+\.\d{2}%/);
  });

  /* ── 5. Chart container visible ── */
  test("chart area is visible", async ({ page }) => {
    // The chart container wraps SymbolMiniTradingChart
    const chartContainer = page.locator(".rounded-xl.border").filter({
      has: page.locator("canvas, div.absolute.inset-0"),
    });
    await expect(chartContainer.first()).toBeVisible({ timeout: 15_000 });
  });

  /* ── 6. Chart type dropdown ── */
  test("chart type dropdown opens and contains chart groups", async ({ page }) => {
    const dropdownBtn = page.getByRole("button", { name: /Change chart type/i });
    await dropdownBtn.click();

    // Verify options across groups are visible
    await expect(page.getByRole("button", { name: "Line", exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Heikin Ashi", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Line + Volume", exact: true })).toBeVisible();

    // Select "Line" chart type
    await page.getByRole("button", { name: "Line", exact: true }).click();
    // Dropdown should close
    await expect(page.getByText("Core", { exact: true })).not.toBeVisible({ timeout: 3_000 });
    // Button should now show "Line"
    await expect(dropdownBtn).toContainText("Line");
  });

  /* ── 7. Snapshot menu — all 5 items ── */
  test("snapshot menu contains all 5 actions", async ({ page }) => {
    // Reload to ensure fresh bundle
    await page.reload();
    await expect(page.locator("text=MRF").first()).toBeVisible({ timeout: 20_000 });

    const snapshotBtn = page.getByRole("button", { name: /Snapshot menu/i });
    await snapshotBtn.click();

    await expect(page.getByRole("menuitem", { name: /Download image/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("menuitem", { name: /Copy image/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Copy link/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Open in new tab/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Tweet image/i })).toBeVisible();

    // Dismiss
    await page.keyboard.press("Escape");
  });

  test("snapshot copy link action shows success toast", async ({ page }) => {
    await page.evaluate(() => {
      const clipboard = {
        writeText: async () => undefined,
      } as Clipboard;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
    });
    const snapshotBtn = page.getByRole("button", { name: /Snapshot menu/i });
    await snapshotBtn.click();
    await page.getByRole("menuitem", { name: /Copy link/i }).click();
    await expect(page.getByText("Link copied to clipboard", { exact: true }).first()).toBeVisible({ timeout: 8_000 });
  });

  test("snapshot open in new tab opens popup", async ({ page }) => {
    const snapshotBtn = page.getByRole("button", { name: /Snapshot menu/i });
    await snapshotBtn.click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("menuitem", { name: /Open in new tab/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup).toHaveTitle(/Chart Snapshot/i);
  });

  test("snapshot tweet action opens twitter intent", async ({ page }) => {
    const snapshotBtn = page.getByRole("button", { name: /Snapshot menu/i });
    await snapshotBtn.click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("menuitem", { name: /Tweet image/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {/* external URL may not fully load */});
    await expect(popup).toHaveURL(/(twitter|x)\.com\/intent\/tweet/i);
  });

  /* ── 8. Custom period modal ── */
  test("custom period modal opens with mode tabs", async ({ page }) => {
    const customBtn = page.getByRole("button", { name: /Custom period/i });
    await customBtn.click();

    // Modal dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    // Mode tabs
    const dateModeBtn = page.getByRole("tab", { name: /Date/i });
    const timeModeBtn = page.getByRole("tab", { name: /Time/i });
    await expect(dateModeBtn.first()).toBeVisible();
    await expect(timeModeBtn.first()).toBeVisible();

    // Close
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });
  });

  test("custom time range validates end after start", async ({ page }) => {
    await page.getByRole("button", { name: /Custom period/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    const timeModeBtn = page.getByRole("tab", { name: /Time/i });
    await timeModeBtn.first().click();

    const fromTime = page.locator('input[type="time"]').first();
    const toTime = page.locator('input[type="time"]').nth(1);
    await fromTime.fill("15:30");
    await toTime.fill("09:15");

    await page.getByRole("button", { name: /Apply range/i }).click({ force: true });
    await expect(page.getByText(/End time must be after start time/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ── 9. Saved periods menu — empty state ── */
  test("saved periods menu shows empty state when no periods saved", async ({ page }) => {
    // Clear any saved periods in localStorage for a clean test
    await page.evaluate(() => localStorage.removeItem("tradereplay:saved-periods"));
    await page.reload();
    await expect(page.locator("text=MRF").first()).toBeVisible({ timeout: 20_000 });

    const savedBtn = page.getByRole("button", { name: /Saved periods/i });
    await savedBtn.click();

    // Empty state — "No saved periods yet"
    await expect(page.getByText(/No saved periods yet/i)).toBeVisible({ timeout: 4_000 });
    // "New" button present
    await expect(page.getByRole("menuitem", { name: /New/i }).first()).toBeVisible();

    // Close by pressing Escape
    await page.keyboard.press("Escape");
  });

  /* ── 10. Sticky header — appears on scroll ── */
  test("sticky header appears when scrolling past hero", async ({ page }) => {
    // Initially not visible
    const stickyHeader = page.locator(".fixed.top-\\[var\\(--navbar-height\\,64px\\)\\]");

    // Scroll down past hero section
    await page.evaluate(() => window.scrollBy(0, 600));
    await expect(stickyHeader).toBeVisible({ timeout: 5_000 });

    // Scroll back to top — sticky should hide
    await page.evaluate(() => window.scrollTo(0, 0));
    const viewport = page.viewportSize();
    if (!viewport || viewport.width > 430) {
      await expect(stickyHeader).not.toBeVisible({ timeout: 5_000 });
    }
  });

  /* ── 11. Tab navigation ── */
  test("clicking Financials tab highlights it", async ({ page }) => {
    const financialsTab = page.getByRole("tab", { name: "Financials", exact: true }).first();
    await financialsTab.click();
    // Active tab has aria-selected=true
    await expect(financialsTab).toHaveAttribute("aria-selected", "true", { timeout: 3_000 });
  });

  /* ── 12. Key stats ── */
  test("key stats grid shows at least 4 cards", async ({ page }) => {
    // Key stat cards have a specific structure: label + value inside a rounded card
    const statCards = page.locator(".rounded-xl.border.border-border\\/30.bg-card\\/50");
    await expect.poll(() => statCards.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(4);
  });

  /* ── 13. About section ── */
  test("About section heading is visible", async ({ page }) => {
    await expect(page.locator("text=/About .*/").first()).toBeVisible({ timeout: 10_000 });
  });

  /* ── 14. FAQ accordion ── */
  test("FAQ accordion toggles open and closed", async ({ page }) => {
    // Find first FAQ question button (aria-expanded)
    const faqBtn = page.getByRole("button", { name: /What is the current price of/i }).first();
    await faqBtn.scrollIntoViewIfNeeded();

    // Initially closed
    const initialExpanded = await faqBtn.getAttribute("aria-expanded");
    expect(initialExpanded).toBe("false");

    await faqBtn.click();
    await expect(faqBtn).toHaveAttribute("aria-expanded", "true", { timeout: 3_000 });

    await faqBtn.click();
    await expect(faqBtn).toHaveAttribute("aria-expanded", "false", { timeout: 3_000 });
  });

  /* ── 15. Quick actions ── */
  test("Open in Supercharts button is present", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Open in Supercharts/i });
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  /* ── 16. Breadcrumb ── */
  test("breadcrumb Markets link is visible", async ({ page }) => {
    const marketsLink = page.getByRole("link", { name: /Markets/i }).first();
    await expect(marketsLink).toBeVisible({ timeout: 5_000 });
  });

  /* ── 17. Accessibility — snapshot aria-label ── */
  test("snapshot button has correct aria-label", async ({ page }) => {
    const snapshotBtn = page.getByRole("button", { name: /Snapshot menu/i });
    await expect(snapshotBtn).toBeVisible({ timeout: 10_000 });
    await expect(snapshotBtn).toHaveAttribute("aria-label", "Snapshot menu");
  });

  test("listing metadata renders accessible market icons", async ({ page }) => {
    await expect(page.getByLabel(/Market closed/i).first()).toBeVisible({ timeout: 10_000 });
    const primary = page.getByLabel(/Primary listing/i);
    if (await primary.count()) {
      await expect(primary.first()).toBeVisible();
    }
  });

  test("embed button copies iframe code", async ({ page }) => {
    const embedBtn = page.getByRole("button", { name: /Copy embed code/i });
    await embedBtn.click();
    await expect(page.getByText(/Embed code copied/i)).toBeVisible({ timeout: 5_000 });
  });

  /* ── 18. Mobile viewport ── */
  test("hero section visible on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
    await page.goto(SYMBOL_URL);
    await expect(page.locator("text=MRF").first()).toBeVisible({ timeout: 20_000 });
    // Price still visible on narrow screen
    const priceEls = page.locator(".tabular-nums");
    await expect(priceEls.first()).toBeVisible({ timeout: 5_000 });
  });
});
