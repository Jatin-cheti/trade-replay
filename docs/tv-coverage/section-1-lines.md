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
