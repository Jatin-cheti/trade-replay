# TradingView Parity Implementation Plan

**Scope:** implementation planning only. Do not treat this document as permission to implement every TradingView behavior. It converts the verified/high-confidence evidence in `docs/COMPLETE_COVERAGE.md` and `docs/TV_PARITY_AUDIT.md` into a staged engineering plan.

**Evidence rules used here:**

- Implementation-ready: `COMPLETE_LIVE`, `COMPLETE_DOM`, and `COMPLETE_LIVE_SUMMARY` when the behavior is narrow and clearly described.
- Visual implementation-ready: `SCREENSHOT_ONLY` only for visible rendering, placement, labels, and toolbar inventory where exact functional semantics are not required.
- Planning input only: `SUMMARY_DERIVED`, including Codex 2 Pass 4 imported results whose raw evidence/screenshots are not local to this repo.
- Not implementation truth: `MANUAL_VERIFICATION_REQUIRED`, `BLOCKED_CANVAS_HIT_TESTING`, `BLOCKED_TIMING_OR_DESELECT`, `CHART_SETTINGS_ONLY`, `CONFLICTING_REQUIRES_RETRY`, `SOURCE_SCHEMA_ONLY`, and `FACTORY_CONFIG_ONLY`.

## 1. Verified Behaviors Ready For Implementation

### Trend Line

- Floating toolbar inventory is ready from `COMPLETE_DOM`: selected toolbar exposes `templates`, `line-tool-color`, `text-color`, `line-tool-width`, `style`, `settings`, `add-alert`, `lock`, `remove`, and `more`.
- Width dropdown opening is ready from `COMPLETE_LIVE` + `SCREENSHOT_ONLY`: options are `1px`, `2px`, `3px`, `4px`, with `2px` selected by default.
- Style dropdown opening is ready from `COMPLETE_LIVE` + `SCREENSHOT_ONLY`: options are `Line`, `Dashed line`, and `Dotted line`, with `Line` selected by default.
- Stroke/text color picker opening is ready from `COMPLETE_LIVE` + `SCREENSHOT_ONLY`: swatches, custom color add control, and opacity slider are visible.
- More menu opening is ready from `COMPLETE_LIVE` + `SCREENSHOT_ONLY`: `Visual order`, `Visibility on intervals`, `Clone`, `Copy`, and `Hide` are visible.
- Endpoint handles are visually ready from `SCREENSHOT_ONLY`: two blue/white circular endpoint handles.
- Drawing-specific settings and context menu are ready from `COMPLETE_LIVE`: settings title `Trendline`; tabs `Style`, `Text`, `Coordinates`, `Visibility`; context menu includes drawing-object actions.

### Info Line

- Drawing-specific settings/context are ready from `COMPLETE_LIVE`.
- Tooltip/value visual formatting is ready only for first-pass visual implementation from `SCREENSHOT_ONLY`: price change, percent change, bar count/days, distance in px, and angle rows were visible. Example captured values included `74.75 (5.24%), 1,495`, `45 bars (68d), distance: 314 px`, and `30.65 deg`.
- Final exact dynamic formatting remains blocked for DOM/exact-value extraction and should be tested visually.

### Trend Angle

- Drawing-specific settings/context are ready from `COMPLETE_LIVE`.
- Angle helper/preview behavior is ready for visual implementation from `SCREENSHOT_ONLY`: line preview shows an angle label and dashed guide geometry during creation.
- Exact angle text and dynamic value update remain visual/manual.

### Fib Extension

- Activation and creation are ready from `COMPLETE_LIVE`: current TradingView menu location is Gann and Fibonacci tools > Fibonacci > `Trend-based fib extension`.
- Creation uses 3 anchors.
- Selected levels are visual-ready from `SCREENSHOT_ONLY`: visible levels include `0`, `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1`, `1.618`, `2.618`, and `3.618`.

### Fib Channel

- Activation/menu location is planning-ready from `COMPLETE_LIVE_SUMMARY` + `SCREENSHOT_EXTERNAL`: reported under `linetool-group-gann-and-fibonacci`.
- Treat as a menu/activation planning item until raw Codex 2 artifacts are copied locally.

### Date And Price Range

- Menu location is planning-ready from `COMPLETE_LIVE_SUMMARY` + `SCREENSHOT_EXTERNAL`: reported under `linetool-group-prediction-and-measurement`.
- Treat as a menu/activation planning item only; exact metric formatting and settings remain blocked.

