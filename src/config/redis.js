const { createClient } = require("redis");
const { RedisStore } = require("rate-limit-redis");
const logger = require("../utils/logger");

const redisUrl = process.env.RATE_LIMIT_REDIS_URL?.trim();
const client = redisUrl ? createClient({ url: redisUrl, socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) } }) : null;

if (client) client.on("error", (error) => logger.error("redis_error", { error }));

function createRateLimitStore(prefix) {
  if (!client) return undefined;
  return new RedisStore({ sendCommand: (...args) => client.sendCommand(args), prefix });
}

async function connectRedis() {
  if (client && !client.isOpen) await client.connect();
}

async function closeRedis() {
  if (client?.isOpen) await client.quit();
}

module.exports = { createRateLimitStore, connectRedis, closeRedis };
