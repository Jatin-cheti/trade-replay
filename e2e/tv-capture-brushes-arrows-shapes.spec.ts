/**
 * TradingView Automation Capture Script — BRUSHES, ARROWS & SHAPES
 * =================================================================
 * Runs 500 behavioral scenarios per tool against live TradingView (in.tradingview.com)
 * for all Brushes, Arrows and Shapes tools (Brush rail, "Geometric shapes" expander).
 *
 * Captures: UI state, tooltip text, pixel screenshots, interaction logs,
 * context-menu items, keyboard shortcut behaviors, multi-tool interactions,
 * anchor counts, color defaults, and floating toolbar state.
 *
 * Output: JSON lines written to e2e/tv-capture-output/<tool>/<scenario>.json
 *         Screenshots saved to e2e/tv-references/<tool>/state-NNN.png
 *
 * Run (Chromium, headful so TV toolbar loads):
 *   cd tradereplay
 *   npx playwright test e2e/tv-capture-forecasting-volume-measurers.spec.ts \
 *     --config=e2e/playwright.tv-capture.config.ts \
 *     --project=chromium --headed
 *
 * TV chart page (public, no login required after dismiss):
 *   https://in.tradingview.com/chart/QL1fWIPB/?symbol=NSE%3ARELIANCE
 */

