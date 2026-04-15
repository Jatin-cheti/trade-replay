import { createConsumer, MessageHandler } from "../consumer";
import { KAFKA_TOPICS, AssetCreatedPayload } from "../topics";
import { markSearchIndexDirty } from "../../services/searchIndex.service";
import { logger } from "../../utils/logger";

let pendingCount = 0;
let flushTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 5_000;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (pendingCount > 0) {
      logger.info("asset_index_flush", { pendingCount });
      markSearchIndexDirty("kafka_asset_events");
      pendingCount = 0;
    }
  }, DEBOUNCE_MS);
}

const handler: MessageHandler<AssetCreatedPayload> = async (_event) => {
  pendingCount++;
  scheduleFlush();
};

export async function startAssetIndexProcessor(): Promise<void> {
  try {
    await createConsumer({
      groupId: "searchindex-refresh-group",
      topics: [KAFKA_TOPICS.ASSET_CREATED, KAFKA_TOPICS.ASSET_UPDATED],
      handler: handler as MessageHandler,
    });
    logger.info("asset_index_processor_started");
  } catch {
    logger.warn("asset_index_processor_skipped", { reason: "kafka_not_available" });
  }
}
