# Line / Channel / Pitchfork Implementation Plan

Last updated: May 19, 2026

This plan is intentionally tool-type-specific. It does not group all Lines, all Channels, or all Pitchforks into a single implementation bucket.

It is also implementation-planning only. No fixes are being applied in this step.

## Fresh evidence status

The latest live-capture pass on May 19, 2026 used 5 concurrent workers against TradingView's public RELIANCE chart URL after the originally requested shared-layout URL proved access-blocked in automation.

That pass materially improved evidence for:

- Trend Line
- Regression Trend
- Disjoint Channel selection state

It also surfaced one exact naming detail that matters for automation:

- live TradingView menu label: `Trendline`
- repo/tool naming: `Trend Line` / `trend`

## Scope of plan

Observed in the captured TradingView line-tool panel:

### Lines

- Trend Line
- Ray
- Info Line
- Extended Line
- Trend Angle
- Horizontal Line
- Horizontal Ray
- Vertical Line
- Cross Line

### Channels

- Parallel Channel
- Regression Trend
- Flat Top/Bottom
- Disjoint Channel

### Pitchforks

- Pitchfork
- Schiff Pitchfork
- Modified Schiff Pitchfork
- Inside Pitchfork

Not in this panel capture, but tracked elsewhere in repo:

- Arrow
- Anchored VWAP

## Scope boundary confirmed from git history

This plan applies only to the Mohit-authored line/channel/pitchfork automation lane, not to the later Jatin-authored 27-tool production parity harness.

In practice that means:

- in scope:
  - the 17 line/channel/pitchfork tools listed in this plan
  - the parity specs and capture assets directly tied to `scripts/capture-tv-line-tools.mjs`
- out of scope for this plan:
  - `tv-capture-factory.ts`
  - `prod-parity-shared-factory.ts`
  - forecasting, measurement, brush, icon, and unrelated text families introduced in the broader 27-tool production harness

This boundary exists so we do not accidentally mix our line-tool parity work with another contributor's separate TradingView automation lane.

## Implementation rules before coding

- Do not discard current local changes.
- Do not overwrite previous coverage notes.
- Use [LINE_CHANNEL_PITCHFORK_COVERAGE.md](./LINE_CHANNEL_PITCHFORK_COVERAGE.md) as the behavior brief.
- Reconcile stale parity assumptions before trusting older specs.
- Treat `TradingChart.tsx` local hook removals as suspicious until reviewed.

## Priority order

1. Fix and freeze tool registration and anchor-count assumptions.
2. Implement or verify per-tool geometry and handle model.
3. Implement toolbar/settings parity details only after geometry is correct.
4. Run per-tool parity suites.

## Tool-by-tool implementation plan

## Lines

### Trend Line

- Status:
  - implementation exists
  - basic live-capture evidence now exists
- Key parity goals:
  - 2-click creation
  - finite segment
  - endpoint handles plus body drag
  - optional stats/text parity
- Risks:
  - automation can fail if it looks for `Trend Line` instead of live menu label `Trendline`
- Required before coding:
  - no longer blocked on baseline screenshot evidence
  - still useful to add a hover-focused capture later

### Ray

- Status:
  - implementation exists
  - automation and captures exist
- Key parity goals:
  - one-sided extension past B
  - midpoint/body handle
  - optional stats/text support
  - price-label behavior
- Review focus:
  - body hit area
  - direction-handle semantics
  - stat-label placement

### Info Line

- Status:
  - implementation likely partial
  - captures exist
- Key parity goals:
  - central multi-line stats pill
  - delta, percent, bars, distance, angle formatting
  - live metric updates during drag
- Review focus:
  - exact metric formatting
  - pill anchoring and selection behavior

### Extended Line

- Status:
  - implementation exists
  - captures exist
- Key parity goals:
  - infinite extension both directions
  - midpoint/body handle
  - optional stats support
- Review focus:
  - both-side extension clipping
  - midpoint visibility toggle behavior

### Trend Angle

- Status:
  - implementation likely partial
  - captures exist
- Key parity goals:
  - horizontal reference dash from A
  - angle label at origin area
  - endpoint editing
- Review focus:
  - angle-label placement
  - reference-dash rendering under zoom

### Horizontal Line

- Status:
  - implementation exists
  - captures exist
- Key parity goals:
  - one-click creation
  - full-width infinite line
  - right-axis price label
  - `+ Add text`
- Review focus:
  - single-anchor move semantics
  - text affordance and inline edit behavior

### Horizontal Ray

- Status:
  - implementation exists
  - captures exist
- Key parity goals:
  - one-click creation
  - left anchor with right-only extension
  - right-axis label
- Review focus:
  - start-point editing
  - clip/extend behavior

### Vertical Line

- Status:
  - implementation exists
  - captures exist
- Key parity goals:
  - one-click creation
  - full-height line
  - date pill
  - `+ Add text`
