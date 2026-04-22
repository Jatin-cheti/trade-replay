# Logo Rendering Quality Spec

## Objective

Ensure logos are high-quality, traceable, and consistently rendered without crop, zoom, blur, or stretched favicon artifacts.

## Current Baseline

- Existing logo pipeline reports strong progress on real-logo coverage and reduced fallback usage
- Symbol and screener render paths still need explicit visual quality enforcement across breakpoints
- Priority symbols must prefer high-resolution sources over tiny favicons

## Asset Quality Contract

Every logo record should store:

- resolved URL or CDN path
- mime type
- width and height
- source provider
- source trace / resolver tier
- confidence band
- last validated timestamp
- quality issue flags

## Minimum Quality Thresholds

Preferred thresholds for stock and ETF logos:

- minimum accepted raster size for premium use: 64x64
- minimum preferred size for symbol header: 128x128
- SVG is preferred when valid and brand-correct
- favicon-only assets below threshold should not be aggressively upscaled

Reject or downgrade when:

- mime type invalid
- unreadable or broken URL
- dimensions below threshold
- severe empty padding or crop
- obvious blur after render

## Source Preference Chain

1. Verified SVG / high-res brand asset
2. CDN-cached validated raster asset
3. Provider image endpoint with dimension validation
4. Google/DuckDuckGo favicon fallback for only small-row usage
5. Refined monogram fallback

## Rendering Rules

Avatar tokens:

- screener row: 24 or 32
- list/detail compact: 40
- symbol header: 48 or 64

Rendering defaults:

- `object-fit: contain`
- `object-position: center`
- explicit width and height tokens
- internal padding so the mark does not touch the container edge
- neutral background and subtle border to improve legibility

Do not:

- use `object-fit: cover` for logos
- stretch non-square assets to fill the box
- upscale low-res favicons into large symbol-header blobs

## Visual QA Loop

For each processed batch:

- validate screener row render
- validate symbol header render
- flag crop/zoom/blur artifacts automatically where possible
- export flagged symbols for reprocessing

## Reason Codes For Audit Exports

- `missing_url`
- `broken_url`
- `invalid_mime`
- `too_small`
- `favicon_only`
- `cropped_render`
- `blurred_render`
- `wrong_brand`
- `fallback_monogram`

## Acceptance Criteria

- No widespread cropped logos in screener rows
- No widespread blurry blown-up logos in symbol headers
- High-priority symbols use high-confidence assets
- All fallback lists are exportable with reason codes and source metadata