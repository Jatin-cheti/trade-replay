/**
 * Comprehensive indicator catalog data for the Indicators Modal.
 *
 * Maps the built-in indicators from @tradereplay/charts into
 * TradingView-style categories for the sidebar navigation.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type IndicatorCategory =
  | 'technicals'
  | 'financials'
  | 'community';

export type TechnicalSubcategory =
  | 'trend'
  | 'oscillators'
  | 'volatility'
  | 'volume'
  | 'movingAverages'
  | 'billWilliams'
  | 'breadth'
  | 'momentum'
  | 'statistical'
  | 'candlePatterns';

export type FinancialSubcategory =
  | 'incomeStatement'
  | 'balanceSheet'
  | 'cashFlow'
  | 'statistics'
  | 'dividends';

export type CommunitySubcategory =
  | 'editorsPicks'
  | 'topScripts'
  | 'trending';

export interface CatalogEntry {
  id: string;
  name: string;
  /** Whether this id matches a built-in indicator in the registry */
  builtin: boolean;
  description?: string;
}

export interface TechnicalSection {
  subcategory: TechnicalSubcategory;
  label: string;
  items: CatalogEntry[];
}

export interface FinancialSection {
  subcategory: FinancialSubcategory;
  label: string;
  items: CatalogEntry[];
}

export interface CommunitySection {
  subcategory: CommunitySubcategory;
  label: string;
  items: CatalogEntry[];
}

// ─── Technicals ─────────────────────────────────────────────────────────────

