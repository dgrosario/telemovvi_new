"use server";

import z from "zod";
import { securityProcedure } from "../procedure";
import { LabelsDatabaseRepository } from "@omnichannel/core/infra/repositories/labels-repository";
import { PartnersLabelsDatabaseRepository } from "@omnichannel/core/infra/repositories/partners-labels-repository";
import { Label } from "@omnichannel/core/domain/entities/label";
import { labelSchema } from "./schema";

const labelsRepository = LabelsDatabaseRepository.instance();
const partnersLabelsRepository = PartnersLabelsDatabaseRepository.instance();

export const listLabels = securityProcedure(["manage:labels", "list:labels"]).handler(
  async ({ ctx }) => {
    return await labelsRepository.list(ctx.membership.workspaceId);
  }
);

export const retrieveLabel = securityProcedure(["manage:labels", "list:labels"])
  .input(z.object({ id: z.string() }))
  .handler(async ({ ctx, input }) => {
    const label = await labelsRepository.retrieve(input.id, ctx.membership.workspaceId);
    if (!label) return null;
    return label.raw();
  });

export const upsertLabel = securityProcedure(["manage:labels", "register:labels"])
  .input(labelSchema)
  .handler(async ({ ctx, input }) => {
    const exists = await labelsRepository.exists(
      input.name,
      ctx.membership.workspaceId,
      input.id
    );

    if (exists) {
      throw new Error("Já existe uma etiqueta com este nome");
    }

    let label: Label;

    if (input.id) {
      const existing = await labelsRepository.retrieve(input.id, ctx.membership.workspaceId);
      if (!existing) {
        throw new Error("Etiqueta não encontrada");
      }
      existing.setName(input.name);
      if (input.color) {
        existing.setColor(input.color);
      }
      label = existing;
    } else {
      label = Label.create({
        name: input.name,
        color: input.color,
        workspaceId: ctx.membership.workspaceId,
      });
    }

    await labelsRepository.upsert(label);

    return label.raw();
  });

export const removeLabel = securityProcedure(["manage:labels", "remove:labels"])
  .input(z.object({ id: z.string() }))
  .handler(async ({ ctx, input }) => {
    await labelsRepository.remove(input.id, ctx.membership.workspaceId);
  });

export const removeLabels = securityProcedure(["manage:labels", "remove:labels"])
  .input(z.object({ ids: z.array(z.string()).min(1) }))
  .handler(async ({ ctx, input }) => {
    await labelsRepository.removeMany(input.ids, ctx.membership.workspaceId);
  });

export const listPartnerLabels = securityProcedure(["manage:labels", "list:labels"])
  .input(z.object({ partnerId: z.string() }))
  .handler(async ({ ctx, input }) => {
    return await partnersLabelsRepository.listLabelsByPartner(input.partnerId, ctx.membership.workspaceId);
  });

export const setPartnerLabels = securityProcedure(["manage:labels", "register:labels"])
  .input(z.object({
    partnerId: z.string(),
    labelIds: z.array(z.string()),
  }))
  .handler(async ({ ctx, input }) => {
    await partnersLabelsRepository.setPartnerLabels(
      input.partnerId,
      input.labelIds,
      ctx.membership.workspaceId
    );
  });

export const addLabelToPartner = securityProcedure(["manage:labels", "register:labels"])
  .input(z.object({
    partnerId: z.string(),
    labelId: z.string(),
  }))
  .handler(async ({ ctx, input }) => {
    await partnersLabelsRepository.addLabelToPartner(
      input.partnerId,
      input.labelId,
      ctx.membership.workspaceId
    );
  });

export const removeLabelFromPartner = securityProcedure(["manage:labels", "remove:labels"])
  .input(z.object({
    partnerId: z.string(),
    labelId: z.string(),
  }))
  .handler(async ({ ctx, input }) => {
    await partnersLabelsRepository.removeLabelFromPartner(
      input.partnerId,
      input.labelId,
      ctx.membership.workspaceId
    );
  });
