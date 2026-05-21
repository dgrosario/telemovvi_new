"use server";
import { getSocketServer } from "@/lib/io-server";
import { gatewayActions } from "@/lib/gateway-client";
import {
  getAllowedChannelIdsForUser,
  getAllowedSectorIdsForUser,
} from "@/app/actions/scope-cache";
import { AssignConversation } from "@omnichannel/core/application/command/assign-conversation";
import { ListConversations } from "@omnichannel/core/application/command/list-conversations";
import { CloseConversation } from "@omnichannel/core/application/command/close-conversation";
import { DeleteConversation } from "@omnichannel/core/application/command/delete-conversation";
import { ExpireConversation } from "@omnichannel/core/application/command/expire-conversation";
import { MarkLastMessagesContactAsViewed } from "@omnichannel/core/application/command/mark-last-messages-contact-as-viewed";
import { TransferConversation } from "@omnichannel/core/application/command/transfer-conversation";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Membership } from "@omnichannel/core/domain/entities/membership";
import { ConversationAlreadyAssigned } from "@omnichannel/core/domain/errors/conversation-already-assigned";
import { NotAuthorized } from "@omnichannel/core/domain/errors/not-authorized";
import { ConversationsDatabaseRepository } from "@omnichannel/core/infra/repositories/conversations-repository";
import { MessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/messages-repository";
import z from "zod";
import { securityProcedure } from "../procedure";
import {
  assignConversationInputSchema,
  createConversationInputSchema,
  transferConversationInputSchema,
} from "./schema";
import { CreateConversation } from "@omnichannel/core/application/command/create-conversation";
import { MarkConversationAsRead } from "@omnichannel/core/application/command/mark-conversation-as-read";
import { createServerAction } from "zsa";
import { CreateNotification } from "@omnichannel/core/application/command/create-notification";
import { NotificationsDatabaseRepository } from "@omnichannel/core/infra/repositories/notifications-repository";
import { SectorPermissionsDatabaseRepository } from "@omnichannel/core/infra/repositories/sector-permissions-repository";
import { NotificationsCacheDriver } from "@omnichannel/core/infra/drivers/notifications-cache-driver";
import { NotificationEmitter } from "@/lib/notification-emitter";
import { normalizeConversationListFilter } from "@/lib/chat-conversation-type";
import { finalizeDeletedMessage } from "@/lib/delete-message-side-effects";

const conversationsRepository = ConversationsDatabaseRepository.instance();
const messagesRepository = MessagesDatabaseRepository.instance();
const notificationsRepository = NotificationsDatabaseRepository.instance();
const sectorPermissionsRepository = SectorPermissionsDatabaseRepository.instance();
const notificationsCacheDriver = NotificationsCacheDriver.instance();

const socket = getSocketServer();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";
const FORBIDDEN_CONVERSATION_SCOPE = "FORBIDDEN_CONVERSATION_SCOPE";
const FORBIDDEN_CONTACT_DETAILS_SECTOR_CHANGE =
  "FORBIDDEN_CONTACT_DETAILS_SECTOR_CHANGE";

type SecureActionContext = {
  user: { id: string };
  membership: Membership;
};

function throwForbiddenConversationScope(): never {
  const error = NotAuthorized.throw([FORBIDDEN_CONVERSATION_SCOPE]) as NotAuthorized & {
    status?: number;
    code?: string;
  };
  error.status = 403;
  error.code = FORBIDDEN_CONVERSATION_SCOPE;
  throw error;
}

function throwForbiddenContactDetailsSectorChange(): never {
  const error = NotAuthorized.throw([FORBIDDEN_CONTACT_DETAILS_SECTOR_CHANGE]) as NotAuthorized & {
    status?: number;
    code?: string;
    message?: string;
  };
  error.status = 403;
  error.code = FORBIDDEN_CONTACT_DETAILS_SECTOR_CHANGE;
  error.message =
    "Não é permitido alterar o setor desta conversa ao assumir, pois o setor atual possui restrição de visualização de dados para o usuário que assumirá.";
  throw error;
}

async function assertConversationScopeAccess(
  ctx: SecureActionContext,
  conversation: Conversation
) {
  if (ctx.membership.hasPermission("list:all-sectors")) return;

  if (conversation.isInternal) {
    if (conversation.participants.length === 0) return;
    const isParticipant = conversation.participants.some(
      (participant) =>
        participant.userId === ctx.user.id && participant.leftAt === null
    );
    if (!isParticipant) {
      throwForbiddenConversationScope();
    }
    return;
  }

  const conversationSectorId = conversation.sector?.id;
  if (conversationSectorId) {
    const allowedSectorIds = await getAllowedSectorIdsForUser(
      ctx.user.id,
      ctx.membership.workspaceId
    );

    if (!allowedSectorIds.includes(conversationSectorId)) {
      throwForbiddenConversationScope();
    }
    return;
  }

  if (ctx.membership.hasPermission("list:all-channels")) return;

  const conversationChannelId = conversation.channel?.id;
  if (!conversationChannelId) {
    throwForbiddenConversationScope();
  }

  const allowedChannelIds = await getAllowedChannelIdsForUser(
    ctx.user.id,
    ctx.membership.workspaceId
  );

  if (!allowedChannelIds.includes(conversationChannelId)) {
    throwForbiddenConversationScope();
  }
}

async function assertNoContactDetailsRestrictionBypassOnTakeover(
  userId: string | undefined,
  conversation: Conversation,
  nextSectorId?: string
) {
  if (!userId) return;

  const currentSectorId = conversation.sector?.id;

  if (!currentSectorId || !nextSectorId || nextSectorId === currentSectorId) {
    return;
  }

  const blockedSectors =
    await sectorPermissionsRepository.listBlockedSectorsForContactDetails(
      userId
    );
  const blockedSectorIds = new Set(blockedSectors.map((s) => s.sectorId));

  if (!blockedSectorIds.has(currentSectorId)) {
    return;
  }

  throwForbiddenContactDetailsSectorChange();
}

async function validateTakeoverConversationAccess(
  ctx: SecureActionContext,
  conversationId: string,
  nextSectorId?: string,
  restrictionUserId?: string
): Promise<Conversation> {
  const conversation =
    await conversationsRepository.retrieveWithParticipantsForWorkspace(
      conversationId,
      ctx.membership.workspaceId
    );

  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  await assertConversationScopeAccess(ctx, conversation);
  await assertNoContactDetailsRestrictionBypassOnTakeover(
    restrictionUserId ?? ctx.user.id,
    conversation,
    nextSectorId
  );

  return conversation;
}

function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length === 13) {
    const ddd = digits.substring(2, 4);
    const dddNumber = parseInt(ddd, 10);
    if (dddNumber >= 11 && dddNumber <= 99) {
      const ninthDigit = digits.charAt(4);
      if (ninthDigit === "9") {
        return digits.substring(0, 4) + digits.substring(5);
      }
    }
  }

  return digits;
}

