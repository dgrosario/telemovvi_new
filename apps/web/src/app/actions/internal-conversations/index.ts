"use server";

import { getSocketServer } from "@/lib/io-server";
import { CreateInternalConversation } from "@omnichannel/core/application/command/create-internal-conversation";
import { SendInternalMessage } from "@omnichannel/core/application/command/send-internal-message";
import { AddParticipantToGroup } from "@omnichannel/core/application/command/add-participant-to-group";
import { RemoveParticipantFromGroup } from "@omnichannel/core/application/command/remove-participant-from-group";
import { LeaveInternalConversation } from "@omnichannel/core/application/command/leave-internal-conversation";
import { ListInternalConversations } from "@omnichannel/core/application/queries/list-internal-conversations";
import { GetInternalConversation } from "@omnichannel/core/application/queries/get-internal-conversation";
import { ConversationsDatabaseRepository } from "@omnichannel/core/infra/repositories/conversations-repository";
import { MessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/messages-repository";
import { securityProcedure } from "../procedure";
import {
  createInternalConversationSchema,
  sendInternalMessageSchema,
  addParticipantToGroupSchema,
  removeParticipantFromGroupSchema,
  leaveInternalConversationSchema,
  getInternalConversationSchema,
} from "./schema";

const socket = getSocketServer();
const conversationsRepository = ConversationsDatabaseRepository.instance();
const messagesRepository = MessagesDatabaseRepository.instance();

export const createInternalConversation = securityProcedure([])
  .input(createInternalConversationSchema)
  .handler(async ({ input, ctx }) => {
    const command = CreateInternalConversation.instance();

    const result = await command.execute({
      creatorId: ctx.user.id,
      participantIds: input.participantIds,
      workspaceId: ctx.membership.workspaceId,
      name: input.name,
    });

    if (result.created) {
      const conversation = await conversationsRepository.retrieveWithParticipants(
        result.conversationId
      );

      if (conversation) {
        const participantIds = conversation.participants.map((p) => p.userId);

        for (const participantId of participantIds) {
          socket
            ?.to(`user:${participantId}`)
            .emit("internal:conversation:created", {
              conversation: conversation.raw(),
              workspaceId: ctx.membership.workspaceId,
            });
        }
      }
    }

    return result;
  });

export const sendInternalMessage = securityProcedure([])
  .input(sendInternalMessageSchema)
  .handler(async ({ input, ctx }) => {
    const command = SendInternalMessage.instance();

    const result = await command.execute({
      conversationId: input.conversationId,
      senderId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      content: input.content,
      type: input.type,
      caption: input.caption,
      filename: input.filename,
      mimeType: input.mimeType,
    });

    const message = await messagesRepository.retrieve(result.messageId);
    const conversation = await conversationsRepository.retrieveWithParticipants(
      input.conversationId
    );

    if (message && conversation) {
      const participantIds = conversation.participants.map((p) => p.userId);
      const recipients = participantIds.filter((id) => id !== ctx.user.id);

      for (const participantId of participantIds) {
        socket?.to(`user:${participantId}`).emit("internal:message:received", {
          conversationId: input.conversationId,
          message: {
            ...message.raw(),
            recipients,
          },
          workspaceId: ctx.membership.workspaceId,
        });
      }
    }

    return result;
  });

export const addParticipantToGroup = securityProcedure([])
  .input(addParticipantToGroupSchema)
  .handler(async ({ input, ctx }) => {
    const command = AddParticipantToGroup.instance();

    const result = await command.execute({
      conversationId: input.conversationId,
      userId: input.userId,
      addedByUserId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
    });

    if (result.success) {
      const conversation = await conversationsRepository.retrieveWithParticipants(
        input.conversationId
      );

      if (conversation) {
        const participantIds = conversation.participants.map((p) => p.userId);

        for (const participantId of participantIds) {
          socket
            ?.to(`user:${participantId}`)
            .emit("internal:participant:added", {
              conversationId: input.conversationId,
              participant: result.participant,
              addedById: ctx.user.id,
              workspaceId: ctx.membership.workspaceId,
            });
        }
      }
    }

    return result;
  });

export const removeParticipantFromGroup = securityProcedure([])
  .input(removeParticipantFromGroupSchema)
  .handler(async ({ input, ctx }) => {
    const command = RemoveParticipantFromGroup.instance();

    const result = await command.execute({
      conversationId: input.conversationId,
      userId: input.userId,
      removedByUserId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
    });

    if (result.success) {
      const conversation = await conversationsRepository.retrieveWithParticipants(
        input.conversationId
      );

      if (conversation) {
        const participantIds = conversation.participants.map((p) => p.userId);

        for (const participantId of [...participantIds, input.userId]) {
          socket
            ?.to(`user:${participantId}`)
            .emit("internal:participant:removed", {
              conversationId: input.conversationId,
              removedUserId: input.userId,
              removedById: ctx.user.id,
              workspaceId: ctx.membership.workspaceId,
            });
        }
      }
    }

    return result;
  });

export const leaveInternalConversation = securityProcedure([])
  .input(leaveInternalConversationSchema)
  .handler(async ({ input, ctx }) => {
    const command = LeaveInternalConversation.instance();

    const result = await command.execute({
      conversationId: input.conversationId,
      userId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
    });

    if (result.success) {
      const conversation = await conversationsRepository.retrieveWithParticipants(
        input.conversationId
      );

      if (conversation) {
        const participantIds = conversation.participants.map((p) => p.userId);

        for (const participantId of [...participantIds, ctx.user.id]) {
          socket?.to(`user:${participantId}`).emit("internal:participant:left", {
            conversationId: input.conversationId,
            leftUserId: ctx.user.id,
            workspaceId: ctx.membership.workspaceId,
          });
        }
      }
    }

    return result;
  });

export const listInternalConversations = securityProcedure([]).handler(
  async ({ ctx }) => {
    const query = ListInternalConversations.instance();

    const result = await query.execute({
      userId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
    });

    return result;
  }
);

export const getInternalConversation = securityProcedure([])
  .input(getInternalConversationSchema)
  .handler(async ({ input, ctx }) => {
    const query = GetInternalConversation.instance();

    const result = await query.execute({
      conversationId: input.conversationId,
      userId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
    });

    return result;
  });

export const loadInternalMessages = securityProcedure([])
  .input(getInternalConversationSchema)
  .handler(async ({ input }) => {
    return await messagesRepository.list(input.conversationId);
  });
