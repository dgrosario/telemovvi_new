import Redis from "ioredis";

export class DistributedLockDriver {
  private client: Redis;

  constructor(
    redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379"
  ) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on("error", (err) => {
      console.error("[Redis Lock] Connection error:", err.message);
    });
  }

  private getLockKey(resource: string): string {
    return `lock:${resource}`;
  }

  async acquire(
    resource: string,
    lockId: string,
    ttlMs: number = 30000
  ): Promise<boolean> {
    const key = this.getLockKey(resource);
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    const result = await this.client.set(key, lockId, "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async release(resource: string, lockId: string): Promise<boolean> {
    const key = this.getLockKey(resource);

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.client.eval(script, 1, key, lockId);
    return result === 1;
  }

  async extend(
    resource: string,
    lockId: string,
    ttlMs: number = 30000
  ): Promise<boolean> {
    const key = this.getLockKey(resource);
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.client.eval(script, 1, key, lockId, ttlSeconds);
    return result === 1;
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  static instance(): DistributedLockDriver {
    return new DistributedLockDriver();
  }
}
