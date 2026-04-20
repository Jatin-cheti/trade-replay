# Chart Known Issues

## Resolved
- Zoom anchored at cursor now uses normalized wheel deltas and frame-coalesced updates.
- Overlay persistence and ghosting are fixed by explicit per-frame clearing and DPR resets.
- Selected drawings can be moved as whole objects and canceled with Escape.
- Pane divider dragging now updates pane heights from chart engine state.
- Drawing rows and delete actions now expose stable data-testid hooks for e2e tests.
- Performance benchmarking is now codified with a dev-only route, a Playwright runner, and a 10k regression test.

## UX Polish
- [resolved] Price-axis drag scaling and double-click autoscale reset.
- [resolved] Crosshair price/time labels now have deterministic regression hooks.
- [resolved] Time-scale pin-to-live affordance is available in the chart UI.
- [in progress] Drawing endpoint handles and keyboard shortcuts.
- [in progress] Crisp DPI-aware line rendering on all chart surfaces.

## In Progress
- Screenshot export of chart + drawings is not implemented yet.
- Indicator count is now 101 and the next target is continued expansion plus cleanup.

## Confirmed Gaps
- OHLC legend readout in pane headers is not implemented yet.
- Crosshair magnet behavior is currently focused on drawing interactions; dedicated crosshair magnet modes still need a direct UI control.

## Repro Notes
- For delete regression checks, use object-tree controls keyed by drawing data-testid attributes.
