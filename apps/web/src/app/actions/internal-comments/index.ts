"use server";

import { getSocketServer } from "@/lib/io-server";
import { SendInternalComment } from "@omnichannel/core/application/command/send-internal-comment";
import { MessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/messages-repository";
import { InternalConversationParticipantsDatabaseRepository } from "@omnichannel/core/infra/repositories/internal-conversation-participants-repository";
import { CreateNotification } from "@omnichannel/core/application/command/create-notification";
import { NotificationsDatabaseRepository } from "@omnichannel/core/infra/repositories/notifications-repository";
import { NotificationsCacheDriver } from "@omnichannel/core/infra/drivers/notifications-cache-driver";
import { NotificationEmitter } from "@/lib/notification-emitter";
import { securityProcedure } from "../procedure";
import { sendInternalCommentSchema } from "./schema";

const socket = getSocketServer();
const messagesRepository = MessagesDatabaseRepository.instance();
const participantsRepository =
  InternalConversationParticipantsDatabaseRepository.instance();
const notificationsRepository = NotificationsDatabaseRepository.instance();
const notificationsCacheDriver = NotificationsCacheDriver.instance();

export const sendInternalComment = securityProcedure(["send:internal-comment"])
  .input(sendInternalCommentSchema)
  .handler(async ({ input, ctx }) => {
    const command = SendInternalComment.instance();

    const result = await command.execute({
      conversationId: input.conversationId,
      senderId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      content: input.content,
    });

    const message = await messagesRepository.retrieve(result.messageId);

    if (message) {
      socket
        ?.to(`workspace:${ctx.membership.workspaceId}`)
        .emit("internal:comment:received", {
          conversationId: input.conversationId,
          message: message.raw(),
          workspaceId: ctx.membership.workspaceId,
        });

      const participants = await participantsRepository.listByConversation(
        input.conversationId
      );

      const createNotificationCommand = CreateNotification.instance(
        notificationsRepository,
        notificationsCacheDriver
      );

      const recipientIds = participants
        .filter((p) => p.userId !== ctx.user.id)
        .map((p) => p.userId);

      for (const recipientId of recipientIds) {
        const notification = await createNotificationCommand.execute({
          workspaceId: ctx.membership.workspaceId,
          type: "internal:message",
          title: "Nova mensagem interna",
          content: `${ctx.user.name} enviou: ${input.content.substring(0, 100)}${input.content.length > 100 ? "..." : ""}`,
          metadata: {
            conversationId: input.conversationId,
            messageId: result.messageId,
            senderId: ctx.user.id,
            senderName: ctx.user.name,
          },
          recipientType: "user",
          recipientId,
          priority: "normal",
        });

        if (socket) {
          NotificationEmitter.emitToUser(
            socket,
            recipientId,
            ctx.membership.workspaceId,
            notification
          );
        }
      }
    }

    return result;
  });
