export const KAFKA_TOPICS = {
  TRADES_EXECUTE: "trades.execute",
  TRADES_RESULT: "trades.result",
  PORTFOLIO_UPDATE: "portfolio.update",
  SIMULATION_EVENTS: "simulation.events",
  USER_ACTIVITY: "user.activity",
  SYMBOL_LOGO_ENRICHED: "symbol.logo.enriched",
  MARKET_TICK: "market.tick",
  ALERT_FIRED: "alert.fired",
  // ── Scaling pipeline topics ────────────────────────────────────────
  SYMBOL_INGEST: "symbol.ingest",
  LOGO_RESOLVE: "logo.resolve",
  LOGO_RETRY: "logo.retry",
  LOGO_COMPLETED: "logo.completed",
  // ── Asset + Logo lifecycle events ──────────────────────────────────
  ASSET_CREATED: "asset.created",
  ASSET_UPDATED: "asset.updated",
  LOGO_MAPPED: "logo.mapped",
  // ── Search behaviour events ────────────────────────────────────────
  SEARCH_CLICK: "search.click",
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

export interface MarketTickPayload {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface AlertFiredPayload {
  alertId: string;
  userId: string;
  symbol: string;
  triggeredPrice: number;
  timestamp: number;
}

// ── Scaling pipeline payloads ────────────────────────────────────────

export interface SymbolIngestPayload {
  fullSymbol: string;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  source: string;
}

export interface LogoResolvePayload {
  fullSymbol: string;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  strategy: string;
  retryCount: number;
}

export interface LogoRetryPayload {
  fullSymbol: string;
  symbol: string;
  retryCount: number;
  lastError: string;
  nextStrategy: string;
  delayMs: number;
}

export interface LogoCompletedPayload {
  fullSymbol: string;
  symbol: string;
  logoUrl: string;
  domain: string;
  source: string;
  confidence: number;
}

// ── Asset lifecycle payloads ─────────────────────────────────────────

export interface AssetCreatedPayload {
  fullSymbol: string;
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  source: string;
}

export interface AssetUpdatedPayload {
  fullSymbol: string;
  symbol: string;
  fields: string[];
  source: string;
}

// ── Search behaviour payloads ────────────────────────────────────────

export interface SearchClickPayload {
  query: string;
  symbol: string;
  exchange: string;
  position: number;
  userId?: string;
}
