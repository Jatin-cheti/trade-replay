import { env } from "./env";

export const kafkaConfig = {
  enabled: env.KAFKA_ENABLED,
  brokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean),
  clientId: env.CHART_KAFKA_CLIENT_ID,
  groupId: env.CHART_KAFKA_GROUP_ID,
  topic: env.CHART_CANDLE_UPDATE_TOPIC,
};
