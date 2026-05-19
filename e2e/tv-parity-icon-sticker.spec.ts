/**
 * TV-Parity Icon Tools — 100 tests for "sticker".
 * Uses IconToolPanel picker flow: rail-icon → icon-panel-tab-stickers → preset → canvas click.
 * Replaces the skipping tv-parity-v2-sticker.spec.ts stub.
 */
import { registerIconToolSuite } from "./tv-parity-icon-factory";

registerIconToolSuite({
  variant: "sticker",
  panelTabTestId: "icon-panel-tab-stickers",
  presetItemTestId: "icon-panel-item-tradingview-tv-pine",
  tabLabel: "stickers",
});
