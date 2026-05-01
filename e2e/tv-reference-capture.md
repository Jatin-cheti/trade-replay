# TV reference capture flow

This is the manual reference-capture procedure that complements the automated
pixel-diff infrastructure (`E2E_PIXEL_DIFF=1` flag in `tv-parity-500-factory.ts`).

## Why two layers?

1. **Automated baselines** (Playwright snapshots under `e2e/__snapshots__/`):
   detect *future* visual regressions in our own rendering. Updated whenever
   intentional render changes ship. Does not by itself prove TV parity.

2. **TV reference images** (under `e2e/tv-references/<variant>/state-NNN.png`):
   captured *manually* against `https://in.tradingview.com/` and used as the
   one-time human review baseline. When a tool is re-implemented for parity,
   the reviewer compares our automated baseline image vs. the TV reference
   image side by side and approves or sends back for fixes.

We deliberately do NOT diff our render against the TV reference automatically:
TV's chart pixel-rate, candle palette, font hinting, anti-aliasing and
sub-pixel grid offsets are *not* reproducible byte-for-byte in our renderer
even when geometry is correct. A pure pixel-diff against TV would generate
~100% false positives. The automated layer guards against regressions; the
manual layer guards against TV-parity drift.

## Capture procedure

1. Open https://in.tradingview.com/chart/QL1fWIPB/?symbol=NSE%3ARELIANCE
   (refresh once to dismiss the login modal).
2. Choose timeframe **1D**, fit content (autoscale).
3. For each tool variant, run the deterministic state generator below to get
   the (x1,y1)→(x2,y2) anchor pairs for states 0–99.
4. For each state, draw the tool, screenshot the canvas region around the
   drawing using devtools' element-screenshot, and save to
   `e2e/tv-references/<variant>/state-NNN.png`.

States are derived from the same `endpointsForIndex(box, i)` helper in
`tv-parity-500-factory.ts` so the reference images line up 1:1 with our
geometry tests.

## Running pixel-diff baseline updates

```powershell
# Update baselines (one-time after intentional render changes):
cd tradereplay
$env:E2E_PIXEL_DIFF = "1"
npx playwright test e2e/tv-parity-channel-500.spec.ts `
  --project=chromium `
  --config=e2e/playwright.local-preview.config.ts `
  --update-snapshots

# Verify against baselines (regression run):
npx playwright test e2e/tv-parity-channel-500.spec.ts `
  --project=chromium `
  --config=e2e/playwright.local-preview.config.ts
```

When the run is green, capture the new baseline images into
`e2e/tv-references/<variant>/state-NNN.png` for the manual TV-parity review.