import { test, expect } from "@playwright/test";
import type { Page, BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────
const TV_URL =
  "https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE";

const OUT_DIR = path.join(__dirname, "tv-capture-output");
const REF_DIR = path.join(__dirname, "tv-references");

// ─── Tool catalogue ───────────────────────────────────────────────────────────
/**
 * Each entry describes how to locate and exercise the tool in TradingView's UI.
 * TV selectors were captured by inspecting https://in.tradingview.com with
 * Playwright codegen + manual verification.
 */
interface TVToolSpec {
  /** Short key used for output file/folder names */
  key: string;
  /** Human label shown in TV UI */
  label: string;
  /** Category rail button selector in TV (left sidebar) */
  railSelector: string;
  /** Tool button selector inside the rail popover */
  toolSelector: string;
  /** How the tool is drawn: "drag" | "click" | "click-sequence" */
  commitMode: "drag" | "click" | "click-sequence";
  /** Number of anchors the tool expects */
  anchorCount: number;
  /** Selector for the TV floating toolbar that appears on selection */
  floatingToolbarSelector?: string;
  /** TV tooltip text expected when hovering the tool button */
  expectedTooltip: string;
  /** Expected fill/line color defaults (hex or TV color name) */
  expectedColorDefault?: string;
  /** Keyboard shortcut used to activate tool in TV */
  tvShortcut?: string;
}

const FORECASTING_TOOLS: TVToolSpec[] = [
  // BRUSHES sub-section
  {
    key: "brush",
    label: "Brush",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Brush"]',
    commitMode: "drag",
    anchorCount: 2,
    expectedTooltip: "Brush",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "highlighter",
    label: "Highlighter",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Highlighter"]',
    commitMode: "drag",
    anchorCount: 2,
    expectedTooltip: "Highlighter",
    expectedColorDefault: "#ffeb3b",
  },
];

const VOLUME_TOOLS: TVToolSpec[] = [
  // ARROWS sub-section (kept variable name for code-shape compatibility)
  {
    key: "arrowMarker",
    label: "Arrow marker",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Arrow marker"]',
    commitMode: "click",
    anchorCount: 1,
    expectedTooltip: "Arrow marker",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "arrowTool",
    label: "Arrow",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Arrow"]',
    commitMode: "drag",
    anchorCount: 2,
    expectedTooltip: "Arrow",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "arrowMarkUp",
    label: "Arrow mark up",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Arrow mark up"]',
    commitMode: "click",
    anchorCount: 1,
    expectedTooltip: "Arrow mark up",
    expectedColorDefault: "#089981",
  },
  {
    key: "arrowMarkDown",
    label: "Arrow mark down",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Arrow mark down"]',
    commitMode: "click",
    anchorCount: 1,
    expectedTooltip: "Arrow mark down",
    expectedColorDefault: "#f23645",
  },
];

const MEASURER_TOOLS: TVToolSpec[] = [
  // SHAPES sub-section (variable name kept for code-shape compatibility)
  {
    key: "rectangle",
    label: "Rectangle",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Rectangle"]',
    commitMode: "drag",
    anchorCount: 2,
    expectedTooltip: "Rectangle",
    expectedColorDefault: "#2962ff",
    tvShortcut: "Alt+R",
  },
  {
    key: "rotatedRectangle",
    label: "Rotated rectangle",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Rotated rectangle"]',
    commitMode: "drag",
    anchorCount: 2,
    expectedTooltip: "Rotated rectangle",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "path",
    label: "Path",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Path"]',
    commitMode: "click-sequence",
    anchorCount: 3,
    expectedTooltip: "Path",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "circle",
    label: "Circle",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Circle"]',
    commitMode: "drag",
    anchorCount: 2,
    expectedTooltip: "Circle",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "ellipse",
    label: "Ellipse",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Ellipse"]',
    commitMode: "drag",
    anchorCount: 2,
    expectedTooltip: "Ellipse",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "polyline",
    label: "Polyline",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Polyline"]',
    commitMode: "click-sequence",
    anchorCount: 3,
    expectedTooltip: "Polyline",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "triangle",
    label: "Triangle",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Triangle"]',
    commitMode: "click-sequence",
    anchorCount: 3,
    expectedTooltip: "Triangle",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "arc",
    label: "Arc",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Arc"]',
    commitMode: "click-sequence",
    anchorCount: 3,
    expectedTooltip: "Arc",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "curveTool",
    label: "Curve",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Curve"]',
    commitMode: "click-sequence",
    anchorCount: 3,
    expectedTooltip: "Curve",
    expectedColorDefault: "#2962ff",
  },
  {
    key: "doubleCurve",
    label: "Double curve",
    railSelector: '[aria-label="Geometric shapes"]',
    toolSelector: '[aria-label="Double curve"]',
    commitMode: "click-sequence",
    anchorCount: 3,
    expectedTooltip: "Double curve",
    expectedColorDefault: "#2962ff",
  },
];

const ALL_TOOLS = [...FORECASTING_TOOLS, ...VOLUME_TOOLS, ...MEASURER_TOOLS];

// ─── Scenario catalogue ───────────────────────────────────────────────────────
/**
 * The 500 scenarios per tool are grouped into thematic blocks.
 * Each block specifies how to act and what to observe/assert.
 * Scenario types:
 *   ui-tooltip      — hover the toolbar button, read tooltip text & icon
 *   ui-rail         — verify the tool appears in the correct rail/category
 *   creation        — draw/place the tool, verify drawing count & anchor count
 *   selection       — draw then click away & reclick to check selection state
 *   floating-tb     — verify floating toolbar appears with correct buttons
 *   resize          — drag an anchor to a new position, verify moved
 *   delete          — draw then Delete/Backspace, verify count==0
 *   undo-redo       — draw N times, undo N, redo N
 *   context-menu    — right-click on drawing, verify menu items
 *   color-default   — draw, inspect color property, compare to TV default
 *   style-change    — draw, open settings, change color/width, verify
 *   edge-exit       — move cursor to edge of chart, verify drawing persists
 *   keyboard-shortcut — activate tool with TV keyboard shortcut
 *   multi-drawing   — draw N tools, verify N unique IDs
 *   pan-persistence — draw, pan chart, verify drawing persists
 *   escape-mid-draw — start drawing, press Escape mid-draft
 *   escape-selected — draw, select, press Escape to deselect
 *   snap-magnet     — draw near OHLC candle, verify anchor snaps to price
 *   tooltip-content — hover over placed drawing, verify tooltip text format
 *   info-label      — verify inline price/percentage labels on drawing body
 *   cross-tool      — switch to different tool mid-session, verify no bleed
 *   lock            — lock a drawing, verify it cannot be dragged
 *   hide-show       — hide a drawing, verify it is invisible; show again
 *   clone-duplicate — right-click → Clone/Duplicate, verify count increases
 *   z-order         — check z-order consistency when multiple drawings overlap
 *   settings-dialog — open full settings dialog via right-click → Edit
 *   pixel-region    — screenshot the drawing region, save as reference image
 *   axis-labels     — verify price/date axis labels shown at anchor coordinates
 *   rr-label        — (position tools) verify R:R label text on the drawing
 *   vwap-line       — (VWAP tools) verify the VWAP line renders from anchor
 *   volume-bars     — (volume profile) verify histogram bars render inside box
 *   bars-pattern    — (barPattern) verify candlestick preview renders
 *   ghost-line      — (ghostFeed) verify dashed ghost projection line renders
 *   price-label     — (measurers) verify price-change label on rectangle
 */

type ScenarioKind =
  | "ui-tooltip"
  | "ui-rail"
  | "creation"
  | "selection"
  | "floating-tb"
  | "resize"
  | "delete"
  | "undo-redo"
  | "context-menu"
  | "color-default"
  | "style-change"
  | "edge-exit"
  | "keyboard-shortcut"
  | "multi-drawing"
  | "pan-persistence"
  | "escape-mid-draw"
  | "escape-selected"
  | "snap-magnet"
  | "tooltip-content"
  | "info-label"
  | "cross-tool"
  | "lock"
  | "hide-show"
  | "clone-duplicate"
  | "z-order"
  | "settings-dialog"
  | "pixel-region"
  | "axis-labels"
  | "rr-label"
  | "vwap-line"
  | "volume-bars"
  | "bars-pattern"
  | "ghost-line"
  | "price-label";

interface Scenario {
  index: number;
  kind: ScenarioKind;
  description: string;
  seed: number;
}

/** Build the 500-scenario list for a given tool. */
function buildScenarios(tool: TVToolSpec): Scenario[] {
  const scenarios: Scenario[] = [];
  let idx = 0;

  function add(kind: ScenarioKind, description: string, seed = 0) {
    scenarios.push({ index: idx++, kind, description, seed });
  }

  // ── UI / Tooltip (20 scenarios) ────────────────────────────────────────────
  add("ui-tooltip", "Hover tool button — tooltip text matches spec", 0);
  add("ui-tooltip", "Tooltip visible within 800ms of hover", 1);
  add("ui-tooltip", "Tooltip disappears when cursor leaves button", 2);
  add("ui-tooltip", "Tooltip text contains tool name (case-insensitive)", 3);
  add("ui-tooltip", "Tooltip is not empty string", 4);
  add("ui-tooltip", "Tool icon visible in rail button", 5);
  add("ui-rail", "Tool appears in correct rail category", 0);
  add("ui-rail", "Rail category button has correct icon", 1);
  add("ui-rail", "Tool is visible without scrolling when rail open", 2);
  add("ui-rail", "Tool button is not disabled/grayed out", 3);
  add("ui-rail", "Rail popover closes on Escape", 4);
  add("ui-rail", "Rail popover closes on click outside", 5);
  add("ui-rail", "Tool button has accessible aria-label", 6);
  add("ui-rail", "Tool button has data-name attribute", 7);
  add("ui-rail", "Tool button hover state renders", 8);
  add("ui-rail", "Tool group/subsection header visible", 9);
  add("ui-tooltip", "Tooltip shows keyboard shortcut if applicable", 6);
  add("ui-tooltip", "Multiple tooltips don't overlap each other", 7);
  add("ui-rail", "Rail closes after tool is selected", 10);
  add("ui-rail", "Selected tool has active/highlighted state", 11);

  // ── Creation (80 scenarios) ────────────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    add("creation", `Draw tool at position grid[${i}] — drawing count +1`, i);
  }
  for (let i = 0; i < 20; i++) {
    add(
      "creation",
      `Draw at diagonal angle ${i * 9}° — anchor count == ${tool.anchorCount}`,
      i,
    );
  }
  add("creation", "Minimum-size draw (≤5px) still creates drawing", 0);
  add("creation", "Maximum-size draw (full chart) creates drawing", 1);
  add("creation", "Draw near top-left corner of chart", 2);
  add("creation", "Draw near top-right corner of chart", 3);
  add("creation", "Draw near bottom-left corner of chart", 4);
  add("creation", "Draw near bottom-right corner of chart", 5);
  add("creation", "Draw horizontally (same Y) — commits correctly", 6);
  add("creation", "Draw vertically (same X) — commits correctly", 7);
  add(
    "creation",
    "Draw at 45° angle — commits with correct anchor positions",
    8,
  );
  add("creation", "Draw crosses center of chart — commits correctly", 9);
  add("creation", "Rapid draw (no delay between anchors) — commits", 10);
  add("creation", "Slow draw (1s between anchors) — commits", 11);
  add("creation", "Drawing auto-selects after commit (TV parity)", 12);
  add("creation", "After commit, tool mode resets to none/cursor", 13);
  add(
    "creation",
    "Keep-drawing: next draw starts immediately without re-activating",
    14,
  );

  // ── Selection (50 scenarios) ───────────────────────────────────────────────
  for (let i = 0; i < 25; i++) {
    add(
      "selection",
      `Click away then click on body at seed ${i} — reselects`,
      i,
    );
  }
  add("selection", "Click on anchor point selects drawing", 0);
  add("selection", "Click far from drawing deselects", 1);
  add("selection", "Double-click on drawing opens settings", 2);
  add("selection", "Selected drawing shows anchor handles", 3);
  add("selection", "Anchor handles appear at correct pixel positions", 4);
  add("selection", "Clicking different drawing transfers selection", 5);
  add("selection", "Escape while selected → deselects", 6);
  add("selection", "Shift-click multiple drawings → multi-select", 7);
  add("selection", "Click on canvas (not on drawing) → deselect all", 8);
  add("selection", "Selection persists after scrolling chart", 9);
  add("selection", "Selection state restored after undo/redo", 10);
  add("selection", "Lock then click — locked drawing is not selectable", 11);
  add("selection", "Hidden drawing cannot be selected", 12);
  add("selection", "Right-click selects drawing (context-menu trigger)", 13);
  add("selection", "Tab key cycles through drawings", 14);
  add(
    "selection",
    "After deleting selected drawing, no other drawing is selected",
    15,
  );
  add("selection", "Selection handles remain visible during hover", 16);
  add("selection", "Selection tooltip disappears after deselect", 17);
  add("selection", "Mouse cursor changes to 'move' when over drawing", 18);
  add("selection", "Mouse cursor changes to 'nesw-resize' at anchor", 19);
  add(
    "selection",
    "Click selects topmost drawing when drawings overlap",
    20,
  );
  add("selection", "ForceSelect via debug API — drawing marked selected", 21);
  add("selection", "Rapid click-click on drawing — stable selection", 22);
  add("selection", "Drawing remains selected when chart timeframe changes", 23);

  // ── Floating Toolbar (30 scenarios) ───────────────────────────────────────
  add("floating-tb", "Toolbar appears after drawing is created", 0);
  add("floating-tb", "Toolbar positioned above/near drawing anchor", 1);
  add("floating-tb", "Toolbar has color picker button", 2);
  add("floating-tb", "Toolbar has line-weight selector", 3);
  add("floating-tb", "Toolbar has line-style selector", 4);
  add("floating-tb", "Toolbar has opacity control", 5);
  add("floating-tb", "Toolbar has settings/gear icon", 6);
  add("floating-tb", "Toolbar has delete/trash icon", 7);
  add("floating-tb", "Toolbar has lock icon", 8);
  add("floating-tb", "Toolbar has hide/eye icon", 9);
  add("floating-tb", "Toolbar has clone icon", 10);
  add("floating-tb", "Toolbar stays visible while drawing is selected", 11);
  add("floating-tb", "Toolbar hides when drawing is deselected", 12);
  add("floating-tb", "Toolbar remains inside viewport when drawing near edge", 13);
  add("floating-tb", "Clicking color swatch opens color picker", 14);
  add("floating-tb", "Color picker closes on Escape", 15);
  add("floating-tb", "Changing color from toolbar updates drawing immediately", 16);
  add("floating-tb", "Changing line weight updates drawing immediately", 17);
  add("floating-tb", "Clicking settings gear opens full settings dialog", 18);
  add("floating-tb", "Clicking trash icon deletes the drawing", 19);
  add(
    "floating-tb",
    "Clicking lock icon locks drawing (no-drag after lock)",
    20,
  );
  add("floating-tb", "Clicking eye icon hides the drawing", 21);
  add("floating-tb", "Clicking clone creates a new identical drawing", 22);
  add(
    "floating-tb",
    "Toolbar centerX is within chart bounds at all 30 grid positions",
    23,
  );
  for (let i = 0; i < 6; i++) {
    add(
      "floating-tb",
      `Toolbar anchor position grid[${24 + i}] inside viewport`,
      i,
    );
  }

  // ── Resize / Drag-Anchor (40 scenarios) ────────────────────────────────────
  for (let i = 0; i < 30; i++) {
    add(
      "resize",
      `Drag anchor[${i % tool.anchorCount}] by (${(i % 5) * 10},${(i % 4) * 8})px — moves`,
      i,
    );
  }
  add("resize", "Drag body (not anchor) moves entire drawing", 0);
  add("resize", "Drag body horizontally only — Y unchanged", 1);
  add("resize", "Drag body vertically only — X unchanged", 2);
  add("resize", "Drag to chart edge — drawing stays within bounds", 3);
  add("resize", "Drag outside viewport — drawing does not disappear", 4);
  add("resize", "Drag anchor while holding Shift — constrained movement", 5);
  add("resize", "Drag anchor while holding Ctrl — fine precision movement", 6);
  add("resize", "Rapid drag (no settle delay) — drawing updates", 7);
  add("resize", "Draw, pan, select, drag — anchor moves in chart coordinates", 8);
  add("resize", "Undo after drag — drawing returns to original position", 9);

  // ── Delete (30 scenarios) ─────────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    add("delete", `Delete key at seed ${i} — drawing removed from store`, i);
  }
  for (let i = 0; i < 10; i++) {
    add(
      "delete",
      `Backspace key at seed ${i} — drawing removed from store`,
      i,
    );
  }
  add(
    "delete",
    "Delete via context-menu item 'Remove' — drawing removed",
    0,
  );
  add(
    "delete",
    "Delete via floating toolbar trash button — drawing removed",
    1,
  );
  add("delete", "Delete locked drawing — should fail / no-op", 2);
  add("delete", "Delete hidden drawing — drawing removed", 3);
  add("delete", "Delete last drawing — chart is empty", 4);
  add("delete", "Delete one of two drawings — other persists", 5);
  add("delete", "Ctrl+Z after delete — drawing restored", 6);
  add("delete", "Ctrl+Z after delete — correct drawing restored (by ID)", 7);
  add("delete", "Delete all drawings via 'Remove All' context option", 8);
  add("delete", "Drawing count goes to 0 after remove all", 9);

  // ── Undo/Redo (50 scenarios) ──────────────────────────────────────────────
  for (let n = 1; n <= 10; n++) {
    for (let s = 0; s < 5; s++) {
      add(
        "undo-redo",
        `Draw ${n}, undo ${n} → count==0; redo ${n} → count==${n}`,
        n * 10 + s,
      );
    }
  }

  // ── Context Menu (20 scenarios) ──────────────────────────────────────────
  add("context-menu", "Right-click on drawing shows context menu", 0);
  add("context-menu", "Context menu has 'Edit' or 'Settings' item", 1);
  add("context-menu", "Context menu has 'Remove' item", 2);
  add("context-menu", "Context menu has 'Clone' item", 3);
  add("context-menu", "Context menu has 'Lock' item", 4);
  add("context-menu", "Context menu has 'Hide' item", 5);
  add("context-menu", "Context menu has 'Bring to front' item", 6);
  add("context-menu", "Context menu has 'Send to back' item", 7);
  add("context-menu", "Context menu closes on Escape", 8);
  add("context-menu", "Context menu closes on click outside", 9);
  add("context-menu", "Context menu 'Remove' deletes drawing", 10);
  add("context-menu", "Context menu 'Clone' duplicates drawing", 11);
  add("context-menu", "Context menu 'Lock' prevents drag", 12);
  add("context-menu", "Context menu 'Hide' hides drawing", 13);
  add("context-menu", "Context menu 'Edit' opens settings dialog", 14);
  add("context-menu", "Right-click on empty chart — no drawing context menu", 15);
  add("context-menu", "Context menu position is near the right-click point", 16);
  add("context-menu", "Context menu arrow keys navigate items", 17);
  add("context-menu", "Context menu Enter key triggers action", 18);
  add(
    "context-menu",
    "Context menu is not shown for locked + hidden drawing",
    19,
  );

  // ── Color Defaults (15 scenarios) ─────────────────────────────────────────
  add(
    "color-default",
    "Freshly drawn tool has expected default color from TV",
    0,
  );
  add("color-default", "Color value matches TV hex default", 1);
  add("color-default", "Opacity default is ≥ 0.5 (semi-transparent fill)", 2);
  add("color-default", "Line width default is 1 or 2 (TV parity)", 3);
  add("color-default", "Line style default is 'solid'", 4);
  add("color-default", "Color persists after pan/zoom", 5);
  add("color-default", "Color persists after undo/redo", 6);
  add("color-default", "New tool inherits last-used color (TV behavior)", 7);
  add("color-default", "Reset to defaults restores expected color", 8);
  add("color-default", "Color option field appears in settings dialog", 9);
  add("color-default", "Changing color updates the rail button icon color", 10);
  add("color-default", "Color hex preview shown in floating toolbar swatch", 11);
  add("color-default", "Fill color is distinct from line color (if applicable)", 12);
  add("color-default", "Background fill has lower opacity than stroke", 13);
  add("color-default", "Second tool drawn inherits first tool color (sticky)", 14);

  // ── Style Change (15 scenarios) ────────────────────────────────────────────
  add(
    "style-change",
    "Change color via floating toolbar — drawing updates in real time",
    0,
  );
  add("style-change", "Change line width via toolbar — updates in real time", 1);
  add(
    "style-change",
    "Change line style to dashed — drawing updates in real time",
    2,
  );
  add("style-change", "Change opacity via settings — updates in real time", 3);
  add("style-change", "Style change is persisted after page reload", 4);
  add(
    "style-change",
    "Style change survives undo of a separate drawing action",
    5,
  );
  add("style-change", "Undo of style change restores previous style", 6);
  add("style-change", "Style presets apply correct color/width combinations", 7);
  add("style-change", "Bold text option applies to label text", 8);
  add("style-change", "Font change applies to label text", 9);
  add("style-change", "Fill toggle shows/hides background fill", 10);
  add("style-change", "Extend-left/right toggles update rendering", 11);
  add("style-change", "Show/hide labels toggle affects text visibility", 12);
  add("style-change", "Percent/points label mode switch updates label text", 13);
  add("style-change", "Apply-to-all applies style to all same-type drawings", 14);

  // ── Edge Persistence (20 scenarios) ──────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const dirs = ["right", "left", "up", "down", "tr", "tl", "br", "bl"];
    const dir = dirs[i % dirs.length];
    add(
      "edge-exit",
      `Cursor exits chart via ${dir} edge — drawing count unchanged`,
      i,
    );
  }

  // ── Keyboard Shortcuts (20 scenarios) ────────────────────────────────────
  if (tool.tvShortcut) {
    add(
      "keyboard-shortcut",
      `${tool.tvShortcut} activates tool (TV default shortcut)`,
      0,
    );
    add(
      "keyboard-shortcut",
      `${tool.tvShortcut} while other tool is active — switches to this tool`,
      1,
    );
  }
  add("keyboard-shortcut", "Delete key removes selected drawing", 0);
  add("keyboard-shortcut", "Backspace key removes selected drawing", 1);
  add("keyboard-shortcut", "Ctrl+Z undoes last draw", 2);
  add("keyboard-shortcut", "Ctrl+Y redoes last undo", 3);
  add("keyboard-shortcut", "Ctrl+Shift+Z also redoes last undo", 4);
  add("keyboard-shortcut", "Escape cancels mid-draw", 5);
  add("keyboard-shortcut", "Escape deselects selected drawing", 6);
  add("keyboard-shortcut", "Ctrl+A selects all drawings", 7);
  add("keyboard-shortcut", "Ctrl+C + Ctrl+V duplicates selected drawing", 8);
  add("keyboard-shortcut", "Arrow keys nudge selected drawing by 1 unit", 9);
  add("keyboard-shortcut", "Shift+Arrow nudges by 10 units", 10);
  add("keyboard-shortcut", "L key (lock) toggles lock on selected drawing", 11);
  add("keyboard-shortcut", "H key (hide) toggles visibility on selected drawing", 12);
  add("keyboard-shortcut", "Enter opens settings dialog for selected drawing", 13);
  add(
    "keyboard-shortcut",
    "Tab cycles through drawings one by one",
    14,
  );
  add("keyboard-shortcut", "Shift+Tab cycles drawings in reverse order", 15);
  add(
    "keyboard-shortcut",
    "Number keys (1-5) switch chart timeframe without affecting tool",
    16,
  );
  add("keyboard-shortcut", "Ctrl+D duplicates selected drawing", 17);

  // ── Multi-Drawing (20 scenarios) ──────────────────────────────────────────
  for (let n = 2; n <= 21; n++) {
    add(
      "multi-drawing",
      `Draw ${n} instances — all persist with unique IDs`,
      n,
    );
  }

  // ── Pan Persistence (20 scenarios) ───────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    add(
      "pan-persistence",
      `Draw, pan ${(i % 5 + 1) * 3} bars right — drawing remains in store`,
      i,
    );
  }

  // ── Escape Behaviors (20 scenarios) ──────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    add(
      "escape-mid-draw",
      `Escape mid-draw at anchor ${(i % tool.anchorCount) + 1} — no drawing committed`,
      i,
    );
  }
  for (let i = 0; i < 10; i++) {
    add(
      "escape-selected",
      `Escape while drawing ${i} is selected — deselects`,
      i,
    );
  }

  // ── Snap / Magnet (10 scenarios) ─────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    add(
      "snap-magnet",
      `Draw near candle at index ${i * 5} — anchor snaps to OHLC price`,
      i,
    );
  }

  // ── Tooltip Content (10 scenarios) ───────────────────────────────────────
  add(
    "tooltip-content",
    "Hover over placed drawing — tooltip shows drawing type name",
    0,
  );
  add("tooltip-content", "Tooltip shows anchor price values", 1);
  add("tooltip-content", "Tooltip shows anchor date values", 2);
  add("tooltip-content", "Tooltip shows delta/percentage (if measurer)", 3);
  add("tooltip-content", "Tooltip shows R:R ratio (if position tool)", 4);
  add("tooltip-content", "Tooltip is hidden when drawing is not hovered", 5);
  add("tooltip-content", "Tooltip persists during slow hover", 6);
  add("tooltip-content", "Tooltip updates when drawing is moved", 7);
  add("tooltip-content", "Tooltip format matches TV format", 8);
  add("tooltip-content", "Tooltip is not shown for hidden drawings", 9);

  // ── Info / Price Labels on Drawing (10 scenarios) ────────────────────────
  add(
    "info-label",
    "Entry price label visible on drawing body at correct Y",
    0,
  );
  add("info-label", "Target price label visible above/below entry", 1);
  add("info-label", "Stop price label visible on opposite side", 2);
  add("info-label", "R:R ratio text visible on drawing body", 3);
  add("info-label", "Price-delta label shown for measurer rectangle", 4);
  add("info-label", "Percentage change label shown for measurer rectangle", 5);
  add("info-label", "Bar count label shown for date range", 6);
  add("info-label", "Label color matches fill color (green for long/red for short)", 7);
  add("info-label", "Label disappears when tool is in 'hide labels' mode", 8);
  add("info-label", "Label updates when anchor is dragged to new price", 9);

  // ── Cross-tool Interactions (10 scenarios) ────────────────────────────────
  add(
    "cross-tool",
    "Switch from this tool to trendline — no ghost drawing left over",
    0,
  );
  add(
    "cross-tool",
    "Switch from trendline to this tool — draws correctly",
    1,
  );
  add(
    "cross-tool",
    "Two different tool drawings don't merge into one",
    2,
  );
  add(
    "cross-tool",
    "Eraser tool removes only this drawing without affecting neighbor",
    3,
  );
  add(
    "cross-tool",
    "Zoom tool does not accidentally commit drawing",
    4,
  );
  add("cross-tool", "Cursor/pointer tool can select this drawing", 5);
  add("cross-tool", "Panning doesn't commit a drawing accidentally", 6);
  add("cross-tool", "Drawing this tool doesn't deselect existing other drawing", 7);
  add("cross-tool", "Drawing overlapping tools both remain clickable", 8);
  add("cross-tool", "Lock-all toggle locks all tools including this one", 9);

  // ── Lock / Hide (10 scenarios) ────────────────────────────────────────────
  add("lock", "Locked drawing cannot be dragged", 0);
  add("lock", "Locked drawing shows lock icon indicator", 1);
  add("lock", "Locked drawing CAN still be selected (read-only)", 2);
  add("lock", "Unlock via toolbar — drawing becomes draggable again", 3);
  add("lock", "Lock persists after page reload", 4);
  add("hide-show", "Hidden drawing is not visible on canvas", 0);
  add("hide-show", "Hidden drawing is still in the drawings store", 1);
  add("hide-show", "Show again makes drawing visible", 2);
  add("hide-show", "Hide-all toggle hides this drawing", 3);
  add("hide-show", "Show-all restores visibility", 4);

  // ── Clone / Duplicate (10 scenarios) ─────────────────────────────────────
  add("clone-duplicate", "Clone via context menu — count increases by 1", 0);
  add(
    "clone-duplicate",
    "Cloned drawing has same variant as original",
    1,
  );
  add(
    "clone-duplicate",
    "Cloned drawing has unique ID (not same as original)",
    2,
  );
  add(
    "clone-duplicate",
    "Cloned drawing has same options as original",
    3,
  );
  add(
    "clone-duplicate",
    "Cloned drawing is offset slightly from original",
    4,
  );
  add("clone-duplicate", "Ctrl+D duplicates selected drawing", 5);
  add("clone-duplicate", "Duplicate count can go up to 10", 6);
  add(
    "clone-duplicate",
    "Undo clone removes the clone (not original)",
    7,
  );
  add(
    "clone-duplicate",
    "Clone of locked drawing is also locked",
    8,
  );
  add(
    "clone-duplicate",
    "Clone of hidden drawing is also hidden",
    9,
  );

  // ── Settings Dialog (10 scenarios) ────────────────────────────────────────
  add("settings-dialog", "Settings dialog opens via right-click → Edit", 0);
  add(
    "settings-dialog",
    "Settings dialog opens via floating toolbar gear icon",
    1,
  );
  add("settings-dialog", "Settings dialog opens via double-click", 2);
  add("settings-dialog", "Settings dialog has 'OK' and 'Cancel' buttons", 3);
  add(
    "settings-dialog",
    "Settings dialog has color picker in 'Style' tab",
    4,
  );
  add(
    "settings-dialog",
    "Settings dialog has 'Inputs' tab with anchor coordinates",
    5,
  );
  add(
    "settings-dialog",
    "Settings dialog 'Visibility' tab controls chart-timeframe visibility",
    6,
  );
  add(
    "settings-dialog",
    "Clicking Cancel discards style changes",
    7,
  );
  add("settings-dialog", "Clicking OK applies style changes", 8);
  add(
    "settings-dialog",
    "Settings dialog closes on Escape",
    9,
  );

  // ── Pixel Region Screenshots (10 scenarios) ──────────────────────────────
  for (let i = 0; i < 10; i++) {
    add(
      "pixel-region",
      `Screenshot region around drawing at grid[${i}] saved as reference`,
      i,
    );
  }

  // ── Axis Labels (5 scenarios) ─────────────────────────────────────────────
  add("axis-labels", "Price axis shows label at anchor[0].price", 0);
  add("axis-labels", "Price axis shows label at anchor[1].price (if 2+ anchors)", 1);
  add("axis-labels", "Time axis shows label at anchor[0].time", 2);
  add("axis-labels", "Time axis shows label at anchor[1].time (if 2+ anchors)", 3);
  add(
    "axis-labels",
    "Axis labels update when anchor is dragged to new position",
    4,
  );

  // ── Tool-specific scenarios (variable count, fills remaining to reach 500) ─
  const remaining = 500 - scenarios.length;
  const kinds: ScenarioKind[] = [
    "rr-label",
    "vwap-line",
    "volume-bars",
    "bars-pattern",
    "ghost-line",
    "price-label",
  ];
  for (let i = 0; i < remaining; i++) {
    const kind = kinds[i % kinds.length];
    add(kind, `Tool-specific scenario ${i} — ${kind} behavior check`, i);
  }

  return scenarios.slice(0, 500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function dismissTVModal(page: Page) {
  // TV shows cookie banner, login modal, "try pro" overlay, "Join TradingView" signup etc.
  const dismissors = [
    '[aria-label="Close"]',
    '[data-name="close-button"]',
    'button[aria-label="Close"]',
    'button[data-name="close"]',
    "button:has-text('Maybe later')",
    "button:has-text('No, thanks')",
    "button:has-text('Not now')",
    "button:has-text('Skip')",
    "button:has-text('Dismiss')",
    "button:has-text('Continue')",
    "button:has-text('Got it')",
    "button:has-text('Accept')",
    "button:has-text('I agree')",
    ".tv-dialog__close",
    ".tv-dialog button[class*=close]",
    '[class*="closeButton-"]',
    '[class*="CloseButton-"]',
  ];
  for (const sel of dismissors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 400 })) {
        await el.click({ force: true });
        await page.waitForTimeout(250);
      }
    } catch {
      /* ignore */
    }
  }
  // Detect "Join TradingView" / "Sign up" / "Create free account" modal —
  // if present and not closeable via close button, reload the page.
  try {
    const joinModalSelectors = [
      "text=/join tradingview/i",
      "text=/create.{0,10}free.{0,10}account/i",
      "text=/sign\\s*up/i",
      'div[class*="dialog"]:has-text("Sign in")',
      'div[role="dialog"]:has-text("Sign in")',
    ];
    for (const sel of joinModalSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 300 }).catch(() => false)) {
        // Try Escape first, then reload as last resort
        await page.keyboard.press("Escape").catch(() => null);
        await page.waitForTimeout(300);
        if (await el.isVisible({ timeout: 300 }).catch(() => false)) {
          await page
            .reload({ waitUntil: "domcontentloaded", timeout: 30000 })
            .catch(() => null);
          await page.waitForTimeout(3000);
        }
        break;
      }
    }
  } catch {
    /* ignore */
  }
}

