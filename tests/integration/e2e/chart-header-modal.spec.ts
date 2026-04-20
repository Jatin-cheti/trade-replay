import { expect, test } from "./playwright-fixture";
import { apiUrl } from "./test-env";
import { installSymbolSearchMock } from "./helpers/mockSymbolSearch";

/**
 * E2E tests for the TradingView-parity Chart Header, Indicators Modal,
 * and Interval / Chart-Style dropdowns.
 */

test.setTimeout(90_000);

async function registerAndLogin(page: import("@playwright/test").Page) {
  const uid = Date.now();
  const email = `header_${uid}@example.com`;
  const password = "pass1234";

  await expect
    .poll(async () => {
      const r = await page.request.get(apiUrl("/api/health"));
      return r.status();
    })
    .toBe(200);

  const reg = await page.request.post(apiUrl("/api/auth/register"), {
    data: { email, password, name: `header_${uid}` },
  });

  const auth = reg.ok()
    ? reg
    : await page.request.post(apiUrl("/api/auth/login"), { data: { email, password } });
  expect(auth.ok()).toBeTruthy();

  await page.goto("/login");
  await page.getByPlaceholder("trader@example.com").fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator("form").getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/homepage|\/$/);
}

const clickByTestId = async (page: import("@playwright/test").Page, testId: string) => {
  await page.evaluate((id) => {
    const nodes = Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
    const target =
      nodes.find((n) => n instanceof HTMLElement && n.offsetParent !== null) ?? nodes[0];
    if (target instanceof HTMLElement) {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }, testId);
};

type PaneLayoutEntry = {
  id: string;
  top: number;
  height: number;
};

async function readPaneLayout(page: import("@playwright/test").Page): Promise<PaneLayoutEntry[]> {
  return page.evaluate(() => {
    const canvas = Array.from(document.querySelectorAll('.chart-wrapper canvas'))
      .find((node) => {
        const element = node as HTMLCanvasElement;
        const style = window.getComputedStyle(element);
        return element.getAttribute('aria-label') !== 'chart-drawing-overlay'
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && element.getClientRects().length > 0;
      }) as HTMLCanvasElement | undefined;

    const raw = canvas?.dataset.paneLayout ?? '';
    if (!raw) return [];

    return raw
      .split('|')
      .map((entry) => {
        const [id, top, height] = entry.split(':');
        return {
          id,
          top: Number(top),
          height: Number(height),
        };
      })
      .filter((entry) => entry.id && Number.isFinite(entry.top) && Number.isFinite(entry.height));
  });
}

/* ─── Interval dropdown + custom interval ─────────────────────────────── */

test("interval dropdown groups, favorites, and custom interval modal", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  // Interval button showing current value is visible (pills are no longer shown; dropdown replaces them)
  await expect(page.locator('[data-testid="timeframe-dropdown"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="timeframe-current"]:visible').first()).toBeVisible();

  // Select interval via dropdown (all interval items are always in DOM)
  await clickByTestId(page, "interval-5");

  // Open full interval dropdown and select items (items always in DOM)
  await clickByTestId(page, "interval-1T");
  await clickByTestId(page, "interval-1S");
  await clickByTestId(page, "interval-5");
  await clickByTestId(page, "interval-60");
  await clickByTestId(page, "interval-1D");

  // Select a specific interval
  await clickByTestId(page, "interval-120");

  // Custom interval modal
  await clickByTestId(page, "custom-interval-btn");
  await expect(page.locator('[data-testid="custom-interval-modal"]:visible').first()).toBeVisible();
  await page.locator('[data-testid="custom-interval-amount"]:visible').first().fill("10");
  await clickByTestId(page, "custom-interval-apply");
  await expect(page.locator('[data-testid="custom-interval-modal"]:visible')).toHaveCount(0);
});

/* ─── Chart style dropdown ──────────────────────────────────────────────── */

