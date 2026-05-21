"use server";
import { getSocketServer } from "@/lib/io-server";
import { gatewayActions } from "@/lib/gateway-client";
import { MarkLastMessagesContactAsViewed } from "@omnichannel/core/application/command/mark-last-messages-contact-as-viewed";
import { SendMedia } from "@omnichannel/core/application/command/send-media";
import { SendMessage } from "@omnichannel/core/application/command/send-message";
import { MessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/messages-repository";
import { MessageReactionsDatabaseRepository } from "@omnichannel/core/infra/repositories/message-reactions-repository";
import { ChannelsDatabaseRepository } from "@omnichannel/core/infra/repositories/channels-repository";
import { Message } from "@omnichannel/core/domain/entities/message";
import { normalizeMetaUploadError } from "@/lib/meta-upload-errors";
import { isLikelyOggOpus } from "@/lib/media-codec-validation";
import z from "zod";
import { securityProcedure } from "../procedure";

const MIME_ALIAS_MAP: Record<string, string> = {
  "application/x-zip-compressed": "application/zip",
  "application/x-zip": "application/zip",
  "audio/mp3": "audio/mpeg",
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  zip: "application/zip",
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function normalizeMimeTypeForUpload(
  mimeType: string,
  filename: string,
): string {
  const normalizedMime = mimeType.trim().toLowerCase();
  const withoutParameters = normalizedMime.split(";")[0]?.trim() ?? normalizedMime;
  if (withoutParameters) {
    return MIME_ALIAS_MAP[withoutParameters] ?? withoutParameters;
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension && EXTENSION_MIME_MAP[extension]) {
    return EXTENSION_MIME_MAP[extension];
  }

  return "application/octet-stream";
}
const socket = getSocketServer();

const messagesRepository = MessagesDatabaseRepository.instance();
const reactionsRepository = MessageReactionsDatabaseRepository.instance();
const channelsRepository = ChannelsDatabaseRepository.instance();

export const sendTyping = securityProcedure(["list:conversation"])
  .input(
    z.object({
      channelId: z.string(),
      messageId: z.string(),
    }),
  )
  .handler(async ({ input, ctx }) => {
    await gatewayActions.sendTyping(
      ctx.membership.workspaceId,
      input.channelId,
      input.messageId,
    );
  });

export const retrieveMedia = securityProcedure(["list:conversation"])
  .input(
    z.object({
      channelId: z.string(),
      messageId: z.string(),
    }),
  )
  .handler(async ({ input, ctx }) => {
    if (!input.channelId || !input.messageId) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await gatewayActions.downloadMedia(
      ctx.membership.workspaceId,
      input.channelId,
      input.messageId,
    );

    if (!response.success || !response.data) {
      return new Response(
        JSON.stringify({ error: response.error ?? "Failed to download media" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const buffer = Buffer.from(response.data.content, "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": response.data.mime,
        "Content-Filename": response.data.filename ?? "",
      },
    });
  });

export const sendMedia = securityProcedure(["send:message"])
  .input(
    z.object({
      file: z.instanceof(File),
      conversationId: z.string(),
      channelId: z.string(),
      type: z.enum(["audio", "image", "document", "video"]),
      caption: z.string().optional(),
      correlationId: z.string().optional(),
      quotedMessageId: z.string().optional(),
    }),
  )
  .handler(async ({ input, ctx }) => {
    const channel = await channelsRepository.retrieve(input.channelId);

    if (!channel) {
      throw new Error("Canal não encontrado");
    }

    if (channel.status === "disconnected") {
      throw new Error(
        "Canal desconectado. Reconecte o canal para enviar mensagens.",
      );
    }

    if (
      channel.type === "instagram" ||
      channel.type === "whatsapp" ||
      channel.type === "meta_api"
    ) {
      const payload = channel.payload as { accessToken?: string };
      if (!payload.accessToken) {
        throw new Error(
          `Canal ${channel.type === "instagram" ? "Instagram" : "WhatsApp"} sem token de acesso. Reconecte o canal.`,
        );
      }
    }

    let uploadResponse;

    try {
      const arrayBuffer = await input.file.arrayBuffer();
      const fileBase64 = Buffer.from(arrayBuffer).toString("base64");
      const normalizedMimeType = normalizeMimeTypeForUpload(
        input.file.type,
        input.file.name,
      );

      if (
        (channel.type === "whatsapp" || channel.type === "meta_api") &&
        normalizedMimeType === "audio/ogg" &&
        !isLikelyOggOpus(new Uint8Array(arrayBuffer))
      ) {
        throw new Error(
          "Arquivo OGG inválido para WhatsApp. Envie OGG com codec Opus.",
        );
      }

      uploadResponse = await gatewayActions.uploadMedia(
        ctx.membership.workspaceId,
        input.channelId,
        {
          fileBase64,
          filename: input.file.name,
          mimeType: normalizedMimeType,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[sendMedia] Gateway connection error:", message);

      if (
        message.includes("RabbitMQ") ||
        message.includes("connected") ||
        message.includes("ECONNREFUSED")
      ) {
        throw new Error(
          "Serviço de mensagens indisponível. Verifique se o gateway está rodando.",
        );
      }
      if (message.includes("timeout") || message.includes("Timeout")) {
        throw new Error("O servidor demorou para responder. Tente novamente.");
      }
      if (message.includes("fetch failed") || message.includes("ENOTFOUND")) {
        throw new Error(
          "Não foi possível conectar ao servidor. Verifique sua conexão.",
        );
      }
      throw new Error(`Falha ao conectar com o gateway: ${message}`);
    }

    if (!uploadResponse.success || !uploadResponse.data) {
      const errorMsg = uploadResponse.error ?? "Falha no upload";
      console.error("[sendMedia] Upload failed:", errorMsg);

      const normalized = normalizeMetaUploadError(errorMsg);
      console.error("[sendMedia] Meta upload error category:", {
        type: normalized.type,
        message: normalized.message,
      });

      if (normalized.type === "token") {
        throw new Error(
          "Token do canal expirado ou invalido. Reconecte o canal nas configuracoes.",
        );
      }

      if (normalized.type === "scrutiny_failed") {
        throw new Error(
          "A Meta rejeitou este arquivo por formato/codificação inválida. Tente outro arquivo ou converta para formato suportado.",
        );
      }

      if (normalized.type === "unsupported") {
        throw new Error("Tipo de arquivo não suportado pela Meta.");
      }

      if (normalized.type === "too_large") {
        throw new Error("Arquivo excede o tamanho permitido pela Meta.");
      }

      if (normalized.type === "permission") {
        throw new Error(
          "Permissoes insuficientes para envio de midia. Verifique as configuracoes da Meta.",
        );
      }

      throw new Error(
        "Falha ao enviar arquivo. Tente novamente ou use outro formato.",
      );
    }

    const sendMediaCmd = SendMedia.instance();

    await sendMediaCmd.execute({
      conversationId: input.conversationId,
      channelId: input.channelId,
      userId: ctx.user.id,
      userName: ctx.user.name,
      workspaceId: ctx.membership.workspaceId,
      filename: input.file.name,
      mimeType: normalizeMimeTypeForUpload(input.file.type, input.file.name),
      type: input.type,
      caption: input.caption,
      correlationId: input.correlationId,
      mediaId: uploadResponse.data.mediaId,
      localMediaPath: uploadResponse.data.localMediaPath,
      quotedMessageId: input.quotedMessageId,
    });
  });

export const sendMessage = securityProcedure([
  "send:message",
  "bypass:attendance-to-send",
])
  .input(
    z.object({
      conversationId: z.string(),
      channelId: z.string().optional(),
      content: z.string().optional(),
      templateName: z.string().optional(),
      variables: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional(),
      language: z.string().optional(),
      correlationId: z.string().optional(),
      quotedMessageId: z.string().optional(),
      bypassAttendance: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, ctx }) => {
    if (!input.channelId) {
      throw new Error("Channel ID is required for external messages");
    }

    const channel = await channelsRepository.retrieve(input.channelId);

    if (!channel) {
      throw new Error("Canal não encontrado");
    }

    if (channel.status === "disconnected") {
      throw new Error(
        "Canal desconectado. Reconecte o canal para enviar mensagens.",
      );
    }

    if (
      channel.type === "instagram" ||
      channel.type === "whatsapp" ||
      channel.type === "meta_api"
    ) {
      const payload = channel.payload as { accessToken?: string };
      if (!payload.accessToken) {
        throw new Error(
          `Canal ${channel.type === "instagram" ? "Instagram" : "WhatsApp"} sem token de acesso. Reconecte o canal.`,
        );
      }
    }

    const sendMessage = SendMessage.instance();

    await sendMessage.execute({
      content: input.content,
      conversationId: input.conversationId,
      channelId: input.channelId,
      userId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      templateName: input.templateName,
      variables: input.variables,
      language: input.language,
      correlationId: input.correlationId,
      quotedMessageId: input.quotedMessageId,
      bypassAttendance: input.bypassAttendance,
      senderName: ctx.user.name,
    });

    if (input.templateName) {
      socket?.to(`workspace:${ctx.membership.workspaceId}`).emit("refresh");
    }
  });

export const markLastMessagesContactAsViewed = securityProcedure([
  "list:conversation",
])
  .input(z.object({ channelId: z.string(), contactId: z.string() }))
  .handler(async ({ input, ctx: { membership } }) => {
    const markLastMessagesContactAsViewed =
      MarkLastMessagesContactAsViewed.instance();

    await markLastMessagesContactAsViewed.execute({
      channel: input.channelId,
      contact: input.contactId,
      workspaceId: membership.workspaceId,
    });

    socket?.emit("refresh");
  });

export const listConversationMedia = securityProcedure(["list:conversation"])
  .input(z.object({ contactId: z.string() }))
  .handler(async ({ input }) => {
    const media = await messagesRepository.listMediaByContactId(
      input.contactId,
    );
    return media;
  });

export const searchMessages = securityProcedure(["list:conversation"])
  .input(
    z.object({
      conversationId: z.string(),
      searchTerm: z.string().min(2).max(100),
      limit: z.number().optional().default(50),
    }),
  )
  .handler(async ({ input }) => {
    const results = await messagesRepository.searchInConversation(
      input.conversationId,
      input.searchTerm,
      input.limit,
    );
    return results;
  });

export const toggleMessageReaction = securityProcedure(["send:message"])
  .input(
    z.object({
      messageId: z.string(),
      emoji: z.string(),
      conversationId: z.string(),
      channelId: z.string(),
      remoteJid: z.string(),
      channelType: z.string().optional(),
      fromMe: z.boolean(),
    }),
  )
  .handler(async ({ input, ctx }) => {
    const emitReactionEvent = (payload: {
      action: "added" | "removed";
      reaction: Message.Reaction | null;
      removedBy: string | null;
    }) => {
      socket
        ?.to(`workspace:${ctx.membership.workspaceId}`)
        .emit("message:reaction", {
          messageId: input.messageId,
          conversationId: input.conversationId,
          action: payload.action,
          reaction: payload.reaction
            ? {
                id: payload.reaction.id,
                emoji: payload.reaction.emoji,
                reactorType: payload.reaction.reactorType,
                reactorId: payload.reaction.reactorId,
                reactorName: payload.reaction.reactorName,
                createdAt: payload.reaction.createdAt,
              }
            : null,
          removedBy: payload.removedBy,
        });
    };

    const result = await reactionsRepository.toggleReaction({
      messageId: input.messageId,
      emoji: input.emoji,
      reactorType: "attendant",
      reactorId: ctx.user.id,
      reactorName: ctx.user.name,
    });

    const reactionForEvent =
      result.reaction ??
      ({
        id: "",
        emoji: input.emoji,
        reactorType: "attendant",
        reactorId: ctx.user.id,
        reactorName: ctx.user.name,
        createdAt: new Date(),
      } satisfies Message.Reaction);

    emitReactionEvent({
      action: result.action,
      reaction: reactionForEvent,
      removedBy: result.action === "removed" ? ctx.user.id : null,
    });

    if (
      input.channelType === "evolution" ||
      input.channelType === "whatsapp" ||
      input.channelType === "meta_api"
    ) {
      try {
        const emojiToSend = result.action === "added" ? input.emoji : "";
        const response = await gatewayActions.sendReaction(
          ctx.membership.workspaceId,
          input.channelId,
          input.messageId,
          input.remoteJid,
          emojiToSend,
          input.fromMe,
        );

        if (!response.success) {
          throw new Error(response.error || "Falha ao enviar reação para o canal");
        }
      } catch (error) {
        console.error(
          "[toggleMessageReaction] Failed to send reaction to WhatsApp:",
          error,
        );

        if (result.action === "added") {
          await reactionsRepository.removeReaction(
            input.messageId,
            input.emoji,
            ctx.user.id,
          );

          emitReactionEvent({
            action: "removed",
            reaction: reactionForEvent,
            removedBy: ctx.user.id,
          });
        } else {
          const restoredReaction = await reactionsRepository.addReaction({
            messageId: input.messageId,
            emoji: input.emoji,
            reactorType: "attendant",
            reactorId: ctx.user.id,
            reactorName: ctx.user.name,
          });

          emitReactionEvent({
            action: "added",
            reaction: restoredReaction,
            removedBy: null,
          });
        }

        throw new Error(
          error instanceof Error
            ? error.message
            : "Falha ao enviar reação para o canal",
        );
      }
    }

    return result;
  });

export const getMessageReactions = securityProcedure(["list:conversation"])
  .input(z.object({ messageId: z.string() }))
  .handler(async ({ input }) => {
    const reactions = await reactionsRepository.listByMessageId(
      input.messageId,
    );
    return reactions;
  });

export const getMessagesReactions = securityProcedure(["list:conversation"])
  .input(z.object({ messageIds: z.array(z.string()) }))
  .handler(async ({ input }) => {
    const reactionsMap = await reactionsRepository.listByMessageIds(
      input.messageIds,
    );
    const result: Record<string, Message.Reaction[]> = {};

    for (const [messageId, reactions] of reactionsMap.entries()) {
      result[messageId] = reactions;
    }

    return result;
  });

export const getMessageById = securityProcedure(["list:conversation"])
  .input(z.object({ messageId: z.string() }))
  .handler(async ({ input }) => {
    const message = await messagesRepository.retrieve(input.messageId);
    return message?.raw() ?? null;
  });
