import { produce } from "../kafka/producer";
import {
  KAFKA_TOPICS,
  TradeExecutePayload,
  TradeResultPayload,
  PortfolioUpdatePayload,
  SimulationEventPayload,
  UserActivityPayload,
  SymbolLogoEnrichedPayload,
  AlertFiredPayload,
  SymbolIngestPayload,
  LogoResolvePayload,
  LogoRetryPayload,
  LogoCompletedPayload,
  AssetCreatedPayload,
  AssetUpdatedPayload,
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

// --- Alert Events ---

export function produceAlertFired(payload: AlertFiredPayload): void {
  produce(KAFKA_TOPICS.ALERT_FIRED, payload, payload.alertId);
}

// --- Scaling Pipeline Events ---

export function produceSymbolIngest(payload: SymbolIngestPayload): void {
  produce(KAFKA_TOPICS.SYMBOL_INGEST, payload, payload.fullSymbol);
}

export function produceLogoResolve(payload: LogoResolvePayload): void {
  produce(KAFKA_TOPICS.LOGO_RESOLVE, payload, payload.fullSymbol);
}

export function produceLogoRetry(payload: LogoRetryPayload): void {
  produce(KAFKA_TOPICS.LOGO_RETRY, payload, payload.fullSymbol);
}

export function produceLogoCompleted(payload: LogoCompletedPayload): void {
  produce(KAFKA_TOPICS.LOGO_COMPLETED, payload, payload.fullSymbol);
}

// --- Asset Lifecycle Events ---

export function produceAssetCreated(payload: AssetCreatedPayload): void {
  produce(KAFKA_TOPICS.ASSET_CREATED, payload, payload.fullSymbol);
}

export function produceAssetUpdated(payload: AssetUpdatedPayload): void {
  produce(KAFKA_TOPICS.ASSET_UPDATED, payload, payload.fullSymbol);
}
