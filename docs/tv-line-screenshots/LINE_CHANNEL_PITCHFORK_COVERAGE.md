# TradingView Line / Channel / Pitchfork Coverage

Last updated: May 19, 2026

This document is the detailed companion to [REQUIREMENTS.md](./REQUIREMENTS.md). It keeps the earlier notes, but expands them so every individual tool type observed in the captured TradingView line-tool panel has its own section.

It is research-only. No app behavior was changed while preparing it.

## Scope

Primary artifact-backed sources already in this repo:

- `docs/tv-line-screenshots/_group-menu.png`
- `docs/tv-line-screenshots/manifest.json`
- `docs/tv-line-screenshots/_linetool-items.json`
- `docs/tv-line-screenshots/*-01-cursor-tooltip.png`
- `docs/tv-line-screenshots/*-02-placing-first-point.png`
- `docs/tv-line-screenshots/*-03-after-anchor-*.png`
- `docs/tv-line-screenshots/*-04-drawn.png`
- `docs/tv-line-screenshots/*-05-context-menu.png`
- `scripts/capture-tv-line-tools.mjs`
- `e2e/tv-parity-500-factory.ts`
- `e2e/tv-parity-extended-factory.ts`
- `e2e/scripts/tv-reference-capture.md`

TradingView chart under review:

- `https://in.tradingview.com/chart/QL1fWIPB/?symbol=NSE%3ARELIANCE`

Fresh live-capture fallback used on May 19, 2026:

- `https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE`

Official cross-check sources used for tool taxonomy and feature semantics:

- TradingView "Drawing tools available on TradingView"
- TradingView Drawings List
- individual TradingView help articles for Ray, Extended Line, Regression Trend, Pitchfork, Inside Pitchfork, Crossline, Horizontal Line

## Live-capture evidence pass: May 19, 2026

A fresh live-capture pass was run on May 19, 2026 with a shared queue and 5 concurrent Playwright workers.

Important access note:

- the originally requested shared-layout URL `https://in.tradingview.com/chart/QL1fWIPB/?symbol=NSE%3ARELIANCE` returned a TradingView page saying the chart layout could not be opened without owner access
- because that page was not an intermittent login modal but an access block, the fresh capture continued on the public symbol chart URL already used by the repo's own capture script:
  - `https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE`

Queue result:

- 17 tool tasks processed through the queue
- 16 completed on first pass
- `Trend Line` required a follow-up because the live menu label is `Trendline` with no space

Fresh evidence directories were kept out of the repo and written to temp storage during research:

- `C:\\Users\\NEHA\\AppData\\Local\\Temp\\tv-line-live-capture-public-20260519`
- `C:\\Users\\NEHA\\AppData\\Local\\Temp\\tv-line-live-capture-public-20260519\\trend-line-manual`

## What is in the captured panel

From `_group-menu.png`, the captured line-tool panel contains exactly these three sections and 17 tool types:

### Lines

1. Trendline
2. Ray
3. Info line
4. Extended line
5. Trend angle
6. Horizontal line
7. Horizontal ray
8. Vertical line
9. Cross line

### Channels

1. Parallel channel
2. Regression trend
3. Flat top/bottom
4. Disjoint channel

### Pitchforks

1. Pitchfork
2. Schiff pitchfork
3. Modified Schiff pitchfork
4. Inside pitchfork

## Important panel-vs-doc note

TradingView's broader public tool lists also mention `Arrow` and `Anchored VWAP` in the wider trend-line tool universe. They were not present in this captured line-tool panel state for the RELIANCE chart and are not part of the 17-tool panel capture set in `docs/tv-line-screenshots/`.

So this document does two things on purpose:

- it fully covers the 17 tool types actually present in the captured panel
- it explicitly does not pretend that `Arrow` or `Anchored VWAP` were observed in this specific panel capture

## Existing automation already present

The repo already contains meaningful TradingView automation for this family:

- a dedicated capture script: `scripts/capture-tv-line-tools.mjs`
- a captured manifest for the 17 panel tools
- per-tool parity suites for all 16 captured tools plus Trend Line parity coverage
- shared parity factories and reference-capture guidance

Observed manifest anchor counts:

- 2 anchors: `trend-line`, `ray`, `info-line`, `extended-line`, `trend-angle`, `regression-trend`
- 1 anchor: `horizontal-line`, `horizontal-ray`, `vertical-line`, `cross-line`
- 3 anchors: `parallel-channel`, `pitchfork`, `schiff-pitchfork`, `modified-schiff-pitchfork`, `inside-pitchfork`
- 4 anchors: `disjoint-channel`
- 2 anchors: `flat-top-bottom`

