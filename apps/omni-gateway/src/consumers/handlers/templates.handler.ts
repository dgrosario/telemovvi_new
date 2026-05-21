import { Injectable } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import {
  GatewayRequest,
  GatewayResponse,
  TemplateListPayload,
  TemplateCreatePayload,
  TemplateDeletePayload,
  TemplateRetrievePayload,
} from "../interfaces/gateway-request.interface";
import { BaseHandler, ChannelRecord } from "./base.handler";

interface WhatsAppTemplate {
  name: string;
  status: string;
  category: string;
  language: string;
  id: string;
  components: Array<{
    type: string;
    text?: string;
    example?: {
      body_text_named_params?: Array<{ param_name: string; example: string }>;
    };
  }>;
}

@Injectable()
export class TemplatesHandler extends BaseHandler {
  constructor(mainDatabaseService: MainDatabaseService) {
    super(mainDatabaseService, TemplatesHandler.name);
  }

  async handleList(request: GatewayRequest<TemplateListPayload>): Promise<GatewayResponse> {
    const { correlationId, workspaceId, payload } = request;
    const channelType = payload?.channelType ?? "whatsapp";

    // Para WhatsApp, buscar todos os tipos de canais WhatsApp (whatsapp, meta_api, evolution)
    let channels: ChannelRecord[];
    if (channelType === "whatsapp") {
      const allChannels = await this.getChannelsByWorkspace(workspaceId);
      channels = allChannels.filter(
        (c) => c.type === "whatsapp" || c.type === "meta_api" || c.type === "evolution"
      );
    } else {
      channels = await this.getChannelsByWorkspace(workspaceId, channelType);
    }

    if (channels.length === 0) {
      return this.successResponse(correlationId, []);
    }

    const templates: Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      language: string;
      text: string;
      channelId: string;
      channel: {
        id: string;
        name: string;
        type: string;
        payload: Record<string, unknown>;
      };
      variables: Array<{ name: string }>;
    }> = [];

    for (const channel of channels) {
      const channelTemplates = await this.fetchWhatsAppTemplates(channel);
      templates.push(
        ...channelTemplates.map((t) => ({
          ...t,
          channelId: channel.id,
          channel: {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            payload: channel.payload,
          },
        }))
      );
    }

