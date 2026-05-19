type MaybePage = {
  locator?: (selector: string) => {
    count?: () => Promise<number>;
    click?: (options?: Record<string, unknown>) => Promise<void>;
    isVisible?: () => Promise<boolean>;
  };
  keyboard?: {
    press?: (key: string) => Promise<void>;
  };
  waitForLoadState?: (state?: 'load' | 'domcontentloaded' | 'networkidle') => Promise<void>;
};

const MODAL_CLOSE_SELECTORS = [
  '[data-name="close"]',
  'button[aria-label="Close"]',
  '[role="dialog"] button[aria-label="Close"]',
  '[data-dialog-name] button[aria-label="Close"]',
];

export async function dismissModals(page: MaybePage): Promise<void> {
  if (!page?.locator) return;
  for (const selector of MODAL_CLOSE_SELECTORS) {
    try {
      const candidate = page.locator(selector);
      const count = (await candidate.count?.()) ?? 0;
      if (count > 0) {
        await candidate.click?.({ timeout: 500 });
        return;
      }
    } catch {
      // Ignore modal probe errors and keep trying.
    }
  }
  try {
    await page.keyboard?.press?.('Escape');
  } catch {
    // Ignore if no keyboard bridge exists.
  }
}

export async function ensurePageReady(page: MaybePage): Promise<void> {
  try {
    await page.waitForLoadState?.('domcontentloaded');
  } catch {
    // Best-effort only.
  }
  await dismissModals(page);
}
