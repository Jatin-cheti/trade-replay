import { CONFIG } from "./index";

export const env = {
  NODE_ENV: CONFIG.nodeEnv,
  PORT: CONFIG.port,
  MONGO_URI: CONFIG.mongoUri,
  REDIS_URL: CONFIG.redisUrl,
  KAFKA_ENABLED: CONFIG.kafkaEnabled,
  KAFKA_BROKERS: CONFIG.kafkaBroker,
  KAFKA_SASL_MECHANISM: CONFIG.kafkaSaslMechanism,
  KAFKA_SASL_USERNAME: CONFIG.kafkaSaslUsername,
  KAFKA_SASL_PASSWORD: CONFIG.kafkaSaslPassword,
};
