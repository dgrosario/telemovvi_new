"use server";
import {
  Channel,
  ChannelPayload,
  getChannelFamily,
  getPayloadProperty,
  MetaApiChannelPayload,
  sanitizeChannelPayload,
  WHATSAPP_FAMILY,
} from "@omnichannel/core/domain/entities/channel";
import { ChannelsDatabaseRepository } from "@omnichannel/core/infra/repositories/channels-repository";
import { ListMyChannels } from "@omnichannel/core/application/command/list-my-channels";
import z from "zod";
import { securityProcedure } from "../procedure";
import {
  reconnectChannelInputSchema,
  registerReceivedChannelInputSchema,
  updateChannelWithPayloadSchema,
  upsertChannelInputSchema,
} from "./schema";
import { NotFound } from "@omnichannel/core/domain/errors/not-found";
import { gatewayActions } from "@/lib/gateway-client";

const channelsRepository = ChannelsDatabaseRepository.instance();

export const listChannels = securityProcedure([
  "manage:connections",
  "list:connections",
])
  .input(
    z
      .object({
        type: z.string().optional(),
      })
      .optional()
  )
  .handler(async ({ ctx, input }) => {
    const channels = await channelsRepository.list(
      ctx.membership.workspaceId,
      input?.type as Channel.Type
    );

    const evolutionChannels = channels.filter(
      (c) =>
        c.type === "evolution" &&
        c.payload &&
        typeof c.payload === "object" &&
        "instanceName" in c.payload &&
        typeof c.payload.instanceName === "string"
    );

    const SYNC_GRACE_MS = 5 * 60_000;
    const channelsToSync = evolutionChannels.filter((c) => {
      const payload = c.payload as Record<string, unknown>;
      if (payload?.importedOnly === true) return false;
      const reconnectedAt = payload?.reconnectedAt;
      return !(typeof reconnectedAt === "number" && Date.now() - reconnectedAt < SYNC_GRACE_MS);
    });

    if (channelsToSync.length > 0) {
      try {
        const syncResult = await gatewayActions.syncChannelStatuses(
          ctx.membership.workspaceId,
          channelsToSync.map((c) => ({
            channelId: c.id,
            instanceName: (c.payload as { instanceName: string }).instanceName,
          }))
        );

        if (syncResult.success && syncResult.data?.statuses) {
          for (const { channelId, status } of syncResult.data.statuses) {
            const channel = channels.find((c) => c.id === channelId);
            if (channel && channel.status !== status) {
              await channelsRepository.updateStatus(channelId, status);
              channel.status = status;
            }
          }
        }
      } catch (error) {
        console.error("[listChannels] Falha ao sincronizar status:", error);
      }
    }

    return channels.map((channel) => ({
      ...channel,
      payload: sanitizeChannelPayload(channel.payload),
    }));
  });

export const upsertChannel = securityProcedure([
  "manage:connections",
  "register:connections",
])
  .input(upsertChannelInputSchema)
  .handler(async ({ input, ctx }) => {
    // Validar conexão com Evolution API antes de criar canal WhatsApp/Evolution
    if (input.type === "evolution" || input.type === "whatsapp") {
      const healthCheck = await gatewayActions.checkEvolutionHealth();
      
      if (!healthCheck.success) {
        throw new Error("Não foi possível verificar a conexão com a Evolution API");
      }
      
      if (!healthCheck.data?.healthy) {
        throw new Error(
          healthCheck.data?.error || 
          "Evolution API não está configurada corretamente. Verifique as configurações do servidor."
        );
      }
    }

    let channel;

    if (typeof input.id === "string" && input.id.trim() !== "") {
      channel = await channelsRepository.retrieve(input.id ?? "");
    }

    if (!channel) {
      channel = Channel.create(input.name, input.type as Channel.Type);
    } else {
      channel.rename(input.name);
    }

    await channelsRepository.upsert(channel, ctx.membership.workspaceId);
  });

export const retrieveChannel = securityProcedure([
  "manage:connections",
  "list:connections",
])
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const channel = await channelsRepository.retrieve(input.id);
    if (!channel) throw NotFound.throw("Channel");
    return channel.raw();
  });