test("chart style dropdown shows all type groups", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "chart-type-candlestick");
  await clickByTestId(page, "chart-type-line");
  await clickByTestId(page, "chart-type-heikinAshi");
  await clickByTestId(page, "chart-type-renko");
  await clickByTestId(page, "chart-type-volumeCandles");

  // Switch to each major type
  await clickByTestId(page, "chart-type-area");
  await clickByTestId(page, "chart-type-heikinAshi");
  await clickByTestId(page, "chart-type-candlestick");
});

/* ─── Indicators modal full flow ─────────────────────────────────────── */

test("indicators modal: sidebar, search, add, remove, close", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  // Open modal
  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  // Sidebar items
  await expect(modal.getByTestId("indicators-sidebar-technicals")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-financials")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-editorsPicks")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-topScripts")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-trending")).toBeVisible();
  await expect(modal.getByTestId("indicators-sidebar-myScripts")).toBeVisible();

  // Search for SMA and add it
  const search = modal.getByTestId("indicators-modal-search");
  await search.fill("simple moving");
  await expect(modal.getByTestId("indicator-catalog-sma")).toBeVisible();
  await modal.getByTestId("indicator-catalog-sma").click();
  // SMA should be active
  await expect(modal.getByTestId("indicator-catalog-sma")).toContainText(/active/i);

  // Add RSI
  await search.fill("rsi");
  await expect(modal.getByTestId("indicator-catalog-rsi")).toBeVisible();
  await modal.getByTestId("indicator-catalog-rsi").click();

  // Switch sidebar to financials
  await modal.getByTestId("indicators-sidebar-financials").click();
  await search.fill("");
  // Financial items should appear
  await expect(modal.getByTestId("indicator-catalog-fin_totalRevenue")).toBeVisible();
  await expect(modal.getByTestId("indicator-catalog-fin_peRatio")).toBeVisible();

  // Switch to community
  await modal.getByTestId("indicators-sidebar-editorsPicks").click();
  await expect(modal.getByTestId("indicator-catalog-cm_smartMoney")).toBeVisible();

  // Switch back to technicals, clear search, remove SMA
  await modal.getByTestId("indicators-sidebar-technicals").click();
  await search.fill("sma");
  await modal.getByTestId("indicator-catalog-sma").click();
  // SMA should no longer be active
  await expect(modal.getByTestId("indicator-catalog-sma")).not.toContainText(/active/i);

  // Close modal
  await modal.getByTestId("indicators-modal-close").click();
  await expect(page.locator('[data-testid="indicators-modal"]:visible')).toHaveCount(0);

  // Header should show indicator count (RSI still enabled)
  await expect(page.locator('[data-testid="indicators-button"]:visible').first()).toContainText("Indicators (1)");
});

/* ─── Personal sidebar shows placeholder ─────────────────────────────── */

test("indicators modal: personal section shows placeholder", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  await modal.getByTestId("indicators-sidebar-myScripts").click();
  await expect(modal.getByText("No personal scripts yet")).toBeVisible();

  await modal.getByTestId("indicators-sidebar-inviteOnly").click();
  await expect(modal.getByText("No invite-only scripts here yet")).toBeVisible();

  await modal.getByTestId("indicators-modal-close").click();
});

/* ─── Technicals sub-tabs ────────────────────────────────────────────── */

test("indicators modal: technicals sub-tabs switch content", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  // Default: Indicators tab visible with SMA
  await expect(modal.getByTestId("tech-tab-indicators")).toBeVisible();
  await expect(modal.getByTestId("tech-tab-patterns")).toBeVisible();
  await expect(modal.getByTestId("indicator-catalog-sma")).toBeVisible();

  // Switch to Patterns — candlestick patterns should appear
  await modal.getByTestId("tech-tab-patterns").click();
  await expect(modal.getByTestId("indicator-catalog-cp_doji")).toBeVisible();
  await expect(modal.getByTestId("indicator-catalog-cp_hammer")).toBeVisible();

  // Switch to Strategies — strategy items should appear
  await modal.getByTestId("tech-tab-strategies").click();
  await expect(modal.getByTestId("indicator-catalog-strat_bollingerBands")).toBeVisible();

  // Switch to Profiles — profile items should appear
  await modal.getByTestId("tech-tab-profiles").click();
  await expect(modal.getByTestId("indicator-catalog-prof_volumeProfileFR")).toBeVisible();

  // Switch back to Indicators
  await modal.getByTestId("tech-tab-indicators").click();
  await expect(modal.getByTestId("indicator-catalog-sma")).toBeVisible();

  await modal.getByTestId("indicators-modal-close").click();
});

