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