Known stale areas in older repo coverage:

- `docs/TV_PARITY.md` is stale for this family
- some older tests still model:
  - `channel` as a 2-anchor tool
  - `disjointChannel` as drag-commit
  - pitchfork family as drag-commit
- the capture artifacts support:
  - Parallel Channel = 3-click wizard
  - Disjoint Channel = 4-click wizard
  - Pitchfork family = 3-click sequence

## Previously automated scope: provenance check

Before continuing live automation, git history and file lineage were checked to separate this workflow from other TradingView work in the repo.

### Our existing TradingView automation coverage

This workflow is the Mohit-authored line/channel/pitchfork parity lane from late April through early May 2026.

Strong indicators:

- `7568000` by `Mohit` on `2026-05-03`
  - added `scripts/capture-tv-line-tools.mjs`
  - added `docs/tv-line-screenshots/`
  - added `REQUIREMENTS.md`
  - explicitly described `lines/channels/pitchforks`
- `612d29e` by `Mohit`
  - `tv-parity-ray-500`
- `fcc6eef` by `Mohit`
  - `tv-parity 500-suite for hline/vline/crossLine`
- `b1e5fb7` by `Mohit`
  - added 500-test shims for 4 channels and 4 pitchforks
- `529108b`, `b590cf1`, `c237595`
  - Mohit-authored V2 / comprehensive parity follow-up work

Tool-family scope that belongs to this lane:

- Lines:
  - Trend Line
  - Ray
  - Info Line
  - Extended Line
  - Trend Angle
  - Horizontal Line
  - Horizontal Ray
  - Vertical Line
  - Cross Line
- Channels:
  - Parallel Channel
  - Regression Trend
  - Flat Top/Bottom
  - Disjoint Channel
- Pitchforks:
  - Pitchfork
  - Schiff Pitchfork
  - Modified Schiff Pitchfork
  - Inside Pitchfork

Files that are part of this lane:

- `scripts/capture-tv-line-tools.mjs`
- `docs/tv-line-screenshots/*`
- `e2e/tv-parity-ray-500.spec.ts`
- `e2e/tv-parity-hline-500.spec.ts`
- `e2e/tv-parity-vline-500.spec.ts`
- `e2e/tv-parity-crossLine-500.spec.ts`
- `e2e/tv-parity-channel-500.spec.ts`
- `e2e/tv-parity-regressionTrend-500.spec.ts`
- `e2e/tv-parity-flatTopBottom-500.spec.ts`
- `e2e/tv-parity-disjointChannel-500.spec.ts`
- `e2e/tv-parity-pitchfork-500.spec.ts`
- `e2e/tv-parity-schiffPitchfork-500.spec.ts`
- `e2e/tv-parity-modifiedSchiffPitchfork-500.spec.ts`
- `e2e/tv-parity-insidePitchfork-500.spec.ts`
- `e2e/line-tools-*.spec.ts`
- `e2e/channel-tools.spec.ts`
- `e2e/pitchfork-tools.spec.ts`
- `e2e/tv-parity-comprehensive.spec.ts`
- `e2e/tv-parity-behaviors.spec.ts`

### Other contributors' unrelated TradingView automation

This is primarily the broader Jatin-authored production parity/capture harness added on May 19, 2026.

Strong indicators:

- `e34f05d` by `Jatin-cheti` on `2026-05-19`
  - `test(tv-parity): add production parity harness`
- `52d0a11` and `5338f6c`
  - refactor and consolidate those factories

This lane centers on `e2e/tv-capture-factory.ts` and `e2e/prod-parity-shared-factory.ts`, which define a different 27-tool set, including:

- forecasting/measurement tools:
  - longPosition
  - shortPosition
  - positionForecast
  - barPattern
  - ghostFeed
  - anchoredVwap
  - fixedRangeVolumeProfile
  - anchoredVolumeProfile
  - priceRange
  - dateRange
  - dateAndPriceRange
- shapes/brush/icons/text and other unrelated families

Those are real TradingView automation assets in the repo, but they are not the same lane as the line/channel/pitchfork workflow documented here.

### Stale or experimental automation

- `docs/TV_PARITY.md`
  - stale family inventory; no longer trustworthy for this lane
- `docs/tradingview-parity/README.md`
- `docs/tradingview-parity/reference-matrix.md`
  - broader benchmark/diff harness, not the same as the line-tool capture lane
- `e2e/tv-parity-comprehensive.spec.ts`
- `e2e/tv-parity-behaviors.spec.ts`
  - useful, but parts are stale because they still encode old commit assumptions for channels and pitchforks

### Partially completed automation

