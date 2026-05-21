"use server";
import { SystemVariable } from "@omnichannel/core/domain/entities/system-variable";
import { SystemVariablesDatabaseRepository } from "@omnichannel/core/infra/repositories/system-variables-repository";
import { revalidatePath } from "next/cache";
import z from "zod";
import { securityProcedure } from "../procedure";
import {
  createSystemVariableSchema,
  updateSystemVariableSchema,
} from "./schema";

const systemVariablesRepository = SystemVariablesDatabaseRepository.instance();

export const listSystemVariables = securityProcedure([
  "create:quick-messages",
]).handler(async ({ ctx }) => {
  const variables = await systemVariablesRepository.listForWorkspace(
    ctx.membership.workspaceId
  );
  return variables.map((v) => v.raw());
});

export const listAllSystemVariables = securityProcedure([
  "manage:templates",
]).handler(async ({ ctx }) => {
  const variables = await systemVariablesRepository.listByWorkspace(
    ctx.membership.workspaceId
  );
  return variables.map((v) => v.raw());
});

export const createSystemVariable = securityProcedure(["manage:templates"])
  .input(createSystemVariableSchema)
  .handler(async ({ ctx, input }) => {
    const existing = await systemVariablesRepository.findByKey(
      input.key,
      ctx.membership.workspaceId
    );

    if (existing) {
      throw new Error("Já existe uma variável com essa chave");
    }

    const variable = SystemVariable.create({
      key: input.key,
      label: input.label,
      description: input.description,
      resolverType: input.resolverType,
      resolverConfig: input.resolverConfig,
      workspaceId: ctx.membership.workspaceId,
      isSystem: false,
    });

    const created = await systemVariablesRepository.create(variable);
    revalidatePath("/settings/variables", "page");
    return created.raw();
  });

export const updateSystemVariable = securityProcedure(["manage:templates"])
  .input(updateSystemVariableSchema)
  .handler(async ({ ctx, input }) => {
    const existing = await systemVariablesRepository.findById(input.id);

    if (!existing) {
      throw new Error("Variável não encontrada");
    }

    if (existing.isSystem) {
      throw new Error("Variáveis do sistema não podem ser editadas");
    }

    if (existing.workspaceId !== ctx.membership.workspaceId) {
      throw new Error("Você não tem permissão para editar esta variável");
    }

    const updated = await systemVariablesRepository.update(input.id, {
      label: input.label,
      description: input.description,
      resolverConfig: input.resolverConfig,
      isActive: input.isActive,
    });

    revalidatePath("/settings/variables", "page");
    return updated?.raw() ?? null;
  });

export const deleteSystemVariable = securityProcedure(["manage:templates"])
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ ctx, input }) => {
    const existing = await systemVariablesRepository.findById(input.id);

    if (!existing) {
      throw new Error("Variável não encontrada");
    }

    if (existing.isSystem) {
      throw new Error("Variáveis do sistema não podem ser removidas");
    }

    if (existing.workspaceId !== ctx.membership.workspaceId) {
      throw new Error("Você não tem permissão para remover esta variável");
    }

    await systemVariablesRepository.delete(input.id);
    revalidatePath("/settings/variables", "page");
  });

export const retrieveSystemVariable = securityProcedure(["manage:templates"])
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ ctx, input }) => {
    const variable = await systemVariablesRepository.findById(input.id);

    if (!variable) return null;

    if (
      !variable.isSystem &&
      variable.workspaceId !== ctx.membership.workspaceId
    ) {
      return null;
    }

    return variable.raw();
  });
