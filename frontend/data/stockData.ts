export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  market: 'NYSE' | 'NASDAQ' | 'NSE' | 'BSE' | 'CRYPTO' | 'FOREX' | 'COMMODITIES';
  assetClass: 'stock' | 'crypto' | 'forex' | 'commodity';
  icon: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  stocks: StockInfo[];
}

export const assetClassIcons: Record<StockInfo['assetClass'], string> = {
  stock: '📈',
  crypto: '🪙',
  forex: '💱',
  commodity: '🛢️',
};

function generateCandles(
  startDate: Date,
  count: number,
  startPrice: number,
  trend: number[],
  volatility: number
): CandleData[] {
  const candles: CandleData[] = [];
  let price = startPrice;
  const date = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const trendIdx = Math.floor((i / count) * trend.length);
    const trendFactor = trend[Math.min(trendIdx, trend.length - 1)];
    const change = (Math.random() - 0.48 + trendFactor) * volatility * price;
    
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);
    
    price = close;
    if (price < 1) price = 1;

    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }

    candles.push({
      time: date.toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    date.setDate(date.getDate() + 1);
  }

  return candles;
}

// 2008 Financial Crisis data patterns
const crash2008Trend = [0.02, 0.01, 0, -0.01, -0.03, -0.05, -0.08, -0.06, -0.04, -0.03, -0.05, -0.08, -0.03, -0.01, 0.01, 0.02];
// COVID Crash 2020
const covidTrend = [0.02, 0.01, 0.01, -0.02, -0.08, -0.12, -0.06, 0.04, 0.06, 0.04, 0.03, 0.02, 0.03, 0.02, 0.01, 0.01];
// Dot-com Bubble 2000
const dotcomTrend = [0.04, 0.06, 0.08, 0.05, 0.03, 0, -0.02, -0.05, -0.08, -0.06, -0.04, -0.03, -0.02, -0.01, 0, 0.01];
const globalDiversifiedTrend = [0.01, 0.014, 0.009, 0.012, -0.004, 0.006, 0.003, 0.008, 0.005, 0.006, 0.004, 0.007];
const inflationShockTrend = [-0.005, 0.002, 0.007, -0.01, 0.003, 0.012, -0.008, 0.006, 0.001, 0.004, -0.002, 0.005];