- original May 3 line-tool capture set:
  - partially complete for `Trend Line` because screenshots were missing there
- `Regression Trend`
  - geometry and selected-state evidence existed, but handle semantics were incomplete
- `Disjoint Channel`
  - selected-state handle visibility remained incomplete
- earlier channel/pitchfork specs
  - partially complete because some commit-style assumptions were later disproven by live capture

### Clean queue derived from our actual lane

Only the 17 line/channel/pitchfork tools listed in this document belong in the clean queue for this workflow.

That is the queue used for the fresh May 19 live-capture continuation.

## Current local changes: classification only

### Intentional TradingView automation work

- `e2e/tv-parity-500-factory.ts`
- `e2e/tv-parity-extended-factory.ts`

### Implementation changes

- `frontend/services/tools/toolEngine.ts`
- `frontend/services/tools/toolRegistry.ts`
- `packages/tradereplay-charts/src/drawing/tools/disjointChannel.ts`
- `packages/tradereplay-charts/src/drawing/tools/flatTopBottom.ts`
- `packages/tradereplay-charts/src/drawing/tools/index.ts`
- `packages/tradereplay-charts/src/drawing/tools/parallelChannel.ts`
- `packages/tradereplay-charts/src/drawing/tools/pitchforks.ts`
- `packages/tradereplay-charts/src/drawing/types.ts`

### Leftover or accidental-looking

- `frontend/components/chart/TradingChart.tsx`

This local diff removes debug hooks used by parity infrastructure and should not be treated as safe cleanup without review.

### Needs review

- `frontend/components/chart/TradingChart.tsx`
- `frontend/services/tools/toolEngine.ts`
- `frontend/services/tools/toolRegistry.ts`
- `packages/tradereplay-charts/src/drawing/tools/index.ts`
- `packages/tradereplay-charts/src/drawing/types.ts`

## Shared TradingView behavior across the 17 panel tools

- Selection turns strokes blue and shows white-filled, blue-outlined handles.
- A floating drawing toolbar appears immediately after final commit.
- Right-click opens an object menu with standard actions such as `Template`, `Visual order`, `Visibility on intervals`, `Object tree`, `Clone`, `Copy`, `Lock`, `Hide`, `Remove`, and `Settings...`.
- Price labels appear on the right axis when the tool has meaningful y-values.
- Date pills appear on the bottom axis when the tool has explicit x anchors or span boundaries.
- Pan and zoom preserve the drawing in chart coordinates rather than pixel coordinates.
- TradingView has known interval/timeframe caveats for drawings; official docs note that drawings can appear to pass through different visible bar points on another interval while still representing the same anchored timestamps.

---

## Lines

### Trend Line

- Exact tool name: `Trend Line`
- Category/section: `Lines > Lines`
- Live-capture evidence:
  - TradingView's live menu label on May 19, 2026 was `Trendline` with no space
  - fresh screenshots captured selected, unselected, reselected, and context-menu states from the public RELIANCE chart
- Creation flow:
  - select the tool
  - click A
  - move mouse to preview segment A->cursor
  - click B to finalize
- Number of clicks: `2`
- Preview while drawing:
  - first click establishes the origin
  - second-point preview follows cursor as a finite segment
- Anchor/handle positions:
  - fresh live capture shows circular endpoint handles at A and B
  - no square midpoint handle was visible in the selected sample
- Drag behavior:
  - dragging A or B changes slope and length
  - dragging body should translate the whole segment
- Resize/edit behavior:
  - resize by moving endpoints
  - direct text edit only if text is enabled in style/text settings
- Tooltip behavior:
  - fresh live capture did not show a measurement pill while drawing
  - context menu included `Add alert on trendline...`
  - official TradingView docs for line-family tools imply optional stats can be shown beside the line
- Text/label behavior:
  - official line-family behavior supports optional text and optional stats in style dialogs
- Colors/fills/styles:
  - line color, opacity, width, style expected
  - no fill
- Selection/hover behavior:
  - fresh selected state shows blue stroke, circular endpoint handles, floating toolbar, right-axis price label, and bottom date pills
  - hover details still need a dedicated hover-only capture
- Zoom/pan behavior:
  - anchored to chart coordinates, not screen pixels
- Edge cases:
  - zero-length line
  - near-edge anchor placement
  - interval switch changing apparent bar alignment
- Test scenarios needed later:
  - create with two clicks
  - move each endpoint
  - move body
  - verify selected/unselected states
  - verify pan/zoom persistence
- Coverage gap:
  - the May 3 screenshot set was incomplete for this tool, but the May 19 live pass now fills the basic selected/unselected/context-menu evidence gap

### Ray

