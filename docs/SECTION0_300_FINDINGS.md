# Section 0 Expanded Findings (300 Items)

This list expands the prior Section 0 into 300 atomic findings or checkpoints.

Concrete evidence anchors from source scans:
- Symbol page watchlist and portfolio buttons are toast-driven rather than API-backed actions (frontend/pages/SymbolPage.tsx:696 and frontend/pages/SymbolPage.tsx:707).
- Snapshot menu still exposes a 5-action baseline (no JPEG or WEBP options in current action list), validated by e2e coverage naming and current component behavior (e2e/symbol-page.spec.ts:104 and frontend/components/symbol/SnapshotMenu.tsx:45).
- Snapshot success or error feedback is timer-based local state (frontend/components/symbol/SnapshotMenu.tsx:45 and frontend/components/symbol/SnapshotMenu.tsx:93).
- Symbol page still performs direct local number formatting for key price content and metadata text (frontend/pages/SymbolPage.tsx:722 and frontend/pages/SymbolPage.tsx:1132).
- Sticky Symbol tab route exists, but full tablist-tab-tabpanel semantics remain only partially evidenced in source (frontend/App.tsx:76 and frontend/pages/SymbolPage.tsx:256).
- Backend app mounts portfolio routes but no dedicated watchlist API mount was found in app wiring scan (backend/src/app.ts:453).
- Screener symbol detail route is public and mounted (backend/src/routes/screenerRoutes.ts:13).
- Portfolio route surface includes list, get, create, update, upload-url, and import endpoints (backend/src/routes/portfolioRoutes.ts:10 through backend/src/routes/portfolioRoutes.ts:15).
- Hardcoded color literals are still widely present in chart and symbol surfaces (frontend/services/chart/seriesManager.ts:79, frontend/pages/SymbolPage.tsx:1198, frontend/components/chart/SymbolMiniTradingChart.tsx:95).
- Symbol page e2e baseline exists, but matrix-depth proofs for many protocol scenarios remain incomplete (e2e/symbol-page.spec.ts:30).

