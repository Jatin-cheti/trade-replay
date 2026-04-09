import crypto from "node:crypto";
import { Kafka, logLevel, SASLOptions } from "kafkajs";
import { env } from "../src/config/env";
import { KAFKA_TOPICS } from "../src/kafka/topics";

type CandlePayload = {
  symbol: string;
  timeframe: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function parseArg(name: string, fallback: string): string {
  const prefixed = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefixed));
  if (!match) return fallback;
  return match.slice(prefixed.length);
}

function buildKafka(): Kafka {
  const brokers = env.KAFKA_BROKERS.split(",").map((item) => item.trim()).filter(Boolean);
  const useSasl = Boolean(env.KAFKA_SASL_USERNAME && env.KAFKA_SASL_PASSWORD);

  const sasl: SASLOptions | undefined = useSasl
    ? {
      mechanism: (env.KAFKA_SASL_MECHANISM as "plain" | "scram-sha-256" | "scram-sha-512") || "plain",
      username: env.KAFKA_SASL_USERNAME,
      password: env.KAFKA_SASL_PASSWORD,
    }
    : undefined;

  return new Kafka({
    clientId: "tradereplay-manual-verifier",
    brokers,
    ssl: useSasl,
    sasl,
    logLevel: logLevel.ERROR,
  });
}

async function run(): Promise<void> {
  const symbol = parseArg("symbol", "AAPL").trim().toUpperCase();
  const timeframe = parseArg("timeframe", "1m").trim();
  const close = Number(parseArg("close", String(100 + Math.random())));

  const payload: CandlePayload = {
    symbol,
    timeframe,
    time: new Date().toISOString(),
    open: Number((close - 0.2).toFixed(4)),
    high: Number((close + 0.4).toFixed(4)),
    low: Number((close - 0.6).toFixed(4)),
    close: Number(close.toFixed(4)),
    volume: 1000,
  };

  const event = {
    eventId: crypto.randomUUID(),
    topic: KAFKA_TOPICS.CHART_CANDLE_UPDATED,
    timestamp: Date.now(),
    source: "manual-verification-script",
    payload,
  };

  const kafka = buildKafka();
  const producer = kafka.producer();

  await producer.connect();
  await producer.send({
    topic: KAFKA_TOPICS.CHART_CANDLE_UPDATED,
    messages: [{
      key: `${symbol}:${timeframe}:${payload.time}`,
      value: JSON.stringify(event),
      headers: { eventId: event.eventId },
    }],
  });
  await producer.disconnect();

  console.log(JSON.stringify({
    published: true,
    topic: KAFKA_TOPICS.CHART_CANDLE_UPDATED,
    symbol,
    timeframe,
    time: payload.time,
  }));
}

void run();