export const scenarios: Scenario[] = [
  {
    id: '2008-crash',
    name: '2008 Financial Crisis',
    description: 'The Great Recession — housing bubble burst and global financial meltdown',
    startDate: '2007-10-01',
    endDate: '2009-03-31',
    stocks: [
      { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'Index', market: 'NYSE', assetClass: 'stock', icon: '📊' },
      { symbol: 'BAC', name: 'Bank of America', sector: 'Finance', market: 'NYSE', assetClass: 'stock', icon: '🏦' },
      { symbol: 'GS', name: 'Goldman Sachs', sector: 'Finance', market: 'NYSE', assetClass: 'stock', icon: '💼' },
      { symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology', market: 'NASDAQ', assetClass: 'stock', icon: '🍎' },
      { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', market: 'NYSE', assetClass: 'stock', icon: '🛢️' },
    ],
  },
  {
    id: 'covid-2020',
    name: 'COVID-19 Crash',
    description: 'Pandemic-driven market crash and rapid recovery',
    startDate: '2020-01-02',
    endDate: '2020-12-31',
    stocks: [
      { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'Index', market: 'NYSE', assetClass: 'stock', icon: '📊' },
      { symbol: 'AAPL', name: 'Apple Inc', sector: 'Technology', market: 'NASDAQ', assetClass: 'stock', icon: '🍎' },
      { symbol: 'AMZN', name: 'Amazon', sector: 'Technology', market: 'NASDAQ', assetClass: 'stock', icon: '📦' },
      { symbol: 'ZM', name: 'Zoom Video', sector: 'Technology', market: 'NASDAQ', assetClass: 'stock', icon: '🎥' },
      { symbol: 'AAL', name: 'American Airlines', sector: 'Airlines', market: 'NASDAQ', assetClass: 'stock', icon: '✈️' },
    ],
  },
  {
    id: 'dotcom-2000',
    name: 'Dot-com Bubble',
    description: 'The internet bubble burst — tech stocks collapse',
    startDate: '1999-06-01',
    endDate: '2001-06-30',
    stocks: [
      { symbol: 'QQQ', name: 'Nasdaq 100 ETF', sector: 'Index', market: 'NASDAQ', assetClass: 'stock', icon: '📈' },
      { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', market: 'NASDAQ', assetClass: 'stock', icon: '🪟' },
      { symbol: 'CSCO', name: 'Cisco Systems', sector: 'Technology', market: 'NASDAQ', assetClass: 'stock', icon: '🌐' },
      { symbol: 'INTC', name: 'Intel Corp', sector: 'Technology', market: 'NASDAQ', assetClass: 'stock', icon: '💻' },
      { symbol: 'ORCL', name: 'Oracle Corp', sector: 'Technology', market: 'NYSE', assetClass: 'stock', icon: '🗄️' },
    ],
  },
  {
    id: 'global-diversified-2023',
    name: 'Global Diversified 2023',
    description: 'Cross-market replay with US, India, crypto, forex, and commodities',
    startDate: '2023-01-02',
    endDate: '2023-12-29',
    stocks: [
      { symbol: 'NVDA', name: 'NVIDIA', sector: 'US Stocks', market: 'NASDAQ', assetClass: 'stock', icon: '🧠' },
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Indian Stocks', market: 'NSE', assetClass: 'stock', icon: '🇮🇳' },
      { symbol: 'BTCUSD', name: 'Bitcoin', sector: 'Crypto', market: 'CRYPTO', assetClass: 'crypto', icon: '₿' },
      { symbol: 'EURUSD', name: 'Euro / US Dollar', sector: 'Forex', market: 'FOREX', assetClass: 'forex', icon: '💶' },
      { symbol: 'XAUUSD', name: 'Gold Spot', sector: 'Commodities', market: 'COMMODITIES', assetClass: 'commodity', icon: '🥇' },
    ],
  },
  {
    id: 'inflation-cycle-2022',
    name: 'Inflation Shock 2022',
    description: 'Rate-hike era with commodities and currency swings',
    startDate: '2022-01-03',
    endDate: '2022-12-30',
    stocks: [
      { symbol: 'QQQ', name: 'Nasdaq 100 ETF', sector: 'US Stocks', market: 'NASDAQ', assetClass: 'stock', icon: '📈' },
      { symbol: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'Indian Stocks', market: 'NSE', assetClass: 'stock', icon: '🏢' },
      { symbol: 'ETHUSD', name: 'Ethereum', sector: 'Crypto', market: 'CRYPTO', assetClass: 'crypto', icon: 'Ξ' },
      { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', sector: 'Forex', market: 'FOREX', assetClass: 'forex', icon: '💴' },
      { symbol: 'CL=F', name: 'Crude Oil Futures', sector: 'Commodities', market: 'COMMODITIES', assetClass: 'commodity', icon: '🛢️' },
    ],
  },
];

const stockInfoMap = scenarios.reduce<Record<string, StockInfo>>((acc, scenario) => {
  scenario.stocks.forEach((stock) => {
    acc[stock.symbol] = stock;
  });
  return acc;
}, {});

export function getStockInfo(symbol: string): StockInfo | null {
  return stockInfoMap[symbol] ?? null;
}

// Pre-generate all data
const dataCache: Record<string, Record<string, CandleData[]>> = {};

function getStartPrice(scenarioId: string, symbol: string): number {
  const prices: Record<string, Record<string, number>> = {
    '2008-crash': { SPY: 155, BAC: 52, GS: 230, AAPL: 190, XOM: 92 },
    'covid-2020': { SPY: 323, AAPL: 300, AMZN: 1900, ZM: 70, AAL: 28 },
    'dotcom-2000': { QQQ: 90, MSFT: 90, CSCO: 55, INTC: 60, ORCL: 40 },
    'global-diversified-2023': { NVDA: 170, 'RELIANCE.NS': 2450, BTCUSD: 21000, EURUSD: 1.09, XAUUSD: 1850 },
    'inflation-cycle-2022': { QQQ: 380, 'TCS.NS': 3600, ETHUSD: 2700, USDJPY: 115, 'CL=F': 82 },
  };
  return prices[scenarioId]?.[symbol] ?? 100;
}

function getTrend(scenarioId: string): number[] {
  switch (scenarioId) {
    case '2008-crash': return crash2008Trend;
    case 'covid-2020': return covidTrend;
    case 'dotcom-2000': return dotcomTrend;
    case 'global-diversified-2023': return globalDiversifiedTrend;
    case 'inflation-cycle-2022': return inflationShockTrend;
    default: return crash2008Trend;
  }
}

export function getStockData(scenarioId: string, symbol: string): CandleData[] {
  if (!dataCache[scenarioId]) dataCache[scenarioId] = {};
  if (!dataCache[scenarioId][symbol]) {
    const scenario = scenarios.find(s => s.id === scenarioId)!;
    const startDate = new Date(scenario.startDate);
    const startPrice = getStartPrice(scenarioId, symbol);
    const trend = getTrend(scenarioId);
    // Add per-stock variation
    const seed = symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1);
    const variation = trend.map(t => t + (Math.sin(seed) * 0.01));
    dataCache[scenarioId][symbol] = generateCandles(startDate, 250, startPrice, variation, 0.02);
  }
  return dataCache[scenarioId][symbol];
}