- Exact tool name: `Ray`
- Category/section: `Lines > Lines`
- Creation flow:
  - click A
  - move cursor to define direction
  - click B to finalize
- Number of clicks: `2`
- Preview while drawing:
  - after A, preview extends from A through the cursor and continues indefinitely to the right in the chosen direction
- Anchor/handle positions:
  - circular handle at A
  - circular direction handle at B
  - selected state also shows a body/midpoint handle
- Drag behavior:
  - A repositions the origin
  - B changes the slope/direction
  - body drag should translate the full ray
- Resize/edit behavior:
  - resize by moving A or B
  - optional text and stats are supported in official TradingView docs
- Tooltip behavior:
  - no measurement pill is visible in the capture
  - official docs say optional stats can include price range, percent change, bars range, date/time range, distance, and angle
- Text/label behavior:
  - official docs say text can be displayed beside the ray and edited directly on chart
- Colors/fills/styles:
  - no fill
  - official docs support color, opacity, thickness, style, optional arrow-shaped line ends, midpoint visibility, and price labels
- Selection/hover behavior:
  - selected sample shows blue line, handles, toolbar, right-axis price label, bottom date pills
  - unselected state removes handles and keeps the infinite-right geometry
- Zoom/pan behavior:
  - keeps direction and anchored coordinates while extending to visible bounds
- Edge cases:
  - nearly horizontal ray
  - nearly vertical ray
  - anchor B placed left of A but ray still defined by A->B direction
- Test scenarios needed later:
  - verify 2-click commit
  - verify one-sided extension
  - verify body-handle move
  - verify optional stats visibility

### Info Line

- Exact tool name: `Info Line`
- Category/section: `Lines > Lines`
- Creation flow:
  - click A
  - move cursor to preview segment plus measurement pill
  - click B to finalize
- Number of clicks: `2`
- Preview while drawing:
  - line plus metric pill update continuously before second click
- Anchor/handle positions:
  - circular endpoint handles at A and B
  - no extra square midpoint handle is visible in the selected sample
- Drag behavior:
  - dragging either endpoint updates price delta, percent, bars, distance, and angle
  - body drag should move the whole measurement line
- Resize/edit behavior:
  - resize via endpoints
  - optional text behavior should follow line-family support when enabled
- Tooltip behavior:
  - captured pill contains:
    - absolute delta and percent
    - bars and elapsed days
    - pixel distance
    - angle
  - sample formatting:
    - `98.25 (6.85%)`
    - `47 bars (69d), distance: 345 px`
    - `35.07 deg`
- Text/label behavior:
  - the central stats pill is core behavior, not just hover text
- Colors/fills/styles:
  - no fill
  - stroke color drives the line
  - stats box is a light floating pill
- Selection/hover behavior:
  - selected state shows blue line, toolbar, and visible stats box
  - unselected sample still appears to preserve the info pill
- Zoom/pan behavior:
  - anchored metrics should stay attached to the segment
- Edge cases:
  - zero-length info line
  - interval change affecting bar count display
- Test scenarios needed later:
  - verify pill contents and formatting
  - verify live metric updates during endpoint drag
  - verify selected vs unselected pill behavior

### Extended Line

- Exact tool name: `Extended Line`
- Category/section: `Lines > Lines`
- Creation flow:
  - click A
  - move cursor to define angle
  - click B to finalize
- Number of clicks: `2`
- Preview while drawing:
  - preview is an infinite line extending in both directions through A and cursor
- Anchor/handle positions:
  - circular handles at A and B
  - selected state also shows a midpoint/body handle
- Drag behavior:
  - dragging A or B changes line angle
  - body drag translates whole line
- Resize/edit behavior:
  - resize by moving endpoints
  - official docs support turning midpoint visibility on/off
- Tooltip behavior:
  - official docs support optional stats:
    - price range
    - percent change
    - bars range
    - date/time range
    - distance
    - angle
- Text/label behavior:
  - official docs treat it as supporting a label/stat display beside the line
- Colors/fills/styles:
  - no fill
  - official docs support color, opacity, thickness, style, arrow-shaped ends, midpoint visibility, and price labels
- Selection/hover behavior:
  - selected capture shows blue infinite line, handles, toolbar, and bottom date pills
- Zoom/pan behavior:
  - line remains extended through chart bounds after pan/zoom
- Edge cases:
  - almost-flat lines
  - almost-vertical lines
  - interval switch while preserving anchor timestamps
- Test scenarios needed later:
  - verify both-side extension
  - verify midpoint drag
  - verify stat label options

### Trend Angle

- Exact tool name: `Trend Angle`
- Category/section: `Lines > Lines`
- Creation flow:
  - click A
  - move cursor to preview line, horizontal reference, and angle label
  - click B to finalize
