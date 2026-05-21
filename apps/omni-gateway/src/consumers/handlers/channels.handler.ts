import { Injectable } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import { EvolutionApiService, EvolutionInstance } from "../../channel-apis/evolution-api.service";
import { MetaSettingsService } from "../../meta-settings/meta-settings.service";
import { RabbitMQManagementService } from "../../rabbitmq/rabbitmq-management.service";
import { InstagramGatewayHandler } from "./instagram-gateway.handler";
import {
  GatewayRequest,
  GatewayResponse,
  ChannelConnectPayload,
  ChannelDisconnectPayload,
  ChannelRemovePayload,
  ChannelInfoResponse,
  ChannelsSyncStatusPayload,
  ChannelsSyncStatusResponse,
  EvolutionListInstancesResponse,
  EvolutionRemoveInstancePayload,
  EvolutionRemoveInstanceResponse,
} from "../interfaces/gateway-request.interface";
import { BaseHandler } from "./base.handler";

@Injectable()
export class ChannelsHandler extends BaseHandler {
  constructor(
    mainDatabaseService: MainDatabaseService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly instagramGatewayHandler: InstagramGatewayHandler,
    private readonly metaSettingsService: MetaSettingsService,
    private readonly rabbitMQManagement: RabbitMQManagementService
  ) {
    super(mainDatabaseService, ChannelsHandler.name);
  }

  async handleConnect(request: GatewayRequest<ChannelConnectPayload>): Promise<GatewayResponse> {
    const { correlationId, workspaceId, payload } = request;
    const { channelId, channelName, channelType, code, wabaId, metaApiConfig, redirectUri } = payload;

    let connectResult: GatewayResponse;

    switch (channelType) {
      case "evolution": {
        const existingInstanceName = await this.resolveExistingInstanceName(channelId);
        connectResult = await this.connectEvolutionChannel(
          correlationId,
          channelName,
          workspaceId,
          existingInstanceName,
          payload.forceNewInstance
        );
        break;
      }
      case "instagram":
        if (!code) return this.errorResponse(correlationId, "Missing code for Instagram");
        connectResult = await this.instagramGatewayHandler.connect(correlationId, code, redirectUri ?? "");
        break;
      case "whatsapp":
        if (!code) return this.errorResponse(correlationId, "Missing code for WhatsApp");
        connectResult = await this.connectWhatsAppEmbeddedChannel(correlationId, code, wabaId);
        break;
      case "meta_api":
        if (!metaApiConfig) return this.errorResponse(correlationId, "Missing config for Meta API");
        connectResult = await this.connectMetaApiChannel(correlationId, metaApiConfig);
        break;
      default:
        return this.errorResponse(correlationId, `Unsupported channel type: ${channelType}`);
    }

    if (connectResult.success && channelId) {
      await this.updateChannelPayload(channelId, connectResult.data as Record<string, unknown>, channelType);
    }

    return connectResult;
  }