- Review focus:
  - single-anchor drag model
  - bottom-axis label persistence

### Cross Line

- Status:
  - implementation likely partial
  - captures exist
- Key parity goals:
  - one-click creation
  - full-width plus full-height cross
  - single center anchor
  - date and price labels
- Review focus:
  - center-handle hit area
  - axis-label toggles

## Channels

### Parallel Channel

- Status:
  - active implementation changes already present locally
  - captured TradingView behavior exists
- Key parity goals:
  - 3-click wizard
  - two rails, dashed median, fill
  - 4 corner handles + square midpoint/body handles
- Review focus:
  - anchor count must stay at 3, not 2
  - midpoint handle semantics
  - toolbar and context-menu parity

### Regression Trend

- Status:
  - implementation likely incomplete or approximate
  - captures, official docs, and fresh live selected-state evidence exist
- Key parity goals:
  - 2-click interval selection
  - regression line and deviation band
  - optional Pearson's R text
  - deviation controls
- Review focus:
  - true data-derived channel math
  - upper/lower deviation handling
  - extend-right behavior
  - 4-corner handle semantics from fresh live pass

### Flat Top/Bottom

- Status:
  - active implementation changes already present locally
  - captures exist
- Key parity goals:
  - 2-click shape
  - flat upper or lower edge depending on anchors
  - orange/yellow fill look
- Review focus:
  - side-selection logic
  - handle behavior under inverted anchor order

### Disjoint Channel

- Status:
  - active implementation changes already present locally
  - captures exist
- Key parity goals:
  - 4-click creation
  - two disconnected segments
  - filled hourglass/quadrilateral region
- Review focus:
  - anchor count must stay 4
  - selected handle model still needs stronger explicit validation
  - local stale specs still assume drag-style behavior

## Pitchforks

### Pitchfork

- Status:
  - implementation exists
  - active local geometry edits exist
  - captures exist
- Key parity goals:
  - 3-click family workflow
  - median line, rails, fills, optional additional lines
  - context-menu variant switching
- Review focus:
  - local specs assuming drag must be corrected
  - median geometry and extra-line support

### Schiff Pitchfork

- Status:
  - implementation exists
  - captures and official docs exist
- Key parity goals:
  - same 3-click family flow
  - Schiff origin geometry
  - shared family style controls
- Review focus:
  - origin calculation
  - variant switching consistency

### Modified Schiff Pitchfork

- Status:
  - implementation exists
  - captures and official docs exist
- Key parity goals:
  - same 3-click family flow
  - modified-origin geometry distinct from Schiff
- Review focus:
  - midpoint/origin calculation
  - family context-menu parity

### Inside Pitchfork

- Status:
  - implementation exists
  - captures and official docs exist
- Key parity goals:
  - same 3-click family flow
  - inside-origin geometry
  - additional-line and background support
- Review focus:
  - distinct geometry vs Original and Schiff
  - fill and extra-line behavior

## Pre-implementation cleanup tasks

These are not app fixes yet. They are decision gates we need before coding:

1. Confirm which local edits are intentional parity implementation work and which are leftovers.
2. Reconcile old parity specs that still assume:
   - `channel` has 2 anchors
   - `disjointChannel` commits by drag
   - pitchfork family commits by drag
3. Preserve automation/debug hooks in `TradingChart.tsx` until parity work is complete.
4. Decide whether `Arrow` and `Anchored VWAP` should be added to this specific line-panel parity track or kept in their existing non-panel tracks.
5. Update any live-capture automation that still searches for `Trend Line` instead of `Trendline` in TradingView's menu.

## Validation sequence for later

For each tool type, later execution should follow this order:

1. update implementation only after behavior brief is accepted
2. run tool-specific parity suite
3. compare rendered behavior with existing TradingView capture
4. patch handle/label/context-menu gaps
5. re-run the same tool suite
6. only then move to the next tool

## Queue completion status for this lane

For the fresh May 19 continuation pass, the shared queue for this lane consisted only of the 17 in-scope line/channel/pitchfork tools.

Result:

- queue processed with 5 concurrent workers
- 16 tools completed in the main shared-queue run on the public RELIANCE chart
- `Trend Line` required a targeted follow-up because the live TradingView menu label is `Trendline`
- after that follow-up, the line/channel/pitchfork queue for this lane was fully covered again at the research level

## Deliverable checklist for each tool type

Before calling any single tool "done", we should have:

- correct tool registration
- correct anchor count
- correct creation flow
- correct preview behavior
- correct selected handles
- correct drag/edit behavior
- correct labels/stats/text behavior
- correct fill/style behavior if applicable
- passing or explainable parity tests
- no regression to automation hooks
- live TradingView label/selector assumptions verified against the current site

## Bottom line

This implementation plan is now tool-type-specific for all 17 panel tools. It should be used alongside the coverage brief, not instead of it.