- Number of clicks: `2`
- Preview while drawing:
  - horizontal reference projects from A
  - angle label updates as cursor moves
- Anchor/handle positions:
  - circular handles at A and B
- Drag behavior:
  - dragging B changes angle and length
  - dragging A changes origin and baseline reference
- Resize/edit behavior:
  - endpoint-driven resize
- Tooltip behavior:
  - label near origin shows angle in degrees
  - sample visible value: `35.07 deg`
- Text/label behavior:
  - angle label is intrinsic
  - dotted horizontal reference is intrinsic
- Colors/fills/styles:
  - no fill
  - main stroke plus dashed horizontal reference
- Selection/hover behavior:
  - selected state shows blue line, dashed reference, handles, toolbar, price label, and date pills
- Zoom/pan behavior:
  - angle geometry stays chart-anchored
- Edge cases:
  - exactly horizontal
  - exactly vertical
  - shift/45-degree alignment behavior is documented by TradingView for supported tools in this family
- Test scenarios needed later:
  - verify angle label updates
  - verify reference dash from A
  - verify endpoint drag recomputes angle

### Horizontal Line

- Exact tool name: `Horizontal Line`
- Category/section: `Lines > Lines`
- Creation flow:
  - move cursor to desired price
  - click once to commit
- Number of clicks: `1`
- Preview while drawing:
  - full-width horizontal preview at the current y
- Anchor/handle positions:
  - one circular handle on the line at the chosen anchor x
  - no endpoint handles because the line spans chart width
- Drag behavior:
  - vertical drag changes price
  - horizontal movement changes handle position but not the infinite width
- Resize/edit behavior:
  - effectively moved, not resized
- Tooltip behavior:
  - no measurement tooltip in the captured sample
- Text/label behavior:
  - inline `+ Add text` appears after creation
  - official docs allow text beside the line and direct on-chart edit
  - official docs also allow hiding/showing price label
- Colors/fills/styles:
  - no fill
  - official docs support line color, opacity, thickness, style
- Selection/hover behavior:
  - selected state shows blue line, handle, toolbar, right-axis price label
- Zoom/pan behavior:
  - remains full width at the anchored price
- Edge cases:
  - line near top/bottom of chart
  - line created during autoscale changes
- Test scenarios needed later:
  - verify one-click creation
  - verify text affordance
  - verify vertical move behavior

### Horizontal Ray

- Exact tool name: `Horizontal Ray`
- Category/section: `Lines > Lines`
- Creation flow:
  - move cursor to desired start price/time
  - click once to commit
- Number of clicks: `1`
- Preview while drawing:
  - horizontal preview extends from cursor position to the right
- Anchor/handle positions:
  - one circular handle at the left start anchor
- Drag behavior:
  - vertical drag changes price
  - horizontal drag changes start point
- Resize/edit behavior:
  - no endpoint pair; the start point is the important edit handle
- Tooltip behavior:
  - no measurement pill observed
- Text/label behavior:
  - right-axis price label observed
  - direct text behavior needs fresh artifact-backed confirmation
- Colors/fills/styles:
  - no fill
  - visually behaves like a one-sided horizontal line
- Selection/hover behavior:
  - selected capture shows blue ray and toolbar
- Zoom/pan behavior:
  - start point stays anchored, visible stroke extends to right-side bounds
- Edge cases:
  - anchor placed near far right edge
  - line near chart top/bottom
- Test scenarios needed later:
  - verify one-click commit
  - verify one-sided right extension
  - verify anchor move behavior

### Vertical Line

- Exact tool name: `Vertical Line`
- Category/section: `Lines > Lines`
- Creation flow:
  - move cursor to desired time
  - click once to commit
- Number of clicks: `1`
- Preview while drawing:
  - full-height vertical preview at the current x
- Anchor/handle positions:
  - one circular handle on the vertical stroke
- Drag behavior:
  - horizontal drag changes time
  - vertical drag should not materially change geometry
- Resize/edit behavior:
  - moved rather than resized
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - bottom date pill is intrinsic
  - inline vertical `+ Add text` appears after creation
- Colors/fills/styles:
  - no fill
  - full-height stroke
- Selection/hover behavior:
  - selected capture shows blue full-height line, handle, toolbar
- Zoom/pan behavior:
  - remains tied to timestamp/bar
- Edge cases:
  - line near last visible candle
  - line used for time-based alerts/events
- Test scenarios needed later:
  - verify one-click creation
  - verify horizontal move behavior
  - verify bottom-axis date label persistence

### Cross Line