export const updateChannelWithPayload = securityProcedure([
  "manage:connections",
  "register:connections",
])
  .input(updateChannelWithPayloadSchema)
  .handler(async ({ input, ctx }) => {
    const channel = await channelsRepository.retrieve(input.id);
    if (!channel) throw NotFound.throw("Channel");

    channel.rename(input.name);

    if (input.payload && channel.type === "meta_api") {
      const currentPayload = channel.payload as MetaApiChannelPayload;
      const newPayload: MetaApiChannelPayload = {
        appId: input.payload.appId || currentPayload.appId,
        appSecret: input.payload.appSecret || currentPayload.appSecret,
        accessToken: input.payload.accessToken || currentPayload.accessToken,
        wabaId: input.payload.wabaId || currentPayload.wabaId,
        phoneId: input.payload.phoneId || currentPayload.phoneId,
        businessId: input.payload.businessId || currentPayload.businessId,
        verifyToken: input.payload.verifyToken || currentPayload.verifyToken,
        phoneNumber: currentPayload.phoneNumber,
      };
      channel.payload = newPayload;
    }

    await channelsRepository.upsert(channel, ctx.membership.workspaceId);
  });

export const retrieveChannelQRCode = securityProcedure([
  "manage:connections",
  "start:connections",
])
  .input(z.object({ id: z.string() }))
  .handler(async ({ ctx, input }) => {
    const channel = await channelsRepository.retrieve(input.id);
    if (!channel) return { qrcode: "", status: "disconnected" as const };

    const qrcode = getPayloadProperty(channel.payload, "qrcode");
    let status = channel.status as "connected" | "disconnected";

    if (channel.type === "evolution") {
      const reconnectedAt = (channel.payload as Record<string, unknown>)?.reconnectedAt;
      const inGracePeriod = typeof reconnectedAt === "number" && Date.now() - reconnectedAt < 5 * 60_000;

      if (!inGracePeriod) {
        const instanceName = getPayloadProperty(channel.payload, "instanceName");
        if (instanceName) {
          try {
            const syncResult = await gatewayActions.syncChannelStatuses(
              ctx.membership.workspaceId,
              [{ channelId: input.id, instanceName }]
            );

            if (syncResult.success && syncResult.data?.statuses?.[0]) {
              const realStatus = syncResult.data.statuses[0].status;

              if (realStatus !== status) {
                console.log(`[retrieveChannelQRCode] Status changed from ${status} to ${realStatus}`);
                status = realStatus;

                if (realStatus === "connected") {
                  const updatedPayload = { ...channel.payload, qrcode: null } as typeof channel.payload;
                  channel.payload = updatedPayload;
                  channel.status = "connected";
                } else {
                  channel.status = "disconnected";
                }
                await channelsRepository.upsert(channel, ctx.membership.workspaceId);
              }
            }
          } catch (error) {
            console.error("[retrieveChannelQRCode] Failed to sync status:", error);
          }
        }
      }
    }

    return {
      qrcode: status === "connected" ? "" : (qrcode ?? ""),
      status
    };
  });

export const checkPendingInstanceStatus = securityProcedure([
  "manage:connections",
  "start:connections",
])
  .input(z.object({ channelId: z.string(), instanceName: z.string() }))
  .handler(async ({ ctx, input }) => {
    try {
      const result = await gatewayActions.syncChannelStatuses(
        ctx.membership.workspaceId,
        [{ channelId: input.channelId, instanceName: input.instanceName }]
      );
      const status =
        result.success && result.data?.statuses?.[0]?.status === "connected"
          ? ("connected" as const)
          : ("disconnected" as const);
      return { status };
    } catch (error) {
      console.error("[checkPendingInstanceStatus] Falha ao verificar status:", error);
      return { status: "disconnected" as const };
    }
  });

export const cleanupPendingInstance = securityProcedure(["manage:connections"])
  .input(z.object({ instanceName: z.string() }))
  .handler(async ({ input }) => {
    const result = await gatewayActions.removeEvolutionInstance(input.instanceName);
    if (!result.success) {
      console.error("[cleanupPendingInstance] Falha:", result.error);
    }
  });

async function restoreInstanceNameIfChanged(
  channelId: string,
  previousInstanceName: string,
  workspaceId: string
): Promise<void> {
  const channel = await channelsRepository.retrieve(channelId);
  if (!channel) return;

  const currentInstanceName = getPayloadProperty(channel.payload, "instanceName");
  if (!currentInstanceName || currentInstanceName === previousInstanceName) return;

  channel.payload = { ...channel.payload, instanceName: previousInstanceName };
  await channelsRepository.upsert(channel, workspaceId);
}