### Representative Context Menus

Use drawing-specific context menu implementation plans only for sampled verified tools:

- Local `COMPLETE_LIVE`: Trend Line, Info Line, Trend Angle, Pitchfork, Inside Pitchfork, Fib Retracement, Gann Box, Pitchfan, ABCD Pattern.
- Imported `COMPLETE_LIVE_SUMMARY` + `SCREENSHOT_EXTERNAL`: Trend Line, Info line, Parallel Channel, Pitchfork, Fib Retracement, XABCD Pattern, Text, Price Range, Long Position, Rectangle.

Shared menu action model can be planned for sampled tools only: settings, template, visual order, visibility on intervals, object tree, clone/copy, lock, hide, remove/delete, and add-alert where observed.

### Text Tool

- Basic create/type/drag smoke is ready from `COMPLETE_LIVE` + `SCREENSHOT_ONLY`: text can be activated, typed, selected, dragged/drag-attempted, and undone in a basic pass.
- Do not implement advanced text edit/delete/copy/undo-redo/persistence as complete yet.

### Price Range

- Metric label visual behavior is ready from `SCREENSHOT_ONLY`: preview label can show price, percent, and metric text, with example `93.45 (6.63%) 1,869`.
- Exact DOM extraction, dynamic update while dragging, settings, and context remain blocked except imported representative context summary.

### Crowded Chart

Use crowded-chart planning only for sampled tools from `COMPLETE_LIVE_SUMMARY` + `SCREENSHOT_EXTERNAL`:

- Trend Line
- Fib Retracement
- Text
- Price Range
- Long Position

This supports architecture and tests for selection isolation, but not a blanket all-tool parity claim.

## 2. Behaviors Not Ready For Implementation Truth

Keep these out of implementation acceptance criteria until more evidence exists:

- Unsampled context menus.
- Unsampled crowded-chart behavior.
- Full toolbar side effects for every tool, including lock, hide, delete, clone/copy, add alert, templates, visibility intervals, and settings effects.
- Exact handle pixel semantics for all tools.
- Text edit/delete/copy/undo-redo/persistence for all applicable tools.
- Tooltip DOM extraction and exact dynamic reads.
- Anchored text.
- Image.
- Post.
- Idea.
- Sticker.
- Emoji.
- Any behavior backed only by `SOURCE_SCHEMA_ONLY`, `FACTORY_CONFIG_ONLY`, chart-settings false positives, or conflicting settings-title evidence.

## 3. Tool-By-Tool Priority Order

1. Trend Line: toolbar inventory/dropdowns, endpoint handles, settings/context, crowded-chart selection.
2. Info Line: tooltip visual formatting, context/settings, selection and body drag.
3. Trend Angle: angle helper rendering, context/settings, selection and drag.
4. Fib Extension: current menu label, 3-anchor creation, levels rendering.
5. Fib Channel: menu/activation mapping only, behind summary-derived flag.
6. Date and Price Range: menu/activation mapping only, behind summary-derived flag.
7. Parallel Channel: representative context-menu plan from imported summary; handle roles are visual/summary only.
8. Pitchfork and Inside Pitchfork: context/settings, selected-state handles, body hit-testing.
9. Fib Retracement: context/settings, levels, crowded-chart sampled behavior.
10. XABCD Pattern and ABCD Pattern: sampled context planning; labels remain visual/manual.
11. Text: basic create/type/select/drag.
12. Price Range and Long Position: metric label visual behavior and sampled crowded-chart/context planning.
13. Rectangle: sampled context planning and basic handle/fill architecture only.

## 4. Shared Architecture Changes Needed

- Introduce a unified drawing selection model with one selected drawing, optional multi-select later, hover state, and stable selected object identity.
- Create a shared toolbar model driven by selected drawing capabilities. Controls should be declarative, ordered, and per-tool configurable.
- Create a shared handle model where each handle has `id`, `role`, `anchorIndex`, `screenPoint`, `cursor`, `visibleWhen`, `hitRadius`, and `dragBehavior`.
- Create a shared context menu action registry scoped by tool/capability and evidence status.
- Create a shared label/tooltip layout layer separate from geometry rendering so labels can attach to anchors, bodies, levels, or metric boxes.
- Add a shared crowded-chart hit-testing policy with z-order, selected-object priority, locked/hidden filtering, and deterministic tie-breaking.

