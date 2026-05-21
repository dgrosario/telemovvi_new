import amqp, { Channel, ChannelModel } from "amqplib";

interface CacheInvalidationEvent {
  type: "channel.credentials.updated" | "channel.credentials.deleted";
  phoneId: string;
  channelId: string;
  timestamp: string;
}

export class CacheInvalidationPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly url: string;
  private readonly exchangeName: string;

  constructor(
    url: string = process.env.RABBITMQ_URL || "",
    exchangeName: string = process.env.EXCHANGE_NAME || "meta_exchange"
  ) {
    this.url = url;
    this.exchangeName = exchangeName;
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connection || !this.channel) {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchangeName, "topic", {
        durable: true,
      });
    }
  }

  async publishCacheInvalidation(
    phoneId: string,
    channelId: string,
    type: CacheInvalidationEvent["type"] = "channel.credentials.updated"
  ): Promise<boolean> {
    try {
      await this.ensureConnection();

      if (!this.channel) {
        console.error(
          "[CacheInvalidationPublisher] Channel not available"
        );
        return false;
      }

      const event: CacheInvalidationEvent = {
        type,
        phoneId,
        channelId,
        timestamp: new Date().toISOString(),
      };

      const routingKey = "channel.credentials.updated";

      const success = this.channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: "application/json",
        }
      );

      if (success) {
        console.log(
          `[CacheInvalidationPublisher] Published cache invalidation for phoneId: ${phoneId}`
        );
      }

      return success;
    } catch (error) {
      console.error(
        "[CacheInvalidationPublisher] Error publishing event:",
        error
      );
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.channel = null;
      this.connection = null;
    } catch (error) {
      console.error(
        "[CacheInvalidationPublisher] Error closing connection:",
        error
      );
    }
  }

  static instance(): CacheInvalidationPublisher {
    return new CacheInvalidationPublisher();
  }
}
