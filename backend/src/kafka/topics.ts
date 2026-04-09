export const KAFKA_TOPICS = {
  TRADES_EXECUTE: "trades.execute",
  TRADES_RESULT: "trades.result",
  PORTFOLIO_UPDATE: "portfolio.update",
  SIMULATION_EVENTS: "simulation.events",
  USER_ACTIVITY: "user.activity",
  SYMBOL_LOGO_ENRICHED: "symbol.logo.enriched",
  CHART_CANDLE_UPDATED: "chart.candle.updated",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export const ALL_TOPICS: KafkaTopic[] = Object.values(KAFKA_TOPICS);

export interface KafkaEvent<T = unknown> {
  eventId: string;
  topic: KafkaTopic;
  timestamp: number;
  source: string;
  payload: T;
}

// --- Event payloads ---

export interface TradeExecutePayload {
  userId: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
}

export interface TradeResultPayload {
  userId: string;
  tradeId: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  realizedPnl: number;
  success: boolean;
  error?: string;
}

export interface PortfolioUpdatePayload {
  userId: string;
  balance: number;
  holdingsCount: number;
  action: "trade" | "import" | "create" | "currency_change";
}

export interface SimulationEventPayload {
  userId: string;
  action: "init" | "play" | "pause" | "seek" | "step" | "trade";
  scenarioId?: string;
  symbol?: string;
  currentIndex?: number;
  totalCandles?: number;
}

export interface UserActivityPayload {
  userId: string;
  action: "login" | "register" | "google_login" | "session_start";
  ip?: string;
  userAgent?: string;
}

export interface SymbolLogoEnrichedPayload {
  fullSymbol: string;
  symbol: string;
  domain?: string;
  logoUrl: string;
  source: "cdn" | "remote";
}

export interface ChartCandleUpdatedPayload {
  symbol: string;
  timeframe: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