## 5. Drawing Selection / Body-Drag System Plan

- Hit-test order: selected handles first, selected body second, topmost unlocked drawing body third, labels/metric boxes last unless a tool requires label-first selection.
- Selected body drag should move every anchor and attached labels together.
- Body drag must preserve geometry: line slope, channel width, pitchfork ratios, Fib levels, and text attachment offset.
- Locked drawings should remain selectable but block body and handle drag once lock side effects are verified enough to implement safely.
- Hidden drawings should be excluded from render and hit-testing once hide/restore semantics are verified.
- For crowded-chart sampled tools, implement deterministic topmost selection and deletion/copy isolation.

## 6. Handle / White-Dot Rendering And Hit-Testing Plan

- Start with verified/safe tools:
  - Trend Line: two circular endpoint handles.
  - Info Line and Trend Angle: reuse two endpoint-handle base, add helper/label rendering.
  - Fib Extension: render 3 anchor handles and level lines visually; exact roles still require more evidence.
  - Channels/Pitchforks: implement only known anchor points and selected-state visuals, keeping exact extra handle semantics behind tests marked pending.
- Handle rendering should use stable screen-space radius and high-contrast white/blue styling.
- Hit radius should be larger than visual radius for usability, with selected-handle priority.
- Drag behavior should be role-driven:
  - endpoint handle moves one anchor.
  - body handle/body drag translates all anchors.
  - channel-width or pitchfork-specific handles remain disabled or conservative until verified.
- Add debug/test utilities to assert handle count and screen coordinate stability after zoom/pan.

## 7. Floating Toolbar Model And Controls Plan

- Implement selected drawing toolbar for Trend Line first.
- Toolbar controls for Trend Line:
  - templates
  - stroke color
  - text color
  - line width
  - line style
  - settings
  - add alert placeholder
  - lock
  - remove
  - more menu
- Implement dropdown opening and visual options for:
  - width: `1px`, `2px`, `3px`, `4px`
  - style: `Line`, `Dashed line`, `Dotted line`
  - color palettes with swatches and opacity slider
  - more: `Visual order`, `Visibility on intervals`, `Clone`, `Copy`, `Hide`
- Implement side effects only where low-risk and testable:
  - width/style/color update selected drawing immediately.
  - remove deletes selected drawing.
  - clone/copy can be implemented for sampled tools after selection isolation tests exist.
- Keep alert/template/visibility interval full behavior as UI placeholders or blocked unless product requirements exist.

## 8. Text / Label Attachment Model Plan

- Model labels as attached objects with `ownerDrawingId`, `attachmentRole`, `anchorRef`, `levelRef`, `bodyOffset`, and `editable`.
- For Trend Line, Info Line, and Trend Angle, support attached measurement/helper labels as render-only labels first.
- For Fib tools, attach level labels to level lines and recompute on anchor movement.
- For Text, support basic create/type/select/drag as an owned drawing type with editable text content.
- For Price Range and Long Position, support metric labels as attached measurement boxes.
- Do not implement separate text deletion/editing semantics for labels until verified.
- Body drag should translate user text and metric labels with their owning drawing.

## 9. Tooltip / Value Rendering Plan

- Implement canvas/SVG-rendered tooltip overlays rather than relying on DOM extraction.
- For Info Line, render rows for price change, percent change, price value, bar/time distance, pixel distance, and angle based on available viewport scale.
- For Trend Angle, render angle helper label and dashed guide geometry.
- For Price Range, render metric label with price/percent/value-like format, with exact strings covered by screenshot-regression tests rather than DOM tests.
- Mark exact dynamic formatting tests as visual tolerance tests until reliable DOM or OCR extraction exists.

## 10. Context Menu Plan For Sampled Verified Tools Only

Implement drawing-specific context menu action groups for sampled tools:

- Trend Line
- Info Line
- Parallel Channel
- Pitchfork
- Fib Retracement
- XABCD Pattern
- Text
- Price Range
- Long Position
- Rectangle

Actions to support where meaningful:

- Settings
- Clone / Copy
- Delete / Remove
- Lock
- Hide
- Visual order
- Template
- Object tree placeholder
- Add alert placeholder where the source evidence showed it

