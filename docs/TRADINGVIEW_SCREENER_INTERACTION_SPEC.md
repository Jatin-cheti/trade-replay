# TradingView Screener Interaction Spec

Captured date: 2026-04-18
Captured from: https://www.tradingview.com/screener/, https://www.tradingview.com/symbols/NASDAQ-NVDA/
Capture mode: interactive browser inspection (desktop web)

```ts
export const interactionSpec = {
  navbar: {
    menuTrigger: {
      element: "Open menu button",
      behavior: "click to open left-side drawer",
      state: "aria-expanded toggles",
      animation: {
        style: "slide-in drawer + backdrop",
        durationMsApprox: 150,
      },
    },
    products: {
      trigger: "Products",
      behavior: "click opens Products category panel",
      submenuTrigger: "Screeners",
      submenuBehavior: "click drills into Screeners subpanel",
      closeBehavior: [
        "Close menu button closes drawer",
        "Escape closes active overlay/panel",
      ],
      structure: {
        screeners: ["Stocks", "ETFs", "Bonds", "Crypto coins", "CEX pairs", "DEX pairs"],
        heatmaps: ["Stocks", "ETFs", "Crypto coins"],
        routes: {
          stocksScreener: "/screener/",
          etfScreener: "/etf-screener/",
          bondScreener: "/bond-screener/",
          cryptoScreener: "/crypto-coins-screener/",
          cexScreener: "/cex-screener/",
          dexScreener: "/dex-screener/",
          stocksHeatmap: "/heatmap/stock/",
          etfHeatmap: "/heatmap/etf/",
          cryptoHeatmap: "/heatmap/crypto/",
        },
      },
    },
  },

  screener: {
    topBar: {
      typeDropdown: {
        trigger: "Stock Screener",
        options: [
          "Stock Screener",
          "ETF Screener",
          "Bond Screener",
          "Crypto Coins Screener",
          "CEX Screener",
          "DEX Screener",
        ],
        behavior: "click opens options popover; selecting option navigates/reloads dataset",
      },
      screenMenu: {
        trigger: "All stocks",
        optionsObserved: [
          "Share screen",
          "Make a copy...",
          "Download results as CSV",
          "Create new screen...",
          "Open screen...",
        ],
        optionsRequiredByAppParity: [
          "Save screen",
          "Share screen",
          "Copy link",
          "Make a copy",
          "Rename",
          "Download CSV",
          "Create new screen",
          "Recently used",
          "Open screen",
        ],
      },
      columnSets: {
        trigger: "Column sets",
        options: [
          "Overview",
          "Performance",
          "Extended Hours",
          "Valuation",
          "Dividends",
          "Profitability",
          "Income Statement",
          "Balance Sheet",
          "Cash Flow",
          "Per Share",
          "Technicals",
        ],
      },
    },

    filters: {
      chips: [
        "US",
        "Watchlist",
        "Index",
        "Price",
        "Change %",
        "Market cap",
        "P/E",
        "EPS dil growth",
        "Div yield %",
        "Sector",
        "Analyst Rating",
        "Perf %",
        "Revenue growth",
        "PEG",
        "ROE",
        "Beta",
        "Recent earnings date",
        "Upcoming earnings date",
      ],
      market: {
        title: "Market",
        controls: ["Search input", "multi-select countries", "Primary listing toggle"],
        behavior: {
          selectionMode: "multi-select",
          includeMode: "OR within same filter, AND across different filters",
          search: "local filter within long country list",
        },
      },
      watchlist: {
        title: "Watchlist",
        behavior: "auth-gated for custom lists in TradingView",
      },
      index: {
        title: "Index",
        controls: ["Search input", "long selectable index list", "select all"],
      },
      metricFilters: {
        behavior: "preset list + manual setup path",
        manualSetup: "auth-gated in TradingView guest mode",
      },
      addFilter: {
        trigger: "Add new filter",
        search: true,
        categories: [
          "Security info",
          "Market data",
          "Technicals",
          "Financials",
          "Valuation",
          "Growth",
          "Margins",
          "Dividends",
        ],
      },
      debounceMsApprox: 300,
    },

    table: {
      headersObserved: [
        "Symbol",
        "Price",
        "Change %",
        "Volume",
        "Rel Volume",
        "Market cap",
        "P/E",
        "EPS dil (TTM)",
        "EPS dil growth (TTM YoY)",
        "Div yield % (TTM)",
        "Sector",
        "Analyst Rating",
      ],
      sorting: {
        behavior: "clickable sortable headers; direction toggles asc/desc",
      },
      rowNavigation: {
        behavior: "click symbol opens symbol page",
        routeStyle: "/symbols/EXCHANGE-SYMBOL/ on TradingView",
      },
      stickyHeader: true,
      hoverState: true,
      loading: {
        initial: "skeleton-style placeholder rows",
        pagination: "incremental loading while preserving scroll context",
      },
    },

    scroll: {
      strategy: "virtualized/incremental row rendering",
      trigger: "near-bottom fetch continuation",
      behavior: "smooth infinite list with progressive append",
      prefetch: "next batch fetched before hard stop",
    },
  },

  symbolPage: {
    routePattern: "/symbols/:exchange-:symbol/",
    tabsObserved: [
      "Overview",
      "Financials",
      "News",
      "Documents",
      "Community",
      "Technicals",
      "Forecasts",
      "Seasonals",
      "Options",
      "Bonds",
      "ETFs",
    ],
  },

  parityConstraintsForOurImplementation: {
    mustUseClickControlledStates: true,
    mustCloseOnOutsideOrEscape: true,
    mustUseDebouncedSearchApprox300ms: true,
    mustKeepFilterCombinationLogic: "AND across filter groups, OR within selected values in a group",
    mustUseVirtualizedScrolling: true,
    mustKeepStickyHeaders: true,
    mustSupportResponsiveModes: {
      mobile: "card list",
      tablet: "reduced columns",
      desktop: "full table",
    },
  },
};
```

## Notes
- Some TradingView actions are account-gated in guest mode (for example watchlist management and certain manual setup paths).
- For parity implementation in this repo, account-gated actions are implemented with persisted local state and backend-safe defaults.