export const technicalSections: TechnicalSection[] = [
  {
    subcategory: 'movingAverages',
    label: 'Moving Averages',
    items: [
      { id: 'sma', name: 'Simple Moving Average (SMA)', builtin: true },
      { id: 'ema', name: 'Exponential Moving Average (EMA)', builtin: true },
      { id: 'wma', name: 'Weighted Moving Average (WMA)', builtin: true },
      { id: 'hma', name: 'Hull Moving Average (HMA)', builtin: true },
      { id: 'dema', name: 'Double EMA (DEMA)', builtin: true },
      { id: 'tema', name: 'Triple EMA (TEMA)', builtin: true },
      { id: 'zlema', name: 'Zero-Lag EMA (ZLEMA)', builtin: true },
      { id: 'kama', name: 'Kaufman Adaptive MA (KAMA)', builtin: true },
      { id: 'alma', name: 'Arnaud Legoux MA (ALMA)', builtin: true },
      { id: 'lsma', name: 'Least Squares MA (LSMA)', builtin: true },
      { id: 'trima', name: 'Triangular MA (TRIMA)', builtin: true },
      { id: 'smma', name: 'Smoothed MA (SMMA)', builtin: true },
      { id: 'vwap', name: 'Volume Weighted Average Price (VWAP)', builtin: true },
    ],
  },
  {
    subcategory: 'trend',
    label: 'Trend',
    items: [
      { id: 'macd', name: 'MACD', builtin: true },
      { id: 'adx', name: 'Average Directional Index (ADX)', builtin: true },
      { id: 'dx', name: 'Directional Movement Index (DX)', builtin: true },
      { id: 'aroon', name: 'Aroon', builtin: true },
      { id: 'aroonOscillator', name: 'Aroon Oscillator', builtin: true },
      { id: 'supertrend', name: 'Supertrend', builtin: true },
      { id: 'psar', name: 'Parabolic SAR', builtin: true },
      { id: 'ichimoku', name: 'Ichimoku Cloud', builtin: true },
      { id: 'vortex', name: 'Vortex Indicator', builtin: true },
      { id: 'trix', name: 'TRIX', builtin: true },
      { id: 'dpo', name: 'Detrended Price Oscillator', builtin: true },
      { id: 'coppockCurve', name: 'Coppock Curve', builtin: true },
      { id: 'elderRay', name: 'Elder Ray Index', builtin: true },
      { id: 'trendStrength', name: 'Trend Strength', builtin: true },
      { id: 'linearRegSlope', name: 'Linear Regression Slope', builtin: true },
      { id: 'linearRegIntercept', name: 'Linear Regression Intercept', builtin: true },
      { id: 'linearRegAngle', name: 'Linear Regression Angle', builtin: true },
      { id: 'choppiness', name: 'Choppiness Index', builtin: true },
    ],
  },
  {
    subcategory: 'oscillators',
    label: 'Oscillators',
    items: [
      { id: 'rsi', name: 'Relative Strength Index (RSI)', builtin: true },
      { id: 'stochastic', name: 'Stochastic', builtin: true },
      { id: 'stochRsi', name: 'Stochastic RSI', builtin: true },
      { id: 'cci', name: 'Commodity Channel Index (CCI)', builtin: true },
      { id: 'williamsR', name: 'Williams %R', builtin: true },
      { id: 'roc', name: 'Rate of Change (ROC)', builtin: true },
      { id: 'momentum', name: 'Momentum', builtin: true },
      { id: 'ppo', name: 'Percentage Price Oscillator (PPO)', builtin: true },
      { id: 'pvo', name: 'Percentage Volume Oscillator (PVO)', builtin: true },
      { id: 'tsi', name: 'True Strength Index (TSI)', builtin: true },
      { id: 'crsi', name: 'Connors RSI (CRSI)', builtin: true },
      { id: 'cmo', name: 'Chande Momentum Oscillator (CMO)', builtin: true },
      { id: 'fisher', name: 'Fisher Transform', builtin: true },
      { id: 'kdj', name: 'KDJ', builtin: true },
      { id: 'apo', name: 'Absolute Price Oscillator (APO)', builtin: true },
      { id: 'smi', name: 'Stochastic Momentum Index (SMI)', builtin: true },
      { id: 'rvi', name: 'Relative Vigor Index (RVI)', builtin: true },
      { id: 'ultimate', name: 'Ultimate Oscillator', builtin: true },
    ],
  },
  {
    subcategory: 'volatility',
    label: 'Volatility',
    items: [
      { id: 'bbands', name: 'Bollinger Bands', builtin: true },
      { id: 'atr', name: 'Average True Range (ATR)', builtin: true },
      { id: 'donchian', name: 'Donchian Channels', builtin: true },
      { id: 'keltner', name: 'Keltner Channels', builtin: true },
      { id: 'bollingerPercentB', name: 'Bollinger %B', builtin: true },
      { id: 'bollingerBandwidth', name: 'Bollinger Bandwidth', builtin: true },
      { id: 'chaikinVolatility', name: 'Chaikin Volatility', builtin: true },
      { id: 'stddev', name: 'Standard Deviation', builtin: true },
      { id: 'variance', name: 'Variance', builtin: true },
      { id: 'normalizedAtr', name: 'Normalized ATR', builtin: true },
      { id: 'priceChannelWidth', name: 'Price Channel Width', builtin: true },
      { id: 'priceChannelMid', name: 'Price Channel Midline', builtin: true },
      { id: 'volatilityRatio', name: 'Volatility Ratio', builtin: true },
      { id: 'volatilityEma', name: 'Volatility EMA', builtin: true },
      { id: 'ulcerIndex', name: 'Ulcer Index', builtin: true },
      { id: 'massIndex', name: 'Mass Index', builtin: true },
      { id: 'trueRangePercent', name: 'True Range %', builtin: true },
    ],
  },
  {
    subcategory: 'volume',
    label: 'Volume',
    items: [
      { id: 'obv', name: 'On Balance Volume (OBV)', builtin: true },
      { id: 'mfi', name: 'Money Flow Index (MFI)', builtin: true },
      { id: 'cmf', name: 'Chaikin Money Flow (CMF)', builtin: true },
      { id: 'chaikinOsc', name: 'Chaikin Oscillator', builtin: true },
      { id: 'adl', name: 'Accumulation/Distribution Line', builtin: true },
      { id: 'forceIndex', name: 'Force Index', builtin: true },
      { id: 'eom', name: 'Ease of Movement', builtin: true },
      { id: 'nvi', name: 'Negative Volume Index', builtin: true },
      { id: 'pvi', name: 'Positive Volume Index', builtin: true },
      { id: 'vpt', name: 'Volume Price Trend', builtin: true },
      { id: 'relativeVolume', name: 'Relative Volume', builtin: true },
      { id: 'balanceOfPower', name: 'Balance of Power', builtin: true },
      { id: 'emvOsc', name: 'EMV Oscillator', builtin: true },
      { id: 'volumeOscillator', name: 'Volume Oscillator', builtin: true },
      { id: 'volumeZScore', name: 'Volume Z-Score', builtin: true },
      { id: 'volumeSmaRatio', name: 'Volume SMA Ratio', builtin: true },
      { id: 'cumulativeVolumeDelta', name: 'Cumulative Volume Delta', builtin: true },
    ],
  },
  {
    subcategory: 'momentum',
    label: 'Momentum',
    items: [
      { id: 'awesome', name: 'Awesome Oscillator', builtin: true },
      { id: 'qstick', name: 'QStick', builtin: true },
      { id: 'breakoutStrength', name: 'Breakout Strength', builtin: true },
      { id: 'percentileRank', name: 'Percentile Rank', builtin: true },
      { id: 'closeLocationValue', name: 'Close Location Value', builtin: true },
    ],
  },
  {
    subcategory: 'statistical',
    label: 'Statistical',
    items: [
      { id: 'medianPrice', name: 'Median Price', builtin: true },
      { id: 'typicalPrice', name: 'Typical Price', builtin: true },
      { id: 'weightedClose', name: 'Weighted Close', builtin: true },
      { id: 'rollingHigh', name: 'Rolling High', builtin: true },
      { id: 'rollingLow', name: 'Rolling Low', builtin: true },
      { id: 'rollingReturn', name: 'Rolling Return', builtin: true },
      { id: 'logReturn', name: 'Log Return', builtin: true },
      { id: 'rangeSmaRatio', name: 'Range SMA Ratio', builtin: true },
      { id: 'candleBody', name: 'Candle Body', builtin: true },
      { id: 'candleBodyPercent', name: 'Candle Body %', builtin: true },
      { id: 'upperWick', name: 'Upper Wick', builtin: true },
      { id: 'lowerWick', name: 'Lower Wick', builtin: true },
    ],
  },
  {
    subcategory: 'billWilliams',
    label: 'Bill Williams',
    items: [
      { id: 'awesome', name: 'Awesome Oscillator', builtin: true },
      { id: 'fractal', name: 'Fractals', builtin: false, description: 'Williams Fractals — highlights swing highs/lows' },
      { id: 'gator', name: 'Gator Oscillator', builtin: false, description: 'Measures convergence/divergence of Alligator lines' },
      { id: 'alligator', name: 'Williams Alligator', builtin: false, description: 'Smoothed moving averages: jaw, teeth, lips' },
      { id: 'mfi_williams', name: 'Market Facilitation Index', builtin: false, description: 'Measures bar efficiency (range / volume)' },
    ],
  },
  {
    subcategory: 'breadth',
    label: 'Breadth Indicators',
    items: [
      { id: 'advDecline', name: 'Advance/Decline Line', builtin: false, description: 'Tracks advancing vs declining issues' },
      { id: 'mcclellan', name: 'McClellan Oscillator', builtin: false, description: 'Breadth momentum oscillator' },
      { id: 'mcclellanSum', name: 'McClellan Summation', builtin: false, description: 'Cumulative McClellan' },
      { id: 'newHighLow', name: 'New High / New Low', builtin: false, description: 'Tracks new 52-week highs vs lows' },
      { id: 'upDownVolume', name: 'Up/Down Volume', builtin: false, description: 'Volume in advancing vs declining issues' },
    ],
  },
  {
    subcategory: 'candlePatterns',
    label: 'Candlestick Patterns',
    items: [
      { id: 'cp_doji', name: 'Doji', builtin: false, description: 'Indecision candle' },
      { id: 'cp_hammer', name: 'Hammer', builtin: false, description: 'Bullish reversal at bottom' },
      { id: 'cp_shootingStar', name: 'Shooting Star', builtin: false, description: 'Bearish reversal at top' },
      { id: 'cp_engulfing', name: 'Engulfing', builtin: false, description: 'Bullish or bearish engulfing' },
      { id: 'cp_morningStar', name: 'Morning Star', builtin: false, description: 'Bullish 3-candle reversal' },
      { id: 'cp_eveningStar', name: 'Evening Star', builtin: false, description: 'Bearish 3-candle reversal' },
      { id: 'cp_harami', name: 'Harami', builtin: false, description: 'Inside bar reversal' },
      { id: 'cp_threeWhiteSoldiers', name: 'Three White Soldiers', builtin: false, description: 'Strong bullish continuation' },
      { id: 'cp_threeBlackCrows', name: 'Three Black Crows', builtin: false, description: 'Strong bearish continuation' },
      { id: 'cp_spinningTop', name: 'Spinning Top', builtin: false, description: 'Indecision candle' },
      { id: 'cp_marubozu', name: 'Marubozu', builtin: false, description: 'Full-body candle' },
      { id: 'cp_piercingLine', name: 'Piercing Line', builtin: false, description: 'Bullish reversal' },
      { id: 'cp_darkCloud', name: 'Dark Cloud Cover', builtin: false, description: 'Bearish reversal' },
      { id: 'cp_tweezer', name: 'Tweezer Top/Bottom', builtin: false, description: 'Same high or low on 2 candles' },
    ],
  },
];

