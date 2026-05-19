/**
 * TV-Parity Icon Tools — 100 tests for "iconTool".
 * Uses IconToolPanel picker flow: rail-icon → icon-panel-tab-icons → preset → canvas click.
 * Replaces the skipping tv-parity-v2-iconTool.spec.ts stub.
 */
import { registerIconToolSuite } from "./tv-parity-icon-factory";

registerIconToolSuite({
  variant: "iconTool",
  panelTabTestId: "icon-panel-tab-icons",
  presetItemTestId: "icon-panel-item-gestures-0",
  tabLabel: "icons",
});
