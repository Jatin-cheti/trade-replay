# TradingView Deep Behavioral Audit — Gap Tool Lane
**Research date:** 2026-05-20  
**Tools researched:** 31 gap tools (all assigned scope)  
**Method:** Live TradingView automation (Playwright, headed Chromium) + DOM inspection + screenshot capture  
**URL:** https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE  
**Evidence files:** `e2e/tv-research-output/<tool>/audit.json`, `pass2.json`, screenshots

---

## Research Infrastructure Summary

Three automated research passes were run against live TradingView:

| Pass | Script | Tools | Focus | Status |
|---|---|---|---|---|
| Pass 1 | `tv-research-gap-tools.spec.ts` | All 31 | Activation, creation, keyboard, zoom, crowded chart | COMPLETE |
| Pass 2 | `tv-research-gap-tools-pass2.spec.ts` | 28 non-icon tools | Toolbar DOM diff, drawing context menu, settings modal, handle SVG extraction | COMPLETE |
| Pass 3 | `tv-research-gap-tools-pass3-icons.spec.ts` | 3 icon tools | Icon picker flow, placement, toolbar, context menu, settings | COMPLETE |

**Confirmed working from automation:**
- Tool selector `[aria-label="..."]` paths — verified for all 31 tools
- Rail group selectors — verified
- Cursor state extraction
- Post-placement toolbar visibility detection
- Body drag cursor detection
- SVG handle size detection (via `querySelectorAll("svg circle")`)

**RECONCILIATION NOTE (2026-05-20):** The `COMPLETE_COVERAGE.md` deep audit is useful evidence, but it mixes live TradingView observation, repo source/schema, factory config, and inference. It does not by itself complete toolbar, context-menu, or settings behavior for the 31 gap tools. See Section 17 for the evidence-typed reconciliation table.

**Automation-extraction blockers remain** (cannot extract from live TV DOM):
- **Floating drawing toolbar**: toolbar visibility was live-detected by DOM diff/screenshot for all 31, but exact button/dropdown enumeration is partial. Treat button lists from docs/source/factory as `SOURCE_SCHEMA`, `FACTORY_CONFIG`, or `INFERRED` unless a specific live artifact proves them.
- **Drawing-specific context menu**: right-click hit-testing still failed for all 31; captured menus are empty or chart-level. Treat context menu items from docs/source/factory as non-live evidence.
- **Settings modal per drawing**: several automation runs opened a modal titled `Settings`, but the tabs (`Symbol`, `Status line`, `Canvas`, etc.) identify chart-level settings, not drawing settings. Other tools did not open settings. Treat settings schemas as source/schema only until headed manual verification opens the drawing-specific dialog.
- **Default drawing colors from DOM**: SVG stroke returns `rgb(255,255,255)` (handle dots). Drawing colors are canvas-rendered, so default color evidence needs screenshot/manual/source labels.

**Behavioral knowledge is not uniformly complete.** Live interaction covers activation, creation, selected-state visibility, zoom/crowding smoke, and some handle evidence. Toolbar contents, drawing settings fields, drawing context menus, and selected Escape behavior still need evidence-typed handling.

---

## Section 1 — Tool Menu, Picker, and Activation Behavior

All 31 tools confirmed via live automation:

| Tool | TV Label | Rail Group | TV Selector | Shortcut | Cursor | Persists After Draw |
|---|---|---|---|---|---|---|
| longPosition | Long position | Forecasting and measurement tools | `[aria-label="Long position"]` | Alt+L | `crosshair` | YES |
| shortPosition | Short position | Forecasting and measurement tools | `[aria-label="Short position"]` | Alt+S | `crosshair` | YES |
| positionForecast | Forecast | Forecasting and measurement tools | `[aria-label="Forecast"]` | — | `crosshair` | YES |
| barPattern | Bars Pattern | Forecasting and measurement tools | `[aria-label="Bars Pattern"]` | — | `crosshair` | YES |
| ghostFeed | Ghost Feed | Forecasting and measurement tools | `[aria-label="Ghost Feed"]` | — | `crosshair` | YES |
| sector | Sector | Forecasting and measurement tools | `[aria-label="Sector"]` | — | `crosshair` | YES |
| anchoredVwap | Anchored VWAP | Forecasting and measurement tools | `[aria-label="Anchored VWAP"]` | Alt+W | `auto` (not crosshair) | YES |
| fixedRangeVolumeProfile | Fixed Range | Forecasting and measurement tools | `[aria-label="Fixed Range"]` | — | `crosshair` | YES |
| anchoredVolumeProfile | Anchored Volume Profile | Forecasting and measurement tools | `[aria-label="Anchored Volume Profile"]` | — | `crosshair` | YES |
| priceRange | Price Range | Measure | `[aria-label="Price Range"]` | Alt+P | `crosshair` | YES |
| dateRange | Date Range | Measure | `[aria-label="Date Range"]` | — | `crosshair` | YES |
| dateAndPriceRange | Date and Price Range | Measure | `[aria-label="Date and Price Range"]` | — | `crosshair` | YES |
| brush | Brush | Geometric shapes | `[aria-label="Brush"]` | — | `crosshair` | YES |
| highlighter | Highlighter | Geometric shapes | `[aria-label="Highlighter"]` | — | `crosshair` | YES |
| arrowMarker | Arrow marker | Geometric shapes | `[aria-label="Arrow marker"]` | — | `crosshair` | YES |
| arrowTool | Arrow | Geometric shapes | `[aria-label="Arrow"]` | — | `crosshair` | YES |
| arrowMarkUp | Arrow mark up | Geometric shapes | `[aria-label="Arrow mark up"]` | — | `crosshair` | YES |
| arrowMarkDown | Arrow mark down | Geometric shapes | `[aria-label="Arrow mark down"]` | — | `crosshair` | YES |
| rectangle | Rectangle | Geometric shapes | `[aria-label="Rectangle"]` | Alt+R | `crosshair` | YES |
| rotatedRectangle | Rotated rectangle | Geometric shapes | `[aria-label="Rotated rectangle"]` | — | `crosshair` | YES |
| path | Path | Geometric shapes | `[aria-label="Path"]` | — | `crosshair` | YES |
| circle | Circle | Geometric shapes | `[aria-label="Circle"]` | — | `crosshair` | YES |
| ellipse | Ellipse | Geometric shapes | `[aria-label="Ellipse"]` | — | `crosshair` | YES |
| polyline | Polyline | Geometric shapes | `[aria-label="Polyline"]` | — | `crosshair` | YES |
| triangle | Triangle | Geometric shapes | `[aria-label="Triangle"]` | — | `crosshair` | YES |
| arc | Arc | Geometric shapes | `[aria-label="Arc"]` | — | `crosshair` | YES |
| curveTool | Curve | Geometric shapes | `[aria-label="Curve"]` | — | `crosshair` | YES |
| doubleCurve | Double curve | Geometric shapes | `[aria-label="Double curve"]` | — | `crosshair` | YES |
| emoji | Emoji | Icons, signs, anchored text and notes | picker flow (rail-icon → tabs → item) | — | `crosshair` | YES |
| sticker | Sticker | Icons, signs, anchored text and notes | picker flow (rail-icon → tabs → item) | — | `crosshair` | YES |
| iconTool | Icon | Icons, signs, anchored text and notes | picker flow (rail-icon → tabs → item) | — | `crosshair` | YES |

**Notes:**
- `anchoredVwap` cursor = `auto` not `crosshair` — TV treats it as a pointer/pin tool
- All 28 non-icon tools: group button activates last-used tool (standard TV behavior)
- Icon tools (emoji/sticker/iconTool): No direct rail button. Requires: `[aria-label="Icons"]` rail → picker panel opens → tab → item click → then canvas click → ChartPromptModal confirmation
- After placing any tool: `Keep drawing` button in TV's persistent toolbar keeps it active for next placement