- Exact tool name: `Cross Line`
- Category/section: `Lines > Lines`
- Creation flow:
  - move cursor to desired intersection
  - click once to commit
- Number of clicks: `1`
- Preview while drawing:
  - horizontal and vertical guides intersect at cursor position
- Anchor/handle positions:
  - one circular handle at the intersection point
- Drag behavior:
  - dragging the center moves both axes together
- Resize/edit behavior:
  - moved rather than resized
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - right-axis price label
  - bottom-axis date pill
  - official TradingView docs note both labels can be disabled in style settings
- Colors/fills/styles:
  - no fill
  - line color, thickness, style configurable
- Selection/hover behavior:
  - selected sample shows blue horizontal plus blue vertical and toolbar
- Zoom/pan behavior:
  - both axes remain chart-anchored
- Edge cases:
  - crossline near chart corners
  - price/date labels overlapping dense UI
- Test scenarios needed later:
  - verify one-click creation
  - verify moving intersection
  - verify both axis labels

---

## Channels

### Parallel Channel

- Exact tool name: `Parallel Channel`
- Category/section: `Lines > Channels`
- Creation flow:
  - click A for baseline start
  - move cursor to preview baseline
  - click B for baseline end
  - move cursor to preview parallel offset rail and fill
  - click C to finalize width/offset
- Number of clicks: `3`
- Preview while drawing:
  - after A: finite baseline preview
  - after B: full channel preview with offset rail, fill, and dashed median
- Anchor/handle positions:
  - four circular corner handles in selected state
  - square midpoint/body handles on both main rails
- Drag behavior:
  - A/B adjust baseline angle and span
  - offset-side handles adjust thickness
  - midpoint/body drag translates rail/channel
- Resize/edit behavior:
  - endpoint and rail-handle editing
- Tooltip behavior:
  - no measurement tooltip seen in the capture
- Text/label behavior:
  - right-axis labels for top and bottom rails
  - bottom-axis date pills for span boundaries
- Colors/fills/styles:
  - blue outer rails
  - dashed median
  - semi-transparent blue fill
  - TradingView docs/blog note 45-degree alignment support for channels
- Selection/hover behavior:
  - selected state shows corners, square body handles, toolbar
- Zoom/pan behavior:
  - channel shape scales with chart coordinates
- Edge cases:
  - very thin channels
  - reversed A/B slope
  - large offset causing off-screen rail
- Test scenarios needed later:
  - verify 3-click commit
  - verify corner and midpoint handles
  - verify median line and fill
  - verify pan/zoom persistence

### Regression Trend

- Exact tool name: `Regression Trend`
- Category/section: `Lines > Channels`
- Live-capture evidence:
  - fresh May 19 selected capture shows the tool in a selected state with a floating toolbar and circular boundary handles
- Creation flow:
  - click point 1 to set left bound
  - move cursor to preview the regression span
  - click point 2 to set right bound
- Number of clicks: `2`
- Preview while drawing:
  - preview spans the x-range between point 1 and cursor
  - the regression channel is data-derived over that candle interval
- Anchor/handle positions:
  - fresh selected capture shows 4 circular handles, one on each visible band corner
  - no square midpoint handles were visible in the May 19 selected sample
  - the band also shows a dashed vertical boundary on the right side in selected state
- Drag behavior:
  - changing horizontal span changes sample window and fit
  - full-body drag should translate the selected interval
- Resize/edit behavior:
  - resize is mainly by changing start/end span points
- Tooltip behavior:
  - no floating measurement tooltip observed
  - official docs note optional Pearson's R text
- Text/label behavior:
  - earlier capture showed a small numeric coefficient-like label near lower-left
  - the May 19 live pass did not surface that coefficient label in the selected screenshot, so its visibility may depend on styling, zoom level, or object state
  - multiple right-axis labels mark band levels
- Colors/fills/styles:
  - upper boundary, lower boundary, center/base line, and band fill are individually styleable per official docs
  - official docs also support upper/lower deviation controls and right extension
- Fresh visual notes:
  - May 19 selected capture shows:
    - blue upper boundary
    - teal lower boundary
    - red center line
    - semi-transparent blue/teal band fill
- Selection/hover behavior:
  - selected sample shows band with visible edit state and toolbar
- Zoom/pan behavior:
  - regression is recomputed over the anchored interval, not just pixel-rescaled
- Edge cases:
  - too-small bar window
  - heavy volatility within selected range
  - extension-right enabled
- Remaining gap:
  - exact per-handle semantics during drag are better understood than before, but still need a slower live pass if we want handle-by-handle certainty beyond the 4-corner layout
