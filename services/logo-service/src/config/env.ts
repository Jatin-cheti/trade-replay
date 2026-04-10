import { CONFIG } from "./index";

export const env = {
  NODE_ENV: CONFIG.nodeEnv,
  MONGO_URI: CONFIG.mongoUri,
  REDIS_URL: CONFIG.redisUrl,
  KAFKA_ENABLED: CONFIG.kafkaEnabled,
  KAFKA_BROKERS: CONFIG.kafkaBroker,
  LOGO_WORKER_CONCURRENCY: CONFIG.logoWorkerConcurrency,
  AWS_REGION: CONFIG.awsRegion,
  AWS_S3_BUCKET: CONFIG.awsS3Bucket,
  AWS_ACCESS_KEY_ID: CONFIG.awsAccessKeyId,
  AWS_SECRET_ACCESS_KEY: CONFIG.awsSecretAccessKey,
  AWS_CDN_BASE_URL: CONFIG.awsCdnBaseUrl,
};

export const hasAwsConfig = Boolean(
  env.AWS_REGION
  && env.AWS_S3_BUCKET
  && env.AWS_ACCESS_KEY_ID
  && env.AWS_SECRET_ACCESS_KEY,
);
