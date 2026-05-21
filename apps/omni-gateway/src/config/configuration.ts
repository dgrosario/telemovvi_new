import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from "../circuit-breaker";

function parseIntWithDefault(
  envValue: string | undefined,
  defaultValue: number
): number {
  if (!envValue) {
    return defaultValue;
  }
  const parsed = parseInt(envValue, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export default () => ({
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  mongodb: {
    uri: process.env.MONGODB_URI || "",
  },
  mediaApiKey: process.env.MEDIA_API_KEY || "",
  media: {
    storagePath: process.env.MEDIA_STORAGE_PATH ?? "/data/media",
    autoDownload: process.env.MEDIA_AUTO_DOWNLOAD !== "false",
    autoDeleteEnabled: process.env.MEDIA_AUTO_DELETE_ENABLED === "true",
    maxRetries: parseIntWithDefault(process.env.MEDIA_MAX_RETRIES, 3),
    retryDelayMs: parseIntWithDefault(process.env.MEDIA_RETRY_DELAY_MS, 2000),
    fileTtlHours: parseIntWithDefault(process.env.MEDIA_FILE_TTL_HOURS, 48),
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || "amqp://localhost:5672",
    exchangeName: process.env.EXCHANGE_NAME || "meta_exchange",
    outboundQueue: process.env.OUTBOUND_QUEUE || "outbound-messages",
    outboundDlq: process.env.OUTBOUND_DLQ || "outbound-messages.dlq",
    internalQueue: process.env.INTERNAL_QUEUE || "internal-messages",
    internalDlq: process.env.INTERNAL_DLQ || "internal-messages.dlq",
  },
  meta: {
    webhookVerifyToken:
      process.env.META_WEBHOOK_VERIFY_TOKEN || "omnichannel_verify_token",
    appSecret: process.env.META_APP_SECRET || "",
    appId: process.env.META_APP_ID || "",
  },
  evolution: {
    url: process.env.EVOLUTION_URL || "",
    apiKey: process.env.EVOLUTION_API_KEY || "",
  },
  evolutionRabbitmq: {
    url: process.env.EVOLUTION_RABBITMQ_URL || "",
    exchangeName: process.env.EVOLUTION_RABBITMQ_EXCHANGE || "evolution_exchange",
    managementUrl: process.env.EVOLUTION_RABBITMQ_MANAGEMENT_URL || "",
  },
  circuitBreaker: {
    timeout: parseIntWithDefault(
      process.env.CIRCUIT_BREAKER_TIMEOUT,
      DEFAULT_CIRCUIT_BREAKER_CONFIG.timeout
    ),
    errorThresholdPercentage: parseIntWithDefault(
      process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD,
      DEFAULT_CIRCUIT_BREAKER_CONFIG.errorThresholdPercentage
    ),
    resetTimeout: parseIntWithDefault(
      process.env.CIRCUIT_BREAKER_RESET_TIMEOUT,
      DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeout
    ),
    volumeThreshold: parseIntWithDefault(
      process.env.CIRCUIT_BREAKER_VOLUME_THRESHOLD,
      DEFAULT_CIRCUIT_BREAKER_CONFIG.volumeThreshold ?? 5
    ),
    rollingCountTimeout: parseIntWithDefault(
      process.env.CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT,
      DEFAULT_CIRCUIT_BREAKER_CONFIG.rollingCountTimeout ?? 10000
    ),
    rollingCountBuckets: parseIntWithDefault(
      process.env.CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS,
      DEFAULT_CIRCUIT_BREAKER_CONFIG.rollingCountBuckets ?? 10
    ),
  },
});