    return this.successResponse(correlationId, templates);
  }

  async handleListApproved(request: GatewayRequest<TemplateListPayload>): Promise<GatewayResponse> {
    const { correlationId, channelId } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    const templates = await this.fetchWhatsAppTemplates(channel);
    const approved = templates.filter((t) => t.status === "APPROVED");

    return this.successResponse(correlationId, approved);
  }

  async handleCreate(request: GatewayRequest<TemplateCreatePayload>): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    // Validar se é canal da API oficial
    if (channel.type !== "whatsapp" && channel.type !== "meta_api") {
      return this.errorResponse(
        correlationId, 
        `Templates are only supported for Official WhatsApp API channels (whatsapp, meta_api). Channel type: ${channel.type}`
      );
    }

    const whatsappPayload = channel.payload as { wabaId?: string; accessToken?: string };
    if (!whatsappPayload.wabaId || !whatsappPayload.accessToken) {
      return this.errorResponse(
        correlationId, 
        "Invalid WhatsApp channel: missing wabaId or accessToken. This channel is not configured for Official WhatsApp API."
      );
    }

    const body = {
      name: payload.name,
      language: payload.language,
      category: "UTILITY",
      parameter_format: "NAMED",
      components: [
        {
          type: "BODY",
          text: payload.text,
          example:
            payload.variables.length > 0
              ? {
                  body_text_named_params: payload.variables.map((v) => ({
                    param_name: v.name.replace(/{|}/g, ""),
                    example: v.example,
                  })),
                }
              : undefined,
        },
      ],
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${whatsappPayload.wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappPayload.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage =
        (error as { error?: { error_user_msg?: string } }).error?.error_user_msg ??
        "Failed to create template";
      return this.errorResponse(correlationId, errorMessage);
    }

    return this.successResponse(correlationId);
  }

  async handleDelete(request: GatewayRequest<TemplateDeletePayload>): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    const whatsappPayload = channel.payload as { wabaId?: string; accessToken?: string };
    if (!whatsappPayload.wabaId || !whatsappPayload.accessToken) {
      return this.errorResponse(correlationId, "Invalid WhatsApp channel payload");
    }

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${whatsappPayload.wabaId}/message_templates?name=${payload.templateName}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${whatsappPayload.accessToken}` },
      }
    );

    if (!response.ok) {
      return this.errorResponse(correlationId, "Failed to delete template");
    }

    return this.successResponse(correlationId);
  }

  async handleRetrieve(request: GatewayRequest<TemplateRetrievePayload>): Promise<GatewayResponse> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return this.errorResponse(correlationId, "Channel not found");
    }

    if (channel.type !== "whatsapp" && channel.type !== "meta_api") {
      return this.errorResponse(
        correlationId,
        `Template retrieve not supported for channel type: ${channel.type}`
      );
    }

    const whatsappPayload = channel.payload as { wabaId?: string; accessToken?: string };
    if (!whatsappPayload.wabaId || !whatsappPayload.accessToken) {
      return this.errorResponse(correlationId, "Invalid WhatsApp channel payload");
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${whatsappPayload.wabaId}/message_templates?name=${payload.templateName}`,
        { headers: { Authorization: `Bearer ${whatsappPayload.accessToken}` } }
      );

      if (!response.ok) {
        return this.errorResponse(correlationId, "Template not found");
      }

      const data = (await response.json()) as { data: WhatsAppTemplate[] };
      const template = data.data?.[0];

      if (!template) {
        return this.errorResponse(correlationId, "Template not found");
      }

      const body = template.components?.find((c) => c.type === "BODY");

      return this.successResponse(correlationId, {
        id: template.id,
        name: template.name,
        status: template.status,
        category: template.category,
        language: template.language,
        text: body?.text ?? "",
        channelId: channel.id,
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          payload: channel.payload,
        },
        variables: this.extractTemplateVariables(template),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse(correlationId, errorMessage);
    }
  }

  private async fetchWhatsAppTemplates(
    channel: ChannelRecord
  ): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      language: string;
      text: string;
      variables: Array<{ name: string }>;
    }>
  > {
    // Suporta canais whatsapp, meta_api e evolution com wabaId
    const whatsappPayload = channel.payload as { wabaId?: string; accessToken?: string };

    if (!whatsappPayload.wabaId || !whatsappPayload.accessToken) {
      this.logger.warn(`Channel ${channel.id} (${channel.type}) missing wabaId or accessToken`);
      return [];
    }

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${whatsappPayload.wabaId}/message_templates`,
      { headers: { Authorization: `Bearer ${whatsappPayload.accessToken}` } }
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { data: WhatsAppTemplate[] };

    return data.data.map((template) => {
      const body = template.components?.find((c) => c.type === "BODY");
      return {
        id: template.id,
        name: template.name,
        status: template.status,
        category: template.category,
        language: template.language,
        text: body?.text ?? "",
        variables: this.extractTemplateVariables(template),
      };
    });
  }

  private extractTemplateVariables(
    template: WhatsAppTemplate
  ): Array<{ name: string }> {
    const body = template.components?.find((c) => c.type === "BODY");
    if (!body) {
      return [];
    }

    const namedParams =
      body.example?.body_text_named_params
        ?.map((p) => p.param_name?.trim())
        .filter((name): name is string => Boolean(name)) ?? [];

    if (namedParams.length > 0) {
      return namedParams.map((name) => ({ name }));
    }

    const text = body.text ?? "";
    const matches = Array.from(text.matchAll(/{{\s*([^{}]+?)\s*}}/g));
    const unique = Array.from(
      new Set(
        matches
          .map((m) => m[1]?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );

    return unique.map((name) => ({ name }));
  }
}
