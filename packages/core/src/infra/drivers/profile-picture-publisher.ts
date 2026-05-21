import amqp, { Channel, ChannelModel } from "amqplib";

export interface ProfilePictureFetchEvent {
  contactId: string;
  phoneNumber: string;
  instanceName: string;
  channelId: string;
  workspaceId: string;
  timestamp: string;
}

const QUEUE_NAME = "profile-picture.fetch";
const RECONNECT_DELAY_MS = 5000;

export class ProfilePicturePublisher {
  private static _instance: ProfilePicturePublisher | null = null;

  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly url: string;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor(url: string = process.env.RABBITMQ_URL || "") {
    this.url = url;
  }

  private async ensureConnection(): Promise<void> {
    if (this.channel && this.connection) {
      return;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.connect();

    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async connect(): Promise<void> {
    if (!this.url) {
      console.warn("[ProfilePicturePublisher] RABBITMQ_URL not configured");
      return;
    }

    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      this.connection.on("error", (err) => {
        console.error("[ProfilePicturePublisher] Connection error:", err.message);
        this.handleDisconnect();
      });

      this.connection.on("close", () => {
        console.warn("[ProfilePicturePublisher] Connection closed");
        this.handleDisconnect();
      });

      this.channel.on("error", (err) => {
        console.error("[ProfilePicturePublisher] Channel error:", err.message);
        this.handleDisconnect();
      });

      this.channel.on("close", () => {
        console.warn("[ProfilePicturePublisher] Channel closed");
        this.channel = null;
      });
    } catch (error) {
      console.error("[ProfilePicturePublisher] Failed to connect:", error);
      this.handleDisconnect();
      throw error;
    }
  }

  private handleDisconnect(): void {
    this.channel = null;
    this.connection = null;

    setTimeout(() => {
      this.ensureConnection().catch((err) => {
        console.error("[ProfilePicturePublisher] Reconnection failed:", err.message);
      });
    }, RECONNECT_DELAY_MS);
  }

  async publishFetchRequest(
    event: Omit<ProfilePictureFetchEvent, "timestamp">
  ): Promise<boolean> {
    try {
      await this.ensureConnection();

      if (!this.channel) {
        console.error("[ProfilePicturePublisher] Channel not available");
        return false;
      }

      const fullEvent: ProfilePictureFetchEvent = {
        ...event,
        timestamp: new Date().toISOString(),
      };

      const success = this.channel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(fullEvent)),
        {
          persistent: true,
          contentType: "application/json",
        }
      );

      return success;
    } catch (error) {
      console.error("[ProfilePicturePublisher] Error publishing event:", error);
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
      console.error("[ProfilePicturePublisher] Error closing connection:", error);
    }
  }

  static instance(): ProfilePicturePublisher {
    if (!ProfilePicturePublisher._instance) {
      ProfilePicturePublisher._instance = new ProfilePicturePublisher();
    }
    return ProfilePicturePublisher._instance;
  }
}
