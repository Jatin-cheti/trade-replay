import { createConsumer, MessageHandler } from "../consumer";
import { KAFKA_TOPICS, KafkaEvent, MarketTickPayload } from "../topics";
import { updatePriceFromTick } from "../../services/priceCache.service";
import { logger } from "../../utils/logger";

const handleMarketTick: MessageHandler = async (event: KafkaEvent) => {
  const payload = event.payload as MarketTickPayload;
  if (!payload.symbol || typeof payload.price !== "number") {
    logger.warn("market_price_tick_invalid_payload", { eventId: event.eventId });
    return;
  }

  await updatePriceFromTick({
    symbol: payload.symbol,
    price: payload.price,
    timestamp: payload.timestamp || event.timestamp,
  });
};

export async function startMarketPriceCacheProcessor(): Promise<void> {
  await createConsumer({
    groupId: "tradereplay-market-price-cache",
    topics: [KAFKA_TOPICS.MARKET_TICK],
    handler: handleMarketTick,
  });

  logger.info("kafka_market_price_cache_processor_started");
}