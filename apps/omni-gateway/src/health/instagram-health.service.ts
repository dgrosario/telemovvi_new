import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MainDatabaseService } from "../database/main-database.service";
import { InstagramGatewayHandler } from "../consumers/handlers/instagram-gateway.handler";

interface InstagramChannel {
  id: string;
  name: string;
  workspaceId: string;
  payload: {
    accessToken: string;
    pageId: string;
    pageName?: string;
    igUserId: string;
    igUsername?: string;
    tokenExpiresAt?: string;
    tokenType?: string;
  };
}

@Injectable()
export class InstagramHealthService implements OnModuleInit {
  private readonly logger = new Logger(InstagramHealthService.name);
  private isProcessing = false;

  constructor(
    private readonly mainDatabaseService: MainDatabaseService,
    private readonly instagramGatewayHandler: InstagramGatewayHandler
  ) {}

  onModuleInit(): void {
    this.logger.log("Instagram Health Service initialized");
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async checkAndRefreshTokens(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn("Health check already in progress, skipping...");
      return;
    }

    this.isProcessing = true;
    this.logger.log("Starting Instagram tokens health check...");

    try {
      const channels = await this.getInstagramChannels();
      this.logger.log(`Found ${channels.length} Instagram channels to check`);

      for (const channel of channels) {
        await this.checkChannel(channel);
      }

      this.logger.log("Instagram tokens health check completed");
    } catch (error) {
      this.logger.error(
        `Error during Instagram health check: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async getInstagramChannels(): Promise<InstagramChannel[]> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available");
      return [];
    }

    const result = await sql`
      SELECT id, name, workspace_id as "workspaceId", payload
      FROM channels
      WHERE type = 'instagram'
      AND status = 'connected'
    `;

    return result as unknown as InstagramChannel[];
  }

  private async checkChannel(channel: InstagramChannel): Promise<void> {
    const { id, name, payload } = channel;

    if (!payload.accessToken) {
      this.logger.warn(`Channel ${name} (${id}) has no access token`);
      await this.markChannelAsDisconnected(id);
      return;
    }

    if (!payload.tokenExpiresAt) {
      this.logger.warn(
        `Channel ${name} (${id}) has no expiration date. Attempting to refresh token...`
      );
      await this.refreshToken(channel);
      return;
    }

    const expiresAt = new Date(payload.tokenExpiresAt);
    const now = new Date();
    const daysUntilExpiration = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration < 0) {
      this.logger.error(
        `Channel ${name} (${id}) token expired on ${expiresAt.toISOString()}`
      );
      await this.markChannelAsDisconnected(id);
      return;
    }

    if (daysUntilExpiration <= 7) {
      this.logger.warn(
        `Channel ${name} (${id}) token expires in ${daysUntilExpiration} days. Refreshing...`
      );
      await this.refreshToken(channel);
      return;
    }

    const webhookStatus = await this.checkWebhookSubscription(
      payload.pageId,
      payload.accessToken
    );

    if (!webhookStatus.subscribed) {
      this.logger.warn(
        `Channel ${name} (${id}) webhook not subscribed. Re-subscribing...`
      );
      await this.resubscribeWebhook(channel);
    } else {
      this.logger.log(
        `Channel ${name} (${id}) is healthy. Token expires in ${daysUntilExpiration} days`
      );
    }
  }

  private async refreshToken(channel: InstagramChannel): Promise<void> {
    const result = await this.instagramGatewayHandler.refreshToken(
      channel.id,
      channel.payload.accessToken
    );

    if (!result.success) {
      this.logger.error(
        `Failed to refresh token for channel ${channel.name} (${channel.id}): ${result.error}`
      );
      await this.markChannelAsDisconnected(channel.id);
    } else {
      this.logger.log(
        `Successfully refreshed token for channel ${channel.name} (${channel.id})`
      );
    }
  }

  private async checkWebhookSubscription(
    pageId: string,
    accessToken: string
  ): Promise<{ subscribed: boolean; fields?: string[] }> {
    try {
      const response = await fetch(
        `https://graph.instagram.com/v21.0/${pageId}/subscribed_apps?access_token=${accessToken}`
      );

      if (!response.ok) {
        this.logger.error(
          `Failed to check webhook subscription for page ${pageId}: ${response.statusText}`
        );
        return { subscribed: false };
      }

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          subscribed_fields: string[];
        }>;
      };

      const isSubscribed = data.data && data.data.length > 0;
      const subscribedFields = isSubscribed ? data.data[0].subscribed_fields : [];

      return {
        subscribed:
          isSubscribed &&
          this.instagramGatewayHandler.isWebhookSubscriptionComplete(
            subscribedFields
          ),
        fields: subscribedFields,
      };
    } catch (error) {
      this.logger.error(
        `Error checking webhook subscription for page ${pageId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return { subscribed: false };
    }
  }

  private async resubscribeWebhook(channel: InstagramChannel): Promise<void> {
    try {
      const result = await this.instagramGatewayHandler.subscribeWebhook(
        channel.payload.pageId,
        channel.payload.accessToken
      );

      if (!result.success) {
        this.logger.error(
          `Failed to resubscribe webhook for channel ${channel.name} (${channel.id}): ${result.error}`
        );
        return;
      }

      this.logger.log(
        `Successfully resubscribed webhook for channel ${channel.name} (${channel.id})`
      );
    } catch (error) {
      this.logger.error(
        `Error resubscribing webhook for channel ${channel.name} (${channel.id}): ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async markChannelAsDisconnected(channelId: string): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) return;

    try {
      await sql`UPDATE channels SET status = 'disconnected' WHERE id = ${channelId}`;
      this.logger.log(`Marked channel ${channelId} as disconnected`);
    } catch (error) {
      this.logger.error(
        `Failed to mark channel ${channelId} as disconnected: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