export const connectChannel = securityProcedure([
  "manage:connections",
  "start:connections",
])
  .input(
    z.object({
      id: z.string(),
      type: z.string(),
      inputPayload: z.any().optional(),
      forceNewInstance: z.boolean().optional(),
    })
  )
  .onError(async (err) => console.error("[connectChannel]", err))
  .handler(async ({ ctx, input }) => {
    if (!input.id) {
      throw new Error("ID do canal não fornecido");
    }

    const channel = await channelsRepository.retrieve(input.id);
    if (!channel) {
      throw new Error(`Canal não encontrado (ID: ${input.id})`);
    }

    const previousInstanceName = channel.type === "evolution"
      ? getPayloadProperty(channel.payload, "instanceName")
      : undefined;

    const channelType = input.type as
      | "whatsapp"
      | "instagram"
      | "evolution"
      | "meta_api";

    const response = await gatewayActions.connectChannel(
      ctx.membership.workspaceId,
      {
        channelId: input.id,
        channelName: channel.name,
        channelType,
        code: input.inputPayload?.code,
        wabaId: input.inputPayload?.wabaId,
        redirectUri: input.inputPayload?.redirectUri,
        forceNewInstance: input.forceNewInstance,
        metaApiConfig:
          channelType === "meta_api"
            ? {
                appId: input.inputPayload?.appId,
                appSecret: input.inputPayload?.appSecret,
                accessToken: input.inputPayload?.accessToken,
                wabaId: input.inputPayload?.wabaId,
                phoneId: input.inputPayload?.phoneId,
                businessId: input.inputPayload?.businessId,
                verifyToken: input.inputPayload?.verifyToken,
              }
            : undefined,
      }
    );

    if (input.forceNewInstance && channelType === "evolution") {
      try {
        const freshChannel = await channelsRepository.retrieve(input.id);
        if (freshChannel) {
          (freshChannel.payload as Record<string, unknown>).reconnectedAt = Date.now();
          await channelsRepository.upsert(freshChannel, ctx.membership.workspaceId);
        }
      } catch (e) {
        console.error("[connectChannel] Falha ao definir reconnectedAt:", e);
      }
    }

    if (!response.success) {
      throw new Error(response.error ?? "Falha ao conectar canal");
    }

    if (!input.forceNewInstance && previousInstanceName && channelType === "evolution") {
      try {
        await restoreInstanceNameIfChanged(input.id, previousInstanceName, ctx.membership.workspaceId);
      } catch (error) {
        console.error(
          `[connectChannel] Canal conectado mas falha ao restaurar instanceName para canal ${input.id}:`,
          error
        );
      }
    }

    if (input.forceNewInstance) {
      const data = response.data;
      if (!data || typeof data !== "object") {
        throw new Error("Resposta inesperada do gateway ao criar instância");
      }
      const record = data as Record<string, unknown>;
      return {
        instanceName: String(record.instanceName ?? ""),
        instanceId: String(record.instanceId ?? ""),
        qrcode: typeof record.qrcode === "string" ? record.qrcode : null,
        phoneNumber: typeof record.phoneNumber === "string" ? record.phoneNumber : null,
      };
    }
  });

export const disconnectChannel = securityProcedure([
  "manage:connections",
  "start:connections",
])
  .input(
    z.object({
      id: z.string(),
    })
  )
  .handler(async ({ ctx, input }) => {
    const response = await gatewayActions.disconnectChannel(
      ctx.membership.workspaceId,
      input.id
    );

    if (!response.success) {
      throw new Error(response.error ?? "Falha ao desconectar canal");
    }
  });

export const removeChannel = securityProcedure([
  "manage:connections",
  "remove:connections",
])
  .input(
    z.object({
      ids: z.array(z.string()),
    })
  )
  .handler(async ({ ctx, input }) => {
    for (const id of input.ids) {
      const channel = await channelsRepository.retrieve(id);
      if (!channel) continue;

      if (channel.type === "evolution") {
        try {
          await gatewayActions.removeChannel(
            ctx.membership.workspaceId,
            id
          );
        } catch (error) {
          console.error(
            `[removeChannel] Falha ao remover instância Evolution do canal ${id}:`,
            error
          );
        }
      }

      await channelsRepository.remove(id, ctx.membership.workspaceId);
    }
  });

