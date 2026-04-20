/**
 * Stub indicator definitions for catalog items that require external data
 * sources (financial statements, blockchain metrics, community scripts).
 *
 * Each stub registers with the engine so it can be toggled on/off in the
 * Indicators Modal without errors.  The compute function returns all-null
 * series — identical to TradingView's behaviour when the data feed for a
 * metric is unavailable.
 */

import type { IndicatorDefinition, IndicatorResult } from '../types.ts';
import { nulls } from './_helpers.ts';

function stub(id: string, name: string, pane: 'overlay' | 'subpane' = 'subpane', color = '#64748b'): IndicatorDefinition {
  return {
    id,
    name,
    inputs: [],
    outputs: [{ name: 'value', seriesType: 'Line', pane, color, lineWidth: 1 }],
    compute({ close }): IndicatorResult {
      return { outputs: [nulls(close.length)] };
    },
  };
}

/* ── Breadth Indicators ──────────────────────────────────────────────── */

export const advDeclineDef       = stub('advDecline',       'Advance/Decline Line');
export const mcclellanDef        = stub('mcclellan',        'McClellan Oscillator');
export const mcclellanSumDef     = stub('mcclellanSum',     'McClellan Summation');
export const newHighLowDef       = stub('newHighLow',       'New High / New Low');
export const upDownVolumeDef     = stub('upDownVolume',     'Up/Down Volume');

/* ── Financials — Income Statement ──────────────────────────────────── */

export const finTotalRevenueDef      = stub('fin_totalRevenue',      'Total Revenue');
export const finGrossProfitDef       = stub('fin_grossProfit',       'Gross Profit');
export const finOperatingIncomeDef   = stub('fin_operatingIncome',   'Operating Income');
export const finNetIncomeDef         = stub('fin_netIncome',         'Net Income');
export const finEbitdaDef            = stub('fin_ebitda',            'EBITDA');
export const finEpsDef               = stub('fin_eps',               'Earnings Per Share');
export const finCostOfRevenueDef     = stub('fin_costOfRevenue',     'Cost of Revenue');
export const finOperatingExpensesDef = stub('fin_operatingExpenses', 'Operating Expenses');
export const finResearchDevDef       = stub('fin_researchDev',       'Research & Development');
export const finInterestExpenseDef   = stub('fin_interestExpense',   'Interest Expense');

/* ── Financials — Balance Sheet ─────────────────────────────────────── */

export const finTotalAssetsDef        = stub('fin_totalAssets',        'Total Assets');
export const finTotalLiabilitiesDef   = stub('fin_totalLiabilities',   'Total Liabilities');
export const finTotalEquityDef        = stub('fin_totalEquity',        "Total Shareholders' Equity");
export const finCurrentAssetsDef      = stub('fin_currentAssets',      'Current Assets');
export const finCurrentLiabilitiesDef = stub('fin_currentLiabilities', 'Current Liabilities');
export const finLongTermDebtDef       = stub('fin_longTermDebt',       'Long-Term Debt');
export const finCashEquivalentsDef    = stub('fin_cashEquivalents',    'Cash & Equivalents');
export const finGoodwillDef           = stub('fin_goodwill',           'Goodwill');
export const finInventoryDef          = stub('fin_inventory',          'Inventory');
export const finAccountsReceivableDef = stub('fin_accountsReceivable', 'Accounts Receivable');

/* ── Financials — Cash Flow ─────────────────────────────────────────── */

export const finOperatingCashFlowDef  = stub('fin_operatingCashFlow',  'Operating Cash Flow');
export const finCapexDef              = stub('fin_capex',              'Capital Expenditures');
export const finFreeCashFlowDef       = stub('fin_freeCashFlow',       'Free Cash Flow');
export const finFinancingCashFlowDef  = stub('fin_financingCashFlow',  'Financing Cash Flow');
export const finInvestingCashFlowDef  = stub('fin_investingCashFlow',  'Investing Cash Flow');
export const finDividendsPaidDef      = stub('fin_dividendsPaid',      'Dividends Paid');
export const finShareRepurchaseDef    = stub('fin_shareRepurchase',    'Share Repurchase');

/* ── Financials — Statistics ────────────────────────────────────────── */

