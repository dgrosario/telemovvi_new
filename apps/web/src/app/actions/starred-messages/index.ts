"use server";

import { StarredMessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/starred-messages-repository";
import z from "zod";
import { securityProcedure } from "../procedure";

const starredMessagesRepository = StarredMessagesDatabaseRepository.instance();

export const starMessage = securityProcedure(["list:conversation"])
  .input(
    z.object({
      messageId: z.string(),
      conversationId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    await starredMessagesRepository.star(
      ctx.user.id,
      input.messageId,
      input.conversationId
    );
    return { success: true };
  });

export const unstarMessage = securityProcedure(["list:conversation"])
  .input(
    z.object({
      messageId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    await starredMessagesRepository.unstar(ctx.user.id, input.messageId);
    return { success: true };
  });

export const listStarredMessages = securityProcedure(["list:conversation"])
  .input(
    z.object({
      conversationId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    return starredMessagesRepository.listByConversation(
      ctx.user.id,
      input.conversationId
    );
  });

export const listStarredMessagesWithDetails = securityProcedure([
  "list:conversation",
])
  .input(
    z.object({
      conversationId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    return starredMessagesRepository.listWithDetailsByConversation(
      ctx.user.id,
      input.conversationId
    );
  });