export const registerReceivedChannel = securityProcedure([
  "manage:connections",
  "register:connections",
])
  .input(registerReceivedChannelInputSchema)
  .handler(async ({ input, ctx }) => {
    const { ConversationsDatabaseRepository } = await import(
      "@omnichannel/core/infra/repositories/conversations-repository"
    );

    const receivedChannel = await channelsRepository.retrieve(
      input.receivedChannelId
    );
    if (!receivedChannel) throw NotFound.throw("Received Channel");

    const responseChannel = await channelsRepository.retrieve(
      input.responseChannelId
    );

    if (!responseChannel) throw NotFound.throw("Channel");

    receivedChannel.registerResponseChannel(responseChannel);

    await channelsRepository.upsert(
      receivedChannel,
      ctx.membership.workspaceId
    );

    if (input.migrateConversations) {
      const conversationsRepository =
        ConversationsDatabaseRepository.instance();
      await conversationsRepository.migrateToResponseChannel(
        input.receivedChannelId,
        input.responseChannelId
      );
    }
  });

export const unregisterReceivedChannel = securityProcedure([
  "manage:connections",
  "register:connections",
])
  .input(z.object({ channelId: z.string().nonempty() }))
  .handler(async ({ input, ctx }) => {
    const channel = await channelsRepository.retrieve(input.channelId);
    if (!channel) throw NotFound.throw("Channel");

    channel.unregisterResponseChannel();

    await channelsRepository.upsert(channel, ctx.membership.workspaceId);
  });

export const countConversationsToMigrate = securityProcedure([
  "manage:connections",
  "list:connections",
])
  .input(z.object({ channelId: z.string().nonempty() }))
  .handler(async ({ input }) => {
    const { ConversationsDatabaseRepository } = await import(
      "@omnichannel/core/infra/repositories/conversations-repository"
    );

    const conversationsRepository = ConversationsDatabaseRepository.instance();
    const count = await conversationsRepository.countWithoutReceivedChannel(
      input.channelId
    );

    return { count };
  });

export const listMyChannels = securityProcedure().handler(async ({ ctx }) => {
  const listMyChannelsCommand = ListMyChannels.instance();
  const channelIds = await listMyChannelsCommand.execute({
    id: ctx.user.id,
    workspaceId: ctx.membership.workspaceId,
    membership: ctx.membership,
  });

  if (
    channelIds.length === 0 &&
    ctx.membership.hasPermission("list:all-channels")
  ) {
    const allChannels = await channelsRepository.list(
      ctx.membership.workspaceId
    );
    return allChannels;
  }

  if (channelIds.length === 0) {
    return [];
  }

  const channels = await Promise.all(
    channelIds.map((id) => channelsRepository.retrieve(id))
  );

  return channels.filter((c): c is Channel => c !== null).map((c) => c.raw());
});

export const getReconnectImpact = securityProcedure(["manage:connections"])
  .input(z.object({ channelId: z.string().nonempty() }))
  .handler(async ({ input, ctx }) => {
    const { ConversationsDatabaseRepository } = await import(
      "@omnichannel/core/infra/repositories/conversations-repository"
    );

    const result = await channelsRepository.retrieveWithWorkspaceId(input.channelId);
    if (!result || result.workspaceId !== ctx.membership.workspaceId) {
      throw NotFound.throw("Channel");
    }
    const channel = result.channel;

    const conversationsRepository = ConversationsDatabaseRepository.instance();
    const impact =
      await conversationsRepository.countOpenAndActiveFlowsByChannel(
        input.channelId
      );

    return {
      channelName: channel.name,
      channelType: channel.type,
      availableTypes: getChannelFamily(channel.type),
      ...impact,
    };
  });

