"use server";
import { QuickMessage } from "@omnichannel/core/domain/entities/quick-message";
import { QuickMessagesDatabaseRepository } from "@omnichannel/core/infra/repositories/quick-messages-repository";
import { SystemVariablesDatabaseRepository } from "@omnichannel/core/infra/repositories/system-variables-repository";
import { ConversationsDatabaseRepository } from "@omnichannel/core/infra/repositories/conversations-repository";
import { VariableResolverService } from "@omnichannel/core/domain/services/variable-resolver-service";
import { revalidatePath } from "next/cache";
import z from "zod";
import { securityProcedure } from "../procedure";
import {
  createQuickMessageSchema,
  searchQuickMessageSchema,
  updateQuickMessageSchema,
  resolveQuickMessageVariablesSchema,
  resolveMessageVariablesSchema,
} from "./schema";

const quickMessagesRepository = QuickMessagesDatabaseRepository.instance();
const systemVariablesRepository = SystemVariablesDatabaseRepository.instance();
const conversationsRepository = ConversationsDatabaseRepository.instance();

export const listQuickMessages = securityProcedure([
  "view:quick-messages",
]).handler(async ({ ctx }) => {
  const messages = await quickMessagesRepository.listByWorkspace(
    ctx.membership.workspaceId,
    ctx.user.id
  );
  return messages;
});

export const createQuickMessage = securityProcedure(["create:quick-messages"])
  .input(createQuickMessageSchema)
  .handler(async ({ ctx, input }) => {
    const quickMessage = QuickMessage.create({
      shortcode: input.shortcode,
      message: input.message,
      isPublic: input.isPublic,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      mediaName: input.mediaName,
      userId: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
    });

    const created = await quickMessagesRepository.create(quickMessage);
    revalidatePath("/quick-messages", "page");
    return created.raw();
  });

export const updateQuickMessage = securityProcedure(["create:quick-messages"])
  .input(updateQuickMessageSchema)
  .handler(async ({ ctx, input }) => {
    const existing = await quickMessagesRepository.findById(input.id);

    if (!existing) {
      throw new Error("Mensagem rápida não encontrada");
    }

    const isOwner = existing.userId === ctx.user.id;
    const canManageOthers = ctx.membership.hasPermission("manage:quick-messages");
    if (!isOwner && !canManageOthers) {
      throw new Error("Você não tem permissão para editar esta mensagem");
    }

    const updated = await quickMessagesRepository.update(input.id, {
      shortcode: input.shortcode,
      message: input.message,
      isPublic: input.isPublic,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      mediaName: input.mediaName,
    });

    revalidatePath("/quick-messages", "page");
    return updated?.raw() ?? null;
  });

export const deleteQuickMessage = securityProcedure(["create:quick-messages"])
  .input(z.array(z.string().uuid()))
  .handler(async ({ ctx, input }) => {
    const canDeleteOthers = ctx.membership.hasPermission("delete:quick-messages");

    for (const id of input) {
      const existing = await quickMessagesRepository.findById(id);

      if (!existing) continue;

      const isOwner = existing.userId === ctx.user.id;
      if (!isOwner && !canDeleteOthers) {
        continue;
      }

      await quickMessagesRepository.delete(id);
    }

    revalidatePath("/quick-messages", "page");
  });

export const retrieveQuickMessage = securityProcedure(["view:quick-messages"])
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ ctx, input }) => {
    const message = await quickMessagesRepository.findById(input.id);

    if (!message) return null;

    const isOwner = message.userId === ctx.user.id;
    const canViewPrivate = ctx.membership.hasPermission("view:private-quick-messages");
    const canAccess = isOwner || canViewPrivate || message.isPublic;

    if (!canAccess) {
      return null;
    }

    return message.raw();
  });

export const searchQuickMessages = securityProcedure(["view:quick-messages"])
  .input(searchQuickMessageSchema)
  .handler(async ({ ctx, input }) => {
    const messages = await quickMessagesRepository.searchByShortcode(
      ctx.membership.workspaceId,
      ctx.user.id,
      input.query
    );
    return messages;
  });

export const getQuickMessageByShortcode = securityProcedure(["view:quick-messages"])
  .input(z.object({ shortcode: z.string() }))
  .handler(async ({ ctx, input }) => {
    const message = await quickMessagesRepository.findByShortcode(
      ctx.membership.workspaceId,
      ctx.user.id,
      input.shortcode
    );
    return message?.raw() ?? null;
  });

export const resolveQuickMessageVariables = securityProcedure(["send:message"])
  .input(resolveQuickMessageVariablesSchema)
  .handler(async ({ ctx, input }) => {
    const quickMessage = await quickMessagesRepository.findById(
      input.quickMessageId
    );

    if (!quickMessage) {
      throw new Error("Mensagem rápida não encontrada");
    }

    const isOwner = quickMessage.userId === ctx.user.id;
    const canAccess = isOwner || quickMessage.isPublic;

    if (!canAccess) {
      throw new Error("Você não tem permissão para acessar esta mensagem");
    }

    let resolvedMessage = quickMessage.message;

    if (input.conversationId) {
      const conversation = await conversationsRepository.retrieve(
        input.conversationId
      );

      if (conversation) {
        const variables = await systemVariablesRepository.listForWorkspace(
          ctx.membership.workspaceId
        );

        const context = VariableResolverService.buildContext(
          {
            contact: conversation.contact
              ? {
                  name: conversation.contact.name,
                  value: conversation.contact.value,
                }
              : null,
            attendant: conversation.attendant
              ? {
                  id: conversation.attendant.id,
                  name: conversation.attendant.name,
                }
              : null,
            sector: conversation.sector
              ? {
                  name: conversation.sector.name,
                }
              : null,
            id: conversation.id,
          },
          ctx.membership.workspaceId
        );

        const resolver = VariableResolverService.instance();
        resolvedMessage = resolver.resolveAll(
          quickMessage.message,
          variables,
          context
        );
      }
    }

    return {
      message: resolvedMessage,
      mediaUrl: quickMessage.mediaUrl,
      mediaType: quickMessage.mediaType,
      mediaName: quickMessage.mediaName,
    };
  });

export const resolveMessageVariables = securityProcedure(["send:message"])
  .input(resolveMessageVariablesSchema)
  .handler(async ({ ctx, input }) => {
    const conversation = await conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) {
      return input.content;
    }

    const variables = await systemVariablesRepository.listForWorkspace(
      ctx.membership.workspaceId
    );

    const context = VariableResolverService.buildContext(
      {
        contact: conversation.contact
          ? {
              name: conversation.contact.name,
              value: conversation.contact.value,
            }
          : null,
        attendant: conversation.attendant
          ? {
              id: conversation.attendant.id,
              name: conversation.attendant.name,
            }
          : null,
        sector: conversation.sector
          ? {
              name: conversation.sector.name,
            }
          : null,
        id: conversation.id,
      },
      ctx.membership.workspaceId
    );

    const resolver = VariableResolverService.instance();
    return resolver.resolveAll(input.content, variables, context);
  });