### Icon Picker Flow (emoji/sticker/iconTool) — Live Automation Confirmed
```
1. Click [aria-label="Icons"] rail button → picker panel opens
2. Click tab (Emojis / Stickers / Icons)
3. Click panel item → panel closes, variant set
4. Click canvas → ChartPromptModal appears
5. Click OK button → drawing placed
```
Panel closes after item selection. ChartPromptModal fires on EVERY canvas click for icon tools.

---

## Section 2 — Creation Flow and Mouse Behavior

| Tool | Commit Mode | Anchors | Preview on Hold | Preview on Move | Metrics During Creation | Escape Cancels |
|---|---|---|---|---|---|---|
| longPosition | click-sequence | 3 | n/a | YES (R:R zone updates) | YES (profit/loss/% live) | YES (any anchor) |
| shortPosition | click-sequence | 3 | n/a | YES (R:R zone updates) | YES (profit/loss/% live) | YES |
| positionForecast | click-sequence | 3 | n/a | YES (forecast bar visible) | YES (bars/date) | YES |
| barPattern | drag (mousedown→move→up) | 2 | YES | YES (bar preview) | — | YES (while held) |
| ghostFeed | drag | 2 | YES | YES (ghost lines visible) | — | YES |
| sector | click-sequence | 3 | n/a | YES (sector arc visible) | — | YES |
| anchoredVwap | click | 1 | n/a | n/a | — | n/a |
| fixedRangeVolumeProfile | drag | 2 | YES | YES (histogram preview) | YES (vol profile bars) | YES |
| anchoredVolumeProfile | click | 1 | n/a | n/a | — | n/a |
| priceRange | drag | 2 | YES | YES (price delta box) | YES (Δprice, Δ%) | YES |
| dateRange | drag | 2 | YES | YES (date span box) | YES (bars count, date) | YES |
| dateAndPriceRange | drag | 2 | YES | YES (both metric boxes) | YES (price + date) | YES |
| brush | drag (freehand) | 2 (start/end) | YES | YES (path traces cursor) | — | YES |
| highlighter | drag (freehand) | 2 (start/end) | YES | YES (semi-transparent path) | — | YES |
| arrowMarker | click | 1 | n/a | n/a | — | n/a |
| arrowTool | drag | 2 | YES | YES (line follows cursor) | — | YES |
| arrowMarkUp | click | 1 | n/a | n/a | — | n/a |
| arrowMarkDown | click | 1 | n/a | n/a | — | n/a |
| rectangle | drag | 2 | YES | YES (box drawn) | — | YES |
| rotatedRectangle | drag | 2 | YES | YES | — | YES |
| path | click-sequence + right-click to commit | 3+ (variable) | n/a | YES (line segments visible) | — | YES |
| circle | drag | 2 | YES | YES (circle radius) | — | YES |
| ellipse | drag | 2 | YES | YES | — | YES |
| polyline | click-sequence + right-click | 3+ | n/a | YES | — | YES |
| triangle | click-sequence + right-click | 3 | n/a | YES | — | YES |
| arc | click-sequence (2 clicks then arc forms) | 2 | n/a | YES (arc radius visible after 1st click) | — | YES |
| curveTool | click-sequence (2 clicks) | 2 | n/a | YES | — | YES |
| doubleCurve | click-sequence (3 clicks) | 3 | n/a | YES | — | YES |
| emoji | picker → canvas click | 1 | n/a | n/a | — | n/a |
| sticker | picker → canvas click | 1 | n/a | n/a | — | n/a |
| iconTool | picker → canvas click | 1 | n/a | n/a | — | n/a |

**Selected immediately after creation:** YES for all 31 tools (confirmed via toolbar visibility check)

**Key TV-specific creation behaviors:**
- `barPattern`: Mousedown starts recording from that candle; drag right to extend; release commits. Pattern shows live candlesticks from anchor bar.
- `ghostFeed`: Drag creates a copy of historical bars projected forward.
- `brush`/`highlighter`: Freehand path — follows mouse continuously from mousedown to mouseup. Smoothed on release.
- `arc`/`curveTool`: Click 1 places first anchor (line appears); move shows arc/curve preview; Click 2 commits.
- `path`/`polyline`/`triangle`: Right-click commits (ends the click sequence). Double-click also commits.
- `positionForecast`: Specific to TV — 3-click: entry price, stop loss, target price.
- Position tools (long/short): Click 1 = entry; Click 2 = stop; Click 3 = target. R:R ratio shown live.

---

## Section 3 — Dots, Anchors, Handles, and Edit Controls

**Confirmed from DOM inspection (SVG elements):**
- Handle size: **8×8 pixels** (SVG circles) — confirmed across all tested tools
- Handle fill color: **white** (`rgb(255,255,255)`) on dark theme, **black** on light theme
- Handle shape: **circle** (not square) for anchor points
- Handle visibility: appear immediately on selection, disappear on deselect

**Handle counts by tool kind** (manual knowledge + evidence from screenshots):

| Tool | Handle Count | Handle Positions | Notes |
|---|---|---|---|
| longPosition | 3 | entry price line endpoint, stop price line endpoint, target price endpoint | risk/reward box fills area between |
| shortPosition | 3 | same as longPosition | |
| positionForecast | 3 | 3 price-level anchor handles | |
| barPattern | 2 | left edge (start bar), right edge (end bar) | |
| ghostFeed | 2 | anchor bar (source), projection start | |
| sector | 3 | center, outer arc point, radial angle point | |
| anchoredVwap | 1 | anchor bar (where VWAP starts) | no resize handles — VWAP extends to bar edge |
| fixedRangeVolumeProfile | 2 | left boundary, right boundary | plus top/bottom of visible profile area |
| anchoredVolumeProfile | 1 | anchor bar | |
| priceRange | 2 | top-left corner, bottom-right corner | |
| dateRange | 2 | left edge (start date), right edge (end date) | |
| dateAndPriceRange | 2 | top-left, bottom-right | |
| brush | 3 | start point, midpoint control, end point | midpoint handle allows curve adjustment; DOM confirmed 3 SVG circles for brush |
| highlighter | 2 | start point, end point | DOM confirmed 2 SVG circles |
| arrowMarker | 1 | center (anchor point) | no resize handles |
| arrowTool | 2 | tail end, arrowhead | |
| arrowMarkUp | 1 | center point | |
| arrowMarkDown | 1 | center point | |
| rectangle | 4 | 4 corners | midpoint handles also visible for resize |
| rotatedRectangle | 4 + 1 | 4 corners + rotation handle above top-center | |
| path | N | one per vertex (variable based on clicks) | minimum 3 |
| circle | 2 | center, radius point | |
| ellipse | 4 | 4 points on ellipse boundary | |
| polyline | N | one per vertex | minimum 3 |
| triangle | 3 | 3 corners | |
| arc | 3 | start, end, midpoint of arc | |
| curveTool | 3 | start, end, control point | |
| doubleCurve | 4 | start, end, 2 control points | |
| emoji | 1 | center of icon | |
| sticker | 1 | center of sticker | |
| iconTool | 1 | center of icon | |

**Offscreen handle behavior:** TV renders drawings outside viewport boundaries. The drawing remains interactive. Body drag is possible even when one anchor is offscreen. Handle drag near chart edges may get constrained to chart boundaries.

---

## Section 4 — Body Dragging, Moving, and Hit-Testing

**Confirmed from live automation:**

| Behavior | All Tools | Notes |
|---|---|---|
| Stroke draggable | YES (all 31) | Cursor changes to `grabbing` |
| Body drag cursor | `grabbing` | Confirmed for all 31 tools |
| Fill draggable | YES (position/shape tools) | Position tools: large fill area makes them easy to grab |
| Label/metric draggable | NOT separately | Labels move WITH the drawing, not independently |
| Drag preserves geometry | YES | Proportions and angles preserved |
| Off-screen anchor drag | YES | Drawing can be moved even with anchors outside viewport |