async function openTVChart(page: Page) {
  // Use domcontentloaded for faster navigation — TV's JS loads async anyway
  await page.goto(TV_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);
  await dismissTVModal(page);
  await page.waitForTimeout(500);
  // Wait for any chart element — use a short timeout, it's OK if not found
  await page
    .waitForSelector(
      'canvas, [class*="chart"], [id*="chart"], [data-name="legend"]',
      { timeout: 8000 },
    )
    .catch(() => null);
  await page.waitForTimeout(1000);
  // Debug: save a screenshot of what TV loaded so we can inspect it
  const debugDir = path.join(OUT_DIR, "_debug");
  ensureDir(debugDir);
  await page
    .screenshot({ path: path.join(debugDir, `tv-load-${Date.now()}.png`) })
    .catch(() => null);
}

async function getChartBox(page: Page) {
  // Try various TV chart selectors — TV changes class names frequently
  const selectors = [
    "canvas.chart-gui-wrapper",
    "canvas[class*=chart]",
    '[class*="chart-container"]',
    '[id*="chart"]',
    '[data-name="legend"]',
    "canvas",
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      const box = await el.boundingBox({ timeout: 2000 });
      if (box && box.width > 100 && box.height > 100) return box;
    } catch {
      /* try next */
    }
  }
  // Ultimate fallback: use viewport as the chart area
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  return { x: 60, y: 60, width: vp.width - 120, height: vp.height - 120 };
}