export const finPeRatioDef        = stub('fin_peRatio',        'P/E Ratio');
export const finPbRatioDef        = stub('fin_pbRatio',        'P/B Ratio');
export const finPsRatioDef        = stub('fin_psRatio',        'P/S Ratio');
export const finEvEbitdaDef       = stub('fin_evEbitda',       'EV/EBITDA');
export const finDebtEquityDef     = stub('fin_debtEquity',     'Debt/Equity');
export const finCurrentRatioDef   = stub('fin_currentRatio',   'Current Ratio');
export const finQuickRatioDef     = stub('fin_quickRatio',     'Quick Ratio');
export const finRoeDef            = stub('fin_roe',            'Return on Equity');
export const finRoaDef            = stub('fin_roa',            'Return on Assets');
export const finGrossMarginDef    = stub('fin_grossMargin',    'Gross Margin');
export const finOperatingMarginDef = stub('fin_operatingMargin', 'Operating Margin');
export const finNetMarginDef      = stub('fin_netMargin',      'Net Margin');
export const finBetaDef           = stub('fin_beta',           'Beta');
export const finMarketCapDef      = stub('fin_marketCap',      'Market Cap');

/* ── Financials — Dividends ─────────────────────────────────────────── */

export const finDividendYieldDef    = stub('fin_dividendYield',    'Dividend Yield');
export const finDividendPerShareDef = stub('fin_dividendPerShare', 'Dividend Per Share');
export const finPayoutRatioDef      = stub('fin_payoutRatio',      'Payout Ratio');
export const finExDividendDateDef   = stub('fin_exDividendDate',   'Ex-Dividend Date');

/* ── Fundamentals — Financials Tab ──────────────────────────────────── */

export const fundRvtRatioDef            = stub('fund_rvtRatio',            'RVT Ratio');
export const fundRealizedMarketCapDef   = stub('fund_realizedMarketCap',   'Realized Market Cap');
export const fundSupplyEqualityRatioDef = stub('fund_supplyEqualityRatio', 'Supply Equality Ratio');
export const fund1yrActiveSupplyDef     = stub('fund_1yrActiveSupply',     '1 Year Active Supply %');

/* ── Fundamentals — Network ─────────────────────────────────────────── */

export const fundAddressesWithBalanceDef = stub('fund_addressesWithBalance', 'Addresses With Balance');
export const fundNewFundedAddressesDef   = stub('fund_newFundedAddresses',   'New Funded Addresses');
export const fundActiveAddressesDef      = stub('fund_activeAddresses',      'Active Addresses');
export const fundTxVolumeUsdDef          = stub('fund_txVolumeUsd',          'Transaction Volume USD');
export const fundTxVolumeDef             = stub('fund_txVolume',             'Transaction Volume');
export const fundAvgTxVolumeUsdDef       = stub('fund_avgTxVolumeUsd',       'Avg Transaction Volume USD');
export const fundAvgTxVolumeDef          = stub('fund_avgTxVolume',          'Avg Transaction Volume');
export const fundTxCountDef              = stub('fund_txCount',              'Transaction Count');
export const fundLargeTxCountDef         = stub('fund_largeTxCount',         'Large Transaction Count');
export const fundLargeTxVolumeUsdDef     = stub('fund_largeTxVolumeUsd',     'Large Transaction Volume USD');
export const fundLargeTxVolumeDef        = stub('fund_largeTxVolume',        'Large Transaction Volume');
export const fundTotalValueLockedDef     = stub('fund_totalValueLocked',     'Total Value Locked');
export const fundTxFeesUsdDef            = stub('fund_txFeesUsd',            'Transaction Fees USD');
export const fundBlockCountDef           = stub('fund_blockCount',           'Block Count');
export const fundBlockSizeMbDef          = stub('fund_blockSizeMb',          'Block Size MB');
export const fundHashRateDef             = stub('fund_hashRate',             'Hash Rate');
export const fundMinerRevenueUsdDef      = stub('fund_minerRevenueUsd',      'Miner Revenue USD');
export const fundAvgTxFeeUsdDef          = stub('fund_avgTxFeeUsd',          'Avg Transaction Fee USD');
export const fundTxPerBlockDef           = stub('fund_txPerBlock',           'Transactions Per Block');
export const fundDifficultyDef           = stub('fund_difficulty',           'Difficulty');
export const fundMempoolSizeDef          = stub('fund_mempoolSize',          'Mempool Size');
export const fundMempoolTxCountDef       = stub('fund_mempoolTxCount',       'Mempool Transaction Count');
export const fundIssuanceDef             = stub('fund_issuance',             'Issuance');

