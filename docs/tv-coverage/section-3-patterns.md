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