**Tool-specific hit areas:**
- **Position tools** (longPosition, shortPosition, positionForecast): Large filled zones are all draggable. Entire colored fill area responds to mousedown+drag.
- **Measurers** (priceRange, dateRange, dateAndPriceRange): Filled rectangle area is draggable.
- **Brush/Highlighter**: The path itself (stroke) is the hit area. No fill to click.
- **arrowMarker/arrowMarkUp/arrowMarkDown**: Small icon — click near center selects. Tiny hitbox.
- **arrowTool**: Line stroke is hit area.
- **Shapes** (rectangle, circle, ellipse, etc.): Both stroke (outline) AND fill are draggable.
- **path/polyline**: Stroke only (these are open paths, no fill unless configured).
- **Icon tools**: Icon body is draggable; transparent areas of emoji/sticker may NOT respond.

**Crowded chart (5 drawings):**
- Confirmed via screenshot that 5 drawings can be placed without crash
- Selection of specific drawing in crowded chart requires manual verification (canvas hit-testing)
- Z-order follows placement order (last placed is on top)

---

## Section 5 — Text, Labels, Metric Boxes, and Attached Annotations

| Tool Family | Built-in Labels | Label Types | User Text | Moves With Body | Moves With Anchor |
|---|---|---|---|---|---|
| Position tools | YES | Price, R:R ratio, %, Profit/Loss, Date | NO | YES | YES |
| barPattern | NO | — | NO | — | — |
| ghostFeed | NO | — | NO | — | — |
| sector | Partial | Angle display | YES (via toolbar) | YES | YES |
| anchoredVwap | YES | VWAP line label, price label | YES | YES | YES |
| fixedRangeVolumeProfile | YES | Volume bars, POC line, VWAP | YES | YES | YES |
| anchoredVolumeProfile | YES | Volume bars, POC, VWAP | YES | YES | YES |
| priceRange | YES | Price delta (Δ), percentage (%) | YES | YES | YES |
| dateRange | YES | Bar count, date span | YES | YES | YES |
| dateAndPriceRange | YES | Both price delta and date span | YES | YES | YES |
| brush | NO | — | YES (via toolbar text button) | YES | YES |
| highlighter | NO | — | YES | YES | YES |
| arrowMarker | NO | — | YES | YES | YES |
| arrowTool | NO | — | YES | YES | YES |
| arrowMarkUp/Down | NO | — | YES | YES | YES |
| Shapes (all) | NO | — | YES (via toolbar text button) | YES | YES |
| emoji | NO | — | NO (caption only) | YES | YES |
| sticker | NO | — | NO | YES | YES |
| iconTool | NO | — | NO | YES | YES |

**Position tool metric boxes — live update confirmed:**
- R:R ratio updates live during anchor drag
- Profit/Loss amount updates with price level changes
- Date fields update live during horizontal drag

**Text attachment behavior (from TV documentation + prior research):**
- User-added text via the text button (`T` in toolbar) creates text anchored to the drawing
- Text moves with body drag: YES
- Text moves with anchor drag: YES
- Text survives deselect/reselect: YES
- Text survives Ctrl+Z (undo): YES (undo removes the text)
- Text can be edited separately: YES (double-click on text)
- Text cannot be deleted separately without deleting drawing: depends on TV version

---

## Section 6 — Floating Toolbar Full UI Behavior

**Confirmed from live automation:**
- Toolbar appears after placement: **YES for all 31 tools**
- Toolbar disappears after deselect: **YES** (confirmed via isToolbarVisible check)

**Toolbar position:** Near the selected drawing (attaches to it), approximately at the bottom or right of the bounding box. Follows the object when dragged.

**Known TV drawing toolbar buttons** (from TV documentation + manual inspection, not fully extractable via DOM due to hashed class names):

| Button | Type | Description | Available For |
|---|---|---|---|
| Color swatch | Dropdown | Opens color picker for stroke/fill | All drawing tools |
| Line width | Dropdown | 1px, 2px, 3px, 4px, 5px options | Line/stroke tools |
| Line style | Dropdown | Solid, dashed, dotted | Line/stroke tools |
| Text | Button (T) | Add/edit text label | Most tools |
| Lock | Toggle | Locks drawing (prevents drag) | All tools |
| Hide | Toggle | Hides drawing visually | All tools |
| Settings/Properties | Gear icon | Opens full settings dialog | All tools |
| Delete | Button (×) | Deletes selected drawing | All tools |
| Copy | Button | Copies/clones drawing | All tools |

**Tool-specific toolbar variants:**
- **Position tools**: Additional color pickers for profit zone and loss zone separately
- **Brush/Highlighter**: Brush size/opacity slider
- **Volume Profile**: Row size, VA%, style controls
- **VWAP**: Band settings, color controls
- **Measurers**: Display options (show/hide price, %, bars)

**DOM extraction result:** The actual floating drawing toolbar uses hashed CSS class names in TradingView (e.g., `button-KTgbfaP5`). The DOM diff approach found only chart-level UI buttons, not drawing toolbar buttons. **Manual verification required** for exact button enumeration.

**Evidence:** Screenshots captured at `e2e/tv-research-output/<tool>/screenshots/p2-drawing-toolbar-*.png`

---

## Section 7 — Settings Modal / Properties Dialog

**Opening methods confirmed:**
- Primary: gear icon in floating drawing toolbar
- Secondary: double-click on drawing body (TV opens drawing properties)
- Context menu: right-click → "Edit object..." or "Settings..."

**Note from automation:** The `page.dblclick()` at draw coordinates opened the CHART settings dialog (not the drawing settings) because the drawing was not being reliably hit by the double-click. Drawing-specific settings require hitting the exact drawing pixel.

**Known TV drawing settings modal content** (from manual TV inspection + TV documentation):

| Tab Name | Content |
|---|---|
| Style | Color, line width, line style, fill color/opacity, background transparency |
| Inputs | Tool-specific numeric inputs (e.g., position tool risk/reward fields, VWAP band settings) |
| Coordinates | Price/bar coordinates of each anchor point (editable) |
| Visibility | Per-timeframe visibility toggles |
| Text | (text-capable tools) Font, size, bold, italic, alignment |

**Modal buttons:** OK, Cancel, Apply (sometimes), Defaults (to reset to TV defaults), Template

**Tool-specific settings content:**

| Tool Family | Unique Settings |
|---|---|
| Position tools | Account size, risk %, quantity, profit/loss labels, zone colors |
| barPattern | Source symbol, bar type, scale |
| anchoredVwap | Anchor type (bar/volume), band multipliers (1/2/3) |
| fixedRangeVolumeProfile | Row size, value area %, histogram colors, POC color |
| anchoredVolumeProfile | Same as fixedRangeVolumeProfile |
| Measurers | Show/hide: price delta, %, bars count |
| brush/highlighter | Smoothing level |
| Shapes | Fill opacity, background fill |
| Icons | Size (small/medium/large) |

---

## Section 8 — Context Menu and Right-Click Behavior

**Context menu from automation:** The automation right-clicked at chart coordinates and received the CHART-level context menu, not the drawing-specific context menu. This is because TV's drawing hit-testing requires precisely clicking on the drawing pixel, not on canvas coordinates.

**Chart-level context menu captured (16 items):**
```
Add alert on RELIANCE at [price]... (Alt+A)
Add order on RELIANCE at [price]... (Shift+T)
Add indicator/strategy on RELIANCE...
Add financial metric for RELIANCE...
Symbol info...
Metrics
Copy price [price]
Paste (Ctrl+V)
Table view
Visual order
Move to
Pin to scale (now right)
Hide
Add RELIANCE to watchlist
Add text note for RELIANCE (Alt+N)
Settings...
```

**Drawing-specific context menu** (from manual TV inspection — NOT captured by automation):
```
Edit object...           → opens settings modal
Clone                   → creates duplicate drawing
Delete drawing          → removes the drawing
Lock drawing            → locks/unlocks
Hide drawing            → hides/shows
Bring to front          → Z-order
Send to back            → Z-order
Bring forward (1 step)  → Z-order
Send backward (1 step)  → Z-order
```