export const refreshConversations = createServerAction()
  .input(
    z.object({
      apiKey: z.string(),
    })
  )
  .handler(async ({ input }) => {
    if (!INTERNAL_API_KEY || input.apiKey !== INTERNAL_API_KEY) return;
    socket?.emit("refresh");
  });

export const assignConversation = securityProcedure([
  "list:all-conversations",
  "list:conversation",
  "assign:conversation",
])
  .input(assignConversationInputSchema)
  .handler(async ({ input, ctx }) => {
    try {
      await validateTakeoverConversationAccess(
        ctx,
        input.conversationId,
        input.sectorId,
        ctx.user.id
      );

      const assignConversationCommand = AssignConversation.instance();

      const bypassSectorCheck =
        ctx.membership.hasPermission("list:all-sectors") ||
        ctx.membership.hasPermission("manage:sectors") ||
        ctx.membership.hasPermission("manage:conversations");

      const conversation = await assignConversationCommand.execute({
        conversationId: input.conversationId,
        workspaceId: ctx.membership.workspaceId,
        attendantId: ctx.user.id,
        sectorId: input.sectorId,
        bypassSectorCheck,
      });

      if (conversation.channel && conversation.contact?.id) {
        try {
          const markLastMessagesContactAsViewed =
            MarkLastMessagesContactAsViewed.instance();

          await markLastMessagesContactAsViewed.execute({
            channel: conversation.channel.id,
            contact: conversation.contact.id,
            workspaceId: ctx.membership.workspaceId,
          });
        } catch (error) {
          console.error("[assignConversation] Falha ao marcar mensagens como visualizadas:", error);
        }
      }

      try {
        const createNotificationCommand = CreateNotification.instance(
          notificationsRepository,
          notificationsCacheDriver
        );

        const contactName =
          conversation.contact?.name ||
          conversation.contact?.value ||
          "Contato desconhecido";

        const notification = await createNotificationCommand.execute({
          workspaceId: ctx.membership.workspaceId,
          type: "conversation:assigned",
          title: "Nova conversa atribuída",
          content: `Você foi atribuído à conversa com ${contactName}`,
          metadata: {
            conversationId: conversation.id,
            channelId: conversation.channel?.id,
            sectorId: conversation.sector?.id,
          },
          recipientType: "user",
          recipientId: ctx.user.id,
          priority: "normal",
        });

        if (socket) {
          NotificationEmitter.emitToUser(
            socket,
            ctx.user.id,
            ctx.membership.workspaceId,
            notification
          );
        }
      } catch (error) {
        console.error("[assignConversation] Falha ao criar notificação:", error);
      }

      socket
        ?.to(`workspace:${ctx.membership.workspaceId}`)
        .emit("conversation:assigned", {
          conversation: conversation.raw(),
          assignedById: ctx.user.id,
          workspaceId: ctx.membership.workspaceId,
        });

      return { success: true, conversation: conversation.raw() };
    } catch (error) {
      if (error instanceof ConversationAlreadyAssigned) {
        throw new Error(error.serialize());
      }
      console.error("[assignConversation] Error:", error);
      throw error;
    }
  });