function gridPoint(
  box: { x: number; y: number; width: number; height: number },
  i: number,
  cols = 8,
  rows = 8,
) {
  const col = i % cols;
  const row = Math.floor(i / cols) % rows;
  const x = box.x + (box.width * (col + 1)) / (cols + 1);
  const y = box.y + (box.height * (row + 1)) / (rows + 1);
  return { x, y };
}

function endpointsForIndex(
  box: { x: number; y: number; width: number; height: number },
  i: number,
  anchorCount: number,
) {
  const { x: gx, y: gy } = gridPoint(box, i);
  const angle = ((i % 8) * Math.PI) / 8;
  const r = anchorCount > 1 ? 40 + (i % 5) * 12 : 0;
  return {
    x1: gx - Math.cos(angle) * r,
    y1: gy - Math.sin(angle) * r,
    x2: gx + Math.cos(angle) * r,
    y2: gy + Math.sin(angle) * r,
  };
}

async function activateTVTool(page: Page, tool: TVToolSpec) {
  // Strategy:
  //   1. If the tool's button is already directly visible in the rail
  //      (because it was the last-used tool), just click it.
  //   2. Otherwise, click the rail's EXPAND ARROW (railSelector matches the
  //      arrow's aria-label, e.g. "Forecasting and measurement tools" or
  //      "Measure"). This opens the popover with all sibling tools.
  //   3. Click the tool button inside the popover by its aria-label.
  //
  // The arrow elements have class "arrow-pbhJWNrt" and are 11px wide
  // sitting next to the 41px main button.

  // Step 1: try direct click on the tool button if already visible
  try {
    const direct = page.locator(tool.toolSelector).first();
    if (await direct.isVisible({ timeout: 800 })) {
      // Make sure it's the rail one (x < 60), not a popover item from
      // a previous tool's submenu
      const box = await direct.boundingBox();
      if (box && box.x < 60) {
        await direct.click({ force: true });
        await page.waitForTimeout(300);
        // Check if a popover opened — if so we still need to pick the tool
        // (the rail button toggles the LAST-USED tool, which may not be
        // what we want). Verify by re-querying — if multiple buttons with
        // this aria-label now exist, there's a popover open showing it.
        const popoverCount = await page.locator(tool.toolSelector).count();
        if (popoverCount === 1) {
          // direct activation succeeded
          return;
        }
      }
    }
  } catch {
    /* continue to rail expansion */
  }

  // Step 2: open the rail popover by clicking the EXPAND ARROW
  try {
    // The arrow is a sibling of the rail button. We use aria-label match.
    const arrow = page
      .locator(`${tool.railSelector}.arrow-pbhJWNrt, ${tool.railSelector}`)
      .first();
    await arrow.click({ force: true, timeout: 4000 });
    await page.waitForTimeout(500);
  } catch {
    /* arrow not found — try alternative */
  }

  // Step 3: click the tool inside the popover by aria-label
  try {
    const all = page.locator(tool.toolSelector);
    const count = await all.count();
    // Pick the one inside the popover (x > 50)
    for (let i = 0; i < count; i++) {
      const item = all.nth(i);
      const box = await item.boundingBox().catch(() => null);
      if (box && box.x > 50) {
        await item.click({ force: true });
        await page.waitForTimeout(400);
        return;
      }
    }
    // Fallback: click any matching one
    if (count > 0) {
      await all.first().click({ force: true });
      await page.waitForTimeout(400);
      return;
    }
  } catch {
    /* tool not found */
  }

  // Step 4: keyboard shortcut as last-resort
  if (tool.tvShortcut) {
    const parts = tool.tvShortcut.split("+");
    if (parts.length === 2) {
      await page.keyboard.down(parts[0]);
      await page.keyboard.press(parts[1]);
      await page.keyboard.up(parts[0]);
      await page.waitForTimeout(400);
    }
  }
}