  async handleDisconnect(request: GatewayRequest<ChannelDisconnectPayload>): Promise<GatewayResponse> {
    const { correlationId, channelId } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    try {
      if (channel.type === "evolution") {
        const instanceName = (channel.payload as { instanceName?: string }).instanceName;
        if (instanceName) {
          await this.disconnectEvolutionChannel(instanceName);
          // Clean up RabbitMQ queues for this instance
          await this.rabbitMQManagement.deleteInstanceQueues(instanceName);
        }
      } else if (channel.type === "instagram") {
        const payload = channel.payload as { accessToken?: string; pageId?: string };
        if (payload.accessToken && payload.pageId) {
          await this.instagramGatewayHandler.disconnect(payload.pageId, payload.accessToken);
        }
      }

      await this.updateChannelStatus(channelId, "disconnected");
      return this.successResponse(correlationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  async handleInfo(request: GatewayRequest): Promise<GatewayResponse<ChannelInfoResponse>> {
    const { correlationId, channelId } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return { correlationId, success: false, error: "Channel not found" };
    }

    if (channel.type !== "evolution") {
      return { correlationId, success: false, error: "Only Evolution channels supported" };
    }

    const instanceName = (channel.payload as { instanceName?: string }).instanceName;
    if (!instanceName) {
      return { correlationId, success: false, error: "Instance name not found" };
    }

    const instances = await this.evolutionApi.fetchInstances(instanceName);
    const instance = instances.find((i) => i.name === instanceName);

    if (!instance) {
      return { correlationId, success: false, error: "Instance not found" };
    }

    const phoneNumber = instance.number ?? (instance.ownerJid?.replace("@s.whatsapp.net", "") ?? null);

    return {
      correlationId,
      success: true,
      data: {
        instanceId: instance.id,
        instanceName: instance.name,
        phoneNumber,
        connected: instance.connectionStatus === "open",
      },
    };
  }

  async handleListEvolutionInstances(
    request: GatewayRequest
  ): Promise<GatewayResponse<EvolutionListInstancesResponse>> {
    const { correlationId } = request;

    try {
      const instances = await this.evolutionApi.fetchAllInstances();
      return this.successResponse(correlationId, {
        instances: instances.map((instance) => ({
          id: instance.id,
          name: instance.name,
          connectionStatus: instance.connectionStatus,
          number: instance.number,
          ownerJid: instance.ownerJid,
        })),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse(
        correlationId,
        errorMessage
      ) as GatewayResponse<EvolutionListInstancesResponse>;
    }
  }

  async handleRemoveEvolutionInstance(
    request: GatewayRequest<EvolutionRemoveInstancePayload>
  ): Promise<GatewayResponse<EvolutionRemoveInstanceResponse>> {
    const { correlationId, payload } = request;
    const instanceName = payload?.instanceName?.trim();

    if (!instanceName) {
      return this.errorResponse(
        correlationId,
        "instanceName is required"
      ) as GatewayResponse<EvolutionRemoveInstanceResponse>;
    }

    let disconnected = false;
    let deleted = false;
    let queuesCleaned = false;

    try {
      try {
        await this.disconnectEvolutionChannel(instanceName);
        disconnected = true;
      } catch (error) {
        this.logger.warn(
          `[EvolutionCleanup] Failed to logout instance ${instanceName}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      await this.deleteEvolutionInstance(instanceName);
      deleted = true;

      try {
        await this.rabbitMQManagement.deleteInstanceQueues(instanceName);
        queuesCleaned = true;
      } catch (error) {
        this.logger.warn(
          `[EvolutionCleanup] Failed to delete queues for ${instanceName}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      return this.successResponse(correlationId, {
        instanceName,
        disconnected,
        deleted,
        queuesCleaned,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse(
        correlationId,
        errorMessage
      ) as GatewayResponse<EvolutionRemoveInstanceResponse>;
    }
  }

  async handleSyncStatus(
    request: GatewayRequest<ChannelsSyncStatusPayload>
  ): Promise<GatewayResponse<ChannelsSyncStatusResponse>> {
    const { correlationId, payload } = request;

    if (!payload.channels || payload.channels.length === 0) {
      return { correlationId, success: true, data: { statuses: [] } };
    }

    try {
      const allInstances = await this.evolutionApi.fetchAllInstances();

      const statuses = payload.channels.map(({ channelId, instanceName }) => {
        const instance = allInstances.find((i) => i.name === instanceName);
        const status: "connected" | "disconnected" =
          instance?.connectionStatus === "open" ? "connected" : "disconnected";
        return { channelId, status };
      });

      this.logger.debug(
        `Synced status for ${payload.channels.length} channels: ${statuses.map((s) => `${s.channelId}=${s.status}`).join(", ")}`
      );

      return { correlationId, success: true, data: { statuses } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to sync channel statuses: ${errorMessage}`);
      return { correlationId, success: false, error: `Failed to sync statuses: ${errorMessage}` };
    }
  }

  async handleRemove(request: GatewayRequest<ChannelRemovePayload>): Promise<GatewayResponse> {
    const { correlationId, payload } = request;
    const { channelId } = payload;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    try {
      if (channel.type === "evolution") {
        const instanceName = (channel.payload as { instanceName?: string }).instanceName;
        if (instanceName) {
          try {
            await this.disconnectEvolutionChannel(instanceName);
          } catch (error) {
            this.logger.warn(`Failed to logout Evolution instance ${instanceName}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }

          await this.deleteEvolutionInstance(instanceName);
          await this.rabbitMQManagement.deleteInstanceQueues(instanceName);
        }
      } else if (channel.type === "instagram") {
        const instagramPayload = channel.payload as { accessToken?: string; pageId?: string };
        if (instagramPayload.accessToken && instagramPayload.pageId) {
          try {
            await this.instagramGatewayHandler.disconnect(instagramPayload.pageId, instagramPayload.accessToken);
          } catch (error) {
            this.logger.warn(`Failed to disconnect Instagram channel ${channelId}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }
      }

      await this.updateChannelStatus(channelId, "disconnected");
      return this.successResponse(correlationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to remove channel ${channelId}: ${errorMessage}`);
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  private async deleteEvolutionInstance(instanceName: string): Promise<void> {
    const evolutionUrl = process.env.EVOLUTION_URL;
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;
    if (!evolutionUrl || !evolutionApiKey) return;

    const response = await this.fetchWithTimeout(
      `${evolutionUrl}/instance/delete/${instanceName}`,
      { method: "DELETE", headers: { apikey: evolutionApiKey } }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to delete Evolution instance: ${errorText}`);
    }

    this.logger.log(`Evolution instance ${instanceName} deleted`);
  }

  private async connectMetaApiChannel(
    correlationId: string,
    config: NonNullable<ChannelConnectPayload["metaApiConfig"]>
  ): Promise<GatewayResponse> {
    const { appId, appSecret, accessToken, wabaId, phoneId, businessId, verifyToken } = config;

    if (!appSecret || appSecret.length < 32) {
      return this.errorResponse(correlationId, "App Secret inválido - deve ter pelo menos 32 caracteres");
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v23.0/${phoneId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        return this.errorResponse(correlationId, "Phone Number ID inválido ou token sem permissão");
      }

      const phoneData = (await response.json()) as {
        id?: string;
        display_phone_number?: string;
        verified_name?: string;
      };

      if (!phoneData.id) {
        return this.errorResponse(correlationId, "Phone Number ID inválido ou token sem permissão");
      }

      const phoneNumber = phoneData.display_phone_number || phoneData.verified_name || phoneId;

      return this.successResponse(correlationId, {
        appId,
        appSecret,
        accessToken,
        wabaId,
        phoneId,
        phoneNumber,
        businessId,
        verifyToken,
        connected: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  private async resolveExistingInstanceName(channelId?: string): Promise<string | undefined> {
    if (!channelId) return undefined;

    try {
      const channel = await this.getChannelById(channelId);
      if (channel?.type !== "evolution" || !channel.payload) return undefined;

      return (channel.payload as { instanceName?: string }).instanceName;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve existing instance name for channel ${channelId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return undefined;
    }
  }

  private async connectEvolutionChannel(
    correlationId: string,
    channelName: string,
    workspaceId: string,
    existingInstanceName?: string,
    forceNewInstance?: boolean
  ): Promise<GatewayResponse> {
    const evolutionUrl = process.env.EVOLUTION_URL;
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;

    if (!evolutionUrl || !evolutionApiKey) {
      return this.errorResponse(correlationId, "Evolution API not configured");
    }

    const instanceName = existingInstanceName
      || `${channelName.toLowerCase().replace(/\s/g, "")}-${workspaceId}`;

    try {
      if (forceNewInstance) {
        try {
          await this.deleteEvolutionInstance(instanceName);
          this.logger.log(`[forceNewInstance] Deleted existing instance: ${instanceName}`);
        } catch {
          // Instance did not exist, ok
        }
        try {
          await this.rabbitMQManagement.deleteInstanceQueues(instanceName);
        } catch {
          // Queues did not exist, ok
        }
      }

      const fetchResponse = await this.fetchWithTimeout(
        `${evolutionUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
        { headers: { apikey: evolutionApiKey } }
      );

      const responseData: unknown = await fetchResponse.json();

      let instances: EvolutionInstance[] = [];

      if (Array.isArray(responseData)) {
        instances = responseData;
      } else if (responseData && typeof responseData === "object" && "name" in responseData) {
        instances = [responseData as EvolutionInstance];
      }

      const existingInstance = instances.find((i) => i.name === instanceName);

      if (existingInstance) {
        await this.ensureEvolutionRabbitMQConfig(evolutionUrl, evolutionApiKey, instanceName);

        const existingPhoneNumber =
          existingInstance.number ?? existingInstance.ownerJid?.replace("@s.whatsapp.net", "") ?? null;

        if (existingInstance.connectionStatus === "open") {
          return this.successResponse(correlationId, {
            instanceId: existingInstance.id,
            instanceName: existingInstance.name,
            qrcode: null,
            connected: true,
            phoneNumber: existingPhoneNumber,
          });
        }

        const connectResponse = await this.fetchWithTimeout(
          `${evolutionUrl}/instance/connect/${instanceName}`,
          { headers: { apikey: evolutionApiKey } }
        );
        const connectData = (await connectResponse.json()) as { base64?: string };

        return this.successResponse(correlationId, {
          instanceId: existingInstance.id,
          instanceName: existingInstance.name,
          qrcode: connectData.base64 ?? null,
          connected: false,
          phoneNumber: existingPhoneNumber,
        });
      }

      const createPayload = {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        rejectCall: true,
        rabbitmq: {
          enabled: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "CONTACTS_UPSERT",
            "PRESENCE_UPDATE",
          ],
        },
      };

      const createResponse = await this.fetchWithTimeout(
        `${evolutionUrl}/instance/create`,
        {
          method: "POST",
          headers: {
            apikey: evolutionApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createPayload),
        }
      );

      const createData: unknown = await createResponse.json();

      if (!createResponse.ok) {
        const errorMsg =
          createData && typeof createData === "object" && "message" in createData
            ? String((createData as Record<string, unknown>).message)
            : `Evolution API returned ${createResponse.status}`;
        this.logger.error(
          `[connectEvolutionChannel] instance/create failed: ${errorMsg}`,
          createData
        );
        return this.errorResponse(
          correlationId,
          `Falha ao criar instancia Evolution: ${errorMsg}`
        );
      }

      if (
        !createData ||
        typeof createData !== "object" ||
        !("instance" in createData) ||
        !createData.instance ||
        typeof createData.instance !== "object" ||
        !("instanceId" in createData.instance)
      ) {
        this.logger.error(
          "[connectEvolutionChannel] Unexpected instance/create response format",
          createData
        );
        return this.errorResponse(
          correlationId,
          "Resposta inesperada da Evolution API ao criar instancia"
        );
      }

      const instance = createData.instance as {
        instanceId: string;
        instanceName: string;
      };
      const qrcode =
        "qrcode" in createData &&
        createData.qrcode &&
        typeof createData.qrcode === "object"
          ? (createData.qrcode as { base64?: string })
          : null;

      return this.successResponse(correlationId, {
        instanceId: instance.instanceId,
        instanceName: instance.instanceName,
        qrcode: qrcode?.base64 ?? null,
        connected: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  private async disconnectEvolutionChannel(instanceName: string): Promise<void> {
    const evolutionUrl = process.env.EVOLUTION_URL;
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;

    if (!evolutionUrl || !evolutionApiKey) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers: { apikey: evolutionApiKey },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to logout Evolution instance: ${errorText}`);
      }

      this.logger.log(`Evolution instance ${instanceName} disconnected (logout)`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.warn(`Timeout disconnecting Evolution instance: ${instanceName}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async ensureEvolutionRabbitMQConfig(
    baseUrl: string,
    apiKey: string,
    instanceName: string
  ): Promise<void> {
    try {
      await this.fetchWithTimeout(
        `${baseUrl}/rabbitmq/set/${instanceName}`,
        {
          method: "POST",
          headers: {
            apikey: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: true,
            events: [
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "MESSAGES_DELETE",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED",
            ],
          }),
        },
        10000
      );
    } catch {
      this.logger.warn(`Could not set RabbitMQ config for instance: ${instanceName}`);
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 20000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async connectWhatsAppEmbeddedChannel(
    correlationId: string,
    code: string,
    wabaId?: string
  ): Promise<GatewayResponse> {
    const metaSettings = await this.metaSettingsService.getSettings("whatsapp", true);

    if (!metaSettings) {
      return this.errorResponse(
        correlationId,
        "Configuracoes do WhatsApp nao encontradas. Configure em Sistema > Configuracoes Meta."
      );
    }

    if (!("appSecret" in metaSettings)) {
      return this.errorResponse(correlationId, "App Secret nao disponivel nas configuracoes");
    }

    const { appId, appSecret } = metaSettings;

    if (!appId || !appSecret) {
      return this.errorResponse(correlationId, "App ID ou App Secret nao configurados para WhatsApp");
    }

    try {
      // Exchange code for short-lived token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        this.logger.error("Failed to exchange code for token:", errorData);
        return this.errorResponse(
          correlationId,
          `Falha ao trocar codigo por token: ${(errorData as { error?: { message?: string } }).error?.message || "Erro desconhecido"}`
        );
      }

      const tokenData = (await tokenResponse.json()) as { access_token: string };

      if (!tokenData.access_token) {
        return this.errorResponse(correlationId, "Token de acesso nao recebido");
      }

      // Exchange for long-lived token
      const longLivedTokenResponse = await fetch(
        `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
      );

      const longLivedTokenData = (await longLivedTokenResponse.json()) as {
        access_token: string;
        token_type: string;
        expires_in?: number;
      };

      const accessToken = longLivedTokenData.access_token || tokenData.access_token;

      // Get WABA ID if not provided
      let effectiveWabaId = wabaId;
      if (!effectiveWabaId) {
        const wabaResponse = await fetch(
          `https://graph.facebook.com/v23.0/me/businesses?fields=owned_whatsapp_business_accounts&access_token=${accessToken}`
        );
        const wabaData = (await wabaResponse.json()) as {
          data?: Array<{
            owned_whatsapp_business_accounts?: {
              data?: Array<{ id: string }>;
            };
          }>;
        };

        effectiveWabaId = wabaData.data?.[0]?.owned_whatsapp_business_accounts?.data?.[0]?.id;
      }

      if (!effectiveWabaId) {
        return this.errorResponse(
          correlationId,
          "WABA ID nao encontrado. Certifique-se de que a conta do WhatsApp Business esta configurada."
        );
      }

      // Get phone numbers
      const phoneNumbersResponse = await fetch(
        `https://graph.facebook.com/v23.0/${effectiveWabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${accessToken}`
      );
      const phoneNumbersData = (await phoneNumbersResponse.json()) as {
        data?: Array<{
          id: string;
          display_phone_number: string;
          verified_name?: string;
        }>;
      };

      const phoneNumber = phoneNumbersData.data?.[0];
      if (!phoneNumber) {
        return this.errorResponse(
          correlationId,
          "Nenhum numero de telefone encontrado na conta do WhatsApp Business"
        );
      }

      // Get WABA details for business ID
      const wabaDetailsResponse = await fetch(
        `https://graph.facebook.com/v23.0/${effectiveWabaId}?fields=id,name,on_behalf_of_business_info&access_token=${accessToken}`
      );
      const wabaDetails = (await wabaDetailsResponse.json()) as {
        id: string;
        name?: string;
        on_behalf_of_business_info?: { id: string };
      };

      const businessId = wabaDetails.on_behalf_of_business_info?.id;
      const verifyToken = crypto.randomUUID();

      // Subscribe webhook automatically
      const webhookSubscribed = await this.subscribeWhatsAppWebhook(
        effectiveWabaId,
        accessToken,
        verifyToken
      );

      if (!webhookSubscribed) {
        this.logger.warn(`Failed to subscribe webhook for WABA ${effectiveWabaId}, but connection will proceed`);
      }

      return this.successResponse(correlationId, {
        appId,
        appSecret,
        accessToken,
        wabaId: effectiveWabaId,
        phoneId: phoneNumber.id,
        phoneNumber: phoneNumber.display_phone_number,
        verifiedName: phoneNumber.verified_name,
        businessId,
        verifyToken,
        connected: true,
        webhookSubscribed,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("WhatsApp Embedded Signup error:", error);
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  private async subscribeWhatsAppWebhook(
    wabaId: string,
    accessToken: string,
    verifyToken: string
  ): Promise<boolean> {
    const gatewayPublicUrl = process.env.GATEWAY_PUBLIC_URL;

    if (!gatewayPublicUrl) {
      this.logger.error("GATEWAY_PUBLIC_URL not configured - cannot subscribe webhook");
      return false;
    }

    const webhookUrl = `${gatewayPublicUrl}/webhooks/meta`;

    try {
      this.logger.log(`Subscribing webhook for WABA ${wabaId} to ${webhookUrl}`);

      const response = await fetch(
        `https://graph.facebook.com/v24.0/${wabaId}/subscribed_apps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            override_callback_uri: webhookUrl,
            verify_token: verifyToken,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Failed to subscribe webhook: ${errorData}`);
        return false;
      }

      const result = (await response.json()) as { success: boolean };
      this.logger.log(`Webhook subscription result for WABA ${wabaId}: ${result.success}`);
      return result.success;
    } catch (error) {
      this.logger.error(`Error subscribing webhook for WABA ${wabaId}:`, error);
      return false;
    }
  }
}