export const transferConversation = securityProcedure([
  "list:all-conversations",
  "list:conversation",
  "transfer:conversation",
])
  .input(transferConversationInputSchema)
  .handler(async ({ input, ctx }) => {
    await validateTakeoverConversationAccess(
      ctx,
      input.conversationId,
      input.sectorId,
      input.attendantId
    );

    const transferConversationCommand = TransferConversation.instance();

    const bypassSectorCheck =
      ctx.membership.hasPermission("list:all-sectors") ||
      ctx.membership.hasPermission("manage:sectors") ||
      ctx.membership.hasPermission("manage:conversations");

    await transferConversationCommand.execute({
      conversationId: input.conversationId,
      sectorId: input.sectorId,
      attendantId: input.attendantId,
      workspaceId: ctx.membership.workspaceId,
      bypassSectorCheck,
    });

    try {
      const conversation = await conversationsRepository.retrieve(
        input.conversationId
      );

      if (conversation && input.attendantId) {
        const createNotificationCommand = CreateNotification.instance(
          notificationsRepository,
          notificationsCacheDriver
        );

        const contactName =
          conversation.contact?.name ||
          conversation.contact?.value ||
          "Contato desconhecido";

        const notification = await createNotificationCommand.execute({
          workspaceId: ctx.membership.workspaceId,
          type: "transfer:requested",
          title: "Transferência de atendimento",
          content: `${ctx.user.name} transferiu para você o atendimento com ${contactName}`,
          metadata: {
            conversationId: conversation.id,
            channelId: conversation.channel?.id,
            sectorId: conversation.sector?.id,
            transferredBy: ctx.user.id,
            transferredByName: ctx.user.name,
          },
          recipientType: "user",
          recipientId: input.attendantId,
          priority: "normal",
        });

        if (socket) {
          NotificationEmitter.emitToUser(
            socket,
            input.attendantId,
            ctx.membership.workspaceId,
            notification
          );
        }
      }

      // Sempre emitir evento de transferencia, mesmo se conversa nao foi encontrada
      // O comando ja executou com sucesso, entao o frontend precisa ser notificado
      socket
        ?.to(`workspace:${ctx.membership.workspaceId}`)
        .emit("conversation:transferred", {
          conversation: conversation?.raw() ?? { id: input.conversationId },
          transferredById: ctx.user.id,
          newAttendantId: input.attendantId ?? null,
          newSectorId: input.sectorId ?? null,
          workspaceId: ctx.membership.workspaceId,
        });
    } catch (error) {
      console.error(
        "[transferConversation] Erro em operacao secundaria (notificacao/socket):",
        error
      );
    }

    const updatedConversation = await conversationsRepository.retrieve(
      input.conversationId
    );

    return { success: true, conversation: updatedConversation?.raw() };
  });