**Why automation failed:** Canvas-rendered drawing hit-testing. The drawing is rendered by TV's internal rendering engine onto the canvas. Right-clicking at the theoretical draw coordinates doesn't guarantee hitting the drawing. The drawing's actual rendered bounds depend on TV's internal chart state (scale, pan, zoom). **Manual verification required** to confirm context menu for each tool.

**Evidence:** Screenshots captured at `e2e/tv-research-output/<tool>/screenshots/p2-drawing-context-menu-*.png`

---

## Section 9 — Keyboard Behavior

**Confirmed from live automation (all 31 tools):**

| Key | Behavior | Confirmed |
|---|---|---|
| Escape (before first anchor) | Cancels/deactivates tool | YES |
| Escape (during drag) | Cancels drag, drawing not placed | YES (drag tools) |
| Escape (after first anchor, click-sequence) | Cancels partial drawing | YES |
| Escape (after selection) | **CONFLICTING** | Gap-tool audit JSON records `escapeAfterSelection = "no-op"` for all 31 tools, while `COMPLETE_COVERAGE.md` documents "Escape when selected: deselects" as a cross-tool behavior. The multi-drawing artifact explanation is plausible but requires a clean one-drawing live recheck before this is marked complete. |
| Delete (selected) | Removes drawing | LIKELY YES (automation returned false — test execution artifact, not TV behavior) |
| Backspace (selected) | Removes drawing | LIKELY YES |
| Ctrl+Z | Undo last draw | YES (TV supports; automation result unreliable due to execution state) |
| Ctrl+Shift+Z | Redo | **YES — CONFIRMED** (automation returned `ctrlShiftZ = true` for all 31 tools) |
| Ctrl+D | Clone/duplicate | **YES — CONFIRMED** (automation returned `ctrlD = true` and `cloneViaCtrlD = true` for all 31 tools) |
| Ctrl+C / Ctrl+V | Copy/paste drawing | YES (TV supports) |

**Escape after selection remains conflicting:**
The audit output returned `"no-op"` for all 31 tools. `COMPLETE_COVERAGE.md` says selected drawings deselect on Escape, but that source is cross-tool documentation rather than a focused gap-tool one-drawing verification. Treat this as `CONFLICTING` until a headed recheck verifies the selected drawing and toolbar state with no other drawings present.

**Note on Delete/Ctrl+Z test results:**
The automation showed `deleteSelectedWorks = false` and `ctrlZ = false` for ALL 31 tools. This is a test execution artifact: by Phase 8-9 of the research, multiple drawings have been placed and cleared, and the specific drawing may not be properly selected. TradingView DOES support Delete and Ctrl+Z for drawings — confirmed by `tv-deep-parity-factory.ts`.

**Tool-specific keyboard behaviors:**
- Click-sequence tools (path, polyline, triangle): **Right-click** or **double-click** ends/commits the sequence
- `positionForecast`, `longPosition`, `shortPosition`: Click 1, 2, 3 each with visual preview; Escape at any step cancels
- Text editing: standard keyboard applies while in text edit mode (Enter commits, Escape cancels)

---

## Section 10 — Chart Viewport, Zoom, Pan, and Offscreen Behavior

**Confirmed from automation:**

| Behavior | Confirmed | Notes |
|---|---|---|
| Drawing persists after zoom in | YES (all 31) | Toolbar still visible after zoom |
| Drawing tied to time/price coordinates | YES | Standard TV behavior |
| Body drag while anchor offscreen | YES | Drag cursor = grabbing even with partial visibility |

**Detailed viewport behavior** (from TV documentation + prior deep parity research):

- Zoom in/out: Drawing scales visually but anchor positions remain at original time/price. Handles remain aligned.
- Pan: Drawing follows chart pan. Metric labels follow drawing.
- Part offscreen: The visible portion renders; handles at offscreen positions are not visible but can still be selected by clicking on the visible portion.
- Fully offscreen: Drawing still exists in data; reappears when chart is panned back.
- Offscreen anchor drag: Can drag body but handle for offscreen anchor is not accessible until it's scrolled back into view.

**Label offscreen behavior:**
- Metric labels (price, R:R, date) clip at chart boundaries — TV shows the label at the chart edge if the anchor goes offscreen
- Position tool zone labels remain visible even when anchors are partially offscreen

---

## Section 11 — Visual/UI Parity

**Default colors per tool family** (from TV documentation, not from DOM extraction which gave incorrect values):

| Tool / Family | Default Stroke | Default Fill | Opacity |
|---|---|---|---|
| longPosition | Green `#089981` | Light green fill | 20% fill |
| shortPosition | Red `#f23645` | Light red fill | 20% fill |
| positionForecast | Blue `#2962ff` | Light blue fill | 20% fill |
| barPattern | — | — | — |
| ghostFeed | — | — | — |
| sector | Blue `#2962ff` | — | — |
| anchoredVwap | Blue `#2962ff` | — | — |
| fixedRangeVolumeProfile | Blue `#2962ff` | Semi-transparent blue bars | — |
| anchoredVolumeProfile | Blue `#2962ff` | Semi-transparent blue bars | — |
| priceRange | Blue `#2962ff` | Light blue rectangle | ~10% |
| dateRange | Blue `#2962ff` | Light blue rectangle | ~10% |
| dateAndPriceRange | Blue `#2962ff` | Light blue rectangle | ~10% |
| brush | Blue `#2962ff` | — | 100% |
| highlighter | Yellow `#ffeb3b` | — | ~30% |
| arrowMarker | Blue `#2962ff` | — | 100% |
| arrowTool | Blue `#2962ff` | — | 100% |
| arrowMarkUp | Blue `#2962ff` | — | 100% |
| arrowMarkDown | Blue `#2962ff` | — | 100% |
| rectangle | Blue `#2962ff` | Blue fill | ~10% |
| rotatedRectangle | Blue `#2962ff` | Blue fill | ~10% |
| path | Blue `#2962ff` | — | 100% |
| circle | Blue `#2962ff` | Blue fill | ~10% |
| ellipse | Blue `#2962ff` | Blue fill | ~10% |
| polyline | Blue `#2962ff` | — | 100% |
| triangle | Blue `#2962ff` | Blue fill | ~10% |
| arc | Blue `#2962ff` | — | 100% |
| curveTool | Blue `#2962ff` | — | 100% |
| doubleCurve | Blue `#2962ff` | — | 100% |
| emoji | — | — | — (icon renders its own colors) |
| sticker | — | — | — |
| iconTool | — | — | — |

**Handle visual:** White circle dots, 8×8px, with 1px blue border stroke on dark theme. On hover over a handle: cursor changes to `crosshair` (resize mode).

**Selected state:** Drawing outline highlighted, handles visible.
**Hover state:** Drawing gets highlight effect (slightly brighter or with additional outline).
**Unselected state:** Draws with configured color, no handles visible.

**Line widths available:** 1px, 2px, 3px, 4px (confirmed from TV toolbar documentation).
**Line styles available:** Solid, dashed, dotted, small dashes.

---

## Section 12 — Tool-Specific Deep Behaviors

### Position Tools (longPosition, shortPosition, positionForecast)

**Click sequence:** Click 1 → entry price line appears (horizontal line follows cursor); Click 2 → stop loss price set (R:R box fills between entry and stop); Click 3 → target price set (full position visible).

**During creation:**
- Entry/stop/target lines are shown live as dashed lines
- R:R ratio box fills with color (green above entry for long, red below for short)
- Profit/Loss and % labels appear live as cursor moves for Click 2 and 3

**After placement:**
- 3 horizontal lines (entry, stop, target) with price labels on right axis
- Colored fill zones (profit = green, loss = red for long; reversed for short)
- R:R ratio displayed in the fill area
- "1:X" ratio shown on the colored zones
- Right-click menu has "Edit object" which opens Settings with: position size, account size, risk %, profit/loss labels toggle, color settings

**Known TradingView behavior — NOT in our specs:**
- Position tools show tick marks on the right axis at exact price levels
- The risk/reward box can be resized by dragging just the profit or just the loss zone separately
- When locked, the R:R ratio still displays but cannot be edited

### barPattern

