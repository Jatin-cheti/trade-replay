# Chart UX Bug Repro Notes

## Environment
- Frontend: localhost:8080
- Backend: localhost:4000
- Pages: Simulation and Live Market

## Canvas Inventory
- Main chart canvas: created by the chart engine inside the chart container.
- Overlay canvas: chart drawing/crosshair interaction surface with aria-label chart-drawing-overlay.

## Bug A: Ghosting / Fade / Previous Frame Residue
### Repro steps
1. Open Simulation or Live Market.
2. Move crosshair rapidly and pan/zoom repeatedly.
3. Observe faint remnants of prior frame during motion.

### Suspected root cause
- Main canvas frames were painted with a translucent background and no explicit frame clear.
- Overlay redraw did not always run when the viewport changed from wheel/pan interactions.

## Bug B: Drawing Tools Disappear After Commit
### Repro steps
1. Select trend line tool.
2. Draw a line and release pointer.
3. Pan or zoom chart.
4. The committed drawing may disappear until another draw interaction.

### Suspected root cause
- Drawings were persisted, but overlay redraw was not consistently triggered for viewport transforms.
- Overlay clear/transform handling was not reinforced per frame under DPR changes.

## Bug C: Wheel Zoom Jumps / Inconsistent Behavior
### Repro steps
1. Hover chart center.
2. Use mouse wheel or trackpad repeatedly with varying intensity.
3. Observe abrupt zoom jumps and unstable anchor behavior.

### Suspected root cause
- Wheel zoom used fixed step factors without delta normalization.
- Multiple wheel events in a burst were not coalesced to per-frame updates.
- rightmostIndex could drift without explicit logical clamping.
