"use server";

import { UpsertRole } from "@omnichannel/core/application/command/upsert-role";
import { RemoveRole } from "@omnichannel/core/application/command/remove-role";
import { ListRoles } from "@omnichannel/core/application/queries/list-roles";
import { RolesDatabaseRepository } from "@omnichannel/core/infra/repositories/roles-repository";
import {
  permissions,
  type PolicyName,
} from "@omnichannel/core/domain/services/permissions";
import z from "zod";
import { securityProcedure } from "../procedure";

const rolesRepository = RolesDatabaseRepository.instance();

export const listRoles = securityProcedure([
  "list:roles",
  "register:permissions",
  "manage:users",
]).handler(async ({ ctx }) => {
  const listRoles = ListRoles.instance();
  return await listRoles.execute(ctx.membership.workspaceId);
});

export const retrieveRole = securityProcedure(["list:roles"])
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const role = await rolesRepository.retrieve(input.id);
    if (!role) return null;
    return role.raw();
  });

export const upsertRole = securityProcedure(["register:roles"])
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      permissions: z
        .array(z.enum(Array.from(permissions.keys()) as [string, ...string[]]))
        .optional(),
      blockedSectorIds: z.array(z.string().uuid()).optional(),
    })
  )
  .handler(async ({ ctx, input }) => {
    const upsertRole = UpsertRole.instance();
    const role = await upsertRole.execute({
      id: input.id,
      name: input.name,
      description: input.description,
      workspaceId: ctx.membership.workspaceId,
      permissions: input.permissions as PolicyName[] | undefined,
      blockedSectorIds: input.blockedSectorIds,
    });
    return role.raw();
  });

export const removeRoles = securityProcedure(["remove:roles"])
  .input(
    z.object({
      ids: z.array(z.string()).min(1),
    })
  )
  .handler(async ({ input }) => {
    const removeRole = RemoveRole.instance();
    await removeRole.execute({ ids: input.ids });
  });

export const createSystemRoles = securityProcedure(["register:roles"]).handler(
  async ({ ctx }) => {
    await rolesRepository.createSystemRolesForWorkspace(
      ctx.membership.workspaceId
    );
  }
);

export const syncSystemRolesPermissions = securityProcedure(["register:roles"]).handler(
  async ({ ctx }) => {
    await rolesRepository.syncSystemRolesPermissions(
      ctx.membership.workspaceId
    );
  }
);
