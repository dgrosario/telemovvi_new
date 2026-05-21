import { Injectable, Logger } from "@nestjs/common";
import { InstagramSettingsService } from "../../meta-settings/instagram-settings.service";
import {
  GatewayRequest,
  GatewayResponse,
  MetaGetEmbeddedLoginConfigPayload,
  MetaSaveSettingsPayload,
  MetaGetSettingsPayload,
  MetaSetActivePayload,
  MetaExchangeCodePayload,
} from "../interfaces/gateway-request.interface";
import { MainDatabaseService } from "../../database/main-database.service";

@Injectable()
export class InstagramGatewayRequestHandler {
  private readonly logger = new Logger(InstagramGatewayRequestHandler.name);

  constructor(
    private readonly instagramSettingsService: InstagramSettingsService,
    private readonly mainDatabaseService: MainDatabaseService
  ) {}

  async handleMetaGetEmbeddedLoginConfig(
    request: GatewayRequest<MetaGetEmbeddedLoginConfigPayload>
  ): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    const config = await this.instagramSettingsService.getEmbeddedLoginConfig(payload as any);

    if (!config) {
      return {
        correlationId,
        success: false,
        error: `No active Meta settings found for channel type: ${payload.channelType}`,
      };
    }

    return {
      correlationId,
      success: true,
      data: config,
    };
  }

  async handleMetaSaveSettings(
    request: GatewayRequest<MetaSaveSettingsPayload>
  ): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    try {
      const setting = await this.instagramSettingsService.saveSettings(payload as any);

      return {
        correlationId,
        success: true,
        data: {
          id: setting.id,
          channelType: setting.channelType,
          appId: setting.appId,
          configId: setting.configId,
          isActive: setting.isActive,
          createdAt: setting.createdAt.toISOString(),
          updatedAt: setting.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save Instagram settings";
      return { correlationId, success: false, error: errorMessage };
    }
  }

  async handleMetaGetSettings(
    request: GatewayRequest<MetaGetSettingsPayload>
  ): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    const setting = await this.instagramSettingsService.getSettingsWithSecret(payload as any);

    if (!setting) {
      return {
        correlationId,
        success: true,
        data: null,
      };
    }

    return {
      correlationId,
      success: true,
      data: {
        id: setting.id,
        channelType: setting.channelType,
        appId: setting.appId,
        appSecret: setting.appSecret,
        configId: setting.configId,
        isActive: setting.isActive,
        createdAt: setting.createdAt.toISOString(),
        updatedAt: setting.updatedAt.toISOString(),
      },
    };
  }

  async handleMetaSetActive(
    request: GatewayRequest<MetaSetActivePayload>
  ): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    try {
      await this.instagramSettingsService.setActive("instagram", payload.isActive);

      return { correlationId, success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update Instagram settings";
      return { correlationId, success: false, error: errorMessage };
    }
  }

  async handleMetaExchangeCode(
    request: GatewayRequest<MetaExchangeCodePayload>
  ): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    const result = await this.instagramSettingsService.exchangeCodeForToken(payload as any);

    if (!result) {
      return {
        correlationId,
        success: false,
        error: "Failed to exchange code for token",
      };
    }

    return {
      correlationId,
      success: true,
      data: result,
    };
  }

  async refreshInstagramToken(
    channelId: string,
    accessToken: string
  ): Promise<GatewayResponse> {
    try {
      const response = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(
          `Failed to refresh Instagram token for channel ${channelId}: ${error}`
        );
        return {
          correlationId: "",
          success: false,
          error: `Failed to refresh token: ${error}`,
        };
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      // Update channel payload in database
      const sql = this.mainDatabaseService.getConnection();
      if (sql) {
        const tokenExpiresAt = new Date(
          Date.now() + data.expires_in * 1000
        ).toISOString();
        
        await sql`
          UPDATE channels 
          SET payload = jsonb_set(
            jsonb_set(payload, '{accessToken}', ${JSON.stringify(data.access_token)}),
            '{tokenExpiresAt}', ${JSON.stringify(tokenExpiresAt)}
          )
          WHERE id = ${channelId}
        `;
      }

      return {
        correlationId: "",
        success: true,
        data: {
          accessToken: data.access_token,
          expiresIn: data.expires_in,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error refreshing Instagram token for channel ${channelId}: ${errorMessage}`
      );
      return {
        correlationId: "",
        success: false,
        error: errorMessage,
      };
    }
  }
}