Do not claim or expose unsampled tool-specific context menus as verified parity. Use shared menu defaults only when product behavior already exists and tests avoid asserting TradingView parity.

## 11. Crowded-Chart Selection Plan

- Add selection stress tests for sampled tools only: Trend Line, Fib Retracement, Text, Price Range, Long Position.
- Use deterministic z-order and selected drawing priority.
- Ensure delete, clone, lock, hide, and body drag apply only to the selected drawing.
- Exclude hidden drawings from hit-testing after hide behavior is implemented.
- Add performance budget checks only after correctness is stable.

## 12. Test Strategy

- Unit tests:
  - geometry calculations for line endpoints, angle, percent/price deltas, and Fib levels.
  - handle coordinate generation for Trend Line and Fib Extension.
  - label attachment transformations on body drag and endpoint drag.
- Component/UI tests:
  - toolbar appears for selected Trend Line.
  - width/style/color dropdowns expose verified options.
  - remove deletes only the selected drawing.
  - text creation/type/select works for Text.
- Playwright scoped behavior tests:
  - Trend Line create/select/endpoint drag/body drag/toolbar dropdowns.
  - Info Line tooltip visual snapshot.
  - Trend Angle helper visual snapshot.
  - Fib Extension activation mapping and 3-anchor creation.
  - sampled context menus only.
  - crowded-chart sampled tools only.
- Snapshot/visual tests:
  - `SCREENSHOT_ONLY` items should become visual regression assertions, not DOM text assertions.
- Do not turn blocked/manual-required evidence into required tests.

## 13. Risks And Blockers

- Codex 2 Pass 4 raw screenshots/results are unavailable locally, so `COMPLETE_LIVE_SUMMARY` remains planning input until copied.
- Toolbar side effects beyond open/dropdown visibility are not fully verified.
- Handle roles are often visual-only; exact drag semantics for many tools are not ready.
- Tooltip/value text is canvas-rendered and mostly screenshot-only.
- Text edit/delete/copy/undo-redo/persistence is not verified enough for parity implementation.
- Context menu verification is sampled, not universal.
- Activation remains blocked for Anchored text, Image, Post, Idea, Sticker, and Emoji.

## 14. Exact Files Likely To Change Later

Implementation should probably touch these areas, but no app code is changed by this planning pass:

- `frontend/components/chart/TradingChart.tsx`
- `frontend/services/tools/toolEngine.ts`
- `frontend/services/tools/toolRegistry.ts`
- `frontend/services/tools/drawingGeometry.ts`
- `packages/tradereplay-charts/src/drawing/types.ts`
- `packages/tradereplay-charts/src/drawing/engine/drawingEngine.ts`
- `packages/tradereplay-charts/src/drawing/tools/base.ts`
- `packages/tradereplay-charts/src/drawing/tools/trendLine.ts`
- `packages/tradereplay-charts/src/drawing/tools/fibExtension.ts` or equivalent Fib tool module
- `packages/tradereplay-charts/src/drawing/tools/fibChannel.ts` or equivalent Fib tool module
- `packages/tradereplay-charts/src/drawing/tools/parallelChannel.ts`
- `packages/tradereplay-charts/src/drawing/tools/pitchforks.ts`
- `packages/tradereplay-charts/src/drawing/tools/index.ts`
- scoped Playwright/unit test files created later for this implementation lane only

## 15. Step-By-Step Implementation Checklist

1. Add/confirm typed drawing capability metadata for toolbar controls, handles, labels, context menu, and measurement overlays.
2. Implement shared selected drawing state and deterministic hit-test order.
3. Implement Trend Line endpoint handle rendering and endpoint/body drag.
4. Implement Trend Line toolbar inventory and dropdown controls for width/style/color/more.
5. Implement Trend Line context/settings menu wiring based on verified local evidence.
6. Implement Info Line measurement tooltip visual layout from screenshot evidence.
7. Implement Trend Angle angle helper and dashed guide visual behavior.
8. Implement Fib Extension current menu label mapping and 3-anchor creation.
9. Implement Fib Extension visible level defaults and labels.
10. Add summary-derived menu activation mappings for Fib Channel and Date and Price Range behind evidence comments/tests that do not claim local final proof.
11. Implement Text basic create/type/select/drag.
12. Implement Price Range metric label visual rendering.
13. Implement sampled context menu action model for the verified/sampled tool list only.
14. Add crowded-chart selection tests for Trend Line, Fib Retracement, Text, Price Range, and Long Position.
15. Run focused tests after each phase and leave blocked/manual-required scenarios documented rather than forced green.