/* ── Fundamentals — Ownership ───────────────────────────────────────── */

export const fundHeldTokensUsdDef    = stub('fund_heldTokensUsd',    'Held Tokens USD');
export const fundHeldTokensDef       = stub('fund_heldTokens',       'Held Tokens');
export const fundHeldTokensSupplyDef = stub('fund_heldTokensSupply', 'Held Tokens % of Supply');
export const fundAddrBalanceUsdDef   = stub('fund_addrBalanceUsd',   'Addresses With Balance USD');
export const fundAddrBalanceSupplyDef = stub('fund_addrBalanceSupply', 'Addresses With Balance % of Supply');
export const fundEtfBalancesUsdDef   = stub('fund_etfBalancesUsd',   'ETF Balances USD');
export const fundEtfBalancesDef      = stub('fund_etfBalances',      'ETF Balances');
export const fundEtfFlowsUsdDef      = stub('fund_etfFlowsUsd',     'ETF Flows USD');
export const fundEtfFlowsDef         = stub('fund_etfFlows',         'ETF Flows');

/* ── Fundamentals — Social ──────────────────────────────────────────── */

export const fundAltRankDef             = stub('fund_altRank',             'AltRank');
export const fundGalaxyScoreDef         = stub('fund_galaxyScore',         'Galaxy Score');
export const fundSocialDominanceDef     = stub('fund_socialDominance',     'Social Dominance %');
export const fundSentimentDef           = stub('fund_sentiment',           'Sentiment %');
export const fundInteractionsDef        = stub('fund_interactions',        'Interactions');
export const fundActiveContributorsDef  = stub('fund_activeContributors',  'Active Contributors');
export const fundCreatedContributorsDef = stub('fund_createdContributors', 'Created Contributors');
export const fundActivePostsDef         = stub('fund_activePosts',         'Active Posts');
export const fundCreatedPostsDef        = stub('fund_createdPosts',        'Created Posts');

/* ── Community — Editors' Picks ─────────────────────────────────────── */

export const cmTpHeatmapDef    = stub('cm_tpHeatmap',    'TP Heatmap',            'overlay', '#f59e0b');
export const cmSmartMoneyDef   = stub('cm_smartMoney',   'Smart Money Concepts',  'overlay', '#8b5cf6');
export const cmVwapBandsDef    = stub('cm_vwapBands',    'VWAP Bands',            'overlay', '#06b6d4');
export const cmSupplyDemandDef = stub('cm_supplyDemand', 'Supply & Demand Zones', 'overlay', '#10b981');
export const cmLutBotDef       = stub('cm_lutBot',       'LuxAlgo Smart Money',   'overlay', '#ec4899');
export const cmTrendlinesDef   = stub('cm_trendlines',   'Auto Trendlines',       'overlay', '#f97316');

/* ── Community — Top Scripts ────────────────────────────────────────── */

export const cmHalfTrendDef    = stub('cm_halfTrend',    'HalfTrend',             'overlay', '#22c55e');
export const cmSuperTrendProDef = stub('cm_superTrendPro', 'Supertrend Pro',      'overlay', '#3b82f6');
export const cmBbStochDef      = stub('cm_bbStoch',      'BB + Stoch Strategy');
export const cmVolumeProfileDef = stub('cm_volumeProfile', 'Volume Profile',      'overlay', '#a78bfa');
export const cmRangeFilterDef  = stub('cm_rangeFilter',  'Range Filter',          'overlay', '#f43f5e');
export const cmPivotBossDef    = stub('cm_pivotBoss',    'Pivot Boss',            'overlay', '#eab308');

/* ── Community — Trending ───────────────────────────────────────────── */