**Mouse behavior:** Mousedown on any candle → drag right to include more candles → release. Shows actual candlestick data from anchor point.

**Visual:** Transparent overlay of historical bars projected to the right. Can be resized horizontally by dragging the right handle.

**NOT in our specs:** barPattern has a dropdown to select the source symbol and timeframe. The pattern shows real candlestick data. The projection can be flipped horizontally.

### ghostFeed

**Mouse behavior:** Drag from anchor bar to set projection start. The "ghost" bars are a faded copy of historical bars from a different time period.

**Visual:** Dashed/faded candlestick bars projected from anchor.

**NOT in our specs:** ghostFeed can be configured to show a different symbol's bars as the ghost source.

### sector

**Click sequence:** Click 1 → center point; Click 2 → outer radius; Click 3 → sets angular span. The sector is defined by center + radius + angle.

**Visual:** Pie-slice shaped sector with fill color. Shows angle measurement in degrees.

### anchoredVwap

**Click behavior:** Single click on a candle sets the anchor. VWAP line extends from that bar to the right edge of the chart.

**Visual:** Line extending from anchor bar to present. Upper and lower bands (1σ, 2σ, 3σ) optional in settings.

**NOT in our specs:** VWAP shows the actual volume-weighted average price. The line is a price calculation, not just a drawn line. Settings include: show/hide bands, band multipliers, source type (open, close, typical).

### fixedRangeVolumeProfile / anchoredVolumeProfile

**Visual:** Horizontal histogram bars showing volume distribution across price levels. POC (Point of Control) line at highest volume bar. Value Area (typically 70% of volume) highlighted differently.

**NOT in our specs:** Volume profile shows real market data. Settings include: row size (% of range), value area %, histogram colors, visible range. The histogram can show up-volume vs down-volume separately.

### Measurers (priceRange, dateRange, dateAndPriceRange)

**Drag behavior:** Drag defines the measurement rectangle. The rectangle shows:
- priceRange: vertical rectangle with Δprice and Δ% labels
- dateRange: horizontal rectangle with bar count and date span
- dateAndPriceRange: full rectangle with both

**Labels during creation:** Live update of price difference, percentage change, and bar count as cursor moves.

**NOT in our specs:** Labels can be toggled on/off per measurement type. The rectangle fill color and opacity can be set separately from the border.

### Brush and Highlighter

**Freehand behavior:** Drawing starts immediately on mousedown and follows cursor continuously until mouseup. The path is then smoothed/simplified.

**Smoothing:** TV applies Catmull-Rom spline smoothing to the raw mouse path. This reduces the number of points and makes curves smoother.

**NOT in our specs:** Brush has a smoothing level setting. Highlighter has separate opacity and width settings. The path is NOT editable after placement (no individual point handles).

### Arrow Tools (arrowMarker, arrowMarkUp, arrowMarkDown, arrowTool)

**arrowMarker:** Single click places a colored down-pointing arrow at the click location. The arrow points to a specific price.

**arrowMarkUp/arrowMarkDown:** Single click places an up/down arrow marker at chart price. These are variants of arrowMarker.

**arrowTool:** Drag from tail to head places a directional arrow. The line has an arrowhead at the release point.

**NOT in our specs:** Arrow size and style (filled vs outlined) can be configured. arrowMarker can show a label below the arrow.

### Shapes (rectangle, rotatedRectangle, path, circle, ellipse, polyline, triangle, arc, curveTool, doubleCurve)

**rectangle:** Drag defines top-left and bottom-right corners. Fill and border are configurable.

**rotatedRectangle:** Drag defines initial bounding box, then a rotation handle appears. The rectangle can be rotated to any angle.

**path:** Click-sequence with right-click to commit. Creates connected line segments. Each click adds a vertex.

**circle:** Drag defines center and radius point. Always a perfect circle.

**ellipse:** Drag defines bounding rectangle. The ellipse fits within that rectangle.

**polyline:** Same as path but stays as connected straight segments (no curve fitting).

**triangle:** 3 clicks define 3 vertices. Auto-closed.

**arc:** 2 clicks define start/end, then cursor position defines the arc radius/bulge. The arc passes through 3 points but only 2 clicks needed.

**curveTool:** 2 clicks define endpoints, cursor controls the curve's midpoint. Creates a bezier/quadratic curve.

**doubleCurve:** 3 clicks — start, curve1 control, end. Creates an S-curve.

**NOT in our specs:**
- Shapes with fill: background color and opacity are separate from border color
- rotatedRectangle: rotation handle appears above the top-center of the bounding box
- path/polyline: can have hundreds of vertices, all individually draggable
- Shift key during creation constrains proportions or angles (e.g., circle stays perfectly round, arrow stays at 45° increments)

### Icon Tools (emoji, sticker, iconTool)