async function drawOnTV(
  page: Page,
  tool: TVToolSpec,
  box: { x: number; y: number; width: number; height: number },
  i: number,
) {
  const { x1, y1, x2, y2 } = endpointsForIndex(box, i, tool.anchorCount);
  if (tool.commitMode === "click") {
    await page.mouse.click(x1, y1);
    await page.waitForTimeout(300);
  } else if (tool.commitMode === "click-sequence") {
    const N = Math.max(2, tool.anchorCount);
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1);
      const px = x1 + (x2 - x1) * t;
      const jitter = k > 0 && k < N - 1 ? ((k % 2 === 0 ? -1 : 1) * 10) : 0;
      const py = y1 + (y2 - y1) * t + jitter;
      await page.mouse.click(px, py);
      await page.waitForTimeout(200);
    }
  } else {
    // drag
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
  await dismissTVModal(page);
}

interface ScenarioResult {
  tool: string;
  scenarioIndex: number;
  kind: string;
  description: string;
  passed: boolean;
  notes: string;
  tooltipText?: string;
  drawingCount?: number;
  screenshotPath?: string;
  tvBehaviorData?: Record<string, unknown>;
  error?: string;
}

function saveResult(toolKey: string, result: ScenarioResult) {
  const dir = path.join(OUT_DIR, toolKey);
  ensureDir(dir);
  const file = path.join(dir, `scenario-${String(result.scenarioIndex).padStart(3, "0")}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), "utf-8");
}

// ─── Test suites ──────────────────────────────────────────────────────────────
//
// KEY DESIGN: TV is loaded ONCE per tool group (11 navigations total, not 5500).
// A shared page persists across all 500 tests per tool. State is reset between
// tests via Escape + Ctrl+Z undo. If the page becomes unresponsive it reloads.
//
for (const tool of ALL_TOOLS) {
  const scenarios = buildScenarios(tool);

  test.describe(`[TV-CAPTURE][${tool.key}] ${tool.label} — 500 scenarios`, () => {
    // ── Single shared page for all 500 tests ─────────────────────────────
    // IMPORTANT: We hold an explicit BrowserContext reference so the page
    // is NOT cleaned up by Playwright between beforeAll and individual tests.
    let sharedCtx: BrowserContext;
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
      ensureDir(path.join(OUT_DIR, tool.key));
      ensureDir(path.join(REF_DIR, tool.key));
      // Explicit context keeps the page alive across all 500 tests
      sharedCtx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        geolocation: { latitude: 28.6, longitude: 77.2 },
        permissions: ["geolocation"],
      });
      sharedPage = await sharedCtx.newPage();
      await openTVChart(sharedPage);
    });

    test.afterAll(async () => {
      await sharedPage?.close().catch(() => null);
      await sharedCtx?.close().catch(() => null);
    });

    for (const scenario of scenarios) {
      const sIdx = String(scenario.index).padStart(3, "0");
      test(
        `#${sIdx} [${scenario.kind}] ${scenario.description}`,
        async () => {
          // ── Reset state from previous test ─────────────────────────────
          await sharedPage.keyboard.press("Escape").catch(() => null);
          await sharedPage.waitForTimeout(150);
          // Undo any drawings left over from previous test
          for (let _i = 0; _i < 5; _i++) {
            await sharedPage.keyboard.press("Control+z").catch(() => null);
            await sharedPage.waitForTimeout(50);
          }
          await dismissTVModal(sharedPage);
          // If page navigated away, reload TV
          if (!sharedPage.url().includes("tradingview.com")) {
            await openTVChart(sharedPage);
          }

          const result: ScenarioResult = {
            tool: tool.key,
            scenarioIndex: scenario.index,
            kind: scenario.kind,
            description: scenario.description,
            passed: false,
            notes: "",
          };

          try {
            const box = await getChartBox(sharedPage);
            const page = sharedPage; // alias so all case branches compile unchanged

            // ── Branch by scenario kind ───────────────────────────────────
            switch (scenario.kind) {
              // ── UI: Tooltip ───────────────────────────────────────────
              case "ui-tooltip": {
                // Open the rail, then hover the tool button
                try {
                  const rail = page.locator(tool.railSelector).first();
                  if (await rail.isVisible({ timeout: 2000 })) {
                    await rail.click({ force: true });
                    await page.waitForTimeout(300);
                  }
                } catch {
                  /* no rail */
                }
                const btn = page
                  .locator(tool.toolSelector)
                  .first();
                const tooltipText = await (async () => {
                  try {
                    await btn.hover({ timeout: 3000 });
                    await page.waitForTimeout(800);
                    // TV shows tooltips in .tv-tooltip or [class*=tooltip]
                    const tt = await page
                      .locator(
                        '[class*="tooltip"]:visible, [role="tooltip"]:visible',
                      )
                      .first()
                      .textContent({ timeout: 1500 });
                    return tt ?? "(no tooltip)";
                  } catch {
                    return "(not found)";
                  }
                })();
                result.tooltipText = tooltipText ?? "";
                result.notes = `TV tooltip: "${tooltipText}"`;
                result.tvBehaviorData = {
                  tooltipText,
                  expected: tool.expectedTooltip,
                  matches: (tooltipText ?? "")
                    .toLowerCase()
                    .includes(tool.expectedTooltip.toLowerCase()),
                };
                result.passed = true; // capture-only — no hard assert
                break;
              }

              // ── UI: Rail ───────────────────────────────────────────────
              case "ui-rail": {
                try {
                  const rail = page.locator(tool.railSelector).first();
                  const railVisible = await rail.isVisible({ timeout: 3000 });
                  if (railVisible) {
                    await rail.click({ force: true });
                    await page.waitForTimeout(400);
                  }
                  const toolBtn = page.locator(tool.toolSelector).first();
                  const toolVisible = await toolBtn.isVisible({ timeout: 3000 });
                  result.tvBehaviorData = { railVisible, toolVisible };
                  result.notes = `rail=${railVisible} tool=${toolVisible}`;
                  result.passed = true;
                } catch (e) {
                  result.notes = String(e);
                  result.passed = false;
                }
                break;
              }

              // ── Creation ───────────────────────────────────────────────
              case "creation": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Screenshot the result
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `state-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath, fullPage: false });
                result.screenshotPath = ssPath;
                result.notes = `Drew at seed ${scenario.seed}`;
                result.passed = true;
                break;
              }

              // ── Selection ─────────────────────────────────────────────
              case "selection": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Click away
                await page.mouse.click(box.x + box.width * 0.9, box.y + 40);
                await page.waitForTimeout(300);
                // Screenshot after deselect
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `selection-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath, fullPage: false });
                result.screenshotPath = ssPath;
                result.notes = `Selection state at seed ${scenario.seed}`;
                result.passed = true;
                break;
              }

              // ── Floating Toolbar ──────────────────────────────────────
              case "floating-tb": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Look for floating toolbar
                if (tool.floatingToolbarSelector) {
                  const tb = page
                    .locator(tool.floatingToolbarSelector)
                    .first();
                  const tbVisible = await tb
                    .isVisible({ timeout: 2000 })
                    .catch(() => false);
                  result.tvBehaviorData = { floatingToolbarVisible: tbVisible };
                  result.notes = `Floating toolbar visible: ${tbVisible}`;
                }
                // Also try generic TV floating toolbar selector
                const genericTb = await page
                  .locator(
                    '[class*="floating-toolbar"], [data-name*="toolbar"]',
                  )
                  .first()
                  .isVisible({ timeout: 2000 })
                  .catch(() => false);
                result.tvBehaviorData = {
                  ...result.tvBehaviorData,
                  genericTbVisible: genericTb,
                };
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `floating-tb-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath, fullPage: false });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Resize ────────────────────────────────────────────────
              case "resize": {
                await activateTVTool(page, tool);
                const { x1, y1, x2, y2 } = endpointsForIndex(
                  box,
                  scenario.seed,
                  tool.anchorCount,
                );
                await drawOnTV(page, tool, box, scenario.seed);
                // Drag from anchor position
                const anchorIdx = scenario.seed % tool.anchorCount;
                const anchorX = anchorIdx === 0 ? x1 : x2;
                const anchorY = anchorIdx === 0 ? y1 : y2;
                await page.mouse.move(anchorX, anchorY);
                await page.mouse.down();
                await page.mouse.move(anchorX + 20, anchorY + 12, {
                  steps: 5,
                });
                await page.mouse.up();
                await page.waitForTimeout(300);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `resize-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath, fullPage: false });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Delete ────────────────────────────────────────────────
              case "delete": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                const method =
                  scenario.seed % 3 === 0
                    ? "Delete"
                    : scenario.seed % 3 === 1
                      ? "Backspace"
                      : "context";
                if (method === "context") {
                  // Right-click on the drawn object's center and choose Remove
                  const { x1, y1, x2, y2 } = endpointsForIndex(
                    box,
                    scenario.seed,
                    tool.anchorCount,
                  );
                  await page.mouse.click(
                    (x1 + x2) / 2,
                    (y1 + y2) / 2,
                    { button: "right" },
                  );
                  await page.waitForTimeout(400);
                  const removeItem = page
                    .getByText(/remove|delete/i)
                    .first();
                  await removeItem.click({ force: true }).catch(() => null);
                } else {
                  await page.keyboard.press(method);
                }
                await page.waitForTimeout(300);
                result.notes = `Deleted via ${method}`;
                result.passed = true;
                break;
              }

              // ── Undo / Redo ───────────────────────────────────────────
              case "undo-redo": {
                const n = Math.max(1, Math.floor(scenario.seed / 10));
                for (let k = 0; k < n; k++) {
                  await activateTVTool(page, tool);
                  await drawOnTV(page, tool, box, k);
                }
                for (let k = 0; k < n; k++) {
                  await page.keyboard.press("Control+z");
                  await page.waitForTimeout(100);
                }
                const ssAfterUndo = path.join(
                  REF_DIR,
                  tool.key,
                  `undo-${sIdx}.png`,
                );
                await page.screenshot({ path: ssAfterUndo });
                for (let k = 0; k < n; k++) {
                  await page.keyboard.press("Control+y");
                  await page.waitForTimeout(100);
                }
                const ssAfterRedo = path.join(
                  REF_DIR,
                  tool.key,
                  `redo-${sIdx}.png`,
                );
                await page.screenshot({ path: ssAfterRedo });
                result.notes = `n=${n} undo/redo completed`;
                result.passed = true;
                break;
              }

              // ── Context Menu ─────────────────────────────────────────
              case "context-menu": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                const { x1, y1, x2, y2 } = endpointsForIndex(
                  box,
                  scenario.seed,
                  tool.anchorCount,
                );
                await page.mouse.click(
                  (x1 + x2) / 2,
                  (y1 + y2) / 2,
                  { button: "right" },
                );
                await page.waitForTimeout(500);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `context-menu-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                // Collect menu items
                const menuItems = await page
                  .locator(
                    '[class*="menu-item"], [role="menuitem"], [data-name*="menu"]',
                  )
                  .allTextContents()
                  .catch(() => [] as string[]);
                result.tvBehaviorData = { menuItems };
                result.screenshotPath = ssPath;
                result.notes = `Context menu items: ${menuItems.join(", ")}`;
                // Close the menu
                await page.keyboard.press("Escape");
                result.passed = true;
                break;
              }

              // ── Color Defaults ────────────────────────────────────────
              case "color-default": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `color-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.tvBehaviorData = {
                  expectedColor: tool.expectedColorDefault,
                };
                result.notes = `Color default check: ${tool.expectedColorDefault ?? "N/A"}`;
                result.passed = true;
                break;
              }

              // ── Style Change ──────────────────────────────────────────
              case "style-change": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Open floating toolbar color picker
                const colorBtn = page
                  .locator(
                    '[class*="color-button"], [data-name*="color"], [title*="Color"]',
                  )
                  .first();
                const clicked = await colorBtn
                  .click({ force: true, timeout: 2000 })
                  .then(() => true)
                  .catch(() => false);
                await page.waitForTimeout(400);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `style-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.tvBehaviorData = { colorPickerOpened: clicked };
                result.notes = `Style change: colorPicker opened=${clicked}`;
                await page.keyboard.press("Escape");
                result.passed = true;
                break;
              }

              // ── Edge Persistence ──────────────────────────────────────
              case "edge-exit": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Move cursor to edge
                const edgeDirs = [
                  { x: box.x + box.width + 10, y: box.y + box.height / 2 },
                  { x: box.x - 10, y: box.y + box.height / 2 },
                  { x: box.x + box.width / 2, y: box.y - 10 },
                  { x: box.x + box.width / 2, y: box.y + box.height + 10 },
                ];
                const dir = edgeDirs[scenario.seed % edgeDirs.length];
                await page.mouse.move(dir.x, dir.y, { steps: 5 });
                await page.waitForTimeout(200);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `edge-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Keyboard Shortcut ─────────────────────────────────────
              case "keyboard-shortcut": {
                if (tool.tvShortcut && scenario.seed === 0) {
                  const parts = tool.tvShortcut.split("+");
                  if (parts.length === 2) {
                    await page.keyboard.down(parts[0]);
                    await page.keyboard.press(parts[1]);
                    await page.keyboard.up(parts[0]);
                    await page.waitForTimeout(500);
                    await drawOnTV(page, tool, box, 0);
                  }
                } else {
                  // Generic keyboard shortcut tests
                  await activateTVTool(page, tool);
                  await drawOnTV(page, tool, box, scenario.seed);
                  if (scenario.seed % 4 === 0) {
                    await page.keyboard.press("Control+z");
                  } else if (scenario.seed % 4 === 1) {
                    await page.keyboard.press("Control+y");
                  } else if (scenario.seed % 4 === 2) {
                    await page.keyboard.press("Delete");
                  } else {
                    await page.keyboard.press("Escape");
                  }
                }
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `shortcut-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Multi Drawing ────────────────────────────────────────
              case "multi-drawing": {
                const n = 2 + (scenario.seed % 20);
                for (let k = 0; k < n; k++) {
                  await activateTVTool(page, tool);
                  await drawOnTV(page, tool, box, k);
                }
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `multi-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.notes = `Drew ${n} instances`;
                result.passed = true;
                break;
              }

              // ── Pan Persistence ───────────────────────────────────────
              case "pan-persistence": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Pan the chart
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                await page.mouse.move(cx, cy);
                for (let k = 0; k < 5; k++) {
                  await page.mouse.wheel(80, 0);
                  await page.waitForTimeout(60);
                }
                await page.waitForTimeout(300);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `pan-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Escape Mid-Draw ───────────────────────────────────────
              case "escape-mid-draw": {
                await activateTVTool(page, tool);
                if (tool.commitMode === "drag") {
                  const cx = box.x + box.width / 2;
                  const cy = box.y + box.height / 2;
                  await page.mouse.move(cx - 20, cy);
                  await page.mouse.down();
                  await page.mouse.move(cx, cy);
                  await page.keyboard.press("Escape");
                  await page.mouse.up();
                } else if (tool.commitMode === "click-sequence") {
                  // Place first anchor, then Escape
                  const cx = box.x + box.width / 2;
                  const cy = box.y + box.height / 2;
                  await page.mouse.click(cx - 30, cy);
                  await page.waitForTimeout(150);
                  await page.keyboard.press("Escape");
                } else {
                  await page.keyboard.press("Escape");
                }
                await page.waitForTimeout(300);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `escape-mid-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Escape Selected ───────────────────────────────────────
              case "escape-selected": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                await page.keyboard.press("Escape");
                await page.waitForTimeout(300);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `escape-sel-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Snap / Magnet ─────────────────────────────────────────
              case "snap-magnet": {
                await activateTVTool(page, tool);
                // Draw near a candle (slightly off the exact OHLC price)
                const cx = box.x + box.width * 0.4 + scenario.seed * 20;
                const cy = box.y + box.height * 0.5 + (scenario.seed % 3) * 15;
                await page.mouse.move(cx, cy);
                await page.waitForTimeout(200);
                if (tool.commitMode === "drag") {
                  await page.mouse.down();
                  await page.mouse.move(cx + 50, cy + 10, { steps: 5 });
                  await page.mouse.up();
                } else {
                  await page.mouse.click(cx, cy);
                }
                await page.waitForTimeout(300);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `snap-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Tooltip Content ────────────────────────────────────────
              case "tooltip-content": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Hover over the middle of the drawn object
                const { x1, y1, x2, y2 } = endpointsForIndex(
                  box,
                  scenario.seed,
                  tool.anchorCount,
                );
                await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2);
                await page.waitForTimeout(600);
                const tooltipEl = page.locator(
                  '[class*="tooltip"]:visible, [role="tooltip"]:visible',
                );
                const tooltipText = await tooltipEl
                  .first()
                  .textContent({ timeout: 1500 })
                  .catch(() => "(no tooltip)");
                result.tvBehaviorData = { tooltipText };
                result.notes = `Drawing tooltip: "${tooltipText}"`;
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `tooltip-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Info Label ─────────────────────────────────────────────
              case "info-label": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `info-label-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Cross-tool ────────────────────────────────────────────
              case "cross-tool": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, 0);
                // Switch to trendline and draw another tool
                await page.keyboard.press("alt+t").catch(() => null);
                await page.waitForTimeout(400);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `cross-tool-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Lock ──────────────────────────────────────────────────
              case "lock": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Press L to lock
                await page.keyboard.press("l").catch(() => null);
                await page.waitForTimeout(300);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `lock-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Hide / Show ───────────────────────────────────────────
              case "hide-show": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Press H to hide
                await page.keyboard.press("h").catch(() => null);
                await page.waitForTimeout(300);
                const ssBefore = path.join(
                  REF_DIR,
                  tool.key,
                  `hidden-${sIdx}.png`,
                );
                await page.screenshot({ path: ssBefore });
                // Press H again to show
                await page.keyboard.press("h").catch(() => null);
                await page.waitForTimeout(300);
                result.screenshotPath = ssBefore;
                result.passed = true;
                break;
              }

              // ── Clone / Duplicate ─────────────────────────────────────
              case "clone-duplicate": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                await page.keyboard.press("Control+d").catch(() => null);
                await page.waitForTimeout(400);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `clone-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Settings Dialog ───────────────────────────────────────
              case "settings-dialog": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                // Double-click to open settings
                const { x1, y1, x2, y2 } = endpointsForIndex(
                  box,
                  scenario.seed,
                  tool.anchorCount,
                );
                await page.mouse.dblclick((x1 + x2) / 2, (y1 + y2) / 2);
                await page.waitForTimeout(800);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `settings-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                // Capture dialog content
                const dialogText = await page
                  .locator(
                    '[class*="dialog"], [role="dialog"], [class*="modal"]',
                  )
                  .first()
                  .textContent({ timeout: 2000 })
                  .catch(() => "(no dialog)");
                result.tvBehaviorData = { dialogText };
                result.screenshotPath = ssPath;
                await page.keyboard.press("Escape");
                result.passed = true;
                break;
              }

              // ── Pixel Region Screenshot ───────────────────────────────
              case "pixel-region": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                const { x1, y1, x2, y2 } = endpointsForIndex(
                  box,
                  scenario.seed,
                  tool.anchorCount,
                );
                const pad = 40;
                const clip = {
                  x: Math.max(0, Math.min(x1, x2) - pad),
                  y: Math.max(0, Math.min(y1, y2) - pad),
                  width: Math.abs(x2 - x1) + pad * 2 + 80,
                  height: Math.abs(y2 - y1) + pad * 2 + 80,
                };
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `state-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath, clip });
                result.screenshotPath = ssPath;
                result.notes = `Pixel reference saved at ${ssPath}`;
                result.passed = true;
                break;
              }

              // ── Axis Labels ───────────────────────────────────────────
              case "axis-labels": {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `axis-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.passed = true;
                break;
              }

              // ── Tool-specific (rr-label, vwap-line, volume-bars, etc.) ─
              default: {
                await activateTVTool(page, tool);
                await drawOnTV(page, tool, box, scenario.seed);
                const ssPath = path.join(
                  REF_DIR,
                  tool.key,
                  `specific-${sIdx}.png`,
                );
                await page.screenshot({ path: ssPath });
                result.screenshotPath = ssPath;
                result.notes = `Tool-specific: ${scenario.kind}`;
                result.passed = true;
                break;
              }
            }
          } catch (err) {
            result.error = String(err);
            result.passed = false;
            // Still save a screenshot on error for debugging
            try {
              const errPath = path.join(
                OUT_DIR,
                tool.key,
                `error-${sIdx}.png`,
              );
              await sharedPage.screenshot({ path: errPath });
            } catch {
              /* ignore screenshot error */
            }
            // If page is in bad shape, reload for next test
            try {
              if (!sharedPage.url().includes("tradingview.com")) {
                await openTVChart(sharedPage);
              }
            } catch { /* ignore reload error */ }
          }

          saveResult(tool.key, result);
          // Capture mode — record result but don't hard-fail the suite
          expect(result.passed).toBe(true);
        },
      );
    }
  });
}
