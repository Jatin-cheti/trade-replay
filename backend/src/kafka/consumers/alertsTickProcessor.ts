import { createConsumer, MessageHandler } from "../consumer";
import { KAFKA_TOPICS, KafkaEvent, MarketTickPayload } from "../topics";
import { evaluateAlertsForTick, type AlertFiredEvent } from "../../services/alertsEngine.service";
import { produceAlertFired } from "../eventProducers";
import { logger } from "../../utils/logger";

/**
 * Kafka consumer for market.tick topic.
 * Evaluates alerts per tick and produces alert.fired events.
 */
const handleMarketTick: MessageHandler = async (event: KafkaEvent) => {
  const payload = event.payload as MarketTickPayload;
  if (!payload.symbol || typeof payload.price !== "number") {
    logger.warn("alerts_tick_invalid_payload", { eventId: event.eventId });
    return;
  }

  const fired: AlertFiredEvent[] = await evaluateAlertsForTick(
    payload.symbol,
    payload.price,
    payload.timestamp || event.timestamp,
  );

  // produce alert.fired events to Kafka
  for (const alert of fired) {
    produceAlertFired({
      alertId: alert.alertId,
      userId: alert.userId,
      symbol: alert.symbol,
      triggeredPrice: alert.triggeredPrice,
      timestamp: alert.timestamp,
    });
  }

  if (fired.length > 0) {
    logger.info("alerts_tick_processed", {
      symbol: payload.symbol,
      price: payload.price,
      alertsFired: fired.length,
    });
  }
};

export async function startAlertsTickProcessor(): Promise<void> {
  await createConsumer({
    groupId: "tradereplay-alerts-tick",
    topics: [KAFKA_TOPICS.MARKET_TICK],
    handler: handleMarketTick,
  });
  logger.info("kafka_alerts_tick_processor_started");
}
