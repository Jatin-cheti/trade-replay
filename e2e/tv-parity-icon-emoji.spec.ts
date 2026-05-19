/**
 * TV-Parity Icon Tools — 100 tests for "emoji".
 * Uses IconToolPanel picker flow: rail-icon → icon-panel-tab-emojis → preset → canvas click.
 * Replaces the skipping tv-parity-v2-emoji.spec.ts stub.
 */
import { registerIconToolSuite } from "./tv-parity-icon-factory";

registerIconToolSuite({
  variant: "emoji",
  panelTabTestId: "icon-panel-tab-emojis",
  presetItemTestId: "icon-panel-item-smiles-0",
  tabLabel: "emojis",
});
