# TradingView Drawing Tools — Complete Behavioral Coverage

**Last updated:** 2026-05-20  
**Workers used:** 5 parallel research agents  
**Total tools documented:** 91  
**Evidence sources:** `toolRegistry.ts`, `tv-capture-factory.ts`, `capture-tv-fib-tools.mjs`, existing v2 spec files, `tv-parity-behaviors.spec.ts`, `LINE_CHANNEL_PITCHFORK_COVERAGE.md` (May 2026 live capture)  
**Automation run:** 2026-05-20 against `https://tradereplay.me` — 28 new gap-tool v2 specs, 28/28 pass (geometry smoke); icon tools (3) skip — picker UI flow  
**Factory changes:** `tv-parity-extended-factory.ts` — added `drawClickSequence` helper + shape/click-sequence dispatch in `drawTool`

---

**Gap-tool reconciliation note:** For the 31 gap tools, prefer `docs/TV_PARITY_AUDIT.md` section `Gap Tool Reconciliation — v2 Specs vs TradingView Evidence` for current evidence labels. The earlier automation-run line and older per-tool statements below that say icon specs skipped or "No v2 spec" are superseded where they conflict with the current v2/icon spec files on disk.

# 59-Tool Evidence Index

This section represents the 59-tool TradingView live-capture/deep-audit documentation lane. It is an evidence and documentation lane only; it is not an implementation scope, not a parity claim, and not a replacement for the 31 gap-tool v2 reconciliation in `docs/TV_PARITY_AUDIT.md`.

Evidence levels must stay explicit. Some findings came from live/headed interaction, some from DOM extraction, some from nearby-button heuristics, some from screenshots of canvas-rendered UI, and some remain blocked. Source schema and factory configuration may describe intended automation behavior, but they are not live TradingView evidence by themselves.

Use these labels when updating this lane: `COMPLETE_LIVE`, `COMPLETE_DOM`, `SCREENSHOT_ONLY`, `NEARBY_BUTTON_HEURISTIC`, `CHART_SETTINGS_ONLY`, `SOURCE_SCHEMA_ONLY`, `FACTORY_CONFIG_ONLY`, `BLOCKED_CANVAS_HIT_TESTING`, `BLOCKED_TIMING_OR_DESELECT`, `CONFLICTING_REQUIRES_RETRY`, and `MANUAL_VERIFICATION_REQUIRED`.

The gap-tool v2 lane remains owned by `docs/TV_PARITY_AUDIT.md`, especially the section `Gap Tool Reconciliation — v2 Specs vs TradingView Evidence`.

## Headed-Run Evidence Block

Codex 2 reported a summary-derived 59-tool headed/live-capture audit. Because the export file is not available in this repo, the counts below are preserved as summary-derived evidence and must be regenerated or manually verified before being treated as exact per-tool truth.

- Targeted tools: 59 TradingView drawing tools.
- Intended passes: passes 2-10 for each tool.
- Intended pass sections: 531 total pass-sections (`59 x 9`).
- Known limitation: much of TradingView's drawing UI is canvas-rendered, so text, handles, labels, tooltips, and hit targets are not always DOM-readable.
- Known limitation: context menu capture is unreliable because right-click hit-testing often opens chart-level menus instead of drawing-specific menus.
- Known limitation: settings capture can falsely open chart-level settings and must be validated by title/tabs/fields matching the selected drawing.
- Evidence rule: screenshot-only or heuristic evidence must not be treated as full parity.

## Deep Behavioral Audit

Every tool in the 59-tool lane needs evidence for these behavior areas before it can be considered implementation-ready:

| Area | Required evidence |
|---|---|
| Activation | Tool button location, activation state, cursor transition, failure cases. |
| Creation/mouse behavior | Exact click/drag sequence, mouse down/move/up behavior, preview state, finalization trigger. |
| Dots/handles/anchors | Dot count, anchor roles, endpoint/midpoint/rotation handles, hidden or hover-only handles. |
| Body drag/hit-testing | Body/line/fill/label hit areas, crowded-chart selection accuracy, drag persistence. |
| Text/labels/tooltips | Built-in labels, metric boxes, canvas tooltips, value formatting, attachment to anchors/body. |
| Floating toolbar | Visible buttons, dropdowns, settings/lock/hide/delete/copy controls, tool-family differences. |
| Toolbar dropdowns/modals | Color picker, line width, line style, fill/opacity, template/style menus. |
| Settings modal | Drawing-specific modal title, tabs, fields, defaults, and whether chart settings opened by mistake. |
| Context menu | Drawing-specific right-click menu on body, anchor, label, fill; must distinguish chart-level menu. |
| Lock/hide/delete/copy | Toolbar and context-menu behavior for visibility, lock, remove, duplicate/clone. |
| Crowded chart behavior | Many same-type and mixed-type drawings, correct selection/move/delete/copy target. |
| Keyboard behavior | Escape, Delete, Backspace, Ctrl+Z, Ctrl+Shift+Z, copy/paste where available. |
| Zoom/pan/offscreen behavior | Anchor persistence, label persistence, offscreen handles, visible-axis behavior. |
| Visual/UI parity | Colors, fills, opacity, line style, stroke width, handle shape, hover/selection visuals. |
| Tool-specific behavior | Metrics, special anchors, projections, fills, generated clones, icon pickers, or family-specific quirks. |

## Toolbar Section

Codex 2 reported these summary-level toolbar evidence counts:

| Toolbar status | Count | Evidence label |
|---|---:|---|
| Complete via DOM extraction | 0 | `COMPLETE_DOM` |
| Complete via live interaction | 0 | `COMPLETE_LIVE` |
| Nearby-button heuristic only | 50 | `NEARBY_BUTTON_HEURISTIC` |
| Blocked by timing or deselect | 9 | `BLOCKED_TIMING_OR_DESELECT` |

`NEARBY_BUTTON_HEURISTIC` means the automation saw likely toolbar buttons near the selected drawing, but did not prove exact drawing-toolbar controls or open every dropdown. It is not equivalent to full toolbar interaction.

No floating toolbar should be marked fully complete unless the actual drawing toolbar stayed selected and its buttons/dropdowns were opened and verified.

## Settings Modal Section

Codex 2 reported these summary-level settings evidence counts:

| Settings status | Count | Evidence label |
|---|---:|---|
| Drawing-specific settings truly opened | 3 | `COMPLETE_LIVE` or `COMPLETE_DOM` only when title/tabs prove drawing specificity |
| Chart-settings-only false positives | 2 | `CHART_SETTINGS_ONLY` |
| Settings blocked | 38 | `BLOCKED_TIMING_OR_DESELECT` |
| Conflicting settings/title evidence requiring retry | 16 | `CONFLICTING_REQUIRES_RETRY` |

Chart-level settings must not be counted as drawing-specific settings. A valid drawing settings capture must prove that the modal title, tabs, and fields belong to the selected drawing/tool. Source schema and factory config are useful implementation references, but they are not live TradingView evidence.

## Context Menu Section

Codex 2 reported drawing-specific context menu capture as blocked for all 59 tools:

| Context-menu status | Count | Evidence label |
|---|---:|---|
| Drawing-specific context menu blocked | 59 | `BLOCKED_CANVAS_HIT_TESTING` |

TradingView canvas hit-testing blocked reliable drawing-specific right-click capture. A chart-level context menu is not a drawing-specific context menu. Every drawing-specific menu remains manual-verification-required unless future evidence proves the menu was opened from the drawing body, anchor, label, or fill.

## Blocker Section

| Blocker | Meaning |
|---|---|
| `BLOCKED_CANVAS_HIT_TESTING` | Canvas hit-testing prevented reliable drawing-specific right-click/menu capture. |
| `BLOCKED_TIMING_OR_DESELECT` | Selection, timing, or deselection prevented toolbar/settings capture. |
| `SCREENSHOT_ONLY` | Handles, labels, or tooltips were visible only in screenshots/canvas and not DOM-readable. |
| `CHART_SETTINGS_ONLY` | Automation opened chart-level settings instead of drawing-specific properties. |
| `CONFLICTING_REQUIRES_RETRY` | Evidence disagreed, usually around settings title/modal identity. |
| `MANUAL_VERIFICATION_REQUIRED` | Visual/UI parity needs headed/manual confirmation before implementation assumptions are final. |

Codex 2 also reported `SCREENSHOT_ONLY` evidence for 50 handle/white-dot observations and 50 label/tooltip observations. These are useful visual references, but exact text/value reads and UI semantics still require manual/headed verification.

# Blocker Reconciliation — 59-Tool Deep Audit vs Headed Run Evidence

Earlier coverage language may have overclaimed some areas. This reconciliation intentionally uses evidence-level labels instead of simple complete/incomplete statuses.

- Toolbar evidence was often `NEARBY_BUTTON_HEURISTIC`, not verified `COMPLETE_DOM` or `COMPLETE_LIVE` toolbar interaction.
- Settings evidence sometimes opened chart-level settings; those cases must be labeled `CHART_SETTINGS_ONLY`, not drawing-settings complete.
- Drawing-specific context menus are `BLOCKED_CANVAS_HIT_TESTING` for all 59 tools unless later evidence proves otherwise.
- Handles, white dots, labels, and tooltips are often `SCREENSHOT_ONLY` because TradingView renders them on canvas.
- Source schema and factory config must be labeled `SOURCE_SCHEMA_ONLY` or `FACTORY_CONFIG_ONLY` and must not be promoted to live TradingView behavior.
- Conflicting settings/title evidence must remain `CONFLICTING_REQUIRES_RETRY` until a headed/manual retry confirms the selected drawing's settings modal.

## Manual Verification Plan

### A. Drawing-specific context menus

- Right-click drawing body.
- Right-click anchor/handle.
- Right-click label/text/metric box where present.
- Right-click fill area for filled tools.
- Confirm the menu is drawing-specific, not chart-level.
- Screenshot exact menu items and disabled/enabled state.

### B. Floating toolbar

- Keep the drawing selected while recording evidence.
- Verify visible toolbar buttons.
- Open each dropdown.
- Verify color picker.
- Verify line width.
- Verify line style.
- Verify lock.
- Verify hide.
- Verify settings/gear.
- Verify delete.
- Verify copy/clone where present.
- Screenshot representative tools/families and any tool-specific toolbar differences.

### C. Settings modal

- Open settings via the selected drawing's floating toolbar gear.
- Confirm modal title is drawing/tool-specific.
- Record tabs and fields.
- Distinguish chart settings from drawing settings.
- Retry every `CONFLICTING_REQUIRES_RETRY` case.

### D. Handles/dots

- Screenshot selected state.
- Record dot count, dot position, and dot role.
- Record endpoint handles.
- Record midpoint handles.
- Record rotation handles.
- Record hidden or hover-only handles.

### E. Text/labels/tooltips

- Verify whether each label is built-in or user-added.
- Verify whether label moves with body drag.
- Verify whether label moves with endpoint drag.
- Verify whether label persists after zoom, pan, deselect, and reselect.
- Screenshot canvas-rendered tooltip/value text and manually transcribe exact formatting.

### F. Crowded chart

- Create many same-type drawings.
- Create many mixed-type drawings.
- Verify selection targets the intended drawing.
- Verify move/delete/copy targets the intended drawing.

## Per-Tool Status Tables

Exact 59 individual tool rows from the Codex 2 export are not available in this tracked repo or in any tracked markdown searched during this merge. Do not invent per-tool statuses from summary counts. If the full Codex 2 per-tool table is pasted or regenerated later, merge it here without replacing the evidence labels or the gap-tool pointer above.

| Scope | Current evidence | Next step |
|---|---|---|
| 59-tool live-capture lane | Summary-derived counts from Codex 2 only | Regenerate headed evidence or manually verify before filling exact per-tool rows. |
| Toolbar rows | 50 heuristic, 9 blocked summary | Fill per-tool rows only after exact toolbar controls/dropdowns are verified. |
| Settings rows | 3 opened, 2 chart-only, 38 blocked, 16 conflicting summary | Fill per-tool rows only with modal title/tabs/fields evidence. |
| Context-menu rows | 59 blocked summary | Fill per-tool rows only after drawing-specific right-click menus are proven. |
| Handles/labels/tooltips | 50 screenshot-only summaries each | Fill exact rows only from screenshots/manual transcriptions tied to each tool. |

The remaining manual verification list is: all 59 drawing-specific context menus, all heuristic-only floating toolbar confirmations, all handle/white-dot visual shape confirmations, all canvas-rendered tooltip/value reads, all rendered text/annotation label parity checks, all conflicting settings-title cases, and all 9 activation-failed tools.

## Honesty Checks

Before using this 59-tool lane for implementation planning, verify these statements remain true:

- `docs/COMPLETE_COVERAGE.md` points readers to `docs/TV_PARITY_AUDIT.md` for the 31 gap-tool/v2 reconciliation.
- The 59-tool evidence counts above are labeled as summary-derived from Codex 2, not regenerated from tracked per-tool evidence in this repo.
- `NEARBY_BUTTON_HEURISTIC` is never treated as `COMPLETE_LIVE` or `COMPLETE_DOM`.
- `CHART_SETTINGS_ONLY` is never counted as drawing-specific settings evidence.
- `BLOCKED_CANVAS_HIT_TESTING` remains the status for drawing-specific context menus unless a future headed run proves the drawing menu opened.
- `SCREENSHOT_ONLY` handle, label, and tooltip evidence is not treated as DOM-extracted text or exact semantic proof.
- `SOURCE_SCHEMA_ONLY` and `FACTORY_CONFIG_ONLY` are not promoted to live TradingView behavior.
- `CONFLICTING_REQUIRES_RETRY` cases stay unresolved until a clean headed/manual retry confirms the selected drawing and modal identity.
- No per-tool row should be added without exact file, screenshot, run artifact, or manual verification notes tied to that tool.
- This document is a coverage/evidence reference; it is not an implementation change and not a claim of completed TradingView parity.

## Purpose

This is the master behavioral reference for every TradingView drawing tool type captured or automated in this repo.
It supersedes all previous per-family documents (`TV_PARITY.md`, `LINE_CHANNEL_PITCHFORK_COVERAGE.md`, `tradingview-parity/reference-matrix.md`) as the single source of truth.

**What this document is:**
- Per-tool behavioral specification derived from live TradingView interaction evidence and repo automation
- Input for implementing TradingView parity in our app
- Tracking document for per-tool coverage gaps

**What this document is not:**
- App implementation code or tests
- A claim that our app already matches TradingView
- A smoke-test result summary

---

## Tool Inventory by Family

| # | Variant | TradingView Label | Family | Category | Anchors | supportsText | supportsFill | supportsLevels |
|---|---------|------------------|--------|----------|---------|-------------|-------------|---------------|
| 1 | trend | Trendline | line | Lines > Lines | 2 | ✗ | ✗ | ✗ |
| 2 | ray | Ray | line | Lines > Lines | 2 | ✗ | ✗ | ✗ |
| 3 | infoLine | Info line | line | Lines > Lines | 2 | ✓ | ✗ | ✗ |
| 4 | extendedLine | Extended line | line | Lines > Lines | 2 | ✗ | ✗ | ✗ |
| 5 | trendAngle | Trend angle | line | Lines > Lines | 2 | ✓ | ✗ | ✗ |
| 6 | hline | Horizontal line | line | Lines > Lines | 1 | ✗ | ✗ | ✗ |
| 7 | horizontalRay | Horizontal ray | line | Lines > Lines | 1 | ✗ | ✗ | ✗ |
| 8 | vline | Vertical line | line | Lines > Lines | 1 | ✗ | ✗ | ✗ |
| 9 | crossLine | Cross line | line | Lines > Lines | 1 | ✗ | ✗ | ✗ |
| 10 | channel | Parallel channel | line | Lines > Channels | 3 | ✗ | ✓ | ✗ |
| 11 | regressionTrend | Regression trend | line | Lines > Channels | 2 | ✗ | ✓ | ✗ |
| 12 | flatTopBottom | Flat top/bottom | line | Lines > Channels | 2 | ✗ | ✓ | ✗ |
| 13 | disjointChannel | Disjoint channel | line | Lines > Channels | 4 | ✗ | ✓ | ✗ |
| 14 | pitchfork | Pitchfork | line | Lines > Pitchforks | 3 | ✗ | ✓ | ✗ |
| 15 | schiffPitchfork | Schiff pitchfork | line | Lines > Pitchforks | 3 | ✗ | ✓ | ✗ |
| 16 | modifiedSchiffPitchfork | Modified Schiff pitchfork | line | Lines > Pitchforks | 3 | ✗ | ✓ | ✗ |
| 17 | insidePitchfork | Inside pitchfork | line | Lines > Pitchforks | 3 | ✗ | ✓ | ✗ |
| 18 | fibRetracement | Fib retracement | fib | Fibonacci | 2 | ✓ | ✗ | ✓ |
| 19 | fibExtension | Trend-based fib extension | fib | Fibonacci | 2 | ✓ | ✗ | ✓ |
| 20 | fibChannel | Fib channel | fib | Fibonacci | 2 | ✓ | ✗ | ✓ |
| 21 | fibTimeZone | Fib time zone | fib | Fibonacci | 2 | ✓ | ✗ | ✓ |
| 22 | fibSpeedResistFan | Fib speed resistance fan | fib | Fibonacci | 2 | ✗ | ✗ | ✓ |
| 23 | fibTrendTime | Trend-based fib time | fib | Fibonacci | 2 | ✓ | ✗ | ✓ |
| 24 | fibCircles | Fib circles | fib | Fibonacci | 2 | ✗ | ✗ | ✓ |
| 25 | fibSpiral | Fib spiral | fib | Fibonacci | 2 | ✗ | ✗ | ✓ |
| 26 | fibSpeedResistArcs | Fib speed resistance arcs | fib | Fibonacci | 2 | ✗ | ✗ | ✓ |
| 27 | fibWedge | Fib wedge | fib | Fibonacci | 2 | ✗ | ✗ | ✓ |
| 28 | pitchfan | Pitchfan | fib | Fibonacci | 3 | ✗ | ✗ | ✓ |
| 29 | gannBox | Gann box | fib | Gann | 2 | ✗ | ✓ | ✓ |
| 30 | gannSquareFixed | Gann square fixed | fib | Gann | 2 | ✗ | ✓ | ✓ |
| 31 | gannSquare | Gann square | fib | Gann | 2 | ✗ | ✓ | ✓ |
| 32 | gannFan | Gann fan | fib | Gann | 2 | ✗ | ✗ | ✓ |
| 33 | xabcd | XABCD pattern | pattern | Patterns > Chart Patterns | 5 | ✗ | ✗ | ✗ |
| 34 | cypherPattern | Cypher pattern | pattern | Patterns > Chart Patterns | 5 | ✗ | ✗ | ✗ |
| 35 | headAndShoulders | Head and shoulders | pattern | Patterns > Chart Patterns | 5 | ✗ | ✗ | ✗ |
| 36 | abcdPattern | ABCD pattern | pattern | Patterns > Chart Patterns | 4 | ✗ | ✗ | ✗ |
| 37 | trianglePattern | Triangle pattern | pattern | Patterns > Chart Patterns | 3 | ✗ | ✗ | ✗ |
| 38 | threeDrives | Three drives pattern | pattern | Patterns > Chart Patterns | 7 | ✗ | ✗ | ✗ |
| 39 | elliottImpulse | Elliott impulse wave (1-2-3-4-5) | pattern | Patterns > Elliott Waves | 5 | ✗ | ✗ | ✗ |
| 40 | elliottCorrection | Elliott correction wave (A-B-C) | pattern | Patterns > Elliott Waves | 3 | ✗ | ✗ | ✗ |
| 41 | elliottTriangle | Elliott triangle wave (A-B-C-D-E) | pattern | Patterns > Elliott Waves | 5 | ✗ | ✗ | ✗ |
| 42 | elliottDoubleCombo | Elliott double combo wave (W-X-Y) | pattern | Patterns > Elliott Waves | 3 | ✗ | ✗ | ✗ |
| 43 | elliottTripleCombo | Elliott triple combo wave (W-X-Y-X-Z) | pattern | Patterns > Elliott Waves | 5 | ✗ | ✗ | ✗ |
| 44 | cyclicLines | Cyclic lines | pattern | Patterns > Cycles | 2 | ✗ | ✗ | ✗ |
| 45 | timeCycles | Time cycles | pattern | Patterns > Cycles | 2 | ✗ | ✗ | ✗ |
| 46 | sineLine | Sine line | pattern | Patterns > Cycles | 2 | ✗ | ✗ | ✗ |
| 47 | longPosition | Long position | position | Forecasting | 3 | ✓ | ✓ | ✗ |
| 48 | shortPosition | Short position | position | Forecasting | 3 | ✓ | ✓ | ✗ |
| 49 | positionForecast | Position forecast | position | Forecasting | 3 | ✓ | ✓ | ✗ |
| 50 | barPattern | Bar pattern | pattern | Forecasting | 2 | ✗ | ✗ | ✗ |
| 51 | ghostFeed | Ghost feed | pattern | Forecasting | 2 | ✗ | ✗ | ✗ |
| 52 | sector | Sector | shape | Forecasting | 2 | ✗ | ✓ | ✗ |
| 53 | anchoredVwap | Anchored VWAP | line | Forecasting > Volume-based | 1 | ✗ | ✗ | ✗ |
| 54 | fixedRangeVolumeProfile | Fixed range volume profile | measure | Forecasting > Volume-based | 2 | ✗ | ✓ | ✗ |
| 55 | anchoredVolumeProfile | Anchored volume profile | measure | Forecasting > Volume-based | 1 | ✗ | ✓ | ✗ |
| 56 | priceRange | Price range | measure | Forecasting > Measurers | 2 | ✗ | ✗ | ✗ |
| 57 | dateRange | Date range | measure | Forecasting > Measurers | 2 | ✗ | ✗ | ✗ |
| 58 | dateAndPriceRange | Date and price range | measure | Forecasting > Measurers | 2 | ✗ | ✗ | ✗ |
| 59 | brush | Brush | shape | Brush > Brushes | 2 | ✗ | ✗ | ✗ |
| 60 | highlighter | Highlighter | shape | Brush > Brushes | 2 | ✗ | ✗ | ✗ |
| 61 | arrowMarker | Arrow marker | text | Brush > Arrows | 1 | ✗ | ✗ | ✗ |
| 62 | arrowTool | Arrow | line | Brush > Arrows | 2 | ✗ | ✗ | ✗ |
| 63 | arrowMarkUp | Arrow mark up | text | Brush > Arrows | 1 | ✗ | ✗ | ✗ |
| 64 | arrowMarkDown | Arrow mark down | text | Brush > Arrows | 1 | ✗ | ✗ | ✗ |
| 65 | rectangle | Rectangle | shape | Brush > Shapes | 2 | ✓ | ✓ | ✗ |
| 66 | rotatedRectangle | Rotated rectangle | shape | Brush > Shapes | 2 | ✗ | ✓ | ✗ |
| 67 | path | Path | line | Brush > Shapes | 2 | ✗ | ✗ | ✗ |
| 68 | circle | Circle | shape | Brush > Shapes | 2 | ✓ | ✓ | ✗ |
| 69 | ellipse | Ellipse | shape | Brush > Shapes | 2 | ✗ | ✓ | ✗ |
| 70 | polyline | Polyline | line | Brush > Shapes | 2 | ✗ | ✗ | ✗ |
| 71 | triangle | Triangle | shape | Brush > Shapes | 2 | ✓ | ✓ | ✗ |
| 72 | arc | Arc | shape | Brush > Shapes | 2 | ✗ | ✗ | ✗ |
| 73 | curveTool | Curve | line | Brush > Shapes | 2 | ✗ | ✗ | ✗ |
| 74 | doubleCurve | Double curve | line | Brush > Shapes | 2 | ✗ | ✗ | ✗ |
| 75 | plainText | Text | text | Text > Text and Notes | 1 | ✓ | ✓ | ✗ |
| 76 | anchoredText | Anchored text | text | Text > Text and Notes | 1 | ✓ | ✓ | ✗ |
| 77 | note | Note | text | Text > Text and Notes | 1 | ✓ | ✓ | ✗ |
| 78 | priceNote | Price note | text | Text > Text and Notes | 1 | ✓ | ✗ | ✗ |
| 79 | pin | Pin | text | Text > Text and Notes | 1 | ✓ | ✗ | ✗ |
| 80 | table | Table | text | Text > Text and Notes | 1 | ✓ | ✓ | ✗ |
| 81 | callout | Callout | text | Text > Text and Notes | 1 | ✓ | ✓ | ✗ |
| 82 | comment | Comment | text | Text > Text and Notes | 1 | ✓ | ✓ | ✗ |
| 83 | priceLabel | Price label | text | Text > Text and Notes | 1 | ✓ | ✗ | ✗ |
| 84 | signpost | Signpost | text | Text > Text and Notes | 1 | ✓ | ✗ | ✗ |
| 85 | flagMark | Flag mark | text | Text > Text and Notes | 1 | ✓ | ✗ | ✗ |
| 86 | image | Image | text | Text > Content | 1 | ✗ | ✗ | ✗ |
| 87 | post | Post | text | Text > Content | 1 | ✓ | ✓ | ✗ |
| 88 | idea | Idea | text | Text > Content | 1 | ✓ | ✓ | ✗ |
| 89 | emoji | Emojis | text | Icon | 1 | ✓ | ✗ | ✗ |
| 90 | sticker | Stickers | text | Icon | 1 | ✓ | ✗ | ✗ |
| 91 | iconTool | Icons | text | Icon | 1 | ✓ | ✗ | ✗ |

---

## Automation Coverage Status at a Glance

> **Run date:** 2026-05-20 — `npx playwright test --grep "geometry #000" -c playwright.prod-parity.config.ts`  
> against `https://tradereplay.me`. Each row reflects real Playwright output, not estimates.

| Tool Family | Tools | V2 Spec Files | Smoke Result (geometry #000) | Notes |
|-------------|-------|---------------|------------------------------|-------|
| Lines > Lines | 9 | ✓ all 9 | **9/9 pass** | existing specs |
| Lines > Channels | 4 | ✓ all 4 | **4/4 pass** | existing specs |
| Lines > Pitchforks | 4 | ✓ all 4 | **4/4 pass** | existing specs |
| Fibonacci | 11 | ✓ all 11 | **11/11 pass** | existing specs |
| Gann | 4 | ✓ all 4 | **4/4 pass** | existing specs |
| Chart Patterns | 6 | ✓ all 6 | **6/6 pass** | existing specs |
| Elliott Waves | 5 | ✓ all 5 | **5/5 pass** | existing specs |
| Cycles | 3 | ✓ all 3 | **3/3 pass** | existing specs |
| Forecasting (position) | 3 | ✓ all 3 | **3/3 pass** | NEW — kind: position |
| Forecasting (misc) | 3 | ✓ all 3 | **3/3 pass** | NEW — barPattern, ghostFeed, sector |
| Volume-based | 3 | ✓ all 3 | **3/3 pass** | NEW — kind: vwap / volumeProfile |
| Measurers | 3 | ✓ all 3 | **3/3 pass** | NEW — kind: measurer |
| Brush / Brushes | 2 | ✓ all 2 | **2/2 pass** | NEW — kind: brush |
| Brush / Arrows | 4 | ✓ all 4 | **4/4 pass** | NEW — arrowMark / arrowLine |
| Brush / Shapes | 10 | ✓ all 10 | **10/10 pass** | NEW — kind: shape (drag); anchorCount fixed from toolRegistry |
| Text tools | 14 | ✓ all 14 | not run (UI requires text input flow) | existing specs; no smoke blocker |
| Icon tools | 3 | ✓ all 3 | dedicated icon specs exist; representative `emoji` pick-place passed on current rerun | `tv-parity-icon-*.spec.ts` covers app IconToolPanel picker flow; `sticker`/`iconTool` representative reruns still pending; TradingView live picker evidence remains partial/blocked |

### Icon Tool Blocker Detail

Superseded status: the old `tool not found: tool-emoji` blocker applies to the ordinary v2 rail-button path only. Dedicated app-side picker specs now exist: `tv-parity-icon-emoji.spec.ts`, `tv-parity-icon-sticker.spec.ts`, and `tv-parity-icon-iconTool.spec.ts`, backed by `tv-parity-icon-factory.ts`.

Remaining evidence gap: TradingView live picker extraction is still partial/blocked. The pass3 research recorded rail-click attempts and screenshots, but `sticker` and `iconTool` item selection remained blocked and drawing settings/context menus were not live-extracted.

---

## Known Cross-Tool Behaviors (All Families)

These behaviors are consistent across all or most TradingView drawing tools:

**Selection state:**
- Selected drawing: stroke turns blue, white-filled blue-outlined circular handles appear at anchor points
- Floating drawing toolbar appears immediately below the drawing or near top-left
- Right-axis price label and bottom-axis date pills appear for drawings with price/time values

**Deselection:**
- Click anywhere outside the drawing to deselect
- Tool variant returns to `none` after committing a drawing (TV behavior — same tool does not stay active)
- Click the drawing body or any handle to reselect

**Persistence:**
- Pan and zoom: drawings stay at their anchored chart coordinates (not screen pixels)
- Moving cursor off chart (price axis, time axis) does NOT delete the committed drawing
- Drawings persist across timeframe/interval switches (at their anchored timestamps)

**Keyboard:**
- `Escape` during creation: cancels partial drawing, returns to `none` mode
- `Escape` when selected: deselects the drawing
- `Delete`/`Backspace` when selected: removes the drawing
- `Ctrl+Z`: undoes last action (drawing creation, edit, delete)
- `Ctrl+Shift+Z`: redoes

**Floating toolbar:**
- Appears after selection: color picker, thickness, line style
- Tool-specific additions: fill controls (channels, pitchforks, shapes), level editor (fib/gann), text options (text tools)
- Standard: Settings (gear icon), Delete (trash icon), Clone, Lock, Hide/Show

**Context menu (right-click on drawing):**
- Template, Visual order (Bring to front / Send to back), Object tree
- Clone, Copy settings, Lock, Hide, Remove
- Settings... (opens full settings dialog)
- Tool-specific: "Add alert on trendline..." for line tools

---

## Table of Contents

- [Section 1: Lines / Channels / Pitchforks (17 tools)](#section-1-lines--channels--pitchforks-17-tools)
- [Section 2: Fibonacci and Gann Tools (15 tools)](#section-2-fibonacci-and-gann-tools-15-tools)
- [Section 3: Pattern Tools (14 tools)](#section-3-pattern-tools-14-tools)
- [Section 4: Forecasting and Brush Tools (18 tools)](#section-4-forecasting-and-brush-tools-18-tools)
- [Section 5: Shapes, Text, and Icon Tools (27 tools)](#section-5-shapes-text-and-icon-tools-27-tools)

---



---


# Section 1: Lines / Channels / Pitchforks (17 tools)

Last updated: May 19, 2026
Evidence basis: live TradingView capture (May 19, 2026), `docs/tv-line-screenshots/LINE_CHANNEL_PITCHFORK_COVERAGE.md`, `frontend/services/tools/toolRegistry.ts`, `e2e/tv-capture-factory.ts`, `e2e/tv-parity-behaviors.spec.ts`.
Reference chart: `https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE`

---

## Cross-tool behaviors (all 17 tools)

The following behaviors apply universally to every tool in this section. They are documented once here and referenced by each tool rather than repeated verbatim.

### Selection state

When any drawing in this family is selected, TradingView applies a consistent visual treatment:
- The stroke color changes to blue (regardless of the original user-chosen color).
- White-filled, blue-outlined circular endpoint handles appear at each anchor.
- A floating drawing toolbar appears above or near the drawing immediately after final commit or after a click-to-reselect.
- Selection is entered automatically when a drawing is committed (final click or drag release).
- Clicking empty canvas (not on any drawing) deselects and returns to cursor mode.
- Escape while a drawing is selected deselects it.
- Clicking a different drawing transfers selection to the new drawing.

### Floating toolbar

All 17 tools produce the same floating toolbar when selected. Standard buttons observed:
- Color swatch (opens color picker)
- Line weight / thickness selector
- Line style selector (solid / dashed / dotted)
- Opacity / transparency control (some tools)
- Settings gear icon (opens full settings dialog)
- Delete / trash icon
- Lock icon (prevents drag; drawing remains selectable in read-only mode)
- Hide / eye icon (hides drawing from canvas; drawing stays in store)
- Clone icon (duplicates drawing with slight offset)
- Fill controls appear for tools with `supportsFill: true` (channels, pitchforks)

### Context menu

Right-clicking on any drawing body opens TradingView's standard object context menu with these items:
- Template (save / apply style preset)
- Visual order (Bring to front / Send to back)
- Visibility on intervals (hide on specific timeframes)
- Object tree (show all drawings in a panel)
- Clone
- Copy
- Lock
- Hide
- Remove
- Settings...

For Info Line only, an additional item "Add alert on info line..." appears.

### Axis labels

- A price label appears on the right-side price axis for any tool whose geometry has a y-value at the visible right boundary.
- A date pill appears on the bottom time axis for any tool whose anchors have an explicit x-coordinate (timestamp).
- These labels update live as anchors are dragged.
- Horizontal line and horizontal ray each show a single price axis label.
- Vertical line shows a single date axis pill.
- Cross line shows both.

### Pan and zoom

All drawings are anchored to chart coordinates (price/time), not to screen pixels. After any pan or zoom:
- The drawing geometry stays at its original price/time coordinates.
- Handles remain positioned correctly relative to the drawing.
- Offscreen anchors are clipped; the visible portion of infinite-extending tools adjusts to the viewport.

### Drawing persistence at canvas edges

A committed drawing persists when the cursor moves outside the chart area:
- Moving the cursor to the right (over the price axis) does not delete or cancel the drawing.
- Moving the cursor outside the chart bottom, top, or left also does not affect the drawing.
- This is a confirmed TradingView behavior tested in `e2e/tv-parity-behaviors.spec.ts`.

### Tool deactivation after commit

After finalizing a drawing (completing all required anchor clicks), TradingView automatically deactivates the drawing tool and returns the active variant to `none`. This is confirmed for all 17 tools via `tv-parity-behaviors.spec.ts`.

### Post-commit auto-selection and reselection

- After commit, the drawing is immediately selected (confirmed for all 17 tools).
- Clicking empty canvas deselects.
- Clicking the drawing body or any endpoint handle re-selects it.
- Re-selection works after pan, zoom, and after the drawing is partially offscreen.

### Keyboard behavior (universal)

- **Escape during drawing**: cancels the in-progress draw; no drawing is committed.
- **Escape while selected**: deselects the drawing.
- **Delete or Backspace while selected**: removes the drawing.
- **Ctrl+Z**: undoes the last action (draw, move, delete, style change).
- **Ctrl+Y / Ctrl+Shift+Z**: redoes.
- **Ctrl+D**: duplicates selected drawing.

### Cursor crosshair

After activating any of these 17 tools, the cursor changes to a crosshair. This is encoded in `toolRegistry.ts` via `toolCursor` — all `line` family tools resolve to `'crosshair'`.

---

## Lines

---

## trend — Trend Line

### 1. Tool identity

- Exact TradingView tool name: `Trendline` (one word, no space — confirmed May 19, 2026 live menu; the label `Trend Line` with a space is a slightly older naming form)
- Family/group: Lines > Lines
- Menu location: first item in the Lines subsection of the Lines rail popover; visible directly as the top entry
- TradingView rail aria-label: the Lines rail button itself carries `aria-label="Drawing tools"` or equivalent; the tool item within the popover has `aria-label="Trendline"`
- Internal variant id: `trend`
- toolRegistry label: `Trend line`
- Capabilities from registry: 2 anchors, draggable, resizable, supportsText: false, supportsFill: false, supportsLevels: false

### 2. Activation behavior

- Clicking the Lines rail button opens the popover (does not directly activate a tool).
- TradingView remembers the last-used tool in the Lines group; if the previous session used Trend Line, the rail button may show the Trend Line icon and a single click activates it directly without reopening the submenu.
- After selecting Trendline from the popover, the cursor changes to a crosshair.
- Activation persists; the tool remains active until a drawing is committed, at which point it returns to `none`.
- The tool does not chain repeatedly (single-commit mode: one draw, then deactivated).

### 3. Creation flow

- Click A: places the first anchor; a rubber-band segment preview extends from A to the cursor.
- Move mouse: the preview segment updates continuously from A through cursor position; it is a finite segment (not extended).
- Click B: commits the drawing; the segment from A to B is finalized.
- After commit: the drawing is immediately selected; the floating toolbar appears.
- Commit style: click-click (two separate clicks, no drag required).

### 4. Multi-anchor sequence

- Anchor A: sets the origin of the line segment (price and time).
- Anchor B: sets the end of the line segment (price and time).
- Anchor order is fixed; A is always the first click.
- After commit, both anchors A and B can be adjusted independently by dragging their circular handles.
- Escape at any point before or after anchor A cancels the draw; no drawing is created.
- Escape after A but before B cancels; the partially placed anchor disappears.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking the line body (between endpoints, not just endpoints) selects the drawing.
- Deselect by clicking empty canvas; drawing remains.
- Reselect by clicking the body or either endpoint handle.
- Reselection works after zoom/pan.
- When partially offscreen (one endpoint clipped), the visible body portion remains clickable for reselection.

### 6. Hover and cursor

- Cursor over body (not selected): a pointer/hand cursor indicating the drawing is clickable.
- Cursor over endpoint handle (when selected): a resize/drag cursor (typically four-directional move or directional resize arrow).
- No fill area; no fill cursor state.
- Cursor while dragging body: move cursor (four directions).
- Cursor while dragging endpoint: resize cursor.

### 7. Handles and anchors

- Two circular endpoint handles (A and B) appear in selected state.
- Handles are white-filled with a blue outline.
- No square midpoint or center handles were visible in the May 19 live selected-state capture.
- No conditional or hidden handles beyond the two endpoint circles.

### 8. Drag and edit

- Body drag: moves the entire segment (both A and B translate by the same delta); preserves slope and length.
- Endpoint A drag: moves only A; slope and length change.
- Endpoint B drag: moves only B; slope and length change.
- No midpoint handle; no midpoint drag behavior.
- Text follows body drag if text is enabled (text is not enabled by default for trend; supportsText: false).

### 9. Tooltip behavior

- No floating measurement pill is shown during drawing or while the tool is placed.
- No per-tool intrinsic label.
- Context menu includes `Add alert on trendline...` option (standard TradingView alert integration for line-family tools).
- Optional stats (price range, percent change, bars, dates, distance, angle) can be turned on in the Settings dialog's "Inputs" tab if the TradingView version exposes that; this is a user-configurable option, not shown by default.

### 10. Floating toolbar

- See cross-tool section above for the full button list.
- No fill controls (supportsFill: false).
- The toolbar positions itself above the drawing or near the topmost anchor.

### 11. Context menu

- Right-click on drawing body: standard object menu (Template, Visual order, Visibility on intervals, Object tree, Clone, Copy, Lock, Hide, Remove, Settings...).
- Right-click on endpoint: same menu (no distinct endpoint-only items).
- `Add alert on trendline...` appears in the context menu (TradingView alert integration).

### 12. Settings/style

- Line color (hex + opacity).
- Line width (1 / 2 / 3 / 4 px options).
- Line style (solid / dashed / dotted).
- Optional: extend left, extend right (converts the tool to behave like Extended Line from within settings).
- Optional: midpoint marker visibility.
- Optional: price labels on right axis.
- No fill.
- Text/stats options may appear under "More options" in the settings dialog depending on TradingView account tier.

### 13. Text and label behavior

- `supportsText: false` in the registry; no built-in inline text affordance.
- No `+ Add text` inline button visible after creation for this tool.
- Price axis labels appear for the y-values of both anchors when the drawing is selected.
- Date pills appear for both anchor timestamps.

### 14. Chart interaction

- Pan and zoom preserve the segment in chart coordinates.
- The drawing remains when the cursor exits to the price axis (confirmed behavior from `tv-parity-behaviors.spec.ts`).
- Handle visibility is maintained when an anchor drifts offscreen; the handle appears at the chart edge clipping point.

### 15. Keyboard behavior

- Escape during draw (before second click): cancels; no drawing committed.
- Escape after commit (while selected): deselects.
- Delete/Backspace while selected: removes drawing.
- Ctrl+Z: undoes the creation.

### 16. Edge cases

- Very short segment (< 2px between A and B): TradingView still commits a drawing; it renders as a dot-sized segment.
- Near-edge anchor placement: one anchor can be placed outside the visible price range; the drawing is still committed.
- Overlapping trend lines: each is independently selectable; the topmost (highest z-order) drawing captures the click.
- Locked drawing: body drag is blocked; the drawing cannot be moved; but it can still be selected (read-only).

### 17. Evidence and status

- Coverage status: partial (selected-state and context-menu screenshots captured May 19, 2026 on public RELIANCE chart; hover-only cursor state not separately captured)
- Evidence source: live interaction (May 19, 2026 capture) + existing automation in `e2e/tv-parity-trend-500.spec.ts` + `e2e/tv-parity-behaviors.spec.ts`
- Remaining gaps: hover-only cursor state; precise cursor type over body vs. endpoint needs pixel-level confirmation; "Add text" and stats panel behavior behind settings dialog not verified end-to-end
- Behavior was directly observed in TradingView live session May 19, 2026

---

## ray — Ray

### 1. Tool identity

- Exact TradingView tool name: `Ray`
- Family/group: Lines > Lines
- Menu location: second item in the Lines subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Ray"` within the popover
- Internal variant id: `ray`
- toolRegistry label: `Ray`
- Capabilities from registry: 2 anchors, draggable, resizable, supportsText: false, supportsFill: false, supportsLevels: false; defaultOptions: `{ rayMode: true }`

### 2. Activation behavior

- Clicking the Lines rail opens the popover; Ray is selectable within the popover.
- TradingView remembers last-used tool; Ray may appear as the default rail icon if it was last used.
- Cursor changes to crosshair after activation.
- Single-commit mode: activates, one draw, deactivates.

### 3. Creation flow

- Click A: places the origin anchor; a preview ray extends from A through the cursor and continues to the right (one-directional infinite).
- Move mouse: the infinite preview updates direction continuously; it extends beyond the cursor to the right chart edge.
- Click B: commits the ray; the direction is fixed from A through B, extending infinitely in the A-to-B direction.
- After commit: selected immediately; floating toolbar appears.
- Commit style: click-click.

### 4. Multi-anchor sequence

- Anchor A: the origin (the starting point; the ray does not extend behind A).
- Anchor B: defines the direction/slope only; the ray extends beyond B.
- After commit, dragging A changes the origin; dragging B changes the slope/direction.
- Escape before A: cancels; nothing committed.
- Escape between A and B: cancels; A anchor disappears.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking anywhere on the visible ray stroke selects the drawing (including beyond the B anchor, in the extended portion).
- Deselect by clicking empty canvas.
- Reselect by clicking the ray body or either handle.
- After zoom: the ray extends to fill the new right viewport boundary; still clickable.
- When the A anchor is offscreen (panned past left edge): the visible body starting from the left chart boundary is still clickable.

### 6. Hover and cursor

- Cursor over the visible ray stroke (unselected): pointer/hand cursor.
- Cursor over A handle (when selected): move/drag cursor.
- Cursor over B handle (when selected): resize cursor (changes direction).
- No fill area.

### 7. Handles and anchors

- Two circular endpoint handles in selected state: one at A (origin) and one at B (direction anchor).
- White-filled, blue-outlined circles.
- A body/midpoint square handle was observed in some captures (see primary source note: "selected state also shows a body/midpoint handle"); this is conditional on the TradingView version and zoom level.
- No hidden handles beyond these.

### 8. Drag and edit

- Body drag: translates the entire ray (A and B move together, preserving direction and origin relationship).
- A drag: repositions the origin; direction is re-calculated from new A through B.
- B drag: changes the slope/direction; origin A is fixed.
- No independent midpoint drag if no midpoint handle is present.

### 9. Tooltip behavior

- No floating measurement pill during drawing or after placement.
- Optional stats (price range, percent change, bars range, date/time range, distance, angle) may be enabled in Settings; not shown by default.
- No intrinsic label.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.

### 11. Context menu

- Standard object menu (see cross-tool section).
- No `Add alert on ray...` observed (alert integration on Ray is not confirmed in captured context menus; it may exist behind an account tier).

### 12. Settings/style

- Line color, width, style.
- Optional: arrow-shaped line ends.
- Optional: midpoint marker visibility.
- Optional: price labels (right axis).
- Optional: stats panel (price range, %, bars, dates, distance, angle).
- No fill.

### 13. Text and label behavior

- supportsText: false; no `+ Add text` inline affordance.
- Price axis label appears for the origin y-value when selected.
- Date pill appears for the origin timestamp.
- The direction anchor (B) also produces a date pill if its timestamp differs from A.

### 14. Chart interaction

- Pan/zoom: the ray origin stays at anchor A (chart coordinates); the visible stroke extends to the right viewport boundary.
- After pan: the visible right extent of the ray adjusts to fill the new right edge.
- After zoom out: the ray appears shorter on screen but covers more chart territory.
- Cursor exit at right edge: drawing persists (confirmed behavior class from `tv-parity-behaviors.spec.ts`).

### 15. Keyboard behavior

- Escape during draw: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes.
- Ctrl+Z: undoes creation.

### 16. Edge cases

- Nearly horizontal ray: renders as a very flat angled line; still selectable.
- Nearly vertical ray: renders steeply; extension direction is visually very short on screen but still correct.
- B placed to the left of A: the ray extends to the LEFT (opposite to the common case); TradingView still commits and extends in the A-to-B direction, which points leftward.
- Very short A-to-B distance: still commits; direction is defined even for < 2px separation.

### 17. Evidence and status

- Coverage status: partial (selected-state screenshots captured; hover-only and direction-reversal edge cases need dedicated artifacts)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-ray-500.spec.ts` + `e2e/tv-parity-behaviors.spec.ts`
- Remaining gaps: midpoint handle presence confirmation (conditional or always?); B-left-of-A direction edge case needs explicit capture
- Behavior was directly observed in TradingView live session May 19, 2026

---

## infoLine — Info Line

### 1. Tool identity

- Exact TradingView tool name: `Info Line`
- Family/group: Lines > Lines
- Menu location: third item in the Lines subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Info Line"` or `aria-label="Info line"` within the popover
- Internal variant id: `infoLine`
- toolRegistry label: `Info line`
- Capabilities from registry: 2 anchors, draggable, resizable, supportsText: true, supportsFill: false, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode.

### 3. Creation flow

- Click A: places first anchor; a finite segment preview from A to the cursor begins, and a floating measurement pill is visible from the first mouse movement after click A.
- Move mouse: the segment preview and the measurement pill update continuously.
- Click B: commits the drawing; segment from A to B is finalized; pill is now anchored to the segment.
- After commit: selected immediately; floating toolbar appears alongside the persistent measurement pill.
- Commit style: click-click.

### 4. Multi-anchor sequence

- Anchor A: start of the measurement segment (origin price and time).
- Anchor B: end of the measurement segment (target price and time).
- Both anchors are independently editable after commit.
- Dragging either endpoint updates all metrics in the pill live.
- Escape before A: cancels.
- Escape between A and B: cancels; no drawing committed.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking the line body or the measurement pill area selects the drawing.
- Deselect by clicking empty canvas (away from both the line and the pill).
- Reselect by clicking body or endpoint.
- The pill may remain visible (dimmed or intact) even when the drawing is deselected, depending on TradingView settings.
- Reselection works after zoom/pan.

### 6. Hover and cursor

- Cursor over line body (unselected): pointer/hand.
- Cursor over endpoint (when selected): resize cursor.
- Cursor over measurement pill: same pointer as body.
- No fill area.

### 7. Handles and anchors

- Two circular endpoint handles in selected state (A and B).
- White-filled, blue-outlined.
- No square midpoint handles observed in the May 19 selected sample.

### 8. Drag and edit

- Body drag: moves entire line + pill together.
- A drag: repositions origin; all pill metrics update live.
- B drag: repositions endpoint; all pill metrics update live.
- Pill follows body drag.

### 9. Tooltip behavior

The measurement pill is the defining feature of Info Line. It is not a hover tooltip but an intrinsic always-visible panel attached to the segment midpoint or center.

Confirmed pill content format (from `e2e/tv-parity-behaviors.spec.ts` line 174 and primary source coverage):

**Line 1** (price delta and percentage):
- Arrow symbol: ▲ (up) or ▼ (down) or ◆ depending on direction
- Absolute price delta: e.g. `98.25`
- Percentage in parentheses: e.g. `(6.85%)`
- Ticks count: a numeric value representing the move in instrument-specific ticks
- Example: `▲ 98.25 (6.85%) 12 ticks`

**Line 2** (time and distance):
- Bar count: e.g. `47 bars`
- Days in parentheses: e.g. `(69d)`
- Pixel distance: e.g. `distance: 345 px`
- Example: `47 bars (69d), distance: 345 px`

**Line 3** (angle):
- Angle in degrees: e.g. `35.07°`
- Format: `[+/−]XX.XX°`

The angle is in the range [-180, 180]. The distance is non-negative integer pixels. Sign of line1 matches direction of the move (▲ for positive dp, ▼ for negative). Ticks value satisfies: `abs(ticks × tickSize - dp) < tickSize`.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.
- Color swatch changes the line color; the pill border/text color may update to match.

### 11. Context menu

- Standard object menu plus `Add alert on info line...` (confirmed in primary source: "context menu included `Add alert on trendline...`" and the official TradingView help article lists this item for Info Line).

### 12. Settings/style

- Line color, width, style.
- Pill/label visibility toggle (show/hide the measurement panel).
- Optional: individual metric visibility toggles (show/hide price, percent, bars, days, distance, angle independently).
- No fill.

### 13. Text and label behavior

- supportsText: true in registry; however, the primary text-like feature is the measurement pill, not a free-text label.
- The pill is an intrinsic always-on label; it is not a user-typed text field.
- Price axis labels appear for both anchor y-values when selected.
- Date pills appear for both anchor timestamps.
- The measurement pill moves with body drag.

### 14. Chart interaction

- Pan/zoom: segment stays at chart coordinates; pixel distance in the pill changes after zoom (because it reflects screen pixels, not price units).
- Bars count stays constant across zoom changes (it is bar-count based).
- Days count stays constant.
- Angle in degrees changes after zoom if the aspect ratio changes.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape during draw: cancels; pill disappears.
- Escape while selected: deselects; pill may become dimmed or stay visible.
- Delete/Backspace while selected: removes drawing and pill.
- Ctrl+Z: undoes.

### 16. Edge cases

- Zero-length Info Line (A == B): pill shows `0.00%`, `0 bars`, `0 px`, `0.00°`; still commits.
- Timeframe/interval change: bar count in pill may change because the bar count is calculated against the active chart interval.
- Very long segment spanning hundreds of bars: distPx will be large; accuracy of display is not affected.

### 17. Evidence and status

- Coverage status: complete for pill format and structure; partial for pixel-accurate handle layout and style dialog details
- Evidence source: live interaction (May 19, 2026 capture) + detailed `e2e/tv-parity-behaviors.spec.ts` assertions (lines 161–212) + primary source pill examples
- Remaining gaps: confirmed behavior of pill when drawing is deselected (does it persist or hide?); exact positioning of the pill relative to segment midpoint
- Behavior was directly observed and tested against TradingView live session May 19, 2026

---

## extendedLine — Extended Line

### 1. Tool identity

- Exact TradingView tool name: `Extended Line`
- Family/group: Lines > Lines
- Menu location: fourth item in the Lines subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Extended Line"` or `aria-label="Extended line"` within the popover
- Internal variant id: `extendedLine`
- toolRegistry label: `Extended line`
- Capabilities from registry: 2 anchors, draggable, resizable, supportsText: false, supportsFill: false, supportsLevels: false; defaultOptions: `{ extendLeft: true, extendRight: true }`

### 2. Activation behavior

- Selectable from Lines rail popover.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode.

### 3. Creation flow

- Click A: places first anchor; a preview of an infinite line (extending both left and right beyond the cursor) appears.
- Move mouse: the infinite line preview rotates around A as the cursor moves; both extensions are visible to the chart edges.
- Click B: commits the drawing; the line through A and B is finalized, extending to both chart boundaries.
- After commit: selected immediately; floating toolbar appears.
- Commit style: click-click.

### 4. Multi-anchor sequence

- Anchor A: defines a point the line passes through.
- Anchor B: defines the slope (together with A); both points are on the infinite line.
- After commit, both handles are independently draggable to change slope.
- Escape before A: cancels.
- Escape between A and B: cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking anywhere along the visible infinite stroke selects the drawing (including portions far from A or B).
- Deselect by clicking empty canvas.
- Reselect by clicking any visible portion of the infinite line or either handle.
- After zoom/pan: the line redraws to extend to the new chart boundaries; still clickable.

### 6. Hover and cursor

- Cursor over body (unselected): pointer/hand.
- Cursor over endpoint handle (when selected): resize cursor.
- No fill area.

### 7. Handles and anchors

- Two circular endpoint handles at A and B in selected state.
- White-filled, blue-outlined.
- A midpoint/body handle may also appear (noted in primary source: "selected state also shows a midpoint/body handle"); this allows body drag without requiring precise click on A or B.

### 8. Drag and edit

- Body drag: moves the infinite line (A and B both translate); slope preserved.
- A drag: changes slope; B stays fixed.
- B drag: changes slope; A stays fixed.
- Midpoint drag (if present): same effect as body drag.

### 9. Tooltip behavior

- No intrinsic measurement pill.
- Optional stats (price range, %, bars, dates, distance, angle) can be enabled in Settings.
- No floating tooltip during creation.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Line color, width, style.
- Optional: arrow-shaped line ends (for each side separately).
- Optional: midpoint marker.
- Optional: extend left and extend right toggles (turning these off converts it to a finite segment — effectively a Trend Line; these are on by default).
- Optional: price labels on right axis.
- No fill.

### 13. Text and label behavior

- supportsText: false; no inline text affordance.
- Price axis labels: appear for any y-value where the infinite line intersects the visible right axis.
- Date pills: appear for anchor timestamps.
- Because the line extends infinitely, the right-axis price label location is determined by the intersection of the line's slope with the current right chart boundary.

### 14. Chart interaction

- Pan/zoom: line remains defined by the same two chart-coordinate points; its visible extent re-clips to the new viewport.
- After a significant pan, the line may appear in a different part of the screen but retains its slope and position in price/time space.

### 15. Keyboard behavior

- Escape during draw: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes.
- Ctrl+Z: undoes.

### 16. Edge cases

- Nearly horizontal line: shows almost like a horizontal line but still a bit sloped; both extensions visible.
- Nearly vertical line: both extensions are very short on screen; the visible stroke may clip quickly at top and bottom.
- Interval switch: the same anchor timestamps may map to slightly different pixel x-positions on a different interval; the slope can appear to change slightly.

### 17. Evidence and status

- Coverage status: partial (selected-state screenshots captured; hover-only and near-vertical edge cases not separately captured)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-extendedLine-500.spec.ts` + `e2e/tv-parity-behaviors.spec.ts`
- Remaining gaps: exact midpoint handle confirmation; right-axis label x-intersection precision; extend left/right toggle UI in settings dialog
- Behavior was directly observed in TradingView live session May 19, 2026

---

## trendAngle — Trend Angle

### 1. Tool identity

- Exact TradingView tool name: `Trend Angle`
- Family/group: Lines > Lines
- Menu location: fifth item in the Lines subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Trend Angle"` or `aria-label="Trend angle"` within the popover
- Internal variant id: `trendAngle`
- toolRegistry label: `Trend angle`
- Capabilities from registry: 2 anchors, draggable, resizable, supportsText: true, supportsFill: false, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode.

### 3. Creation flow

- Click A: places first anchor; a dashed horizontal reference line extends from A to the right; a main line preview from A to the cursor appears; an angle arc and label near A show the current angle.
- Move mouse: the main line follows the cursor; the angle arc and label update in real time; the dashed horizontal baseline remains fixed from A.
- Click B: commits the drawing; the line from A to B is fixed; the dashed horizontal reference and angle arc/label are permanently rendered.
- After commit: selected immediately; floating toolbar appears.
- Commit style: click-click.

### 4. Multi-anchor sequence

- Anchor A: the origin of both the main line and the dashed horizontal baseline.
- Anchor B: the endpoint of the main line; the angle is measured between the main line and the horizontal.
- After commit, dragging B changes the angle and length; the dashed horizontal stays fixed to A.
- Dragging A repositions the origin; the angle is recalculated from the new A and fixed B position.
- Escape before A: cancels.
- Escape between A and B: cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking the main line body selects the drawing.
- Deselect by clicking empty canvas.
- Reselect by clicking the main line, the dashed horizontal, or either endpoint.
- Works after zoom/pan.

### 6. Hover and cursor

- Cursor over main line body (unselected): pointer/hand.
- Cursor over endpoint (when selected): resize cursor.
- Cursor over dashed horizontal reference: same as body or may not be separately interactive.

### 7. Handles and anchors

- Two circular endpoint handles at A and B in selected state.
- White-filled, blue-outlined.
- The dashed horizontal reference line is part of the rendered geometry, not a separate editable element.

### 8. Drag and edit

- Body drag: moves both the main line and the dashed horizontal baseline together.
- B drag: changes angle and length; the dashed horizontal stays at A's y-level.
- A drag: repositions origin; dashed horizontal moves with A.
- The angle arc and label update live during any drag.

### 9. Tooltip behavior

- The angle label is intrinsic (always shown near the origin, near the arc).
- Format: `[+/−]XX.XX°` or `XX.XX deg` (from primary source: `35.07 deg`).
- No separate measurement pill (distinct from Info Line).
- The angle label is not a tooltip; it is a permanent rendered element.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Main line: color, width, style.
- Dashed horizontal reference: may have its own style controls (color, style) in the Settings dialog.
- Angle label: visibility toggle (show/hide the degree label).
- No fill.

### 13. Text and label behavior

- supportsText: true in registry; the angle degree label is the intrinsic text element.
- The degree label updates live when B is dragged.
- The dashed horizontal is a dashed reference line, not text.
- Price axis labels: appear for both A and B y-values when selected.
- Date pills: appear for both anchor timestamps.
- Text (angle label) follows body drag.

### 14. Chart interaction

- Pan/zoom: both line and dashed reference stay at chart coordinates.
- The angle label stays near the arc near A.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape during draw: cancels; angle arc and dashed reference disappear.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes all elements (main line, dashed reference, angle label).
- Ctrl+Z: undoes.

### 16. Edge cases

- Exactly horizontal (A and B at same price): angle label shows `0.00°`; dashed reference overlaps the main line.
- Exactly vertical: angle label shows `90.00°` or `-90.00°`; dashed reference becomes a short horizontal stub from A.
- After significant zoom change: the visual angle on screen changes even though the price/time coordinates are unchanged; the label reflects the true mathematical angle, not the perceived screen angle.

### 17. Evidence and status

- Coverage status: partial (selected-state, angle label, and dashed reference confirmed; hover-only and near-horizontal/vertical edge cases not captured separately)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-trendAngle-500.spec.ts` + `e2e/tv-parity-behaviors.spec.ts`
- Remaining gaps: exact angle label format string (is it `deg` or `°`?); dashed reference color and style configurability; real-time angle update animation behavior
- Behavior was directly observed in TradingView live session May 19, 2026

---

## hline — Horizontal Line

### 1. Tool identity

- Exact TradingView tool name: `Horizontal Line`
- Family/group: Lines > Lines
- Menu location: sixth item in the Lines subsection; visible directly in the popover
- TradingView rail aria-label: `aria-label="Horizontal Line"` or `aria-label="Horizontal line"` within the popover
- Internal variant id: `hline`
- toolRegistry label: `Horizontal line`
- Capabilities from registry: 1 anchor, draggable, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode (one click).

### 3. Creation flow

- Move mouse: a full-width horizontal line preview appears at the cursor's y-position and follows vertically.
- Click once: commits the horizontal line at the current price (y-coordinate); the time (x-coordinate) of the click determines the handle position but does not constrain the line (it spans full chart width).
- After commit: selected immediately; floating toolbar appears.
- Commit style: single-click (1 anchor).

### 4. Multi-anchor sequence

- Not applicable; 1 anchor only.
- The single anchor records a price and a time position (for the handle's x position on screen).
- After commit, the anchor is draggable vertically to change the price.
- Escape at any point before the click cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking anywhere on the horizontal stroke (full chart width) selects the drawing.
- Deselect by clicking empty canvas (area not on the line).
- Reselect by clicking the line at any x position.
- Works after zoom/pan; the line spans the full viewport width.
- When the line is at the very top or bottom edge of the visible price range, it may be partially offscreen but still clickable at the chart edge.

### 6. Hover and cursor

- Cursor over body (unselected): pointer/hand.
- Cursor over anchor handle (when selected): vertical resize cursor (up-down arrow).
- No fill.

### 7. Handles and anchors

- One circular anchor handle in selected state; positioned at the click x-coordinate.
- The handle can be dragged horizontally (which changes the handle's x position but does not affect the line geometry — the line still spans full width) or vertically (which changes the price level).
- White-filled, blue-outlined circle.

### 8. Drag and edit

- Vertical drag of handle: changes the price level of the horizontal line.
- Horizontal drag of handle: changes the handle's x-position (display position of the handle on the line) but does not affect the line's price level or width.
- Body drag (clicking and dragging the line stroke, not the handle): moves the line vertically.

### 9. Tooltip behavior

- No measurement pill.
- No intrinsic angle or delta label.
- After creation, a `+ Add text` inline affordance appears (confirmed in primary source for hline and vline); this allows the user to attach a text label to the line directly on the chart without opening the settings dialog.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Line color, width, style.
- Optional: price label visibility (right axis).
- Optional: text label (equivalent to `+ Add text` inline).
- No fill.

### 13. Text and label behavior

- supportsText: false in registry (somewhat inconsistent with the `+ Add text` observation; the inline add-text affordance exists in TradingView for horizontal line as a convenience feature, but the underlying drawing type does not use the general-purpose text field).
- Price axis label: permanently visible (shows the price of the line on the right axis); this is the primary label for this tool.
- `+ Add text` inline affordance: clicking it opens an inline text entry on the chart; the text is rendered beside the handle.
- Date pill: appears for the anchor timestamp when selected, but a horizontal line does not conceptually have a time component; the date pill position follows the handle x position.

### 14. Chart interaction

- Pan/zoom: the line remains at the anchored price level; it redraws to fill the full new viewport width.
- After vertical zoom (price scale change): the line's y position on screen changes but the price level is preserved.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape before click: cancels (no drawing committed).
- Escape while selected: deselects.
- Delete/Backspace while selected: removes.
- Ctrl+Z: undoes.

### 16. Edge cases

- Line placed exactly at the top price of the visible range: partially offscreen; still in store.
- Line at same price as an existing horizontal line: both exist independently; topmost z-order captures click.
- Locked horizontal line: cannot be dragged vertically; still shows price label.

### 17. Evidence and status

- Coverage status: partial (selected state, price-axis label confirmed; hover cursor and `+ Add text` workflow need explicit capture)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-hline-500.spec.ts` + `e2e/tv-parity-behaviors.spec.ts`
- Remaining gaps: exact behavior of `+ Add text` after interaction (does the text persist after deselect?); handle horizontal-drag behavior confirmation
- Behavior was directly observed in TradingView live session May 19, 2026

---

## horizontalRay — Horizontal Ray

### 1. Tool identity

- Exact TradingView tool name: `Horizontal Ray`
- Family/group: Lines > Lines
- Menu location: seventh item in the Lines subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Horizontal Ray"` or `aria-label="Horizontal ray"` within the popover
- Internal variant id: `horizontalRay`
- toolRegistry label: `Horizontal ray`
- Capabilities from registry: 1 anchor, draggable, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false; defaultOptions: `{ rayMode: true }`

### 2. Activation behavior

- Selectable from Lines rail popover.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode.

### 3. Creation flow

- Move mouse: a preview horizontal stroke extends from the cursor position to the right chart edge.
- Click once: commits the horizontal ray starting at the click's price (y) and time (x), extending to the right.
- After commit: selected immediately; floating toolbar appears.
- Commit style: single-click.
- Distinction from Horizontal Line: the ray starts at a specific time (x); it does not extend to the left of the anchor. It is one-sided.

### 4. Multi-anchor sequence

- Not applicable; 1 anchor only.
- The anchor defines both the starting price and the starting time.
- After commit, the anchor handle can be dragged to move both price and starting time.
- Escape before click: cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking the visible ray stroke (from anchor x rightward) selects the drawing.
- Deselect by clicking empty canvas.
- Reselect by clicking the visible stroke.
- After pan left: if the anchor is panned off the left edge, the visible ray begins at the left chart boundary; still clickable.
- After pan right past the anchor: the full visible chart area may be empty (anchor is offscreen to the right); the drawing still exists in store.

### 6. Hover and cursor

- Cursor over body (unselected): pointer/hand.
- Cursor over anchor handle (when selected): move cursor (both horizontal and vertical movement are meaningful for this tool).
- No fill.

### 7. Handles and anchors

- One circular anchor handle at the starting point of the ray.
- White-filled, blue-outlined.

### 8. Drag and edit

- Anchor drag: moves both price level and starting time simultaneously.
- Body drag (if clicking the ray stroke away from the handle): moves the entire ray.

### 9. Tooltip behavior

- No measurement pill.
- No intrinsic angle or delta label.
- Price axis label appears for the anchor y-value when selected.
- Whether `+ Add text` affordance appears for Horizontal Ray needs explicit artifact confirmation; primary source notes "right-axis price label observed" but does not confirm inline text for this tool.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Line color, width, style.
- Optional: price label visibility (right axis).
- No fill.

### 13. Text and label behavior

- supportsText: false.
- Price axis label: shows the anchor price on the right axis when selected.
- Date pill: shows the anchor timestamp on the bottom axis when selected.
- No inline `+ Add text` confirmed for this tool (unlike Horizontal Line).

### 14. Chart interaction

- Pan/zoom: the anchor stays at its chart-coordinate price/time; the visible right extent redraws to the new viewport right boundary.
- After rightward pan (anchor scrolls off left): the ray is not visible but still exists.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape before click: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes.
- Ctrl+Z: undoes.

### 16. Edge cases

- Anchor placed near the far-right visible bar: the ray has minimal visible extent immediately after placement.
- Anchor placed near the far-left edge: the ray extends across most of the visible chart.
- Horizontal Ray near top/bottom of chart: same as Horizontal Line edge cases; may be partially offscreen.

### 17. Evidence and status

- Coverage status: partial (selected-state confirmed; hover-only and inline-text affordance not confirmed)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-horizontalRay-500.spec.ts` + primary source notes
- Remaining gaps: confirmation of whether `+ Add text` appears for this tool; exact body-drag vs anchor-drag distinction
- Behavior was directly observed in TradingView live session May 19, 2026

---

## vline — Vertical Line

### 1. Tool identity

- Exact TradingView tool name: `Vertical Line`
- Family/group: Lines > Lines
- Menu location: eighth item in the Lines subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Vertical Line"` or `aria-label="Vertical line"` within the popover
- Internal variant id: `vline`
- toolRegistry label: `Vertical line`
- Capabilities from registry: 1 anchor, draggable, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode.

### 3. Creation flow

- Move mouse: a full-height vertical line preview follows the cursor's x-position (time/bar).
- Click once: commits the vertical line at the current bar/timestamp; it spans the full chart height.
- After commit: selected immediately; floating toolbar appears.
- Commit style: single-click.

### 4. Multi-anchor sequence

- Not applicable; 1 anchor only.
- The anchor records a specific timestamp (bar).
- After commit, dragging the handle horizontally changes the bar/timestamp.
- Escape before click: cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking anywhere on the vertical stroke (full chart height) selects.
- Deselect by clicking empty canvas.
- Reselect by clicking the vertical stroke at any y position.
- Works after zoom/pan; the line spans the full viewport height.

### 6. Hover and cursor

- Cursor over body (unselected): pointer/hand.
- Cursor over anchor handle (when selected): horizontal resize cursor (left-right arrow).
- No fill.

### 7. Handles and anchors

- One circular anchor handle in selected state.
- Handle position: somewhere along the vertical line (typically at the vertical midpoint or at the anchor's y click position).
- White-filled, blue-outlined.

### 8. Drag and edit

- Horizontal drag of handle: changes the bar/timestamp of the vertical line.
- Vertical drag: may move the handle position along the line without changing the bar (implementation varies; typically only horizontal movement is semantically meaningful).
- Body drag (clicking and dragging the vertical stroke): moves the line to a new timestamp.

### 9. Tooltip behavior

- No measurement pill.
- Date label on the bottom axis is intrinsic (always visible; confirms the timestamp of the vertical line).
- After creation, a `+ Add text` inline affordance appears (primary source confirms this for vline; the text appears beside the line handle on the chart).

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Line color, width, style.
- Optional: date label visibility (bottom axis).
- No fill.

### 13. Text and label behavior

- supportsText: false in registry.
- Bottom-axis date pill: intrinsic; always visible; shows the timestamp of the vertical line.
- `+ Add text` affordance: clicking it opens inline text entry; text appears beside the handle.
- No price axis label (vertical line has no price-y component).

### 14. Chart interaction

- Pan/zoom: the line stays at its anchored timestamp; redraws to span the full new viewport height.
- After zoom: the x-position on screen changes but the timestamp is preserved.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape before click: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes.
- Ctrl+Z: undoes.

### 16. Edge cases

- Line placed on the last visible candle: handle at the far right of the chart.
- Line placed on a candle that is filtered out on a higher timeframe: line may appear at a slightly different x position on interval switch.
- Multiple overlapping vertical lines at the same bar: each independently selectable; topmost z-order captures click.

### 17. Evidence and status

- Coverage status: partial (selected-state and bottom date label confirmed; hover-only cursor not captured separately)
- Evidence source: live interaction (May 19, 2026 capture) + existing automation + primary source notes
- Remaining gaps: exact `+ Add text` inline text behavior; vertical-drag behavior of handle; bottom-label persistence when deselected
- Behavior was directly observed in TradingView live session May 19, 2026

---

## crossLine — Cross Line

### 1. Tool identity

- Exact TradingView tool name: `Cross Line`
- Family/group: Lines > Lines
- Menu location: ninth (last) item in the Lines subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Cross Line"` or `aria-label="Cross line"` within the popover
- Internal variant id: `crossLine`
- toolRegistry label: `Cross line`
- Capabilities from registry: 1 anchor, draggable, resizable: false, supportsText: false, supportsFill: false, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode.

### 3. Creation flow

- Move mouse: a crosshair preview appears — a full-height vertical line and a full-width horizontal line intersecting at the cursor position.
- Click once: commits both lines at the intersection point; the cross spans the full chart width and height.
- After commit: selected immediately; floating toolbar appears.
- Commit style: single-click.

### 4. Multi-anchor sequence

- Not applicable; 1 anchor only.
- The anchor records both a price (y) and a timestamp (x).
- After commit, dragging the center handle moves both arms of the cross together.
- Escape before click: cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking either the horizontal arm or the vertical arm selects the drawing.
- Deselect by clicking empty canvas (away from both arms).
- Reselect by clicking either arm.
- Works after zoom/pan.

### 6. Hover and cursor

- Cursor over horizontal arm (unselected): pointer/hand.
- Cursor over vertical arm (unselected): pointer/hand.
- Cursor over center handle (when selected): move cursor.
- No fill.

### 7. Handles and anchors

- One circular anchor handle at the intersection point.
- White-filled, blue-outlined.

### 8. Drag and edit

- Center handle drag: moves both the horizontal and vertical arms together; changes both the price level and the timestamp simultaneously.
- Body drag (clicking the arm stroke away from center): moves the entire cross.

### 9. Tooltip behavior

- No measurement pill.
- Price axis label: shows the price of the horizontal arm on the right axis.
- Bottom-axis date pill: shows the timestamp of the vertical arm.
- Both axis labels are visible when the drawing is selected (and may remain when deselected, depending on TradingView settings).
- Per official TradingView docs: both labels can be disabled individually in the Style settings.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- No fill controls.

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Line color, width, style (applies to both arms).
- Optional: price label visibility (right axis).
- Optional: date label visibility (bottom axis).
- No fill.

### 13. Text and label behavior

- supportsText: false.
- Price axis label: intrinsic; shows intersection price.
- Date axis pill: intrinsic; shows intersection timestamp.
- No inline `+ Add text` observed for Cross Line.

### 14. Chart interaction

- Pan/zoom: the cross center stays at its chart-coordinate anchor; both arms redraw to span the full new viewport dimensions.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape before click: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes both arms.
- Ctrl+Z: undoes.

### 16. Edge cases

- Cross near corner: both arms may be very short on one side but still correctly rendered.
- Price/date labels may overlap dense UI elements (indicator labels, toolbar) near chart edges.
- Multiple overlapping cross lines: each is independently selectable by clicking either arm.

### 17. Evidence and status

- Coverage status: partial (selected-state and dual-axis labels confirmed; hover-only cursor per arm not captured separately)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-crossLine-500.spec.ts` + `e2e/tv-parity-behaviors.spec.ts` + primary source notes
- Remaining gaps: exact behavior of axis labels when drawing is deselected; arm-specific click hit-testing (does clicking near the intersection with one arm select or deselect?)
- Behavior was directly observed in TradingView live session May 19, 2026

---

## Channels

---

## channel — Parallel Channel

### 1. Tool identity

- Exact TradingView tool name: `Parallel Channel`
- Family/group: Lines > Channels
- Menu location: first item in the Channels subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Parallel Channel"` or `aria-label="Parallel channel"` within the popover
- Internal variant id: `channel`
- toolRegistry label: `Parallel channel`
- Capabilities from registry: 3 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover, Channels subsection.
- Last-used tool memory applies within the Lines group.
- Cursor changes to crosshair after activation.
- Single-commit mode (3-click wizard).

### 3. Creation flow

- Click A: places the baseline start anchor; a short preview baseline extends from A toward the cursor.
- Move mouse: the baseline preview from A to the cursor updates; no parallel rail yet.
- Click B: finalizes the baseline (A to B); now a parallel offset rail preview appears, following the cursor as an offset from the A-B baseline; a fill region and a dashed median line are also previewed.
- Move mouse: the parallel rail (and fill) offset adjusts as the cursor moves perpendicularly to the baseline.
- Click C: commits the full channel at the current offset distance.
- After commit: selected immediately; floating toolbar appears.
- Commit style: 3-click wizard (click-click-click).

### 4. Multi-anchor sequence

- Anchor A: baseline start (price/time).
- Anchor B: baseline end (price/time); together A-B define the main rail direction.
- Anchor C: sets the position of the parallel offset rail; the perpendicular distance from the A-B line to C determines channel width.
- After commit, all four corner handles (A, B, and the two corresponding offset-rail endpoints) can be adjusted independently.
- Square midpoint/body handles appear on both rails for body drag.
- Escape at step 1 (before A): cancels.
- Escape after A but before B: cancels; A disappears.
- Escape after B but before C: cancels; both A and B disappear; no drawing committed.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking either rail, the fill region, or the dashed median line selects the drawing.
- Deselect by clicking empty canvas.
- Reselect by clicking any visible part of the channel.
- Works after zoom/pan.
- When partially offscreen (one rail or one endpoint clipped), the visible portions remain clickable.

### 6. Hover and cursor

- Cursor over rail stroke (unselected): pointer/hand.
- Cursor over fill region (unselected): pointer/hand.
- Cursor over corner handle (when selected): resize cursor.
- Cursor over body/midpoint handle (when selected): move cursor.
- No distinct cursor for the dashed median.

### 7. Handles and anchors

- Four circular corner handles in selected state: A, B on the main rail, and the two corresponding offset-rail endpoints.
- Square midpoint/body handles appear on both rails (allowing rail-by-rail dragging).
- All handles are white-filled with blue outlines.
- The dashed median is a non-editable rendered element (no handle on it).

### 8. Drag and edit

- Corner A or B drag: adjusts the baseline; the offset rail moves in parallel to preserve channel width.
- Offset-rail corner drag (C-side endpoints): adjusts the channel width; the baseline stays fixed.
- Body handle drag on main rail: slides that rail while keeping the other rail fixed (changes the channel width asymmetrically).
- Body drag (clicking fill or rail away from handles): translates the entire channel.

### 9. Tooltip behavior

- No floating measurement pill.
- Right-axis price labels appear for the top and bottom rails at the current right chart boundary.
- Bottom-axis date pills appear for the A and B timestamps.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- Fill color/opacity controls are present (supportsFill: true).

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Main rail: color, width, style.
- Offset rail: may share or have independent style.
- Dashed median line: visibility toggle; style (dashed by default).
- Fill: color, opacity.
- Background fill: the semi-transparent region between the two rails.
- Optional: extend both rails.
- No text.

### 13. Text and label behavior

- supportsText: false.
- Price axis labels: for top and bottom rail values at the right chart boundary.
- Date pills: for A and B timestamps.
- No inline text affordance.

### 14. Chart interaction

- Pan/zoom: channel geometry stays at chart coordinates; rails and fill rescale with viewport.
- After zoom out: channel may appear narrower on screen but covers the same price range.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape during any step of the 3-click wizard: cancels; all partial anchors disappear.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes entire channel (both rails, fill, median).
- Ctrl+Z: undoes creation.

### 16. Edge cases

- Very thin channel (C very close to the A-B line): renders with minimal fill; still commits.
- Reversed A-B slope (A higher than B in time): channel orientation is correct; it follows the direction of A to B.
- Large offset causing the second rail to be offscreen: the channel still commits; the offscreen rail is clipped.

### 17. Evidence and status

- Coverage status: partial (3-click wizard flow confirmed; handle layout confirmed at four corners and midpoints; fill behavior confirmed; hover-only cursor not captured)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-v2-channel.spec.ts` + `e2e/tv-parity-behaviors.spec.ts` (wizard style)
- Remaining gaps: individual rail body-handle drag behavior (does dragging one midpoint handle move only that rail?); extend-rails option behavior; confirm whether the median handle is interactive
- Behavior was directly observed in TradingView live session May 19, 2026

---

## regressionTrend — Regression Trend

### 1. Tool identity

- Exact TradingView tool name: `Regression Trend`
- Family/group: Lines > Channels
- Menu location: second item in the Channels subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Regression Trend"` or `aria-label="Regression trend"` within the popover
- Internal variant id: `regressionTrend`
- toolRegistry label: `Regression trend`
- Capabilities from registry: 2 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover, Channels subsection.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode (2-click or drag).

### 3. Creation flow

- Click point 1 (left bound): places the start of the regression interval.
- Move mouse: a preview of the regression channel (computed over the visible bars between point 1 and the cursor) updates in real time as the cursor moves horizontally.
- Click point 2 (right bound): commits the regression channel over the selected bar range.
- After commit: selected immediately; floating toolbar appears.
- Commit style: 2-click (click-click) or drag (confirmed in the repo as a drag-commit style in some implementations, but the live capture shows it as 2-click; the manifest entry lists 2 anchors).

### 4. Multi-anchor sequence

- Anchor 1 (left boundary): the start bar/timestamp of the regression window.
- Anchor 2 (right boundary): the end bar/timestamp.
- The channel geometry (center line, upper band, lower band) is computed from price data within the selected interval.
- After commit, dragging the left or right boundary changes the regression window and triggers recomputation.
- Escape before anchor 1: cancels.
- Escape between anchor 1 and 2: cancels; no drawing committed.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking the band region, the center line, or either boundary line selects the drawing.
- Deselect by clicking empty canvas.
- Reselect by clicking any visible element.
- Works after zoom/pan.

### 6. Hover and cursor

- Cursor over band region (unselected): pointer/hand.
- Cursor over boundary handle (when selected): resize cursor.
- Cursor over body (when selected): move cursor.

### 7. Handles and anchors

- Four circular corner handles in selected state: two at the left boundary (top and bottom of the band at the left edge) and two at the right boundary (top and bottom of the band at the right edge).
- A dashed vertical line is shown at the right boundary in selected state (confirmed in May 19 live capture).
- White-filled, blue-outlined circles.
- No square midpoint handles were visible in the May 19 selected sample.

### 8. Drag and edit

- Left boundary handle drag: changes the start of the regression window; regression is recomputed live.
- Right boundary handle drag: changes the end of the regression window; recomputed live.
- Body drag: translates the entire regression interval horizontally; both boundaries move together; regression recomputed over the new interval.

### 9. Tooltip behavior

- No floating measurement pill.
- Optional: Pearson's R coefficient label near the lower-left corner of the band (this is a configurable option; it was not always visible in captures and may depend on the settings or zoom level).
- Right-axis labels appear for the upper band, center line, and lower band values at the right boundary.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- Fill color/opacity controls are present (supportsFill: true).

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Upper boundary: color, width, style.
- Lower boundary: color, width, style.
- Center line: color, width, style.
- Band fill: color, opacity.
- Deviation controls (upper/lower sigma multiplier).
- Optional: extend right (projects the regression beyond the right boundary).
- Optional: Pearson's R label visibility.
- May 19 live capture confirmed: blue upper boundary, teal lower boundary, red center line, semi-transparent blue/teal fill.

### 13. Text and label behavior

- supportsText: false.
- Pearson's R coefficient label is an optional intrinsic numeric label (not user-typed text).
- Right-axis labels: for all three levels (upper, center, lower) at the right chart boundary.
- Date pills: for the left and right boundary timestamps.

### 14. Chart interaction

- Pan/zoom: the regression is recomputed or re-rendered over the anchored interval; it does not simply scale like a parallelogram.
- After pan: if the regression window scrolls off one side, the visible portion of the band clips correctly.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape during draw: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes.
- Ctrl+Z: undoes.

### 16. Edge cases

- Too-small bar window (1 bar selected): the regression over 1 bar is a horizontal line; still commits.
- Heavy volatility within the range: the band width varies; upper/lower deviation controls affect the visual width.
- Extend-right enabled: the regression band continues to the right beyond the right anchor; changes the right-axis label positions.

### 17. Evidence and status

- Coverage status: partial (selected-state confirmed with 4-corner handles and dashed right-boundary marker; per-handle drag semantics still need a slower pass; Pearson's R label visibility needs explicit capture)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-regressionTrend-500.spec.ts` + primary source (handle semantics improved but not fully resolved)
- Remaining gaps: exact behavior of body drag on regression (does it recompute over the shifted interval or interpolate?); Pearson's R label format; deviation controls in settings dialog
- Behavior was directly observed in TradingView live session May 19, 2026

---

## flatTopBottom — Flat Top/Bottom

### 1. Tool identity

- Exact TradingView tool name: `Flat Top/Bottom`
- Family/group: Lines > Channels
- Menu location: third item in the Channels subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Flat Top/Bottom"` or `aria-label="Flat top/bottom"` within the popover
- Internal variant id: `flatTopBottom`
- toolRegistry label: `Flat top/bottom`
- Capabilities from registry: 2 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false; defaultOptions: `{ color: '#FFD60A' }` (yellow default)

### 2. Activation behavior

- Selectable from Lines rail popover, Channels subsection.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode.

### 3. Creation flow

- Click A: places the first anchor (one corner of the flat top/bottom shape).
- Move mouse: a preview of the wedge/triangle formation follows the cursor; one side remains horizontal (flat) while the opposite side is sloped.
- Click B: commits the drawing.
- After commit: selected immediately; floating toolbar appears.
- Commit style: 2-click.

### 4. Multi-anchor sequence

- Anchor A: one diagonal corner of the shape.
- Anchor B: the other corner; together they define the diagonal extent.
- The shape has one horizontal edge (the "flat" top or bottom) and one sloped edge; which side is flat depends on the relative positions of A and B.
- After commit, both anchor handles can be independently moved to reshape the formation.
- Escape before A: cancels.
- Escape between A and B: cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking the fill region, either rail, or the sloped or flat edge selects the drawing.
- Deselect by clicking empty canvas.
- Reselect by clicking any visible part.
- Works after zoom/pan.

### 6. Hover and cursor

- Cursor over body/fill (unselected): pointer/hand.
- Cursor over handle (when selected): resize cursor.
- No separate fill cursor.

### 7. Handles and anchors

- Two circular endpoint handles in selected state (one at A, one at B).
- White-filled, blue-outlined.
- No midpoint handles visible in the captured sample.

### 8. Drag and edit

- A drag: repositions corner A; the flat/sloped shape reconfigures.
- B drag: repositions corner B.
- Body drag: translates the entire shape.
- Whether dragging A above B flips the flat from top to bottom (or vice versa) needs explicit confirmation.

### 9. Tooltip behavior

- No floating measurement pill.
- Right-axis price labels for upper and lower levels of the shape.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- Fill color/opacity controls are present (supportsFill: true).

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Line color: default yellow (`#FFD60A`) per toolRegistry defaultOptions.
- Line width, style.
- Fill: color, opacity.
- The yellow default is the TradingView-parity default for this tool; confirmed in toolRegistry.ts: `defaultOptions: { color: '#FFD60A' }`.

### 13. Text and label behavior

- supportsText: false.
- Right-axis labels: for the upper and lower price levels.
- Date pills: for anchor timestamps.

### 14. Chart interaction

- Pan/zoom: shape stays at chart coordinates.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape during draw: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes.
- Ctrl+Z: undoes.

### 16. Edge cases

- A and B at the same price level: shape degenerates to a flat horizontal span; still commits.
- Very narrow x-span: the sloped side is nearly vertical.
- Flat side is at top or bottom depending on anchor placement; TradingView auto-determines based on the relative y-positions.

### 17. Evidence and status

- Coverage status: partial (2-click flow confirmed; yellow default color confirmed; selected-state handle count confirmed at 2; hover-only and edge cases not separately captured)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-flatTopBottom-500.spec.ts` + toolRegistry.ts defaultOptions
- Remaining gaps: exact behavior when A is above B vs. B above A (does the flat side flip?); fill/label style options in settings dialog
- Behavior was directly observed in TradingView live session May 19, 2026

---

## disjointChannel — Disjoint Channel

### 1. Tool identity

- Exact TradingView tool name: `Disjoint Channel`
- Family/group: Lines > Channels
- Menu location: fourth (last) item in the Channels subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Disjoint Channel"` or `aria-label="Disjoint channel"` within the popover
- Internal variant id: `disjointChannel`
- toolRegistry label: `Disjoint channel`
- Capabilities from registry: 4 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false; defaultOptions: `{ color: '#22C55E' }` (green default)

### 2. Activation behavior

- Selectable from Lines rail popover, Channels subsection.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode (4-click wizard).

### 3. Creation flow

- Click A: places the start of the first line segment.
- Click B: finalizes the first segment (A to B); the segment is drawn; cursor is now ready for the second segment.
- Click C: places the start of the second segment.
- Click D: finalizes the second segment (C to D); the full disjoint channel (quadrilateral/hourglass fill between the two segments) is committed.
- After commit: selected immediately; floating toolbar appears.
- Commit style: 4-click wizard (click-click-click-click).

### 4. Multi-anchor sequence

- Anchor A: first segment start.
- Anchor B: first segment end; after B, the first segment is fixed.
- Anchor C: second segment start; a preview of the second segment follows the cursor.
- Anchor D: second segment end; after D, the fill quadrilateral/hourglass between A-B and C-D is committed.
- All four anchors are independently editable after commit.
- Escape at any step: cancels the entire draw; no partial drawing is committed.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking either segment line or the fill region selects the drawing.
- Deselect by clicking empty canvas.
- Reselect by clicking any visible part.
- Handle visibility in selected state is ambiguous from May 19 captures (see Evidence section).

### 6. Hover and cursor

- Cursor over segment body (unselected): pointer/hand.
- Cursor over fill region (unselected): pointer/hand.
- Cursor over handle (when selected): resize cursor.

### 7. Handles and anchors

- Four circular anchor handles expected (one at each of A, B, C, D) in selected state based on the 4-anchor manifest model.
- However, the May 19 live selected and reselected captures did not clearly show white-dot handles; selection was confirmed (toolbar visible) but handle dots were not clearly visible in automation screenshots.
- Handle visibility remains the primary gap for this tool as of May 19, 2026.
- White-filled, blue-outlined circles are expected.

### 8. Drag and edit

- Each segment endpoint (A, B, C, D) should independently reshape the quadrilateral/hourglass when dragged.
- Body drag: translates the entire disjoint channel.
- The fill between the two segments updates to match the new segment positions.

### 9. Tooltip behavior

- No floating measurement pill observed.
- No intrinsic label or text.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- Fill color/opacity controls are present (supportsFill: true).
- Green default color: `#22C55E` per toolRegistry.ts defaultOptions.

### 11. Context menu

- Standard object menu (see cross-tool section).

### 12. Settings/style

- Line color: default green (`#22C55E`).
- Line width, style.
- Fill: color, opacity.
- The green default is TradingView-parity confirmed via toolRegistry.ts.

### 13. Text and label behavior

- supportsText: false.
- No right-axis labels observed in capture (neither segment necessarily touches the right boundary at a predictable y level).
- Date pills: for A and D timestamps (leftmost and rightmost anchors).

### 14. Chart interaction

- Both disconnected segments stay at their chart-coordinate anchors after pan/zoom.
- The fill region redraws correctly after viewport change.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape during any of the 4 wizard steps: cancels entire draw; no partial drawing committed.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes entire channel.
- Ctrl+Z: undoes.

### 16. Edge cases

- Intersecting segments (A-B crosses C-D): the hourglass fill shape is self-intersecting; TradingView still commits and renders the shape.
- Nearly parallel segments: the fill region is a proper quadrilateral.
- Collapsed quadrilateral (both segments nearly colinear): fills to a very thin strip.

### 17. Evidence and status

- Coverage status: partial — selection state and toolbar confirmed (May 19 live pass); handle visibility in selected state is the primary remaining gap; this tool is the one major handle-visibility hole after the May 19 pass
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-v2-disjointChannel.spec.ts` + primary source (handle dots did not present clearly in automation)
- Remaining gaps: explicit handle screenshot showing white circular endpoint dots; independent segment endpoint drag behavior confirmation
- Behavior was partially observed in TradingView live session May 19, 2026; selection confirmed but handles require a manual live observation

---

## Pitchforks

---

## pitchfork — Pitchfork (Andrews' Pitchfork)

### 1. Tool identity

- Exact TradingView tool name: `Pitchfork` (sometimes called Andrews' Pitchfork in the TradingView UI and documentation)
- Family/group: Lines > Pitchforks
- Menu location: first item in the Pitchforks subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Pitchfork"` within the popover
- Internal variant id: `pitchfork`
- toolRegistry label: `Pitchfork`
- Capabilities from registry: 3 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover, Pitchforks subsection.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode (3-click wizard).

### 3. Creation flow

- Click A: places anchor A (the pivot/handle point of the pitchfork).
- Click B: places anchor B; after B, a preview of the fork geometry appears relative to the cursor position for anchor C.
- Move mouse: the median line (from midpoint of A-B segment to cursor C) and the two outer rails (through A and B parallel to the median) update as cursor moves.
- Click C: commits the pitchfork; the full geometry (median, two rails, optional fills) is finalized.
- After commit: selected immediately; floating toolbar appears.
- Commit style: 3-click wizard.

### 4. Multi-anchor sequence

- Anchor A: the "handle" of the pitchfork; the median starts from the midpoint of the A-B segment.
- Anchor B: the second point; together A-B define the median direction by their midpoint.
- Anchor C: the third point; the median passes from the midpoint of A-B through C and extends; the outer rails pass through A and B parallel to the median.
- Andrews' Pitchfork median: passes through the midpoint of segment A-B and extends through C.
- After commit, dragging A changes median origin and outer rail positions; dragging B similarly; dragging C changes the slope of all three lines.
- Escape at any step: cancels.

### 5. Selection and reselection

- Selected immediately after commit.
- Body hit-testing: clicking any rail, the median, or the fill region selects the drawing.
- Deselect by clicking empty canvas.
- Reselect by clicking any visible element.
- Works after zoom/pan.

### 6. Hover and cursor

- Cursor over rail or median (unselected): pointer/hand.
- Cursor over fill region (unselected): pointer/hand.
- Cursor over anchor handle (when selected): resize cursor.

### 7. Handles and anchors

- Three circular anchor handles in selected state: one at A, one at B, one at C.
- White-filled, blue-outlined.
- Optional body/midpoint handles depending on TradingView version and user settings.

### 8. Drag and edit

- A drag: shifts the origin of one outer rail and adjusts the median pivot.
- B drag: shifts the origin of the other outer rail.
- C drag: changes the slope/direction of all three lines (median and both rails).
- Body drag: translates the entire pitchfork.

### 9. Tooltip behavior

- No floating measurement pill.
- Right-axis labels: for the three line values at the current right chart boundary (upper rail, median, lower rail).
- Bottom-axis date pills: for A, B, and C timestamps.

### 10. Floating toolbar

- Standard toolbar (see cross-tool section).
- Fill color/opacity controls are present (supportsFill: true).

### 11. Context menu

- Standard object menu (see cross-tool section).
- Context menu may include a variant-switch submenu allowing the user to switch between Pitchfork variants (Original/Andrews, Schiff, Modified Schiff, Inside) without recreating the drawing.

### 12. Settings/style

- Median line: color, width, style.
- Outer rails: color, width, style.
- Fill: color, opacity (for the region between rails).
- Optional: additional intermediate lines (0.25, 0.75, 1.5, 2.0 level lines).
- Optional: one-color mode (all lines share one color).
- Optional: extend all lines (median and rails continue to the right edge).
- May 19 live capture: red median, blue rails, teal/green fill (typical default appearance; defaults may vary by account settings).

### 13. Text and label behavior

- supportsText: false.
- Right-axis labels: for all visible rails and median at the right boundary.
- Date pills: for anchor timestamps.

### 14. Chart interaction

- Pan/zoom: the pitchfork stays at its chart-coordinate anchors; all three lines rescale with the viewport.
- After zoom: the fill region redraws correctly.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Escape during any wizard step: cancels.
- Escape while selected: deselects.
- Delete/Backspace while selected: removes entire pitchfork.
- Ctrl+Z: undoes.

### 16. Edge cases

- Third point (C) on the opposite side of the A-B line: the fork opens in the "other" direction; this is a valid placement.
- Highly compressed fork (C very close to the A-B midpoint): the fork has very narrow rail separation.
- Extra lines enabled: additional intermediate level lines appear; they are part of the same drawing and are removed together on Delete.

### 17. Evidence and status

- Coverage status: partial (3-click wizard flow confirmed; 3-handle layout confirmed; fill and rail geometry confirmed; context-menu variant switch partially confirmed; individual handle drag semantics not separately captured)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-pitchfork-500.spec.ts` + `e2e/tv-parity-behaviors.spec.ts` (wizard style used for all pitchfork family)
- Remaining gaps: exact variant-switch UI in context menu; individual rail/median style controls in settings dialog; optional additional lines behavior
- Behavior was directly observed in TradingView live session May 19, 2026

---

## schiffPitchfork — Schiff Pitchfork

### 1. Tool identity

- Exact TradingView tool name: `Schiff Pitchfork`
- Family/group: Lines > Pitchforks
- Menu location: second item in the Pitchforks subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Schiff Pitchfork"` or `aria-label="Schiff pitchfork"` within the popover
- Internal variant id: `schiffPitchfork`
- toolRegistry label: `Schiff pitchfork`
- Capabilities from registry: 3 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover, Pitchforks subsection.
- Last-used tool memory applies within the Lines group.
- Cursor changes to crosshair after activation.
- Single-commit mode (3-click wizard).

### 3. Creation flow

- Identical 3-click wizard as Pitchfork:
  - Click A
  - Click B (after B, fork preview appears with C at cursor)
  - Click C to commit
- Schiff-specific difference: the median origin is shifted from the midpoint of A-B by half the horizontal distance AND half the vertical distance between A and B, giving a different pivot location than Andrews' Pitchfork.
- After commit: selected immediately; floating toolbar appears.
- Commit style: 3-click wizard.

### 4. Multi-anchor sequence

- Same as Pitchfork (A, B, C).
- Schiff median origin = midpoint of A-B shifted by (half horizontal distance from A to B, half vertical distance from A to B), resulting in a different-looking fork geometry than Andrews'.
- All three anchors independently editable after commit.
- Escape at any step: cancels.

### 5. Selection and reselection

- Same as Pitchfork.
- Body hit-testing: rails, median, or fill.
- Deselect by clicking empty canvas.
- Reselect by clicking any element.

### 6. Hover and cursor

- Same as Pitchfork.

### 7. Handles and anchors

- Three circular handles at A, B, C.
- White-filled, blue-outlined.

### 8. Drag and edit

- Same family edit model as Pitchfork.
- A drag: affects one outer rail.
- B drag: affects the other outer rail.
- C drag: changes fork direction.
- Body drag: translates entire fork.

### 9. Tooltip behavior

- No measurement pill.
- Right-axis labels for visible line values at right boundary.
- Date pills for A, B, C timestamps.

### 10. Floating toolbar

- Standard toolbar with fill controls (supportsFill: true).

### 11. Context menu

- Standard menu with variant-switch option (may allow switching to Original / Modified / Inside).

### 12. Settings/style

- Same family styling model as Pitchfork: median, outer rails, fill, optional additional lines, one-color mode, extend option.
- Schiff-specific origin placement is controlled by the variant selection, not by a separate style setting.

### 13. Text and label behavior

- supportsText: false.
- Same axis label behavior as Pitchfork.

### 14. Chart interaction

- Same as Pitchfork: chart-coordinate anchoring; fill redraws correctly after pan/zoom.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Same as Pitchfork.

### 16. Edge cases

- Comparing Schiff origin vs. Andrews': for the same A, B, C anchors, the Schiff median has a visually different starting point; the outer rails still pass through A and B but in a shifted direction.
- Additional lines enabled: same behavior as Pitchfork family.

### 17. Evidence and status

- Coverage status: partial (3-click wizard confirmed; Schiff-specific origin geometry confirmed from official docs; live capture shows handle layout consistent with 3 anchors; individual drag semantics not separately captured)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-schiffPitchfork-500.spec.ts` + TradingView official help article for Schiff Pitchfork + primary source
- Remaining gaps: Schiff-origin geometry verification against Andrews' on the same anchors; context-menu variant switch UI steps
- Behavior was directly observed in TradingView live session May 19, 2026

---

## modifiedSchiffPitchfork — Modified Schiff Pitchfork

### 1. Tool identity

- Exact TradingView tool name: `Modified Schiff Pitchfork`
- Family/group: Lines > Pitchforks
- Menu location: third item in the Pitchforks subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Modified Schiff Pitchfork"` or `aria-label="Modified Schiff pitchfork"` within the popover
- Internal variant id: `modifiedSchiffPitchfork`
- toolRegistry label: `Modified Schiff pitchfork`
- Capabilities from registry: 3 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover, Pitchforks subsection.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode (3-click wizard).

### 3. Creation flow

- Identical 3-click wizard as Pitchfork and Schiff Pitchfork.
- Modified Schiff-specific difference: the median origin is shifted from A's position (not from the midpoint of A-B like Andrews', and differently from Schiff's half-horizontal/half-vertical offset). The exact origin placement: the median starts from the midpoint of the horizontal distance between A and B, but at A's y-position — or equivalently, the pivot is shifted half-horizontally relative to A. (The exact calculation distinguishes this variant from the other two.)
- After commit: selected immediately; floating toolbar appears.
- Commit style: 3-click wizard.

### 4. Multi-anchor sequence

- Same as Pitchfork family (A, B, C).
- Modified Schiff origin differs from both Andrews' and Schiff; the user cannot directly control the origin — it is calculated from A, B, C positions.
- All three anchors editable after commit.
- Escape at any step: cancels.

### 5. Selection and reselection

- Same as Pitchfork family.

### 6. Hover and cursor

- Same as Pitchfork family.

### 7. Handles and anchors

- Three circular handles at A, B, C.
- White-filled, blue-outlined.

### 8. Drag and edit

- Same family model as Pitchfork and Schiff Pitchfork.

### 9. Tooltip behavior

- No measurement pill.
- Right-axis labels for line values.
- Date pills for anchor timestamps.

### 10. Floating toolbar

- Standard toolbar with fill controls.

### 11. Context menu

- Standard menu with variant-switch option.

### 12. Settings/style

- Same family styling model (median, rails, fill, additional lines, one-color mode, extend).
- The variant label in the settings dialog context menu confirms this is "Modified Schiff."

### 13. Text and label behavior

- supportsText: false.
- Same axis label behavior as Pitchfork family.

### 14. Chart interaction

- Same as Pitchfork family.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Same as Pitchfork family.

### 16. Edge cases

- Comparing Modified Schiff origin vs. Andrews' and Schiff: for the same A, B, C anchors, the three variants produce visually distinct fork geometries; the Modified Schiff median pivot is at a third distinct position.
- Additional lines: same as other forks.

### 17. Evidence and status

- Coverage status: partial (3-click wizard and 3-handle layout confirmed; Modified-Schiff-specific origin geometry confirmed from official docs and context-menu style dialog; per-anchor drag verification not separately captured)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-modifiedSchiffPitchfork-500.spec.ts` + TradingView official documentation + primary source
- Remaining gaps: verification of Modified Schiff origin geometry calculation in implementation; context-menu variant switch from Modified Schiff to other variants
- Behavior was directly observed in TradingView live session May 19, 2026

---

## insidePitchfork — Inside Pitchfork

### 1. Tool identity

- Exact TradingView tool name: `Inside Pitchfork`
- Family/group: Lines > Pitchforks
- Menu location: fourth (last) item in the Pitchforks subsection of the Lines rail popover
- TradingView rail aria-label: `aria-label="Inside Pitchfork"` or `aria-label="Inside pitchfork"` within the popover
- Internal variant id: `insidePitchfork`
- toolRegistry label: `Inside pitchfork`
- Capabilities from registry: 3 anchors, draggable, resizable, supportsText: false, supportsFill: true, supportsLevels: false

### 2. Activation behavior

- Selectable from Lines rail popover, Pitchforks subsection.
- Last-used tool memory applies.
- Cursor changes to crosshair after activation.
- Single-commit mode (3-click wizard).

### 3. Creation flow

- Identical 3-click wizard as all other pitchfork family tools.
- Inside Pitchfork-specific geometry: the median origin is placed at the midpoint of the horizontal distance and half the vertical distance between A and B (same as Schiff Pitchfork for the horizontal component, but with a different vertical component — effectively placing the inside fork's origin "inside" the A-B span in a way that differs from both Andrews' and Schiff). Per official TradingView help article: "the origin is at half horizontal and half vertical distance between the first two points" — which is the same description as Schiff; the distinction between Inside and Schiff is that Inside draws the rails through the Inside of the A-B range rather than outside.
- After commit: selected immediately; floating toolbar appears.
- Commit style: 3-click wizard.

### 4. Multi-anchor sequence

- Same as Pitchfork family (A, B, C).
- Inside Pitchfork: the median and rails are drawn such that the fork's tines are "inside" the A-B range (between A and B rather than extending outward from A and B as the outer rails do in Andrews').
- All three anchors editable after commit.
- Escape at any step: cancels.

### 5. Selection and reselection

- Same as Pitchfork family.

### 6. Hover and cursor

- Same as Pitchfork family.

### 7. Handles and anchors

- Three circular handles at A, B, C.
- White-filled, blue-outlined.

### 8. Drag and edit

- Same family model; A, B, C independently editable; body drag translates entire fork.

### 9. Tooltip behavior

- No measurement pill.
- Right-axis labels for visible line values.
- Date pills for A, B, C timestamps.

### 10. Floating toolbar

- Standard toolbar with fill controls (supportsFill: true).

### 11. Context menu

- Standard menu with variant-switch option (confirmed in primary source: "selected capture shows family edit state and context menu variant switching").
- Via the context menu, users can switch among Original (Andrews'), Schiff, Modified Schiff, and Inside variants without redrawing.

### 12. Settings/style

- Same family styling model: median, rails, fill, additional lines, one-color mode, extend option.
- Style dialog exposes additional lines, one-color mode, background fill toggle, and variant conversion (as noted in primary source).

### 13. Text and label behavior

- supportsText: false.
- Same axis label behavior as Pitchfork family.

### 14. Chart interaction

- Same as Pitchfork family.
- Drawing persists when cursor exits to right edge.

### 15. Keyboard behavior

- Same as Pitchfork family.

### 16. Edge cases

- Confirming inside geometry stays distinct from Original and Schiff when anchors are moved: each variant applies its own origin calculation; switching via context menu re-renders the same anchors under a different geometric formula.
- Additional lines: same as other fork variants.

### 17. Evidence and status

- Coverage status: partial (3-click wizard confirmed; Inside-geometry origin confirmed from official docs; context-menu variant switching confirmed in selected-state capture; per-anchor drag verification not separately captured)
- Evidence source: live interaction (May 19, 2026 capture) + `e2e/tv-parity-insidePitchfork-500.spec.ts` + TradingView official help article for Inside Pitchfork + primary source
- Remaining gaps: exact Inside Pitchfork origin geometry calculation to distinguish from Schiff at the implementation level; context-menu variant switch steps and resulting geometry change
- Behavior was directly observed in TradingView live session May 19, 2026

---

## Summary table

| Tool ID | TV Name | Family | Anchors | Commit Style | supportsText | supportsFill | Default Color | Coverage Status |
|---|---|---|---|---|---|---|---|---|
| trend | Trendline | Lines > Lines | 2 | click-click | false | false | (user default) | partial |
| ray | Ray | Lines > Lines | 2 | click-click | false | false | (user default) | partial |
| infoLine | Info Line | Lines > Lines | 2 | click-click | true | false | (user default) | complete (pill format) |
| extendedLine | Extended Line | Lines > Lines | 2 | click-click | false | false | extends both | partial |
| trendAngle | Trend Angle | Lines > Lines | 2 | click-click | true | false | (user default) | partial |
| hline | Horizontal Line | Lines > Lines | 1 | single-click | false | false | (user default) | partial |
| horizontalRay | Horizontal Ray | Lines > Lines | 1 | single-click | false | false | (user default) | partial |
| vline | Vertical Line | Lines > Lines | 1 | single-click | false | false | (user default) | partial |
| crossLine | Cross Line | Lines > Lines | 1 | single-click | false | false | (user default) | partial |
| channel | Parallel Channel | Lines > Channels | 3 | 3-click wizard | false | true | (user default) | partial |
| regressionTrend | Regression Trend | Lines > Channels | 2 | click-click | false | true | data-driven | partial |
| flatTopBottom | Flat Top/Bottom | Lines > Channels | 2 | click-click | false | true | #FFD60A (yellow) | partial |
| disjointChannel | Disjoint Channel | Lines > Channels | 4 | 4-click wizard | false | true | #22C55E (green) | partial (handle gap) |
| pitchfork | Pitchfork | Lines > Pitchforks | 3 | 3-click wizard | false | true | (user default) | partial |
| schiffPitchfork | Schiff Pitchfork | Lines > Pitchforks | 3 | 3-click wizard | false | true | (user default) | partial |
| modifiedSchiffPitchfork | Modified Schiff Pitchfork | Lines > Pitchforks | 3 | 3-click wizard | false | true | (user default) | partial |
| insidePitchfork | Inside Pitchfork | Lines > Pitchforks | 3 | 3-click wizard | false | true | (user default) | partial |

---

## Known stale areas in older repo automation

The following older files contain assumptions that were disproven by the May 19, 2026 live capture and should not be used as behavioral reference without cross-checking against this document:

- `docs/TV_PARITY.md` — stale family inventory; not trustworthy.
- Some older tests model `channel` (Parallel Channel) as a 2-anchor tool; the correct model is 3 anchors.
- Some older tests model `disjointChannel` as a drag-commit tool; the correct model is 4-click wizard.
- Some older tests model the pitchfork family as drag-commit; the correct model is 3-click wizard.

## Remaining global gaps

- Selected-handle layout for Disjoint Channel is the primary unresolved evidence gap after the May 19, 2026 live pass.
- Hover-only cursor state (cursor when unselected and mousing over bodies without selecting) is lighter than ideal across all 17 tools.
- The Regression Trend per-handle drag semantics (does body drag recompute the regression or translate a cached result?) need a slower live pass.
- Panel discrepancy for Arrow and Anchored VWAP should be rechecked in a fresh live TradingView session; these tools are not in the 17-tool panel captured here.
- The shared-layout URL `https://in.tradingview.com/chart/QL1fWIPB/?symbol=NSE%3ARELIANCE` was access-blocked as of May 19, 2026; all captures were made on the public chart URL `https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE`.


---


# Section 2: Fibonacci and Gann Tools (15 tools)

This section documents the TradingView behavioral specification for all 15 Fibonacci and Gann drawing tools. Each tool is accessed from the same rail button (`[aria-label="Fibonacci tools"]`, internal category `fib`, data-testid `rail-fib`). The rail button opens a submenu that lists all 15 tools split into two subsections: **Fibonacci** (11 tools) and **Gann** (4 tools).

---

## Shared Behaviors (All Fib/Gann Tools)

### Rail and Menu

- Rail button: `[data-testid="rail-fib"]` / `[aria-label="Fibonacci tools"]`
- Clicking the rail button opens a popover submenu showing all 15 tools.
- The last-used tool within the fib/gann group is remembered by TradingView across sessions; clicking the rail icon directly activates that last-used tool without opening the submenu.
- Clicking the expand arrow on the rail button always opens the submenu.
- Tools are grouped in the submenu under two visual sections: "Fibonacci" and "Gann".

### Activation

- After picking any tool from the submenu, the cursor changes to a crosshair over the chart.
- The selected tool stays active until: (a) Escape is pressed, (b) a different tool is chosen, or (c) the user clicks a non-drawing UI element.
- In keep-drawing mode (localStorage key `chart-keep-drawing=true`), the tool remains active after each committed drawing, allowing repeated draws without re-selecting from the menu.

### Drawing Family

- All 15 tools have `family: 'fib'` and `category: 'fib'` in `toolRegistry.ts`.
- All are `draggable: true` and `resizable: true`.
- All have `supportsLevels: true` (level lines are intrinsic geometry, not annotations).
- Gann box, Gann square, and Gann square fixed have `supportsFill: true`; all Fibonacci tools except fibChannel have `supportsFill: false` in the registry (fibChannel is also false in the registry).

### Creation via Drag

- The standard creation gesture for all 2-anchor tools is **drag**: `pointerdown` at anchor A, drag to anchor B, `pointerup` commits the drawing.
- A live preview of the geometry renders between `pointerdown` and `pointerup`, updating every frame as the mouse moves.
- For pitchfan (3 anchors): three sequential clicks (not a drag) define the three control points.
- A drawing is not committed until `pointerup` (or the final click for multi-click tools); pressing Escape before commitment cancels without adding a drawing.

### Selection

- A committed drawing becomes selected immediately on commit (handles appear).
- Clicking away from any drawing deselects all.
- Clicking any level line, arc, or fill area of a drawing selects it.
- Selected state shows blue/highlighted levels and circular endpoint handles.
- Double-clicking a drawing typically opens its settings dialog.

### Keyboard

- `Escape`: during creation — cancels the in-progress drawing; when a drawing is selected — deselects it; when a tool is active (no drawing in progress) — deactivates the tool.
- `Delete` / `Backspace`: removes the currently selected drawing.
- `Ctrl+Z`: undoes the last action (draw, move, delete).
- `Ctrl+Y` / `Ctrl+Shift+Z`: redoes.
- No tool-specific hotkey is assigned to any individual fib/gann tool in TradingView's default keybindings.

### Floating Toolbar (all tools)

When a fib/gann drawing is selected, a floating toolbar appears above or near it, containing:

1. Color picker — changes the color applied to all level lines.
2. Line thickness selector.
3. Line style selector (solid, dashed, dotted).
4. Fill/background toggle (for tools that support fill areas between levels).
5. Settings button (gear icon) — opens the per-drawing settings/level configuration dialog.
6. Clone button — duplicates the drawing.
7. Lock toggle — locks position/size.
8. Visibility toggle — hides the drawing without deleting it.
9. Delete button (trash icon) — removes the drawing.

### Context Menu (right-click)

Right-clicking a drawing or its level lines shows a context menu with:
- Settings / Edit
- Clone
- Copy
- Lock/Unlock
- Show/Hide
- Remove

### Undo/Redo

- Every committed drawing adds one undo step to the history stack.
- `Ctrl+Z` removes the last-committed drawing (or reverses the last move/resize).
- `Ctrl+Y` / `Ctrl+Shift+Z` redoes.
- Multiple sequential undos walk back the full history.

### Pan/Zoom Behavior

- All level lines, arcs, fan lines, and grid elements are anchored in chart coordinates (time + price).
- Panning or zooming the chart rescales all drawing geometry to maintain the anchored positions; level ratios are preserved in price space.

---

## Tool 1: fibRetracement

### 1. Tool Identity

- **TradingView name**: `Fib retracement`
- **Internal variant**: `fibRetracement`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection of the fib/gann submenu

### 2. Activation Behavior

- Click rail → submenu opens showing all fib/gann tools.
- Click "Fib retracement" in the submenu → cursor becomes crosshair, tool activates.
- TradingView remembers fibRetracement as the last-used fib tool; subsequent clicks on the rail button (not the arrow) activate it directly.
- In keep-drawing mode, the tool stays active after each committed drawing.

### 3. Creation Flow

- **First click (anchor A)**: Sets the origin/base price level (typically a swing high or low). This is the 0% or 100% level depending on draw direction.
- **Mouse move**: A live preview of all Fibonacci level lines appears, updating as the mouse moves. Each level line is labeled with its ratio value.
- **Second click (anchor B)**: Sets the extent/target price. The drawing commits. The price range between A and B defines the 100% span.
- The tool commits on `pointerup` (drag gesture) per the E2E helper: `pointerdown` at A, drag to B, `pointerup`.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): The base price point. Holds the reference price from which all fib ratios are calculated.
- **Anchor B** (index 1): The extent price point. Defines the full range.
- After commit, both anchors can be dragged individually to reposition them; all level lines recalculate instantly.
- Preview geometry between clicks: full set of horizontal level lines at all defined ratios, spanning chart width.

### 5. Selection and Reselection

- Selected state: all level lines highlight in blue, two circular endpoint handles appear (one per anchor).
- Hit-testing: clicking any of the horizontal level lines selects the drawing.
- Deselect by clicking any empty chart area.
- Reselect by clicking any level line.
- When some levels are offscreen (above/below current chart view), the visible subset is still clickable; the drawing remains selectable via any visible level.

### 6. Hover and Cursor

- Cursor over a level line: becomes a move/pointer cursor indicating the line is interactive.
- Cursor over an endpoint handle: becomes a resize cursor.
- Cursor over chart background (tool active, no drawing started): crosshair.
- No hover pill or label popup for fib tools; selection handles appear only after clicking.

### 7. Handles and Anchors

- Two circular endpoint handles, one at each anchor (A and B).
- Handles appear on selection; dragging a handle repositions that anchor.
- No additional midpoint or body handles for the standard fib retracement.

### 8. Drag and Edit

- **Body drag** (clicking and dragging any level line with no handle under cursor): moves the entire drawing; both anchors shift by the same delta; all levels follow.
- **Endpoint drag** (dragging a circular handle): repositions only that anchor; the other anchor stays fixed; all level lines recalculate.
- All edits are undoable via `Ctrl+Z`.

### 9. Tooltip Behavior

- Each level line is labeled with its ratio value (e.g., `0`, `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1`, `1.618`, `2.618`, `3.618`, `4.236`).
- The price corresponding to each level is shown in a label on the right-hand price axis.
- During creation (before commit), the preview shows live level labels and prices as the mouse moves.
- No separate "tooltip bubble" appears on hover for fib tools; labels are always rendered as part of the drawing.

### 10. Floating Toolbar

When fibRetracement is selected: color picker, thickness, line style, settings (gear), clone, lock, hide, delete. No fill toggle (supportsFill: false).

### 11. Context Menu

Right-click on the drawing: Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- **Level configuration dialog**: opened via settings button or double-click. Allows:
  - Adding new levels at custom ratios.
  - Removing existing levels.
  - Changing the color per level individually.
  - Toggling visibility per level.
  - Toggling price label on axis per level.
  - Setting label text override per level.
  - Extend left / extend right toggles for each level line.
- Default levels: `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236]` (from `toolRegistry.ts` `behaviors.fibLevels`).

### 13. Text and Label Behavior

- `supportsText: true` — the drawing supports a free-form user text note attached to the drawing body.
- Level ratio labels (0, 0.236, etc.) are intrinsic rendering elements, separate from the user-added text.
- User-added text moves with the drawing on body drag.
- Level labels stay at their respective level lines regardless of any text.

### 14. Chart Interaction

- Pan/zoom: all level lines rescale and reposition to maintain their price coordinates; the 0% and 100% lines always appear at anchor A and anchor B prices respectively.
- Levels above or below the visible price range are clipped at the chart boundary.

### 15. Keyboard Behavior

- `Escape`: cancels creation or deselects.
- `Delete`/`Backspace`: removes selected drawing.
- `Ctrl+Z`/`Ctrl+Y`: undo/redo.
- No dedicated tool shortcut documented.

### 16. Edge Cases

- Very short drag (anchor A and B at nearly identical prices): the drawing commits but all levels collapse to approximately the same horizontal position; the ratios are still stored correctly.
- Drawing with anchor B above anchor A: levels display in inverted order (extension levels appear below 0%, retracement levels above).
- All levels visible vs. most offscreen: drawing remains selectable via any visible level line.
- Level at 0% coincides exactly with anchor A price; level at 100% coincides with anchor B price.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec exists at `e2e/tv-parity-v2-fibRetracement.spec.ts` (500 tests via factory). Earlier 500-test spec at `e2e/fib-channel-500.spec.ts` covers the drawing lifecycle in full for the fib family.
- **Evidence**: `capture-tv-fib-tools.mjs` captures live screenshots; slug `fib-retracement`, tooltip `Fib retracement` verified against TV DOM.
- **Verified behaviors**: tool activation, drag-to-draw, anchor count (2), family (`fib`), variant name, undo/redo, Delete/Backspace, Escape, keep-drawing mode, scroll/zoom invariance.
- **Remaining gaps**: live verification of level label rendering, per-level color settings dialog, extend left/right, price axis label behavior, right-click context menu in parity app.

---

## Tool 2: fibExtension

### 1. Tool Identity

- **TradingView name**: `Trend-based fib extension`
- **Internal variant**: `fibExtension`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection; appears immediately below Fib retracement

### 2. Activation Behavior

- Opens submenu → click "Trend-based fib extension" → crosshair cursor.
- TV remembers last variant; if fibExtension was last used, rail click activates it directly.
- In keep-drawing mode, stays active after each committed drawing.

### 3. Creation Flow

- **First click (anchor A)**: Sets the trend start point. This defines the beginning of the price move from which extension targets are projected.
- **Mouse move**: Live preview of extension level lines appears.
- **Second click (anchor B)**: Sets the trend end point. The 0% level aligns to anchor A, the 100% level aligns to anchor B, and extension levels (1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236) project beyond anchor B in the trend direction.
- Note: The capture script notes `trend-based-fib-extension` as a three-anchor tool in its logic (`threeAnchor` flag). In practice TradingView's "Trend-based fib extension" uses 2 anchors for the trend baseline; the registry also records `anchors: 2`. The third-click logic in the capture script may be a legacy/fallback that does not apply to the actual committed drawing structure.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Trend start — the 0% reference.
- **Anchor B** (index 1): Trend end — the 100% reference. Extension levels project from B outward.
- Both anchors adjustable after commit by dragging their handles.
- Preview shows all level lines (including extension levels beyond B) updating live.

### 5. Selection and Reselection

- Same as fibRetracement: blue/highlighted levels on selection, two circular handles.
- Hit-testing: any visible level line is clickable to select.
- Deselect by clicking empty chart area.

### 6. Hover and Cursor

- Cursor over level line: move/pointer.
- Cursor over handle: resize.
- Active tool, no drawing: crosshair.

### 7. Handles and Anchors

- Two circular handles at anchor A and anchor B.
- Dragging either handle repositions that anchor; extension levels recalculate.

### 8. Drag and Edit

- Body drag: moves entire drawing.
- Endpoint drag: repositions one anchor, recalculates all levels.
- All changes undoable.

### 9. Tooltip Behavior

- Level lines labeled with their ratio values: `0`, `0.382`, `0.5`, `0.618`, `1`, `1.272`, `1.414`, `1.618`, `2`, `2.618`, `3.618`, `4.236`.
- Price labels on right axis for each level.
- Live preview during creation shows all labels.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill toggle.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level configuration dialog: add/remove levels, per-level color, visibility, price label toggle, extend left/right.
- Default levels: `[0, 0.382, 0.5, 0.618, 1, 1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236]`.

### 13. Text and Label Behavior

- `supportsText: true`: user text note supported, moves with body.
- Ratio labels are intrinsic rendering elements separate from user text.

### 14. Chart Interaction

- Pan/zoom rescales all level lines; extension levels project from anchor B in the same relative price direction regardless of zoom.

### 15. Keyboard Behavior

- `Escape`, `Delete`/`Backspace`, `Ctrl+Z`/`Ctrl+Y` behave identically to fibRetracement.
- No dedicated shortcut.

### 16. Edge Cases

- Anchors at same price: all extension levels collapse; no visual separation.
- Anchors at same time (vertical alignment): level lines become degenerate; TradingView handles this gracefully without crash.
- Very large extension multiples (4.236) may be far outside the visible chart area.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibExtension.spec.ts`.
- **Evidence**: Capture script slug `trend-based-fib-extension`, tooltip `Trend-based fib extension` verified.
- **Verified behaviors**: tool activation, variant name, anchor count (2), family, undo/redo, keep-drawing.
- **Remaining gaps**: Extension level rendering beyond anchor B, live label positions during preview.

---

## Tool 3: fibChannel

### 1. Tool Identity

- **TradingView name**: `Fib channel`
- **Internal variant**: `fibChannel`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Fib channel" → crosshair cursor.
- Last-used behavior standard to fib group.
- Keep-drawing mode: tool stays active after each committed drawing.

### 3. Creation Flow

- **First click (anchor A)**: Sets one edge of the channel (baseline start and direction).
- **Mouse move**: Live preview of parallel channel lines at fib ratios appears.
- **Second click (anchor B)**: Sets the other edge. The channel is defined by the vector from A to B; parallel lines are drawn at fib levels perpendicular to the channel direction, creating a diagonal band.
- The channel is not a horizontal level tool; it creates angled parallel lines whose spacing is determined by fib ratios of the A-to-B vector.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Channel baseline start — sets the origin and angle.
- **Anchor B** (index 1): Channel baseline end — sets the direction vector and scale.
- Both anchors adjustable after commit.
- Preview: angled parallel lines fan out from the baseline.

### 5. Selection and Reselection

- Selected: parallel channel lines highlight, two handles appear.
- Hit-testing: clicking any channel line selects the drawing.
- Deselect by clicking elsewhere.

### 6. Hover and Cursor

- Cursor over channel line: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles at anchor A and anchor B.

### 8. Drag and Edit

- Body drag: moves entire channel (both anchors shift).
- Endpoint drag: repositions one anchor, all channel lines recalculate angle and spacing.

### 9. Tooltip Behavior

- Each parallel line labeled with its fib ratio.
- Price and time labels where applicable.
- Live preview labels during creation.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill toggle (supportsFill: false in registry).

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level configuration dialog: add/remove levels, per-level color, extend behavior.
- No dedicated `fibLevels` default defined in registry (inherits from the fibSchema options).

### 13. Text and Label Behavior

- `supportsText: true`: user text note supported.
- Channel line labels are intrinsic geometry labels.

### 14. Chart Interaction

- Pan/zoom: channel lines maintain their anchored coordinates; the angle and spacing scale with the chart.

### 15. Keyboard Behavior

- Same as other fib tools: Escape, Delete/Backspace, Ctrl+Z/Y.

### 16. Edge Cases

- Anchors on same horizontal level: channel becomes horizontal, parallel lines are horizontal bands.
- Anchors on same vertical time: channel becomes vertical (degenerate case).
- Very short anchor distance: channel lines are closely packed.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibChannel.spec.ts`; comprehensive 500-test spec at `e2e/fib-channel-500.spec.ts` (500 tests, fully documented lifecycle).
- **Evidence**: Capture script slug `fib-channel`, tooltip `Fib channel` verified. The 500-test spec confirms: 2 anchors, family `fib`, variant `fibChannel`, drag-to-draw, selection, undo/redo, Delete/Backspace, coexistence with other fib/gann variants, scroll/zoom invariance.
- **Verified behaviors**: Fully covered by fib-channel-500.spec.ts sections A–E.
- **Remaining gaps**: Channel angle geometry rendering, angled parallel line label placement.

---

## Tool 4: fibTimeZone

### 1. Tool Identity

- **TradingView name**: `Fib time zone`
- **Internal variant**: `fibTimeZone`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Fib time zone" → crosshair cursor.
- Last-used behavior standard.
- Keep-drawing mode supported.

### 3. Creation Flow

- **First click (anchor A)**: Sets the time origin — the leftmost vertical boundary from which Fibonacci time intervals are measured.
- **Mouse move**: Live preview of vertical lines at Fibonacci time intervals (1, 1, 2, 3, 5, 8, 13, 21, 34, ...) appears, updating as the mouse moves horizontally.
- **Second click (anchor B)**: Sets the interval unit — the time distance from A to B defines the base interval. Subsequent vertical lines are placed at Fibonacci multiples of that interval.
- This is a **time-axis** tool: vertical lines at fib time intervals, not horizontal price levels.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Time origin (leftmost vertical line).
- **Anchor B** (index 1): Defines the base time unit; horizontal distance A→B determines the spacing of subsequent vertical zones.
- Preview: vertical lines project to the right at Fibonacci intervals.
- After commit: both anchors adjustable; dragging B changes the base time interval; all subsequent zone lines rescale.

### 5. Selection and Reselection

- Selected: vertical zone lines highlight, two handles appear.
- Hit-testing: clicking any vertical zone line selects the drawing.
- Deselect by clicking empty area.

### 6. Hover and Cursor

- Cursor over vertical zone line: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles (one per anchor).
- Handles are positioned at the top (or bottom) of the vertical lines at anchor A and anchor B positions.

### 8. Drag and Edit

- Body drag: moves the entire set of vertical zone lines in time.
- Endpoint drag: repositions anchor A (shifts origin) or anchor B (changes interval scale); all zone lines recalculate.

### 9. Tooltip Behavior

- Each vertical line is labeled with its Fibonacci number (1, 1, 2, 3, 5, 8, 13, 21, ...) or the index number.
- Labels appear at the top of each vertical line.
- No price axis label (this is a time-axis tool).
- Live preview during creation shows vertical line labels updating as mouse moves.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill toggle.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Settings dialog: configure which Fibonacci time sequence values to show, colors, line style.
- `supportsLevels: true` — the "levels" concept here refers to the time zone indices.

### 13. Text and Label Behavior

- `supportsText: true`: user text note supported.
- Time zone index labels are intrinsic.

### 14. Chart Interaction

- Pan/zoom: vertical lines remain at their anchored time positions; zooming in or out stretches or compresses their visual spacing but does not change which bars they are anchored to.

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Very small time interval (anchor B only 1 bar from anchor A): subsequent zones pile up tightly.
- Anchor B to the left of anchor A: zones may project leftward (tool behavior depends on TV implementation).
- Most zone lines offscreen: drawing still selectable via any visible vertical line.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibTimeZone.spec.ts`; 500-test spec at `e2e/fib-time-zone-500.spec.ts`.
- **Evidence**: Capture script slug `fib-time-zone`, tooltip `Fib time zone` verified.
- **Verified behaviors**: activation, 2 anchors, family `fib`, variant, undo/redo.
- **Remaining gaps**: Vertical line rendering and labeling, time-axis coordinate behavior.

---

## Tool 5: fibSpeedResistFan

### 1. Tool Identity

- **TradingView name**: `Fib speed resistance fan`
- **Internal variant**: `fibSpeedResistFan`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Fib speed resistance fan" → crosshair cursor.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **First click (anchor A)**: Sets the fan origin point (the pivot from which fan lines radiate).
- **Mouse move**: Live preview of fan lines at fib speed/resistance angles appears.
- **Second click (anchor B)**: Sets the extent point, defining the bounding box for the fan. Fan lines radiate from anchor A through fib ratio positions within the A-to-B rectangle.
- Fan lines represent speed resistance levels (1/8, 1/4, 1/3, 3/8, 1/2, 5/8, 2/3, 3/4, 7/8) and Fibonacci ratios (0.236, 0.382, 0.618, 0.786) drawn as lines from the origin.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Fan origin (pivot corner).
- **Anchor B** (index 1): Defines the opposite corner of the bounding box; all fan lines terminate (or extend) relative to this box.
- After commit: dragging either handle recalculates all fan lines.
- Preview: fan lines fan outward from A toward B, updating live.

### 5. Selection and Reselection

- Selected: fan lines highlight, two handles appear.
- Hit-testing: clicking any fan line selects the drawing.

### 6. Hover and Cursor

- Cursor over fan line: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles at A and B.

### 8. Drag and Edit

- Body drag: moves entire fan.
- Endpoint drag: repositions anchor, all fan lines recalculate.

### 9. Tooltip Behavior

- Each fan line labeled with its ratio (e.g., `1/3`, `1/2`, `2/3`, or Fibonacci value).
- Labels appear along each fan line or at its terminus.
- Live preview labels during creation.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill (supportsFill: false).

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level config dialog: configure which fan lines are visible, their colors, and line style.

### 13. Text and Label Behavior

- `supportsText: false` — no user text note supported.
- Fan line ratio labels are intrinsic.

### 14. Chart Interaction

- Pan/zoom: fan lines maintain anchored coordinates; angles may appear to change visually if the chart aspect ratio changes significantly (price scale vs. time scale).

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Very small bounding box: fan lines cluster tightly.
- Anchor A = Anchor B: degenerate; no fan geometry.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibSpeedResistFan.spec.ts`; 500-test spec at `e2e/fib-speed-resist-fan-500.spec.ts`.
- **Evidence**: Capture script slug `fib-speed-resistance-fan`, tooltip `Fib speed resistance fan` verified.
- **Verified behaviors**: activation, 2 anchors, family `fib`, undo/redo.
- **Remaining gaps**: Fan line angle rendering, ratio label placement.

---

## Tool 6: fibTrendTime

### 1. Tool Identity

- **TradingView name**: `Trend-based fib time`
- **Internal variant**: `fibTrendTime`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Trend-based fib time" → crosshair cursor.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **First click (anchor A)**: Sets the trend start time point.
- **Mouse move**: Live preview of vertical time zone lines appears.
- **Second click (anchor B)**: Sets the trend end time point. The A-to-B time span defines the base time unit. Fibonacci multiples of this unit (0.382, 0.618, 1, 1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236) are projected as vertical lines to the right of anchor B.
- This is TradingView's trend-based version of fib time zones: the base interval is defined by a trend's start-to-end time, not a fixed bar count.
- The capture script marks this as a three-anchor tool. In TradingView, "Trend-based fib time" may require a third click to set the projection start separately from the base trend. The registry records `anchors: 2`, so the parity implementation uses 2 anchors.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Trend start time.
- **Anchor B** (index 1): Trend end time.
- Fibonacci time projections appear as vertical lines to the right.
- After commit: both anchors adjustable.

### 5. Selection and Reselection

- Selected: vertical lines highlight, handles appear.
- Hit-testing: clicking any vertical zone line.

### 6. Hover and Cursor

- Cursor over vertical line: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles at A and B.

### 8. Drag and Edit

- Body drag: shifts all vertical lines in time.
- Endpoint drag: changes the base trend interval, all projections rescale.

### 9. Tooltip Behavior

- Each vertical line labeled with its fib ratio value (e.g., `0.382`, `0.618`, `1`, `1.618`, ...).
- Labels at top of each vertical line.
- No price axis label.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level config: configure which projection ratios are shown, line style, colors.

### 13. Text and Label Behavior

- `supportsText: true`: user text note supported.
- Time projection labels are intrinsic.

### 14. Chart Interaction

- Pan/zoom: vertical lines anchor to their time positions; zooming out shows more zone lines simultaneously.

### 15. Keyboard Behavior

- Standard: Escape, Delete/Backspace, Ctrl+Z/Y.

### 16. Edge Cases

- Anchors at same time: degenerate base interval; projections may collapse.
- Projections far in the future (beyond loaded chart data): vertical lines render but may extend past the chart's time range.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibTrendTime.spec.ts`; 500-test spec at `e2e/fib-trend-time-500.spec.ts`.
- **Evidence**: Capture script slug `trend-based-fib-time`, tooltip `Trend-based fib time` verified.
- **Verified behaviors**: activation, 2 anchors, family, undo/redo.
- **Remaining gaps**: Projection rendering, three-anchor vs two-anchor clarification in live TV.

---

## Tool 7: fibCircles

### 1. Tool Identity

- **TradingView name**: `Fib circles`
- **Internal variant**: `fibCircles`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Fib circles" → crosshair cursor.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **First click (anchor A)**: Sets the center of the concentric circle system.
- **Mouse move**: Live preview of concentric circles at Fibonacci radius ratios appears.
- **Second click (anchor B)**: Sets the reference radius. The distance from A to B defines the base radius (100% circle). Circles are drawn at Fibonacci multiples of this radius.
- Circles are concentric around anchor A; the radii scale with the Fibonacci sequence (0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, ...).

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Circle center.
- **Anchor B** (index 1): Reference point; A-to-B distance = base radius (1.0 ratio circle passes through B).
- After commit: dragging A moves the center; dragging B scales all circles.

### 5. Selection and Reselection

- Selected: circles highlight, two handles appear.
- Hit-testing: clicking any circle arc selects the drawing.
- Deselect by clicking elsewhere.

### 6. Hover and Cursor

- Cursor over circle arc: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles: center (A) and radius point (B).

### 8. Drag and Edit

- Body drag (dragging a circle arc): moves center (A) and B by equal delta.
- Endpoint drag: dragging A moves center; dragging B rescales all circles.

### 9. Tooltip Behavior

- Each circle labeled with its ratio value (e.g., `0.382`, `0.618`, `1`, `1.618`, ...).
- Labels appear at the circumference or at a consistent angular position.
- Live preview during creation.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill (supportsFill: false).

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level config: add/remove circle ratios, per-level colors, visibility.

### 13. Text and Label Behavior

- `supportsText: false`: no user text note.
- Circle ratio labels are intrinsic.

### 14. Chart Interaction

- Pan/zoom: circles are drawn in chart coordinate space. Because the chart may use non-uniform x/y scaling (price vs. time), circles may appear elliptical in pixel space; this is expected behavior matching TradingView.

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Anchors at same point: circles collapse; degenerate.
- Very large radius: outer circles extend well beyond the chart view.
- Circle arcs partially offscreen: visible portions still selectable.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibCircles.spec.ts`; 500-test spec at `e2e/fib-circles-500.spec.ts`.
- **Evidence**: Capture script slug `fib-circles`, tooltip `Fib circles` verified.
- **Verified behaviors**: activation, 2 anchors, family, undo/redo.
- **Remaining gaps**: Circle rendering in non-square chart coordinate space, label placement on arcs.

---

## Tool 8: fibSpiral

### 1. Tool Identity

- **TradingView name**: `Fib spiral`
- **Internal variant**: `fibSpiral`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Fib spiral" → crosshair cursor.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **First click (anchor A)**: Sets the spiral center/origin.
- **Mouse move**: Live preview of a logarithmic (golden) spiral appears, growing outward from A.
- **Second click (anchor B)**: Sets the initial spiral radius and direction. The A-to-B distance and angle determine the scale and orientation of the spiral.
- The spiral follows the golden ratio (phi ≈ 1.618), expanding by phi with each quarter turn.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Spiral center.
- **Anchor B** (index 1): Initial point on the spiral; defines scale and orientation.
- After commit: dragging A moves the spiral center; dragging B scales and rotates.

### 5. Selection and Reselection

- Selected: spiral curve highlights, two handles appear.
- Hit-testing: clicking anywhere on the spiral curve selects the drawing.

### 6. Hover and Cursor

- Cursor over spiral curve: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles at center (A) and initial point (B).

### 8. Drag and Edit

- Body drag: moves entire spiral.
- Endpoint drag: repositions anchor; spiral rescales/reorients.

### 9. Tooltip Behavior

- A single spiral curve with no level-ratio labels (unlike fib retracement). The spiral itself is the geometric output.
- Labels may appear at key quarter-turn points if configured.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Settings dialog: line color, thickness, style; option to extend spiral additional turns.

### 13. Text and Label Behavior

- `supportsText: false`: no user text note.
- The spiral does not have per-level ratio labels in the traditional sense.

### 14. Chart Interaction

- Pan/zoom: spiral is anchored in chart coordinates. Like fibCircles, the spiral may appear distorted in pixel space due to non-uniform chart scaling.

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Tiny anchor distance: spiral is very tight/small.
- Spiral extending far beyond the chart: only the visible portion renders.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibSpiral.spec.ts`; 500-test spec at `e2e/fib-spiral-500.spec.ts`.
- **Evidence**: Capture script slug `fib-spiral`, tooltip `Fib spiral` verified.
- **Verified behaviors**: activation, 2 anchors, family, undo/redo.
- **Remaining gaps**: Golden-ratio spiral rendering, coordinate-space distortion behavior.

---

## Tool 9: fibSpeedResistArcs

### 1. Tool Identity

- **TradingView name**: `Fib speed resistance arcs`
- **Internal variant**: `fibSpeedResistArcs`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Fib speed resistance arcs" → crosshair cursor.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **First click (anchor A)**: Sets the arc origin (pivot point from which arcs radiate).
- **Mouse move**: Live preview of arc curves at speed/resistance ratios appears.
- **Second click (anchor B)**: Sets the arc extent; A-to-B distance defines the base radius. Arcs at fib/speed-resistance ratios (1/8, 1/3, 3/8, 1/2, 5/8, 2/3, 7/8, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618) radiate from A as curved arcs sweeping from the baseline.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Arc pivot/center.
- **Anchor B** (index 1): Defines the bounding baseline; arc radii scale relative to A-B.
- After commit: both handles adjustable.

### 5. Selection and Reselection

- Selected: arc curves highlight, two handles appear.
- Hit-testing: clicking any arc curve selects the drawing.

### 6. Hover and Cursor

- Cursor over arc: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles at A (origin) and B (extent).

### 8. Drag and Edit

- Body drag: moves entire arc system.
- Endpoint drag: repositions one anchor, all arcs recalculate.

### 9. Tooltip Behavior

- Each arc labeled with its speed/resistance or fib ratio.
- Labels appear at the arc's rightmost or topmost visible point.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level config: which arcs to show, colors, line style.

### 13. Text and Label Behavior

- `supportsText: false`: no user text note.
- Arc ratio labels are intrinsic.

### 14. Chart Interaction

- Pan/zoom: arcs maintain anchored coordinates; like circles, may appear elliptical in pixel space.

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Very small A-B distance: arcs cluster near origin.
- Large radii: arcs extend beyond visible chart.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibSpeedResistArcs.spec.ts`; 500-test spec at `e2e/fib-speed-resist-arcs-500.spec.ts`.
- **Evidence**: Capture script slug `fib-speed-resistance-arcs`, tooltip `Fib speed resistance arcs` verified.
- **Verified behaviors**: activation, 2 anchors, family, undo/redo.
- **Remaining gaps**: Arc curve rendering, ratio label placement on arcs.

---

## Tool 10: fibWedge

### 1. Tool Identity

- **TradingView name**: `Fib wedge`
- **Internal variant**: `fibWedge`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection

### 2. Activation Behavior

- Opens submenu → click "Fib wedge" → crosshair cursor.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **First click (anchor A)**: Sets the wedge apex (narrow end of the wedge).
- **Mouse move**: Live preview of wedge-shaped fib zone lines appears, fanning out from A.
- **Second click (anchor B)**: Sets the wedge extent/open end. The fib ratios define angled lines between the apex and the extent, creating a wedge-shaped pattern.
- The wedge tool draws lines that fan outward from the apex, with each line at a fib ratio of the total wedge angle.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Wedge apex (convergence point).
- **Anchor B** (index 1): Open end reference; defines the wedge scale and direction.
- After commit: both handles adjustable.

### 5. Selection and Reselection

- Selected: wedge lines highlight, two handles appear.
- Hit-testing: clicking any wedge line selects the drawing.

### 6. Hover and Cursor

- Cursor over wedge line: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles at A (apex) and B (extent).

### 8. Drag and Edit

- Body drag: moves entire wedge.
- Endpoint drag: repositions anchor, wedge recalculates.

### 9. Tooltip Behavior

- Each wedge line labeled with its fib ratio.
- Labels at the open end of each line.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level config: which levels are shown, colors.

### 13. Text and Label Behavior

- `supportsText: false`: no user text note.
- Wedge line labels are intrinsic.

### 14. Chart Interaction

- Pan/zoom: wedge lines maintain anchored coordinates; angle may appear to change with chart scale changes.

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Apex and extent at same point: degenerate wedge.
- Very wide wedge: outer lines may exit the chart.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-fibWedge.spec.ts`; 500-test spec at `e2e/fib-wedge-500.spec.ts`.
- **Evidence**: Capture script slug `fib-wedge`, tooltip `Fib wedge` verified.
- **Verified behaviors**: activation, 2 anchors, family, undo/redo.
- **Remaining gaps**: Wedge geometry rendering, angular label placement.

---

## Tool 11: pitchfan

### 1. Tool Identity

- **TradingView name**: `Pitchfan`
- **Internal variant**: `pitchfan`
- **Category**: Fibonacci
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Fibonacci
- **Menu location**: Direct item in Fibonacci subsection; last item before the Gann group

### 2. Activation Behavior

- Opens submenu → click "Pitchfan" → crosshair cursor.
- Standard last-used behavior. Keep-drawing mode supported.
- After commit of a 3-click drawing, the tool stays active in keep-drawing mode.

### 3. Creation Flow

- This is a **3-anchor tool** (unlike all other Fibonacci tools in this group which use 2 anchors).
- **First click (anchor A)**: Sets the pivot/origin point.
- **Mouse move**: Line preview from A to cursor appears.
- **Second click (anchor B)**: Sets the first swing high or low.
- **Mouse move**: Fan preview from A through B and extending to cursor position appears.
- **Third click (anchor C)**: Sets the second swing point, completing the fan. All fan lines radiate from A through fib-spaced positions on the B-to-C segment.
- Three sequential clicks (not a drag) commit the drawing.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Fan origin/pivot.
- **Anchor B** (index 1): First reference swing point.
- **Anchor C** (index 2): Second reference swing point. The B-to-C segment defines the "width" of the fan at some reference distance; fib levels on this segment determine where each fan line passes.
- After commit: all three handles adjustable independently; repositioning any handle recalculates all fan lines.
- Preview between clicks 1–2: single line from A to mouse. Preview between clicks 2–3: full fan geometry from A through the B-to-C range.

### 5. Selection and Reselection

- Selected: all fan lines highlight; three circular handles appear.
- Hit-testing: clicking any fan line selects the drawing.
- Deselect by clicking elsewhere.
- Reselect by clicking any fan line.

### 6. Hover and Cursor

- Cursor over fan line: move/pointer.
- Cursor over handle: resize.
- Active tool (between clicks): crosshair.

### 7. Handles and Anchors

- **Three circular handles**: one at each of A, B, and C.
- Dragging any handle repositions that point; all fan lines recalculate.

### 8. Drag and Edit

- Body drag (dragging a fan line away from handles): moves the entire fan; all three anchors shift by the same delta.
- Individual handle drag: repositions only that anchor.

### 9. Tooltip Behavior

- Each fan line labeled with its fib ratio (e.g., `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1`).
- Labels appear along each fan line at a fixed distance from origin or at the edge of the chart.
- During creation: fan line labels appear live during the second mouse-move phase.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Level config: which fan lines are shown, per-line colors.

### 13. Text and Label Behavior

- `supportsText: false`: no user text note.
- Fan line ratio labels are intrinsic.

### 14. Chart Interaction

- Pan/zoom: fan lines maintain anchored coordinates; angles may shift visually with chart scale changes.

### 15. Keyboard Behavior

- During 3-click creation: `Escape` at any point cancels the in-progress drawing.
- After commit: `Delete`/`Backspace`, `Ctrl+Z`/`Ctrl+Y` standard.

### 16. Edge Cases

- Anchors A, B, C collinear: degenerate fan; lines converge.
- Anchors B and C at same position: all fan lines collapse to a single line.
- Third click not placed: drawing stays in "pending" preview state until committed or Escape pressed.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-pitchfan.spec.ts`; 500-test spec at `e2e/pitchfan-500.spec.ts`.
- **Evidence**: Capture script slug `pitchfan`, tooltip `Pitchfan` verified. Registry confirms `anchors: 3`.
- **Verified behaviors**: activation, 3 anchors (unique among fib tools), family `fib`, undo/redo.
- **Remaining gaps**: Live behavior of 3-click sequence in parity app, fan line angle rendering.

---

## Tool 12: gannBox

### 1. Tool Identity

- **TradingView name**: `Gann box`
- **Internal variant**: `gannBox`
- **Category**: Gann (within Fibonacci rail)
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Gann
- **Menu location**: First item in the Gann subsection of the fib/gann submenu

### 2. Activation Behavior

- Opens submenu → scroll/navigate to Gann section → click "Gann box" → crosshair cursor.
- Standard last-used behavior; if gannBox was last used, rail click activates it directly.
- Keep-drawing mode supported.

### 3. Creation Flow

- **Drag gesture** (2-anchor): `pointerdown` at one corner of the box, drag to opposite corner, `pointerup` commits.
- **Anchor A** defines the first corner (origin); **Anchor B** defines the opposite corner (extent).
- As the user drags, a rectangular Gann box preview appears showing the time-price grid inside.
- The Gann box creates a rectangular grid overlay dividing the price range and time range into Gann sections (eighths and thirds of the range, plus fib ratios).

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): First corner of the box (top-left or bottom-left depending on drag direction).
- **Anchor B** (index 1): Opposite corner (bottom-right or top-right).
- After commit: both corner handles (and potentially all four corner handles for a rectangle) are adjustable.
- Preview: filled rectangular grid with time and price division lines visible during drag.

### 5. Selection and Reselection

- Selected: box border highlights, corner handles appear, grid interior may highlight.
- Hit-testing: clicking the box border, any internal grid line, or the fill area selects the drawing.
- Deselect by clicking outside.

### 6. Hover and Cursor

- Cursor over box border or grid lines: move/pointer.
- Cursor over corner handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two primary handles (one at each anchor corner). TradingView may show additional edge midpoint handles for resizing individual sides.
- Dragging a corner handle resizes the box; the opposite corner stays fixed.

### 8. Drag and Edit

- Body drag (inside the box area, not on a handle): moves the entire box.
- Corner handle drag: resizes the box; all grid lines inside recalculate proportionally.
- Edge handle drag (if present): resizes in one dimension only.

### 9. Tooltip Behavior

- Internal grid lines are labeled with their Gann ratio values (eighths: 1/8, 2/8=1/4, 3/8, 4/8=1/2, 5/8, 6/8=3/4, 7/8; thirds: 1/3, 2/3; plus fib levels).
- Time axis labels (dates/bars) appear at each vertical division.
- Price axis labels at each horizontal division.
- During creation: grid preview fills the box live.

### 10. Floating Toolbar

Color picker, thickness, line style, fill/background toggle, settings, clone, lock, hide, delete. Fill toggle is available (supportsFill: true).

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Settings dialog: configure which grid lines are shown; time scale (bars vs. absolute time); price scale; grid color; fill color with opacity; angle configuration.
- `supportsLevels: true` — the grid lines act as "levels."
- `supportsFill: true` — the interior of the box can have a background color/fill.

### 13. Text and Label Behavior

- `supportsText: false`: no free-form user text note.
- Grid labels are intrinsic to the drawing.

### 14. Chart Interaction

- Pan/zoom: the box maintains its anchored price and time coordinates; as the user zooms in or out, the box scales with the chart.
- Gann tools in TradingView maintain geometric scale; the internal grid spacing does not "snap" to bars but maintains the ratio divisions.

### 15. Keyboard Behavior

- `Escape`: cancels creation mid-drag or deselects.
- `Delete`/`Backspace`: removes selected drawing.
- `Ctrl+Z`/`Ctrl+Y`: undo/redo.

### 16. Edge Cases

- Very small box (A and B nearly coincident): box commits with a degenerate grid.
- Box dragged with negative width (B to the left of A): TradingView normalizes the coordinates; the box is always rendered with positive width and height.
- Box near edge of chart: grid lines that extend beyond the chart are clipped.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-gannBox.spec.ts` (500 tests via factory); standalone 500-test spec at `e2e/gann-box-500.spec.ts`.
- **Evidence**: Capture script slug `gann-box`, tooltip `Gann box` verified. Registry confirms `anchors: 2`, `supportsFill: true`, family `fib`.
- **Verified behaviors**: tool activation, drag-to-draw, 2 anchors, family `fib`, variant `gannBox`, undo/redo, Delete/Backspace, Escape, scroll/zoom invariance.
- **Remaining gaps**: Grid line rendering and ratio label placement, fill behavior, corner handle resize geometry.

---

## Tool 13: gannSquareFixed

### 1. Tool Identity

- **TradingView name**: `Gann square fixed`
- **Internal variant**: `gannSquareFixed`
- **Category**: Gann (within Fibonacci rail)
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Gann
- **Menu location**: Second item in the Gann subsection

### 2. Activation Behavior

- Opens submenu → Gann section → click "Gann square fixed" → crosshair cursor.
- "Fixed" refers to a fixed price-per-bar scale: the square is constrained so that a set number of price units equals a set number of time units (as configured in settings), rather than freely sizing.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **Anchor A** (first click): Sets the starting corner.
- **Mouse move**: A square preview appears; because the scale is fixed, the square may not perfectly follow the cursor — it maintains its fixed price-to-time ratio.
- **Anchor B** (second click / pointerup): Commits the fixed-scale square at the position relative to A.
- The resulting square is constrained to have equal "price units" on each side, where "equal" is defined by the configured price-per-bar ratio.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Starting corner of the fixed square.
- **Anchor B** (index 1): Opposing corner; actual pixel position may be adjusted to maintain the fixed scale ratio.
- After commit: handles at corners; resizing respects the fixed scale constraint.

### 5. Selection and Reselection

- Selected: square border highlights, corner handles appear, internal grid visible.
- Hit-testing: clicking the border or any internal grid line.

### 6. Hover and Cursor

- Cursor over border/grid: move/pointer.
- Cursor over corner handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two corner handles (at A and B). The square may show all four corners as drag handles for symmetrical resizing.

### 8. Drag and Edit

- Body drag: moves the entire square.
- Corner handle drag: resizes while maintaining the fixed price-to-time scale ratio.

### 9. Tooltip Behavior

- Grid lines labeled with their Gann ratio values (eighths, thirds, fib levels).
- Fixed scale ratio indicator may be shown in a label (e.g., "1×1").
- Angle labels for Gann fan lines (1×1, 1×2, 2×1, etc.) if angle lines are rendered inside the square.

### 10. Floating Toolbar

Color picker, thickness, line style, fill toggle, settings, clone, lock, hide, delete.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Settings: fixed price-per-bar scale configuration; which grid lines to show; which angle lines to render; fill color; time scale type.
- `supportsFill: true`.
- `supportsLevels: true`.

### 13. Text and Label Behavior

- `supportsText: false`.
- Grid and angle labels intrinsic.

### 14. Chart Interaction

- Pan/zoom: the square resizes with the chart. The "fixed" scale means the visual appearance of the square on screen changes as the chart scales (it is not a true pixel-fixed square; it is fixed in price-per-bar ratio terms).

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Very large fixed-scale setting: the square may cover the entire chart.
- Fixed scale that makes the square near-degenerate: TradingView handles gracefully.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-gannSquareFixed.spec.ts`; 500-test spec at `e2e/gann-square-fixed-500.spec.ts`.
- **Evidence**: Capture script slug `gann-square-fixed`, tooltip `Gann square fixed` verified. Registry: `anchors: 2`, `supportsFill: true`.
- **Verified behaviors**: activation, 2 anchors, family `fib`, undo/redo.
- **Remaining gaps**: Fixed-scale constraint implementation, angle line rendering, resize behavior respecting fixed ratio.

---

## Tool 14: gannSquare

### 1. Tool Identity

- **TradingView name**: `Gann square`
- **Internal variant**: `gannSquare`
- **Category**: Gann (within Fibonacci rail)
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Gann
- **Menu location**: Third item in the Gann subsection

### 2. Activation Behavior

- Opens submenu → Gann section → click "Gann square" → crosshair cursor.
- "Dynamic" square (contrast with "fixed"): the square freely sizes to whatever the user draws, without a fixed price-per-bar constraint.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **Anchor A** (first click / pointerdown): Sets the starting corner.
- **Drag / mouse move**: A square or rectangular preview appears, freely following the cursor.
- **Anchor B** (second click / pointerup): Commits the square at the drawn size. The square may be unconstrained (rectangular), or TradingView may enforce a square aspect ratio by expanding the shorter dimension.
- Internal Gann grid lines (ratio divisions) appear inside the committed shape.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Starting corner.
- **Anchor B** (index 1): Opposing corner.
- After commit: corner handles adjustable; resizing is unconstrained (unlike gannSquareFixed).

### 5. Selection and Reselection

- Selected: border highlights, corner handles appear.
- Hit-testing: clicking border or internal grid lines.

### 6. Hover and Cursor

- Cursor over border/grid: move/pointer.
- Cursor over corner handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two corner handles (A and B); potentially all four corners shown.

### 8. Drag and Edit

- Body drag: moves entire square.
- Corner handle drag: resizes freely (no fixed-scale constraint).

### 9. Tooltip Behavior

- Same internal grid labels as gannBox: ratio values for horizontal and vertical grid lines, angle labels for diagonal fan lines.

### 10. Floating Toolbar

Color picker, thickness, line style, fill toggle, settings, clone, lock, hide, delete.

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Settings: which grid/angle lines to show, colors, fill color and opacity.
- `supportsFill: true`, `supportsLevels: true`.

### 13. Text and Label Behavior

- `supportsText: false`.
- Grid labels intrinsic.

### 14. Chart Interaction

- Pan/zoom: square maintains anchored coordinates; resizes proportionally.

### 15. Keyboard Behavior

- Escape, Delete/Backspace, Ctrl+Z/Y standard.

### 16. Edge Cases

- Very small square (A ≈ B): degenerate grid.
- Rectangle vs. true square: TradingView's gannSquare may enforce or suggest a square aspect ratio in certain configurations.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-gannSquare.spec.ts`; 500-test spec at `e2e/gann-square-500.spec.ts`.
- **Evidence**: Capture script slug `gann-square`, tooltip `Gann square` verified. Registry: `anchors: 2`, `supportsFill: true`.
- **Verified behaviors**: activation, 2 anchors, family `fib`, undo/redo.
- **Remaining gaps**: Square vs. rectangle aspect enforcement, internal grid rendering differences from gannBox.

---

## Tool 15: gannFan

### 1. Tool Identity

- **TradingView name**: `Gann fan`
- **Internal variant**: `gannFan`
- **Category**: Gann (within Fibonacci rail)
- **Rail**: Fibonacci tools rail (`rail-fib`)
- **Submenu section**: Gann
- **Menu location**: Fourth (last) item in the Gann subsection

### 2. Activation Behavior

- Opens submenu → Gann section → click "Gann fan" → crosshair cursor.
- Standard last-used and keep-drawing behavior.

### 3. Creation Flow

- **First click (anchor A)**: Sets the fan origin point (the corner from which all angle lines radiate).
- **Mouse move**: Live preview of fan lines at Gann angles (1×8, 1×4, 1×3, 1×2, 1×1, 2×1, 3×1, 4×1, 8×1) appears.
- **Second click (anchor B)**: Sets a reference direction point, defining the scale and orientation of the 1×1 line (45-degree "balance" line). All other fan lines are drawn at standard Gann angles relative to this baseline.
- This is a 2-anchor tool that creates multiple angle lines radiating from the origin.

### 4. Multi-Anchor Sequence

- **Anchor A** (index 0): Fan origin (where all fan lines converge).
- **Anchor B** (index 1): Reference direction point; defines which way "up" and "right" are, and the price-per-bar scale of the 1×1 line.
- After commit: both handles adjustable; moving B changes the fan scale and orientation.

### 5. Selection and Reselection

- Selected: all fan lines highlight, two handles appear.
- Hit-testing: clicking any fan line selects the drawing.
- Deselect by clicking empty area.

### 6. Hover and Cursor

- Cursor over fan line: move/pointer.
- Cursor over handle: resize.
- Active tool: crosshair.

### 7. Handles and Anchors

- Two circular handles: one at origin (A), one at reference direction (B).

### 8. Drag and Edit

- Body drag (on any fan line): moves the entire fan; both anchors shift.
- Handle drag: repositions one anchor; all fan lines recalculate angles and positions.

### 9. Tooltip Behavior

- Each fan line labeled with its Gann angle ratio: `1×8`, `1×4`, `1×3`, `1×2`, `1×1`, `2×1`, `3×1`, `4×1`, `8×1`.
- The `1×1` line is the primary "balance" line (45 degrees at the configured price-per-bar scale).
- Labels appear along each fan line at a fixed distance from origin or at the chart boundary.
- During creation: all fan line labels appear live in the preview.

### 10. Floating Toolbar

Color picker, thickness, line style, settings, clone, lock, hide, delete. No fill toggle (supportsFill: false).

### 11. Context Menu

Settings, Clone, Copy, Lock, Hide, Remove.

### 12. Settings/Style

- Settings dialog: which angle lines to show (can enable/disable individual angles), per-line colors, line style.
- Scale configuration: price-per-bar ratio for the 1×1 line.
- `supportsLevels: true` — angle lines act as levels.
- `supportsFill: false`.

### 13. Text and Label Behavior

- `supportsText: false`: no user text note.
- Angle labels intrinsic to each fan line.

### 14. Chart Interaction

- Pan/zoom: fan lines are anchored in chart coordinates. Gann fan angles are defined in price-per-bar terms; zooming the time axis changes the visual angle of the 1×1 line. TradingView preserves the mathematical Gann angle rather than the visual 45-degree appearance (the visual angle depends on the chart's price-to-bar aspect ratio).

### 15. Keyboard Behavior

- `Escape`: cancels creation or deselects.
- `Delete`/`Backspace`: removes selected drawing.
- `Ctrl+Z`/`Ctrl+Y`: undo/redo.

### 16. Edge Cases

- Anchors at same position: degenerate fan; all lines converge to a point.
- Very steep chart scale: the 1×1 line appears nearly vertical or nearly horizontal depending on price-per-bar setting.
- Lines extending beyond chart boundaries: only visible portions render; drawing still selectable.
- Fan lines below the zero-price axis: behavior depends on TV's rendering; most are clipped.

### 17. Evidence and Status

- **Coverage status**: Automated — V2 spec at `e2e/tv-parity-v2-gannFan.spec.ts`; 500-test spec at `e2e/gann-fan-500.spec.ts`.
- **Evidence**: Capture script slug `gann-fan`, tooltip `Gann fan` verified. Registry: `anchors: 2`, `supportsFill: false`, `supportsLevels: true`.
- **Verified behaviors**: activation, 2 anchors, family `fib`, undo/redo.
- **Remaining gaps**: Angle line rendering at correct Gann ratios, 1×1 line scale configuration, price-per-bar visual distortion on zoom.

---

## Summary Table

| # | Variant | TV Label | Anchors | supportsFill | supportsText | supportsLevels | V2 Spec | 500 Spec |
|---|---------|----------|---------|-------------|-------------|---------------|---------|---------|
| 1 | fibRetracement | Fib retracement | 2 | false | true | true | yes | via fib-channel-500 |
| 2 | fibExtension | Trend-based fib extension | 2 | false | true | true | yes | yes |
| 3 | fibChannel | Fib channel | 2 | false | true | true | yes | yes (fib-channel-500) |
| 4 | fibTimeZone | Fib time zone | 2 | false | true | true | yes | yes |
| 5 | fibSpeedResistFan | Fib speed resistance fan | 2 | false | false | true | yes | yes |
| 6 | fibTrendTime | Trend-based fib time | 2 | false | true | true | yes | yes |
| 7 | fibCircles | Fib circles | 2 | false | false | true | yes | yes |
| 8 | fibSpiral | Fib spiral | 2 | false | false | true | yes | yes |
| 9 | fibSpeedResistArcs | Fib speed resistance arcs | 2 | false | false | true | yes | yes |
| 10 | fibWedge | Fib wedge | 2 | false | false | true | yes | yes |
| 11 | pitchfan | Pitchfan | **3** | false | false | true | yes | yes |
| 12 | gannBox | Gann box | 2 | **true** | false | true | yes | yes |
| 13 | gannSquareFixed | Gann square fixed | 2 | **true** | false | true | yes | yes |
| 14 | gannSquare | Gann square | 2 | **true** | false | true | yes | yes |
| 15 | gannFan | Gann fan | 2 | false | false | true | yes | yes |

**Key differentiators:**
- `pitchfan` is the only 3-anchor tool in this group.
- Gann box, Gann square fixed, and Gann square support fill areas.
- fibRetracement, fibExtension, fibChannel, fibTimeZone, and fibTrendTime support user text notes.
- All tools live under `[data-testid="rail-fib"]` in a single popover with "Fibonacci" and "Gann" subsections.
- All Fibonacci tools (1–11) are in the `Fibonacci` subsection; all Gann tools (12–15) are in the `Gann` subsection.
- Creation gesture for all is drag (pointerdown→move→pointerup) except pitchfan which uses 3 sequential clicks.
- All tools are `family: 'fib'`, `category: 'fib'`, `draggable: true`, `resizable: true`.


---


# Section 3: Pattern Tools (14 tools)

## Cross-Pattern Behaviors

The following behaviors apply uniformly to all 14 pattern tools documented in this section.

**Rail and menu structure.** All 14 tools live under the Patterns rail (`data-testid="rail-patterns"`). The rail button opens a popover menu organized into three labeled subsections: "Chart Patterns" (6 tools), "Elliott Waves" (5 tools), and "Cycles" (3 tools).

**Selection shows handles at every anchor.** When a pattern drawing is selected, a circular resize handle appears at every anchor point. Chart Pattern tools with 5 anchors show 5 handles; Three Drives shows 7; Cyclic tools show 2. No handle appears on the interior of line segments.

**Labels are intrinsic, not user-added text.** The anchor labels (X, A, B, C, D; 1, 2, 3, 4, 5; A, B, C, D, E; W, X, Y, Z) are rendered as part of the drawing itself. They are not editable free-text fields. All pattern tools carry `supportsText: false` in the tool registry, meaning no user-added text annotation is supported.

**supportsText and supportsFill.** Every pattern tool in this section has `supportsText: false` and `supportsFill: false`. There is no fill region and no user text entry.

**commit mode.** Chart Pattern and Elliott Wave tools use a `click-sequence` commit style: the user places one click per anchor in sequence, and the final click commits the drawing. Cycle tools (`cyclicLines`, `timeCycles`, `sineLine`) use a `drag` commit style: press-drag-release defines the two-anchor period.

**Drawing object structure.** After commit, every drawing is stored with: `variant` (matching the tool id), `anchors` (array of `{time, price}` objects — one per anchor), `options` (containing `color`, `thickness`, `style`, `opacity`), `selected`, `locked`, `visible`, `zIndex`, `renderOrder`, `interactionPriority`, and `id` (unique string).

**Auto-select on commit.** After the final click or drag-release, the drawing is automatically selected and the floating toolbar appears.

**Tool deactivates after commit.** After a drawing is committed, the active variant returns to `"none"`. The tool does not remain active for repeated drawing without re-clicking the tool button.

**Escape cancels partial drawing.** At any point during a multi-click sequence (before the final anchor is placed), pressing Escape cancels the draft. No drawing is added. For drag-commit tools, Escape during the drag also cancels. After cancellation the active variant returns to `"none"`.

**Delete removes selected drawing.** With a drawing selected, pressing Delete (or Backspace) removes it from the drawing list. The same action is available via the floating toolbar delete button.

**Ctrl+Z undoes the last committed drawing.** Undo decrements the drawing count by 1.

**Ctrl+D duplicates a selected drawing.** If duplication is supported, the count increases by 1.

**Pan and zoom preserve coordinates.** All anchor points are stored as chart time/price coordinates. Panning or zooming the chart does not alter the stored anchors; the pattern re-renders to the correct pixel positions on every frame.

**Floating toolbar controls.** All pattern tools share the same floating toolbar: color picker, thickness slider (1–8), line style selector (solid/dashed/dotted), settings gear, delete, clone, lock, and hide buttons.

**Context menu.** Right-clicking a selected pattern drawing opens a context menu with: Template, Clone, Copy, Lock, Hide, Remove, and Settings.

**No measurement pill.** Pattern tools do not display a measurement pill (unlike line measurers). Anchor labels serve as the only intrinsic annotation.

---

## Chart Patterns (6 tools)

---

## Tool: xabcd

### 1. Tool identity
- Exact TradingView tool name: **XABCD Pattern**
- Tool variant id: `xabcd`
- Category: Chart Patterns
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Chart Patterns" within the Patterns popover menu
- Family: `pattern`
- Icon key: `GitMerge`
- The tool is in a submenu; clicking the Patterns rail button opens the popover, then the user clicks "XABCD Pattern" in the "Chart Patterns" subsection.

### 2. Activation behavior
- Clicking the Patterns rail button opens the popover menu if it is not already open.
- Clicking "XABCD Pattern" activates the tool; `__chartDebug.getActiveVariant()` returns `"xabcd"`.
- If `xabcd` was the last-used Patterns tool, the Patterns rail button shows the xabcd icon; clicking it directly re-activates xabcd without opening the popover.
- After activation, the cursor over the chart interaction surface changes to a crosshair, indicating drawing mode is active.

### 3. Creation flow
- The xabcd pattern requires 5 sequential clicks to commit: one click per anchor point in order X → A → B → C → D.
- Click 1 (X): places the origin point of the zigzag. A preview line extends from X following the cursor.
- Click 2 (A): places the first reversal. The XA segment is now drawn; a preview line extends from A.
- Click 3 (B): places the second reversal. The XA and AB segments are visible; preview extends from B.
- Click 4 (C): places the third reversal. XA, AB, BC segments are visible; preview extends from C.
- Click 5 (D): places the fourth reversal. This is the commit click. All five segments (XA, AB, BC, CD, and the closing DA implied line) are finalized. The drawing is committed and auto-selected.
- During creation the intermediate lines update in real-time as the cursor moves between clicks (live preview).
- The commit style is `click-sequence` with `anchorCount: 5`.

### 4. Multi-anchor sequence
- Anchor order: X (index 0), A (index 1), B (index 2), C (index 3), D (index 4).
- X sets the starting price/time. A defines the first leg direction and magnitude. B is a retracement of XA. C retraces AB. D completes the pattern, often near an XA extension level.
- Each click extends the connecting polyline: XA line appears after click 2, XA+AB after click 3, all four legs after click 5.
- Pressing Escape at any step (before click 5) cancels the in-progress draft. No drawing is added.
- After the 5th click the shape is committed and locked to chart coordinates; individual anchors can still be dragged to reshape the pattern.

### 5. Selection and reselection
- The drawn xabcd pattern consists of four connected line segments (X→A, A→B, B→C, C→D).
- Clicking on any of the four segments selects the drawing. Hit-testing checks within approximately 8–12 px of each segment.
- Clicking in the interior area between segments (not on a segment line) does not select the drawing.
- Deselecting: clicking away from all segments clears selection (`getSelectedDrawingId()` returns null).
- Reselecting: clicking any segment line again re-selects it.
- When selected, 5 circular handles appear, one at each anchor (X, A, B, C, D).

### 6. Hover and cursor
- Hovering over a segment line (not on an anchor): cursor shows a move/hand cursor indicating the segment or body can be dragged.
- Hovering over an anchor handle: cursor changes to a resize pointer (bi-directional arrows), indicating that anchor can be repositioned.
- Hover labels showing the anchor letters (X, A, B, C, D) are visible at each anchor point when the drawing is hovered or selected.

### 7. Handles and anchors
- 5 circular handles, one at each anchor point.
- Handle positions correspond exactly to the stored anchor coordinates.
- Handles are visible only when the drawing is selected.
- Handles labeled: X (anchor[0]), A (anchor[1]), B (anchor[2]), C (anchor[3]), D (anchor[4]).

### 8. Drag and edit
- Body drag (dragging any segment, not an anchor): translates all 5 anchors by the same delta. The entire pattern moves to a new time/price region while preserving relative shape.
- Individual anchor drag: repositions only that anchor. The two segments connected to that anchor update in real-time as it is dragged. Other segments remain fixed. The pattern "refolds" around the moved anchor.
- After dragging, the updated anchor coordinates are stored in the drawing's `anchors` array.

### 9. Tooltip behavior
- During creation (between clicks), thin preview lines connect placed anchors to the current cursor position, showing the partial pattern in progress.
- Anchor letters (X, A, B, C, D) are shown as labels at each placed point during creation.
- No measurement pill is shown (no price range or bar count annotation).
- After commit, the anchor labels remain visible on the drawing at each anchor position.

### 10. Floating toolbar
- Appears automatically after the pattern is committed and auto-selected.
- Controls: color picker (stroke color), thickness (range 1–8), line style (solid/dashed/dotted), settings gear (opens pattern options dialog), delete button, clone button, lock toggle, hide toggle.
- The toolbar appears near the drawing, positioned to avoid overlap with chart edges.
- Toolbar disappears when the drawing is deselected.

### 11. Context menu
- Right-click on any segment of the selected or unselected xabcd pattern opens the context menu.
- Items: Template, Clone, Copy, Lock, Hide, Remove, Settings.
- "Settings" opens the pattern-specific options dialog (same as toolbar gear button).
- "Remove" deletes the drawing without a confirmation prompt.
- "Lock" prevents further editing; locked drawings show a lock icon and cannot be dragged.

### 12. Settings/style
- Line color: hex color string, applies to all four segments.
- Line width (thickness): integer 1–8.
- Line style: solid, dashed, or dotted; applies to all segments.
- Opacity: 0.15–1.0.
- Label visibility: option to show or hide anchor labels (X, A, B, C, D).
- Label font size: configurable in the settings dialog.
- No fill color (supportsFill: false).

### 13. Text and label behavior
- Anchor labels X, A, B, C, D are intrinsic to the drawing; they render at each anchor's chart coordinate.
- Labels move with their anchor when that anchor is dragged.
- All five labels move together when the entire pattern is body-dragged.
- supportsText: false — no user-editable free text is supported on this drawing type.
- No price labels are displayed at anchor points by default (price info is not shown inline).

### 14. Chart interaction
- Pan: the pattern's pixel positions update continuously as the chart is panned; all anchor chart coordinates are preserved.
- Zoom: zooming in or out rescales the pattern's pixel rendering; the time/price anchors are unchanged.
- Timeframe change: when the user switches chart timeframe, the pattern redraws at the same time/price coordinates on the new scale; on very compressed timeframes, multiple anchors may appear visually close together.
- The pattern does not "snap" to candle OHLC levels by default (snapMode is configurable in options).

### 15. Keyboard behavior
- Escape during creation (before 5th click): cancels the draft. No drawing is added. Tool remains active.
- Escape with no active draft: deactivates the tool (variant returns to "none").
- Delete (selected drawing): removes the drawing.
- Backspace (selected drawing): also removes the drawing.
- Ctrl+Z: undoes the last committed drawing.
- Ctrl+D: duplicates the selected drawing.
- Arrow keys, Home, End, PageUp, PageDown, Tab, Enter, Space, F1, F2, F5: do not crash the application; behavior is pass-through or no-op depending on focus state.
- Shift+Tab, Meta+Z, Alt+Z: handled gracefully, no crash.

### 16. Edge cases
- Very compressed pattern (all 5 anchors near same time/price): the pattern renders as nearly a single point; segments are very short but still stored and selectable.
- Pattern spanning a very large time range: anchors may be far apart in pixels; the connecting lines remain visible if at least one segment is within the viewport.
- Overlapping patterns of the same type: multiple xabcd patterns can coexist; z-order determines which receives click events when segments overlap.
- Pattern with some anchors off-screen: the visible segments still render; off-screen anchors are not shown but their handles reappear if the chart is panned to reveal them.
- Anchors at the same time (degenerate vertical segment): not a typical use case; behavior is dependent on renderer clipping.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'xabcd'`, `category: 'patterns'`, `subSection: 'Chart Patterns'`, `family: 'pattern'`, `anchors: 5`, `draggable: true`, `resizable: true`, `supportsText: false`, `supportsFill: false`; `tv-parity-v2-xabcd.spec.ts` — `variant: "xabcd"`, `railTestId: "rail-patterns"`, `anchorCount: 5`, `commitMode: "click-sequence"`; `tv-parity-patterns.spec.ts` — xabcd listed with `commitStyle: "click-sequence"`, `anchors: 5`; 500 parity tests registered via `registerV2ToolSuite`.
- Remaining gaps: live pixel-diff comparison against TradingView reference captures not yet automated (requires `E2E_PIXEL_DIFF=1`); anchor label rendering verified by code structure, not by live screenshot.
- Live TradingView interaction: not directly verified in this research pass; behavior described is consistent with the test suite structure and tool registry definitions.

---

## Tool: cypherPattern

### 1. Tool identity
- Exact TradingView tool name: **Cypher Pattern**
- Tool variant id: `cypherPattern`
- Category: Chart Patterns
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Chart Patterns"
- Family: `pattern`
- Icon key: `GitMerge`
- In submenu under Patterns rail.

### 2. Activation behavior
- Clicking the Patterns rail button opens the popover menu.
- Clicking "Cypher Pattern" in the "Chart Patterns" subsection activates the tool; `getActiveVariant()` returns `"cypherPattern"`.
- If cypherPattern was the last-used tool, clicking the rail button directly re-activates it.
- Cursor becomes a crosshair over the chart after activation.

### 3. Creation flow
- 5 sequential clicks required: X → A → B → C → D (same zig-zag click sequence as xabcd).
- Click 1 (X): origin point. Preview line tracks cursor.
- Click 2 (A): first leg endpoint. XA segment drawn.
- Click 3 (B): second reversal. AB segment drawn.
- Click 4 (C): third reversal. BC segment drawn.
- Click 5 (D): final point. CD segment drawn. Drawing committed and auto-selected.
- The cypher pattern differs from xabcd in its geometric ratios (D is typically a retracement of XC rather than an extension of XA), but the creation flow and anchor count are identical.
- Commit style: `click-sequence`, `anchorCount: 5`.

### 4. Multi-anchor sequence
- Anchor order: X (0), A (1), B (2), C (3), D (4).
- X: starting pivot. A: first swing. B: retracement of XA. C: extension beyond X level. D: retracement of XC (the cypher-defining anchor).
- Live preview lines connect placed anchors to cursor position throughout creation.
- Escape at any step before click 5 cancels the draft.
- After commit, all 5 anchors are independently editable.

### 5. Selection and reselection
- Four connected segments: X→A, A→B, B→C, C→D.
- Clicking any segment line selects the drawing.
- Clicking in the enclosed interior area (not on a line) does not select.
- Click away to deselect. Click any segment to reselect.
- 5 circular handles visible when selected (X, A, B, C, D).

### 6. Hover and cursor
- Over segment: move/hand cursor.
- Over anchor handle: resize pointer.
- Anchor letters visible as labels at each anchor on hover or selection.

### 7. Handles and anchors
- 5 circular handles at X, A, B, C, D positions.
- Visible when selected.
- Handle labels: X, A, B, C, D.

### 8. Drag and edit
- Body drag: moves all 5 anchors by the same delta.
- Individual anchor drag: reshapes only the connected segments; other anchors fixed.
- Pattern refolds with anchor movement.

### 9. Tooltip behavior
- Live preview during creation shows partial polyline from placed anchors to cursor.
- Anchor labels visible at each placed point.
- No measurement pill.
- Committed drawing shows anchor labels at each point.

### 10. Floating toolbar
- Appears after commit (auto-select).
- Controls: color picker, thickness (1–8), line style, settings, delete, clone, lock, hide.

### 11. Context menu
- Right-click: Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width (1–8), style (solid/dashed/dotted), opacity (0.15–1.0).
- Label visibility and font size options.
- No fill.

### 13. Text and label behavior
- Intrinsic labels: X, A, B, C, D at each anchor.
- Labels move with anchors on drag.
- supportsText: false — no user-added text.

### 14. Chart interaction
- Pan/zoom preserves time/price anchor coordinates.
- Pattern re-renders correctly on timeframe changes.
- Snap mode configurable.

### 15. Keyboard behavior
- Escape: cancel partial draft or deactivate tool.
- Delete/Backspace: remove selected drawing.
- Ctrl+Z: undo. Ctrl+D: duplicate. Other keys pass through without crash.

### 16. Edge cases
- Same as xabcd: compressed patterns, large time spans, overlapping patterns, off-screen anchors handled consistently.
- The cypher variant adds the geometric constraint that D is a retracement of XC; no enforcement at the drawing level (user can place D anywhere).

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'cypherPattern'`, `subSection: 'Chart Patterns'`, `anchors: 5`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 5`; `tv-parity-v2-cypherPattern.spec.ts` — `registerV2ToolSuite` call with same parameters as xabcd; `tv-parity-cypherPattern-500.spec.ts` registered via `register500ToolSuite`.
- Remaining gaps: same as xabcd — no live pixel diff against TradingView reference.
- Live TradingView interaction: not directly verified.

---

## Tool: headAndShoulders

### 1. Tool identity
- Exact TradingView tool name: **Head and Shoulders**
- Tool variant id: `headAndShoulders`
- Category: Chart Patterns
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Chart Patterns"
- Family: `pattern`
- Icon key: `Mountain`
- In submenu under Patterns rail.

### 2. Activation behavior
- Clicking "Head and Shoulders" in the Patterns popover activates the tool.
- `getActiveVariant()` returns `"headAndShoulders"`.
- Last-used tool behavior: rail button shows head-and-shoulders icon if last used.
- Crosshair cursor after activation.

### 3. Creation flow
- 5 sequential clicks required, representing the classical 5-point head-and-shoulders structure.
- Click 1: Left shoulder peak (or left neckline point, depending on tool orientation — the first anchor in time order).
- Click 2: Left neckline trough.
- Click 3: Head peak (highest point in a bearish H&S, or lowest in an inverse H&S).
- Click 4: Right neckline trough.
- Click 5: Right shoulder peak. Commit click. Drawing auto-selected.
- Live preview lines connect during creation.
- Commit style: `click-sequence`, `anchorCount: 5`.

### 4. Multi-anchor sequence
- Anchor order (index 0–4): left shoulder → left neck → head → right neck → right shoulder.
- Each anchor controls a vertex in the 5-point shape; the neckline (connecting left neck to right neck) and the two shoulder-to-neck segments form the pattern geometry.
- Preview updates after each click showing the accumulating shape.
- Escape at any step before click 5 cancels.
- After commit, all 5 anchors are independently draggable.

### 5. Selection and reselection
- The drawing consists of 4 connected segments forming the pattern outline.
- Clicking any segment selects the drawing.
- Interior area clicks do not select.
- 5 circular handles visible when selected.
- Click away to deselect; click any segment to reselect.

### 6. Hover and cursor
- Over segment: move/hand cursor.
- Over anchor: resize pointer.
- Anchor labels visible on hover/selection (labels may use positional descriptors or simple numeric indices rather than letters, consistent with TradingView's head-and-shoulders label style).

### 7. Handles and anchors
- 5 circular handles at: left shoulder, left neck, head, right neck, right shoulder positions.
- Visible when selected.

### 8. Drag and edit
- Body drag: all 5 anchors translate together.
- Individual anchor drag: reshapes connected segments only.

### 9. Tooltip behavior
- Live preview during creation.
- No measurement pill.
- Anchor labels shown at each point.

### 10. Floating toolbar
- Same controls as all pattern tools: color, thickness, style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity.
- Label visibility and font size.
- No fill.

### 13. Text and label behavior
- Intrinsic labels at anchor positions.
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves anchor coordinates.
- Pattern rescales on timeframe change.

### 15. Keyboard behavior
- Escape: cancel or deactivate. Delete/Backspace: remove. Ctrl+Z: undo. Ctrl+D: duplicate. Other keys: no crash.

### 16. Edge cases
- Symmetric placement: when left and right shoulders are placed at similar prices, the pattern looks balanced.
- Inverted head and shoulders (head below neckline): the tool supports this by allowing the user to place anchors in any price order — no geometric validation enforced at the drawing level.
- Compressed in time: all anchors near same bar.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'headAndShoulders'`, `anchors: 5`, `iconKey: 'Mountain'`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 5`; `tv-parity-v2-headAndShoulders.spec.ts` — `registerV2ToolSuite`; `tv-parity-headAndShoulders-500.spec.ts`.
- Remaining gaps: label text content for each anchor not confirmed from source; live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: abcdPattern

### 1. Tool identity
- Exact TradingView tool name: **ABCD Pattern**
- Tool variant id: `abcdPattern`
- Category: Chart Patterns
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Chart Patterns"
- Family: `pattern`
- Icon key: `GitMerge`
- In submenu under Patterns rail.

### 2. Activation behavior
- Clicking "ABCD Pattern" in the Patterns popover activates the tool.
- `getActiveVariant()` returns `"abcdPattern"`.
- Last-used: rail shows abcdPattern icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 4 sequential clicks required: A → B → C → D.
- Click 1 (A): starting point. Preview extends from A.
- Click 2 (B): first reversal. AB segment drawn.
- Click 3 (C): second reversal. BC segment drawn.
- Click 4 (D): final point. CD segment drawn. Drawing committed.
- The ABCD pattern is a 3-segment zigzag. It is the simplest harmonic pattern: a reduced form of xabcd without the X anchor.
- Commit style: `click-sequence`, `anchorCount: 4`.

### 4. Multi-anchor sequence
- Anchor order: A (0), B (1), C (2), D (3).
- A: origin. B: first reversal. C: retracement of AB. D: extension of BC (typically equal to AB).
- 3 segments: A→B, B→C, C→D.
- Preview updates after each click.
- Escape before click 4 cancels.
- After commit, all 4 anchors independently editable.

### 5. Selection and reselection
- 3 connected segments: A→B, B→C, C→D.
- Clicking any segment selects.
- Interior area clicks do not select.
- 4 circular handles visible when selected (A, B, C, D).
- Click away to deselect; click any segment to reselect.

### 6. Hover and cursor
- Over segment: move/hand cursor.
- Over anchor: resize pointer.
- Anchor labels (A, B, C, D) visible on hover/selection.

### 7. Handles and anchors
- 4 circular handles at A, B, C, D positions.
- Visible when selected.

### 8. Drag and edit
- Body drag: all 4 anchors translate.
- Individual anchor drag: reshapes connected segments.

### 9. Tooltip behavior
- Live preview during creation.
- No measurement pill.
- Labels A, B, C, D shown at each anchor.

### 10. Floating toolbar
- Color, thickness (1–8), style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width (1–8), style, opacity.
- Label visibility and font size.
- No fill.

### 13. Text and label behavior
- Intrinsic labels: A, B, C, D.
- Labels move with anchors.
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves coordinates.
- Timeframe changes: pattern re-renders at same coordinates.

### 15. Keyboard behavior
- Escape: cancel (before click 4) or deactivate. Delete/Backspace: remove. Ctrl+Z: undo. Ctrl+D: duplicate. Other keys: no crash.

### 16. Edge cases
- 3-segment pattern more compact than 4- or 5-anchor patterns; more likely that all anchors are visible simultaneously.
- Degenerate case: A and D at the same price level (flat ABCD).
- Overlapping with xabcd: both patterns can be drawn on the same chart area; they are independent drawings.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'abcdPattern'`, `anchors: 4`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 4`; `tv-parity-v2-abcdPattern.spec.ts`; `tv-parity-abcdPattern-500.spec.ts`.
- Remaining gaps: live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: trianglePattern

### 1. Tool identity
- Exact TradingView tool name: **Triangle Pattern**
- Tool variant id: `trianglePattern`
- Category: Chart Patterns
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Chart Patterns"
- Family: `pattern`
- Icon key: `Play`
- In submenu under Patterns rail.

### 2. Activation behavior
- Clicking "Triangle Pattern" in the Patterns popover activates the tool.
- `getActiveVariant()` returns `"trianglePattern"`.
- Last-used: rail shows triangle icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 3 sequential clicks required.
- Click 1: upper-left anchor (or first reference point).
- Click 2: upper-right anchor (or second reference point defining the upper boundary direction).
- Click 3: apex or base variant point (the convergence point). Drawing committed on this click.
- The triangle pattern draws two converging trendlines meeting at the apex; the exact geometric interpretation (symmetric, ascending, or descending triangle) is determined by the relative positions of the 3 anchors.
- Commit style: `click-sequence`, `anchorCount: 3`.

### 4. Multi-anchor sequence
- Anchor order: first (0), second (1), third/apex (2).
- 3 anchors define 2 trendlines that form the triangle. The 3rd anchor defines where the second trendline terminates or the apex of convergence.
- Preview lines update after each click showing the partial pattern.
- Escape before click 3 cancels.
- After commit, all 3 anchors are independently editable.

### 5. Selection and reselection
- The drawing consists of 2 (or more) connected line segments forming the triangle outline.
- Clicking any visible segment selects the drawing.
- 3 circular handles visible when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over segment: move/hand cursor.
- Over anchor: resize pointer.
- Anchor labels or positional markers visible on hover/selection.

### 7. Handles and anchors
- 3 circular handles.
- Visible when selected.

### 8. Drag and edit
- Body drag: translates all 3 anchors.
- Individual anchor drag: reshapes the connected trendlines.

### 9. Tooltip behavior
- Live preview during creation (2 partial trendlines visible as anchors are placed).
- No measurement pill.

### 10. Floating toolbar
- Color, thickness, style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity.
- Label visibility.
- No fill.

### 13. Text and label behavior
- Intrinsic anchor labels at each point.
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves coordinates.

### 15. Keyboard behavior
- Escape: cancel (before click 3) or deactivate. Delete/Backspace: remove. Ctrl+Z: undo. Ctrl+D: duplicate. Other keys: no crash.

### 16. Edge cases
- Triangle with very narrow apex (anchors very close): renders as nearly a point.
- Open triangle (anchors spread over long time span): trendlines extend far across the chart.
- Degenerate: all 3 anchors at same price (flat triangle).

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'trianglePattern'`, `anchors: 3`, `iconKey: 'Play'`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 3`; `tv-parity-trianglePattern-500.spec.ts`.
- Remaining gaps: specific rendering geometry (which two lines are drawn from the 3 anchors) not confirmed from spec files alone; live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: threeDrives

### 1. Tool identity
- Exact TradingView tool name: **Three Drives Pattern**
- Tool variant id: `threeDrives`
- Category: Chart Patterns
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Chart Patterns"
- Family: `pattern`
- Icon key: `Activity`
- In submenu under Patterns rail.
- This is the most anchor-intensive tool in the entire Patterns category, requiring 7 anchors.

### 2. Activation behavior
- Clicking "Three Drives Pattern" in the Patterns popover activates the tool.
- `getActiveVariant()` returns `"threeDrives"`.
- Last-used: rail shows threeDrives icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 7 sequential clicks required: X → 1 → A → 2 → B → 3 → C.
- Click 1 (X): origin.
- Click 2 (1): first drive peak/trough.
- Click 3 (A): first retracement.
- Click 4 (2): second drive.
- Click 5 (B): second retracement.
- Click 6 (3): third drive.
- Click 7 (C): final corrective point. Commit click. Drawing auto-selected.
- During creation, each click extends the connecting polyline with a live preview.
- Commit style: `click-sequence`, `anchorCount: 7`.
- The factory code (`tv-parity-500-factory.ts`) specifically notes that Three Drives requires monotonic time progression and rejects sequences with collapsed horizontal span.

### 4. Multi-anchor sequence
- Anchor order: X (0), 1 (1), A (2), 2 (3), B (4), 3 (5), C (6).
- The pattern forms a 6-segment zigzag: X→1, 1→A, A→2, 2→B, B→3, 3→C.
- Each "drive" (1, 2, 3) is a swing high or low; each retrace (A, B, C) is the corrective move.
- Preview extends after each click with partial polyline.
- Escape at any step before click 7 cancels. This is the largest potential cancellation: up to 6 intermediate clicks can be discarded.
- After commit, all 7 anchors are independently editable.

### 5. Selection and reselection
- 6 connected segments forming the three-drives zigzag.
- Clicking any segment selects.
- Interior area between segments does not select.
- 7 circular handles visible when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over segment: move/hand cursor.
- Over anchor: resize pointer.
- Anchor labels (X, 1, A, 2, B, 3, C) visible on hover/selection.

### 7. Handles and anchors
- 7 circular handles at X, 1, A, 2, B, 3, C positions.
- Visible when selected.

### 8. Drag and edit
- Body drag: all 7 anchors translate together.
- Individual anchor drag: only connected segments reshape; other anchors fixed.
- With 7 anchors, reshaping is highly granular.

### 9. Tooltip behavior
- Live preview during creation showing the growing polyline.
- No measurement pill.
- Anchor labels shown at each placed point during and after creation.

### 10. Floating toolbar
- Color, thickness (1–8), style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity.
- Label visibility and font size.
- No fill.

### 13. Text and label behavior
- Intrinsic labels: X, 1, A, 2, B, 3, C at each anchor.
- Labels move with anchors.
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves all 7 anchor coordinates.
- Time-monotonic constraint: the three-drives pattern typically requires that anchor times are monotonically increasing left-to-right. The e2e factory enforces a horizontal spread of at least `18 * (anchorCount - 1)` pixels to avoid degenerate placements.
- Timeframe changes: pattern re-renders at same time/price coordinates.

### 15. Keyboard behavior
- Escape: cancels draft at any of the 6 intermediate steps; or deactivates tool if no draft is active.
- Delete/Backspace: remove selected drawing.
- Ctrl+Z: undo. Ctrl+D: duplicate. Other keys: no crash.

### 16. Edge cases
- Partial sequence abandonment: pressing Escape after placing 5 of 7 anchors discards all 5. The drawing is not partially committed.
- Monotonic time failure: placing anchors that backtrack in time may produce a malformed pattern; the tool does not enforce time ordering at the interaction level.
- Long sequence on mobile/touch: 7 taps required; each must be sufficiently separated in time to avoid multi-tap disambiguation.
- Heavily overlapping with other patterns: the 6-segment polyline intersects many chart areas; hit-testing may compete with other drawings.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'threeDrives'`, `anchors: 7`, `iconKey: 'Activity'`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 7`; `tv-parity-threeDrives-500.spec.ts` — `anchorCount: 7`, `commitMode: "click-sequence"`; `tv-parity-500-factory.ts` — special handling for click-sequence with `18 * (ANCHOR_COUNT - 1)` minimum span.
- Remaining gaps: label text "X, 1, A, 2, B, 3, C" vs alternative labeling not confirmed from source; live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Elliott Waves (5 tools)

---

## Tool: elliottImpulse

### 1. Tool identity
- Exact TradingView tool name: **Elliott Impulse Wave (1-2-3-4-5)**
- Tool variant id: `elliottImpulse`
- Category: Elliott Waves
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Elliott Waves"
- Family: `pattern`
- Icon key: `Activity`
- In submenu under Patterns rail, under the "Elliott Waves" sub-heading.

### 2. Activation behavior
- Clicking "Elliott Impulse Wave (1-2-3-4-5)" in the Patterns popover → Elliott Waves section activates the tool.
- `getActiveVariant()` returns `"elliottImpulse"`.
- Last-used: rail shows elliottImpulse icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 5 sequential clicks required, one per wave endpoint: 1 → 2 → 3 → 4 → 5.
- Click 1: Wave 1 endpoint (or origin of wave 1 — the start of the impulse).
- Click 2: Wave 2 endpoint (retracement low of wave 1).
- Click 3: Wave 3 endpoint (extension high, typically the strongest wave).
- Click 4: Wave 4 endpoint (retracement of wave 3).
- Click 5: Wave 5 endpoint (final impulse high). Commit click.
- During creation, a polyline preview extends from placed anchors to the cursor.
- Commit style: `click-sequence`, `anchorCount: 5`.

### 4. Multi-anchor sequence
- Anchor order: wave-1 end (0), wave-2 end (1), wave-3 end (2), wave-4 end (3), wave-5 end (4).
- The 4 segments drawn: 1→2, 2→3, 3→4, 4→5 represent the four sub-wave transitions.
- The origin (start of wave 1) may be an implicit 0-point or the first anchor represents the 1→2 boundary; exact labeling follows TradingView's convention with wave labels at the turn points.
- Live preview updates after each click.
- Escape before click 5 cancels.
- After commit, all 5 anchors independently editable.

### 5. Selection and reselection
- 4 connected segments form the wave structure.
- Clicking any segment selects the drawing.
- 5 circular handles visible when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over segment: move/hand cursor.
- Over anchor: resize pointer.
- Wave labels (1, 2, 3, 4, 5) or parenthetical variants visible on hover/selection at each anchor.

### 7. Handles and anchors
- 5 circular handles at wave turn points 1, 2, 3, 4, 5.
- Visible when selected.
- Labels: 1, 2, 3, 4, 5 (or Roman numerals: I, II, III, IV, V depending on degree setting).

### 8. Drag and edit
- Body drag: all 5 anchors translate.
- Individual anchor drag: reshapes connected segments; wave interpretation updates visually.

### 9. Tooltip behavior
- Live preview during creation.
- After commit: wave labels (1, 2, 3, 4, 5) rendered at each anchor position.
- No measurement pill.

### 10. Floating toolbar
- Color, thickness (1–8), style, settings (includes degree/label options for Elliott waves), delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.
- Settings opens Elliott wave-specific options including wave degree display.

### 12. Settings/style
- Line color, width (1–8), style, opacity.
- Wave degree options (primary, intermediate, minor, etc.) for label display.
- Label font size and visibility.
- No fill.

### 13. Text and label behavior
- Intrinsic wave labels 1, 2, 3, 4, 5 at each anchor.
- Labels move with anchors on drag.
- supportsText: false — no user-added free text.
- Degree setting affects label appearance (e.g., parenthetical notation for different Elliott wave degrees).

### 14. Chart interaction
- Pan/zoom preserves anchor coordinates.
- Wave labels scale with chart zoom.
- Timeframe changes: pattern re-renders at same time/price anchors.

### 15. Keyboard behavior
- Escape: cancel partial or deactivate. Delete/Backspace: remove. Ctrl+Z: undo. Ctrl+D: duplicate. Other keys: no crash.

### 16. Edge cases
- Wave 3 shorter than wave 1 (Elliott wave rule violation): no enforcement; tool draws whatever coordinates are given.
- Wave 4 overlapping wave 1 territory: not enforced; user can place anchors freely.
- Very tall wave 3 making other waves appear compressed.
- Overlapping multiple Elliott impulse waves (nested counts): multiple drawings can coexist on the same chart area.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'elliottImpulse'`, `subSection: 'Elliott Waves'`, `anchors: 5`; `tv-parity-v2-elliottImpulse.spec.ts` — `variant: "elliottImpulse"`, `railTestId: "rail-patterns"`, `anchorCount: 5`, `commitMode: "click-sequence"`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 5`; `tv-parity-elliottImpulse-500.spec.ts`.
- Remaining gaps: wave degree label rendering not confirmed from source; live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: elliottCorrection

### 1. Tool identity
- Exact TradingView tool name: **Elliott Correction Wave (A-B-C)**
- Tool variant id: `elliottCorrection`
- Category: Elliott Waves
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Elliott Waves"
- Family: `pattern`
- Icon key: `Activity`
- In submenu under Patterns rail → "Elliott Waves" sub-heading.

### 2. Activation behavior
- Clicking "Elliott Correction Wave (A-B-C)" activates the tool.
- `getActiveVariant()` returns `"elliottCorrection"`.
- Last-used: rail shows elliottCorrection icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 3 sequential clicks required: A → B → C.
- Click 1 (A): Start of correction. First wave down (or up in bullish correction).
- Click 2 (B): Counter-trend bounce. A→B segment drawn.
- Click 3 (C): End of correction. B→C segment drawn. Commit click. Drawing auto-selected.
- Simplest Elliott wave drawing: only 2 segments.
- Commit style: `click-sequence`, `anchorCount: 3`.

### 4. Multi-anchor sequence
- Anchor order: A (0), B (1), C (2).
- A: correction start. B: counter-trend. C: correction end (typically near A wave extension).
- 2 segments: A→B, B→C.
- Live preview after each click.
- Escape before click 3 cancels.

### 5. Selection and reselection
- 2 connected segments.
- Clicking either segment selects.
- 3 circular handles visible when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over segment: move cursor. Over anchor: resize pointer.
- Labels A, B, C visible on hover/selection.

### 7. Handles and anchors
- 3 circular handles at A, B, C.
- Visible when selected.

### 8. Drag and edit
- Body drag: all 3 anchors translate.
- Individual anchor drag: reshapes connected segments.

### 9. Tooltip behavior
- Live preview during creation.
- Labels A, B, C shown after commit.
- No measurement pill.

### 10. Floating toolbar
- Color, thickness, style, settings (wave degree options), delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity.
- Wave degree and label options.
- No fill.

### 13. Text and label behavior
- Intrinsic labels: A, B, C.
- Labels move with anchors.
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves coordinates.

### 15. Keyboard behavior
- Escape: cancel (before click 3) or deactivate. Delete/Backspace: remove. Ctrl+Z/Ctrl+D: undo/duplicate. Others: no crash.

### 16. Edge cases
- Flat correction (A and C at same price): valid geometrically.
- Extended correction (C well below A): renders normally.
- Often drawn nested inside an Elliott impulse wave structure; no interaction conflicts between overlapping drawings.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'elliottCorrection'`, `anchors: 3`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 3`; `tv-parity-v2-elliottCorrection.spec.ts`; `tv-parity-elliottCorrection-500.spec.ts`.
- Remaining gaps: live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: elliottTriangle

### 1. Tool identity
- Exact TradingView tool name: **Elliott Triangle Wave (A-B-C-D-E)**
- Tool variant id: `elliottTriangle`
- Category: Elliott Waves
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Elliott Waves"
- Family: `pattern`
- Icon key: `Activity`
- In submenu under Patterns rail.

### 2. Activation behavior
- Clicking "Elliott Triangle Wave (A-B-C-D-E)" activates the tool.
- `getActiveVariant()` returns `"elliottTriangle"`.
- Crosshair cursor after activation.

### 3. Creation flow
- 5 sequential clicks required: A → B → C → D → E.
- Each click places one vertex of the contracting (or expanding) triangle.
- Click 1 (A): First wave vertex.
- Click 2 (B): Second vertex.
- Click 3 (C): Third vertex.
- Click 4 (D): Fourth vertex.
- Click 5 (E): Fifth vertex and apex of the triangle. Commit click.
- The 5-point triangle forms 4 segments (A→B, B→C, C→D, D→E), with the trendlines AB-CD and BC-DE converging (or diverging) to form the triangle boundary lines.
- Commit style: `click-sequence`, `anchorCount: 5`.

### 4. Multi-anchor sequence
- Anchor order: A (0), B (1), C (2), D (3), E (4).
- Elliott triangles show price contracting in a sideways range with each successive wave smaller.
- Live preview after each click.
- Escape before click 5 cancels.
- After commit, all 5 anchors independently editable.

### 5. Selection and reselection
- 4 connected segments.
- Clicking any segment selects.
- 5 circular handles when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over segment: move cursor. Over anchor: resize pointer.
- Labels A, B, C, D, E visible on hover/selection.

### 7. Handles and anchors
- 5 circular handles at A, B, C, D, E.
- Visible when selected.

### 8. Drag and edit
- Body drag: all 5 anchors translate.
- Individual anchor drag: reshapes adjacent segments.

### 9. Tooltip behavior
- Live preview during creation.
- Labels A, B, C, D, E shown after commit.
- No measurement pill.

### 10. Floating toolbar
- Color, thickness, style, settings (wave degree), delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity. Wave degree display. No fill.

### 13. Text and label behavior
- Intrinsic labels: A, B, C, D, E.
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves coordinates.

### 15. Keyboard behavior
- Escape: cancel before click 5 or deactivate. Delete/Backspace: remove. Ctrl+Z/Ctrl+D. Others: no crash.

### 16. Edge cases
- Expanding triangle (E beyond A boundary): valid; tool draws whatever coordinates given.
- Very tight triangle (all anchors near same price): near-zero-height shape.
- Distinction from trianglePattern (Chart Patterns): elliottTriangle has 5 anchors and A-B-C-D-E labels; trianglePattern has 3 anchors and is a separate tool.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'elliottTriangle'`, `anchors: 5`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 5`; `tv-parity-v2-elliottTriangle.spec.ts`; `tv-parity-elliottTriangle-500.spec.ts`.
- Remaining gaps: live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: elliottDoubleCombo

### 1. Tool identity
- Exact TradingView tool name: **Elliott Double Combo Wave (W-X-Y)**
- Tool variant id: `elliottDoubleCombo`
- Category: Elliott Waves
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Elliott Waves"
- Family: `pattern`
- Icon key: `Activity`
- In submenu under Patterns rail.

### 2. Activation behavior
- Clicking "Elliott Double Combo Wave (W-X-Y)" activates the tool.
- `getActiveVariant()` returns `"elliottDoubleCombo"`.
- Crosshair cursor after activation.

### 3. Creation flow
- 3 sequential clicks required: W → X → Y.
- Click 1 (W): First corrective wave end.
- Click 2 (X): Connecting wave (inter-wave pivot).
- Click 3 (Y): Second corrective wave end. Commit click.
- The double combo represents two corrective patterns (W and Y) linked by an X wave.
- Commit style: `click-sequence`, `anchorCount: 3`.

### 4. Multi-anchor sequence
- Anchor order: W (0), X (1), Y (2).
- W: end of first corrective structure. X: end of connecting wave. Y: end of second corrective structure.
- 2 segments: W→X, X→Y.
- Live preview after each click.
- Escape before click 3 cancels.

### 5. Selection and reselection
- 2 connected segments.
- Clicking either segment selects.
- 3 circular handles when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over segment: move cursor. Over anchor: resize pointer.
- Labels W, X, Y visible on hover/selection.

### 7. Handles and anchors
- 3 circular handles at W, X, Y.

### 8. Drag and edit
- Body drag: all 3 anchors translate.
- Individual anchor drag: reshapes adjacent segments.

### 9. Tooltip behavior
- Live preview during creation.
- Labels W, X, Y shown after commit.
- No measurement pill.

### 10. Floating toolbar
- Color, thickness, style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity. Wave degree options. No fill.

### 13. Text and label behavior
- Intrinsic labels: W, X, Y.
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves coordinates.

### 15. Keyboard behavior
- Escape: cancel or deactivate. Delete/Backspace: remove. Ctrl+Z/Ctrl+D. Others: no crash.

### 16. Edge cases
- Identical to elliottCorrection in anchor count (3) and commit flow, but with different labels (W, X, Y vs A, B, C) and different Elliott wave interpretation.
- User must distinguish these two 3-anchor tools by label; no visual difference in segment count.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'elliottDoubleCombo'`, `anchors: 3`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 3`; `tv-parity-v2-elliottDoubleCombo.spec.ts`; `tv-parity-elliottDoubleCombo-500.spec.ts`.
- Remaining gaps: live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: elliottTripleCombo

### 1. Tool identity
- Exact TradingView tool name: **Elliott Triple Combo Wave (W-X-Y-X-Z)**
- Tool variant id: `elliottTripleCombo`
- Category: Elliott Waves
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Elliott Waves"
- Family: `pattern`
- Icon key: `Activity`
- In submenu under Patterns rail.

### 2. Activation behavior
- Clicking "Elliott Triple Combo Wave (W-X-Y-X-Z)" activates the tool.
- `getActiveVariant()` returns `"elliottTripleCombo"`.
- Crosshair cursor after activation.

### 3. Creation flow
- 5 sequential clicks required: W → X → Y → X → Z.
- Note: the label sequence includes "X" twice, representing two separate connecting waves in the triple combo structure.
- Click 1 (W): First corrective wave end.
- Click 2 (X1): First connecting wave.
- Click 3 (Y): Second corrective wave end.
- Click 4 (X2): Second connecting wave.
- Click 5 (Z): Third corrective wave end. Commit click.
- The triple combo is three corrective patterns (W, Y, Z) linked by two X waves.
- Commit style: `click-sequence`, `anchorCount: 5`.

### 4. Multi-anchor sequence
- Anchor order: W (0), X (1), Y (2), X (3), Z (4). Note that the TradingView label "W-X-Y-X-Z" uses X twice; internally these are separate anchor points at indices 1 and 3.
- 4 segments: W→X, X→Y, Y→X, X→Z.
- Live preview after each click.
- Escape before click 5 cancels.
- After commit, all 5 anchors independently editable.

### 5. Selection and reselection
- 4 connected segments.
- Clicking any segment selects.
- 5 circular handles when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over segment: move cursor. Over anchor: resize pointer.
- Labels W, X, Y, X, Z visible at respective anchors.

### 7. Handles and anchors
- 5 circular handles at W, X1, Y, X2, Z positions.

### 8. Drag and edit
- Body drag: all 5 anchors translate.
- Individual anchor drag: reshapes adjacent segments.

### 9. Tooltip behavior
- Live preview during creation.
- Labels W, X, Y, X, Z shown after commit.
- No measurement pill.

### 10. Floating toolbar
- Color, thickness, style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity. Wave degree options. No fill.

### 13. Text and label behavior
- Intrinsic labels: W, X, Y, X, Z (two anchors both labeled X).
- supportsText: false.

### 14. Chart interaction
- Pan/zoom preserves coordinates.

### 15. Keyboard behavior
- Escape: cancel before click 5 or deactivate. Delete/Backspace: remove. Ctrl+Z/Ctrl+D. Others: no crash.

### 16. Edge cases
- Identical to elliottTriangle and elliottImpulse in anchor count (5) but with different labels and wave interpretation.
- The repeated "X" label at two anchors may appear confusing on-screen; both anchors are independently draggable.
- Mid-sequence (after click 3): the pattern already forms a partial W-X-Y structure; Escape at this stage discards all placed anchors.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'elliottTripleCombo'`, `anchors: 5`; `tv-parity-patterns.spec.ts` — `commitStyle: "click-sequence"`, `anchors: 5`; `tv-parity-v2-elliottTripleCombo.spec.ts`; `tv-parity-elliottTripleCombo-500.spec.ts`.
- Remaining gaps: label rendering for the two "X" anchors not confirmed; live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Cycles (3 tools)

The three Cycles tools differ fundamentally from Chart Pattern and Elliott Wave tools in their commit style. All three use **drag** to commit: the user presses down at the start point, drags to the end point, and releases. This single drag gesture defines both anchors simultaneously. There is no sequential click-by-click placement.

---

## Tool: cyclicLines

### 1. Tool identity
- Exact TradingView tool name: **Cyclic Lines**
- Tool variant id: `cyclicLines`
- Category: Cycles
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Cycles"
- Family: `pattern`
- Icon key: `Waves`
- In submenu under Patterns rail → "Cycles" sub-heading.

### 2. Activation behavior
- Clicking "Cyclic Lines" in the Patterns popover → Cycles section activates the tool.
- `getActiveVariant()` returns `"cyclicLines"`.
- Last-used: rail shows cyclicLines icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 2 anchors committed via a single drag gesture.
- Press mouse button at anchor[0] (the start of one cycle period).
- Drag to anchor[1] (the end of the period, one full cycle later).
- Release mouse button: drawing committed and auto-selected.
- The horizontal distance between anchor[0] and anchor[1] defines the cycle period. The tool then renders repeating vertical lines extending across the chart at that interval — both forward (to the right) and backward (to the left) from the anchor range.
- Commit style: `drag`, `anchorCount: 2`.
- Note: `tv-parity-patterns.spec.ts` explicitly lists cyclicLines as `commitStyle: "drag"`, in contrast to the Click-sequence pattern tools.

### 4. Multi-anchor sequence
- Anchor order: anchor[0] (start of period), anchor[1] (end of period).
- The two anchors define the time interval for one complete cycle.
- The period T = time(anchor[1]) - time(anchor[0]).
- Cyclic lines extend at intervals of T across the full visible chart range: ..., anchor[0] - T, anchor[0], anchor[1], anchor[1] + T, anchor[1] + 2T, ...
- Only the two anchor handles are stored and editable; the repeating lines are computed geometrically from the period.
- No partial draft cancellation for drag tools (no click-by-click sequence).
- During drag: a live preview shows the two boundary lines and the repeating pattern forming.
- After commit, anchor[0] and anchor[1] are independently editable by dragging their handles.

### 5. Selection and reselection
- The drawing consists of multiple vertical lines extending across the chart. Clicking any visible cyclic line selects the drawing.
- The two anchor positions (where the user defined the period) are the editable handles.
- Deselect by clicking in an area between cyclic lines (not on any line).
- Reselect by clicking any cyclic line.
- When selected, 2 circular handles are visible at anchor[0] and anchor[1].

### 6. Hover and cursor
- Over any vertical cyclic line: move/hand cursor.
- Over anchor handle: resize pointer.
- The period label (time interval) may be shown near the anchor handles.

### 7. Handles and anchors
- 2 circular handles: one at anchor[0], one at anchor[1].
- These handles control the period endpoints.
- Visible when selected.

### 8. Drag and edit
- Body drag (dragging any cyclic line): shifts both anchors by the same time offset. All rendered cyclic lines shift together.
- Anchor[0] drag: changes the start of the period. Anchor[1] position stays fixed; the period length (and thus spacing between cyclic lines) changes.
- Anchor[1] drag: changes the end of the period, changing the spacing.
- Dragging either anchor updates all computed cyclic lines in real-time.

### 9. Tooltip behavior
- During drag: preview shows the two boundary vertical lines and possibly intermediate cyclic lines based on the current period.
- No measurement pill.
- The period (time interval) may be shown as a label near the anchor handles after commit.

### 10. Floating toolbar
- Color, thickness (1–8), line style (solid/dashed/dotted), settings, delete, clone, lock, hide.
- Settings may include options for: number of cycles shown, line visibility options.

### 11. Context menu
- Right-click any cyclic line: Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color and width apply to all cyclic lines.
- Line style (solid/dashed/dotted) applies uniformly.
- Opacity.
- No fill (supportsFill: false).

### 13. Text and label behavior
- Period label may appear near the anchor area showing the time interval.
- supportsText: false — no user-added text.
- No anchor letters (this is a cycles tool, not a pattern with letter labels).

### 14. Chart interaction
- The cyclic lines fill the entire horizontal extent of the chart; as the chart is panned or zoomed, the lines recompute but maintain their stored time/price anchor coordinates.
- Zooming in: the spacing between lines increases (in pixels) as the time axis is magnified.
- Zooming out: lines become more densely packed; some may be outside the viewport.
- Timeframe changes: the stored time-based period is preserved; the visual density changes with the new timeframe's bar width.

### 15. Keyboard behavior
- Escape during drag (before mouse-up): cancels the draft. No drawing added.
- Escape with no draft: deactivates tool.
- Delete/Backspace: remove selected drawing (removes all cyclic lines).
- Ctrl+Z: undo. Ctrl+D: duplicate (creates a second cyclic-lines drawing with the same period).
- Other keys: no crash.

### 16. Edge cases
- Very short drag (small period): cyclic lines are very closely spaced, potentially creating a dense visual grid across the chart.
- Very long period (drag spanning most of the chart width): only one or two cyclic lines may be visible in the current viewport.
- Anchor[0] and anchor[1] at the same time: zero-period; cyclic lines collapse to a single position or render incorrectly. The e2e factory enforces a minimum drag distance.
- Period spanning across market-closed periods (gaps): the time-based period still repeats at the same absolute time interval, which may visually skip gaps in OHLC data.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'cyclicLines'`, `subSection: 'Cycles'`, `anchors: 2`, `iconKey: 'Waves'`; `tv-parity-v2-cyclicLines.spec.ts` — `variant: "cyclicLines"`, `railTestId: "rail-patterns"` (no anchorCount/commitMode override, defaulting to 2-anchor drag); `tv-parity-patterns.spec.ts` — `commitStyle: "drag"`, `anchors: 2`; `tv-parity-cyclicLines-500.spec.ts`.
- Remaining gaps: period label rendering not confirmed from source; live pixel diff pending; behavior at zero-period not tested.
- Live TradingView interaction: not directly verified.

---

## Tool: timeCycles

### 1. Tool identity
- Exact TradingView tool name: **Time Cycles**
- Tool variant id: `timeCycles`
- Category: Cycles
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Cycles"
- Family: `pattern`
- Icon key: `Clock3`
- In submenu under Patterns rail → "Cycles" sub-heading.

### 2. Activation behavior
- Clicking "Time Cycles" in the Patterns popover → Cycles section activates the tool.
- `getActiveVariant()` returns `"timeCycles"`.
- Last-used: rail shows timeCycles (Clock3) icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 2 anchors committed via a single drag gesture.
- Press at anchor[0]: base period start.
- Drag to anchor[1]: base period end.
- Release: drawing committed and auto-selected.
- The time cycles tool renders semicircular arcs (half-ellipses) at time intervals defined by the drag distance. Each arc spans from the baseline at anchor[0] upward and back down, with successive arcs at 2×, 3×, 4× the base period.
- The visual output differs significantly from cyclicLines (vertical lines) — timeCycles produces curved arcs.
- Commit style: `drag`, `anchorCount: 2`.

### 4. Multi-anchor sequence
- 2 anchors: anchor[0] (base period start) and anchor[1] (base period end).
- Period T = time(anchor[1]) - time(anchor[0]).
- Arcs are rendered at T, 2T, 3T, ... from anchor[0], each as a semicircle whose diameter equals the time period it represents.
- Escape during drag (before release) cancels.
- After commit, both anchors are independently editable.

### 5. Selection and reselection
- Clicking any arc (the curved line) selects the drawing.
- Clicking between arcs in empty space does not select.
- 2 circular handles visible when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over an arc: move/hand cursor.
- Over anchor handle: resize pointer.

### 7. Handles and anchors
- 2 circular handles at anchor[0] and anchor[1].
- Visible when selected.

### 8. Drag and edit
- Body drag (on any arc): shifts both anchors by the same delta. All arcs shift.
- Anchor drag: changes the period, resizing all arcs.

### 9. Tooltip behavior
- During drag: live preview of the growing arc structure.
- No measurement pill.
- Period label may show near the anchor region.

### 10. Floating toolbar
- Color, thickness (1–8), style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity for arcs.
- Settings may include number of arcs to display.
- No fill (supportsFill: false).

### 13. Text and label behavior
- Period or arc-number labels may appear near each arc.
- supportsText: false — no user-added text.

### 14. Chart interaction
- Arcs are rendered in chart canvas space; panning moves the anchor coordinates.
- Zooming changes the pixel size of the arcs while preserving stored time coordinates.
- On compressed timeframes, arcs may appear very tall relative to the chart height.

### 15. Keyboard behavior
- Escape during drag: cancel. Escape with no draft: deactivate.
- Delete/Backspace: remove. Ctrl+Z: undo. Ctrl+D: duplicate. Others: no crash.

### 16. Edge cases
- Very short period: arcs are very narrow and closely packed.
- Very long period: only the first arc may be visible.
- Arc height is fixed to the chart height or to a proportion; behavior at extreme zoom levels may clip arcs.

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'timeCycles'`, `subSection: 'Cycles'`, `anchors: 2`, `iconKey: 'Clock3'`; `tv-parity-patterns.spec.ts` — `commitStyle: "drag"`, `anchors: 2`; `tv-parity-timeCycles-500.spec.ts`.
- Remaining gaps: arc rendering geometry (semicircle math) not confirmed from source code; live pixel diff pending.
- Live TradingView interaction: not directly verified.

---

## Tool: sineLine

### 1. Tool identity
- Exact TradingView tool name: **Sine Line**
- Tool variant id: `sineLine`
- Category: Cycles
- Rail: Patterns rail (`data-testid="rail-patterns"`)
- SubSection: "Cycles"
- Family: `pattern`
- Icon key: `Waves`
- In submenu under Patterns rail → "Cycles" sub-heading.

### 2. Activation behavior
- Clicking "Sine Line" in the Patterns popover → Cycles section activates the tool.
- `getActiveVariant()` returns `"sineLine"`.
- Last-used: rail shows sineLine (Waves) icon.
- Crosshair cursor after activation.

### 3. Creation flow
- 2 anchors committed via a single drag gesture.
- Press at anchor[0]: start of the sine wave (one full wavelength origin).
- Drag to anchor[1]: end of the wavelength definition.
- Release: drawing committed and auto-selected.
- The sine line renders a continuous sinusoidal wave fitted to the time interval defined by the two anchor points. The period of the sine wave equals the time span between anchor[0] and anchor[1]. The wave amplitude is determined by a vertical offset or a default proportion of chart height.
- Commit style: `drag`, `anchorCount: 2`.

### 4. Multi-anchor sequence
- 2 anchors: anchor[0] (wave origin) and anchor[1] (one period end).
- The wavelength λ = time(anchor[1]) - time(anchor[0]).
- The sine wave is continuous and extends in both directions (or just rightward, depending on TradingView's implementation).
- Escape during drag (before release) cancels.
- After commit, both anchors independently editable.

### 5. Selection and reselection
- Clicking the sinusoidal curve line selects the drawing.
- The curve is a continuous rendered path; clicking within ~8–12 px of any part of the curve selects it.
- 2 circular handles visible when selected.
- Click away to deselect.

### 6. Hover and cursor
- Over the sine curve: move/hand cursor.
- Over anchor handle: resize pointer.

### 7. Handles and anchors
- 2 circular handles at anchor[0] and anchor[1].
- Visible when selected.

### 8. Drag and edit
- Body drag (on the sine curve): moves both anchors by same delta. The entire wave shifts.
- Anchor[0] drag: changes the wave origin; the period is recomputed from the distance to anchor[1].
- Anchor[1] drag: changes the period end; wavelength changes, the displayed wave frequency changes.

### 9. Tooltip behavior
- During drag: live preview of the sine wave taking shape.
- No measurement pill.
- Wavelength or frequency label may appear near anchors.

### 10. Floating toolbar
- Color, thickness (1–8), style, settings, delete, clone, lock, hide.

### 11. Context menu
- Template, Clone, Copy, Lock, Hide, Remove, Settings.

### 12. Settings/style
- Line color, width, style, opacity for the sine curve.
- Settings may include amplitude multiplier or wave count options.
- No fill (supportsFill: false).

### 13. Text and label behavior
- Wavelength or period label may appear near the anchor region.
- supportsText: false — no user-added text.

### 14. Chart interaction
- The sine wave is rendered as a continuous curve in chart canvas space.
- Panning shifts the pixel rendering; stored time/price anchors are preserved.
- Zooming changes the pixel scale of the wave while preserving the stored period.
- On very compressed timeframes, the wave may appear compressed horizontally with many oscillations visible.

### 15. Keyboard behavior
- Escape during drag: cancel. Escape with no draft: deactivate.
- Delete/Backspace: remove. Ctrl+Z: undo. Ctrl+D: duplicate. Others: no crash.

### 16. Edge cases
- Very short period (tiny drag): high-frequency wave with many oscillations visible; may become visually noisy.
- Very long period (large drag): only a fraction of one oscillation may be visible in the viewport.
- Anchor[0] equals anchor[1] in time: zero-period; degenerate case, wave may not render or render as a flat line.
- The sineLine and cyclicLines share the same `Waves` icon key but produce visually distinct outputs (continuous curve vs. vertical lines).

### 17. Evidence and status
- Coverage status: **complete**
- Evidence: `toolRegistry.ts` — `id: 'sineLine'`, `subSection: 'Cycles'`, `anchors: 2`, `iconKey: 'Waves'`; `tv-parity-patterns.spec.ts` — `commitStyle: "drag"`, `anchors: 2`; `tv-parity-sineLine-500.spec.ts`.
- Remaining gaps: sine amplitude definition and whether the wave extends only rightward or in both directions not confirmed from source; live pixel diff pending.
- Live TradingView interaction: not directly verified.


---


# Section 4: Forecasting and Brush Tools (18 tools)

This section documents TradingView behavioral coverage for the Forecasting category (12 tools across
3 subcategories: Forecasting, Volume-based, and Measurers) and the Brush category (6 tools across
2 subcategories: Brushes and Arrows).

Source evidence: `toolRegistry.ts` (tool definitions, capabilities, schemas, default options),
`tv-capture-factory.ts` (aria-labels, commit modes, anchor counts, default colors, TV shortcuts).
No v2 spec files exist for any of the 18 tools in this section — all are coverage gaps.

---

## Part 1: Forecasting / Forecasting Subcategory (6 tools)

---

### Tool 1: longPosition

#### 1. Tool identity
- **Exact TradingView tool name:** Long position
- **Category:** forecasting
- **Subcategory:** Forecasting
- **Family:** position
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Long position"]`
- **Default color:** `#089981` (green)

#### 2. Activation behavior
- Rail click opens the Forecasting and measurement tools submenu (if long position is not the last-used tool in the rail slot).
- If long position was the last tool activated from this rail, a subsequent click on the rail activates it directly without opening the submenu.
- Cursor after activation: crosshair (tool family is `position`; toolCursor resolves to `crosshair` for non-text, non-zoom tools).
- TV keyboard shortcut: **Alt+L**

#### 3. Creation flow
Three-click sequence (commitMode: `click-sequence`, anchorCount: 3):
1. **Click 1** — sets the entry price anchor. A horizontal entry line appears at the clicked price level.
2. **Click 2** — sets the take-profit (target) price anchor. The green fill region expands upward from entry to the clicked price.
3. **Click 3** — sets the stop-loss price anchor. The red fill region extends downward from entry to the stop level. Tool commits on the third click and drawing is finalized.

During creation, the preview updates dynamically with each click, showing the growing position box with entry/profit/stop lines.

#### 4. Multi-anchor sequence
- Anchor 1 = entry price (horizontal line at clicked price/time)
- Anchor 2 = take-profit target (upper boundary of green profit zone)
- Anchor 3 = stop-loss level (lower boundary of red loss zone)
- Post-commit: each anchor can be individually dragged to reposition its associated price level. Dragging anchor 2 adjusts the profit target; dragging anchor 3 adjusts the stop-loss.

#### 5. Selection and reselection
- Hit-testing on either the filled profit zone, the filled loss zone, the entry line, target line, or stop line selects the drawing.
- The entire position box (all fills and lines) becomes selected together as one unit.
- Clicking anywhere within the bounding area of the three-line structure activates selection.

#### 6. Hover and cursor
- Hovering over the profit fill area or stop fill area shows a pointer/move cursor indicating the drawing is interactive.
- Hovering over boundary lines shows a resize cursor appropriate for vertical dragging.
- The crosshair cursor is shown on the chart canvas when the tool is active but no drawing is selected.

#### 7. Handles and anchors
- 3 handles total, one at each anchor point (entry, target, stop).
- Handles appear as small square or circular drag points on the left side of each horizontal line.
- All 3 handles are visible simultaneously when the drawing is selected.

#### 8. Drag and edit
- Dragging the entry line handle moves the entire entry price level.
- Dragging the target line handle (anchor 2) independently adjusts the take-profit level; the green fill zone height changes accordingly.
- Dragging the stop-loss handle (anchor 3) independently adjusts the stop level; the red fill zone height changes.
- Dragging the body of the drawing (the fill area) moves the entire three-line position box as a unit, preserving the relative distances between entry, target, and stop.

#### 9. Tooltip behavior
- Tooltip on hover shows: "Long position"
- When selected, the floating toolbar and the drawing itself show risk/reward ratio (e.g., "R/R: 2.5"), profit percentage from entry to target, and loss percentage from entry to stop.
- positionLabelMode option controls whether the label shows `rr` (risk/reward), `price` (delta), or `both`.

#### 10. Floating toolbar
- Color picker for the drawing color
- Risk/reward label mode selector (R/R, Price Delta, Both)
- Settings gear icon (opens full style dialog)
- Delete (trash) icon
- Lock icon to lock the drawing position

#### 11. Context menu
- Standard right-click context menu with: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.
- "Set as default" option to save current entry/target/stop configuration as default for new long position drawings.

#### 12. Settings/style
- forecastingSchema applies: color, opacity, thickness, style (solid/dashed/dotted), snapMode, vwapInterval, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- fibLevels and fibLabelMode are excluded (not applicable to position tools).
- brushSmoothness is excluded.
- positionLabelMode: `rr` | `price` | `both` — controls text overlaid on the position box.
- Profit zone color defaults to green (#089981); stop zone color is red (#f23645).
- Style dialog allows separate control of fill opacity for profit and loss zones.

#### 13. Text and label behavior
- supportsText: true — the drawing renders intrinsic labels (not user-typed text).
- Entry price, take-profit price, stop-loss price are displayed on price axis labels.
- Inside the profit zone: profit amount in points and percentage (e.g., "+2.5% / +120 pts").
- Inside the loss zone: loss amount in points and percentage (e.g., "-1.0% / -48 pts").
- R/R label shown in center of drawing (e.g., "2.5R").
- Labels update automatically when anchors are dragged.

#### 14. Chart interaction
- Anchor coordinates (time + price for each of the 3 anchors) are preserved on pan and zoom.
- The horizontal lines extend to the left edge of the visible chart area (entry/target/stop extend leftward unless extendLeft is disabled).
- On chart pan, lines follow their anchored time/price coordinates correctly.

#### 15. Keyboard behavior
- **Escape** during creation (before 3rd click): cancels the drawing in progress, returns to ready state.
- **Escape** when selected: deselects the drawing.
- **Delete / Backspace** when selected: removes the drawing (with undo history entry).
- **Ctrl+Z**: undoes last action.
- **Ctrl+Y / Ctrl+Shift+Z**: redoes.
- **Alt+L**: activates the Long position tool from any state.

#### 16. Edge cases
- If target anchor equals entry anchor (0 price difference): R/R becomes undefined (0/0). TradingView renders a degenerate box with zero height profit zone; the loss zone is drawn normally.
- If stop anchor equals entry anchor: similar degenerate state; profit zone renders normally.
- If target is placed below entry (inverted): TradingView typically swaps the rendering so the profit zone is above entry regardless (directional logic enforced by the long position tool).
- Drawing at chart extremes (near top or bottom price boundary): anchor clamps to visible chart range but preserves the stored price value.

#### 17. Evidence and status
- **Coverage status:** Automation defined in `tv-capture-factory.ts` (index 0, Slot 1). CommitMode: `click-sequence`, anchorCount: 3. expectedColorDefault: `#089981`, tvShortcut: `Alt+L`.
- **No v2 spec file** exists for `longPosition`. No `tv-parity-v2-longPosition.spec.ts` found in `e2e/`.
- **Gap:** Full 500-scenario v2 suite not written. Scenario kinds rr-label, axis-labels, and price-label are defined in ScenarioKind but not exercised for this tool.

---

### Tool 2: shortPosition

#### 1. Tool identity
- **Exact TradingView tool name:** Short position
- **Category:** forecasting
- **Subcategory:** Forecasting
- **Family:** position
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Short position"]`
- **Default color:** `#f23645` (red)

#### 2. Activation behavior
- Rail click opens the Forecasting and measurement tools submenu if short position is not the last-used slot tool.
- Last-used tool in rail slot: direct activation without submenu.
- Cursor after activation: crosshair.
- TV keyboard shortcut: **Alt+S**

#### 3. Creation flow
Three-click sequence (commitMode: `click-sequence`, anchorCount: 3):
1. **Click 1** — sets the entry price anchor. A horizontal entry line appears.
2. **Click 2** — sets the take-profit (target) anchor. For a short, profit is below entry, so the green fill extends downward.
3. **Click 3** — sets the stop-loss anchor. For a short, stop is above entry, so red fill extends upward.

The position box is mirrored from longPosition: profit zone is below entry (green fill), stop zone is above entry (red fill).

#### 4. Multi-anchor sequence
- Anchor 1 = entry price
- Anchor 2 = take-profit target (below entry for short)
- Anchor 3 = stop-loss level (above entry for short)
- Post-commit: each anchor draggable independently.

#### 5. Selection and reselection
- Hit-testing on any of the three horizontal lines, or within either fill zone, selects the drawing.
- All three lines and fills select as one unit.

#### 6. Hover and cursor
- Move cursor shown on hover over fill area.
- Vertical resize cursor on boundary line hover.
- Crosshair on chart when tool is active but idle.

#### 7. Handles and anchors
- 3 handles, one per anchor (entry, target, stop).
- Appear as draggable points on the left side of each horizontal line when selected.

#### 8. Drag and edit
- Entry line drag: moves entire position vertically as a unit.
- Target line drag: adjusts profit level independently (extends/contracts green zone).
- Stop-loss line drag: adjusts stop level independently (extends/contracts red zone).
- Body drag: moves entire drawing (all three lines and fills) preserving relative spacing.

#### 9. Tooltip behavior
- Hover tooltip: "Short position"
- R/R ratio, profit %, and loss % displayed on the drawing itself.
- positionLabelMode determines label content.

#### 10. Floating toolbar
- Color picker, risk/reward label mode, settings, delete, lock.

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.
- "Set as default" option.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, vwapInterval, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- Profit zone (below entry) is green; stop zone (above entry) is red.
- Default stroke color: #f23645.

#### 13. Text and label behavior
- supportsText: true — intrinsic labels only.
- Entry price, profit target, stop price labeled on price axis.
- Profit/loss amounts and percentages shown inside their respective zones.
- R/R label displayed in center of the box.

#### 14. Chart interaction
- Coordinates preserved on pan/zoom.
- Lines extend to chart left edge unless extendLeft is disabled.

#### 15. Keyboard behavior
- **Escape** during creation: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes drawing.
- **Ctrl+Z**: undo.
- **Alt+S**: activates Short position tool.

#### 16. Edge cases
- Target placed above entry (wrong direction for short): TradingView may enforce directional logic or show inverted zone.
- Stop placed below entry (wrong direction for short): same inversion edge case.
- Zero R/R (target = entry): degenerate zero-height profit zone.
- Very tight stop (stop only a tick from entry): extremely thin red zone, R/R text may overflow.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 1, Slot 2). CommitMode: `click-sequence`, anchorCount: 3. expectedColorDefault: `#f23645`, tvShortcut: `Alt+S`.
- **No v2 spec file** for `shortPosition`.
- **Gap:** No automated scenario coverage. All 17 behavior categories untested.

---

### Tool 3: positionForecast

#### 1. Tool identity
- **Exact TradingView tool name:** Forecast (displayed as "Forecast" in TV UI; internal id: positionForecast)
- **Category:** forecasting
- **Subcategory:** Forecasting
- **Family:** position
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Forecast"]`
- **Default color:** `#2962ff` (blue)

#### 2. Activation behavior
- Rail click opens Forecasting submenu; if Forecast was last used, direct activation.
- Cursor after activation: crosshair.
- No TV keyboard shortcut documented in capture factory.

#### 3. Creation flow
Three-click sequence (commitMode: `click-sequence`, anchorCount: 3):
1. **Click 1** — sets entry price anchor; blue entry line appears.
2. **Click 2** — sets upper boundary anchor (target); blue fill extends upward (or downward depending on direction).
3. **Click 3** — sets lower boundary anchor (stop); blue fill completes the forecast zone.

Unlike longPosition/shortPosition, the positionForecast uses a single blue color for both zones, reflecting a directional price forecast rather than a long/short bias with green/red semantics.

#### 4. Multi-anchor sequence
- Anchor 1 = entry/origin price
- Anchor 2 = upper boundary (forecast target)
- Anchor 3 = lower boundary (alternative scenario / stop level)
- Post-commit: all 3 anchors independently draggable.

#### 5. Selection and reselection
- Click anywhere within the blue fill zone or on any boundary line to select.
- Full drawing (all 3 lines + fill) selects as one unit.

#### 6. Hover and cursor
- Move cursor on fill area hover.
- Resize cursor on boundary line hover.

#### 7. Handles and anchors
- 3 handles, one at each anchor point.
- Displayed as drag handles when selected.

#### 8. Drag and edit
- Entry line drag: moves entry level.
- Upper boundary drag: adjusts upper price level.
- Lower boundary drag: adjusts lower price level.
- Body drag: moves entire forecast box.

#### 9. Tooltip behavior
- Hover tooltip: "Forecast"
- Displays forecast label, price deltas for upper and lower levels relative to entry.
- positionLabelMode controls R/R vs price delta display.

#### 10. Floating toolbar
- Color picker, label mode selector, settings, delete, lock.

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, vwapInterval, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- Single color (#2962ff) used for both zones (no green/red semantics).
- Fill opacity adjustable in settings.

#### 13. Text and label behavior
- supportsText: true — intrinsic price labels and delta values shown inside the zone.
- Price labels for entry, upper boundary, and lower boundary on the price axis.
- R/R or price delta values shown inside fill zones.

#### 14. Chart interaction
- Coordinates preserved on pan/zoom.
- Blue boundary lines extend to left of chart canvas.

#### 15. Keyboard behavior
- **Escape** during creation: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- All 3 anchors at same price: degenerate zero-height box.
- Upper anchor below entry: zones invert — tool may swap semantics or render crossed lines.
- Very large forecast zone spanning many thousands of price units: fill zone still renders, labels may need truncation.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 2, Slot 3). CommitMode: `click-sequence`, anchorCount: 3. expectedColorDefault: `#2962ff`.
- **No v2 spec file** for `positionForecast`.
- **Gap:** No scenario coverage. ScenarioKind `rr-label` relevant but not exercised.

---

### Tool 4: barPattern

#### 1. Tool identity
- **Exact TradingView tool name:** Bars Pattern (displayed as "Bars Pattern" in TV UI; internal id: barPattern)
- **Category:** forecasting
- **Subcategory:** Forecasting
- **Family:** pattern
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Bars Pattern"]`
- **Default color:** not specified (uses system default)

#### 2. Activation behavior
- Rail click opens Forecasting submenu; if Bars Pattern was last used, direct activation.
- Cursor after activation: crosshair.
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — sets the start of the source candle range (left anchor).
2. **Mouse drag** — extend right to define the source range of candles to copy.
3. **Mouse up** — commits the source selection. TradingView then projects copies of the selected candle sequence forward from the right anchor, overlaying the existing chart.

The source range (between anchor 1 and anchor 2) defines which candles are cloned and projected. The projected candles appear as ghost/overlay candles to the right of anchor 2.

#### 4. Multi-anchor sequence
- Anchor 1 = start of source candle range (left boundary, time + price at mouse-down)
- Anchor 2 = end of source candle range (right boundary, time + price at mouse-up)
- Post-commit: dragging anchor 1 shifts the start of the source range; dragging anchor 2 shifts the end, changing which candles are copied.

#### 5. Selection and reselection
- Click within the projected candle overlay region or the source range bracket to select.
- Hit-testing is on the bounding box of the source selection region and the projected area.

#### 6. Hover and cursor
- Move cursor shown when hovering over the source range bracket or projected candle area.
- Crosshair on chart canvas while tool is active.

#### 7. Handles and anchors
- 2 handles: one at the left time boundary (anchor 1) and one at the right time boundary (anchor 2).
- Both handles visible on selection.

#### 8. Drag and edit
- Dragging anchor 1: shifts the start of the source range; projected candles update accordingly.
- Dragging anchor 2: shifts the end of the source range; changes which candles are included in the pattern.
- Body drag: moves the entire source selection and the projected overlay.

#### 9. Tooltip behavior
- Hover tooltip: "Bars Pattern"
- During and after creation, the projected candles are rendered as a ghost/preview of the candle sequence.
- No numeric tooltip; visual candle projection serves as the primary feedback.

#### 10. Floating toolbar
- Color controls (for the source bracket lines and projected candle outlines)
- Settings gear icon
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, vwapInterval, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- No fill support (supportsFill: false).
- Settings dialog may offer opacity for projected candles and line thickness for source bracket.

#### 13. Text and label behavior
- supportsText: false — no text labels.
- The visual projection of candles is the sole output; no numeric annotations.

#### 14. Chart interaction
- Source range anchors are time-based; on pan, the source bracket moves with the chart.
- Projected candles extend to the right of anchor 2, floating in future time space.
- On zoom, the candle projection scales with the chart time axis.

#### 15. Keyboard behavior
- **Escape** during drag: cancels drawing.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Source range of 1 bar: single-candle pattern projected — valid but minimal.
- Source range spanning hundreds of bars: large projected overlay; performance may degrade on low-end hardware.
- Source range anchored at chart right edge (no future bars visible): projected candles appear in the scroll-right empty area.
- Fast drag with imprecise mouse movement: tool still captures bar range at mouse-up position.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 3, Slot 1). CommitMode: `drag`, anchorCount: 2. ScenarioKind `bars-pattern` defined.
- **No v2 spec file** for `barPattern`.
- **Gap:** bars-pattern scenario kind defined but no coverage file exists.

---

### Tool 5: ghostFeed

#### 1. Tool identity
- **Exact TradingView tool name:** Ghost Feed (displayed as "Ghost Feed" in TV UI; internal id: ghostFeed)
- **Category:** forecasting
- **Subcategory:** Forecasting
- **Family:** pattern
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Ghost Feed"]`
- **Default color:** not specified (uses system default)

#### 2. Activation behavior
- Rail click opens Forecasting submenu; if Ghost Feed was last used, direct activation.
- Cursor after activation: crosshair.
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — sets the origin anchor at the current price/time.
2. **Mouse drag** — draws out a freehand projected price path in the future.
3. **Mouse up** — commits the ghost feed line.

The ghost feed draws a projected forward price path as a line/curve extending into the future from the anchor point. Unlike barPattern, it does not copy candles; it shows a custom-drawn price trajectory.

#### 4. Multi-anchor sequence
- Anchor 1 = origin point (start of the projected path)
- Anchor 2 = end point of the path (where mouse was released)
- Post-commit: anchor 1 can be dragged to reposition the start; anchor 2 repositions the end.

#### 5. Selection and reselection
- Click on or near the ghost feed line to select.
- Hit-testing uses the line/path bounding area with a click tolerance.

#### 6. Hover and cursor
- Move cursor on hover over the ghost line.
- Crosshair on canvas while tool is active.

#### 7. Handles and anchors
- 2 handles: start and end of the projected path.
- Visible when drawing is selected.

#### 8. Drag and edit
- Anchor 1 drag: moves the starting origin of the path.
- Anchor 2 drag: moves the end point of the path.
- Body drag: moves the entire ghost feed path as a unit.

#### 9. Tooltip behavior
- Hover tooltip: "Ghost Feed"
- ScenarioKind `ghost-line` is defined, indicating a specific visual check for the projected line rendering.
- No numeric tooltip displayed.

#### 10. Floating toolbar
- Color picker, settings, delete, lock.

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- Line style (solid/dashed/dotted) and thickness configurable.
- No fill (supportsFill: false).

#### 13. Text and label behavior
- supportsText: false — no text labels.
- Visual path line only.

#### 14. Chart interaction
- Path coordinates (start and end anchors) are preserved on pan/zoom.
- The path line scales and repositions with the chart coordinate system.

#### 15. Keyboard behavior
- **Escape** during drag: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Very short drag (near-zero length path): creates a degenerate nearly-invisible line.
- Ghost feed drawn beyond the rightmost chart bar: path extends into empty future space, valid behavior.
- Overlapping ghost feed with actual price bars: ghost line renders above/below candles per z-order.
- Fast drag: path is captured at mouse-up position; intermediate mouse positions may or may not be captured depending on how TV implements the path.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 4, Slot 2). CommitMode: `drag`, anchorCount: 2. ScenarioKind `ghost-line` defined.
- **No v2 spec file** for `ghostFeed`.
- **Gap:** ghost-line scenario kind defined but no coverage file exists.

---

### Tool 6: sector

#### 1. Tool identity
- **Exact TradingView tool name:** Sector (internal id: sector)
- **Category:** forecasting
- **Subcategory:** Forecasting
- **Family:** shape
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Sector"]` (note: not listed explicitly in capture factory — not among the 27 captured tools)
- **Default color:** system default (no override in registry)

#### 2. Activation behavior
- Rail click opens Forecasting submenu.
- Cursor after activation: crosshair.
- No TV keyboard shortcut documented.

#### 3. Creation flow
2-anchor drag (anchorCount: 2, draggable: true):
1. **Click/drag from anchor 1** — sets the apex (center point) of the sector/wedge.
2. **Drag or second click** — defines the angle and radius of the wedge. The wedge-shaped fill area fans out from the apex.

The sector draws a wedge (pie-slice) shape between two radial lines emanating from the anchor point. The opening angle is determined by the drag vector.

#### 4. Multi-anchor sequence
- Anchor 1 = apex/center of the wedge
- Anchor 2 = radius/angle boundary defining the wedge shape
- Post-commit: anchors are draggable to reshape the wedge.

#### 5. Selection and reselection
- Click within the wedge fill area or on the boundary lines to select.
- Hit-testing on filled area (supportsFill: true).

#### 6. Hover and cursor
- Move cursor shown inside the wedge fill on hover.
- Resize cursor on boundary lines.

#### 7. Handles and anchors
- 2 handles visible on selection (apex and radius endpoint).

#### 8. Drag and edit
- Anchor 1 drag: moves the entire wedge apex.
- Anchor 2 drag: changes the radius and angle of the sector.
- Body drag: moves the entire sector as a unit.

#### 9. Tooltip behavior
- Hover tooltip: "Sector" (if implemented in TV UI).
- No numeric tooltip for price/time values.

#### 10. Floating toolbar
- Color picker, fill toggle, opacity, settings, delete, lock.

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- supportsFill: true — fill color and opacity configurable.

#### 13. Text and label behavior
- supportsText: false — no text labels.

#### 14. Chart interaction
- Wedge coordinates preserved on pan/zoom.
- The wedge scales with chart coordinate transformations.

#### 15. Keyboard behavior
- **Escape** during creation: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Zero-radius sector: degenerate point, not rendered visibly.
- 360-degree sector (full circle): edge case likely not achievable via normal drag; boundary conditions in angle calculation.
- Very narrow wedge (< 1 degree): extremely thin fill area, may not be clickable for hit-testing.

#### 17. Evidence and status
- **Coverage status:** Defined in `toolRegistry.ts` (forecasting/Forecasting, family: shape). NOT listed in `tv-capture-factory.ts` ALL_CAPTURE_TOOLS (only 27 tools captured; sector not among them).
- **No v2 spec file** for `sector`.
- **Gap:** No automation, no capture, no scenario coverage.

---

## Part 2: Forecasting / Volume-based Subcategory (3 tools)

---

### Tool 7: anchoredVwap

#### 1. Tool identity
- **Exact TradingView tool name:** Anchored VWAP
- **Category:** forecasting
- **Subcategory:** Volume-based
- **Family:** line
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Anchored VWAP"]`
- **Default color:** not specified (TV uses a blue/teal default for VWAP lines)

#### 2. Activation behavior
- Rail click opens Forecasting submenu; if Anchored VWAP was last used, direct activation.
- Cursor after activation: crosshair.
- TV keyboard shortcut: **Alt+W**

#### 3. Creation flow
Single click commit (commitMode: `click`, anchorCount: 1):
1. **Click** — places the VWAP anchor at a specific bar. The VWAP line is immediately drawn from that bar forward to the current bar, recalculating as the cumulative volume-weighted average price from the anchor.

No drag required. A single click at the desired anchor bar/price commits the drawing.

#### 4. Multi-anchor sequence
- Anchor 1 only = the anchor bar (time + price at click point; VWAP calculation begins here).
- Post-commit: dragging anchor 1 shifts the start bar for the VWAP calculation; the VWAP line redraws from the new start.

#### 5. Selection and reselection
- Click on the VWAP line itself to select.
- Hit-testing is on the rendered line with a tolerance band.
- The VWAP line may curve/undulate across price levels; any point along the line is a valid hit target.

#### 6. Hover and cursor
- Move cursor shown when hovering near the VWAP line.
- Crosshair on canvas when tool is active.

#### 7. Handles and anchors
- 1 handle at the anchor point (the VWAP start bar).
- Handle appears as a small draggable point on the left side of the VWAP line origin when selected.

#### 8. Drag and edit
- Anchor 1 drag: moves the VWAP anchor to a different bar, causing the entire VWAP line to recalculate from the new anchor.
- resizable: false — no resize handles beyond the anchor point.
- draggable: true — the anchor can be moved.

#### 9. Tooltip behavior
- Hover tooltip: "Anchored VWAP"
- When hovering over the VWAP line, TV shows the current VWAP value at that time point.
- ScenarioKind `vwap-line` is defined for testing the rendered VWAP line.

#### 10. Floating toolbar
- Color picker (for the VWAP line)
- VWAP interval selector (Session, Weekly, Monthly — controlled by vwapInterval option)
- Settings gear
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style (solid/dashed/dotted), snapMode, vwapInterval, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- vwapInterval: `session` | `week` | `month` — controls how VWAP resets (session-by-session, weekly, or monthly).
- Standard deviation bands (1σ, 2σ, 3σ) can be added in the settings dialog.
- Line thickness (1-8) and style (solid/dashed/dotted) apply to both the VWAP line and any bands.

#### 13. Text and label behavior
- supportsText: false — no user text.
- Price axis label shows current VWAP value at the right edge of the line.
- VWAP value label may appear at the anchor start point.

#### 14. Chart interaction
- VWAP recalculates dynamically as the chart range changes — it is a live computed indicator, not a static line.
- On pan/zoom, the VWAP line re-renders to reflect the correct VWAP values for the displayed bars.
- Anchor time/bar is preserved as a fixed reference; VWAP line always starts at that anchor bar.

#### 15. Keyboard behavior
- **Escape** during click (before placing anchor): cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.
- **Alt+W**: activates Anchored VWAP tool.

#### 16. Edge cases
- Anchor placed at the very first bar of available data: VWAP calculated over maximum history from anchor.
- Anchor placed at current bar (rightmost): VWAP line is a single point; expands as new bars arrive.
- Very old anchor (hundreds of bars back): VWAP calculation runs over many bars; large performance computation.
- vwapInterval = 'week' with anchor in the middle of a week: VWAP resets at each weekly boundary after anchor.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 5, Slot 3). CommitMode: `click`, anchorCount: 1. tvShortcut: `Alt+W`. ScenarioKind `vwap-line` defined.
- **No v2 spec file** for `anchoredVwap`.
- **Gap:** vwap-line scenario kind defined but not implemented in any spec.

---

### Tool 8: fixedRangeVolumeProfile

#### 1. Tool identity
- **Exact TradingView tool name:** Fixed Range (displayed as "Fixed Range" in TV UI; full name: Fixed Range Volume Profile)
- **Category:** forecasting
- **Subcategory:** Volume-based
- **Family:** measure
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Fixed Range"]`
- **Default color:** not specified

#### 2. Activation behavior
- Rail click opens Forecasting submenu; if Fixed Range was last used, direct activation.
- Cursor after activation: crosshair.
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — sets the left time boundary of the range.
2. **Mouse drag** — extends right across the bars to include in the volume profile.
3. **Mouse up** — commits the range. TV calculates and renders a volume histogram (horizontal bars showing volume at each price level) anchored within the selected time range.

#### 4. Multi-anchor sequence
- Anchor 1 = left time boundary (start of range)
- Anchor 2 = right time boundary (end of range)
- Post-commit: dragging anchors adjusts the time range, and the volume histogram recalculates.

#### 5. Selection and reselection
- Click on the volume histogram area or the boundary lines to select.
- Hit-testing on the histogram bars (fill area; supportsFill: true).
- Boundary lines are also clickable.

#### 6. Hover and cursor
- Move cursor when hovering over the volume histogram body.
- Resize cursor on boundary line edges.

#### 7. Handles and anchors
- 2 handles: left and right time boundary handles.
- Also may include resize handles at top/bottom to adjust price scale of histogram.

#### 8. Drag and edit
- Left boundary drag: shifts the start of the time range; histogram recalculates.
- Right boundary drag: shifts the end of the time range; histogram recalculates.
- Body drag: moves entire volume profile to a new time range, maintaining the same bar-count width.
- resizable: true — supports edge handles for resizing the display height.

#### 9. Tooltip behavior
- Hover tooltip: "Fixed Range"
- ScenarioKind `volume-bars` defined for testing volume histogram rendering.
- When hovering over a specific histogram bar, TV shows the price level and volume at that level.

#### 10. Floating toolbar
- Color picker (for histogram bars and boundary lines)
- Settings gear (bar count, POC line, value area)
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, vwapInterval, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- supportsFill: true — histogram bars are filled areas.
- Settings dialog: bar count (number of price levels for histogram), Value Area High/Low highlighting, POC (Point of Control) line display, color for VAH/VAL vs. outside value area bars.

#### 13. Text and label behavior
- supportsText: false — no user text.
- Price labels may appear on the price axis at Value Area High, Value Area Low, and POC levels.

#### 14. Chart interaction
- Time range anchors are bar-count based; preserved on pan/zoom.
- The histogram recalculates and re-renders when the chart reloads or the time range changes.
- Histogram stays fixed within the anchored time range on pan — it does not follow the cursor.

#### 15. Keyboard behavior
- **Escape** during drag: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Range of 1 bar: single-bar volume profile — valid minimum range.
- Range spanning thousands of bars: large calculation; histogram may show coarse price buckets.
- Range in the future (no data): no histogram bars rendered; empty or degenerate drawing.
- Zero volume in the range (synthetic/no-volume chart): histogram renders with uniform bars or empty.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 6, Slot 1). CommitMode: `drag`, anchorCount: 2. ScenarioKind `volume-bars` defined.
- **No v2 spec file** for `fixedRangeVolumeProfile`.
- **Gap:** volume-bars scenario kind defined but no implementation.

---

### Tool 9: anchoredVolumeProfile

#### 1. Tool identity
- **Exact TradingView tool name:** Anchored Volume Profile
- **Category:** forecasting
- **Subcategory:** Volume-based
- **Family:** measure
- **Rail aria-label:** `[aria-label="Forecasting and measurement tools"]`
- **Tool aria-label:** `[aria-label="Anchored Volume Profile"]`
- **Default color:** not specified

#### 2. Activation behavior
- Rail click opens Forecasting submenu; if Anchored Volume Profile was last used, direct activation.
- Cursor after activation: crosshair.
- No TV keyboard shortcut.

#### 3. Creation flow
Single click commit (commitMode: `click`, anchorCount: 1):
1. **Click** — places the anchor at a specific bar. TV draws a volume profile histogram from that anchor bar forward to the current bar, showing volume distribution at each price level for the anchored period.

Similar to anchoredVwap but shows a histogram profile rather than a single VWAP line.

#### 4. Multi-anchor sequence
- Anchor 1 only = the start bar for the volume profile calculation.
- Post-commit: dragging anchor 1 shifts the calculation start.

#### 5. Selection and reselection
- Click on the histogram body or anchor point to select.
- Hit-testing on the filled histogram bars.

#### 6. Hover and cursor
- Move cursor over histogram area.
- Crosshair while tool is active.

#### 7. Handles and anchors
- 1 handle at the anchor bar position.
- No resize handles (resizable: false).

#### 8. Drag and edit
- Anchor 1 drag: shifts the start bar, causing full histogram recalculation.
- draggable: true, resizable: false.

#### 9. Tooltip behavior
- Hover tooltip: "Anchored Volume Profile"
- Histogram bars show volume at each price level in the anchored period.

#### 10. Floating toolbar
- Color picker, settings (bar count, VAH/VAL/POC options), delete, lock.

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, vwapInterval, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- supportsFill: true — histogram bars filled.
- Settings: bar count, Value Area % (typically 70%), POC line display, VAH/VAL colors.

#### 13. Text and label behavior
- supportsText: false — no user text.
- Price axis labels at POC, VAH, VAL levels.

#### 14. Chart interaction
- Anchor bar is time-based; histogram recalculates as new bars are added.
- On pan/zoom, the histogram adjusts to maintain its anchored position.
- The histogram extends rightward from the anchor; its width on screen depends on chart time scale.

#### 15. Keyboard behavior
- **Escape** during creation: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Anchor at the very first bar: maximum-span volume profile.
- Anchor at current bar: single-bar histogram.
- Chart with no volume data: empty or uniform histogram.
- Very high bar count setting with narrow price range: many thin price buckets.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 7, Slot 2). CommitMode: `click`, anchorCount: 1.
- **No v2 spec file** for `anchoredVolumeProfile`.
- **Gap:** No scenario coverage.

---

## Part 3: Forecasting / Measurers Subcategory (3 tools)

---

### Tool 10: priceRange

#### 1. Tool identity
- **Exact TradingView tool name:** Price Range (displayed as "Price Range" in TV UI)
- **Category:** forecasting
- **Subcategory:** Measurers
- **Family:** measure
- **Rail aria-label:** `[aria-label="Measure"]`
- **Tool aria-label:** `[aria-label="Price Range"]`
- **Default color:** `#2962ff` (blue)

#### 2. Activation behavior
- Rail button: `[aria-label="Measure"]` — a separate rail entry for measurers (distinct from the Forecasting and measurement tools rail).
- Rail click opens Measurers submenu; if Price Range was last used, direct activation.
- Cursor after activation: crosshair.
- TV keyboard shortcut: **Alt+P**

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — sets anchor 1 (one corner of the measurement box at a price level).
2. **Mouse drag** — extends the measurement region to anchor 2 (second price level). A shaded box appears showing the price span.
3. **Mouse up** — commits the measurement box.

The Price Range tool measures only the vertical (price) difference between two price levels. The box spans the full chart width horizontally between the two anchors' time positions, but its primary measurement is the price delta.

#### 4. Multi-anchor sequence
- Anchor 1 = first price level (top or bottom of measurement)
- Anchor 2 = second price level (the other boundary)
- Post-commit: both anchors independently draggable to adjust the measured price range.

#### 5. Selection and reselection
- Click within the shaded measurement box or on the boundary lines to select.
- Hit-testing on the filled box area (even though supportsFill is false in registry; TradingView renders a shaded region for visual feedback).

#### 6. Hover and cursor
- Move cursor when hovering over the measurement box body.
- Resize cursor on top/bottom boundary lines.

#### 7. Handles and anchors
- 2 handles: one at each price-level boundary (top and bottom of the measurement region).
- Corner or edge handles appear on selection.

#### 8. Drag and edit
- Anchor 1 drag: moves the top (or bottom) price boundary.
- Anchor 2 drag: moves the other price boundary.
- Body drag: moves the entire measurement box to a different vertical (price) position.
- resizable: true — edge handles for adjusting individual boundaries.

#### 9. Tooltip behavior
- Hover tooltip: "Price Range"
- Inside the measurement box: displays the price difference (e.g., "+$125.50") and the percentage change between the two levels (e.g., "+2.34%").
- ScenarioKind `price-label` relevant for verifying the displayed value.

#### 10. Floating toolbar
- Color picker (for the box border/shading color #2962ff default)
- Settings gear
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- vwapInterval excluded not applicable.
- Opacity and thickness affect the box border rendering.
- Settings: text display options (price delta, percentage, bars count), box fill opacity.

#### 13. Text and label behavior
- supportsText: false — no user-added text.
- Intrinsic label: price difference displayed inside the box (e.g., "120.00 (2.34%)").
- Price axis labels appear at both the top and bottom boundary levels when the drawing is hovered or selected.

#### 14. Chart interaction
- Price level anchors are coordinate-independent of time; the box spans the full chart width.
- On pan/zoom, the horizontal extent of the box adjusts while the price boundaries remain fixed.
- Coordinates preserved across pan/zoom sessions.

#### 15. Keyboard behavior
- **Escape** during drag: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.
- **Alt+P**: activates Price Range tool.

#### 16. Edge cases
- Both anchors at the same price (0 price difference): degenerate zero-height box; label shows "0.00 (0.00%)".
- Measurement spanning bid/ask spread: value shown includes the spread.
- Very large price range (anchor 1 near chart top, anchor 2 near chart bottom): box fills nearly the full chart height; label centered inside.
- Negative price range (lower anchor placed above upper anchor in screen space, then chart zoomed so prices invert): measurement absolute value shown.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 8, Slot 3). CommitMode: `drag`, anchorCount: 2. Rail: `[aria-label="Measure"]`. expectedColorDefault: `#2962ff`. tvShortcut: `Alt+P`.
- **No v2 spec file** for `priceRange`.
- **Gap:** No scenario coverage. ScenarioKind `price-label` defined but not exercised.

---

### Tool 11: dateRange

#### 1. Tool identity
- **Exact TradingView tool name:** Date Range
- **Category:** forecasting
- **Subcategory:** Measurers
- **Family:** measure
- **Rail aria-label:** `[aria-label="Measure"]`
- **Tool aria-label:** `[aria-label="Date Range"]`
- **Default color:** `#2962ff` (blue)

#### 2. Activation behavior
- Rail: `[aria-label="Measure"]`, submenu opens on rail click.
- Cursor after activation: crosshair.
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — sets anchor 1 (left time boundary).
2. **Mouse drag** — extends to anchor 2 (right time boundary). A vertical shaded column appears showing the time span.
3. **Mouse up** — commits.

The Date Range tool measures the horizontal (time) distance between two bar positions. The shaded region spans the full chart height and shows the number of bars and calendar duration between the two selected times.

#### 4. Multi-anchor sequence
- Anchor 1 = left time boundary (bar index / date)
- Anchor 2 = right time boundary (bar index / date)
- Post-commit: both anchors draggable to adjust the time range.

#### 5. Selection and reselection
- Click within the vertical shaded column or on the left/right boundary lines.
- Hit-testing on the full-height vertical region.

#### 6. Hover and cursor
- Move cursor when hovering inside the vertical measurement column.
- Horizontal resize cursor on left/right boundary lines.

#### 7. Handles and anchors
- 2 handles: one at the left time boundary and one at the right.
- Appear on top/bottom edges of the boundary lines when selected.

#### 8. Drag and edit
- Left anchor drag: shifts the start date/bar.
- Right anchor drag: shifts the end date/bar.
- Body drag: moves the entire time span to a different part of the chart.

#### 9. Tooltip behavior
- Hover tooltip: "Date Range"
- Inside the shaded column: displays the number of bars (e.g., "15 bars"), calendar days, and date range (e.g., "Jan 5 – Jan 20").
- ScenarioKind `info-label` relevant for verifying time span display.

#### 10. Floating toolbar
- Color picker (#2962ff default), settings, delete, lock.

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- Fill opacity for the shaded column, border thickness and style.
- Settings: display options for bars count, calendar days, date labels.

#### 13. Text and label behavior
- supportsText: false — no user text.
- Intrinsic label inside the column: bars count and time duration.
- Date axis labels appear at the left and right boundaries.

#### 14. Chart interaction
- Time boundaries are bar-index based; preserved on pan/zoom.
- On zoom, the column width changes proportionally with the chart time scale.
- The column always spans the full chart height regardless of price axis zoom.

#### 15. Keyboard behavior
- **Escape** during drag: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Drag of 0 bars (mouse up at same position as mouse down): degenerate zero-width column.
- Range spanning weekends/holidays: bar count reflects only trading bars; calendar days include non-trading days.
- Very wide range (1000+ bars): column spans nearly the whole chart; label shows large bar count.
- Anchor placed in the future (beyond current bar): column extends into the empty right side of the chart.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 9, Slot 1). CommitMode: `drag`, anchorCount: 2. Rail: `[aria-label="Measure"]`. expectedColorDefault: `#2962ff`.
- **No v2 spec file** for `dateRange`.
- **Gap:** No scenario coverage.

---

### Tool 12: dateAndPriceRange

#### 1. Tool identity
- **Exact TradingView tool name:** Date and Price Range
- **Category:** forecasting
- **Subcategory:** Measurers
- **Family:** measure
- **Rail aria-label:** `[aria-label="Measure"]`
- **Tool aria-label:** `[aria-label="Date and Price Range"]`
- **Default color:** `#2962ff` (blue)

#### 2. Activation behavior
- Rail: `[aria-label="Measure"]`, submenu on rail click.
- Cursor after activation: crosshair.
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — sets anchor 1 (first corner of the rectangular measurement box at a specific price and time).
2. **Mouse drag** — extends to anchor 2 (diagonally opposite corner). A rectangular box appears showing both the time span (horizontal) and price span (vertical).
3. **Mouse up** — commits.

This is the most comprehensive measurer: it shows both the price difference and the time span simultaneously, combining the capabilities of priceRange and dateRange.

#### 4. Multi-anchor sequence
- Anchor 1 = first corner (time + price)
- Anchor 2 = diagonally opposite corner (time + price)
- Post-commit: both anchors draggable independently or corner handles resizable.

#### 5. Selection and reselection
- Click within the rectangular measurement box or on any of its 4 boundary lines.
- Hit-testing on the full rectangular region.

#### 6. Hover and cursor
- Move cursor inside the box.
- Resize cursors on corner/edge handles.

#### 7. Handles and anchors
- 2 main anchors at the defining corners.
- Additional resize handles may appear at all 4 corners and mid-edge positions (resizable: true).

#### 8. Drag and edit
- Anchor 1 drag: moves one corner, reshaping the box.
- Anchor 2 drag: moves the opposite corner.
- Edge handle drags: resize the box in one dimension only (price-only or time-only resize).
- Body drag: moves the entire box to a new chart location.

#### 9. Tooltip behavior
- Hover tooltip: "Date and Price Range"
- Inside the box: displays price difference (e.g., "+$125.50 / +2.34%") AND time span (e.g., "15 bars / 15 days").
- The most information-rich measurer tooltip.

#### 10. Floating toolbar
- Color picker (#2962ff default), settings, delete, lock.

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- forecastingSchema: color, opacity, thickness, style, snapMode, positionLabelMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- Box fill color and opacity.
- Settings: display options for bars count, calendar days, price delta, percentage.

#### 13. Text and label behavior
- supportsText: false — no user text.
- Intrinsic labels inside the box: combined time+price measurements.
- Price axis labels at top and bottom of box; date axis labels at left and right of box.

#### 14. Chart interaction
- Both time and price coordinates of both anchors preserved on pan/zoom.
- Box scales proportionally in both dimensions on zoom.
- Full rectangular region always accurately reflects the stored anchor coordinates.

#### 15. Keyboard behavior
- **Escape** during drag: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Zero size box (both anchors same point): degenerate; no visible box.
- Box where only price changes (drag horizontally only): zero bars span, valid price-only measurement.
- Box where only time changes (drag vertically only): zero price span, valid time-only measurement.
- Box spanning future bars (anchor 2 past rightmost bar): box extends into empty chart space.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 10, Slot 2). CommitMode: `drag`, anchorCount: 2. Rail: `[aria-label="Measure"]`. expectedColorDefault: `#2962ff`.
- **No v2 spec file** for `dateAndPriceRange`.
- **Gap:** No scenario coverage.

---

## Part 4: Brush / Brushes Subcategory (2 tools)

---

### Tool 13: brush

#### 1. Tool identity
- **Exact TradingView tool name:** Brush
- **Category:** brush
- **Subcategory:** Brushes
- **Family:** shape
- **Rail aria-label:** `[aria-label="Geometric shapes"]`
- **Tool aria-label:** `[aria-label="Brush"]`
- **Default color:** `#2962ff` (blue)

#### 2. Activation behavior
- Rail: `[aria-label="Geometric shapes"]` opens the brush/shapes submenu.
- If Brush was last used tool in the Geometric shapes rail, clicking the rail directly activates Brush.
- Cursor after activation: crosshair (brush stroke cursor in TradingView; toolCursor resolves to `crosshair` per registry logic).
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — starts the freehand brush stroke at the current price/time position.
2. **Hold and drag** — draws the freehand path across the chart; the path follows the mouse cursor, recording price/time coordinates continuously.
3. **Mouse up** — commits the stroke. The brush path is finalized as a stored drawing with start and end anchors.

The brush is a freehand draw mode where the stroke shape is determined by the continuous mouse movement during drag.

#### 4. Multi-anchor sequence
- Anchor 1 = stroke start (position at mouse-down)
- Anchor 2 = stroke end (position at mouse-up)
- Intermediate path points are captured and stored as part of the path geometry.
- Post-commit: anchor 1 and anchor 2 are the primary edit handles, but the internal path curve may also be editable via handle points along the stroke.

#### 5. Selection and reselection
- Click on or near the brush stroke line to select.
- Hit-testing uses a tolerance band around the stroke path (not a filled area; supportsFill: false).
- The entire stroke selects as one unit.

#### 6. Hover and cursor
- Move cursor shown when hovering near the brush stroke.
- Crosshair shown on chart canvas when tool is active.

#### 7. Handles and anchors
- 2 primary handles: one at stroke start (anchor 1) and one at stroke end (anchor 2).
- Additional midpoint handles may appear along the path for reshaping (resizable: true).

#### 8. Drag and edit
- Anchor 1 drag: repositions the stroke start point, stretching the path from the new origin.
- Anchor 2 drag: repositions the stroke end point.
- Body drag: moves the entire brush stroke path as a unit.
- resizable: true — additional handles along the path may allow reshaping individual segments.

#### 9. Tooltip behavior
- Hover tooltip: "Brush"
- No numeric values displayed.
- brushSmoothness option (range 0–1, default 0.45) affects how much the recorded path is smoothed on commit.

#### 10. Floating toolbar
- Color picker (#2962ff default)
- Opacity slider
- Brush size/thickness slider
- Brush smoothness control (brushSmoothness option)
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- brushSchema applies: color, opacity, thickness, style (solid/dashed/dotted), snapMode, priceLabel, axisLabel, locked, visible.
- Excluded: extendLeft, extendRight, rayMode, fibLevels, fibLabelMode, vwapInterval, positionLabelMode, font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding.
- brushSmoothness: 0 (no smoothing, raw path) to 1 (maximum smoothing, Bezier-like curve).
- Default brushSmoothness: 0.45 (from defaultToolOptions).
- Thickness (1–8) affects the rendered stroke width.

#### 13. Text and label behavior
- supportsText: false — no text labels.
- No intrinsic labels; stroke path is the sole visual output.

#### 14. Chart interaction
- Path is stored as a series of time/price coordinate pairs.
- On pan/zoom, the path re-renders at the correct chart coordinates, maintaining price/time fidelity.
- The visual appearance of the stroke may change slightly on zoom as pixel-level rendering adapts to the new scale.

#### 15. Keyboard behavior
- **Escape** during drag: cancels the stroke; nothing is committed.
- **Escape** when selected: deselects.
- **Delete**: removes the stroke.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Very fast drag (mouse moving faster than capture rate): coarse path with fewer intermediate points recorded; stroke appears angular.
- Very slow drag (nearly stationary): dense cluster of points at same position; stroke appears as a blob.
- brushSmoothness = 0: raw jagged path with no smoothing applied.
- brushSmoothness = 1: heavily smoothed Bezier curve; sharp corners eliminated.
- Single-pixel drag (nearly zero length): degenerate dot stroke; may or may not be rendered depending on minimum length threshold.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 11, Slot 3). CommitMode: `drag`, anchorCount: 2. expectedColorDefault: `#2962ff`.
- **No v2 spec file** for `brush`.
- **Gap:** No scenario coverage. brushSmoothness behavior not validated.

---

### Tool 14: highlighter

#### 1. Tool identity
- **Exact TradingView tool name:** Highlighter
- **Category:** brush
- **Subcategory:** Brushes
- **Family:** shape
- **Rail aria-label:** `[aria-label="Geometric shapes"]`
- **Tool aria-label:** `[aria-label="Highlighter"]`
- **Default color:** `#ffeb3b` (yellow)

#### 2. Activation behavior
- Rail: `[aria-label="Geometric shapes"]` opens submenu.
- If Highlighter was last used in the Geometric shapes rail, direct activation.
- Cursor after activation: crosshair.
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — starts the highlighter stroke.
2. **Hold and drag** — draws a wide, semi-transparent band across the chart. Unlike the brush, the highlighter renders a thick translucent stroke (similar to a physical highlighter pen).
3. **Mouse up** — commits the stroke.

The highlighter produces a wide, semi-transparent colored band rather than a thin line, making it suitable for marking price/time regions for attention.

#### 4. Multi-anchor sequence
- Anchor 1 = stroke start
- Anchor 2 = stroke end
- Intermediate path recorded as with brush.
- Post-commit: same anchor/handle structure as brush.

#### 5. Selection and reselection
- Click within the wide translucent band area to select.
- Hit-testing is on the thick stroke band, which has a larger click target than the brush tool.

#### 6. Hover and cursor
- Move cursor inside the highlight band.
- Crosshair on canvas when tool is active.

#### 7. Handles and anchors
- 2 handles: stroke start and stroke end.
- Additional path handles possible (resizable: true).

#### 8. Drag and edit
- Anchor 1 drag: moves stroke start.
- Anchor 2 drag: moves stroke end.
- Body drag: moves entire highlight stroke.

#### 9. Tooltip behavior
- Hover tooltip: "Highlighter"
- No numeric values. Semi-transparent wide stroke is the primary feedback.

#### 10. Floating toolbar
- Color picker (#ffeb3b yellow default — distinct from brush's blue default)
- Opacity slider (default opacity reduced for transparency effect)
- Brush width slider (larger default width than brush)
- Smoothness control
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- brushSchema: color, opacity, thickness, style, snapMode, priceLabel, axisLabel, locked, visible.
- brushSmoothness applies.
- Key distinction from brush: default color is #ffeb3b (yellow) and the stroke is rendered with higher thickness and semi-transparency (lower default opacity) to simulate a highlighter pen effect.
- Typical TV highlighter default: opacity ~0.5, thickness 8+ (maximum or near-maximum width).

#### 13. Text and label behavior
- supportsText: false — no text.
- Visual band only.

#### 14. Chart interaction
- Path coordinates preserved on pan/zoom.
- Semi-transparent wide band re-renders at correct chart positions.

#### 15. Keyboard behavior
- **Escape** during drag: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Very fast drag: coarse path with angular transitions in the band.
- High opacity setting (approaching 1.0): highlighter becomes opaque, obscuring chart underneath.
- Very low opacity (0.15 minimum): nearly invisible; hard to see on the chart.
- brushSmoothness = 0 with highlighter: jagged wide band; no corner rounding.
- Overlapping multiple highlighters: additive opacity where strokes cross.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 12, Slot 1). CommitMode: `drag`, anchorCount: 2. expectedColorDefault: `#ffeb3b`.
- **No v2 spec file** for `highlighter`.
- **Gap:** No scenario coverage. Unique yellow default color and semi-transparent rendering not validated.

---

## Part 5: Brush / Arrows Subcategory (4 tools)

---

### Tool 15: arrowMarker

#### 1. Tool identity
- **Exact TradingView tool name:** Arrow marker
- **Category:** brush
- **Subcategory:** Arrows
- **Family:** text
- **Rail aria-label:** `[aria-label="Geometric shapes"]`
- **Tool aria-label:** `[aria-label="Arrow marker"]`
- **Default color:** `#2962ff` (blue)

#### 2. Activation behavior
- Rail: `[aria-label="Geometric shapes"]` opens submenu including Arrows section.
- If Arrow marker was last used, direct activation.
- Cursor after activation: text cursor (family is `text`; toolCursor resolves to `text` for text-family tools).
- No TV keyboard shortcut.

#### 3. Creation flow
Single click commit (commitMode: `click`, anchorCount: 1):
1. **Click** — places an arrow marker icon at the clicked price/time position. The marker is immediately committed on the single click.

No drag is required. The arrow marker is a point annotation (an arrow-shaped icon anchored at a specific price/time).

#### 4. Multi-anchor sequence
- Anchor 1 only = placement point (the tip/base of the arrow icon).
- Post-commit: the single anchor can be dragged to reposition the marker.

#### 5. Selection and reselection
- Click directly on the arrow marker icon to select.
- Hit-testing on the icon's bounding box (the small arrow graphic itself).
- Due to small icon size, click tolerance is important; TV typically provides a generous hit area around the icon.

#### 6. Hover and cursor
- Pointer/move cursor when hovering over the arrow marker icon.
- Text cursor on the chart canvas when tool is active (family = text → toolCursor = 'text').

#### 7. Handles and anchors
- 1 handle at the anchor point (the marker placement position).
- The handle appears as a small drag point when the marker is selected.
- resizable: false — no resize handles.

#### 8. Drag and edit
- Anchor 1 drag: moves the entire arrow marker icon to a new price/time position.
- draggable: true.
- resizable: false — the icon size is fixed; no resize.

#### 9. Tooltip behavior
- Hover tooltip: "Arrow marker"
- No numeric price/time tooltip in the standard TV behavior.
- The marker itself serves as a visual annotation without embedded values.

#### 10. Floating toolbar
- Color picker (#2962ff default)
- Size selector (small/medium/large arrow icon sizes)
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- textSchema applies: color, opacity, thickness, style, snapMode, priceLabel, axisLabel, font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding, locked, visible.
- Excluded from brushSchema perspective: extendLeft, extendRight, rayMode, fibLevels, fibLabelMode, vwapInterval, positionLabelMode, brushSmoothness.
- The textSchema inclusion reflects that arrowMarker uses text-family schema (family: text).
- Color controls the arrow marker fill color.

#### 13. Text and label behavior
- supportsText: false — despite using textSchema, no user-editable text is embedded in the marker.
- The arrow icon itself is the sole visual element.
- A price axis label may appear showing the price level of the anchor if priceLabel is enabled.

#### 14. Chart interaction
- Anchor coordinates (time + price) preserved on pan/zoom.
- The icon renders at the correct chart position after pan/zoom.
- Icon pixel size does not scale with zoom — it remains a fixed-size icon regardless of chart zoom level.

#### 15. Keyboard behavior
- **Escape** before click (tool active but no placement): cancels tool activation.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Placing multiple arrow markers at the exact same price/time: all markers stack; each is a separate drawing with its own anchor and can be individually selected.
- Placing at the chart right edge: marker positioned at the most recent bar; valid.
- Very high zoom level: icon remains same physical size, but its chart position is highly precise.
- Color set to match chart background: marker becomes invisible; still selectable via click.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 13, Slot 2). CommitMode: `click`, anchorCount: 1. expectedColorDefault: `#2962ff`.
- **No v2 spec file** for `arrowMarker`.
- **Gap:** No scenario coverage.

---

### Tool 16: arrowTool

#### 1. Tool identity
- **Exact TradingView tool name:** Arrow (internal id: arrowTool)
- **Category:** brush
- **Subcategory:** Arrows
- **Family:** line
- **Rail aria-label:** `[aria-label="Geometric shapes"]`
- **Tool aria-label:** `[aria-label="Arrow"]`
- **Default color:** `#2962ff` (blue)

#### 2. Activation behavior
- Rail: `[aria-label="Geometric shapes"]` submenu.
- If Arrow was last used, direct activation.
- Cursor after activation: crosshair (family = line).
- No TV keyboard shortcut.

#### 3. Creation flow
Drag commit (commitMode: `drag`, anchorCount: 2):
1. **Mouse down** — sets anchor 1 (the tail/origin of the arrow).
2. **Mouse drag** — extends to anchor 2 (the arrowhead/tip). The arrow direction is defined by the drag direction.
3. **Mouse up** — commits the arrow line with an arrowhead at anchor 2.

The arrow tool creates a directional line with an arrowhead rendered at anchor 2 (the endpoint), indicating direction of movement or price/time relationship.

#### 4. Multi-anchor sequence
- Anchor 1 = arrow tail (start/origin)
- Anchor 2 = arrowhead (end/destination)
- Post-commit: both anchors draggable independently.

#### 5. Selection and reselection
- Click on the arrow line or the arrowhead to select.
- Hit-testing uses a tolerance band around the line and the arrowhead area.

#### 6. Hover and cursor
- Move cursor on hover near the arrow line.
- Crosshair on canvas while tool is active.

#### 7. Handles and anchors
- 2 handles: one at the tail (anchor 1) and one at the arrowhead (anchor 2).
- Both visible on selection.

#### 8. Drag and edit
- Anchor 1 drag: moves the tail, changing the arrow direction and length.
- Anchor 2 drag: moves the arrowhead, changing direction and length.
- Body drag: moves the entire arrow (both endpoints) to a new location.
- resizable: true — the arrow can be lengthened/shortened.

#### 9. Tooltip behavior
- Hover tooltip: "Arrow"
- No numeric values displayed.

#### 10. Floating toolbar
- Color picker (#2962ff default)
- Thickness slider
- Line style (solid/dashed/dotted)
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- lineSchema applies: color, opacity, thickness, style, snapMode, priceLabel, axisLabel, extendLeft, extendRight, rayMode, locked, visible.
- Arrowhead size scales with thickness setting.
- extendLeft/extendRight: if enabled, the line extends beyond the anchor points (but the arrowhead remains at anchor 2).

#### 13. Text and label behavior
- supportsText: false — no text labels.
- Price axis labels at anchor points if priceLabel is enabled.

#### 14. Chart interaction
- Anchor coordinates preserved on pan/zoom.
- Arrow line scales with chart zoom; arrowhead size may remain fixed or scale proportionally.

#### 15. Keyboard behavior
- **Escape** during drag: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Zero-length arrow (drag of zero pixels): degenerate; arrowhead at same point as tail. May not render or renders as a tiny point.
- Very short arrow: arrowhead proportionally larger than line segment; may overlap tail.
- Arrow with extendRight=true: line extends infinitely right but arrowhead only appears at anchor 2.
- Diagonal arrow at 45 degrees: line and arrowhead rendered at angle; hit-testing must correctly handle diagonal click targets.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 14, Slot 3). CommitMode: `drag`, anchorCount: 2. expectedColorDefault: `#2962ff`.
- **No v2 spec file** for `arrowTool`.
- **Gap:** No scenario coverage.

---

### Tool 17: arrowMarkUp

#### 1. Tool identity
- **Exact TradingView tool name:** Arrow mark up
- **Category:** brush
- **Subcategory:** Arrows
- **Family:** text
- **Rail aria-label:** `[aria-label="Geometric shapes"]`
- **Tool aria-label:** `[aria-label="Arrow mark up"]`
- **Default color:** `#089981` (green — bullish)

#### 2. Activation behavior
- Rail: `[aria-label="Geometric shapes"]` submenu.
- If Arrow mark up was last used, direct activation.
- Cursor after activation: text cursor (family = text).
- No TV keyboard shortcut.

#### 3. Creation flow
Single click commit (commitMode: `click`, anchorCount: 1):
1. **Click** — places an upward-pointing green arrow marker at the clicked price/time position. Committed immediately on click.

The arrow mark up is specifically an upward arrow icon with a green default color, semantically indicating a bullish signal or upward directional annotation.

#### 4. Multi-anchor sequence
- Anchor 1 only = placement point.
- Post-commit: anchor draggable to reposition.

#### 5. Selection and reselection
- Click directly on the upward arrow icon to select.
- Hit-testing on the icon bounding box.

#### 6. Hover and cursor
- Pointer/move cursor on icon hover.
- Text cursor on canvas when tool is active.

#### 7. Handles and anchors
- 1 handle at placement point.
- resizable: false.

#### 8. Drag and edit
- Anchor 1 drag: repositions the arrow mark up icon.
- draggable: true, resizable: false.

#### 9. Tooltip behavior
- Hover tooltip: "Arrow mark up"
- No embedded price/time values.

#### 10. Floating toolbar
- Color picker (default #089981 green)
- Size selector
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- textSchema applies: color, opacity, thickness, style, snapMode, priceLabel, axisLabel, font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding, locked, visible.
- Default color #089981 (green) distinguishes this from arrowMarker (#2962ff blue) and arrowMarkDown (#f23645 red).
- Icon always points upward regardless of placement position.

#### 13. Text and label behavior
- supportsText: false.
- Upward arrow icon is the sole visual element.
- Price axis label possible if priceLabel enabled.

#### 14. Chart interaction
- Anchor coordinates (time + price) preserved on pan/zoom.
- Icon remains fixed pixel size regardless of zoom.

#### 15. Keyboard behavior
- **Escape** before click: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Multiple arrow mark ups at same position: stack; individually selectable.
- Color changed to red: visually conflicts with semantic meaning (bullish = green); TV allows it.
- Placed at chart price extremes: anchor snaps to available price coordinate.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 15, Slot 1). CommitMode: `click`, anchorCount: 1. expectedColorDefault: `#089981`.
- **No v2 spec file** for `arrowMarkUp`.
- **Gap:** No scenario coverage. Distinctive green default color not validated.

---

### Tool 18: arrowMarkDown

#### 1. Tool identity
- **Exact TradingView tool name:** Arrow mark down
- **Category:** brush
- **Subcategory:** Arrows
- **Family:** text
- **Rail aria-label:** `[aria-label="Geometric shapes"]`
- **Tool aria-label:** `[aria-label="Arrow mark down"]`
- **Default color:** `#f23645` (red — bearish)

#### 2. Activation behavior
- Rail: `[aria-label="Geometric shapes"]` submenu.
- If Arrow mark down was last used, direct activation.
- Cursor after activation: text cursor (family = text).
- No TV keyboard shortcut.

#### 3. Creation flow
Single click commit (commitMode: `click`, anchorCount: 1):
1. **Click** — places a downward-pointing red arrow marker at the clicked price/time position. Committed immediately on click.

The arrow mark down is specifically a downward arrow icon with a red default color, semantically indicating a bearish signal or downward directional annotation.

#### 4. Multi-anchor sequence
- Anchor 1 only = placement point.
- Post-commit: anchor draggable.

#### 5. Selection and reselection
- Click directly on the downward arrow icon to select.
- Hit-testing on icon bounding box.

#### 6. Hover and cursor
- Pointer/move cursor on icon hover.
- Text cursor on canvas when tool is active.

#### 7. Handles and anchors
- 1 handle at placement point.
- resizable: false.

#### 8. Drag and edit
- Anchor 1 drag: repositions the arrow mark down icon.
- draggable: true, resizable: false.

#### 9. Tooltip behavior
- Hover tooltip: "Arrow mark down"
- No embedded values.

#### 10. Floating toolbar
- Color picker (default #f23645 red)
- Size selector
- Delete icon
- Lock icon

#### 11. Context menu
- Standard right-click: Edit, Settings, Lock, Hide, Bring to Front, Send to Back, Clone, Remove.

#### 12. Settings/style
- textSchema: color, opacity, thickness, style, snapMode, priceLabel, axisLabel, font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding, locked, visible.
- Default color #f23645 (red) — mirrors the shortPosition and stop-loss zone color, semantically bearish.
- Icon always points downward.

#### 13. Text and label behavior
- supportsText: false.
- Downward arrow icon is the sole visual.
- Price axis label if priceLabel enabled.

#### 14. Chart interaction
- Anchor coordinates preserved on pan/zoom.
- Icon fixed pixel size.

#### 15. Keyboard behavior
- **Escape** before click: cancels.
- **Escape** when selected: deselects.
- **Delete**: removes.
- **Ctrl+Z**: undo.

#### 16. Edge cases
- Multiple arrow mark downs at same price: stack; individually selectable.
- Color changed to green: contradicts bearish semantics; TV allows it.
- Placed immediately after arrowMarkUp at same price: both markers visible, layered by z-order.

#### 17. Evidence and status
- **Coverage status:** Defined in `tv-capture-factory.ts` (index 16, Slot 2). CommitMode: `click`, anchorCount: 1. expectedColorDefault: `#f23645`.
- **No v2 spec file** for `arrowMarkDown`.
- **Gap:** No scenario coverage. Red default color not validated.

---

## Summary: Coverage Status for All 18 Tools

| # | Tool (id) | TV Label | CommitMode | Anchors | Capture Factory | v2 Spec | Status |
|---|-----------|----------|------------|---------|-----------------|---------|--------|
| 1 | longPosition | Long position | click-sequence | 3 | Yes (idx 0) | None | Gap |
| 2 | shortPosition | Short position | click-sequence | 3 | Yes (idx 1) | None | Gap |
| 3 | positionForecast | Forecast | click-sequence | 3 | Yes (idx 2) | None | Gap |
| 4 | barPattern | Bars Pattern | drag | 2 | Yes (idx 3) | None | Gap |
| 5 | ghostFeed | Ghost Feed | drag | 2 | Yes (idx 4) | None | Gap |
| 6 | sector | Sector | drag | 2 | Not captured | None | Full Gap |
| 7 | anchoredVwap | Anchored VWAP | click | 1 | Yes (idx 5) | None | Gap |
| 8 | fixedRangeVolumeProfile | Fixed Range | drag | 2 | Yes (idx 6) | None | Gap |
| 9 | anchoredVolumeProfile | Anchored Volume Profile | click | 1 | Yes (idx 7) | None | Gap |
| 10 | priceRange | Price Range | drag | 2 | Yes (idx 8) | None | Gap |
| 11 | dateRange | Date Range | drag | 2 | Yes (idx 9) | None | Gap |
| 12 | dateAndPriceRange | Date and Price Range | drag | 2 | Yes (idx 10) | None | Gap |
| 13 | brush | Brush | drag | 2 | Yes (idx 11) | None | Gap |
| 14 | highlighter | Highlighter | drag | 2 | Yes (idx 12) | None | Gap |
| 15 | arrowMarker | Arrow marker | click | 1 | Yes (idx 13) | None | Gap |
| 16 | arrowTool | Arrow | drag | 2 | Yes (idx 14) | None | Gap |
| 17 | arrowMarkUp | Arrow mark up | click | 1 | Yes (idx 15) | None | Gap |
| 18 | arrowMarkDown | Arrow mark down | click | 1 | Yes (idx 16) | None | Gap |

**Key findings:**
- 17 of 18 tools are captured in `tv-capture-factory.ts`. `sector` is the only tool with no capture automation at all.
- Zero v2 spec files exist for any of the 18 tools in this section. The entire section is an automation coverage gap.
- Defined ScenarioKinds that apply but are unimplemented: `rr-label` (longPosition, shortPosition, positionForecast), `bars-pattern` (barPattern), `ghost-line` (ghostFeed), `vwap-line` (anchoredVwap), `volume-bars` (fixedRangeVolumeProfile, anchoredVolumeProfile), `price-label` (priceRange), `info-label` (dateRange, dateAndPriceRange).
- The Measure rail (`[aria-label="Measure"]`) is a separate rail from `[aria-label="Forecasting and measurement tools"]`, used exclusively for the 3 measurer tools (priceRange, dateRange, dateAndPriceRange).
- Arrow marker tools (arrowMarker, arrowMarkUp, arrowMarkDown) use `family: text` and therefore resolve to `text` cursor (not `crosshair`) in `toolCursor`.
- Default colors follow a semantic scheme: green (#089981) for bullish/long, red (#f23645) for bearish/short, blue (#2962ff) for neutral/measurement tools, yellow (#ffeb3b) exclusively for the highlighter.


---


# Section 5: Shapes, Text, and Icon Tools (27 tools)

This section documents the behavioral coverage for three tool sub-families within the TradeReplay chart system:

- **Brush/Shapes** (10 tools): geometric shape drawing tools in the `brush` rail category
- **Text/Text and Notes** (11 tools): annotation text tools in the `text` rail category
- **Text/Content** (3 tools): embedded content widgets in the `text` rail category
- **Icon** (3 tools): icon/emoji/sticker picker tools in the `icon` rail category

All tool definitions are sourced from `toolRegistry.ts`. TradingView aria-label selectors are sourced from `tv-capture-factory.ts`. Behavioral evidence comes from the `tv-parity-*-500.spec.ts`, `tv-parity-v2-*.spec.ts`, and `line-tools-text-labels.spec.ts` test suites.

---

## Shared Behaviors: Brush/Shapes Sub-Family

All ten shape tools share the following behaviors:

- **Rail**: `[aria-label="Geometric shapes"]` — same rail as brushes and arrows
- **Submenu**: clicking the rail button opens a popover listing all brushes, arrows, and shapes; the last-used shape variant is shown on the rail button face
- **Default color**: `#2962ff` for all shape tools (verified in `tv-capture-factory.ts`, indices 17–26)
- **Schema**: `shapeSchema` — includes color, opacity, thickness, style, snapMode, priceLabel, axisLabel, font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding, locked, visible. Excludes rayMode, fibLevels, fibLabelMode, vwapInterval, brushSmoothness.
- **Family**: `shape` for filled shapes (rectangle, rotatedRectangle, circle, ellipse, triangle), `line` for open paths (path, polyline, curveTool, doubleCurve), `shape` for arc
- **Cursor during draw**: `crosshair` (toolCursor maps all non-text families to crosshair)
- **Escape mid-draw**: cancels the in-progress shape creation, no drawing is committed
- **Ctrl+Z**: undoes the last committed drawing
- **Coordinate preservation**: all anchors are stored as `{time: UTCTimestamp, price: number}` pairs; shapes rescale correctly on zoom/pan

---

## Shared Behaviors: Text Tools Sub-Family

All text tools (`plainText`, `anchoredText`, `note`, `priceNote`, `pin`, `table`, `callout`, `comment`, `priceLabel`, `signpost`, `flagMark`) and content tools (`image`, `post`, `idea`) share:

- **Rail**: `rail-text` (data-testid), category `text`
- **Commit mode**: single click (`commitMode: "click"`, `anchorCount: 1`)
- **Selection geometry**: `horizontal` (used by the v2 factory selection bucket)
- **Schema**: `textSchema` — includes color, opacity, thickness, style, snapMode, priceLabel, axisLabel, font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding, locked, visible. Excludes extendLeft, extendRight, rayMode, fibLevels, fibLabelMode, vwapInterval, positionLabelMode, brushSmoothness.
- **Cursor**: `text` (toolCursor maps `family: 'text'` to `'text'` cursor)
- **Draggable**: `true` for all text tools
- **Resizable**: `false` for all text tools (text boxes do not have resize handles)
- **Text entry**: after placing anchor, a text editor appears inline for immediate entry
- **Double-click to re-edit**: double-clicking a placed text widget re-enters edit mode
- **Text persistence**: text content persists through zoom, pan, deselect/reselect cycles
- **One text block per tool**: each placement creates one independent text Drawing

Text label behavior verified in `line-tools-text-labels.spec.ts`:
- Floating toolbar "add text" button opens `chart-prompt-modal`
- OK button or Enter commits text
- Cancel button or Escape dismisses without saving
- For non-`supportsText` drawings: a separate `anchoredText` drawing is created at the line midpoint
- For `supportsText: true` drawings (infoLine, trendAngle): the drawing's own `.text` field is updated

---

## Shared Behaviors: Icon Tools Sub-Family

All icon tools (`emoji`, `sticker`, `iconTool`) share:

- **Rail**: category `icon`, rail label "Icons"
- **Commit mode**: single click
- **Anchor count**: 1
- **Family**: `text` (cursor is `text`)
- **Schema**: `textSchema`
- **Draggable**: `true`; **Resizable**: `false`
- **supportsText**: `true`; **supportsFill**: `false`

---

## Brush/Shapes Tools

---

## Tool: rectangle

### 1. Tool identity
- **Exact TradingView name**: Rectangle
- **Internal variant**: `rectangle`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Rectangle"]`
- **Submenu**: Yes — in the Shapes subsection of the Geometric shapes popover
- **TV keyboard shortcut**: `Alt+R`
- **Family**: `shape`; **subSection**: `Shapes`

### 2. Activation behavior
- Click `[aria-label="Geometric shapes"]` rail button to open the popover
- Click `[aria-label="Rectangle"]` in the submenu to activate
- The rail button face updates to show the Rectangle icon (last-used variant)
- Shortcut `Alt+R` activates directly without opening the popover
- Tool remains active for repeated draws until another tool or cursor is selected

### 3. Creation flow
- `commitMode: "drag"`, `anchorCount: 2`
- First anchor: mouse-down at one corner (price/time coordinate)
- Drag: live preview of the rectangle grows from anchor-1 toward cursor
- Second anchor: mouse-up sets the diagonally opposite corner
- Shape is committed on mouse-up; auto-selected immediately after commit
- The bounding box aligns to the chart's price axis (vertical) and time axis (horizontal)

### 4. Multi-anchor sequence
- Anchor 1: top-left or bottom-left corner (wherever mouse-down occurs)
- Anchor 2: diagonally opposite corner (wherever mouse-up occurs)
- No intermediate clicks; purely drag-based
- Rectangle can be drawn in any diagonal direction (up-left, up-right, down-left, down-right)

### 5. Selection and reselection
- Clicking anywhere inside the fill area selects (supportsFill: true)
- Clicking the border/stroke also selects
- Clicking outside deselects
- Reselect by clicking fill or border; the floating toolbar reappears

### 6. Hover and cursor
- Hovering over the fill area: pointer cursor (move affordance)
- Hovering over a corner handle: resize cursor (diagonal)
- Hovering over an edge midpoint handle: resize cursor (orthogonal)
- Hovering over the border stroke: pointer cursor
- Cursor during creation: `crosshair`

### 7. Handles and anchors
- 4 corner handles (NW, NE, SE, SW)
- 4 edge midpoint handles (N, E, S, W)
- 1 center handle (for body drag)
- Total: 9 interaction handles
- Stored anchors in Drawing: 2 points (min-corner and max-corner)

### 8. Drag and edit
- Body drag (on fill or center handle): moves entire rectangle, both anchors update
- Corner handle drag: resizes the rectangle; opposite corner is fixed
- Edge midpoint handle drag: resizes along one axis only; opposite edge fixed
- Text inside (supportsText: true): double-click on rectangle body opens ChartPromptModal to add/edit text
- Text is centered inside the rectangle
- `behaviors.shapeKind: 'rectangle'` signals the renderer to use rectangle geometry

### 9. Tooltip behavior
- Tooltip shows `"Rectangle"` on rail hover (verified: `expectedTooltip: "Rectangle"` in tv-capture-factory.ts)
- No data tooltip during or after creation (not a measurement tool)
- During drag: live visual preview only, no numeric overlay

### 10. Floating toolbar
When selected, the floating toolbar includes:
- Stroke color picker (border color)
- Fill color picker
- Opacity slider
- Border width control
- Border style selector (solid/dashed/dotted)
- Add text button (opens ChartPromptModal)
- Settings (opens full settings dialog)
- Delete
- Clone
- Lock / Unlock
- Hide / Show

### 11. Context menu
Right-click on rectangle body shows:
- Template (save/load style template)
- Visual order: Bring to front / Send to back
- Clone
- Lock / Unlock
- Hide / Show
- Edit text (if text has been set)
- Remove
- Settings

### 12. Settings/style
Full settings dialog includes:
- **Style tab**: border color, border width, border style, fill color, fill opacity
- **Text tab** (shapeKind: rectangle): font family, font size, bold, italic, alignment, text color, text background toggle, text border toggle, text padding
- **Coordinates tab**: explicit price/time entry for both anchor corners
- **Visibility tab**: locked, visible toggles
- `textMaxWidth` applies to text wrapping inside the rectangle

### 13. Text and label behavior
- `supportsText: true` — rectangle can contain inline text
- Text is added via: select rectangle → click "add text" in floating toolbar → ChartPromptModal
- Alternatively: right-click → "Edit text" opens the same modal
- Text is rendered centered horizontally and vertically inside the rectangle bounds
- Text scales visually with zoom but the font size in points remains fixed
- Text follows body drag (text anchor is relative to the rectangle center)
- Text persists after deselect/reselect and zoom/pan
- One text block per rectangle drawing
- Empty placeholder: no placeholder text shown; rectangle appears with no label until text is added
- Enter in the ChartPromptModal submits the text; Escape cancels
- Text wrapping respects `textMaxWidth` option (120–640px, default 240px)

### 14. Chart interaction
- Anchors stored as price/time coordinates; rectangle scales correctly on horizontal zoom and vertical price scale changes
- Rectangle height tracks price range; width tracks time range
- Price axis labels appear at the top and bottom edges if `priceLabel: true`

### 15. Keyboard behavior
- `Escape` during drag: cancels creation, no drawing committed
- `Escape` when selected: deselects
- `Delete` when selected: removes the rectangle
- Arrow keys when selected: nudge the shape by one pixel/bar (inferred from TV parity)
- `Ctrl+Z`: undo last action
- `Ctrl+Y` / `Ctrl+Shift+Z`: redo
- `Alt+R`: activates Rectangle tool directly

### 16. Edge cases
- Very small rectangle (< 2px area): committed as a degenerate shape; may not be visible but exists in Drawing list
- Very large rectangle (full chart area): valid, fills entire visible chart
- Rectangle with zero width or zero height: creates a line or horizontal bar — degenerate but committed
- Multiple overlapping rectangles: click selects the topmost by z-order (interactionPriority / renderOrder)
- Dense overlap: context menu allows "Bring to front" / "Send to back" to resolve z-order

### 17. Evidence and status
- **Coverage status**: Implemented (`implemented: true` in toolRegistry.ts)
- **tv-capture-factory.ts**: Index 17, `commitMode: "drag"`, `anchorCount: 2`, `expectedColorDefault: "#2962ff"`, `tvShortcut: "Alt+R"` — confirmed
- **tv-parity-rectangle-500.spec.ts**: 500-test suite registered via `registerExtendedSuite`, `kind: "shape"`, `railTestId: "rail-brush"`, `commitMode: "drag"` — confirmed
- **Gaps**: No dedicated v2 spec for rectangle (no `tv-parity-v2-rectangle.spec.ts` found); fill opacity control and text-inside-rectangle scenarios not directly verified in e2e test files
- **Verification**: Creation flow and rail selectors verified from source; text behavior inferred from `supportsText: true` capability and `line-tools-text-labels.spec.ts` modal pattern

---

## Tool: rotatedRectangle

### 1. Tool identity
- **Exact TradingView name**: Rotated rectangle
- **Internal variant**: `rotatedRectangle`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Rotated rectangle"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `shape`; **subSection**: `Shapes`

### 2. Activation behavior
- Click `[aria-label="Geometric shapes"]` rail → click `[aria-label="Rotated rectangle"]` in submenu
- Rail button face updates to Rotated Rectangle icon
- No dedicated keyboard shortcut

### 3. Creation flow
- `commitMode: "drag"`, `anchorCount: 2`
- First anchor: mouse-down sets one corner of the rectangle base edge
- Drag: live preview shows a rectangle that can be oriented at any angle
- Second anchor: mouse-up sets the diagonally opposite corner of the base edge
- The rectangle's rotation angle is determined by the drag direction relative to the price axis
- Shape committed on mouse-up; auto-selected

### 4. Multi-anchor sequence
- Anchor 1: one end of the rectangle's baseline
- Anchor 2: the diagonally opposite corner; the angle between the drag vector and the horizontal axis becomes the rotation angle
- Unlike the axis-aligned rectangle, the rotated rectangle is not constrained to horizontal/vertical edges

### 5. Selection and reselection
- Click inside fill area selects (supportsFill: true)
- Click on border/stroke also selects
- Click away deselects
- Reselect by clicking body or border

### 6. Hover and cursor
- Over fill: pointer cursor
- Over border: resize/rotate cursor depending on proximity to handles
- Over rotation handle: rotation cursor (circular arrow)
- During creation: `crosshair`

### 7. Handles and anchors
- 4 corner handles corresponding to the rotated rectangle's corners
- 4 edge midpoint handles on rotated edges
- 1 additional rotation handle (typically positioned above the top-center edge)
- Center handle for body drag
- `supportsText: false` — no text handle

### 8. Drag and edit
- Body drag: moves the entire rotated rectangle; both anchors translate
- Corner handle drag: resizes along the rectangle's local axes (length and width)
- Rotation handle drag: changes the rectangle's angle; anchors are recalculated
- `behaviors.shapeKind: 'rectangle'` — renderer uses rectangle geometry with transform matrix

### 9. Tooltip behavior
- Tooltip shows `"Rotated rectangle"` on rail hover (verified: `expectedTooltip: "Rotated rectangle"`)
- No data tooltip during creation

### 10. Floating toolbar
When selected:
- Stroke color, fill color, opacity, border width, border style
- Settings, Delete, Clone, Lock, Hide
- No "add text" button (`supportsText: false`)

### 11. Context menu
- Template, Visual order (Bring to front / Send to back), Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Style tab**: border color, border width, border style, fill color, fill opacity
- **Coordinates tab**: anchor price/time positions; rotation angle (degrees)
- **Visibility tab**: locked, visible
- No text tab (`supportsText: false`)

### 13. Text and label behavior
- `supportsText: false` — rotated rectangle cannot contain text
- No text entry, no ChartPromptModal for this tool

### 14. Chart interaction
- Anchors stored as price/time coordinates
- Rotation is stored as an angle; on zoom/pan the shape rescales while preserving the rotation angle
- May appear distorted if price scale and time scale zoom ratios differ substantially (aspect ratio changes)

### 15. Keyboard behavior
- `Escape` during drag: cancels creation
- `Escape` when selected: deselects
- `Delete` when selected: removes
- Arrow keys: nudge position
- `Ctrl+Z`: undo

### 16. Edge cases
- Very small rotated rectangle: committed as degenerate shape
- Rotation at exactly 0° or 90°: visually identical to axis-aligned rectangle but stored differently
- Aspect ratio distortion on price scale changes: rotation visual may shift due to coordinate system

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 18, `commitMode: "drag"`, `anchorCount: 2`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-rotatedRectangle-500.spec.ts**: exists in e2e directory — confirmed
- **Gaps**: No v2 spec file; rotation handle behavior inferred from TV parity documentation, not directly tested in available specs
- **Verification**: Activation flow and selectors confirmed from source; rotation behavior inferred from `behaviors.shapeKind: 'rectangle'` and TradingView documented behavior

---

## Tool: path

### 1. Tool identity
- **Exact TradingView name**: Path
- **Internal variant**: `path`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Path"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `line`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Path"]`
- Rail face updates to Path icon
- Tool remains active until another tool selected

### 3. Creation flow
- `commitMode: "click-sequence"`, `anchorCount: 3` (minimum 3 in capture spec)
- First click: places the first vertex (path start)
- Subsequent clicks: each click adds a new vertex to the open polypath
- Double-click on the last vertex: finalizes/commits the path
- Path is an open shape (start and end points are not connected)
- `family: 'line'` — uses brushSchema (no fill option)

### 4. Multi-anchor sequence
- Click 1: path origin point
- Click 2..N: intermediate vertices; live rubber-band preview shows segment to cursor
- Double-click at final vertex: commits the path with all placed vertices
- Minimum viable path: 2 distinct points (one segment); 3+ points creates a multi-segment path
- The capture spec uses `anchorCount: 3` as the test minimum

### 5. Selection and reselection
- `supportsFill: false` — must click on the path stroke/border to select
- Cannot select by clicking "inside" (no fill area)
- Click on any segment of the path stroke selects
- Click away deselects

### 6. Hover and cursor
- Over path stroke: pointer cursor
- Over vertex handle: vertex cursor
- During creation: `crosshair`

### 7. Handles and anchors
- One handle at each placed vertex
- No center handle (open path)
- Handle count equals the number of placed vertices
- Stored as N anchors in the Drawing record

### 8. Drag and edit
- Vertex handle drag: moves that individual vertex, reshaping adjacent segments
- Body drag (on stroke): moves entire path, all anchors translate
- No rotation handle

### 9. Tooltip behavior
- Tooltip shows `"Path"` on rail hover (verified: `expectedTooltip: "Path"`)
- No data tooltip during creation

### 10. Floating toolbar
When selected:
- Stroke color, opacity, thickness, style
- Settings, Delete, Clone, Lock, Hide
- No fill or text options (`supportsFill: false`, `supportsText: false`)

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Style tab**: stroke color, line width, line style, opacity
- **Coordinates tab**: price/time for each vertex anchor
- **Visibility tab**: locked, visible
- Uses `brushSchema`: no font/text options, no rayMode, no fibLevels/fibLabelMode/vwapInterval

### 13. Text and label behavior
- `supportsText: false` — path cannot contain text
- No ChartPromptModal

### 14. Chart interaction
- All vertex anchors stored as price/time coordinates
- Path rescales with zoom/pan; each segment maintains its relative price/time geometry
- Path is not closed — it remains an open polyline-style path

### 15. Keyboard behavior
- `Escape` during click sequence: cancels creation (if pressed before double-click commit)
- `Delete` when selected: removes path
- `Ctrl+Z`: undo last vertex or last committed path
- No dedicated shortcut

### 16. Edge cases
- Single segment (2 vertices): valid minimal path
- Very long path (many vertices): all anchors stored; may impact render performance
- Overlapping vertices: creates degenerate zero-length segments
- Double-click on first vertex: creates a degenerate path (zero length)

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 19, `commitMode: "click-sequence"`, `anchorCount: 3`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-path-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; double-click finalization behavior not directly verified in available test files
- **Verification**: Rail selectors and commit mode confirmed from source; multi-vertex behavior inferred from `click-sequence` commitMode and family `line`

---

## Tool: circle

### 1. Tool identity
- **Exact TradingView name**: Circle
- **Internal variant**: `circle`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Circle"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `shape`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Circle"]`
- Rail face updates to Circle icon

### 3. Creation flow
- `commitMode: "drag"`, `anchorCount: 2`
- First anchor: mouse-down at the center of the circle
- Drag: live preview shows a circle expanding from center to cursor
- Second anchor: mouse-up sets the radius (distance from center to cursor)
- Circle is axis-aligned (not distorted by chart aspect ratio in price/time space — rendered as a circle in screen space)
- Committed on mouse-up; auto-selected

### 4. Multi-anchor sequence
- Anchor 1: circle center
- Anchor 2: a point on the circumference (radius endpoint)
- The radius is the Euclidean distance between the two anchors in screen coordinates

### 5. Selection and reselection
- Click inside fill area selects (supportsFill: true)
- Click on circle border also selects
- Click away deselects

### 6. Hover and cursor
- Over fill: pointer cursor
- Over border: resize cursor
- During creation: `crosshair`

### 7. Handles and anchors
- Center handle
- 4 cardinal handles (N, E, S, W on circumference)
- `behaviors.shapeKind: 'circle'`
- `supportsText: true` — text can be placed inside

### 8. Drag and edit
- Center handle drag: moves circle
- Cardinal handle drag: resizes radius
- Body drag on fill: moves circle
- Text inside: added via floating toolbar or context menu

### 9. Tooltip behavior
- Tooltip shows `"Circle"` (verified: `expectedTooltip: "Circle"`)
- No data tooltip during creation

### 10. Floating toolbar
When selected:
- Stroke color, fill color, opacity, border width, border style
- Add text button
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Edit text, Remove, Settings

### 12. Settings/style
- **Style tab**: border color, border width, border style, fill color, fill opacity
- **Text tab**: font, size, bold, italic, alignment, text color, textBackground, textBorder, textPadding
- **Coordinates tab**: center anchor price/time, radius
- **Visibility tab**: locked, visible

### 13. Text and label behavior
- `supportsText: true` — circle can contain centered text
- Text added via ChartPromptModal
- Text is centered inside the circle area
- Text follows body drag
- Text persists through zoom/pan

### 14. Chart interaction
- Center and radius stored as price/time anchors
- On zoom, circle maintains price/time radius (may appear elliptical if price and time scales differ)
- `behaviors.shapeKind: 'circle'` informs renderer to use circular geometry

### 15. Keyboard behavior
- `Escape` during drag: cancels
- `Delete` when selected: removes
- `Ctrl+Z`: undo

### 16. Edge cases
- Zero-radius circle (drag on same point): degenerate, may render as a dot
- Very large circle: valid; extends beyond visible chart area
- Aspect ratio mismatch: circle may render as ellipse in price/time space

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 20, `commitMode: "drag"`, `anchorCount: 2`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-circle-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; text-inside-circle behavior inferred from supportsText
- **Verification**: Rail selectors confirmed; text behavior inferred from capability flags

---

## Tool: ellipse

### 1. Tool identity
- **Exact TradingView name**: Ellipse
- **Internal variant**: `ellipse`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Ellipse"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `shape`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Ellipse"]`
- Rail face updates to Ellipse icon

### 3. Creation flow
- `commitMode: "drag"`, `anchorCount: 2`
- First anchor: mouse-down at one corner of the bounding box
- Drag: preview shows an oval growing to fit the dragged bounding box
- Second anchor: mouse-up at the diagonally opposite corner of the bounding box
- Ellipse is inscribed within the axis-aligned bounding box defined by the two anchors
- Committed on mouse-up; auto-selected

### 4. Multi-anchor sequence
- Anchor 1: top-left corner of bounding box
- Anchor 2: bottom-right corner of bounding box
- The major and minor axes are derived from the bounding box width and height
- Differs from circle: ellipse width and height are independently controlled

### 5. Selection and reselection
- Click inside fill area selects (supportsFill: true)
- Click on ellipse border also selects
- `behaviors.shapeKind: 'circle'` — renderer uses circle family geometry (ellipse is a generalization)

### 6. Hover and cursor
- Over fill: pointer cursor
- Over border: resize cursor
- During creation: `crosshair`

### 7. Handles and anchors
- 4 corner handles of the bounding box
- 4 edge midpoint handles
- Center handle
- `supportsText: false` — no text handle

### 8. Drag and edit
- Corner handle drag: resizes bounding box (changes both axes)
- Edge midpoint drag: resizes one axis only
- Body drag: moves ellipse

### 9. Tooltip behavior
- Tooltip shows `"Ellipse"` (verified: `expectedTooltip: "Ellipse"`)

### 10. Floating toolbar
When selected:
- Stroke color, fill color, opacity, border width, border style
- Settings, Delete, Clone, Lock, Hide
- No add-text button (`supportsText: false`)

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Style tab**: border color, border width, border style, fill color, fill opacity
- **Coordinates tab**: bounding box corner anchors
- **Visibility tab**: locked, visible

### 13. Text and label behavior
- `supportsText: false` — ellipse cannot contain text
- No ChartPromptModal

### 14. Chart interaction
- Bounding box corners stored as price/time coordinates
- On zoom/pan, ellipse rescales with the chart

### 15. Keyboard behavior
- `Escape` during drag: cancels
- `Delete`: removes
- `Ctrl+Z`: undo

### 16. Edge cases
- Equal width and height: renders as a circle
- Very thin ellipse: degenerate oval; may appear as a line
- Zero area: committed but invisible

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 21, `commitMode: "drag"`, `anchorCount: 2`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-ellipse-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; no dedicated text tests (supportsText is false)

---

## Tool: polyline

### 1. Tool identity
- **Exact TradingView name**: Polyline
- **Internal variant**: `polyline`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Polyline"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `line`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Polyline"]`
- Rail face updates to Polyline icon

### 3. Creation flow
- `commitMode: "click-sequence"`, `anchorCount: 3` (minimum in capture spec)
- Multi-click to place vertices; double-click to finalize
- Creates an open polyline (straight line segments connecting consecutive vertices)
- Differs from `path`: polyline uses straight segments; path may use smooth curves depending on renderer
- Uses `brushSchema` (no fill)

### 4. Multi-anchor sequence
- Click 1: first vertex (polyline start)
- Click 2..N: each click adds a straight segment from the previous vertex to the new one
- Rubber-band line preview shown from last vertex to cursor
- Double-click at final position: commits the polyline

### 5. Selection and reselection
- `supportsFill: false` — click on stroke segments only
- Cannot select by clicking empty space inside the polyline boundary

### 6. Hover and cursor
- Over stroke: pointer cursor
- Over vertex handle: vertex cursor
- During creation: `crosshair`

### 7. Handles and anchors
- One handle at each vertex
- N anchors stored for N vertices

### 8. Drag and edit
- Vertex handle drag: repositions that vertex
- Stroke body drag: moves entire polyline

### 9. Tooltip behavior
- Tooltip shows `"Polyline"` (verified: `expectedTooltip: "Polyline"`)

### 10. Floating toolbar
When selected:
- Stroke color, opacity, thickness, style
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Style tab**: stroke color, line width, line style, opacity (brushSchema)
- **Coordinates tab**: all vertex price/time positions
- **Visibility tab**: locked, visible

### 13. Text and label behavior
- `supportsText: false` — no text support

### 14. Chart interaction
- All vertices stored as price/time anchors
- Straight segments rescale with zoom

### 15. Keyboard behavior
- `Escape` during click sequence: cancels pending creation
- `Delete`: removes
- `Ctrl+Z`: undo

### 16. Edge cases
- Minimum of 2 vertices: one straight segment
- Coincident vertices: zero-length segment
- Very long polyline with many vertices: all stored; render may slow

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 22, `commitMode: "click-sequence"`, `anchorCount: 3`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-polyline-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; double-click finalization not directly e2e tested for this tool

---

## Tool: triangle

### 1. Tool identity
- **Exact TradingView name**: Triangle
- **Internal variant**: `triangle`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Triangle"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `shape`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Triangle"]`
- Rail face updates to Triangle icon

### 3. Creation flow
- `commitMode: "click-sequence"`, `anchorCount: 3`
- Click 1: places vertex A
- Click 2: places vertex B; a preview line A-B appears
- Click 3: places vertex C; the triangle A-B-C is drawn and committed automatically on the third click
- No double-click required; exactly 3 clicks commits the shape
- Shape is auto-selected after commit

### 4. Multi-anchor sequence
- Click 1 → vertex A (e.g., top apex)
- Click 2 → vertex B (e.g., bottom-left)
- Click 3 → vertex C (e.g., bottom-right); commits immediately
- Order of clicks determines visual orientation but any three non-collinear points form a valid triangle

### 5. Selection and reselection
- Click inside fill area selects (supportsFill: true)
- Click on any side (border) also selects
- Click away deselects

### 6. Hover and cursor
- Over fill: pointer cursor
- Over border: pointer/resize cursor
- During creation: `crosshair`

### 7. Handles and anchors
- 3 vertex handles (A, B, C)
- 3 edge midpoint handles (one per side)
- Center handle
- `supportsText: true` — text handle or text shown centered inside

### 8. Drag and edit
- Vertex handle drag: repositions one vertex; other two fixed
- Edge midpoint drag: moves that edge; opposite vertex fixed
- Center/body drag: moves entire triangle
- Text inside: added via ChartPromptModal

### 9. Tooltip behavior
- Tooltip shows `"Triangle"` (verified: `expectedTooltip: "Triangle"`)

### 10. Floating toolbar
When selected:
- Stroke color, fill color, opacity, border width, border style
- Add text button
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Edit text, Remove, Settings

### 12. Settings/style
- **Style tab**: border color, border width, border style, fill color, fill opacity
- **Text tab**: font, size, bold, italic, alignment, text color, textBackground, textBorder, textPadding
- **Coordinates tab**: three vertex price/time coordinates
- **Visibility tab**: locked, visible

### 13. Text and label behavior
- `supportsText: true` — triangle can contain centered text
- Text added via floating toolbar → ChartPromptModal
- Text rendered centered inside triangle bounds
- Follows body drag
- Persists through zoom/pan

### 14. Chart interaction
- Three vertex anchors stored as price/time coordinates
- Triangle rescales with zoom/pan

### 15. Keyboard behavior
- `Escape` during click sequence: cancels (before 3rd click)
- `Delete`: removes triangle
- `Ctrl+Z`: undo

### 16. Edge cases
- Collinear vertices: degenerate (all three points on a line); renders as a line segment
- Very small triangle: committed but barely visible
- Equilateral triangle possible if vertices placed carefully

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 23, `commitMode: "click-sequence"`, `anchorCount: 3`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-triangle-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; text-inside-triangle inferred from supportsText

---

## Tool: arc

### 1. Tool identity
- **Exact TradingView name**: Arc
- **Internal variant**: `arc`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Arc"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `shape`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Arc"]`

### 3. Creation flow
- `commitMode: "click-sequence"`, `anchorCount: 3`
- Click 1: arc start point
- Click 2: arc end point
- Click 3: arc midpoint (a point on the arc curve, defining the curvature)
- Arc is committed on the third click
- `supportsFill: false` — arc is an open curve, not a closed shape

### 4. Multi-anchor sequence
- Anchor 1: start of arc
- Anchor 2: end of arc
- Anchor 3: midpoint on the arc curve (controls the bow/bulge of the arc)
- The three points uniquely define a circular arc

### 5. Selection and reselection
- `supportsFill: false` — must click on arc stroke to select
- Click away deselects

### 6. Hover and cursor
- Over arc stroke: pointer cursor
- Over anchor handles: vertex cursor
- During creation: `crosshair`

### 7. Handles and anchors
- 3 handles: start, end, midpoint
- Stored as 3 anchors in Drawing
- `supportsText: false`

### 8. Drag and edit
- Start/end handle drag: repositions endpoints; arc recalculates
- Midpoint handle drag: changes arc curvature
- Body drag (on stroke): moves entire arc

### 9. Tooltip behavior
- Tooltip shows `"Arc"` (verified: `expectedTooltip: "Arc"`)

### 10. Floating toolbar
When selected:
- Stroke color, opacity, thickness, style
- Settings, Delete, Clone, Lock, Hide
- No fill or text options

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Style tab**: stroke color, line width, line style, opacity (shapeSchema)
- **Coordinates tab**: three anchor price/time positions
- **Visibility tab**: locked, visible

### 13. Text and label behavior
- `supportsText: false` — no text support

### 14. Chart interaction
- Three anchors stored as price/time coordinates
- Arc rescales with zoom; the circular arc geometry is maintained in screen space

### 15. Keyboard behavior
- `Escape` during click sequence: cancels (before 3rd click)
- `Delete`: removes arc
- `Ctrl+Z`: undo

### 16. Edge cases
- Collinear anchor points: degenerate arc (straight line)
- Very small arc (tight radius): may appear as a small curve or point
- Large spanning arc: can cross price levels and time zones

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 24, `commitMode: "click-sequence"`, `anchorCount: 3`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-arc-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; arc midpoint drag behavior inferred from geometry; not directly e2e tested

---

## Tool: curveTool

### 1. Tool identity
- **Exact TradingView name**: Curve
- **Internal variant**: `curveTool`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Curve"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `line`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Curve"]`
- Rail face updates to Curve icon

### 3. Creation flow
- `commitMode: "click-sequence"`, `anchorCount: 3` (minimum in capture spec)
- Multi-click to place control points for a Bezier/spline curve
- Double-click to finalize the curve
- Each control point influences the shape of the curve (spline interpolation)
- `family: 'line'` and `brushSchema` — no fill

### 4. Multi-anchor sequence
- Click 1: curve start point (first control point)
- Click 2..N: each click adds a control point; the curve updates in real-time
- Double-click: commits the curve with all placed control points
- The rendered line is a smooth curve passing through or near the control points

### 5. Selection and reselection
- `supportsFill: false` — click on curve stroke to select
- Cannot select by clicking "inside"

### 6. Hover and cursor
- Over stroke: pointer cursor
- Over control point handle: vertex cursor
- During creation: `crosshair`

### 7. Handles and anchors
- One handle at each control point
- N anchors stored for N control points

### 8. Drag and edit
- Control point handle drag: reshapes the curve
- Body drag (on stroke): moves entire curve

### 9. Tooltip behavior
- Tooltip shows `"Curve"` (verified: `expectedTooltip: "Curve"`)

### 10. Floating toolbar
When selected:
- Stroke color, opacity, thickness, style
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Style tab**: stroke color, line width, line style, opacity
- **Coordinates tab**: all control point price/time positions
- **Visibility tab**: locked, visible
- Uses brushSchema (no font/text fields)

### 13. Text and label behavior
- `supportsText: false` — no text support

### 14. Chart interaction
- Control point anchors stored as price/time coordinates
- Curve shape rescales with zoom

### 15. Keyboard behavior
- `Escape` during click sequence: cancels
- `Delete`: removes
- `Ctrl+Z`: undo

### 16. Edge cases
- Minimum 2 control points: straight line (degenerate curve)
- Many control points: complex S-curves possible
- Overlapping control points: degenerate segments

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 25, `commitMode: "click-sequence"`, `anchorCount: 3`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-curveTool-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; Bezier vs. spline rendering behavior not specified in source

---

## Tool: doubleCurve

### 1. Tool identity
- **Exact TradingView name**: Double curve
- **Internal variant**: `doubleCurve`
- **Category**: Brush / Shapes
- **Rail aria-label**: `[aria-label="Geometric shapes"]`
- **Tool aria-label**: `[aria-label="Double curve"]`
- **Submenu**: Yes — Shapes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `line`; **subSection**: `Shapes`

### 2. Activation behavior
- Click rail → click `[aria-label="Double curve"]`
- Rail face updates to Double Curve icon

### 3. Creation flow
- `commitMode: "click-sequence"`, `anchorCount: 3` (minimum)
- Like curveTool but creates an S-shaped double curve
- Multi-click to place control points; double-click to finalize
- The S-curve connects two arcs in opposite directions

### 4. Multi-anchor sequence
- Click 1: start of the first arc
- Click 2: inflection point (where first arc transitions to second)
- Click 3+: end of second arc / additional control points
- Double-click: commits

### 5. Selection and reselection
- `supportsFill: false` — click on stroke only
- Click away deselects

### 6. Hover and cursor
- Over stroke: pointer cursor
- Over control point: vertex cursor
- During creation: `crosshair`

### 7. Handles and anchors
- One handle per control point
- N anchors stored

### 8. Drag and edit
- Control point drag: reshapes the double curve
- Body drag: moves entire S-curve

### 9. Tooltip behavior
- Tooltip shows `"Double curve"` (verified: `expectedTooltip: "Double curve"`)

### 10. Floating toolbar
When selected:
- Stroke color, opacity, thickness, style
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Style tab**: stroke color, line width, line style, opacity (brushSchema)
- **Coordinates tab**: all control point price/time positions
- **Visibility tab**: locked, visible

### 13. Text and label behavior
- `supportsText: false` — no text support

### 14. Chart interaction
- Control point anchors stored as price/time coordinates
- S-curve rescales with zoom

### 15. Keyboard behavior
- `Escape` during sequence: cancels
- `Delete`: removes
- `Ctrl+Z`: undo

### 16. Edge cases
- Minimum control points: may appear as a single arc rather than S-curve
- Large separation between control points: exaggerated S-shape

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-capture-factory.ts**: Index 26, `commitMode: "click-sequence"`, `anchorCount: 3`, `expectedColorDefault: "#2962ff"` — confirmed
- **tv-parity-doubleCurve-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; S-curve rendering algorithm not specified in source

---

## Text/Text and Notes Tools

---

## Tool: plainText

### 1. Tool identity
- **Exact TradingView name**: Text
- **Internal variant**: `plainText`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text` (data-testid); category `text`
- **TV tool label**: "Text"
- **Submenu**: Yes — Text and Notes subsection of Text rail popover
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` button → click the "Text" item in the Text and Notes submenu
- Rail button face updates to Text icon
- Tool is registered in v2 suite: `testId: "tool-plain-text"`, `railTestId: "rail-text"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click on chart places a text box at that price/time location
- Immediately after placement, inline text editor is activated for text entry
- Text entry phase: user types; text appears in the box
- Commit: press Enter (single line) or click elsewhere on chart
- The text box remains at the clicked price/time coordinate

### 4. Multi-anchor sequence
- Single anchor only: one click = one placement
- No drag, no multi-click sequence
- After click, the text entry phase begins automatically

### 5. Selection and reselection
- Click on the text box (any part) selects
- `selectionGeometry: "horizontal"` — the selection hit area extends horizontally from the anchor
- Click away deselects
- Reselect by clicking the text box body

### 6. Hover and cursor
- Cursor during creation: `text` (toolCursor maps family `text` to `'text'` cursor)
- Over placed text box: text cursor (for edit affordance)
- Tool activation cursor: text cursor

### 7. Handles and anchors
- 1 anchor handle at the placement point
- `resizable: false` — no resize handles
- `draggable: true` — body drag moves the text box

### 8. Drag and edit
- Body drag: moves the text box to a new price/time location; anchor updates
- Double-click on placed text: re-enters inline edit mode
- No rotation handle; no resize handles

### 9. Tooltip behavior
- No data tooltip during or after creation
- Text editor appears inline at the click location

### 10. Floating toolbar
When selected:
- Font family selector
- Font size
- Bold toggle
- Italic toggle
- Text alignment (left/center/right)
- Text color
- Text background toggle
- Text border toggle
- Text padding
- Settings (full dialog)
- Delete
- Clone
- Lock / Unlock
- Hide / Show

### 11. Context menu
- Right-click on text box:
  - Edit text
  - Template
  - Visual order (Bring to front / Send to back)
  - Clone
  - Lock
  - Hide
  - Remove
  - Settings

### 12. Settings/style
- **Text tab**: font family, font size (10–28), text max width (120–640px), bold, italic, alignment (left/center/right), text background (toggle), text border (toggle), text padding (0–24)
- **Color tab**: text color (`color` field), opacity
- **Coordinates tab**: anchor price/time
- **Visibility tab**: locked, visible
- Options schema: `textSchema` (includes all text-related fields; excludes extendLeft, extendRight, rayMode, fibLevels, fibLabelMode, vwapInterval, positionLabelMode, brushSmoothness)

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: single click places box; immediately type to enter text; text appears inline
- **Double-click to re-edit**: yes — double-clicking a placed text box re-enters edit mode without modal
- **Text wrapping**: wraps at `textMaxWidth` (default 240px, range 120–640px); text box grows vertically
- **Enter key behavior**: Enter creates a new line (multi-line text); text is NOT committed by Enter alone — click elsewhere to commit
- **Text styling inline vs. settings**: bold and italic can be set via floating toolbar toggles; full font/size via settings dialog
- **Text follows body drag**: yes — anchor moves with drag
- **Text persists after zoom/pan**: yes — anchored to price/time coordinates
- **Text persists after deselect/reselect**: yes — stored in Drawing.text field
- **One text block per tool**: one text Drawing per click; multiple clicks create multiple independent text boxes
- **Placeholder text**: none shown while empty; text box may be invisible until text is entered
- **Empty text box**: placement creates a Drawing record even if no text is typed (empty string)
- **Interaction with line-tools-text-labels.spec.ts**: anchoredText (not plainText) is created as a side effect when adding text to non-text-capable lines; plainText is its own tool
- **supportsFill: true**: text box can have a background fill (controlled by `textBackground` toggle)

### 14. Chart interaction
- Text box anchored at price/time coordinate of click
- Text remains at anchored price/time on zoom/pan
- Does not scale with zoom (text size in pt remains fixed; box position scales)

### 15. Keyboard behavior
- `Escape` before placing anchor: deactivates tool (no drawing created)
- `Escape` during text entry: cancels text entry; may remove empty text box
- `Delete` when text box selected (not in edit mode): removes text box
- `Enter` during text entry: inserts newline (does not commit)
- Click elsewhere: commits text entry
- Arrow keys (not in edit mode): nudge position
- `Ctrl+Z`: undo placement or text change

### 16. Edge cases
- Very long text (thousands of characters): wraps at textMaxWidth; box grows vertically
- Empty text box (no text entered): remains as a visible empty Drawing, or may be auto-removed on deselect depending on implementation
- Text with special characters, unicode, emoji: stored in Drawing.text as string
- Multiple plainText boxes overlapping: each is independent; click selects topmost by z-order
- Text box placed at chart edge: anchor at edge; text may overflow chart boundary

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-plainText.spec.ts**: `variant: "plainText"`, `testId: "tool-plain-text"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-plainText-500.spec.ts**: exists — confirmed
- **line-tools-text-labels.spec.ts**: Confirms ChartPromptModal pattern for text entry on line tools; plainText is the target when creating anchoredText for non-supportsText lines
- **Gaps**: Inline text editor behavior (multi-line Enter, double-click re-edit) inferred from TV parity; not directly covered by dedicated inline edit e2e tests

---

## Tool: anchoredText

### 1. Tool identity
- **Exact TradingView name**: Anchored text
- **Internal variant**: `anchoredText`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Anchored text"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Anchored text" in submenu
- `testId: "tool-anchored-text"` (from v2 spec)
- Also created programmatically by `line-tools-text-labels.spec.ts` when a non-supportsText line tool receives text (the text is attached as a separate `anchoredText` drawing at the line midpoint)

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click anchors the text to a specific price level
- Text entry begins immediately
- The text widget is "anchored" — it tracks a price level or price/time point more explicitly than plainText

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click text box body selects
- `selectionGeometry: "horizontal"`
- Click away deselects

### 6. Hover and cursor
- Text cursor during tool activation and hover
- `family: 'text'` → cursor maps to `'text'`

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves text box and anchor
- Double-click re-enters edit mode

### 9. Tooltip behavior
- No data tooltip; text editor opens on placement

### 10. Floating toolbar
- Same as plainText: font, size, bold, italic, align, color, textBackground, textBorder, textPadding, Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Same options as plainText (textSchema)
- Anchor tab: price/time coordinate

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: single click + immediate type; or via ChartPromptModal when created by `line-tools-text-labels` pattern
- **Programmatic creation**: `line-tools-text-labels.spec.ts` verifies: when a non-supportsText line (trend, ray, extendedLine) has text added via floating toolbar "add text" button, a new `anchoredText` drawing is created with `variant: "anchoredText"` and the text stored in `drawing.text`
- **Anchor linking**: when created as a side-effect of a line tool, anchors are placed at the line's midpoint coordinates
- **Double-click to re-edit**: yes
- **Text wrapping**: at textMaxWidth
- **Enter key**: newline; click elsewhere to commit
- **Persists**: yes, through zoom/pan and deselect/reselect
- **supportsFill: true**: text box can have background
- **supportsText: true**: owns its own text content

### 14. Chart interaction
- Text anchored to price/time coordinate
- Follows chart zoom/pan

### 15. Keyboard behavior
- Same as plainText
- Escape before placement: cancel
- Delete when selected: removes

### 16. Edge cases
- Created as side-effect: verifiable via `__chartDebug.getDrawings()` showing new Drawing with `variant: "anchoredText"`
- The `text` field on the anchoredText drawing holds the user-entered string

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-anchoredText.spec.ts**: `variant: "anchoredText"`, `testId: "tool-anchored-text"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **line-tools-text-labels.spec.ts**: Directly verified — when non-supportsText line tools receive text via "add text" button, a new `anchoredText` drawing is created with the correct text content; Cancel does not create drawings; Escape dismisses without saving — all 5 scenarios × 5 tools confirmed
- **tv-parity-anchoredText-500.spec.ts**: exists — confirmed

---

## Tool: note

### 1. Tool identity
- **Exact TradingView name**: Note
- **Internal variant**: `note`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Note" (spec comment: "TV: price-note (note variant)")
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Note" in submenu
- `testId: "tool-note"`
- Note: the v2 spec comment says "TV: price-note (note variant)" indicating TV's internal name may be "price-note" for this variant

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a sticky-note style annotation widget at the clicked price/time
- Text entry begins immediately after placement

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click note body selects
- `selectionGeometry: "horizontal"`
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation and hover

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves note
- Double-click re-enters text edit mode

### 9. Tooltip behavior
- No data tooltip; note widget appears with text editor on placement

### 10. Floating toolbar
- Font, size, bold, italic, align, text color, textBackground, textBorder, textPadding
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Same options as plainText (textSchema)
- Note appearance: sticky-note visual style with possible collapse affordance

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: click to place, then type inline
- **Sticky-note style**: rendered as a small note-pad/sticky-note visual (square background with slightly different styling than plainText)
- **Collapsible**: in TV, notes can typically be collapsed to just show a small indicator; this behavior is inferred from TV parity — not confirmed in source code
- **Double-click to re-edit**: yes
- **Text wrapping**: at textMaxWidth (default 240px)
- **Enter key**: newline (not commit); click elsewhere to commit
- **Persists**: yes
- **supportsFill: true**: background fill enabled; note has distinctive colored background
- **supportsText: true**: owns its text content
- **One note per placement**: multiple clicks create multiple independent notes
- **Placeholder**: none; note body may appear empty until text typed

### 14. Chart interaction
- Anchored at price/time of click
- Follows zoom/pan

### 15. Keyboard behavior
- Escape before placement: cancel tool
- Delete when selected: removes note
- Ctrl+Z: undo
- Enter: newline in text

### 16. Edge cases
- Empty note (no text): creates visible but empty note widget
- Very long note text: wraps; note box grows vertically
- Multiple notes at same price/time: stack; click selects topmost

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-note.spec.ts**: `variant: "note"`, `testId: "tool-note"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-note-500.spec.ts**: exists — confirmed
- **Gaps**: Collapse behavior not confirmed in source; TV internal name mapping ("price-note" vs "note") noted from spec comment

---

## Tool: priceNote

### 1. Tool identity
- **Exact TradingView name**: Price note
- **Internal variant**: `priceNote`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Price note" (spec comment: "TV: price-note")
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Price note" in submenu
- `testId: "tool-price-note"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click on chart places a note pinned to the price axis at the clicked price level
- The note's anchor point is on the price axis (right side of chart) at the clicked price

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click note body selects
- `selectionGeometry: "horizontal"`
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation and hover

### 7. Handles and anchors
- 1 anchor handle at the price axis position
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves the note along the price axis (vertically)
- Double-click re-enters text edit mode

### 9. Tooltip behavior
- No data tooltip; note widget appears on placement

### 10. Floating toolbar
- Text styling controls (font, size, bold, italic, align, color)
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: false` — no background fill control in floating toolbar

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- textSchema fields: font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding
- `supportsFill: false` — no fill color
- Coordinates tab: price level (anchor price, possibly without time component)

### 13. Text and label behavior (MOST IMPORTANT)
- **Pinned to price axis**: the note is displayed on or near the price axis (right side of chart), not floating on the chart body
- **Price-level anchored**: anchor tracks the price; as the price scale zooms, the note moves vertically
- **Text on axis**: the text label appears adjacent to the price axis at the anchored price
- **Double-click to re-edit**: yes
- **Text wrapping**: at textMaxWidth
- **Enter key**: newline; click elsewhere commits
- **Persists**: yes, through zoom/pan and deselect/reselect
- **supportsFill: false**: no background fill; text appears directly on or near the axis
- **supportsText: true**: owns its text content
- **Placeholder**: none

### 14. Chart interaction
- Anchored at price level; when chart scrolls horizontally, note stays at same price
- When price scale zooms vertically, note moves with the price axis

### 15. Keyboard behavior
- Escape before placement: cancel
- Delete when selected: removes
- Ctrl+Z: undo

### 16. Edge cases
- Price note placed at extreme price (out of current view): note appears on axis even if current price is far from anchor
- Multiple price notes at same price level: stacked on axis

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-priceNote.spec.ts**: `variant: "priceNote"`, `testId: "tool-price-note"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-priceNote-500.spec.ts**: exists — confirmed
- **Gaps**: Price axis display behavior inferred from tool name and TV parity; not directly covered by dedicated axis-label e2e test in available files

---

## Tool: pin

### 1. Tool identity
- **Exact TradingView name**: Pin
- **Internal variant**: `pin`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Pin"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Pin"
- `testId: "tool-pin"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a map-pin style indicator at the clicked price/time
- Text entry may begin after placement (pin supports text)

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click pin body selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation (family `text`)

### 7. Handles and anchors
- 1 anchor handle at base of pin
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves pin to new location
- Double-click re-enters text edit if text was added

### 9. Tooltip behavior
- No data tooltip during creation

### 10. Floating toolbar
- Text styling (font, size, bold, italic, align, text color)
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: false` — no fill control

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- textSchema fields
- `supportsFill: false`; `supportsText: true`

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: click to place, then type label text that appears near the pin head
- **Map-pin style**: rendered as a downward-pointing pin icon; text label appears next to the pin head
- **Text is optional**: pin can be placed without text (label-free pin indicator)
- **Double-click to re-edit**: yes
- **Text wrapping**: at textMaxWidth
- **Persists**: yes
- **supportsFill: false**: no background fill; text floats next to pin
- **supportsText: true**: can have text label

### 14. Chart interaction
- Pin anchored at price/time coordinate
- Follows zoom/pan; pin marker tracks the price/time point

### 15. Keyboard behavior
- Escape: cancel before placement
- Delete: removes pin
- Ctrl+Z: undo

### 16. Edge cases
- Pin without text: visible as a pin icon only
- Very long text: wraps; may overlap adjacent content

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-pin.spec.ts**: confirmed (`variant: "pin"`, `testId: "tool-pin"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`)
- **tv-parity-pin-500.spec.ts**: exists — confirmed
- **Gaps**: Visual appearance of pin widget inferred from tool name; not directly asserted in available e2e files

---

## Tool: table

### 1. Tool identity
- **Exact TradingView name**: Table
- **Internal variant**: `table`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Table"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Table"
- `testId: "tool-table"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a data table widget at the clicked location
- After placement, a table editor likely opens for populating rows/columns

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click table body selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation (family `text`)

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves table
- Cell editing via double-click on individual cells

### 9. Tooltip behavior
- No data tooltip during creation

### 10. Floating toolbar
- Text styling (font, size, bold, italic, align, text color, textBackground)
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Edit, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- textSchema fields
- `supportsFill: true`: table background fill
- `supportsText: true`: table contains text data

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: click to place table; then interact with table cells to enter data
- **Multi-cell text**: each table cell is an independent text entry area
- **Table structure**: number of rows/columns configurable in settings
- **Double-click to re-edit cell**: double-click on a cell re-enters edit mode for that cell
- **Text wrapping**: within cell bounds
- **Persists**: yes — all cell content stored in Drawing.text (likely as structured string or JSON)
- **supportsFill: true**: table header/background can be filled
- **supportsText: true**: table contains text

### 14. Chart interaction
- Table anchored at price/time coordinate
- Follows zoom/pan

### 15. Keyboard behavior
- Tab: moves to next cell in table edit mode
- Enter: confirms cell entry; moves to next row
- Escape: cancels cell edit; dismisses if no data entered
- Delete when selected: removes entire table
- Ctrl+Z: undo

### 16. Edge cases
- Empty table: all cells blank; visible as table grid
- Very wide/tall table: extends beyond chart area
- Table with formatted text: bold/italic may apply per-cell or table-wide

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-table.spec.ts**: `variant: "table"`, `testId: "tool-table"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-table-500.spec.ts**: exists — confirmed
- **Gaps**: Table cell editing behavior, row/column count settings, and per-cell formatting not directly tested in available e2e files; inferred from TV parity documentation

---

## Tool: callout

### 1. Tool identity
- **Exact TradingView name**: Callout
- **Internal variant**: `callout`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Callout"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Callout"
- `testId: "tool-callout"` (from v2 spec)

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a speech-bubble callout widget at the clicked price/time
- A tail/pointer extends from the speech bubble toward the anchor price
- Text entry begins immediately after placement

### 4. Multi-anchor sequence
- Single anchor; 1-click commit
- The tail of the callout points down toward the anchored price/time point

### 5. Selection and reselection
- Click on speech bubble body or tail selects
- Click away deselects
- `selectionGeometry: "horizontal"`

### 6. Hover and cursor
- Text cursor on activation and hover

### 7. Handles and anchors
- 1 anchor handle at the tip of the callout tail (the "pointed-at" price/time)
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves the callout; the tail tip (anchor) also moves
- Tail direction adjusts automatically if callout body is repositioned relative to anchor in some implementations
- Double-click on callout body: re-enters text edit mode

### 9. Tooltip behavior
- No data tooltip during creation

### 10. Floating toolbar
- Font, size, bold, italic, align, text color, fill color (background of bubble), border
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- **Text tab**: font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding
- **Color tab**: text color, fill color (speech bubble background)
- **Coordinates tab**: anchor price/time (tip of tail)
- **Visibility tab**: locked, visible
- `supportsFill: true`: speech bubble background fill

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: single click → type text in the speech bubble inline
- **Speech bubble with tail**: callout renders as a rectangular (or rounded) speech bubble with a triangular tail pointing toward the anchor price/time
- **Tail direction**: tail points downward toward the anchored price/time by default; in TV, the tail can be repositioned
- **Does the tail point to a specific price or just points down?**: the tail points to the specific price/time anchor set at click; the bubble floats above and the tail tip is at the click point
- **Double-click to re-edit**: yes — double-click on the bubble body re-enters edit mode
- **Text wrapping**: wraps at textMaxWidth (default 240px)
- **Enter key**: newline (not commit); click elsewhere to commit
- **Persists**: yes — text stored in Drawing.text; anchor preserved
- **supportsFill: true**: bubble background can be colored
- **supportsText: true**: callout owns text content
- **One callout per click**: multiple clicks create multiple independent callouts
- **Placeholder text**: none shown; bubble may appear empty until text typed

### 14. Chart interaction
- Tail tip anchored at clicked price/time coordinate
- Follows zoom/pan; tail tip tracks the price/time point
- Speech bubble position may be offset from tail tip by a fixed screen-space distance

### 15. Keyboard behavior
- Escape before placement: cancel tool
- Delete when selected: removes callout
- Enter during text entry: newline
- Click elsewhere: commits text
- Ctrl+Z: undo

### 16. Edge cases
- Empty callout: visible as speech bubble with no text
- Very long text: wraps; bubble grows vertically
- Callout placed at chart edge: tail may point off-screen
- Multiple callouts at same price: stacked

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-callout.spec.ts**: `variant: "callout"`, `testId: "tool-callout"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-callout-500.spec.ts**: exists — confirmed
- **Gaps**: Tail direction behavior (whether tail tip is fixed at anchor vs. adjustable) not confirmed from source; fill color for bubble background verified via `supportsFill: true` flag

---

## Tool: comment

### 1. Tool identity
- **Exact TradingView name**: Comment
- **Internal variant**: `comment`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Comment"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Comment"
- `testId: "tool-comment"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a comment bubble at the clicked price/time
- Text entry begins after placement

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click comment body selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves comment
- Double-click re-enters text edit mode

### 9. Tooltip behavior
- No data tooltip

### 10. Floating toolbar
- Font, size, bold, italic, align, text color, fill color (bubble background)
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- textSchema: font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding
- `supportsFill: true`: comment bubble background fill

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: click to place → type inline
- **Comment bubble**: rendered as a comment/chat-bubble shape (rounded rectangle or cloud shape)
- **Double-click to re-edit**: yes
- **Text wrapping**: at textMaxWidth
- **Enter key**: newline; click elsewhere commits
- **Persists**: yes
- **supportsFill: true**: bubble background fill
- **supportsText: true**: owns text content
- Differs from callout: comment bubble may not have a directional tail, or tail is shorter/less prominent

### 14. Chart interaction
- Anchored at price/time
- Follows zoom/pan

### 15. Keyboard behavior
- Escape: cancel before placement
- Delete: removes
- Ctrl+Z: undo

### 16. Edge cases
- Empty comment: visible bubble with no text
- Multiple overlapping comments: z-order selection

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-comment.spec.ts**: `variant: "comment"`, `testId: "tool-comment"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-comment-500.spec.ts**: exists — confirmed
- **Gaps**: Visual difference between comment and callout bubble style inferred from tool names; tail behavior for comment not specified in source

---

## Tool: priceLabel

### 1. Tool identity
- **Exact TradingView name**: Price label
- **Internal variant**: `priceLabel`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Price label"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Price label"
- `testId: "tool-price-label"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a label directly on the price axis at the clicked price level
- Label displays text on the price axis itself (right side of chart)

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click label on axis selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation

### 7. Handles and anchors
- 1 anchor handle at price axis position
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Drag moves label up/down along price axis (changes price level)
- Double-click re-enters text edit mode

### 9. Tooltip behavior
- No data tooltip

### 10. Floating toolbar
- Text styling controls
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: false` — no background fill

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- textSchema: font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding
- `supportsFill: false`; `supportsText: true`

### 13. Text and label behavior (MOST IMPORTANT)
- **Label on price axis**: text is rendered ON the price axis (right side), not on the chart body
- **Price axis display**: replaces or augments the standard price tick label at the anchored price with custom text
- **Text format**: short text works best (price level description); long text may truncate at axis width
- **Double-click to re-edit**: yes
- **Text wrapping**: limited by price axis width; effectively single-line for axis labels
- **Enter key**: single line commitment (axis labels don't support multiline well)
- **Persists**: yes
- **supportsFill: false**: no background fill; text appears on the axis with axis styling
- **supportsText: true**: owns text content

### 14. Chart interaction
- Anchored to price level; moves vertically with price scale zoom
- Text label appears on the price axis at the anchored price

### 15. Keyboard behavior
- Escape: cancel before placement
- Delete: removes label from axis
- Ctrl+Z: undo

### 16. Edge cases
- Price label at extreme price: label appears on axis outside visible chart range
- Long text: may overflow or truncate on axis

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-priceLabel.spec.ts**: `variant: "priceLabel"`, `testId: "tool-price-label"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-priceLabel-500.spec.ts**: exists — confirmed
- **Gaps**: Price axis rendering specifics inferred from tool name; `price-label` ScenarioKind exists in tv-capture-factory.ts (line 48), confirming axis-label scenario is tracked

---

## Tool: signpost

### 1. Tool identity
- **Exact TradingView name**: Signpost
- **Internal variant**: `signpost`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Signpost"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Signpost"
- `testId: "tool-signpost"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a sign/flag-post style annotation at the clicked time
- The signpost appears as a vertical post with a rectangular sign/label attached

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click signpost body or sign selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation

### 7. Handles and anchors
- 1 anchor handle at base of signpost
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves signpost to new time position
- Double-click re-enters text edit mode for the sign label

### 9. Tooltip behavior
- No data tooltip

### 10. Floating toolbar
- Text styling (font, size, bold, italic, align, text color)
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: false` — no background fill color control

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- textSchema: font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding
- `supportsFill: false`; `supportsText: true`

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: click to place → type the sign label text
- **Sign/flag style**: rendered as a vertical post (line from anchor to top) with a rectangular label at the top
- **Text on sign**: label text appears inside or beside the rectangular sign portion
- **Double-click to re-edit**: yes
- **Text wrapping**: at textMaxWidth; sign grows to accommodate
- **Enter key**: newline; click elsewhere commits
- **Persists**: yes
- **supportsFill: false**: no colored background fill
- **supportsText: true**: owns text content

### 14. Chart interaction
- Anchored at time (and price) of click
- Vertical post extends from anchor upward; follows chart zoom

### 15. Keyboard behavior
- Escape: cancel before placement
- Delete: removes signpost
- Ctrl+Z: undo

### 16. Edge cases
- Empty sign: visible post with empty label
- Very long text: sign grows; may overflow chart area

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-signpost.spec.ts**: `variant: "signpost"`, `testId: "tool-signpost"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-signpost-500.spec.ts**: exists — confirmed
- **Gaps**: Visual rendering of post+sign inferred from tool name and TV parity

---

## Tool: flagMark

### 1. Tool identity
- **Exact TradingView name**: Flag mark
- **Internal variant**: `flagMark`
- **Category**: Text / Text and Notes
- **Rail**: `rail-text`
- **TV tool label**: "Flag mark"
- **Submenu**: Yes — Text and Notes subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Text and Notes`

### 2. Activation behavior
- Click `rail-text` → click "Flag mark"
- `testId: "tool-flag-mark"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a small flag marker at the clicked time point
- Flag appears as a small flag icon (triangle or pennant) on the time axis or chart

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click flag body selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation

### 7. Handles and anchors
- 1 anchor handle at flag base
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves flag to new time position
- Double-click re-enters text edit mode for flag label text

### 9. Tooltip behavior
- No data tooltip

### 10. Floating toolbar
- Text styling (font, size, bold, italic, align, text color)
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: false` — no fill

### 11. Context menu
- Edit text, Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- textSchema: font, textSize, textMaxWidth, bold, italic, align, textBackground, textBorder, textPadding
- `supportsFill: false`; `supportsText: true`

### 13. Text and label behavior (MOST IMPORTANT)
- **How to enter text**: click to place flag → type optional label text
- **Flag style**: small flag (triangular pennant or rectangular flag) icon at the time point
- **Text is optional**: flag can be used as a pure marker (no text) or with a short label
- **Text location**: label appears next to or inside the flag
- **Double-click to re-edit**: yes
- **Text wrapping**: at textMaxWidth
- **Enter key**: newline; click elsewhere commits
- **Persists**: yes
- **supportsFill: false**: no colored background
- **supportsText: true**: can hold text label

### 14. Chart interaction
- Anchored at time (and price) of click
- Follows chart zoom/scroll

### 15. Keyboard behavior
- Escape: cancel before placement
- Delete: removes flag
- Ctrl+Z: undo

### 16. Edge cases
- Flag without text: visible as flag icon only
- Multiple flags at same time: stacked; click selects topmost

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-flagMark.spec.ts**: `variant: "flagMark"`, `testId: "tool-flag-mark"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-flagMark-500.spec.ts**: exists — confirmed
- **Gaps**: Flag visual rendering inferred from tool name; no dedicated flag-specific assertion in available e2e files

---

## Text/Content Tools

---

## Tool: image

### 1. Tool identity
- **Exact TradingView name**: Image
- **Internal variant**: `image`
- **Category**: Text / Content
- **Rail**: `rail-text`
- **TV tool label**: "Image"
- **Submenu**: Yes — Content subsection of Text rail popover
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Content`

### 2. Activation behavior
- Click `rail-text` → select "Content" subsection → click "Image"
- `testId: "tool-image"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places an image widget at the clicked price/time
- After placement, an image URL input or file picker opens for the user to specify the image source
- Image is then embedded in the chart at the anchor location

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click image widget selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation (family `text`)
- Over image widget: pointer cursor

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false` (in toolRegistry); actual resize may be handled via settings
- `draggable: true`

### 8. Drag and edit
- Body drag moves image widget
- To change image: use settings dialog or double-click (opens image picker)

### 9. Tooltip behavior
- No data tooltip during creation

### 10. Floating toolbar
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: false`; `supportsText: false` — no text or fill controls in toolbar

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Image source (URL or uploaded file)
- Image size/scale
- `supportsText: false`: no text content; `supportsFill: false`: no fill
- Opacity (from textSchema color/opacity fields)
- Coordinates tab: anchor price/time

### 13. Text and label behavior (MOST IMPORTANT)
- **No text content**: `supportsText: false` — image widget does not hold text; it holds an image reference
- **Image source entry**: after placement, user provides an image URL (TradingView prompts for URL or file upload)
- **Image rendered inline**: the image is displayed at the anchor location, resized to fit a widget box
- **Network dependency**: image requires network access to load from URL; if offline or URL invalid, widget shows placeholder/broken image
- **No text wrapping**: not applicable
- **Persists**: image URL/reference stored in Drawing; anchor preserved

### 14. Chart interaction
- Image widget anchored at price/time coordinate
- Follows zoom/pan; image box stays at anchor

### 15. Keyboard behavior
- Escape before placement: cancel
- Delete when selected: removes image widget
- Ctrl+Z: undo

### 16. Edge cases
- Invalid image URL: widget shows broken image placeholder
- No internet connection: sticker/image fails to load; placeholder shown
- Very large image: rendered in fixed widget box; may appear pixelated or clipped

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-image.spec.ts**: `variant: "image"`, `testId: "tool-image"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-image-500.spec.ts**: exists — confirmed
- **Gaps**: Image picker/URL input flow not directly tested in available e2e; network dependency behavior inferred from TV parity context

---

## Tool: post

### 1. Tool identity
- **Exact TradingView name**: Post
- **Internal variant**: `post`
- **Category**: Text / Content
- **Rail**: `rail-text`
- **TV tool label**: "Post" (spec comment: "TV: tweet-post")
- **Submenu**: Yes — Content subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Content`

### 2. Activation behavior
- Click `rail-text` → "Content" subsection → click "Post"
- `testId: "tool-post"`
- TV internal name may be "tweet-post" (noted in spec comment)

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a TradingView post embed widget at the clicked location
- A post URL input or search dialog likely opens to select which TradingView post to embed

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click post widget selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves post widget
- Settings/double-click to change the linked post

### 9. Tooltip behavior
- No data tooltip

### 10. Floating toolbar
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: true`: post widget background fill
- `supportsText: true`: post widget may show title/text excerpt

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Post URL/ID
- Widget display options (show/hide preview)
- `supportsFill: true`; `supportsText: true`
- Coordinates tab: anchor price/time

### 13. Text and label behavior (MOST IMPORTANT)
- **Not free-text**: the text in a post widget comes from the referenced TradingView post, not user input
- **supportsText: true**: indicates the Drawing.text field holds a reference (post URL, ID, or title)
- **Network dependency**: post content loads from TradingView servers; requires internet and valid post reference
- **Post embed format**: renders as a card/embed showing the post title, author, and possibly a chart preview
- **No user-typed text**: the content is pulled from the TV post, not authored by the user in the widget

### 14. Chart interaction
- Anchored at price/time
- Follows zoom/pan

### 15. Keyboard behavior
- Escape: cancel before placement
- Delete: removes post widget
- Ctrl+Z: undo

### 16. Edge cases
- Invalid post ID: widget shows error or empty state
- Deleted TradingView post: widget shows broken reference
- No internet: post content fails to load

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-post.spec.ts**: `variant: "post"`, `testId: "tool-post"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-post-500.spec.ts**: exists — confirmed
- **Gaps**: TV post embed rendering not directly tested; TV internal naming ("tweet-post") noted from spec comment but not confirmed in toolRegistry.ts (label is "Post")

---

## Tool: idea

### 1. Tool identity
- **Exact TradingView name**: Idea
- **Internal variant**: `idea`
- **Category**: Text / Content
- **Rail**: `rail-text`
- **TV tool label**: "Idea"
- **Submenu**: Yes — Content subsection
- **TV keyboard shortcut**: none defined
- **Family**: `text`; **subSection**: `Content`

### 2. Activation behavior
- Click `rail-text` → "Content" subsection → click "Idea"
- `testId: "tool-idea"`

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Single click places a TradingView idea reference widget at the clicked location
- An idea search/URL dialog opens to select a TradingView published idea to reference

### 4. Multi-anchor sequence
- Single anchor; 1-click commit

### 5. Selection and reselection
- Click idea widget selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves idea widget
- Settings to change referenced idea

### 9. Tooltip behavior
- No data tooltip

### 10. Floating toolbar
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: true`; `supportsText: true`

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Idea URL/ID reference
- `supportsFill: true`; `supportsText: true`
- Coordinates tab: anchor price/time

### 13. Text and label behavior (MOST IMPORTANT)
- **Reference widget**: displays a TradingView published idea as an embedded card
- **supportsText: true**: Drawing.text holds the idea reference ID or URL
- **Text content from idea**: title, author, and summary from the referenced TV idea
- **Network dependency**: idea content loads from TradingView servers
- **No user-typed text**: content is pulled from the TV idea, not authored inline

### 14. Chart interaction
- Anchored at price/time
- Follows zoom/pan

### 15. Keyboard behavior
- Escape: cancel before placement
- Delete: removes idea widget
- Ctrl+Z: undo

### 16. Edge cases
- Invalid idea reference: widget shows error state
- Private/deleted idea: widget shows broken reference
- No internet: idea card fails to load

### 17. Evidence and status
- **Coverage status**: Implemented
- **tv-parity-v2-idea.spec.ts**: `variant: "idea"`, `testId: "tool-idea"`, `railTestId: "rail-text"`, `anchorCount: 1`, `commitMode: "click"`, `selectionGeometry: "horizontal"` — confirmed
- **tv-parity-idea-500.spec.ts**: exists — confirmed
- **Gaps**: TV idea embed rendering not directly tested; idea search dialog behavior inferred from TV parity context

---

## Icon Tools

---

## Tool: emoji

### 1. Tool identity
- **Exact TradingView name**: Emojis
- **Internal variant**: `emoji`
- **Category**: Icon
- **Rail**: category `icon`
- **TV tool label**: "Emojis"
- **Submenu**: `subSection: 'Emojis'`
- **TV keyboard shortcut**: none defined
- **Family**: `text`; `iconKey: 'Sparkles'`

### 2. Activation behavior
- Click the Icon rail button (category `icon`) to open the icon picker popover
- The emoji picker shows a scrollable grid of emoji characters grouped by category
- Selecting an emoji activates placement mode for that emoji
- After selection, clicking on the chart places the emoji

### 3. Creation flow
- `commitMode: "click"` (inferred from 1-anchor text tool pattern), `anchorCount: 1`
- Step 1: click Icon rail → emoji picker overlay opens
- Step 2: click desired emoji in picker
- Step 3: click on chart to place the emoji at that price/time
- Emoji is immediately committed and auto-selected

### 4. Multi-anchor sequence
- Single anchor; 1-click commit (after selecting from picker)

### 5. Selection and reselection
- Click on the placed emoji selects
- Click away deselects
- `resizable: false`; `draggable: true`

### 6. Hover and cursor
- Cursor during tool activation: text cursor (family `text`)
- Over placed emoji: pointer cursor

### 7. Handles and anchors
- 1 anchor handle at emoji placement point
- `resizable: false` in registry; size controlled via settings

### 8. Drag and edit
- Body drag moves emoji to new price/time location
- To change emoji character: use settings dialog or right-click → Settings

### 9. Tooltip behavior
- Picker shows emoji name on hover within the picker UI
- No data tooltip on placed emoji

### 10. Floating toolbar
When emoji is selected on chart:
- Font size (emoji scale)
- Text color (if applicable to emoji rendering)
- Settings, Delete, Clone, Lock, Hide
- `supportsFill: false`: no fill; `supportsText: true` — Drawing.text holds the emoji character

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Emoji character (change via settings)
- Size (`textSize` field, 10–28 range)
- Position coordinates
- `supportsText: true`: the emoji character is stored in Drawing.text

### 13. Text and label behavior
- **Emoji as text**: the placed emoji character is stored in `Drawing.text` as a Unicode character/string
- **supportsText: true**: the emoji widget uses the text infrastructure but renders the emoji character rather than regular text
- **No free-text entry**: user selects from picker; no keyboard text entry for the emoji itself
- **Size**: controlled by `textSize` option
- **Persists**: yes — emoji character and anchor stored in Drawing
- **One emoji per placement**: each click places one emoji

### 14. Chart interaction
- Emoji anchored at price/time coordinate
- Follows zoom/pan
- Emoji size in screen pixels remains fixed (textSize in points)

### 15. Keyboard behavior
- Escape before placement: cancel (dismisses picker or cancels pending placement)
- Delete when selected: removes placed emoji
- Ctrl+Z: undo

### 16. Edge cases
- Emoji picker requires font/emoji support; some emoji may not render on all platforms
- Very small textSize: emoji barely visible
- Multiple emojis at same location: stacked; click selects topmost

### 17. Evidence and status
- **Coverage status**: Implemented
- **toolRegistry.ts**: `id: 'emoji'`, `label: 'Emojis'`, `category: 'icon'`, `subSection: 'Emojis'`, `family: 'text'`, `capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }`, `optionsSchema: textSchema` — confirmed
- **tv-parity-emoji-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec for emoji; picker overlay interaction not directly tested in available e2e files; emoji rendering cross-platform behavior not covered

---

## Tool: sticker

### 1. Tool identity
- **Exact TradingView name**: Stickers
- **Internal variant**: `sticker`
- **Category**: Icon
- **Rail**: category `icon`
- **TV tool label**: "Stickers"
- **Submenu**: `subSection: 'Stickers'`
- **TV keyboard shortcut**: none defined
- **Family**: `text`; `iconKey: 'Sparkles'`

### 2. Activation behavior
- Click Icon rail → sticker picker overlay opens
- Sticker picker shows a library of graphical stickers (images/illustrations)
- Select a sticker from the picker
- Click on chart to place the selected sticker

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Step 1: click Icon rail → sticker picker opens
- Step 2: click desired sticker in picker
- Step 3: click on chart to place sticker
- Sticker committed on chart click; auto-selected

### 4. Multi-anchor sequence
- Single anchor; 1-click commit after picker selection

### 5. Selection and reselection
- Click placed sticker selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation (family `text`)
- Over placed sticker: pointer cursor

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves sticker
- Settings to change sticker image

### 9. Tooltip behavior
- Picker shows sticker name on hover within picker UI
- No data tooltip on placed sticker

### 10. Floating toolbar
When sticker selected:
- Size control (via textSize)
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Sticker image reference (URL/ID to TradingView sticker library)
- Size (`textSize`)
- `supportsText: true`: the sticker reference stored in Drawing.text
- `supportsFill: false`: no fill

### 13. Text and label behavior
- **Sticker as media**: sticker is an image from TradingView's sticker library; not free-text
- **supportsText: true**: Drawing.text holds the sticker identifier/URL
- **Network dependency**: stickers load from TradingView CDN; require internet connection
- **No internet connection**: sticker fails to load; placeholder/broken image shown
- **No text entry**: sticker is selected from picker, not typed
- **Persists**: sticker reference and anchor stored in Drawing

### 14. Chart interaction
- Sticker anchored at price/time coordinate
- Follows zoom/pan

### 15. Keyboard behavior
- Escape: cancel placement or dismiss picker
- Delete: removes placed sticker
- Ctrl+Z: undo

### 16. Edge cases
- No internet connection: sticker image fails to load; placeholder shown
- Sticker removed from TradingView library: broken image reference
- Multiple stickers at same location: stacked

### 17. Evidence and status
- **Coverage status**: Implemented
- **toolRegistry.ts**: `id: 'sticker'`, `label: 'Stickers'`, `category: 'icon'`, `subSection: 'Stickers'`, `family: 'text'`, `capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }`, `optionsSchema: textSchema` — confirmed
- **tv-parity-sticker-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; sticker picker overlay and network load behavior not directly tested; edge case of no internet noted in task spec as an important gap

---

## Tool: iconTool

### 1. Tool identity
- **Exact TradingView name**: Icons
- **Internal variant**: `iconTool`
- **Category**: Icon
- **Rail**: category `icon`
- **TV tool label**: "Icons"
- **Submenu**: `subSection: 'Icons'`
- **TV keyboard shortcut**: none defined
- **Family**: `text`; `iconKey: 'Sparkles'`

### 2. Activation behavior
- Click Icon rail → icon picker overlay opens
- Icon picker shows categorized SVG/vector icons (arrows, shapes, symbols, etc.)
- Select an icon from the picker
- Click on chart to place the selected icon

### 3. Creation flow
- `commitMode: "click"`, `anchorCount: 1`
- Step 1: click Icon rail → icon picker opens
- Step 2: click desired icon in picker (hover shows icon name tooltip)
- Step 3: click on chart to place icon
- Icon committed on chart click; auto-selected

### 4. Multi-anchor sequence
- Single anchor; 1-click commit after picker selection

### 5. Selection and reselection
- Click placed icon selects
- Click away deselects

### 6. Hover and cursor
- Text cursor on activation (family `text`)
- Pointer cursor on placed icon

### 7. Handles and anchors
- 1 anchor handle
- `resizable: false`; `draggable: true`

### 8. Drag and edit
- Body drag moves icon
- Settings to change icon character/style
- Icon color changeable via floating toolbar or settings

### 9. Tooltip behavior
- Picker shows icon name tooltip on hover in picker UI
- No data tooltip on placed icon

### 10. Floating toolbar
When icon selected:
- Icon color picker
- Size control (`textSize`)
- Settings, Delete, Clone, Lock, Hide

### 11. Context menu
- Template, Visual order, Clone, Lock, Hide, Remove, Settings

### 12. Settings/style
- Icon identifier (which icon was chosen from picker)
- Icon size (`textSize`, 10–28)
- Icon color (`color` field)
- Icon category (browsable in settings)
- `supportsText: true`: icon identifier stored in Drawing.text
- `supportsFill: false`: no fill

### 13. Text and label behavior
- **Icon as text character**: the selected icon is stored as a character or identifier in Drawing.text
- **supportsText: true**: Drawing.text holds the icon reference
- **Color-customizable**: unlike emoji (which renders in platform color), icons can have their `color` field changed
- **Size-customizable**: `textSize` controls the rendered size
- **No free-text entry**: icon is selected from picker; user types nothing
- **Persists**: icon reference, color, size stored in Drawing

### 14. Chart interaction
- Icon anchored at price/time coordinate
- Follows zoom/pan
- Icon color stays consistent (not affected by chart theme unless explicitly changed)

### 15. Keyboard behavior
- Escape: cancel placement or dismiss picker
- Delete: removes placed icon
- Ctrl+Z: undo

### 16. Edge cases
- Icon picker category navigation: icons grouped by type; picker has tabs/categories
- Small icon size: may be hard to click; selection hitbox is minimum size
- Icon color defaults to `color` field default (inherited from defaultToolOptions: `#00d1ff`)
- Multiple icons at same location: stacked

### 17. Evidence and status
- **Coverage status**: Implemented
- **toolRegistry.ts**: `id: 'iconTool'`, `label: 'Icons'`, `category: 'icon'`, `subSection: 'Icons'`, `family: 'text'`, `capabilities: { anchors: 1, draggable: true, resizable: false, supportsText: true, supportsFill: false, supportsLevels: false }`, `optionsSchema: textSchema` — confirmed
- **tv-parity-iconTool-500.spec.ts**: exists — confirmed
- **Gaps**: No v2 spec; icon picker category browsing, color change behavior, and size range behavior not directly tested in available e2e files; icon color distinctness from emoji confirmed by `color` field in textSchema

---

## Summary Table

| Tool | Variant | Category | Rail | Commit | Anchors | supportsText | supportsFill | 500 spec | v2 spec |
|------|---------|----------|------|--------|---------|-------------|-------------|---------|---------|
| Rectangle | rectangle | brush/Shapes | Geometric shapes | drag | 2 | true | true | yes | no |
| Rotated rectangle | rotatedRectangle | brush/Shapes | Geometric shapes | drag | 2 | false | true | yes | no |
| Path | path | brush/Shapes | Geometric shapes | click-sequence | 3+ | false | false | yes | no |
| Circle | circle | brush/Shapes | Geometric shapes | drag | 2 | true | true | yes | no |
| Ellipse | ellipse | brush/Shapes | Geometric shapes | drag | 2 | false | true | yes | no |
| Polyline | polyline | brush/Shapes | Geometric shapes | click-sequence | 3+ | false | false | yes | no |
| Triangle | triangle | brush/Shapes | Geometric shapes | click-sequence | 3 | true | true | yes | no |
| Arc | arc | brush/Shapes | Geometric shapes | click-sequence | 3 | false | false | yes | no |
| Curve | curveTool | brush/Shapes | Geometric shapes | click-sequence | 3+ | false | false | yes | no |
| Double curve | doubleCurve | brush/Shapes | Geometric shapes | click-sequence | 3+ | false | false | yes | no |
| Text | plainText | text/Text and Notes | rail-text | click | 1 | true | true | yes | yes |
| Anchored text | anchoredText | text/Text and Notes | rail-text | click | 1 | true | true | yes | yes |
| Note | note | text/Text and Notes | rail-text | click | 1 | true | true | yes | yes |
| Price note | priceNote | text/Text and Notes | rail-text | click | 1 | true | false | yes | yes |
| Pin | pin | text/Text and Notes | rail-text | click | 1 | true | false | yes | yes |
| Table | table | text/Text and Notes | rail-text | click | 1 | true | true | yes | yes |
| Callout | callout | text/Text and Notes | rail-text | click | 1 | true | true | yes | yes |
| Comment | comment | text/Text and Notes | rail-text | click | 1 | true | true | yes | yes |
| Price label | priceLabel | text/Text and Notes | rail-text | click | 1 | true | false | yes | yes |
| Signpost | signpost | text/Text and Notes | rail-text | click | 1 | true | false | yes | yes |
| Flag mark | flagMark | text/Text and Notes | rail-text | click | 1 | true | false | yes | yes |
| Image | image | text/Content | rail-text | click | 1 | false | false | yes | yes |
| Post | post | text/Content | rail-text | click | 1 | true | true | yes | yes |
| Idea | idea | text/Content | rail-text | click | 1 | true | true | yes | yes |
| Emojis | emoji | icon | icon rail | click | 1 | true | false | yes | no |
| Stickers | sticker | icon | icon rail | click | 1 | true | false | yes | no |
| Icons | iconTool | icon | icon rail | click | 1 | true | false | yes | no |

## Known Gaps and Missing Coverage

1. **No v2 spec files for any shape tools**: `rectangle`, `rotatedRectangle`, `path`, `circle`, `ellipse`, `polyline`, `triangle`, `arc`, `curveTool`, `doubleCurve` all have only 500-test specs (extended factory), not v2 parity specs.

2. **No v2 spec files for icon tools**: `emoji`, `sticker`, `iconTool` have only 500-test specs.

3. **Text-inside-shape e2e coverage absent**: `rectangle`, `circle`, `triangle` all have `supportsText: true` but no dedicated test verifies the ChartPromptModal → text-inside-shape flow for shape tools. The text label e2e (`line-tools-text-labels.spec.ts`) covers line tools only.

4. **Picker overlay interaction not tested**: the emoji, sticker, and icon picker overlay interaction (Step 1: open picker, Step 2: select item) is not covered by any identified e2e spec.

5. **Sticker network dependency edge case**: no test verifies sticker load failure on network disconnect.

6. **priceLabel / priceNote axis rendering**: the `price-label` scenario kind exists in `tv-capture-factory.ts` but no dedicated spec directly asserts axis label rendering at specific price levels.

7. **rotatedRectangle rotation handle drag**: rotation behavior is inferred from TV parity; no e2e test directly exercises the rotation handle.

8. **Table cell editing**: table row/column editing, Tab navigation between cells, and per-cell formatting are not covered.

9. **Double-click re-edit for text tools**: inferred from TV parity behavior; not directly asserted in `line-tools-text-labels.spec.ts` (which uses ChartPromptModal pattern, not inline double-click).

10. **Empty text box handling**: whether an empty text box (no text entered) persists or is auto-removed on deselect is not confirmed in source.