export const reconnectChannel = securityProcedure(["manage:connections"])
  .input(reconnectChannelInputSchema)
  .handler(async ({ input, ctx }) => {
    const { ConversationsDatabaseRepository } = await import(
      "@omnichannel/core/infra/repositories/conversations-repository"
    );
    const { FlowExecutionsDatabaseRepository } = await import(
      "@omnichannel/core/infra/repositories/flow-executions-repository"
    );
    const { getSocketServer } = await import("@/lib/io-server");

    const result = await channelsRepository.retrieveWithWorkspaceId(input.channelId);
    if (!result || result.workspaceId !== ctx.membership.workspaceId) {
      throw NotFound.throw("Channel");
    }
    const channel = result.channel;

    const newType = input.newType as Channel.Type;
    if (newType === "meta_api" || channel.type === "meta_api") {
      throw new Error(
        "Canais meta_api requerem configuração manual e não suportam reconexão via wizard."
      );
    }
    const family = getChannelFamily(channel.type);
    if (!family.includes(newType)) {
      throw new Error(
        "Tipo de canal incompatível. Alteração permitida apenas dentro da mesma família."
      );
    }

    const flowExecutionsRepository =
      FlowExecutionsDatabaseRepository.instance();
    const conversationsRepository = ConversationsDatabaseRepository.instance();

    const previousType = channel.type;
    const previousPayload = channel.payload;
    const previousStatus = channel.status;

    let pendingPayload: ChannelPayload | undefined;
    if (input.pendingInstanceName) {
      const freshChannel = await channelsRepository.retrieve(input.channelId);
      const currentPhone = freshChannel
        ? getPayloadProperty(freshChannel.payload, "phoneNumber")
        : null;
      pendingPayload = {
        instanceName: input.pendingInstanceName,
        instanceId: input.pendingInstanceId,
        phoneNumber: input.pendingPhoneNumber || currentPhone,
      } as ChannelPayload;
    }

    const hasInputPayload = input.inputPayload && Object.keys(input.inputPayload).length > 0;
    channel.reconnect(
      newType,
      pendingPayload ?? (hasInputPayload ? (input.inputPayload as ChannelPayload) : channel.payload)
    );

    if (input.pendingInstanceName) {
      channel.status = "connected";
      (channel.payload as Record<string, unknown>).reconnectedAt = Date.now();
    }

    try {
      await channelsRepository.upsert(channel, ctx.membership.workspaceId);
    } catch (error) {
      try {
        channel.type = previousType;
        channel.payload = previousPayload;
        channel.status = previousStatus;
        await channelsRepository.upsert(channel, ctx.membership.workspaceId);
      } catch (rollbackError) {
        console.error(
          "[reconnectChannel] CRITICAL: Falha ao reverter canal para estado anterior:",
          rollbackError
        );
        throw new Error(
          "Falha ao reconectar canal e falha ao reverter. O canal pode estar em estado inconsistente. Tente reconectar novamente."
        );
      }
      throw new Error(
        `Falha ao reconectar canal: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (input.pendingInstanceName && previousType === "evolution") {
      const oldInstanceName = getPayloadProperty(previousPayload, "instanceName");
      if (oldInstanceName && oldInstanceName !== input.pendingInstanceName) {
        try {
          await gatewayActions.removeEvolutionInstance(oldInstanceName);
        } catch (error) {
          console.error("[reconnectChannel] Falha ao remover instancia antiga:", error);
        }
      }
    }

    let terminatedFlows = 0;
    let flowTerminationFailed = false;
    try {
      terminatedFlows =
        await flowExecutionsRepository.terminateByChannel(input.channelId);
      await conversationsRepository.clearActiveFlows(input.channelId);
    } catch (error) {
      flowTerminationFailed = true;
      console.error(
        "[reconnectChannel] Canal reconectado mas falha ao encerrar fluxos:",
        error
      );
    }

    const socket = getSocketServer();
    socket
      ?.to(`workspace:${ctx.membership.workspaceId}`)
      .emit("channel:reconnected", {
        channelId: input.channelId,
        channelName: channel.name,
        previousType,
        newType,
        terminatedFlows,
        flowTerminationFailed,
        workspaceId: ctx.membership.workspaceId,
      });

    return { terminatedFlows, flowTerminationFailed };
  });

export const updateInstagramChannelInfo = securityProcedure([
  "manage:connections",
])
  .input(z.object({ channelId: z.string() }))
  .handler(async ({ input }) => {
    const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:3001";
    
    const response = await fetch(
      `${gatewayUrl}/instagram-channels/${input.channelId}/update-info`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update Instagram channel info: ${error}`);
    }

    const data = await response.json();
    return data;
  });
