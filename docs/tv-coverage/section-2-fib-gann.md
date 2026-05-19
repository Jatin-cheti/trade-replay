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