- Test scenarios needed later:
  - verify 2-click commit
  - verify regression line plus band
  - verify Pearson's R toggle if implemented
  - verify interval-dependent geometry

### Flat Top/Bottom

- Exact tool name: `Flat Top/Bottom`
- Category/section: `Lines > Channels`
- Creation flow:
  - click A
  - move cursor to preview wedge/triangle zone
  - click B to finalize
- Number of clicks: `2`
- Preview while drawing:
  - one side remains flat while the opposite side slopes
- Anchor/handle positions:
  - two circular endpoint handles in selected state
- Drag behavior:
  - moving endpoints changes whether the shape behaves like a flat-top or flat-bottom formation
- Resize/edit behavior:
  - endpoint-driven shape editing
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - right-axis labels visible for upper/lower levels
- Colors/fills/styles:
  - orange/yellow default look in captured sample
  - semi-transparent fill
  - one horizontal edge and one sloped edge
- Selection/hover behavior:
  - selected state shows blue handles and toolbar
- Zoom/pan behavior:
  - geometric relationship remains chart-anchored
- Edge cases:
  - perfectly flat support/resistance at similar prices
  - very narrow x-span
- Test scenarios needed later:
  - verify 2-click creation
  - verify flat side flips correctly by anchor placement
  - verify fill and labels

### Disjoint Channel

- Exact tool name: `Disjoint Channel`
- Category/section: `Lines > Channels`
- Live-capture evidence:
  - fresh May 19 pass captured selected, unselected, and reselected screenshots from the public RELIANCE chart
- Creation flow:
  - click A
  - click B to finish segment one
  - click C to start segment two
  - click D to finish segment two
- Number of clicks: `4`
- Preview while drawing:
  - after A/B the first line is fixed
  - after C the second segment preview follows cursor
  - fill region emerges between the two disjoint segments
- Anchor/handle positions:
  - expected four circular anchor handles from the 4-anchor manifest model
  - however, the fresh May 19 selected/reselected captures showed the object selected with toolbar visible but did not clearly surface white-dot handles
  - current evidence therefore says the selection state is confirmed, while handle visibility remains ambiguous in automation
- Drag behavior:
  - each segment endpoint should independently reshape the hourglass/quadrilateral
  - body drag should translate the full object
- Resize/edit behavior:
  - four-point editing
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - no intrinsic text observed in the sample
- Colors/fills/styles:
  - green default styling
  - filled quadrilateral/hourglass between segments
- Selection/hover behavior:
  - fresh live pass confirms that the object can be selected and shows the floating toolbar
  - exact visible handle behavior remains a live gap because handles did not present clearly in the automated selected/reselected captures
- Zoom/pan behavior:
  - both disconnected segments remain chart-anchored
- Edge cases:
  - intersecting segments
  - nearly parallel segments
  - collapsed quadrilateral
- Test scenarios needed later:
  - verify 4-click creation
  - verify selected handle layout
  - verify independent anchor edits
- Remaining gap:
  - Disjoint Channel remains the one major handle-visibility hole after the May 19 pass

---

## Pitchforks

### Pitchfork

- Exact tool name: `Pitchfork`
- Category/section: `Lines > Pitchforks`
- Creation flow:
  - click A
  - click B
  - move cursor to preview fork geometry using cursor as C
  - click C to finalize
- Number of clicks: `3`
- Preview while drawing:
  - after B, median and outer rails preview relative to cursor-defined third point
- Anchor/handle positions:
  - three circular anchor handles visible in selected state
- Drag behavior:
  - A changes median origin
  - B/C alter slope and width
  - body drag should translate the whole fork
- Resize/edit behavior:
  - anchor-driven reshape
  - variant can be switched from context menu
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - right-axis labels appear on the rails
  - bottom date pills appear at anchor x positions
- Colors/fills/styles:
  - captured sample shows red median, blue rails, teal/green fill
  - official docs say TradingView supports additional lines, one-color mode, background toggle, and extend-lines option
- Selection/hover behavior:
  - selected state shows handles and toolbar
- Zoom/pan behavior:
  - median and rails remain chart-anchored
- Edge cases:
  - third point on opposite side of the initial trend line
  - highly compressed fork width
  - extra line sets enabled
- Test scenarios needed later:
  - verify 3-click creation
  - verify median through midpoint logic
  - verify context-menu variant switch

### Schiff Pitchfork

- Exact tool name: `Schiff Pitchfork`
- Category/section: `Lines > Pitchforks`
- Creation flow:
  - same 3-click sequence as Pitchfork
- Number of clicks: `3`
- Preview while drawing:
  - same family preview flow, but different origin geometry
- Anchor/handle positions:
  - three circular handles