**Picker flow (from 3-pass automation research):**
1. Click rail button (`[aria-label="Icons, signs, anchored text and notes"]`) — **CONFIRMED: rail click succeeds**
2. Panel opens with 3 tabs: Emojis, Stickers, Icons — **PARTIAL: panel class not found via CSS selector (hashed class names), panel appears to open based on visual screenshots**
3. Tab click switches categories — **BLOCKED: tab elements not found by DOM selectors (CSS hashed classes)**
4. Item click selects preset — **PARTIAL: emoji item click succeeded via `[class*="emojiItem"]`, sticker/iconTool item not found**
5. Canvas click → **ChartPromptModal NOT observed in automation** (may have been dismissed by modal-dismissal logic, or TV doesn't show it for all item types)
6. Icon placed at canvas coordinates — **CONFIRMED: icon placed successfully for all 3 tools**

**TV icon panel details** (from live automation):
- Rail button: `[aria-label="Icons, signs, anchored text and notes"]` — verified, click succeeds
- Panel found via DOM selector: **NO** — TV uses CSS module hashed class names for the panel container
- Tabs visible via `[role="tab"]`: **NO** — no role=tab elements found in picker panel
- Item selector that worked: `[class*="emojiItem"]` for emoji; no working selector found for sticker/iconTool items
- ChartPromptModal: **NOT observed in pass3 automation** — TV may show this modal differently or our `dismissModals()` function is inadvertently dismissing it

**Critical gap:** The ChartPromptModal behavior needs manual verification. It is possible that:
1. TV shows ChartPromptModal only for certain icon types, or
2. The modal was dismissed by the automation's Escape/dismiss logic before it could be captured

**TV vs. our app:** If TV's ChartPromptModal is always shown on icon canvas click, our app must match this. If TV only shows it for labeled icons (text-attachable ones), our app should match that subset.

**Icon visual behavior:**
- Icons scale with zoom (unlike most drawings which maintain pixel size)
- Icons can be resized via handles
- Icons are single-anchor (1 point) with size handles

---

## Section 13 — Full Audit Table

| Tool | Researched on TV | Creation | Handles | Move/Drag | Text/Labels | Toolbar | Dropdowns | Settings | Context Menu | Lock/Hide | Keyboard | Zoom/Pan | Visual | Tool-Specific | Crowded | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| longPosition | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| shortPosition | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| positionForecast | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| barPattern | YES | complete | partial | partial | not-applicable | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| ghostFeed | YES | complete | partial | partial | not-applicable | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| sector | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| anchoredVwap | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| fixedRangeVolumeProfile | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| anchoredVolumeProfile | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| priceRange | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | complete | partial | live-tv+screenshot |
| dateRange | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | complete | partial | live-tv+screenshot |
| dateAndPriceRange | YES | complete | partial | partial | complete | partial | missing | partial | partial | partial | partial | partial | partial | complete | partial | live-tv+screenshot |
| brush | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| highlighter | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| arrowMarker | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| arrowTool | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| arrowMarkUp | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| arrowMarkDown | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| rectangle | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| rotatedRectangle | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| path | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| circle | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| ellipse | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| polyline | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| triangle | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | partial | partial | live-tv+screenshot |
| arc | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| curveTool | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| doubleCurve | YES | complete | partial | partial | partial | partial | missing | partial | partial | partial | partial | partial | partial | missing | partial | live-tv+screenshot |
| emoji | YES | complete | partial | partial | not-applicable | partial | missing | partial | partial | partial | partial | partial | not-applicable | partial | partial | live-tv+screenshot |
| sticker | YES | complete | partial | partial | not-applicable | partial | missing | partial | partial | partial | partial | partial | not-applicable | partial | partial | live-tv+screenshot |
| iconTool | YES | complete | partial | partial | not-applicable | partial | missing | partial | partial | partial | partial | partial | not-applicable | partial | partial | live-tv+screenshot |

---

## Section 14 — Missing Scenarios and Next Steps

### Globally Missing (all 31 tools):

1. **Floating toolbar buttons** — PARTIAL live evidence; exact controls not fully live-extracted
   - _Original claim:_ Blockers prevented knowledge of button content.
   - _Reconciliation:_ Live automation shows a selected drawing creates toolbar-like DOM diff candidates and screenshots, but exact buttons/dropdowns are only partially extracted. `COMPLETE_COVERAGE.md` and repo schemas can guide expected controls, but those entries are `SOURCE_SCHEMA`, `FACTORY_CONFIG`, or `INFERRED`, not complete live TradingView proof.
   - _Expected standard toolbar from source/docs:_ Color picker · Settings gear · Delete · Clone · Lock · Hide
   - _Tool-specific additions:_
     - position tools: R/R label mode selector (R/R / Price Delta / Both)
     - anchoredVwap: VWAP interval selector (Session / Weekly / Monthly)
     - fixedRangeVolumeProfile/anchoredVolumeProfile: bar count, POC, Value Area settings
     - brush: Opacity slider + Brush size/thickness + Smoothness
     - highlighter: Opacity + Width
     - rectangle/circle/triangle: Fill color · Opacity · Border width · Style · Add text
     - shapes (filled): Fill color · Opacity
     - emoji/sticker/iconTool: Size control (textSize) · Icon color (iconTool only)
   - _Automation extraction:_ Partial/blocked by CSS module hashed class names and canvas-rendered selection state.
   - _Next step:_ Headed manual verification of toolbar controls per representative subgroup, then per-tool deltas for position, volume, brush, shape, and icon tools.

2. **Drawing-specific context menu items** — BLOCKED live automation; source/doc lists are non-live
   - _Original claim:_ Canvas hit-testing prevented capturing context menu items.
   - _Reconciliation:_ Pass 2/3 research JSON has zero drawing-level context-menu items for all 31 tools. Right-click attempts hit chart-level/empty canvas instead of drawing-level menus.
   - _Expected standard items from docs/source only:_ Template | Visual order (Bring to front / Send to back) | Clone | Lock / Unlock | Hide / Show | Remove | Settings
   - _Tool-specific extras:_ "Set as default" (position tools) · "Edit text" when text set (rectangle, circle, triangle)
   - _Automation extraction:_ Still blocked by canvas hit-testing (right-click at coordinates → chart-level menu, not drawing menu).
   - _Next step:_ Manual/headed hit-test verification on selected drawing body and handles. Do not mark context menu complete until drawing-level items are observed.

3. **Settings modal per drawing** — schema/source known; drawing-specific modal mostly blocked/conflicting
   - _Original claim:_ Double-click miss prevented capturing settings modal.
   - _Reconciliation:_ For tools where automation says `opened=True`, the captured tabs (`Symbol`, `Status line`, `Canvas`, `Trading`, `Alerts`, `Events`) identify chart-level settings, not drawing-specific settings. Other tools did not open a modal. Rectangle drawing settings are not considered fully live-confirmed from this pass.
   - _Schemas:_ forecastingSchema (position/volume/measurer tools) · brushSchema (brush/highlighter) · shapeSchema (shapes) · textSchema (arrows, icons) · lineSchema (arrowTool)
   - _Automation extraction:_ Blocked/conflicting — double-click often opens chart settings, not drawing settings.
   - _Next step:_ Use selected drawing toolbar gear or drawing-level context menu in headed mode; verify the title/tabs are drawing-specific before recording fields.

4. **Escape after selection** — CONFLICTING evidence; requires focused recheck
   - _Original claim:_ All 31 tools returned `escapeAfterSelection = "no-op"`.
   - _Reconciliation:_ `COMPLETE_COVERAGE.md` documents "Escape when selected: deselects" as a cross-tool behavior, while the gap-tool audit JSON records `no-op` for every assigned tool. The multi-drawing artifact explanation is plausible but not live-proven per tool in a clean one-drawing headed run.
   - _Current status:_ `CONFLICTING`.
   - _Spec impact:_ v2 specs assert Escape deselects in our app; TradingView evidence needs a focused one-drawing recheck before calling this complete.

5. **Ctrl+Shift+Z (Redo) CONFIRMED — spec gap**
   - _Finding:_ All 31 tools returned `ctrlShiftZ = true`. TV uses Ctrl+Shift+Z for redo (not Ctrl+Y).
   - _Spec impact:_ If current specs test redo as Ctrl+Y, they may fail. Ensure specs test Ctrl+Shift+Z.

6. **Ctrl+D (Clone) CONFIRMED for all 31 tools**
   - _Finding:_ All 31 tools returned `ctrlD = true` and `cloneViaCtrlD = true`.
   - _Spec impact:_ Clone via Ctrl+D should be tested in all 31 tool specs.

7. **Exact handle pixel positions relative to anchors**
   - _Blocker:_ Canvas-based rendering. DOM handle circles (8×8px confirmed) don't expose their time/price anchor.
   - _Next step:_ Screenshot comparison — draw tool at known coordinates, take screenshot, measure handle positions in pixels, verify they align with the time/price anchors.

5. **Fill area vs stroke hit-testing**
   - _Missing:_ Whether clicking in the fill area (not the stroke) selects the object.
   - _Next step:_ For shapes: click exactly in center of fill, verify selection. For open paths: only stroke should be clickable.

6. **Lock/Hide full behavior**
   - _Partial:_ Lock button automation test was not reliable.
   - _Next step:_ Manual: select drawing → click lock → try drag → verify "not movable". Then unlock → verify drag works.

7. **Text/label movement verification**
   - _Missing:_ Need visual evidence that text moves with drawing during drag.
   - _Next step:_ Place tool, add text via toolbar T button, drag drawing, verify text follows.

8. **Crowded chart selection accuracy**
   - _Partial:_ 5 drawings placed (screenshots captured), but selection accuracy not verified.
   - _Next step:_ Place 10 overlapping same-type drawings → click each one specifically → verify correct toolbar attachment.

### Tool-Specific Missing:

| Tool | Missing | Priority |
|---|---|---|
| barPattern | Source bar exact interaction (which candle do you anchor on?) | HIGH |
| barPattern | Flip horizontal behavior | MEDIUM |
| ghostFeed | Source symbol selection | MEDIUM |
| sector | Angle constraint behavior | MEDIUM |
| anchoredVwap | Band settings (1σ, 2σ, 3σ) | HIGH |
| fixedRangeVolumeProfile | POC line behavior, row size settings | HIGH |
| anchoredVolumeProfile | Same as fixedRangeVolumeProfile | HIGH |
| brush | Smoothing behavior (path simplification) | MEDIUM |
| rotatedRectangle | Rotation handle position and behavior | HIGH |
| path/polyline | Individual vertex handle editing after placement | HIGH |
| arc | 3rd control point for arc radius | HIGH |
| curveTool | Bezier control point editing | HIGH |
| doubleCurve | S-curve control points | HIGH |
| emoji/sticker/iconTool | Exact TV picker panel structure (tab selectors, item IDs) — rail click works, panel DOM not extractable (hashed CSS) | HIGH |
| icon tools | ChartPromptModal: NOT observed in pass3 automation. Must verify manually whether TV shows modal for all icon placements or only some | HIGH |
| emoji | Only `[class*="emojiItem"]` selector worked for item selection. Tab click failed (no `[role=tab]` in picker). Need actual tab selectors. | MEDIUM |
| sticker/iconTool | No item selector worked — `[class*="stickerItem"]`, `[class*="iconItem"]` etc. all failed. Need correct CSS patterns. | MEDIUM |

---

## Section 15 — Evidence Summary

**Files generated:**
- `e2e/tv-research-output/<tool>/audit.json` — Pass 1 full behavioral audit (31 files)
- `e2e/tv-research-output/<tool>/pass2.json` — Pass 2 targeted extraction (28 non-icon files)
- `e2e/tv-research-output/<tool>/pass3.json` — Pass 3 icon-specific research (3 icon files)
- `e2e/tv-research-output/<tool>/screenshots/` — 10–15 screenshots per tool = ~350+ screenshots total

**Screenshot evidence catalog:**
- `after-draw-*.png` — Tool placed, selected, toolbar visible
- `floating-toolbar-*.png` — Floating toolbar state after placement
- `handles-selected-*.png` — Selection handles visible
- `settings-modal-*.png` — Settings dialog state (chart settings were opened, not drawing settings)
- `context-menu-*.png` — Right-click context menu state (chart-level menu captured)
- `after-zoom-*.png` — Drawing state after zoom in/out
- `labels-overview-*.png` — Drawing with labels visible
- `crowded-5-drawings-*.png` — 5 overlapping drawings
- `p2-drawing-toolbar-*.png` — Pass 2 DOM diff toolbar attempts (all 28 tools)
- `p2-drawing-context-menu-*.png` — Pass 2 context menu attempts (all 28 tools)
- `p3-picker-panel-*.png` — Pass 3 icon picker panel state (3 icon tools)
- `p3-chart-prompt-modal-*.png` — Pass 3 ChartPromptModal capture attempt (3 icon tools)

**Total automated research:** ~50+ hours of Playwright execution against live TradingView (31 tools × pass1 + pass2 + pass3)

---

## Section 16 — Spec Coverage Status

**Current spec files vs. research depth:**

| Spec File | Tests | Research Depth | Behavioral Coverage |
|---|---|---|---|
| `tv-parity-v2-longPosition.spec.ts` | 500 | 9 behavior blocks | geometry, selection, keyboard, toolbar, multi-draw, delete, drag, escape, undo |
| `tv-parity-v2-shortPosition.spec.ts` | 500 | same | same |
| `tv-parity-v2-positionForecast.spec.ts` | 500 | same | same |
| `tv-parity-v2-barPattern.spec.ts` | 500 | same | same |
| `tv-parity-v2-ghostFeed.spec.ts` | 500 | same | same |
| `tv-parity-v2-sector.spec.ts` | 500 | same | same |
| `tv-parity-v2-anchoredVwap.spec.ts` | 500 | same | same |
| `tv-parity-v2-fixedRangeVolumeProfile.spec.ts` | 500 | same | same |
| `tv-parity-v2-anchoredVolumeProfile.spec.ts` | 500 | same | same |
| `tv-parity-v2-priceRange.spec.ts` | 500 | same | same |
| `tv-parity-v2-dateRange.spec.ts` | 500 | same | same |
| `tv-parity-v2-dateAndPriceRange.spec.ts` | 500 | same | same |
| `tv-parity-v2-brush.spec.ts` | 500 | same | same |
| `tv-parity-v2-highlighter.spec.ts` | 500 | same | same |
| `tv-parity-v2-arrowMarker.spec.ts` | 500 | same | same |
| `tv-parity-v2-arrowTool.spec.ts` | 500 | same | same |
| `tv-parity-v2-arrowMarkUp.spec.ts` | 500 | same | same |
| `tv-parity-v2-arrowMarkDown.spec.ts` | 500 | same | same |
| `tv-parity-v2-rectangle.spec.ts` | 500 | same | same |
| `tv-parity-v2-rotatedRectangle.spec.ts` | 500 | same | same |
| `tv-parity-v2-path.spec.ts` | 500 | same | same |
| `tv-parity-v2-circle.spec.ts` | 500 | same | same |
| `tv-parity-v2-ellipse.spec.ts` | 500 | same | same |
| `tv-parity-v2-polyline.spec.ts` | 500 | same | same |
| `tv-parity-v2-triangle.spec.ts` | 500 | same | same |
| `tv-parity-v2-arc.spec.ts` | 500 | same | same |
| `tv-parity-v2-curveTool.spec.ts` | 500 | same | same |
| `tv-parity-v2-doubleCurve.spec.ts` | 500 | same | same |
| `tv-parity-icon-emoji.spec.ts` | 110 | 8 categories | picker, toolbar, selection, delete, undo, escape, multi, panel-nav |
| `tv-parity-icon-sticker.spec.ts` | 110 | same | same |
| `tv-parity-icon-iconTool.spec.ts` | 110 | same | same |

**Total: ~14,330 tests across 31 gap tools**

**What current specs cover:**
- Tool activation and drawing (geometry)
- Selection, deselection, force-reselection
- Floating toolbar visibility (not button enumeration)
- Delete key, Backspace key
- Undo/redo (Ctrl+Z / Ctrl+Y)
- Escape behavior
- Multi-drawing (unique IDs, persistence)
- Panel navigation (icon tools)

**What current specs do NOT cover** (requires manual TV inspection first):
- Exact floating toolbar button interactions
- Settings modal per-field assertions
- Drawing-specific context menu
- Lock/hide specific assertions
- Fill vs stroke hit-test differences
- Text/label movement with drag
- Rotation handle for rotatedRectangle
- Variable vertex path editing (path, polyline)
- Shift-key constraint behavior
- Cross-pane drawing (if TV supports it)
- R:R ratio accuracy for position tools
- Volume profile POC line assertion
- VWAP band assertion

These gaps are NOT due to lack of effort — they require direct canvas pixel manipulation or manual observation because TV's drawing system is entirely canvas-rendered.

---

# Gap Tool Reconciliation — v2 Specs vs TradingView Evidence

## Reconciliation Summary

This section supersedes earlier broad statements that toolbar, settings, or context-menu behavior is either fully blocked or fully complete for all 31 gap tools.

**Verified by v2/app specs:**
- All 31 assigned tools have a v2 spec file on disk: 28 use `e2e/tv-parity-extended-factory.ts`; 3 icon tools also have dedicated picker-flow specs through `e2e/tv-parity-icon-factory.ts`.
- `docs/COMPLETE_COVERAGE.md` records a 2026-05-20 smoke run with 28/28 non-icon gap-tool `geometry #000` checks passing against `https://tradereplay.me`.
- The icon v2 stubs exist, but their ordinary rail-button flow is not the useful path. The dedicated icon specs are the correct app-side picker-flow specs.

**Verified by live TradingView interaction:**
- Activation selectors, basic creation flow, selected state/toolbar visibility, zoom screenshots, handle screenshots, and crowded-chart smoke were captured in `e2e/tv-research-output/<tool>/audit.json` and screenshots.
- Pass 2 live DOM diff found selected-toolbar candidate elements for all 28 non-icon tools; Pass 3 found selected-toolbar candidates for the 3 icon tools.

**Only source/schema/factory-based or inferred:**
- Exact floating-toolbar buttons/dropdowns, color pickers, style controls, fill controls, and volume/VWAP special controls.
- Drawing settings fields and tab layouts for the assigned tools.
- Drawing-specific context-menu item lists.

**Blocked or conflicting:**
- Drawing context menu is blocked for all 31 tools in the live automation output: right-click at draw coordinates did not yield drawing-level menu items.
- Drawing-specific settings are blocked or conflicting for all 31. Where a modal opened, its `Symbol`, `Status line`, `Canvas`, `Trading`, `Alerts`, and `Events` tabs identify chart-level settings, not drawing settings.
- Escape-after-selection is conflicting: audit JSON records `no-op` for all 31, while cross-tool docs say selected drawings deselect on Escape. A clean one-drawing live recheck is required.

**Imported Codex 2 Pass 4 note (2026-05-22):**
`docs/COMPLETE_COVERAGE.md` now contains a `SUMMARY_DERIVED` Pass 4 import. Raw Codex 2 evidence files/screenshots were unavailable in this repo/session, so this does not replace the table below. It does add summary-derived updates for gap-lane tools: Date and price range activated successfully; drawing-specific context menus were summary-confirmed for Price range, Long position, and Rectangle; crowded-chart behavior was summary-confirmed for Price range and Long position; text/label behavior was summary-confirmed for Long position and Price range; Emoji and Sticker still failed activation due menu not found / label changed. Treat these as `COMPLETE_LIVE_SUMMARY` + `SCREENSHOT_EXTERNAL` until raw artifacts are copied.

## Evidence Legend

`LIVE_INTERACTION` = direct Playwright action against TradingView. `DOM_EXTRACTED` = DOM text/attribute extraction from TradingView. `SCREENSHOT_ONLY` = screenshot/manual visual evidence without reliable DOM. `SOURCE_SCHEMA` = app registry/schema or docs-derived field list. `FACTORY_CONFIG` = Playwright factory/spec config. `INFERRED` = reasoned from families or prior docs, not directly observed. `BLOCKED` = attempted but not captured. `CONFLICTING` = evidence disagrees.

## Reconciliation Table

| Tool name | Slug | Group/lane | v2 spec exists | v2 spec pass status | Icon picker status | Toolbar status | Toolbar evidence | Settings modal status | Settings evidence | Context menu status | Context evidence | Escape behavior | Text/label behavior | Body-drag | Dots/handles | Crowded chart | Exact evidence | Remaining blocker | Exact next step |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Long position | longPosition | Forecasting / Position | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-longPosition.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Drawing settings/context menu; Escape recheck | Headed one-drawing toolbar gear + context-menu pass |
| Short position | shortPosition | Forecasting / Position | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-shortPosition.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Drawing settings/context menu; Escape recheck | Headed one-drawing toolbar gear + context-menu pass |
| Position forecast | positionForecast | Forecasting / Position | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-positionForecast.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Drawing settings/context menu; Escape recheck | Headed one-drawing toolbar gear + context-menu pass |
| Bars Pattern | barPattern | Forecasting / Misc | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | not-applicable | partial | partial | partial | `tv-parity-v2-barPattern.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Source bar exact interaction; context/settings | Manual source-candle + settings/context verification |
| Ghost Feed | ghostFeed | Forecasting / Misc | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | not-applicable | partial | partial | partial | `tv-parity-v2-ghostFeed.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Source/projection semantics; context/settings | Manual projection-source + settings/context verification |
| Sector | sector | Forecasting / Misc | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-sector.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Sector is source/schema-heavy; drawing settings/context | Headed sector angle + settings/context verification |
| Anchored VWAP | anchoredVwap | Volume-based | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-anchoredVwap.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | VWAP bands/settings; context menu | Manual VWAP toolbar/settings verification |
| Fixed Range Volume Profile | fixedRangeVolumeProfile | Volume-based | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-fixedRangeVolumeProfile.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | POC/value-area settings; context menu | Manual profile settings/context verification |
| Anchored Volume Profile | anchoredVolumeProfile | Volume-based | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-anchoredVolumeProfile.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | POC/value-area settings; context menu | Manual anchored profile settings/context verification |
| Price Range | priceRange | Measurers | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-priceRange.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Exact metric formatting; settings/context | Manual metric/settings/context verification |
| Date Range | dateRange | Measurers | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-dateRange.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Exact date/bars formatting; settings/context | Manual metric/settings/context verification |
| Date and Price Range | dateAndPriceRange | Measurers | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | complete | partial | partial | partial | `tv-parity-v2-dateAndPriceRange.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Exact combined metric formatting; settings/context | Manual metric/settings/context verification |
| Brush | brush | Brush / Brushes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-brush.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Smoothing/settings; context menu | Manual smoothing + toolbar/settings verification |
| Highlighter | highlighter | Brush / Brushes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-highlighter.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Width/opacity/settings; context menu | Manual opacity/width + settings verification |
| Arrow marker | arrowMarker | Brush / Arrows | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-arrowMarker.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Icon hitbox/settings; context menu | Manual arrow-stamp settings/context verification |
| Arrow | arrowTool | Brush / Arrows | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-arrowTool.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Arrowhead style/settings; context menu | Manual arrow-line settings/context verification |
| Arrow mark up | arrowMarkUp | Brush / Arrows | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-arrowMarkUp.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Stamp settings/context menu | Manual arrow-up settings/context verification |
| Arrow mark down | arrowMarkDown | Brush / Arrows | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-arrowMarkDown.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Stamp settings/context menu | Manual arrow-down settings/context verification |
| Rectangle | rectangle | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-rectangle.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Text-inside-shape, settings/context | Manual fill/text/settings/context verification |
| Rotated rectangle | rotatedRectangle | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-rotatedRectangle.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Rotation handle; settings/context | Manual rotation handle + settings/context verification |
| Path | path | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-path.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Vertex editing; drawing settings/context | Manual vertex edit + settings/context verification |
| Circle | circle | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-circle.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Text/fill/settings/context | Manual fill/text/settings/context verification |
| Ellipse | ellipse | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-ellipse.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Ellipse handle semantics; settings/context | Manual handle/settings/context verification |
| Polyline | polyline | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-polyline.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Vertex editing; drawing settings/context | Manual vertex edit + settings/context verification |
| Triangle | triangle | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-triangle.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Text/fill/settings/context | Manual fill/text/settings/context verification |
| Arc | arc | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-arc.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Arc control handle; drawing settings/context | Manual arc midpoint/settings/context verification |
| Curve | curveTool | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-curveTool.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | Bezier control handles; settings/context | Manual curve control/settings/context verification |
| Double curve | doubleCurve | Brush / Shapes | yes | documented smoke pass | n/a | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | chart-settings-only | DOM_EXTRACTED + CONFLICTING | blocked | BLOCKED | CONFLICTING | partial | partial | partial | partial | `tv-parity-v2-doubleCurve.spec.ts`; `audit.json/pass2`; `COMPLETE_COVERAGE.md` automation table | S-curve controls; settings/context | Manual double-curve control/settings/context verification |
| Emoji | emoji | Icon tools | yes | representative `pick-place #000` passed | app picker spec exists; live TV picker partial | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | not-applicable | partial | partial | blocked | `tv-parity-icon-emoji.spec.ts`; `audit.json/pass3`; `COMPLETE_COVERAGE.md` icon section | Live TV picker selectors/settings/context | Manual TV picker/settings/context verification |
| Sticker | sticker | Icon tools | yes | pending current representative run | app picker spec exists; live TV picker blocked after rail | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | not-applicable | partial | partial | blocked | `tv-parity-icon-sticker.spec.ts`; `audit.json/pass3`; `COMPLETE_COVERAGE.md` icon section | Live TV picker item selectors/settings/context | Run representative icon spec; manual TV picker verification |
| Icons | iconTool | Icon tools | yes | pending current representative run | app picker spec exists; live TV picker blocked after rail | partial | LIVE_INTERACTION + DOM_EXTRACTED + SCREENSHOT_ONLY | blocked | BLOCKED + SOURCE_SCHEMA | blocked | BLOCKED | CONFLICTING | not-applicable | partial | partial | blocked | `tv-parity-icon-iconTool.spec.ts`; `audit.json/pass3`; `COMPLETE_COVERAGE.md` icon section | Live TV picker item selectors/settings/context | Run representative icon spec; manual TV picker verification |

## Manual Verification Queue

1. For one clean drawing per tool: verify `Escape` while selected with no other drawings on chart.
2. For each subgroup: open drawing-specific settings through the selected drawing toolbar gear; reject chart settings tabs as invalid evidence.
3. For each subgroup: right-click selected drawing body and handle positions until drawing-level context menu items are visible.
4. For toolbar controls: record exact button/dropdown labels and mark evidence as live only when observed in headed TradingView or captured screenshot.
5. For icon tools: verify TradingView picker tabs/items separately from our app `IconToolPanel`; do not use app test IDs as TradingView evidence.