export const cmAiMADef        = stub('cm_aiMA',        'AI Moving Average',       'overlay', '#06b6d4');
export const cmLiquidationDef = stub('cm_liquidation',  'Liquidation Levels',     'overlay', '#ef4444');
export const cmOrderBlockDef  = stub('cm_orderBlock',   'Order Block Finder',     'overlay', '#8b5cf6');
export const cmDivergenceDef  = stub('cm_divergence',   'RSI Divergence Detector');
export const cmFairValueDef   = stub('cm_fairValue',    'Fair Value Gaps',        'overlay', '#f59e0b');
export const cmSessionsDef    = stub('cm_sessions',     'Market Sessions',        'overlay', '#64748b');

/* ── Collected arrays for convenient registration ───────────────────── */

export const breadthStubs = [
  advDeclineDef, mcclellanDef, mcclellanSumDef, newHighLowDef, upDownVolumeDef,
];

export const financialStubs = [
  finTotalRevenueDef, finGrossProfitDef, finOperatingIncomeDef, finNetIncomeDef,
  finEbitdaDef, finEpsDef, finCostOfRevenueDef, finOperatingExpensesDef,
  finResearchDevDef, finInterestExpenseDef,
  finTotalAssetsDef, finTotalLiabilitiesDef, finTotalEquityDef,
  finCurrentAssetsDef, finCurrentLiabilitiesDef, finLongTermDebtDef,
  finCashEquivalentsDef, finGoodwillDef, finInventoryDef, finAccountsReceivableDef,
  finOperatingCashFlowDef, finCapexDef, finFreeCashFlowDef,
  finFinancingCashFlowDef, finInvestingCashFlowDef, finDividendsPaidDef, finShareRepurchaseDef,
  finPeRatioDef, finPbRatioDef, finPsRatioDef, finEvEbitdaDef,
  finDebtEquityDef, finCurrentRatioDef, finQuickRatioDef,
  finRoeDef, finRoaDef, finGrossMarginDef, finOperatingMarginDef,
  finNetMarginDef, finBetaDef, finMarketCapDef,
  finDividendYieldDef, finDividendPerShareDef, finPayoutRatioDef, finExDividendDateDef,
];

export const fundamentalStubs = [
  fundRvtRatioDef, fundRealizedMarketCapDef, fundSupplyEqualityRatioDef, fund1yrActiveSupplyDef,
  fundAddressesWithBalanceDef, fundNewFundedAddressesDef, fundActiveAddressesDef,
  fundTxVolumeUsdDef, fundTxVolumeDef, fundAvgTxVolumeUsdDef, fundAvgTxVolumeDef,
  fundTxCountDef, fundLargeTxCountDef, fundLargeTxVolumeUsdDef, fundLargeTxVolumeDef,
  fundTotalValueLockedDef, fundTxFeesUsdDef, fundBlockCountDef, fundBlockSizeMbDef,
  fundHashRateDef, fundMinerRevenueUsdDef, fundAvgTxFeeUsdDef, fundTxPerBlockDef,
  fundDifficultyDef, fundMempoolSizeDef, fundMempoolTxCountDef, fundIssuanceDef,
  fundHeldTokensUsdDef, fundHeldTokensDef, fundHeldTokensSupplyDef,
  fundAddrBalanceUsdDef, fundAddrBalanceSupplyDef,
  fundEtfBalancesUsdDef, fundEtfBalancesDef, fundEtfFlowsUsdDef, fundEtfFlowsDef,
  fundAltRankDef, fundGalaxyScoreDef, fundSocialDominanceDef, fundSentimentDef,
  fundInteractionsDef, fundActiveContributorsDef, fundCreatedContributorsDef,
  fundActivePostsDef, fundCreatedPostsDef,
];

export const communityStubs = [
  cmTpHeatmapDef, cmSmartMoneyDef, cmVwapBandsDef, cmSupplyDemandDef, cmLutBotDef, cmTrendlinesDef,
  cmHalfTrendDef, cmSuperTrendProDef, cmBbStochDef, cmVolumeProfileDef, cmRangeFilterDef, cmPivotBossDef,
  cmAiMADef, cmLiquidationDef, cmOrderBlockDef, cmDivergenceDef, cmFairValueDef, cmSessionsDef,
];

/** All stub definitions in a single flat array */
export const allStubs = [
  ...breadthStubs,
  ...financialStubs,
  ...fundamentalStubs,
  ...communityStubs,
];