// ─── Financials (placeholders — these don't compute, shown for TradingView parity) ─

export const financialSections: FinancialSection[] = [
  {
    subcategory: 'incomeStatement',
    label: 'Income Statement',
    items: [
      { id: 'fin_totalRevenue', name: 'Total Revenue', builtin: false },
      { id: 'fin_grossProfit', name: 'Gross Profit', builtin: false },
      { id: 'fin_operatingIncome', name: 'Operating Income', builtin: false },
      { id: 'fin_netIncome', name: 'Net Income', builtin: false },
      { id: 'fin_ebitda', name: 'EBITDA', builtin: false },
      { id: 'fin_eps', name: 'Earnings Per Share (EPS)', builtin: false },
      { id: 'fin_costOfRevenue', name: 'Cost of Revenue', builtin: false },
      { id: 'fin_operatingExpenses', name: 'Operating Expenses', builtin: false },
      { id: 'fin_researchDev', name: 'Research & Development', builtin: false },
      { id: 'fin_interestExpense', name: 'Interest Expense', builtin: false },
    ],
  },
  {
    subcategory: 'balanceSheet',
    label: 'Balance Sheet',
    items: [
      { id: 'fin_totalAssets', name: 'Total Assets', builtin: false },
      { id: 'fin_totalLiabilities', name: 'Total Liabilities', builtin: false },
      { id: 'fin_totalEquity', name: "Total Shareholders' Equity", builtin: false },
      { id: 'fin_currentAssets', name: 'Current Assets', builtin: false },
      { id: 'fin_currentLiabilities', name: 'Current Liabilities', builtin: false },
      { id: 'fin_longTermDebt', name: 'Long-Term Debt', builtin: false },
      { id: 'fin_cashEquivalents', name: 'Cash & Equivalents', builtin: false },
      { id: 'fin_goodwill', name: 'Goodwill', builtin: false },
      { id: 'fin_inventory', name: 'Inventory', builtin: false },
      { id: 'fin_accountsReceivable', name: 'Accounts Receivable', builtin: false },
    ],
  },
  {
    subcategory: 'cashFlow',
    label: 'Cash Flow',
    items: [
      { id: 'fin_operatingCashFlow', name: 'Operating Cash Flow', builtin: false },
      { id: 'fin_capex', name: 'Capital Expenditures', builtin: false },
      { id: 'fin_freeCashFlow', name: 'Free Cash Flow', builtin: false },
      { id: 'fin_financingCashFlow', name: 'Financing Cash Flow', builtin: false },
      { id: 'fin_investingCashFlow', name: 'Investing Cash Flow', builtin: false },
      { id: 'fin_dividendsPaid', name: 'Dividends Paid', builtin: false },
      { id: 'fin_shareRepurchase', name: 'Share Repurchase', builtin: false },
    ],
  },
  {
    subcategory: 'statistics',
    label: 'Statistics',
    items: [
      { id: 'fin_peRatio', name: 'P/E Ratio', builtin: false },
      { id: 'fin_pbRatio', name: 'P/B Ratio', builtin: false },
      { id: 'fin_psRatio', name: 'P/S Ratio', builtin: false },
      { id: 'fin_evEbitda', name: 'EV/EBITDA', builtin: false },
      { id: 'fin_debtEquity', name: 'Debt/Equity', builtin: false },
      { id: 'fin_currentRatio', name: 'Current Ratio', builtin: false },
      { id: 'fin_quickRatio', name: 'Quick Ratio', builtin: false },
      { id: 'fin_roe', name: 'Return on Equity (ROE)', builtin: false },
      { id: 'fin_roa', name: 'Return on Assets (ROA)', builtin: false },
      { id: 'fin_grossMargin', name: 'Gross Margin', builtin: false },
      { id: 'fin_operatingMargin', name: 'Operating Margin', builtin: false },
      { id: 'fin_netMargin', name: 'Net Margin', builtin: false },
      { id: 'fin_beta', name: 'Beta', builtin: false },
      { id: 'fin_marketCap', name: 'Market Cap', builtin: false },
    ],
  },
  {
    subcategory: 'dividends',
    label: 'Dividends',
    items: [
      { id: 'fin_dividendYield', name: 'Dividend Yield', builtin: false },
      { id: 'fin_dividendPerShare', name: 'Dividend Per Share', builtin: false },
      { id: 'fin_payoutRatio', name: 'Payout Ratio', builtin: false },
      { id: 'fin_exDividendDate', name: 'Ex-Dividend Date', builtin: false },
    ],
  },
];