export const retrieveConversation = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(
    z.object({
      conversationId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    if (!input.conversationId) return null;

    const conversation =
      await conversationsRepository.retrieveWithParticipantsForWorkspace(
        input.conversationId,
        ctx.membership.workspaceId
      );

    if (!conversation) return null;
    await assertConversationScopeAccess(ctx, conversation);

    return conversation.raw();
  });

export const loadMessages = securityProcedure([
  "list:conversation",
  "list:all-conversations",
])
  .input(z.object({ conversationId: z.string() }))
  .handler(async ({ input, ctx }) => {
    const conversation =
      await conversationsRepository.retrieveWithParticipantsForWorkspace(
        input.conversationId,
        ctx.membership.workspaceId
      );
    if (!conversation) return [];
    await assertConversationScopeAccess(ctx, conversation);

    return await messagesRepository.listForWorkspace(
      input.conversationId,
      ctx.membership.workspaceId
    );
  });

export const loadMessagesPaginated = securityProcedure([
  "list:conversation",
  "list:all-conversations",
])
  .input(
    z.object({
      conversationId: z.string(),
      limit: z.number().min(1).max(100).optional().default(50),
      beforeId: z.string().optional(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const conversation =
      await conversationsRepository.retrieveWithParticipantsForWorkspace(
        input.conversationId,
        ctx.membership.workspaceId
      );
    if (!conversation) return { messages: [], hasMore: false, oldestId: null };
    await assertConversationScopeAccess(ctx, conversation);

    const result = await messagesRepository.listPaginatedForWorkspace({
      conversationId: input.conversationId,
      workspaceId: ctx.membership.workspaceId,
      limit: input.limit,
      beforeId: input.beforeId,
    });
    return result ?? { messages: [], hasMore: false, oldestId: null };
  });

export const loadMessagesUntilId = securityProcedure([
  "list:conversation",
  "list:all-conversations",
])
  .input(
    z.object({
      conversationId: z.string(),
      targetMessageId: z.string(),
      currentOldestId: z.string().optional(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const conversation =
      await conversationsRepository.retrieveWithParticipantsForWorkspace(
        input.conversationId,
        ctx.membership.workspaceId
      );
    if (!conversation) {
      return { messages: [], hasMore: false, oldestId: null, targetFound: false };
    }
    await assertConversationScopeAccess(ctx, conversation);

    return messagesRepository.listUntilIdForWorkspace({
      conversationId: input.conversationId,
      workspaceId: ctx.membership.workspaceId,
      targetMessageId: input.targetMessageId,
      currentOldestId: input.currentOldestId,
    });
  });

export const listAllConversations = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(
    z.object({
      query: z.string().optional(),
      searchType: z
        .enum(["phone", "instagram", "client-name", "attendant-name", "all"])
        .optional()
        .default("all"),
      statusFilters: z
        .array(z.enum(["open", "waiting", "expired", "closed", "internal"]))
        .optional()
        .default(["open"]),
      channelFilters: z.array(z.string()).optional().default([]),
      sectorFilters: z.array(z.string()).optional().default([]),
      userFilters: z.array(z.string()).optional().default([]),
      dateStart: z.string().optional(),
      dateEnd: z.string().optional(),
      dateStartAt: z.number().int().optional(),
      dateEndAt: z.number().int().optional(),
      dateType: z
        .enum(["creation", "lastMessage"])
        .optional()
        .default("lastMessage"),
      sortOrder: z.enum(["desc", "asc"]).optional().default("desc"),
      waitingStatus: z.enum(["attendant", "client", ""]).optional().default(""),
      showAll: z.boolean().optional().default(false),
    })
  )
  .handler(async ({ ctx, input }) => {
    const expiredConversations = await conversationsRepository.retrieveOver24h(
      ctx.membership.workspaceId
    );
    if (expiredConversations && expiredConversations.length > 0) {
      const expireConversation = ExpireConversation.instance();
      await Promise.all(
        expiredConversations.map((c: Conversation.ExpiredConversation) =>
          expireConversation.execute({
            conversationId: c.id,
            workspaceId: ctx.membership.workspaceId,
          })
        )
      );
    }

    const listInstance = ListConversations.instance();

    return await listInstance.execute({
      id: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      membership: ctx.membership,
      query: input.query,
      searchType: input.searchType,
      statusFilters: input.statusFilters,
      channelFilters: input.channelFilters,
      sectorFilters: input.sectorFilters,
      userFilters: input.userFilters,
      dateStart: input.dateStart,
      dateEnd: input.dateEnd,
      dateStartAt: input.dateStartAt,
      dateEndAt: input.dateEndAt,
      dateType: input.dateType,
      sortOrder: input.sortOrder,
      waitingStatus: input.waitingStatus,
      showAll: input.showAll,
    });
  });

export const listConversationsPaginated = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(
    z.object({
      query: z.string().optional(),
      searchType: z
        .enum(["phone", "instagram", "client-name", "attendant-name", "all"])
        .optional()
        .default("all"),
      statusFilters: z
        .array(z.enum(["open", "waiting", "expired", "closed", "internal"]))
        .optional()
        .default(["open"]),
      channelFilters: z.array(z.string()).optional().default([]),
      sectorFilters: z.array(z.string()).optional().default([]),
      userFilters: z.array(z.string()).optional().default([]),
      labelFilters: z.array(z.string().uuid()).optional().default([]),
      dateStart: z.string().optional(),
      dateEnd: z.string().optional(),
      dateStartAt: z.number().int().optional(),
      dateEndAt: z.number().int().optional(),
      dateType: z
        .enum(["creation", "lastMessage"])
        .optional()
        .default("lastMessage"),
      sortOrder: z.enum(["desc", "asc"]).optional().default("desc"),
      waitingStatus: z.enum(["attendant", "client", ""]).optional().default(""),
      showAll: z.boolean().optional().default(false),
      cursor: z.string().nullable().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      conversationTypeFilter: z
        .enum(["contacts", "groups", "all"])
        .optional()
        .default("contacts"),
    })
  )
  .handler(async ({ ctx, input }) => {
    const isFirstPage = !input.cursor;
    const conversationTypeFilter = normalizeConversationListFilter(
      input.conversationTypeFilter,
      ctx.membership.hasPermission("view:whatsapp-groups")
    );

    if (isFirstPage) {
      try {
        const expiredConversations =
          await conversationsRepository.retrieveOver24h(
            ctx.membership.workspaceId
          );
        if (expiredConversations && expiredConversations.length > 0) {
          const expireConversation = ExpireConversation.instance();
          await Promise.all(
            expiredConversations.map((c: Conversation.ExpiredConversation) =>
              expireConversation.execute({
                conversationId: c.id,
                workspaceId: ctx.membership.workspaceId,
              })
            )
          );
        }
      } catch (error) {
        console.error("[listConversationsPaginated] Error expiring conversations:", error);
      }
    }

    const listInstance = ListConversations.instance();

    return await listInstance.executePaginated({
      id: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      membership: ctx.membership,
      query: input.query,
      searchType: input.searchType,
      statusFilters: input.statusFilters,
      channelFilters: input.channelFilters,
      sectorFilters: input.sectorFilters,
      userFilters: input.userFilters,
      labelFilters: input.labelFilters,
      dateStart: input.dateStart,
      dateEnd: input.dateEnd,
      dateStartAt: input.dateStartAt,
      dateEndAt: input.dateEndAt,
      dateType: input.dateType,
      sortOrder: input.sortOrder,
      waitingStatus: input.waitingStatus,
      showAll: input.showAll,
      cursor: input.cursor,
      limit: input.limit,
      conversationTypeFilter,
    });
  });

export const closeConversation = securityProcedure([
  "close:conversation",
  "list:all-conversations",
  "list:conversation",
])
  .input(z.object({ conversationId: z.string() }))
  .handler(async ({ input, ctx }) => {
    const closeConversationCommand = CloseConversation.instance();

    const conversation = await closeConversationCommand.execute({
      conversationId: input.conversationId,
      workspaceId: ctx.membership.workspaceId,
    });

    socket
      ?.to(`workspace:${ctx.membership.workspaceId}`)
      .emit("conversation:closed", {
        conversation: conversation.raw(),
        closedById: ctx.user.id,
        workspaceId: ctx.membership.workspaceId,
      });

    return { success: true, conversation: conversation.raw() };
  });

export const deleteConversation = securityProcedure([
  "delete:conversation",
])
  .input(z.object({ conversationId: z.string() }))
  .handler(async ({ input, ctx }) => {
    const deleteConversationCommand = DeleteConversation.instance();

    await deleteConversationCommand.execute({
      conversationId: input.conversationId,
      workspaceId: ctx.membership.workspaceId,
    });

    socket
      ?.to(`workspace:${ctx.membership.workspaceId}`)
      .emit("conversation:deleted", {
        conversationId: input.conversationId,
        deletedById: ctx.user.id,
        workspaceId: ctx.membership.workspaceId,
      });

    return { success: true };
  });

export const createConversation = securityProcedure([
  "create:conversation",
  "list:conversation",
])
  .input(createConversationInputSchema)
  .handler(async ({ ctx, input }) => {
    let resolvedTemplateLanguage: string | undefined;
    let resolvedTemplateVariables:
      | Array<{ name: string; value: string }>
      | undefined;

    if (input.templateName) {
      const templateResponse = await gatewayActions.retrieveTemplate(
        ctx.membership.workspaceId,
        input.channelId,
        input.templateName
      );

      if (!templateResponse.success || !templateResponse.data) {
        throw new Error(templateResponse.error ?? "Template não encontrado");
      }

      const gatewayTemplate = templateResponse.data;
      const expectedVariables = gatewayTemplate.variables ?? [];
      const inputVariables = input.templateVariables ?? [];

      const inputValuesByName = new Map(
        inputVariables.map((variable) => [variable.name.trim(), variable.value])
      );

      const missingVariables = expectedVariables.filter((variable) => {
        const value = inputValuesByName.get(variable.name);
        return typeof value !== "string" || value.trim().length === 0;
      });

      if (missingVariables.length > 0) {
        throw new Error("Preencha todas as variáveis do template");
      }

      resolvedTemplateLanguage =
        input.templateLanguage ?? gatewayTemplate.language;
      resolvedTemplateVariables = expectedVariables.map((variable) => ({
        name: variable.name,
        value: (inputValuesByName.get(variable.name) ?? "").trim(),
      }));
    }

    const createConversation = CreateConversation.instance();

    const conversationId = await createConversation.execute({
      channelId: input.channelId,
      contactId: input.contactId,
      partnerId: input.partnerId,
      templateName: input.templateName,
      templateLanguage: resolvedTemplateLanguage,
      templateVariables: resolvedTemplateVariables,
      sectorId: input.sectorId,
      userId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
    });

    socket?.emit("refresh");
    
    return { conversationId };
  });

export const markConversationAsRead = securityProcedure(["list:conversation"])
  .input(z.object({ conversationId: z.string() }))
  .handler(async ({ input, ctx }) => {
    const markConversationAsReadCmd = MarkConversationAsRead.instance();

    await markConversationAsReadCmd.execute({
      conversationId: input.conversationId,
      workspaceId: ctx.membership.workspaceId,
    });

    socket
      ?.to(`workspace:${ctx.membership.workspaceId}`)
      .emit("conversation:read", {
        conversationId: input.conversationId,
      });

    return { success: true };
  });

export const deleteMessage = securityProcedure(["list:conversation"])
  .input(
    z.object({
      messageId: z.string(),
      conversationId: z.string(),
      channelId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const message = await messagesRepository.retrieve(input.messageId);
    if (!message) {
      throw new Error("Mensagem não encontrada");
    }

    const isOwnMessage =
      message.sender.type === "attendant" &&
      message.sender.id === ctx.user.id;

    const isBotMessage = message.sender.id === "flow-executor";
    
    // Verifica se tem permissão para apagar qualquer mensagem
    const canDeleteAnyMessage = ctx.membership.hasPermission("delete:any-message");

    if (!isOwnMessage && !isBotMessage && !canDeleteAnyMessage) {
      throw new Error("Você não tem permissão para apagar esta mensagem");
    }

    const conversation = await conversationsRepository.retrieve(
      input.conversationId
    );
    if (!conversation) {
      throw new Error("Conversa não encontrada");
    }

    let remoteJid = conversation.groupJid;
    if (!remoteJid && conversation.contact) {
      const phoneNumber = normalizePhoneForWhatsApp(conversation.contact.value);
      remoteJid = `${phoneNumber}@s.whatsapp.net`;
    }

    if (!remoteJid) {
      throw new Error("Não foi possível determinar o destinatário");
    }

    const response = await gatewayActions.deleteMessage(
      ctx.membership.workspaceId,
      input.channelId,
      input.messageId,
      remoteJid
    );

    if (!response.success) {
      throw new Error(response.error ?? "Falha ao apagar mensagem");
    }

    await finalizeDeletedMessage({
      messageId: input.messageId,
      conversationId: input.conversationId,
      workspaceId: ctx.membership.workspaceId,
      conversationsRepository,
      messagesRepository,
      socket,
    });

    return { success: true };
  });

export const editMessage = securityProcedure(["list:conversation"])
  .input(
    z.object({
      messageId: z.string(),
      conversationId: z.string(),
      channelId: z.string(),
      newContent: z
        .string()
        .min(1, "Conteúdo da mensagem não pode estar vazio"),
    })
  )
  .handler(async ({ input, ctx }) => {
    const message = await messagesRepository.retrieve(input.messageId);
    if (!message) {
      throw new Error("Mensagem não encontrada");
    }

    console.log("[editMessage] Message details:", {
      messageId: input.messageId,
      senderType: message.sender.type,
      senderId: message.sender.id,
      userId: ctx.user.id,
      messageType: message.type,
    });

    if (message.type !== "text") {
      throw new Error("Apenas mensagens de texto podem ser editadas");
    }

    if (message.sender.type !== "attendant") {
      throw new Error(
        "Apenas mensagens enviadas pelo atendente podem ser editadas. Mensagens recebidas não podem ser editadas."
      );
    }

    if (
      message.sender.id === "flow-executor" ||
      message.sender.name === "Dispositivo"
    ) {
      throw new Error(
        "Mensagens enviadas automaticamente pelo sistema não podem ser editadas"
      );
    }

    const conversation = await conversationsRepository.retrieve(
      input.conversationId
    );
    if (!conversation) {
      throw new Error("Conversa não encontrada");
    }

    console.log("[editMessage] Conversation details:", {
      conversationId: input.conversationId,
      hasGroupJid: !!conversation.groupJid,
      groupJid: conversation.groupJid,
      hasContact: !!conversation.contact,
      contactId: conversation.contact?.id,
      contactValue: conversation.contact?.value,
    });

    let remoteJid = conversation.groupJid;
    if (!remoteJid && conversation.contact) {
      if (!conversation.contact.value) {
        throw new Error(
          `Não foi possível editar: contato sem número válido (Contact ID: ${conversation.contact.id})`
        );
      }
      const phoneNumber = normalizePhoneForWhatsApp(conversation.contact.value);
      remoteJid = `${phoneNumber}@s.whatsapp.net`;
    }

    if (!remoteJid) {
      const errorDetails = conversation.contact
        ? `Contato existe mas sem número (ID: ${conversation.contact.id})`
        : "Conversa sem grupo e sem contato";
      throw new Error(
        `Não foi possível editar: falha ao determinar destinatário. Detalhes: ${errorDetails}`
      );
    }

    console.log("[editMessage] Reconstructed remoteJid:", remoteJid);

    try {
      const response = await gatewayActions.editMessage(
        ctx.membership.workspaceId,
        input.channelId,
        input.messageId,
        remoteJid,
        input.newContent
      );

      console.log("[editMessage] Gateway response:", response);

      if (!response.success) {
        throw new Error(response.error ?? "Falha ao editar mensagem");
      }
    } catch (error) {
      console.error("[editMessage] Gateway error:", error);
      throw new Error(
        `Falha ao editar mensagem: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const editedAt = new Date();

    await messagesRepository.updateContent(
      input.messageId,
      input.newContent,
      editedAt
    );

    socket
      ?.to(`workspace:${ctx.membership.workspaceId}`)
      .emit("message:edited", {
        messageId: input.messageId,
        conversationId: input.conversationId,
        newContent: input.newContent,
        editedAt: editedAt.toISOString(),
      });

    return { success: true };
  });

export const requestTransfer = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(
    z.object({
      conversationId: z.string(),
      sectorId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const conversation = await conversationsRepository.retrieve(
      input.conversationId
    );
    if (!conversation) {
      throw new Error("Conversa não encontrada");
    }

    if (!conversation.attendant?.id) {
      throw new Error("Conversa sem atendente atual");
    }

    if (conversation.attendant.id === ctx.user.id) {
      throw new Error("Você já é o atendente desta conversa");
    }

    const createNotificationCommand = CreateNotification.instance(
      notificationsRepository,
      notificationsCacheDriver
    );

    const contactName =
      conversation.contact?.name ||
      conversation.contact?.value ||
      "Contato desconhecido";

    const notification = await createNotificationCommand.execute({
      workspaceId: ctx.membership.workspaceId,
      type: "transfer:requested",
      title: "Solicitação de Transferência",
      content: `${ctx.user.name} solicitou a transferência do atendimento com ${contactName}`,
      metadata: {
        conversationId: input.conversationId,
        requesterId: ctx.user.id,
        requesterName: ctx.user.name,
        requestedSectorId: input.sectorId,
      },
      recipientType: "user",
      recipientId: conversation.attendant.id,
      priority: "high",
    });

    if (socket) {
      NotificationEmitter.emitToUser(
        socket,
        conversation.attendant.id,
        ctx.membership.workspaceId,
        notification
      );
    }

    return { success: true };
  });

export const approveTransfer = securityProcedure([
  "list:all-conversations",
  "list:conversation",
  "transfer:conversation",
])
  .input(
    z.object({
      notificationId: z.string(),
      conversationId: z.string(),
      requesterId: z.string(),
      sectorId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    await validateTakeoverConversationAccess(
      ctx,
      input.conversationId,
      input.sectorId,
      input.requesterId
    );

    const conversation = await conversationsRepository.retrieve(
      input.conversationId
    );
    if (!conversation) {
      throw new Error("Conversa não encontrada");
    }

    if (conversation.attendant?.id !== ctx.user.id) {
      throw new Error("Apenas o atendente atual pode aprovar a transferência");
    }

    const transferConversationCommand = TransferConversation.instance();

    await transferConversationCommand.execute({
      conversationId: input.conversationId,
      sectorId: input.sectorId,
      attendantId: input.requesterId,
      workspaceId: ctx.membership.workspaceId,
    });

    await notificationsRepository.markAsRead(input.notificationId);

    const createNotificationCommand = CreateNotification.instance(
      notificationsRepository,
      notificationsCacheDriver
    );

    const contactName =
      conversation.contact?.name ||
      conversation.contact?.value ||
      "Contato desconhecido";

    const notification = await createNotificationCommand.execute({
      workspaceId: ctx.membership.workspaceId,
      type: "conversation:assigned",
      title: "Transferência Aprovada",
      content: `${ctx.user.name} aprovou sua solicitação de transferência do atendimento com ${contactName}`,
      metadata: {
        conversationId: input.conversationId,
        channelId: conversation.channel?.id,
        sectorId: input.sectorId,
        approvedBy: ctx.user.id,
        approvedByName: ctx.user.name,
      },
      recipientType: "user",
      recipientId: input.requesterId,
      priority: "normal",
    });

    if (socket) {
      NotificationEmitter.emitToUser(
        socket,
        input.requesterId,
        ctx.membership.workspaceId,
        notification
      );

      const updatedConversation = await conversationsRepository.retrieve(
        input.conversationId
      );

      if (updatedConversation) {
        socket.to(`workspace:${ctx.membership.workspaceId}`).emit("conversation:transferred", {
          conversation: updatedConversation.raw(),
          transferredById: ctx.user.id,
          newAttendantId: input.requesterId,
          newSectorId: input.sectorId,
          workspaceId: ctx.membership.workspaceId,
        });
      }
    }

    return { success: true };
  });

export const rejectTransfer = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(
    z.object({
      notificationId: z.string(),
      conversationId: z.string(),
      requesterId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const conversation = await conversationsRepository.retrieve(
      input.conversationId
    );
    if (!conversation) {
      throw new Error("Conversa não encontrada");
    }

    if (conversation.attendant?.id !== ctx.user.id) {
      throw new Error("Apenas o atendente atual pode rejeitar a transferência");
    }

    await notificationsRepository.markAsRead(input.notificationId);

    const createNotificationCommand = CreateNotification.instance(
      notificationsRepository,
      notificationsCacheDriver
    );

    const contactName =
      conversation.contact?.name ||
      conversation.contact?.value ||
      "Contato desconhecido";

    const notification = await createNotificationCommand.execute({
      workspaceId: ctx.membership.workspaceId,
      type: "transfer:requested",
      title: "Transferência Recusada",
      content: `${ctx.user.name} recusou sua solicitação de transferência do atendimento com ${contactName}`,
      metadata: {
        conversationId: input.conversationId,
        rejectedBy: ctx.user.id,
        rejectedByName: ctx.user.name,
      },
      recipientType: "user",
      recipientId: input.requesterId,
      priority: "normal",
    });

    if (socket) {
      NotificationEmitter.emitToUser(
        socket,
        input.requesterId,
        ctx.membership.workspaceId,
        notification
      );
    }

    return { success: true };
  });

export const loadGroupedMessagesByContact = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(
    z.object({
      contactId: z.string().nonempty(),
      limit: z.number().min(1).max(100).optional().default(50),
      beforeId: z.string().optional(),
    })
  )
  .handler(async ({ input, ctx }) => {
    return messagesRepository.listPaginatedByContact({
      contactId: input.contactId,
      workspaceId: ctx.membership.workspaceId,
      limit: input.limit,
      beforeId: input.beforeId,
    });
  });

export const listConversationsByContact = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(z.object({ contactId: z.string().nonempty() }))
  .handler(async ({ input, ctx }) => {
    return conversationsRepository.listByContact(
      input.contactId,
      ctx.membership.workspaceId
    );
  });

export const getConversationByPartnerId = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(z.object({ partnerId: z.string() }))
  .handler(async ({ input, ctx }) => {
    const conversation = await conversationsRepository.retrieveByPartnerId(
      input.partnerId,
      ctx.membership.workspaceId
    );

    if (!conversation) return null;
    await assertConversationScopeAccess(ctx, conversation);

    return conversation.raw();
  });


export const getCrossChannelIndicators = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(z.object({ contactIds: z.array(z.string()).min(1).max(200) }))
  .handler(async ({ input, ctx }) => {
    return conversationsRepository.getCrossChannelIndicators(
      input.contactIds,
      ctx.membership.workspaceId
    );
  });

export const updateConversationName = securityProcedure([
  "list:all-conversations",
  "list:conversation",
])
  .input(
    z.object({
      conversationId: z.string(),
      name: z.string().min(1),
    })
  )
  .handler(async ({ input, ctx }) => {
    const conversation = await conversationsRepository.retrieveForWorkspace(
      input.conversationId,
      ctx.membership.workspaceId
    );

    if (!conversation) {
      throw new Error("Conversa não encontrada");
    }

    if (conversation.conversationType !== "whatsapp-group") {
      throw new Error("Apenas grupos WhatsApp podem ter o nome atualizado");
    }

    await assertConversationScopeAccess(ctx, conversation);

    await conversationsRepository.updateName(
      input.conversationId,
      input.name
    );

    socket
      ?.to(`workspace:${ctx.membership.workspaceId}`)
      .emit("conversation:updated", {
        conversationId: input.conversationId,
        name: input.name,
      });

    return { success: true };
  });
