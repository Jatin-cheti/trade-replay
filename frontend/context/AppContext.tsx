import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CandleData, scenarios } from '@/data/stockData';
import { api, getApiErrorCode, getApiErrorMessage, setApiToken } from '@/lib/api';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  total: number;
  date: string;
  realizedPnl?: number;
  timestamp: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY';

interface ActionResult {
  ok: boolean;
  message?: string;
  code?: string;
}

const FX_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 151.2,
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
};

interface AppState {
  isAuthenticated: boolean;
  username: string;
  token: string | null;
  currency: Currency;
  balance: number;
  holdings: Holding[];
  trades: Trade[];
  scenarioId: string;
  selectedStock: string;
  candles: CandleData[];
  allStockCandles: Record<string, CandleData[]>;
  startDate: string;
  endDate: string;
  totalCandles: number;
  dataSource: 'alpha-vantage' | 'fallback' | 'yahoo-intraday' | null;
  activePortfolioId: string | null;
  isInitializingSimulation: boolean;
  currentCandleIndex: number;
  isPlaying: boolean;
  playSpeed: number;
  login: (email: string, password: string, isSignup?: boolean) => Promise<ActionResult>;
  googleLogin: (idToken: string) => Promise<ActionResult>;
  logout: () => void;
  setCurrency: (c: Currency) => void;
  setActivePortfolioId: (id: string | null) => void;
  setScenarioId: (id: string) => void;
  setSelectedStock: (s: string) => void;
  setCurrentCandleIndex: (i: number) => Promise<void>;
  setIsPlaying: (p: boolean) => void;
  setPlaySpeed: (s: number) => Promise<void>;
  executeTrade: (type: 'BUY' | 'SELL', symbol: string, price: number, quantity: number, date: string) => Promise<ActionResult>;
  initializeSimulation: (input?: { portfolioId?: string; scenarioId?: string; symbol?: string; dataMode?: 'default' | 'parity-live' }) => Promise<void>;
  stepForward: () => Promise<void>;
  stepBackward: () => Promise<void>;
  importPortfolioCsv: (file: File) => Promise<ActionResult>;
  setDateRange: (start: string, end: string) => void;
  formatCurrency: (amount: number) => string;
  getPortfolioValue: (candles: Record<string, CandleData[]>, index: number) => number;
  resetPortfolio: () => void;
}

const AppContext = createContext<AppState | null>(null);

