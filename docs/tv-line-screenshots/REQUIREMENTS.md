# TV-Parity Requirements: Lines / Channels / Pitchforks

Captured automatically via `harshit-repo/scripts/capture-tv-line-tools.mjs`
against https://in.tradingview.com/chart/?symbol=NSE%3ARELIANCE on May 3, 2026.
Visual references live at `harshit-repo/docs/tv-line-screenshots/`.

Each row lists the TradingView tooltip → our `ToolVariant`, the click count
TV requires (verified by clicking and watching the drawing complete), the
TV `data-name` (from `_linetool-items.json`), and the visible features that
must be replicated in our renderer. Wizard step labels are added to
`PATTERN_LABELS_BY_VARIANT` so the cursor pill shows e.g. `Parallel Channel: B (2/3)`.

## Lines subsection

| TV tooltip            | variant         | anchors | data-name                     | TV signature features |
|-----------------------|-----------------|---------|--------------------------------|------------------------|
| Trend Line            | `trend`         | 2       | `linetool-trend-line`          | Solid line A→B; price label at endpoint when `showPrice`; supports text label. |
| Ray                   | `ray`           | 2       | `linetool-ray`                 | Like trend but extends past B to the right edge. |
| Info Line             | `infoLine`      | 2       | `linetool-info-line`           | Trend line with mid-segment pill `<Δprice> (<Δ%>) / <Δbars> bars`. Color from line color. |
| Extended Line         | `extendedLine`  | 2       | `linetool-extended-line`       | Solid line extending in BOTH directions past A and B. |
| Trend Angle           | `trendAngle`    | 2       | `linetool-trend-angle`         | Trend line with a small horizontal reference dash from A; mid-segment label `<degrees>°`. |
| Horizontal Line       | `hline`         | 1       | `linetool-horizontal-line`     | Spans full chart width; price label on right scale; price label on right of line near anchor. |
| Horizontal Ray        | `horizontalRay` | 1       | `linetool-horizontal-ray`      | Horizontal segment from A extending only to the right. |
| Vertical Line         | `vline`         | 1       | `linetool-vertical-line`       | Spans full chart height at A.x; date pill on time axis. |
| Cross Line            | `crossLine`     | 1       | `linetool-cross-line`          | Combined hline + vline through A; price label + date pill. |

## Channels subsection

| TV tooltip            | variant            | anchors | data-name                       | TV signature features |
|-----------------------|--------------------|---------|----------------------------------|------------------------|
| Parallel Channel      | `channel`          | **3**   | `linetool-parallel-channel`     | Click A baseline-start, B baseline-end, C rail-offset. Two parallel solid lines (top and bottom) + dashed median line; semi-transparent fill between rails; rail handles at A, B, midpoints. Wizard labels A/B/C. |
| Regression Trend      | `regressionTrend`  | 2       | `linetool-regression-trend`     | Linear regression line (least-squares fit) over candles between A.x and B.x; ±1σ stddev band as filled rectangle/parallelogram around regression; small numeric label of stddev value at lower-left. |
| Flat Top/Bottom       | `flatTopBottom`    | 2       | `linetool-flat-top-bottom`      | Triangle/wedge: horizontal top from A.x..B.x at A.price OR B.price (whichever is the resistance, TV picks higher), trend line from low anchor to opposite corner, fill triangle. |
| Disjoint Channel      | `disjointChannel`  | **4**   | `linetool-disjoint-channel`     | Two disjoint trend lines (A→B and C→D) forming an X / hourglass with a fill between them. Wizard labels A/B/C/D. |

## Pitchforks subsection

| TV tooltip                  | variant                    | anchors | data-name                                 | TV signature features |
|-----------------------------|----------------------------|---------|--------------------------------------------|------------------------|
| Pitchfork                   | `pitchfork`                | 3       | `linetool-pitchfork`                      | Median line from A through midpoint of B-C; parallel rails through B and C; optional Fib-style additional levels; semi-transparent fills between rails. Wizard A/B/C. |
| Schiff Pitchfork            | `schiffPitchfork`          | 3       | `linetool-schiff-pitchfork`               | Median anchor shifted vertically: starts at midpoint between A and (midpoint of B-C); parallel rails through B and C. |
| Modified Schiff Pitchfork   | `modifiedSchiffPitchfork`  | 3       | `linetool-modified-schiff-pitchfork`      | Median anchor shifted along the A→midpoint(BC) line so its origin is the literal midpoint of segment A→midpoint(BC). |
| Inside Pitchfork            | `insidePitchfork`          | 3       | `linetool-inside-pitchfork`               | Median from midpoint(A,B); rails through A and B; C controls slope/length. |

## Cross-cutting requirements

- **Wizard hint pill** (`syncPatternWizardHint` → `PATTERN_LABELS_BY_VARIANT`):
  channels (`channel`, `disjointChannel`) and all four pitchforks now have
  explicit step labels (`A`, `B`, `C`, `D`) so the cursor pill renders
  `<Tool>: <label> (n/N)` instead of falling back to `P1, P2, P3`.
- **Floating toolbar** must appear after the final anchor click for every tool
  (`FloatingDrawingToolbar.tsx`).
- **TV-style fills**: channels and pitchforks must use semi-transparent fill
  (`globalAlpha ≈ 0.15`) between rails, with stroke at full opacity.
- **Stddev band** for `regressionTrend` is currently rendered as a constant
  vertical offset; TV computes ±σ from price residuals — verify or note as
  follow-up.
- **Color palette**: TV defaults — channel border `#2962FF`, fill `rgba(41,98,255,0.15)`;
  flat-top-bottom orange `#FF9800`; disjoint channel `#22C55E`; pitchfork blue
  with internal levels green/teal.

## Source artifacts
- `harshit-repo/scripts/capture-tv-line-tools.mjs` — Playwright capture script.
- `harshit-repo/docs/tv-line-screenshots/` — 17 tools × 4-5 phases PNGs.
- `harshit-repo/docs/tv-line-screenshots/manifest.json` — programmatic record.
- `harshit-repo/docs/tv-line-screenshots/_linetool-items.json` — TV DOM dump.
