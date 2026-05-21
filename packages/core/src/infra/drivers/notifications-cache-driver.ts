import Redis from "ioredis";
import { Notification } from "../../domain/entities/notification";

export class NotificationsCacheDriver {
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
      console.error("[Redis] Connection error:", err.message);
    });
  }

  private getUnreadCountKey(userId: string): string {
    return `user:${userId}:notifications:unread:count`;
  }

  private getRecentNotificationsKey(userId: string): string {
    return `user:${userId}:notifications:recent`;
  }

  async cacheUnreadCount(userId: string, count: number): Promise<void> {
    const key = this.getUnreadCountKey(userId);
    await this.client.set(key, count.toString(), "EX", 300);
  }

  async getUnreadCount(userId: string): Promise<number | null> {
    const key = this.getUnreadCountKey(userId);
    const count = await this.client.get(key);
    return count !== null ? parseInt(count, 10) : null;
  }

  async incrementUnreadCount(userId: string): Promise<void> {
    const key = this.getUnreadCountKey(userId);
    await this.client.incr(key);
    await this.client.expire(key, 300);
  }

  async decrementUnreadCount(userId: string): Promise<void> {
    const key = this.getUnreadCountKey(userId);
    const currentCount = await this.client.get(key);

    if (currentCount === null) {
      return;
    }

    const count = parseInt(currentCount, 10);
    if (count <= 0) {
      await this.client.set(key, "0", "EX", 300);
      return;
    }

    await this.client.decr(key);
    await this.client.expire(key, 300);
  }

  async resetUnreadCount(userId: string): Promise<void> {
    const key = this.getUnreadCountKey(userId);
    await this.client.set(key, "0", "EX", 300);
  }

  async cacheNotification(notification: Notification): Promise<void> {
    const userId = notification.recipientId;
    const key = this.getRecentNotificationsKey(userId);
    const serialized = JSON.stringify({
      id: notification.id,
      workspaceId: notification.workspaceId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      metadata: notification.metadata,
      recipientType: notification.recipientType,
      recipientId: notification.recipientId,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      priority: notification.priority,
      createdAt: notification.createdAt.toISOString(),
      expiresAt: notification.expiresAt
        ? notification.expiresAt.toISOString()
        : null,
    });

    await this.client.lpush(key, serialized);
    await this.client.ltrim(key, 0, 4);
    await this.client.expire(key, 86400);
  }

  async getRecentNotifications(userId: string): Promise<Notification[]> {
    const key = this.getRecentNotificationsKey(userId);
    const items = await this.client.lrange(key, 0, 4);

    return items.map((item) => {
      const data = JSON.parse(item);
      return Notification.fromRaw({
        id: data.id,
        workspaceId: data.workspaceId,
        type: data.type as Notification.Type,
        title: data.title,
        content: data.content,
        metadata: data.metadata as Notification.Metadata,
        recipientType: data.recipientType as Notification.RecipientType,
        recipientId: data.recipientId,
        isRead: data.isRead,
        readAt: data.readAt ? new Date(data.readAt) : null,
        priority: data.priority as Notification.Priority,
        createdAt: new Date(data.createdAt),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      });
    });
  }

  async invalidateUserNotifications(userId: string): Promise<void> {
    const unreadCountKey = this.getUnreadCountKey(userId);
    const recentNotificationsKey = this.getRecentNotificationsKey(userId);

    await Promise.all([
      this.client.del(unreadCountKey),
      this.client.del(recentNotificationsKey),
    ]);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  static instance(): NotificationsCacheDriver {
    return new NotificationsCacheDriver();
  }
}
