import kafkajs, { Consumer, Kafka, logLevel, type Producer, type SASLOptions } from "kafkajs";
import SnappyCodec from "kafkajs-snappy";
import crypto from "node:crypto";
import { env } from "./env";
import { applyTrade, updatePrice } from "../services/portfolioEngine.service";
import { redisClient } from "./redis";

kafkajs.CompressionCodecs[kafkajs.CompressionTypes.Snappy] = SnappyCodec;

type TradeEventPayload = {
  eventId?: string;
  payload?: {
    userId?: string;
    symbol?: string;
    type?: "BUY" | "SELL";
    quantity?: number;
    price?: number;
    scope?: "simulation" | "live";
    timestamp?: number;
  };
};

type MarketTickEventPayload = {
  eventId?: string;
  payload?: {
    symbol?: string;
    price?: number;
    timestamp?: number;
  };
};

const EVENT_LOCK_TTL_SECONDS = 24 * 60 * 60;

let producer: Producer | null = null;
let consumer: Consumer | null = null;

function getSasl(): SASLOptions | undefined {
  if (!env.KAFKA_SASL_USERNAME || !env.KAFKA_SASL_PASSWORD) return undefined;

  return {
    mechanism: "plain",
    username: env.KAFKA_SASL_USERNAME,
    password: env.KAFKA_SASL_PASSWORD,
  };
}

const kafka = new Kafka({
  clientId: "portfolio-service",
  brokers: env.KAFKA_BROKERS.split(",").map((value) => value.trim()).filter(Boolean),
  logLevel: logLevel.NOTHING,
  ssl: Boolean(getSasl()),
  sasl: getSasl(),
});

async function acquireEventLock(topic: string, eventId: string): Promise<boolean> {
  const lockKey = `portfolio-service:processed:${topic}:${eventId}`;
  const lockResult = await redisClient.set(lockKey, "1", "EX", EVENT_LOCK_TTL_SECONDS, "NX");
  return lockResult === "OK";
}

export async function connectKafka(): Promise<void> {
  if (!env.KAFKA_ENABLED) return;

  producer = kafka.producer();
  await producer.connect();

  consumer = kafka.consumer({ groupId: "portfolio-service-consumer" });
  await consumer.connect();
  await consumer.subscribe({ topic: "trades.result", fromBeginning: false });
  await consumer.subscribe({ topic: "market.tick", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const raw = message.value?.toString();
      if (!raw) return;

      try {
        const fallbackEventId = `${partition}:${message.offset}`;
        if (topic === "trades.result") {
          const parsed = JSON.parse(raw) as TradeEventPayload;
          const eventId = parsed.eventId ?? fallbackEventId;
          const acquired = await acquireEventLock(topic, eventId);
          if (!acquired) {
            return;
          }

          const payload = parsed.payload;
          if (!payload?.userId || !payload.symbol || !payload.type) {
            return;
          }

          if (payload.scope === "simulation") {
            return;
          }

          const quantity = payload.quantity;
          const price = payload.price;

          if (typeof quantity !== "number" || typeof price !== "number") {
            return;
          }

          if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
            return;
          }

          const tradeResult = await applyTrade({
            userId: payload.userId,
            symbol: payload.symbol,
            type: payload.type,
            quantity,
            price,
            source: "kafka",
            eventId,
            occurredAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
          });

          await emitPortfolioSnapshot({
            userId: payload.userId,
            totalValue: tradeResult.snapshot.totalValue,
            realizedPnl: tradeResult.snapshot.realizedPnl,
            unrealizedPnl: tradeResult.snapshot.unrealizedPnl,
            timestamp: Date.now(),
          });
        }

        if (topic === "market.tick") {
          const parsed = JSON.parse(raw) as MarketTickEventPayload;
          const eventId = parsed.eventId ?? fallbackEventId;
          const acquired = await acquireEventLock(topic, eventId);
          if (!acquired) {
            return;
          }

          const payload = parsed.payload;
          if (!payload?.symbol) return;
          const price = payload.price;
          if (typeof price !== "number") return;
          if (!Number.isFinite(price) || price <= 0) return;
          const updates = await updatePrice(payload.symbol, price);

          for (const update of updates) {
            await emitPortfolioSnapshot({
              userId: update.userId,
              totalValue: update.snapshot.totalValue,
              realizedPnl: update.snapshot.realizedPnl,
              unrealizedPnl: update.snapshot.unrealizedPnl,
              timestamp: payload.timestamp ?? Date.now(),
            });
          }
        }
      } catch (error) {
        console.error(JSON.stringify({
          message: "portfolio_service_kafka_event_failed",
          topic,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
  });

  console.log(JSON.stringify({ message: "portfolio_service_kafka_connected" }));
}

export async function emitPortfolioSnapshot(payload: {
  userId: string;
  totalValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  timestamp: number;
}): Promise<void> {
  if (!env.KAFKA_ENABLED || !producer) return;

  await producer.send({
    topic: "portfolio.update",
    messages: [{
      key: payload.userId,
      value: JSON.stringify({
        eventId: crypto.randomUUID(),
        timestamp: Date.now(),
        source: "portfolio-service",
        payload,
      }),
    }],
  });
}

export async function shutdownKafka(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }

  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
