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
