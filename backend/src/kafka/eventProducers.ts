import { produce } from "../kafka/producer";
import {
  KAFKA_TOPICS,
  TradeExecutePayload,
  TradeResultPayload,
  PortfolioUpdatePayload,
  SimulationEventPayload,
  UserActivityPayload,
  SymbolLogoEnrichedPayload,
  ChartCandleUpdatedPayload,
} from "../kafka/topics";

// --- Trade Events ---

export function produceTradeExecute(payload: TradeExecutePayload): void {
  produce(KAFKA_TOPICS.TRADES_EXECUTE, payload, payload.userId);
}

export function produceTradeResult(payload: TradeResultPayload): void {
  produce(KAFKA_TOPICS.TRADES_RESULT, payload, payload.userId);
}

// --- Portfolio Events ---

export function producePortfolioUpdate(payload: PortfolioUpdatePayload): void {
  produce(KAFKA_TOPICS.PORTFOLIO_UPDATE, payload, payload.userId);
}

// --- Simulation Events ---

export function produceSimulationEvent(payload: SimulationEventPayload): void {
  produce(KAFKA_TOPICS.SIMULATION_EVENTS, payload, payload.userId);
}

// --- User Activity ---

export function produceUserActivity(payload: UserActivityPayload): void {
  produce(KAFKA_TOPICS.USER_ACTIVITY, payload, payload.userId);
}

// --- Symbol Events ---

export function produceSymbolLogoEnriched(payload: SymbolLogoEnrichedPayload): void {
  produce(KAFKA_TOPICS.SYMBOL_LOGO_ENRICHED, payload, payload.fullSymbol);
}

export function produceChartCandleUpdated(payload: ChartCandleUpdatedPayload): void {
  produce(KAFKA_TOPICS.CHART_CANDLE_UPDATED, payload, `${payload.symbol}:${payload.timeframe}:${payload.time}`);
}
