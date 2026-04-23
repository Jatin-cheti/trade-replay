import { Server } from "socket.io";
import { createConsumer, MessageHandler } from "../consumer";
import { KAFKA_TOPICS, KafkaEvent } from "../topics";
import { logger } from "../../utils/logger";

type PortfolioLiveUpdatePayload = {
  userId?: string;
  action?: string;
  timestamp?: number;
  totalValue?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
};

const handlePortfolioLiveUpdate =
  (io: Server): MessageHandler =>
  async (event: KafkaEvent) => {
    const payload = event.payload as PortfolioLiveUpdatePayload;
    if (!payload || typeof payload.userId !== "string" || payload.userId.trim().length === 0) {
      return;
    }

    const userId = payload.userId.trim();
    const reason = typeof payload.action === "string" && payload.action.trim().length > 0
      ? payload.action.trim()
      : "snapshot";

    io.to(userId).emit("portfolio:live-update", {
      userId,
      reason,
      timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
      metrics: {
        totalValue: payload.totalValue,
        unrealizedPnl: payload.unrealizedPnl,
        realizedPnl: payload.realizedPnl,
      },
    });

    logger.info("kafka_portfolio_live_update_emitted", {
      userId,
      reason,
      topic: event.topic,
    });
  };

export async function startPortfolioLiveNotifier(io: Server): Promise<void> {
  await createConsumer({
    groupId: "tradereplay-portfolio-live-notifier",
    topics: [KAFKA_TOPICS.PORTFOLIO_UPDATE],
    handler: handlePortfolioLiveUpdate(io),
  });

  logger.info("kafka_portfolio_live_notifier_started");
}