// ─── Community (placeholder scripts for TradingView parity) ────────────────

export const communitySections: CommunitySection[] = [
  {
    subcategory: 'editorsPicks',
    label: "Editors' Picks",
    items: [
      { id: 'cm_tpHeatmap', name: 'TP Heatmap', builtin: false, description: 'Take-profit target heatmap overlay' },
      { id: 'cm_smartMoney', name: 'Smart Money Concepts', builtin: false, description: 'Order blocks, FVG, BOS' },
      { id: 'cm_vwapBands', name: 'VWAP Bands', builtin: false, description: 'Standard deviation bands around VWAP' },
      { id: 'cm_supplyDemand', name: 'Supply & Demand Zones', builtin: false, description: 'Auto-detect supply/demand areas' },
      { id: 'cm_lutBot', name: 'LuxAlgo Smart Money', builtin: false, description: 'Community smart-money suite' },
      { id: 'cm_trendlines', name: 'Auto Trendlines', builtin: false, description: 'Algorithmically drawn trendlines' },
    ],
  },
  {
    subcategory: 'topScripts',
    label: 'Top Scripts',
    items: [
      { id: 'cm_halfTrend', name: 'HalfTrend', builtin: false, description: 'Trend-following signals' },
      { id: 'cm_superTrendPro', name: 'Supertrend Pro', builtin: false, description: 'Enhanced supertrend' },
      { id: 'cm_bbStoch', name: 'BB + Stoch Strategy', builtin: false, description: 'Combined BB and Stochastic' },
      { id: 'cm_volumeProfile', name: 'Volume Profile', builtin: false, description: 'Horizontal volume distribution' },
      { id: 'cm_rangeFilter', name: 'Range Filter', builtin: false, description: 'Volatility-based trend filter' },
      { id: 'cm_pivotBoss', name: 'Pivot Boss', builtin: false, description: 'Advanced pivot point system' },
    ],
  },
  {
    subcategory: 'trending',
    label: 'Trending',
    items: [
      { id: 'cm_aiMA', name: 'AI Moving Average', builtin: false, description: 'ML-based adaptive MA' },
      { id: 'cm_liquidation', name: 'Liquidation Levels', builtin: false, description: 'Estimated liquidation heatmap' },
      { id: 'cm_orderBlock', name: 'Order Block Finder', builtin: false, description: 'Institutional order flow' },
      { id: 'cm_divergence', name: 'RSI Divergence Detector', builtin: false, description: 'Auto bullish/bearish divergence' },
      { id: 'cm_fairValue', name: 'Fair Value Gaps', builtin: false, description: 'Imbalance / FVG highlighter' },
      { id: 'cm_sessions', name: 'Market Sessions', builtin: false, description: 'London, NY, Tokyo session boxes' },
    ],
  },
];

