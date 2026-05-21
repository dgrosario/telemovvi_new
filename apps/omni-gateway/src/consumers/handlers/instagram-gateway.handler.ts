import { Injectable, Logger } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import { MetaSettingsService } from "../../meta-settings/meta-settings.service";
import { GatewayResponse } from "../interfaces/gateway-request.interface";

export const INSTAGRAM_REQUIRED_WEBHOOK_FIELDS = [
  "messages",
  "message_reactions",
  "messaging_postbacks",
  "feed",
] as const;

@Injectable()
export class InstagramGatewayHandler {
  private readonly logger = new Logger(InstagramGatewayHandler.name);

  constructor(
    private readonly mainDatabaseService: MainDatabaseService,
    private readonly metaSettingsService: MetaSettingsService
  ) {}

  async connect(
    correlationId: string,
    code: string,
    redirectUri: string
  ): Promise<GatewayResponse> {
    this.logger.log("=== INSTAGRAM CONNECT - START ===");
    this.logger.log(`CorrelationId: ${correlationId}`);
    this.logger.log(`Code: ${code.substring(0, 20)}...`);
    this.logger.log(`RedirectUri: ${redirectUri}`);

    const config = await this.metaSettingsService.getSettings("instagram", true);

    if (!config) {
      this.logger.error("Meta settings for Instagram not found");
      return {
        correlationId,
        success: false,
        error: "Meta settings for Instagram not found",
      };
    }

    if (!("appSecret" in config)) {
      this.logger.error("App Secret not available in Instagram settings");
      return {
        correlationId,
        success: false,
        error: "App Secret not available in Instagram settings",
      };
    }

    this.logger.log(`Using App ID: ${config.appId}`);
    this.logger.log(`Using App Secret: ${config.appSecret.substring(0, 10)}...`);

    const { appId, appSecret } = config;

    try {
      // Step 1: Exchange code for short-lived token
      this.logger.log("Step 1: Exchanging code for short-lived token...");
      const tokenParams = new URLSearchParams();
      tokenParams.append("client_id", appId);
      tokenParams.append("client_secret", appSecret);
      tokenParams.append("grant_type", "authorization_code");
      tokenParams.append("redirect_uri", redirectUri);
      tokenParams.append("code", code);

      const tokenResponse = await fetch(
        "https://api.instagram.com/oauth/access_token",
        {
          method: "POST",
          body: tokenParams,
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        this.logger.error(
          `Failed to exchange Instagram code: ${JSON.stringify(errorData)}`
        );
        return {
          correlationId,
          success: false,
          error: "Failed to connect to Instagram (Token Exchange)",
        };
      }

      const tokenData = (await tokenResponse.json()) as {
        data?: Array<{
          access_token: string;
          user_id: string;
          permissions: string;
        }>;
        access_token?: string;
        user_id?: number;
      };

      // Handle both response formats (old and new API)
      let shortLivedToken: string;
      let instagramUserId: string;

      if (tokenData.data && tokenData.data.length > 0) {
        // New format with data array
        shortLivedToken = tokenData.data[0].access_token;
        instagramUserId = tokenData.data[0].user_id;
        this.logger.log(`✓ Short-lived token obtained (new format)`);
        this.logger.log(`Instagram User ID: ${instagramUserId}`);
        this.logger.log(`Permissions: ${tokenData.data[0].permissions}`);
      } else if (tokenData.access_token && tokenData.user_id) {
        // Old format
        shortLivedToken = tokenData.access_token;
        instagramUserId = tokenData.user_id.toString();
        this.logger.log(`✓ Short-lived token obtained (old format)`);
        this.logger.log(`Instagram User ID: ${instagramUserId}`);
      } else {
        this.logger.error("Unexpected token response format");
        return {
          correlationId,
          success: false,
          error: "Unexpected token response format",
        };
      }

      // Step 2: Exchange for long-lived token
      this.logger.log("Step 2: Exchanging for long-lived token...");
      
      const longLivedParams = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: appSecret,
        access_token: shortLivedToken,
      });
      
      const longLivedResponse = await fetch(
        "https://graph.instagram.com/access_token",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      
      // Try with query params if POST fails
      const longLivedUrl = `https://graph.instagram.com/access_token?${longLivedParams.toString()}`;
      const longLivedResponseFinal = longLivedResponse.ok 
        ? longLivedResponse 
        : await fetch(longLivedUrl);

      if (!longLivedResponseFinal.ok) {
        const errorData = await longLivedResponseFinal.json();
        this.logger.error(
          `Failed to get long-lived token: ${JSON.stringify(errorData)}`
        );
        return {
          correlationId,
          success: false,
          error: "Failed to get long-lived token",
        };
      }

      const longLivedData = (await longLivedResponseFinal.json()) as {
        access_token: string;
        token_type: string;
        expires_in: number;
      };

      const accessToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in;
      const tokenExpiresAt = new Date(
        Date.now() + expiresIn * 1000
      ).toISOString();

      this.logger.log(`✓ Long-lived token obtained`);
      this.logger.log(
        `Token expires in: ${expiresIn} seconds (${Math.floor(expiresIn / 86400)} days)`
      );
      this.logger.log(`Token expires at: ${tokenExpiresAt}`);

      // Step 3: Get user profile information including both 'id' and 'user_id'
      // IMPORTANT: Instagram API returns both fields:
      // - 'user_id': Instagram User ID (from OAuth, app-scoped) - PRIORITY
      // - 'id': Instagram Business Account ID (fallback)
      // Following the same logic as the reference backend: user_id ?? id
      this.logger.log("Step 3: Fetching user profile information...");
      const userResponse = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,username,user_id,name,profile_picture_url,account_type&access_token=${accessToken}`
      );

      let username = "";
      let profilePictureUrl = "";
      let accountType = "";
      let instagramBusinessAccountId = instagramUserId; // Default fallback

      if (userResponse.ok) {
        const userData = await userResponse.json();
        username = userData.username || "";
        profilePictureUrl = userData.profile_picture_url || "";
        accountType = userData.account_type || "";

        // CRITICAL: Follow the same logic as reference backend
        // Priority: user_id (if exists) > id (fallback)
        // This is the ID that will be used to match webhooks
        if (userData.user_id) {
          instagramBusinessAccountId = userData.user_id;
          this.logger.log(`✓ Using user_id from /me: ${instagramBusinessAccountId}`);
        } else if (userData.id) {
          instagramBusinessAccountId = userData.id;
          this.logger.log(`✓ Using id from /me (fallback): ${instagramBusinessAccountId}`);
        }

        // Log both IDs for comparison
        this.logger.log(`  - user_id: ${userData.user_id || 'not present'}`);
        this.logger.log(`  - id: ${userData.id || 'not present'}`);
        this.logger.log(`  - Selected for pageId: ${instagramBusinessAccountId}`);

        this.logger.log(`✓ Profile information obtained:`);
        this.logger.log(`  - Username: @${username}`);
        this.logger.log(`  - Account Type: ${accountType}`);
        this.logger.log(
          `  - Profile Picture: ${profilePictureUrl ? "Yes" : "No"}`
        );
      } else {
        this.logger.warn("Failed to fetch user profile information");
      }


      // Log summary of ID discovery
      if (instagramBusinessAccountId === instagramUserId) {
        this.logger.warn("⚠️  WARNING: Instagram Business Account ID not found separately");
        this.logger.warn("⚠️  Using Instagram User ID as pageId: " + instagramUserId);
        this.logger.warn("⚠️  This may work if the account is a Business/Creator account");
        this.logger.warn("⚠️  If webhooks don't match, the account may need to be converted to Business");
      } else {
        this.logger.log("✅ SUCCESS: Instagram Business Account ID obtained");
        this.logger.log(`   - Instagram User ID (OAuth): ${instagramUserId}`);
        this.logger.log(`   - Instagram Business Account ID (Webhooks): ${instagramBusinessAccountId}`);
      }

      // Final payload
      const finalPayload = {
        accessToken,
        pageId: instagramBusinessAccountId, // This is the ID that will come in webhooks
        instagramBusinessAccountId: instagramBusinessAccountId, // Explicit field
        igUserId: instagramUserId, // Instagram App-scoped User ID
        tokenExpiresAt,
        name: username ? `@${username}` : `Instagram User ${instagramUserId}`,
        username: username,
        profilePictureUrl: profilePictureUrl,
        accountType: accountType,
        connected: true,
      };

      this.logger.log("=== FINAL PAYLOAD ===");
      this.logger.log(JSON.stringify(finalPayload, null, 2));
      this.logger.log("=== IMPORTANT ===");
      this.logger.log(`pageId (for webhooks): ${instagramBusinessAccountId}`);
      this.logger.log(`igUserId (from auth): ${instagramUserId}`);
      this.logger.log(
        `Expected in webhooks: ${instagramBusinessAccountId} (if Business Account found) or ${instagramUserId} (fallback)`
      );

      const subscriptionResult = await this.subscribeWebhook(
        instagramBusinessAccountId,
        accessToken
      );

      if (!subscriptionResult.success) {
        this.logger.warn(
          `Instagram connected but webhook subscription is incomplete: ${subscriptionResult.error}`
        );
      }

      this.logger.log("=== INSTAGRAM CONNECT - END ===");

      return {
        correlationId,
        success: true,
        data: finalPayload,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to connect Instagram channel: ${errorMessage}`);
      this.logger.error("=== INSTAGRAM CONNECT - FAILED ===");
      return { correlationId, success: false, error: errorMessage };
    }
  }

  async disconnect(
    pageId: string,
    accessToken: string
  ): Promise<void> {
    await fetch(`https://graph.instagram.com/v21.0/${pageId}/subscribed_apps`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  getRequiredWebhookFields(): string[] {
    return [...INSTAGRAM_REQUIRED_WEBHOOK_FIELDS];
  }

  isWebhookSubscriptionComplete(subscribedFields: string[] = []): boolean {
    return INSTAGRAM_REQUIRED_WEBHOOK_FIELDS.every((field) =>
      subscribedFields.includes(field)
    );
  }

  async subscribeWebhook(
    pageId: string,
    accessToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `https://graph.instagram.com/v21.0/${pageId}/subscribed_apps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscribed_fields: this.getRequiredWebhookFields(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        return {
          success: false,
          error: errorData,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async refreshToken(
    channelId: string,
    currentToken: string
  ): Promise<{ success: boolean; accessToken?: string; expiresAt?: Date; error?: string }> {
    try {
      const response = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(
          `Failed to refresh Instagram token for channel ${channelId}: ${error}`
        );
        return {
          success: false,
          error: `Failed to refresh token: ${error}`,
        };
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      const newToken = data.access_token;
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);

      // Update channel payload in database
      const sql = this.mainDatabaseService.getConnection();
      if (sql) {
        await sql`
          UPDATE channels 
          SET payload = jsonb_set(
            jsonb_set(payload, '{accessToken}', to_jsonb(${newToken}::text)),
            '{tokenExpiresAt}', to_jsonb(${expiresAt.toISOString()}::text)
          )
          WHERE id = ${channelId}
        `;
      }

      this.logger.log(`Successfully refreshed Instagram token for channel ${channelId}. New expiration: ${expiresAt.toISOString()}`);

      return {
        success: true,
        accessToken: newToken,
        expiresAt,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error refreshing Instagram token for channel ${channelId}: ${errorMessage}`
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateChannelInfo(
    channelId: string,
    accessToken: string
  ): Promise<{ success: boolean; username?: string; profilePictureUrl?: string; error?: string }> {
    try {
      const userResponse = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,username,account_type,profile_picture_url&access_token=${accessToken}`
      );

      if (!userResponse.ok) {
        const error = await userResponse.text();
        this.logger.error(
          `Failed to fetch Instagram user info for channel ${channelId}: ${error}`
        );
        return {
          success: false,
          error: `Failed to fetch user info: ${error}`,
        };
      }

      const userData = await userResponse.json();
      const username = userData.username || "";
      const profilePictureUrl = userData.profile_picture_url || "";

      // Update channel in database
      const sql = this.mainDatabaseService.getConnection();
      if (sql) {
        await sql`
          UPDATE channels 
          SET 
            name = ${username ? `@${username}` : `Instagram User`},
            payload = jsonb_set(
              jsonb_set(
                jsonb_set(payload, '{username}', to_jsonb(${username}::text)),
                '{profilePictureUrl}', to_jsonb(${profilePictureUrl}::text)
              ),
              '{igUserId}', to_jsonb(${userData.id}::text)
            )
          WHERE id = ${channelId}
        `;
      }

      this.logger.log(`Successfully updated Instagram channel info for ${channelId}: @${username}`);

      return {
        success: true,
        username,
        profilePictureUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error updating Instagram channel info for ${channelId}: ${errorMessage}`
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