## 16. Phase 1 Implementation Log - Trend Line

Date: 2026-05-25

Scope completed in this slice:

- Trend Line selected/unselected state now has a typed endpoint handle debug model.
- Trend Line body drag continues to translate both anchors together.
- Trend Line endpoint hit-testing now uses the same offscreen-tolerant projection helper as toolbar/debug positioning.
- Trend Line endpoint handle state reports exactly two endpoint handles, hidden when deselected.
- Trend Line handle/toolbar projection uses offscreen coordinate fallback so handles and toolbar remain aligned after pan/zoom when coordinates leave the visible range.
- Trend Line verified toolbar inventory model added for:
  - `templates`
  - `line-tool-color`
  - `text-color`
  - `line-tool-width`
  - `style`
  - `settings`
  - `add-alert`
  - `lock`
  - `remove`
  - `more`

Tests added:

- `e2e/trend-line-phase1.spec.ts`
  - draw Trend Line
  - select by body
  - deselect/reselect
  - body drag
  - endpoint handle drag
  - selected/deselected handle visibility
  - handle alignment after pan/zoom
  - verified toolbar inventory model

Verification run:

- `npm --prefix frontend run typecheck` passed.
- `frontend\node_modules\.bin\tsc.cmd --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node,@playwright/test e2e\trend-line-phase1.spec.ts` passed.
- `npx playwright test -c e2e/playwright.config.ts e2e/trend-line-phase1.spec.ts --project=chromium --list` discovered 6 tests.
- `E2E_USE_EXTERNAL_STACK=true npx playwright test -c e2e/playwright.local-preview.config.ts e2e/trend-line-phase1.spec.ts --project=chromium --retries=0` passed: 6/6 tests.
- `E2E_USE_EXTERNAL_STACK=true npx playwright test -c e2e/playwright.local-preview.config.ts e2e/line-tools-phase-d-parity.spec.ts --project=chromium -g "trend" --retries=0` passed: 10/10 tests. The grep also matched existing `trendAngle` cases.
- `E2E_USE_EXTERNAL_STACK=true npx playwright test -c e2e/playwright.local-preview.config.ts e2e/line-tools-floating-toolbar.spec.ts --project=chromium -g "trend" --retries=0` passed: 20/20 tests. The grep also matched existing `trendAngle` cases.
- `npm --prefix packages/tradereplay-charts test` ran package tests but failed in untouched pitchfork geometry coverage: `getPitchforkGeometry uses the expected origin for pitchfork variants`.

Verification notes:

- Browser execution with the default `e2e/playwright.config.ts` did not start because the configured local backend could not connect to MongoDB at `127.0.0.1:27017` before the Playwright web server timeout.
- Attempting to start repo Docker Mongo with `docker compose up -d mongodb` failed because Docker Desktop/daemon was not running.
- The safe browser verification path was `e2e/playwright.local-preview.config.ts`, which runs the local frontend code and points API traffic at production. `E2E_USE_EXTERNAL_STACK=true` was set only so `playwright-fixture.ts` checks production API health instead of a missing local backend.
- Running this new spec with `E2E_USE_EXTERNAL_STACK=true` and the default `e2e/playwright.config.ts` found no tests because that config switches `testMatch` to `tv-parity-tv-*.spec.ts`.
- The package-test pitchfork failure is outside this Phase 1 scope and no package drawing-library files were changed by this slice.

Remaining Phase 1 gaps:

- Re-run the new Trend Line Phase 1 Playwright spec with the default full local stack once local Mongo/Docker is available.
- Toolbar side effects remain intentionally out of scope except for existing safe behavior already present in the app.

Next recommended phase:

- After the new Trend Line spec passes locally, implement only the verified Trend Line toolbar dropdown inventory behavior for line width/style/color opening semantics. Keep alert/templates/more as placeholders until side effects are explicitly approved.

## 17. Commit Gate For Future Implementation

Do not start implementation until the owner approves this plan. The first implementation slice should be small: Trend Line selection, endpoint handles, and verified toolbar dropdown inventory. That slice gives the shared architecture a low-risk proving ground before applying it to channels, Fib tools, text, or measurement tools.