test("indicators modal: fundamentals scroll and section collapse work", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  await modal.getByTestId("indicators-sidebar-financials").click();

  // Collapse / expand Income Statement section must work in Financials tab
  const incomeHeader = modal.getByRole("button", { name: /Income Statement/ }).first();
  await expect(modal.getByTestId("indicator-catalog-fin_totalRevenue")).toBeVisible();
  await incomeHeader.click();
  await expect(modal.getByTestId("indicator-catalog-fin_totalRevenue")).toBeHidden();
  await incomeHeader.click();
  await expect(modal.getByTestId("indicator-catalog-fin_totalRevenue")).toBeVisible();

  // Network tab list should be vertically scrollable to reach bottom entries
  await modal.getByTestId("fund-tab-network").click();
  const scrollPane = modal.getByTestId("indicators-content-scroll");
  const metrics = await scrollPane.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  // Mouse wheel should move the modal scroll position
  const beforeWheel = await scrollPane.evaluate((el) => el.scrollTop);
  await scrollPane.evaluate((el) => {
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: 900, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(120);
  const afterWheel = await scrollPane.evaluate((el) => el.scrollTop);
  expect(afterWheel).toBeGreaterThan(beforeWheel);

  await scrollPane.evaluate((el) => {
    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  });
  await expect(modal.getByTestId("indicator-catalog-fund_issuance")).toBeVisible();

  await modal.getByTestId("indicators-modal-close").click();
});

/* ─── Add non-builtin indicator from patterns tab ────────────────────── */

test("indicators modal: add candlestick pattern indicator", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  // Switch to Patterns tab and add Doji
  await modal.getByTestId("tech-tab-patterns").click();
  await expect(modal.getByTestId("indicator-catalog-cp_doji")).toBeVisible();
  // Should show "Add" badge (not "Coming Soon")
  await expect(modal.getByTestId("indicator-catalog-cp_doji")).toContainText(/add/i);
  await modal.getByTestId("indicator-catalog-cp_doji").click();
  // Should now show "Active"
  await expect(modal.getByTestId("indicator-catalog-cp_doji")).toContainText(/active/i);

  // Remove it
  await modal.getByTestId("indicator-catalog-cp_doji").click();
  await expect(modal.getByTestId("indicator-catalog-cp_doji")).not.toContainText(/active/i);

  await modal.getByTestId("indicators-modal-close").click();
});

test("volume indicator renders in a subpane below main chart", async ({ page }) => {
  await registerAndLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  const search = modal.getByTestId("indicators-modal-search");
  await search.fill("volume");
  const volumeItem = modal.getByTestId("indicator-catalog-volume");
  await expect(volumeItem).toBeVisible();
  await volumeItem.click();
  await expect(volumeItem).toContainText(/active/i);
  await modal.getByTestId("indicators-modal-close").click();

  await expect
    .poll(async () => {
      const panes = await readPaneLayout(page);
      return panes.length;
    })
    .toBeGreaterThanOrEqual(2);

  const withVolume = await readPaneLayout(page);
  const mainPane = withVolume.find((pane) => pane.id === "main");
  const subpane = withVolume.find((pane) => pane.id.startsWith("ind-pane-"));
  expect(mainPane).toBeTruthy();
  expect(subpane).toBeTruthy();
  expect((subpane?.top ?? 0)).toBeGreaterThan((mainPane?.top ?? 0) + 1);

  await clickByTestId(page, "indicators-button");
  const modalAfter = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modalAfter).toBeVisible();
  await modalAfter.getByTestId("indicators-modal-search").fill("volume");
  const activeVolumeItem = modalAfter.getByTestId("indicator-catalog-volume");
  await expect(activeVolumeItem).toContainText(/active/i);
  await activeVolumeItem.click();
  await expect(activeVolumeItem).not.toContainText(/active/i);
  await modalAfter.getByTestId("indicators-modal-close").click();

  await expect
    .poll(async () => {
      const panes = await readPaneLayout(page);
      return panes.length;
    })
    .toBe(1);
});