const INITIAL_BALANCE = 100000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sim_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(token));
  const [username, setUsername] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [selectedStock, setSelectedStock] = useState(scenarios[0].stocks[0].symbol);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [allStockCandles, setAllStockCandles] = useState<Record<string, CandleData[]>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalCandles, setTotalCandles] = useState(0);
  const [dataSource, setDataSource] = useState<'alpha-vantage' | 'fallback' | 'yahoo-intraday' | null>(null);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [isInitializingSimulation, setIsInitializingSimulation] = useState(false);
  const [currentCandleIndex, setCurrentCandleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [simulationDataMode, setSimulationDataMode] = useState<'default' | 'parity-live'>('default');
  const [socketReady, setSocketReady] = useState(false);
  const [appReady, setAppReady] = useState(false);

  const hydrateAuth = useCallback((nextToken: string, email: string, name?: string) => {
    setToken(nextToken);
    localStorage.setItem('sim_token', nextToken);
    setApiToken(nextToken);
    setIsAuthenticated(true);
    setUsername(name ?? email.split('@')[0]);
  }, []);

  useEffect(() => {
    if (!token) {
      setApiToken(null);
      disconnectSocket();
      setSocketReady(false);
      setAppReady(false);
      return;
    }

    setApiToken(token);
    const socket = connectSocket(token);
    setSocketReady(false);

    const forceReadyTimeout = window.setTimeout(() => {
      setAppReady(true);
      setSocketReady(true);
    }, 3000);

    const onConnect = () => {
      console.log("Socket connected");
      setAppReady(true);
    };

    const onReady = () => {
      setSocketReady(true);
      setAppReady(true);
    };

    const onConnectError = (err: unknown) => {
      console.error("Socket error:", err);
      setSocketReady(true);
      setAppReady(true);
    };

    socket.on('connect', onConnect);
    socket.on('ready', onReady);
    socket.on('connect_error', onConnectError);

    socket.on('candle:update', (payload) => {
      setCurrentCandleIndex(payload.currentIndex);
      setIsPlaying(payload.isPlaying);
      setPlaySpeed(payload.playSpeed);
    });

    socket.on('portfolio:update', (payload) => {
      setBalance(payload.balance);
      setHoldings(payload.holdings ?? []);
      setCurrency(payload.currency ?? 'USD');
    });

    socket.on('trade:executed', (payload) => {
      setTrades((prev) => [payload, ...prev]);
    });

    return () => {
      window.clearTimeout(forceReadyTimeout);
      const active = getSocket();
      active?.off('connect', onConnect);
      active?.off('ready', onReady);
      active?.off('connect_error', onConnectError);
      active?.off('candle:update');
      active?.off('portfolio:update');
      active?.off('trade:executed');
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string, isSignup = false) => {
    try {
      if (isSignup) {
        try {
          const registerResponse = await api.post('/auth/register', { email, password, name: email.split('@')[0] });
          hydrateAuth(registerResponse.data.token, registerResponse.data.user.email, registerResponse.data.user.name);
          return { ok: true };
        } catch (_registerError) {
          const loginResponse = await api.post('/auth/login', { email, password });
          hydrateAuth(loginResponse.data.token, loginResponse.data.user.email, loginResponse.data.user.name);
          return { ok: true };
        }
      }

      const response = await api.post('/auth/login', { email, password });
      hydrateAuth(response.data.token, response.data.user.email, response.data.user.name);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getApiErrorMessage(error, 'Authentication failed'),
        code: getApiErrorCode(error),
      };
    }
  }, [hydrateAuth]);

  const googleLogin = useCallback(async (idToken: string) => {
    try {
      const response = await api.post('/auth/google', { idToken });
      hydrateAuth(response.data.token, response.data.user.email, response.data.user.name);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getApiErrorMessage(error, 'Google login failed'),
        code: getApiErrorCode(error),
      };
    }
  }, [hydrateAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('sim_token');
    setApiToken(null);
    disconnectSocket();
    setToken(null);
    setIsAuthenticated(false);
    setUsername('');
    setCandles([]);
    setAllStockCandles({});
    setSimulationDataMode('default');
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    const rate = FX_RATES[currency] ?? 1;
    const val = amount * rate;
    const symbol = CURRENCY_SYMBOL[currency] ?? '$';
    if (Math.abs(val) >= 1e6) return `${symbol}${(val / 1e6).toFixed(2)}M`;
    if (Math.abs(val) >= 1e3) return `${symbol}${(val / 1e3).toFixed(2)}K`;
    return `${symbol}${val.toFixed(2)}`;
  }, [currency]);

  const executeTrade = useCallback(async (type: 'BUY' | 'SELL', _symbol: string, _price: number, quantity: number, _date: string) => {
    try {
      const response = await api.post('/sim/trade', { type, quantity });
      setBalance(response.data.portfolio.balance);
      setHoldings(response.data.portfolio.holdings);
      setTrades((prev) => [response.data.trade, ...prev]);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getApiErrorMessage(error, 'Trade could not be executed'),
        code: getApiErrorCode(error),
      };
    }
  }, []);

  const initializeSimulation = useCallback(async (input?: { portfolioId?: string; scenarioId?: string; symbol?: string; dataMode?: 'default' | 'parity-live' }) => {
    if (!isAuthenticated) return;
    setIsInitializingSimulation(true);
    const effectiveScenario = input?.scenarioId ?? scenarioId;
    const effectiveSymbol = input?.symbol ?? selectedStock;
    const effectivePortfolioId = input?.portfolioId ?? activePortfolioId;
    const requestedDataMode = input?.dataMode;
    const effectiveDataMode = requestedDataMode ?? simulationDataMode;
    if (requestedDataMode && requestedDataMode !== simulationDataMode) {
      setSimulationDataMode(requestedDataMode);
    }
    try {
      const response = await api.post('/sim/init', {
        scenarioId: effectiveScenario,
        symbol: effectiveSymbol,
        portfolioId: effectivePortfolioId ?? undefined,
        dataMode: effectiveDataMode === 'default' ? undefined : effectiveDataMode,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const nextCandles = response.data.simulation.candles ?? [];
      setCandles(nextCandles);
      setAllStockCandles((prev) => ({ ...prev, [effectiveSymbol]: nextCandles }));
      setDataSource(response.data.source);
      setTotalCandles(response.data.simulation.totalCandles);
      setCurrentCandleIndex(response.data.simulation.currentIndex);
      setIsPlaying(response.data.simulation.isPlaying);
      setPlaySpeed(response.data.simulation.playSpeed);
      setBalance(response.data.portfolio.balance);
      setCurrency(response.data.portfolio.currency);
      setHoldings(response.data.portfolio.holdings);
      setTrades(response.data.trades);
    } finally {
      setIsInitializingSimulation(false);
    }
  }, [isAuthenticated, scenarioId, selectedStock, activePortfolioId, simulationDataMode, startDate, endDate]);

  const callControl = useCallback(async (action: 'play' | 'pause' | 'step-forward' | 'step-backward', speed?: number) => {
    await api.post('/sim/control', { action, speed });
    if (action === 'play') setIsPlaying(true);
    if (action === 'pause') setIsPlaying(false);
  }, []);

  const stepForward = useCallback(async () => {
    await callControl('step-forward');
  }, [callControl]);

  const stepBackward = useCallback(async () => {
    await callControl('step-backward');
  }, [callControl]);

  const handleSetCurrentCandleIndex = useCallback(async (index: number) => {
    setCurrentCandleIndex(index);
    await api.post('/sim/seek', { index });
  }, []);

  const handleSetIsPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    void callControl(playing ? 'play' : 'pause', playSpeed);
  }, [callControl, playSpeed]);

  const handleSetPlaySpeed = useCallback(async (speed: number) => {
    setPlaySpeed(speed);
    if (isPlaying) {
      await callControl('play', speed);
    }
  }, [callControl, isPlaying]);

  const handleSetCurrency = useCallback((next: Currency) => {
    setCurrency(next);
    void api.post('/sim/currency', { currency: next });
  }, []);

  const importPortfolioCsv = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/sim/portfolio/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setHoldings(response.data.holdings ?? []);
      setBalance(response.data.balance ?? INITIAL_BALANCE);
      setCurrency(response.data.currency ?? 'USD');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getApiErrorMessage(error, 'Portfolio CSV import failed'),
        code: getApiErrorCode(error),
      };
    }
  }, []);

  const setDateRange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const getPortfolioValue = useCallback((candles: Record<string, CandleData[]>, index: number) => {
    let value = balance;
    holdings.forEach(h => {
      const stockCandles = candles[h.symbol];
      if (stockCandles && stockCandles[index]) {
        value += h.quantity * stockCandles[index].close;
      }
    });
    return value;
  }, [balance, holdings]);

  const resetPortfolio = useCallback(() => {
    setBalance(INITIAL_BALANCE);
    setHoldings([]);
    setTrades([]);
    setCurrentCandleIndex(0);
    setIsPlaying(false);
    setAllStockCandles({});
    setCandles([]);
    setActivePortfolioId(null);
  }, []);

  const handleSetScenarioId = useCallback((id: string) => {
    setScenarioId(id);
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) {
      setSelectedStock(scenario.stocks[0].symbol);
    }
    resetPortfolio();
  }, [resetPortfolio]);

  useEffect(() => {
    if (isAuthenticated && appReady) {
      void initializeSimulation();
    }
  }, [isAuthenticated, appReady, initializeSimulation]);

  return (
    <AppContext.Provider value={{
      isAuthenticated, username, token, currency, balance, holdings, trades,
      scenarioId, selectedStock, candles, allStockCandles, startDate, endDate, totalCandles, dataSource,
      activePortfolioId, isInitializingSimulation,
      currentCandleIndex, isPlaying, playSpeed,
      login, googleLogin, logout, setCurrency: handleSetCurrency,
      setActivePortfolioId,
      setScenarioId: handleSetScenarioId, setSelectedStock,
      setCurrentCandleIndex: handleSetCurrentCandleIndex,
      setIsPlaying: handleSetIsPlaying,
      setPlaySpeed: handleSetPlaySpeed,
      executeTrade,
      initializeSimulation,
      stepForward,
      stepBackward,
      importPortfolioCsv,
      setDateRange,
      formatCurrency, getPortfolioValue, resetPortfolio,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
