import { Kafka } from "kafkajs";
import { kafkaConfig } from "../config/kafka";
import { invalidateSymbolTimeframeCaches } from "./cache";
import { incrementCounter } from "./metrics";
import { logError, logInfo, logWarn } from "./logger";

type CandleUpdateEvent = {
  symbol?: string;
  timeframe?: string;
  time?: string;
};

type KafkaEventEnvelope<T = unknown> = {
  eventId?: string;
  timestamp?: number;
  topic?: string;
  source?: string;
  payload?: T;
};

const state = {
  connected: false,
  started: false,
  processedCount: 0,
  failedCount: 0,
  dlqCount: 0,
  lastMessageTime: null as string | null,
  lastProcessedAt: null as string | null,
  lastLagMs: null as number | null,
};

type StreamingHealth = {
  enabled: boolean;
  connected: boolean;
  topic: string;
  dlqTopic: string;
  maxRetries: number;
  retryBaseMs: number;
  processedCount: number;
  failedCount: number;
  dlqCount: number;
  lastMessageTime: string | null;
  lastProcessedAt: string | null;
  lastLagMs: number | null;
};

type DlqPublishInput = {
  rawValue: string;
  reason: string;
  attempts: number;
};

type ProcessingOptions = {
  maxRetries?: number;
  retryBaseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  publishDlq?: (input: DlqPublishInput) => Promise<void>;
};

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function retryDelayMs(attempt: number, baseMs: number): number {
  const exp = baseMs * (2 ** attempt);
  const jitter = Math.floor(Math.random() * Math.max(20, Math.floor(baseMs / 2)));
  return exp + jitter;
}

function toIsoTime(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return null;
}

function lagMsFromMessageTime(messageTime: string | null): number | null {
  if (!messageTime) return null;
  const ts = Date.parse(messageTime);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Date.now() - ts);
}

function updateSuccessTelemetry(messageTime: string | null): void {
  state.processedCount += 1;
  state.lastMessageTime = messageTime;
  state.lastProcessedAt = new Date().toISOString();
  state.lastLagMs = lagMsFromMessageTime(messageTime);
}

function updateFailureTelemetry(messageTime: string | null): void {
  state.failedCount += 1;
  state.lastMessageTime = messageTime;
  state.lastProcessedAt = new Date().toISOString();
  state.lastLagMs = lagMsFromMessageTime(messageTime);
}

export function getStreamingHealth(): StreamingHealth {
  return {
    enabled: kafkaConfig.enabled,
    connected: state.connected,
    topic: kafkaConfig.topic,
    dlqTopic: kafkaConfig.dlqTopic,
    maxRetries: kafkaConfig.maxRetries,
    retryBaseMs: kafkaConfig.retryBaseMs,
    processedCount: state.processedCount,
    failedCount: state.failedCount,
    dlqCount: state.dlqCount,
    lastMessageTime: state.lastMessageTime,
    lastProcessedAt: state.lastProcessedAt,
    lastLagMs: state.lastLagMs,
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

function parseRawKafkaMessage(rawValue: string): { event: CandleUpdateEvent; messageTime: string | null } {
  const parsed = JSON.parse(rawValue) as CandleUpdateEvent | KafkaEventEnvelope<CandleUpdateEvent>;
  const event = (parsed && typeof parsed === "object" && "payload" in parsed)
    ? ((parsed as KafkaEventEnvelope<CandleUpdateEvent>).payload ?? {})
    : (parsed as CandleUpdateEvent);

  const envelope = (parsed && typeof parsed === "object" && "payload" in parsed)
    ? parsed as KafkaEventEnvelope<CandleUpdateEvent>
    : null;
  const messageTime = toIsoTime(envelope?.timestamp) ?? toIsoTime(event.time);

  return { event, messageTime };
}

export async function handleKafkaMessageValue(rawValue: string, options: ProcessingOptions = {}): Promise<void> {
  const maxRetries = Math.max(0, options.maxRetries ?? kafkaConfig.maxRetries);
  const retryBaseMs = Math.max(10, options.retryBaseMs ?? kafkaConfig.retryBaseMs);
  const sleep = options.sleep ?? wait;
  const publishDlq = options.publishDlq;

  let parsed: { event: CandleUpdateEvent; messageTime: string | null };
  try {
    parsed = parseRawKafkaMessage(rawValue);
  } catch (error) {
    updateFailureTelemetry(null);
    if (publishDlq) {
      try {
        await publishDlq({
          rawValue,
          reason: error instanceof Error ? error.message : String(error),
          attempts: 1,
        });
        state.dlqCount += 1;
      } catch (publishError) {
        logWarn("streaming_dlq_publish_failed", {
          error: publishError instanceof Error ? publishError.message : String(publishError),
        });
      }
    }
    throw error;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      await handleCandleUpdateEvent(parsed.event);
      updateSuccessTelemetry(parsed.messageTime);
      return;
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(retryDelayMs(attempt, retryBaseMs));
        continue;
      }

      updateFailureTelemetry(parsed.messageTime);
      if (publishDlq) {
        try {
          await publishDlq({
            rawValue,
            reason: error instanceof Error ? error.message : String(error),
            attempts: attempt + 1,
          });
          state.dlqCount += 1;
        } catch (publishError) {
          logWarn("streaming_dlq_publish_failed", {
            error: publishError instanceof Error ? publishError.message : String(publishError),
          });
        }
      }

      throw error;
    }
  }

  updateFailureTelemetry(parsed.messageTime);
}

export function resetStreamingStateForTests(): void {
  state.connected = false;
  state.started = false;
  state.processedCount = 0;
  state.failedCount = 0;
  state.dlqCount = 0;
  state.lastMessageTime = null;
  state.lastProcessedAt = null;
  state.lastLagMs = null;
}

export function markStreamingProcessedForTests(input: { messageTime?: string }): void {
  updateSuccessTelemetry(input.messageTime ?? null);
}

export function markStreamingFailureForTests(input: { messageTime?: string }): void {
  updateFailureTelemetry(input.messageTime ?? null);
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
  const producer = kafka.producer();

  const publishDlq = async (input: DlqPublishInput): Promise<void> => {
    await producer.send({
      topic: kafkaConfig.dlqTopic,
      messages: [{
        key: `dlq:${Date.now()}`,
        value: JSON.stringify({
          originalValue: input.rawValue,
          reason: input.reason,
          attempts: input.attempts,
          failedAt: new Date().toISOString(),
          sourceTopic: kafkaConfig.topic,
        }),
      }],
    });
  };

  try {
    await producer.connect();
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
          await handleKafkaMessageValue(message.value.toString(), {
            publishDlq,
          });
        } catch (error) {
          incrementCounter("streaming.events.failed");
          logWarn("streaming_message_processing_failed", {
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
        await producer.disconnect();
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
      await producer.disconnect();
    } catch {
      // ignore cleanup failure
    }
    return null;
  }
}
