import { Kafka } from "kafkajs";
import { kafkaConfig } from "../config/kafka";
import { invalidateSymbolTimeframeCaches } from "./cache";
import { incrementCounter } from "./metrics";
import { logError, logInfo, logWarn } from "./logger";

type CandleUpdateEvent = {
  symbol?: string;
  timeframe?: string;
};

type KafkaEventEnvelope<T = unknown> = {
  payload?: T;
};

const state = {
  connected: false,
  started: false,
};

export function getStreamingHealth(): { enabled: boolean; connected: boolean; topic: string } {
  return {
    enabled: kafkaConfig.enabled,
    connected: state.connected,
    topic: kafkaConfig.topic,
  };
}

export async function handleCandleUpdateEvent(event: CandleUpdateEvent): Promise<void> {
  const symbol = event.symbol?.trim();
  const timeframe = event.timeframe?.trim();
  if (!symbol || !timeframe) {
    incrementCounter("streaming.events.invalid");
    return;
  }

  incrementCounter("streaming.events.received");
  await invalidateSymbolTimeframeCaches(symbol, timeframe);
}

export async function handleKafkaMessageValue(rawValue: string): Promise<void> {
  const parsed = JSON.parse(rawValue) as CandleUpdateEvent | KafkaEventEnvelope<CandleUpdateEvent>;
  const event = (parsed && typeof parsed === "object" && "payload" in parsed)
    ? ((parsed as KafkaEventEnvelope<CandleUpdateEvent>).payload ?? {})
    : (parsed as CandleUpdateEvent);

  await handleCandleUpdateEvent(event);
}

export async function startStreaming(): Promise<(() => Promise<void>) | null> {
  if (!kafkaConfig.enabled || state.started) {
    return null;
  }

  const kafka = new Kafka({
    clientId: kafkaConfig.clientId,
    brokers: kafkaConfig.brokers,
  });

  const consumer = kafka.consumer({ groupId: kafkaConfig.groupId });

  try {
    await consumer.connect();
    state.connected = true;
    await consumer.subscribe({ topic: kafkaConfig.topic, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          incrementCounter("streaming.events.empty");
          return;
        }

        try {
          await handleKafkaMessageValue(message.value.toString());
        } catch (error) {
          incrementCounter("streaming.events.parse_error");
          logWarn("streaming_message_parse_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    });

    state.started = true;
    logInfo("chart_streaming_started", { topic: kafkaConfig.topic });

    return async () => {
      try {
        await consumer.disconnect();
      } catch (error) {
        logError("chart_streaming_stop_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        state.connected = false;
        state.started = false;
      }
    };
  } catch (error) {
    state.connected = false;
    state.started = false;
    logWarn("chart_streaming_start_failed", {
      error: error instanceof Error ? error.message : String(error),
      topic: kafkaConfig.topic,
    });
    try {
      await consumer.disconnect();
    } catch {
      // ignore cleanup failure
    }
    return null;
  }
}
