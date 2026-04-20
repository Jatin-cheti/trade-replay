import { disableKafkaRuntime, isKafkaEnabled, setKafkaReady } from "../config/kafka";
import { ensureTopics } from "./admin";
import { connectProducer, disconnectProducer } from "./producer";
import { disconnectAllConsumers } from "./consumer";
import { startTradeProcessor } from "./consumers/tradeProcessor";
import { startPortfolioUpdater } from "./consumers/portfolioUpdater";
import { startAnalyticsProcessor } from "./consumers/analyticsProcessor";
import { startAlertsTickProcessor } from "./consumers/alertsTickProcessor";
import { startMarketPriceCacheProcessor } from "./consumers/marketPriceCacheProcessor";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import net from "node:net";

type KafkaProbeResult = {
  reachable: boolean;
  broker?: string;
  reason?: string;
};

let hasLoggedKafkaAutoDisableSummary = false;

function parseBrokerAddress(broker: string): { host: string; port: number } | null {
  const [hostRaw, portRaw] = broker.split(":");
  const host = hostRaw?.trim();
  const port = Number(portRaw);
  if (!host || !Number.isFinite(port) || port <= 0) return null;
  return { host, port };
}

function probeBroker(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

async function probeKafkaBrokers(timeoutMs = 750): Promise<KafkaProbeResult> {
  const brokers = env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean);
  if (brokers.length === 0) {
    return { reachable: false, reason: "missing_broker_config" };
  }

  for (const broker of brokers) {
    const parsed = parseBrokerAddress(broker);
    if (!parsed) continue;
    const reachable = await probeBroker(parsed.host, parsed.port, timeoutMs);
    if (reachable) {
      return { reachable: true, broker };
    }
  }

  return {
    reachable: false,
    broker: brokers[0],
    reason: "tcp_connect_failed",
  };
}

type KafkaPreflightOptions = {
  probe?: () => Promise<KafkaProbeResult>;
  onDisable?: (reason: string) => void;
  logWarn?: (meta: { reason: string; broker?: string | null }) => void;
};

export async function preflightKafkaOrDisableForDev(options: KafkaPreflightOptions = {}): Promise<boolean> {
  if (!isKafkaEnabled()) {
    return false;
  }

  if (env.APP_ENV === "production" || !env.DEV_DISABLE_KAFKA_IF_UNAVAILABLE) {
    return true;
  }

  const probe = options.probe ?? (() => probeKafkaBrokers());
  const result = await probe();
  if (result.reachable) {
    return true;
  }

  const reason = `kafka_unreachable_in_dev:${result.reason ?? "unknown"}`;
  disableKafkaRuntime(reason);
  if (options.onDisable) {
    options.onDisable(reason);
  }

  if (!hasLoggedKafkaAutoDisableSummary) {
    hasLoggedKafkaAutoDisableSummary = true;
    if (options.logWarn) {
      options.logWarn({ reason, broker: result.broker ?? null });
    } else {
      logger.warn("kafka_auto_disabled_for_dev", {
        reason,
        broker: result.broker ?? null,
        strategy: "preflight_tcp_probe",
      });
    }
  }

  return false;
}

export function resetKafkaPreflightStateForTests(): void {
  hasLoggedKafkaAutoDisableSummary = false;
}

export async function bootstrapKafkaProducerOnly(): Promise<void> {
  if (!isKafkaEnabled()) {
    logger.info("kafka_disabled");
    return;
  }

  const preflightOk = await preflightKafkaOrDisableForDev();
  if (!preflightOk) {
    return;
  }

  try {
    logger.info("kafka_producer_bootstrap_start");

    await ensureTopics();
    await connectProducer();

    setKafkaReady(true);
    logger.info("kafka_producer_bootstrap_complete");
  } catch (error) {
    logger.error("kafka_producer_bootstrap_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (env.APP_ENV !== "production" && env.DEV_DISABLE_KAFKA_IF_UNAVAILABLE) {
      disableKafkaRuntime("kafka_unreachable_in_dev");
      logger.warn("kafka_auto_disabled_for_dev", {
        reason: "broker_unreachable",
      });
    }
    setKafkaReady(false);
  }
}

export async function bootstrapKafkaConsumersOnly(): Promise<void> {
  if (!isKafkaEnabled()) {
    logger.info("kafka_disabled");
    return;
  }

  try {
    logger.info("kafka_consumers_bootstrap_start");
    await ensureTopics();
    await startTradeProcessor();
    await startPortfolioUpdater();
    await startAnalyticsProcessor();
    await startMarketPriceCacheProcessor();
    await startAlertsTickProcessor();
    logger.info("kafka_consumers_bootstrap_complete");
  } catch (error) {
    logger.error("kafka_consumers_bootstrap_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function bootstrapKafka(): Promise<void> {
  await bootstrapKafkaProducerOnly();
  await bootstrapKafkaConsumersOnly();
}

export async function shutdownKafka(): Promise<void> {
  if (!isKafkaEnabled()) return;

  logger.info("kafka_shutdown_start");
  setKafkaReady(false);

  await disconnectAllConsumers();
  await disconnectProducer();

  logger.info("kafka_shutdown_complete");
}