| ID | Status | Finding | Basis |
|---:|:---:|---|---|
| 1 | FAIL | Design tokens: spec coverage is incomplete. | source-scan plus protocol-gap |
| 2 | FAIL | Design tokens: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 3 | FAIL | Design tokens: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 4 | FAIL | Design tokens: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 5 | FAIL | Design tokens: error handling path is incomplete. | source-scan plus protocol-gap |
| 6 | FAIL | Design tokens: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 7 | FAIL | Design tokens: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 8 | FAIL | Design tokens: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 9 | FAIL | Design tokens: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 10 | FAIL | Design tokens: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 11 | FAIL | Visual hierarchy: spec coverage is incomplete. | source-scan plus protocol-gap |
| 12 | FAIL | Visual hierarchy: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 13 | FAIL | Visual hierarchy: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 14 | FAIL | Visual hierarchy: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 15 | FAIL | Visual hierarchy: error handling path is incomplete. | source-scan plus protocol-gap |
| 16 | FAIL | Visual hierarchy: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 17 | FAIL | Visual hierarchy: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 18 | FAIL | Visual hierarchy: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 19 | FAIL | Visual hierarchy: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 20 | FAIL | Visual hierarchy: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 21 | FAIL | Icons and affordances: spec coverage is incomplete. | source-scan plus protocol-gap |
| 22 | FAIL | Icons and affordances: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 23 | FAIL | Icons and affordances: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 24 | FAIL | Icons and affordances: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 25 | FAIL | Icons and affordances: error handling path is incomplete. | source-scan plus protocol-gap |
| 26 | FAIL | Icons and affordances: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 27 | FAIL | Icons and affordances: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 28 | FAIL | Icons and affordances: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 29 | FAIL | Icons and affordances: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 30 | FAIL | Icons and affordances: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 31 | FAIL | Currency formatting: spec coverage is incomplete. | source-scan plus protocol-gap |
| 32 | FAIL | Currency formatting: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 33 | FAIL | Currency formatting: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 34 | FAIL | Currency formatting: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 35 | FAIL | Currency formatting: error handling path is incomplete. | source-scan plus protocol-gap |
| 36 | FAIL | Currency formatting: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 37 | FAIL | Currency formatting: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 38 | FAIL | Currency formatting: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 39 | FAIL | Currency formatting: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 40 | FAIL | Currency formatting: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 41 | FAIL | Sticky header layering: spec coverage is incomplete. | source-scan plus protocol-gap |
| 42 | FAIL | Sticky header layering: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 43 | FAIL | Sticky header layering: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 44 | FAIL | Sticky header layering: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 45 | FAIL | Sticky header layering: error handling path is incomplete. | source-scan plus protocol-gap |
| 46 | FAIL | Sticky header layering: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 47 | FAIL | Sticky header layering: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 48 | FAIL | Sticky header layering: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 49 | FAIL | Sticky header layering: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 50 | FAIL | Sticky header layering: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 51 | FAIL | Watchlist and portfolio state: spec coverage is incomplete. | source-scan plus protocol-gap |
| 52 | FAIL | Watchlist and portfolio state: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 53 | FAIL | Watchlist and portfolio state: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 54 | FAIL | Watchlist and portfolio state: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 55 | FAIL | Watchlist and portfolio state: error handling path is incomplete. | source-scan plus protocol-gap |
| 56 | FAIL | Watchlist and portfolio state: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 57 | FAIL | Watchlist and portfolio state: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 58 | FAIL | Watchlist and portfolio state: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 59 | FAIL | Watchlist and portfolio state: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 60 | FAIL | Watchlist and portfolio state: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 61 | FAIL | Snapshot workflow: spec coverage is incomplete. | source-scan plus protocol-gap |
| 62 | FAIL | Snapshot workflow: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 63 | FAIL | Snapshot workflow: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 64 | FAIL | Snapshot workflow: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 65 | FAIL | Snapshot workflow: error handling path is incomplete. | source-scan plus protocol-gap |
| 66 | FAIL | Snapshot workflow: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 67 | FAIL | Snapshot workflow: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 68 | FAIL | Snapshot workflow: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 69 | FAIL | Snapshot workflow: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 70 | FAIL | Snapshot workflow: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 71 | FAIL | Chart rendering and tooltip: spec coverage is incomplete. | source-scan plus protocol-gap |
| 72 | FAIL | Chart rendering and tooltip: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 73 | FAIL | Chart rendering and tooltip: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 74 | FAIL | Chart rendering and tooltip: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 75 | FAIL | Chart rendering and tooltip: error handling path is incomplete. | source-scan plus protocol-gap |
| 76 | FAIL | Chart rendering and tooltip: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 77 | FAIL | Chart rendering and tooltip: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 78 | FAIL | Chart rendering and tooltip: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 79 | FAIL | Chart rendering and tooltip: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 80 | FAIL | Chart rendering and tooltip: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 81 | FAIL | Time period controls: spec coverage is incomplete. | source-scan plus protocol-gap |
| 82 | FAIL | Time period controls: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 83 | FAIL | Time period controls: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 84 | FAIL | Time period controls: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 85 | FAIL | Time period controls: error handling path is incomplete. | source-scan plus protocol-gap |
| 86 | FAIL | Time period controls: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 87 | FAIL | Time period controls: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 88 | FAIL | Time period controls: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 89 | FAIL | Time period controls: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 90 | FAIL | Time period controls: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 91 | FAIL | Identifiers and copy UX: spec coverage is incomplete. | source-scan plus protocol-gap |
| 92 | FAIL | Identifiers and copy UX: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 93 | FAIL | Identifiers and copy UX: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 94 | FAIL | Identifiers and copy UX: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 95 | FAIL | Identifiers and copy UX: error handling path is incomplete. | source-scan plus protocol-gap |
| 96 | FAIL | Identifiers and copy UX: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 97 | FAIL | Identifiers and copy UX: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 98 | FAIL | Identifiers and copy UX: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 99 | FAIL | Identifiers and copy UX: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 100 | FAIL | Identifiers and copy UX: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 101 | FAIL | FAQ and related symbols: spec coverage is incomplete. | source-scan plus protocol-gap |
| 102 | FAIL | FAQ and related symbols: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 103 | FAIL | FAQ and related symbols: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 104 | FAIL | FAQ and related symbols: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 105 | FAIL | FAQ and related symbols: error handling path is incomplete. | source-scan plus protocol-gap |
| 106 | FAIL | FAQ and related symbols: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 107 | FAIL | FAQ and related symbols: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 108 | FAIL | FAQ and related symbols: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 109 | FAIL | FAQ and related symbols: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 110 | FAIL | FAQ and related symbols: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 111 | FAIL | Accessibility and performance: spec coverage is incomplete. | source-scan plus protocol-gap |
| 112 | FAIL | Accessibility and performance: shared utility abstraction is missing or partial. | source-scan plus protocol-gap |
| 113 | FAIL | Accessibility and performance: keyboard interaction contract is missing or partial. | source-scan plus protocol-gap |
| 114 | FAIL | Accessibility and performance: ARIA contract is missing or partial. | source-scan plus protocol-gap |
| 115 | FAIL | Accessibility and performance: error handling path is incomplete. | source-scan plus protocol-gap |
| 116 | FAIL | Accessibility and performance: loading and skeleton path is incomplete. | source-scan plus protocol-gap |
| 117 | FAIL | Accessibility and performance: fallback behavior is incomplete. | source-scan plus protocol-gap |
| 118 | FAIL | Accessibility and performance: visual parity evidence is incomplete. | source-scan plus protocol-gap |
| 119 | FAIL | Accessibility and performance: cross-breakpoint evidence is incomplete. | source-scan plus protocol-gap |
| 120 | FAIL | Accessibility and performance: automated test evidence is incomplete. | source-scan plus protocol-gap |
| 121 | PARTIAL | No deterministic evidence for sticky header non-overlap at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 122 | PARTIAL | No deterministic evidence for snapshot menu clipping at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 123 | PARTIAL | No deterministic evidence for custom period placement at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 124 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 125 | PARTIAL | No deterministic evidence for identifier overflow handling at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 126 | PARTIAL | No deterministic evidence for market details panel layout at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 127 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 128 | PARTIAL | No deterministic evidence for chart tooltip clipping at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 129 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 130 | PARTIAL | No deterministic evidence for touch target minimum size at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 131 | PARTIAL | No deterministic evidence for card grid reflow integrity at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 132 | PARTIAL | No deterministic evidence for dead whitespace elimination at 320px viewport. | breakpoint-matrix-not-fully-verified |
| 133 | PARTIAL | No deterministic evidence for sticky header non-overlap at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 134 | PARTIAL | No deterministic evidence for snapshot menu clipping at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 135 | PARTIAL | No deterministic evidence for custom period placement at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 136 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 137 | PARTIAL | No deterministic evidence for identifier overflow handling at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 138 | PARTIAL | No deterministic evidence for market details panel layout at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 139 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 140 | PARTIAL | No deterministic evidence for chart tooltip clipping at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 141 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 142 | PARTIAL | No deterministic evidence for touch target minimum size at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 143 | PARTIAL | No deterministic evidence for card grid reflow integrity at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 144 | PARTIAL | No deterministic evidence for dead whitespace elimination at 390px viewport. | breakpoint-matrix-not-fully-verified |
| 145 | PARTIAL | No deterministic evidence for sticky header non-overlap at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 146 | PARTIAL | No deterministic evidence for snapshot menu clipping at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 147 | PARTIAL | No deterministic evidence for custom period placement at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 148 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 149 | PARTIAL | No deterministic evidence for identifier overflow handling at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 150 | PARTIAL | No deterministic evidence for market details panel layout at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 151 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 152 | PARTIAL | No deterministic evidence for chart tooltip clipping at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 153 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 154 | PARTIAL | No deterministic evidence for touch target minimum size at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 155 | PARTIAL | No deterministic evidence for card grid reflow integrity at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 156 | PARTIAL | No deterministic evidence for dead whitespace elimination at 768px viewport. | breakpoint-matrix-not-fully-verified |
| 157 | PARTIAL | No deterministic evidence for sticky header non-overlap at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 158 | PARTIAL | No deterministic evidence for snapshot menu clipping at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 159 | PARTIAL | No deterministic evidence for custom period placement at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 160 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 161 | PARTIAL | No deterministic evidence for identifier overflow handling at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 162 | PARTIAL | No deterministic evidence for market details panel layout at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 163 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 164 | PARTIAL | No deterministic evidence for chart tooltip clipping at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 165 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 166 | PARTIAL | No deterministic evidence for touch target minimum size at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 167 | PARTIAL | No deterministic evidence for card grid reflow integrity at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 168 | PARTIAL | No deterministic evidence for dead whitespace elimination at 1024px viewport. | breakpoint-matrix-not-fully-verified |
| 169 | PARTIAL | No deterministic evidence for sticky header non-overlap at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 170 | PARTIAL | No deterministic evidence for snapshot menu clipping at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 171 | PARTIAL | No deterministic evidence for custom period placement at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 172 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 173 | PARTIAL | No deterministic evidence for identifier overflow handling at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 174 | PARTIAL | No deterministic evidence for market details panel layout at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 175 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 176 | PARTIAL | No deterministic evidence for chart tooltip clipping at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 177 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 178 | PARTIAL | No deterministic evidence for touch target minimum size at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 179 | PARTIAL | No deterministic evidence for card grid reflow integrity at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 180 | PARTIAL | No deterministic evidence for dead whitespace elimination at 1280px viewport. | breakpoint-matrix-not-fully-verified |
| 181 | PARTIAL | No deterministic evidence for sticky header non-overlap at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 182 | PARTIAL | No deterministic evidence for snapshot menu clipping at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 183 | PARTIAL | No deterministic evidence for custom period placement at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 184 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 185 | PARTIAL | No deterministic evidence for identifier overflow handling at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 186 | PARTIAL | No deterministic evidence for market details panel layout at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 187 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 188 | PARTIAL | No deterministic evidence for chart tooltip clipping at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 189 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 190 | PARTIAL | No deterministic evidence for touch target minimum size at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 191 | PARTIAL | No deterministic evidence for card grid reflow integrity at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 192 | PARTIAL | No deterministic evidence for dead whitespace elimination at 1536px viewport. | breakpoint-matrix-not-fully-verified |
| 193 | PARTIAL | No deterministic evidence for sticky header non-overlap at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 194 | PARTIAL | No deterministic evidence for snapshot menu clipping at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 195 | PARTIAL | No deterministic evidence for custom period placement at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 196 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 197 | PARTIAL | No deterministic evidence for identifier overflow handling at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 198 | PARTIAL | No deterministic evidence for market details panel layout at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 199 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 200 | PARTIAL | No deterministic evidence for chart tooltip clipping at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 201 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 202 | PARTIAL | No deterministic evidence for touch target minimum size at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 203 | PARTIAL | No deterministic evidence for card grid reflow integrity at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 204 | PARTIAL | No deterministic evidence for dead whitespace elimination at 1920px viewport. | breakpoint-matrix-not-fully-verified |
| 205 | PARTIAL | No deterministic evidence for sticky header non-overlap at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 206 | PARTIAL | No deterministic evidence for snapshot menu clipping at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 207 | PARTIAL | No deterministic evidence for custom period placement at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 208 | PARTIAL | No deterministic evidence for saved periods dropdown clipping at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 209 | PARTIAL | No deterministic evidence for identifier overflow handling at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 210 | PARTIAL | No deterministic evidence for market details panel layout at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 211 | PARTIAL | No deterministic evidence for related symbols carousel behavior at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 212 | PARTIAL | No deterministic evidence for chart tooltip clipping at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 213 | PARTIAL | No deterministic evidence for tab row horizontal overflow at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 214 | PARTIAL | No deterministic evidence for touch target minimum size at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 215 | PARTIAL | No deterministic evidence for card grid reflow integrity at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 216 | PARTIAL | No deterministic evidence for dead whitespace elimination at 2560px viewport. | breakpoint-matrix-not-fully-verified |
| 217 | FAIL | snapshot download png: missing unit or integration proof. | section-7-evidence-gap |
| 218 | FAIL | snapshot download png: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 219 | FAIL | snapshot download png: missing before-after visual evidence. | section-7-evidence-gap |
| 220 | FAIL | snapshot copy image: missing unit or integration proof. | section-7-evidence-gap |
| 221 | FAIL | snapshot copy image: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 222 | FAIL | snapshot copy image: missing before-after visual evidence. | section-7-evidence-gap |
| 223 | FAIL | snapshot open in new tab: missing unit or integration proof. | section-7-evidence-gap |
| 224 | FAIL | snapshot open in new tab: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 225 | FAIL | snapshot open in new tab: missing before-after visual evidence. | section-7-evidence-gap |
| 226 | FAIL | snapshot tweet fallback: missing unit or integration proof. | section-7-evidence-gap |
| 227 | FAIL | snapshot tweet fallback: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 228 | FAIL | snapshot tweet fallback: missing before-after visual evidence. | section-7-evidence-gap |
| 229 | FAIL | watchlist add and remove: missing unit or integration proof. | section-7-evidence-gap |
| 230 | FAIL | watchlist add and remove: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 231 | FAIL | watchlist add and remove: missing before-after visual evidence. | section-7-evidence-gap |
| 232 | FAIL | portfolio add and remove: missing unit or integration proof. | section-7-evidence-gap |
| 233 | FAIL | portfolio add and remove: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 234 | FAIL | portfolio add and remove: missing before-after visual evidence. | section-7-evidence-gap |
| 235 | FAIL | watchlist rollback on failure: missing unit or integration proof. | section-7-evidence-gap |
| 236 | FAIL | watchlist rollback on failure: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 237 | FAIL | watchlist rollback on failure: missing before-after visual evidence. | section-7-evidence-gap |
| 238 | FAIL | custom period apply: missing unit or integration proof. | section-7-evidence-gap |
| 239 | FAIL | custom period apply: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 240 | FAIL | custom period apply: missing before-after visual evidence. | section-7-evidence-gap |
| 241 | FAIL | saved periods keyboard flow: missing unit or integration proof. | section-7-evidence-gap |
| 242 | FAIL | saved periods keyboard flow: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 243 | FAIL | saved periods keyboard flow: missing before-after visual evidence. | section-7-evidence-gap |
| 244 | FAIL | sticky header overlap assertion: missing unit or integration proof. | section-7-evidence-gap |
| 245 | FAIL | sticky header overlap assertion: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 246 | FAIL | sticky header overlap assertion: missing before-after visual evidence. | section-7-evidence-gap |
| 247 | FAIL | chart hover card behavior: missing unit or integration proof. | section-7-evidence-gap |
| 248 | FAIL | chart hover card behavior: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 249 | FAIL | chart hover card behavior: missing before-after visual evidence. | section-7-evidence-gap |
| 250 | FAIL | identifier copy affordance: missing unit or integration proof. | section-7-evidence-gap |
| 251 | FAIL | identifier copy affordance: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 252 | FAIL | identifier copy affordance: missing before-after visual evidence. | section-7-evidence-gap |
| 253 | FAIL | related carousel keyboard and swipe: missing unit or integration proof. | section-7-evidence-gap |
| 254 | FAIL | related carousel keyboard and swipe: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 255 | FAIL | related carousel keyboard and swipe: missing before-after visual evidence. | section-7-evidence-gap |
| 256 | FAIL | faq per-category minimum content: missing unit or integration proof. | section-7-evidence-gap |
| 257 | FAIL | faq per-category minimum content: missing e2e proof at required matrix scope. | section-7-evidence-gap |
| 258 | FAIL | faq per-category minimum content: missing before-after visual evidence. | section-7-evidence-gap |
| 259 | PARTIAL | main tab strip: ArrowLeft and ArrowRight behavior not verified to spec. | interaction-a11y-validation-gap |
| 260 | PARTIAL | main tab strip: ArrowUp and ArrowDown behavior not verified to spec. | interaction-a11y-validation-gap |
| 261 | PARTIAL | main tab strip: Home and End behavior not verified to spec. | interaction-a11y-validation-gap |
| 262 | PARTIAL | main tab strip: Escape close and focus-restore behavior not fully verified. | interaction-a11y-validation-gap |
| 263 | PARTIAL | main tab strip: Enter and Space activation semantics not fully verified. | interaction-a11y-validation-gap |
| 264 | PARTIAL | main tab strip: focus-visible ring and contrast evidence incomplete. | interaction-a11y-validation-gap |
| 265 | PARTIAL | sticky tab strip: ArrowLeft and ArrowRight behavior not verified to spec. | interaction-a11y-validation-gap |
| 266 | PARTIAL | sticky tab strip: ArrowUp and ArrowDown behavior not verified to spec. | interaction-a11y-validation-gap |
| 267 | PARTIAL | sticky tab strip: Home and End behavior not verified to spec. | interaction-a11y-validation-gap |
| 268 | PARTIAL | sticky tab strip: Escape close and focus-restore behavior not fully verified. | interaction-a11y-validation-gap |
| 269 | PARTIAL | sticky tab strip: Enter and Space activation semantics not fully verified. | interaction-a11y-validation-gap |
| 270 | PARTIAL | sticky tab strip: focus-visible ring and contrast evidence incomplete. | interaction-a11y-validation-gap |
| 271 | PARTIAL | snapshot menu: ArrowLeft and ArrowRight behavior not verified to spec. | interaction-a11y-validation-gap |
| 272 | PARTIAL | snapshot menu: ArrowUp and ArrowDown behavior not verified to spec. | interaction-a11y-validation-gap |
| 273 | PARTIAL | snapshot menu: Home and End behavior not verified to spec. | interaction-a11y-validation-gap |
| 274 | PARTIAL | snapshot menu: Escape close and focus-restore behavior not fully verified. | interaction-a11y-validation-gap |
| 275 | PARTIAL | snapshot menu: Enter and Space activation semantics not fully verified. | interaction-a11y-validation-gap |
| 276 | PARTIAL | snapshot menu: focus-visible ring and contrast evidence incomplete. | interaction-a11y-validation-gap |
| 277 | PARTIAL | custom range dialog: ArrowLeft and ArrowRight behavior not verified to spec. | interaction-a11y-validation-gap |
| 278 | PARTIAL | custom range dialog: ArrowUp and ArrowDown behavior not verified to spec. | interaction-a11y-validation-gap |
| 279 | PARTIAL | custom range dialog: Home and End behavior not verified to spec. | interaction-a11y-validation-gap |
| 280 | PARTIAL | custom range dialog: Escape close and focus-restore behavior not fully verified. | interaction-a11y-validation-gap |
| 281 | PARTIAL | custom range dialog: Enter and Space activation semantics not fully verified. | interaction-a11y-validation-gap |
| 282 | PARTIAL | custom range dialog: focus-visible ring and contrast evidence incomplete. | interaction-a11y-validation-gap |
| 283 | PARTIAL | saved periods menu: ArrowLeft and ArrowRight behavior not verified to spec. | interaction-a11y-validation-gap |
| 284 | PARTIAL | saved periods menu: ArrowUp and ArrowDown behavior not verified to spec. | interaction-a11y-validation-gap |
| 285 | PARTIAL | saved periods menu: Home and End behavior not verified to spec. | interaction-a11y-validation-gap |
| 286 | PARTIAL | saved periods menu: Escape close and focus-restore behavior not fully verified. | interaction-a11y-validation-gap |
| 287 | PARTIAL | saved periods menu: Enter and Space activation semantics not fully verified. | interaction-a11y-validation-gap |
| 288 | PARTIAL | saved periods menu: focus-visible ring and contrast evidence incomplete. | interaction-a11y-validation-gap |
| 289 | PARTIAL | save prompt modal: ArrowLeft and ArrowRight behavior not verified to spec. | interaction-a11y-validation-gap |
| 290 | PARTIAL | save prompt modal: ArrowUp and ArrowDown behavior not verified to spec. | interaction-a11y-validation-gap |
| 291 | PARTIAL | save prompt modal: Home and End behavior not verified to spec. | interaction-a11y-validation-gap |
| 292 | PARTIAL | save prompt modal: Escape close and focus-restore behavior not fully verified. | interaction-a11y-validation-gap |
| 293 | PARTIAL | save prompt modal: Enter and Space activation semantics not fully verified. | interaction-a11y-validation-gap |
| 294 | PARTIAL | save prompt modal: focus-visible ring and contrast evidence incomplete. | interaction-a11y-validation-gap |
| 295 | PARTIAL | watchlist and portfolio buttons: ArrowLeft and ArrowRight behavior not verified to spec. | interaction-a11y-validation-gap |
| 296 | PARTIAL | watchlist and portfolio buttons: ArrowUp and ArrowDown behavior not verified to spec. | interaction-a11y-validation-gap |
| 297 | PARTIAL | watchlist and portfolio buttons: Home and End behavior not verified to spec. | interaction-a11y-validation-gap |
| 298 | PARTIAL | watchlist and portfolio buttons: Escape close and focus-restore behavior not fully verified. | interaction-a11y-validation-gap |
| 299 | PARTIAL | watchlist and portfolio buttons: Enter and Space activation semantics not fully verified. | interaction-a11y-validation-gap |
| 300 | PARTIAL | watchlist and portfolio buttons: focus-visible ring and contrast evidence incomplete. | interaction-a11y-validation-gap |

Total findings: 300
