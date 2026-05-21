import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>("redis.url") ||
      process.env.REDIS_URL ||
      "redis://localhost:6379";

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error("Redis connection failed after 3 retries");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on("connect", () => {
      this.logger.log("Redis connection established");
    });

    this.client.on("error", (error) => {
      this.logger.error("Redis connection error", error);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async healthCheck(): Promise<void> {
    const result = await this.client.ping();
    if (result !== "PONG") {
      throw new Error("Redis health check failed");
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log("Redis connection closed");
    }
  }
}