- Drag behavior:
  - same family edit model as Pitchfork
- Resize/edit behavior:
  - anchor edits plus style/variant toggles
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - family labels and axis labels behave like Pitchfork
- Colors/fills/styles:
  - same family styling model
  - official docs say origin is shifted by half horizontal and half vertical distance between first two points
- Selection/hover behavior:
  - selected sample shows family edit state
- Zoom/pan behavior:
  - anchored like other forks
- Edge cases:
  - compare origin offset vs Original
  - verify additional lines
- Test scenarios needed later:
  - verify 3-click creation
  - verify Schiff-specific origin geometry
  - verify context-menu variant switch

### Modified Schiff Pitchfork

- Exact tool name: `Modified Schiff Pitchfork`
- Category/section: `Lines > Pitchforks`
- Creation flow:
  - same 3-click family sequence
- Number of clicks: `3`
- Preview while drawing:
  - same preview flow with modified origin placement
- Anchor/handle positions:
  - three circular handles
- Drag behavior:
  - same family move/edit model
- Resize/edit behavior:
  - anchor-driven reshape plus family style controls
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - family axis labels/levels behave like other forks
- Colors/fills/styles:
  - same family palette/fill model
  - official docs and context menu treat this as a switchable pitchfork variant
- Selection/hover behavior:
  - same selected family behavior
- Zoom/pan behavior:
  - chart-anchored
- Edge cases:
  - compare origin against Original and Schiff
- Test scenarios needed later:
  - verify 3-click creation
  - verify modified-origin geometry
  - verify family-style menu toggle

### Inside Pitchfork

- Exact tool name: `Inside Pitchfork`
- Category/section: `Lines > Pitchforks`
- Creation flow:
  - same 3-click family sequence
- Number of clicks: `3`
- Preview while drawing:
  - same preview flow with inside-origin geometry
- Anchor/handle positions:
  - three circular handles
- Drag behavior:
  - family-consistent anchor and body editing
- Resize/edit behavior:
  - anchor-driven reshape
- Tooltip behavior:
  - no measurement tooltip observed
- Text/label behavior:
  - family labels/levels/axis markers remain present
- Colors/fills/styles:
  - filled fork region remains present
  - official docs say the origin is at half horizontal and half vertical distance between the first two points and the style dialog exposes additional lines, one-color mode, background, and style conversion
- Selection/hover behavior:
  - selected capture shows family edit state and context menu variant switching
- Zoom/pan behavior:
  - chart-anchored
- Edge cases:
  - confirm inside geometry stays distinct from Original and Schiff when anchors are moved
- Test scenarios needed later:
  - verify 3-click creation
  - verify inside-origin geometry
  - verify context-menu variant switch

---

## Additional TradingView tools not observed in this panel capture

These are not part of the 17-tool captured line panel, but they are worth tracking so we do not confuse "not in this panel capture" with "does not exist in TradingView":

### Arrow

- TradingView public Drawings List includes `Arrow` in broader trend line tools.
- This repo's dedicated line-tool panel capture for RELIANCE does not include it in `_group-menu.png`.
- Separate automation already exists elsewhere in repo as `arrowTool`, under brush/shape capture work rather than this line-panel capture set.

### Anchored VWAP

- TradingView public Drawings List includes `Anchored VWAP` in trend line tools.
- This specific line-tool panel capture does not include it.
- The repo already has distinct forecasting/measurer parity work for `anchoredVwap`.

---

## Tool-type-specific test inventory to preserve

For every individual tool type above, later parity validation should cover:

- tool appears in correct section of the line-tool panel
- correct click count to commit
- preview state after each anchor
- selected-state handles and body handles
- right-click menu opens
- floating toolbar appears
- endpoint drag changes geometry correctly
- body drag translates whole object correctly
- zoom/pan persistence
- interval-switch stability
- text/stats/labels if supported
- fill opacity and style controls where applicable

## Remaining gaps

- selected-handle layout for Disjoint Channel still needs a stronger explicit handle screenshot or manual live observation
- Regression Trend handle semantics are improved by the May 19 live pass, but a slower handle-by-handle drag study would still sharpen the documentation
- hover-only cursor behavior is still lighter than ideal across the family
- panel discrepancy for Arrow and Anchored VWAP should be rechecked in a fresh live TradingView session before implementation starts
- the specific shared-layout URL with `QL1fWIPB` should be treated as access-dependent as of May 19, 2026

## Bottom line

The repo already contains substantial TradingView automation for this work. The missing piece was not raw test volume. It was a clean, tool-type-specific record of what each individual panel tool actually does in TradingView, what is already covered, and where the remaining evidence gaps still are.
