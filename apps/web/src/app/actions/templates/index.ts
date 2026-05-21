"use server";
import { gatewayActions } from "@/lib/gateway-client";
import type { GatewayTemplate } from "@/lib/gateway-client";
import { securityProcedure } from "../procedure";
import {
  addGeneralTemplateInputSchema,
  updateGeneralTemplateInputSchema,
  upsertTemplateInputSchema,
} from "./schema";
import { revalidatePath } from "next/cache";
import z from "zod";
import { TemplatesDatabaseRepository } from "@omnichannel/core/infra/repositories/templates-repository";
import { ChannelsDatabaseRepository } from "@omnichannel/core/infra/repositories/channels-repository";

const templatesRepository = TemplatesDatabaseRepository.instance();
const channelsRepository = ChannelsDatabaseRepository.instance();

export const listTemplates = securityProcedure(["manage:templates", "list:templates"]).handler(
  async ({ ctx }): Promise<GatewayTemplate[]> => {
    const response = await gatewayActions.listTemplates(
      ctx.membership.workspaceId,
      "whatsapp"
    );

    if (!response.success) {
      console.error("[listTemplates] Gateway error:", response.error);
      return [];
    }

    return response.data ?? [];
  }
);

export const loadTemplatesApprovedFromChannel = securityProcedure([
  "manage:templates",
  "list:templates",
])
  .input(
    z.object({
      channelId: z.string(),
    })
  )
  .handler(async ({ input, ctx }): Promise<GatewayTemplate[]> => {
    const response = await gatewayActions.listApprovedTemplates(
      ctx.membership.workspaceId,
      input.channelId
    );

    if (!response.success) {
      console.error("[loadTemplatesApprovedFromChannel] Gateway error:", response.error);
      return [];
    }

    return response.data ?? [];
  });

export const removeTemplates = securityProcedure(["manage:templates"])
  .input(
    z.object({
      name: z.string(),
      channelId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const response = await gatewayActions.deleteTemplate(
      ctx.membership.workspaceId,
      input.channelId,
      input.name
    );

    if (!response.success) {
      console.error("[removeTemplates] Gateway error:", response.error);
      throw new Error(response.error ?? "Failed to remove template");
    }

    revalidatePath("/templates", "page");
  });

export const upsertTemplate = securityProcedure(["manage:templates"])
  .input(upsertTemplateInputSchema)
  .handler(async ({ input, ctx }) => {
    if (input.type !== "whatsapp") return;

    const response = await gatewayActions.createTemplate(
      ctx.membership.workspaceId,
      input.channelId,
      {
        name: input.name,
        category: input.category,
        language: input.lang,
        text: input.text,
        variables: input.variables,
      }
    );

    if (!response.success) {
      console.error("[upsertTemplate] Gateway error:", response.error);
      throw new Error(response.error ?? "Failed to create template");
    }

    revalidatePath("/templates", "page");
  });

export const listGeneralTemplates = securityProcedure([
  "manage:templates",
  "list:templates",
]).handler(async ({ ctx, input }) => {
  const channels = await channelsRepository.list(ctx.membership.workspaceId);

  const templates = await templatesRepository.list(channels.map((c) => c.id));

  return templates;
});

export const addTemplateGeneral = securityProcedure(["manage:templates"])
  .input(addGeneralTemplateInputSchema)
  .handler(async ({ input }) => {
    await templatesRepository.addGeneralTemplate({
      name: input.name,
      status: "approved",
      language: input.lang,
      text: input.text,
      category: "general",
      channelId: input.channelId,
    });
  });

export const updateTemplateGeneral = securityProcedure(["manage:templates"])
  .input(updateGeneralTemplateInputSchema)
  .handler(async ({ input }) => {
    await templatesRepository.updateGeneralTemplate(input.id, {
      name: input.name,
      status: "approved",
      language: input.lang,
      text: input.text,
      category: "general",
      channelId: input.channelId,
    });
  });

export const deleteTemplateGeneral = securityProcedure(["manage:templates"])
  .input(z.array(z.string()))
  .handler(async ({ input }) => {
    await templatesRepository.deleteGeneralTemplates(input);
  });

export const retrieveGeneralTemplate = securityProcedure(["manage:templates", "list:templates"])
  .input(
    z.object({
      id: z.string().uuid(),
    })
  )
  .handler(async ({ input }) => {
    const template = await templatesRepository.retrieveGeneralTemplate(
      input.id
    );
    return template;
  });