test("indicators stay active across timeframe and symbol changes", async ({ page }) => {
  await registerAndLogin(page);
  await installSymbolSearchMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/simulation");
  await expect(page.locator('[data-testid="chart-top-bar"]:visible').first()).toBeVisible();

  await clickByTestId(page, "indicators-button");
  const modal = page.locator('[data-testid="indicators-modal"]:visible').first();
  await expect(modal).toBeVisible();

  const search = modal.getByTestId("indicators-modal-search");
  await search.fill("sma");
  const smaItem = modal.getByTestId("indicator-catalog-sma");
  await expect(smaItem).toBeVisible();
  await smaItem.click();
  await expect(smaItem).toContainText(/active/i);

  await search.fill("volume");
  const volumeItem = modal.getByTestId("indicator-catalog-volume");
  await expect(volumeItem).toBeVisible();
  await volumeItem.click();
  await expect(volumeItem).toContainText(/active/i);
  await modal.getByTestId("indicators-modal-close").click();

  const indicatorButton = page.locator('[data-testid="indicators-button"]:visible').first();
  await expect(indicatorButton).toContainText("Indicators (2)");

  await clickByTestId(page, "interval-60");
  await expect(indicatorButton).toContainText("Indicators (2)");

  const panesAfterInterval = await readPaneLayout(page);
  expect(panesAfterInterval.length).toBeGreaterThanOrEqual(2);
  const mainAfterInterval = panesAfterInterval.find((pane) => pane.id === "main");
  const subpaneAfterInterval = panesAfterInterval.find((pane) => pane.id.startsWith("ind-pane-"));
  expect(mainAfterInterval).toBeTruthy();
  expect(subpaneAfterInterval).toBeTruthy();
  expect((subpaneAfterInterval?.top ?? 0)).toBeGreaterThan((mainAfterInterval?.top ?? 0) + 1);

  const symbolTrigger = page.getByTestId("scenario-symbol-trigger");
  await symbolTrigger.click();
  await expect(page.locator('[data-testid="symbol-search-modal"]:visible').first()).toBeVisible();
  await page.getByTestId("symbol-category-indices").click({ force: true });
  await page.getByTestId("symbol-search-input").fill("IXIC");

  const ixicRow = page.locator('[data-testid="symbol-result-row"][data-symbol="IXIC"]').first();
  await expect(ixicRow).toBeVisible();
  await ixicRow.evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
    }
  });

  const listingRow = page.locator('[data-testid="symbol-listing-row"]').first();
  if (await listingRow.isVisible().catch(() => false)) {
    await listingRow.click();
  }

  await expect
    .poll(async () => page.locator('[data-testid="symbol-search-modal"]:visible').count())
    .toBe(0);

  await expect(symbolTrigger).toContainText(/IXIC|Nasdaq/i);
  await expect(indicatorButton).toContainText("Indicators (2)");

  const panesAfterSymbol = await readPaneLayout(page);
  expect(panesAfterSymbol.length).toBeGreaterThanOrEqual(2);
  const mainAfterSymbol = panesAfterSymbol.find((pane) => pane.id === "main");
  const subpaneAfterSymbol = panesAfterSymbol.find((pane) => pane.id.startsWith("ind-pane-"));
  expect(mainAfterSymbol).toBeTruthy();
  expect(subpaneAfterSymbol).toBeTruthy();
  expect((subpaneAfterSymbol?.top ?? 0)).toBeGreaterThan((mainAfterSymbol?.top ?? 0) + 1);
});