// ─── Sidebar structure ──────────────────────────────────────────────────────

export type SidebarSection = 'personal' | 'technicals' | 'financials' | 'community';

export interface SidebarItem {
  id: string;
  label: string;
  section: SidebarSection;
}

export const sidebarItems: SidebarItem[] = [
  { id: 'myScripts', label: 'My Scripts', section: 'personal' },
  { id: 'inviteOnly', label: 'Invite-Only', section: 'personal' },
  { id: 'technicals', label: 'Technicals', section: 'technicals' },
  { id: 'financials', label: 'Financials', section: 'financials' },
  { id: 'editorsPicks', label: "Editors' Picks", section: 'community' },
  { id: 'topScripts', label: 'Top Scripts', section: 'community' },
  { id: 'trending', label: 'Trending', section: 'community' },
];

// ─── Flat lookup ────────────────────────────────────────────────────────────

const _allCatalogEntries: CatalogEntry[] = [
  ...technicalSections.flatMap((s) => s.items),
  ...financialSections.flatMap((s) => s.items),
  ...communitySections.flatMap((s) => s.items),
];

// Deduplicate by id (awesome appears in both oscillators & momentum)
const _seen = new Set<string>();
export const allCatalogEntries: CatalogEntry[] = [];
for (const entry of _allCatalogEntries) {
  if (!_seen.has(entry.id)) {
    _seen.add(entry.id);
    allCatalogEntries.push(entry);
  }
}

export const catalogById = new Map(allCatalogEntries.map((e) => [e.id, e]));
