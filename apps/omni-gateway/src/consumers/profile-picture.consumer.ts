import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { z } from "zod";
import { EvolutionApiService } from "../channel-apis/evolution-api.service";
import { MainDatabaseService } from "../database/main-database.service";

const ProfilePictureFetchEventSchema = z.object({
  contactId: z.string().uuid(),
  phoneNumber: z.string().min(10),
  instanceName: z.string().min(1),
  channelId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  timestamp: z.string(),
});

type ProfilePictureFetchEvent = z.infer<typeof ProfilePictureFetchEventSchema>;

const QUEUE_NAME = "profile-picture.fetch";
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;

@Injectable()
export class ProfilePictureConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProfilePictureConsumerService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly rabbitmqUrl: string;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private shouldReconnect = true;

  constructor(
    private readonly configService: ConfigService,
    private readonly evolutionApiService: EvolutionApiService,
    private readonly mainDatabaseService: MainDatabaseService
  ) {
    this.rabbitmqUrl = this.configService.get<string>("RABBITMQ_URL") ?? "";
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.shouldReconnect = false;
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    if (!this.rabbitmqUrl) {
      this.logger.warn("RABBITMQ_URL not configured, profile picture consumer disabled");
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(QUEUE_NAME, {
        durable: true,
      });

      await this.channel.prefetch(5);

      this.connection.on("error", (err) => {
        this.logger.error(`Connection error: ${err.message}`);
      });

      this.connection.on("close", () => {
        this.logger.warn("Connection closed");
        this.handleDisconnect();
      });

      this.channel.on("error", (err) => {
        this.logger.error(`Channel error: ${err.message}`);
      });

      this.channel.on("close", () => {
        this.logger.warn("Channel closed");
        this.channel = null;
      });

      await this.channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return;

        try {
          const rawEvent = JSON.parse(msg.content.toString());
          const parseResult = ProfilePictureFetchEventSchema.safeParse(rawEvent);

          if (!parseResult.success) {
            this.logger.error(
              `Invalid message format: ${parseResult.error.message}`
            );
            this.channel?.nack(msg, false, false);
            return;
          }

          await this.processEvent(parseResult.data);
          this.channel?.ack(msg);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          this.logger.error(`Failed to process profile picture event: ${errorMessage}`);
          this.channel?.nack(msg, false, false);
        }
      });

      this.reconnectAttempts = 0;
      this.logger.log(`Profile picture consumer started, listening on: ${QUEUE_NAME}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to connect to RabbitMQ: ${errorMessage}`);
      this.handleDisconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private handleDisconnect(): void {
    this.channel = null;
    this.connection = null;

    if (!this.shouldReconnect) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );

    this.logger.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      this.connect().catch((err) => {
        this.logger.error(`Reconnection failed: ${err.message}`);
      });
    }, delay);
  }

  private async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.channel = null;
      this.connection = null;
    } catch (error) {
      this.logger.error("Error disconnecting profile picture consumer:", error);
    }
  }

  private async processEvent(event: ProfilePictureFetchEvent): Promise<void> {
    const { contactId, phoneNumber, instanceName } = event;

    this.logger.debug(
      `Processing profile picture fetch - contactId: ${contactId}, phone: ${phoneNumber}, instance: ${instanceName}`
    );

    try {
      const profilePictureUrl = await this.evolutionApiService.fetchProfilePictureUrl(
        instanceName,
        phoneNumber
      );

      if (profilePictureUrl) {
        await this.updateContactThumbnail(contactId, profilePictureUrl);
        this.logger.log(`Updated profile picture for contact ${contactId}`);
      } else {
        this.logger.debug(`No profile picture found for contact ${contactId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(
        `Failed to fetch profile picture for contact ${contactId}: ${errorMessage}`
      );
    }
  }

  private async updateContactThumbnail(contactId: string, thumbnail: string): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.error("Database connection not available");
      return;
    }

    try {
      await sql`
        UPDATE partner_contacts
        SET thumbnail = ${thumbnail}
        WHERE id = ${contactId}
      `;
    } catch (error) {
      this.logger.error(`Failed to update contact thumbnail: ${error}`);
      throw error;
    }
  }
}
