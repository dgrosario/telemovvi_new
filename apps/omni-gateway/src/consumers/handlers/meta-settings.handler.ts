import { Injectable } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import { MetaSettingsService } from "../../meta-settings/meta-settings.service";
import { InstagramGatewayRequestHandler } from "./instagram-gateway-request.handler";
import {
  GatewayRequest,
  GatewayResponse,
  MetaGetEmbeddedLoginConfigPayload,
  MetaSaveSettingsPayload,
  MetaGetSettingsPayload,
  MetaSetActivePayload,
  MetaExchangeCodePayload,
  MetaSaveSettingsPayloadWithOptionalConfigId,
} from "../interfaces/gateway-request.interface";
import { BaseHandler } from "./base.handler";

@Injectable()
export class MetaSettingsHandler extends BaseHandler {
  constructor(
    mainDatabaseService: MainDatabaseService,
    private readonly metaSettingsService: MetaSettingsService,
    private readonly instagramGatewayRequestHandler: InstagramGatewayRequestHandler
  ) {
    super(mainDatabaseService, MetaSettingsHandler.name);
  }

  async handleGetEmbeddedLoginConfig(
    request: GatewayRequest<MetaGetEmbeddedLoginConfigPayload>
  ): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    if (payload.channelType === "instagram") {
      return this.instagramGatewayRequestHandler.handleMetaGetEmbeddedLoginConfig(request);
    }

    const config = await this.metaSettingsService.getEmbeddedLoginConfig(payload.channelType);

    if (!config) {
      return this.errorResponse(
        correlationId,
        `No active Meta settings found for channel type: ${payload.channelType}`
      );
    }

    return this.successResponse(correlationId, config);
  }

  async handleSaveSettings(
    request: GatewayRequest<MetaSaveSettingsPayload | MetaSaveSettingsPayloadWithOptionalConfigId>
  ): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    try {
      if (payload.channelType === "instagram") {
        return this.instagramGatewayRequestHandler.handleMetaSaveSettings(
          request as GatewayRequest<MetaSaveSettingsPayload>
        );
      }

      const processedPayload = {
        ...payload,
        configId: payload.configId || "",
      };

      const setting = await this.metaSettingsService.saveSettings(processedPayload);

      return this.successResponse(correlationId, {
        id: setting.id,
        channelType: setting.channelType,
        appId: setting.appId,
        configId: setting.configId,
        isActive: setting.isActive,
        createdAt: setting.createdAt.toISOString(),
        updatedAt: setting.updatedAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save Meta settings";
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  async handleGetSettings(request: GatewayRequest<MetaGetSettingsPayload>): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    if (payload.channelType === "instagram") {
      return this.instagramGatewayRequestHandler.handleMetaGetSettings(request);
    }

    const setting = await this.metaSettingsService.getSettings(payload.channelType, true);

    if (!setting) {
      return this.successResponse(correlationId, null);
    }

    if (!("appSecret" in setting)) {
      return this.errorResponse(correlationId, "App Secret not available");
    }

    return this.successResponse(correlationId, {
      id: setting.id,
      channelType: setting.channelType,
      appId: setting.appId,
      appSecret: setting.appSecret,
      configId: setting.configId,
      isActive: setting.isActive,
      createdAt: setting.createdAt.toISOString(),
      updatedAt: setting.updatedAt.toISOString(),
    });
  }

  async handleGetAllSettings(request: GatewayRequest): Promise<GatewayResponse> {
    const { correlationId } = request;

    const settings = await this.metaSettingsService.getAllSettingsPublic();

    return this.successResponse(
      correlationId,
      settings.map((s) => ({
        id: s.id,
        channelType: s.channelType,
        appId: s.appId,
        configId: s.configId,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))
    );
  }

  async handleSetActive(request: GatewayRequest<MetaSetActivePayload>): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    try {
      if (payload.channelType === "instagram") {
        return this.instagramGatewayRequestHandler.handleMetaSetActive(request);
      }

      await this.metaSettingsService.setActive(payload.channelType, payload.isActive);

      return this.successResponse(correlationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update Meta settings";
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  async handleExchangeCode(request: GatewayRequest<MetaExchangeCodePayload>): Promise<GatewayResponse> {
    const { correlationId, payload } = request;

    if (payload.channelType === "instagram") {
      return this.instagramGatewayRequestHandler.handleMetaExchangeCode(request);
    }

    const result = await this.metaSettingsService.exchangeCodeForToken(payload.channelType, payload.code);

    if (!result) {
      return this.errorResponse(correlationId, "Failed to exchange code for token");
    }

    return this.successResponse(correlationId, result);
  }
}
