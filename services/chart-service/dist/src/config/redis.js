import IORedis from "ioredis";
import { env } from "./env";
export const redisClient = new IORedis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
});
export async function connectRedis() {
    if (redisClient.status === "ready")
        return;
    if (redisClient.status === "wait") {
        await redisClient.connect();
    }
}
export function isRedisReady() {
    return redisClient.status === "ready";
}
