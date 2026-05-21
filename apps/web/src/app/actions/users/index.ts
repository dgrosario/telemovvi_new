"use server";
import { COOKIE_TOKEN_NAME, COOKIE_WORKSPACE_NAME } from "@/app/constants";
import type { ChatAttendant } from "@/types/chat-attendant";
import { WorkspaceServices } from "@omnichannel/core/application/services/workspace-services";
import { Membership } from "@omnichannel/core/domain/entities/membership";
import { User } from "@omnichannel/core/domain/entities/user";
import { InvalidCreation } from "@omnichannel/core/domain/errors/invalid-creation";
import { NotAuthorized } from "@omnichannel/core/domain/errors/not-authorized";
import { AuthorizationService } from "@omnichannel/core/domain/services/authorization-service";
import { PolicyName } from "@omnichannel/core/domain/services/permissions";
import { BcryptPasswordDriver } from "@omnichannel/core/infra/drivers/password-driver";
import { JWTTokenDriver } from "@omnichannel/core/infra/drivers/token-driver";
import { MembershipsDatabaseRepository } from "@omnichannel/core/infra/repositories/membership-repository";
import { UsersDatabaseRepository } from "@omnichannel/core/infra/repositories/users-repository";
import { WorkspacesRepository } from "@omnichannel/core/infra/repositories/workspaces-repository";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { createServerAction } from "zsa";
import { securityProcedure } from "../procedure";
import {
  authenticateInputSchema,
  changeOwnPasswordInputSchema,
  resetPasswordInputSchema,
  upsertUserInputSchema,
} from "./schema";

const usersRepository = UsersDatabaseRepository.instance();
const authorizationService = AuthorizationService.instance();
const passwordDriver = BcryptPasswordDriver.instance();
const workspaceServices = WorkspaceServices.instance();
const workspacesRepository = WorkspacesRepository.instance();
const tokenDriver = JWTTokenDriver.instance();
const membershipRepository = MembershipsDatabaseRepository.instance();

export const changeWorkspace = securityProcedure()
  .input(
    z.object({
      workspaceId: z.string(),
      pathname: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_WORKSPACE_NAME, input.workspaceId);
    revalidatePath(input.pathname, "layout");
  });

export const listWorkspaces = securityProcedure()
  .output(
    z.object({
      workspaces: z.array(z.object({ id: z.string(), name: z.string() })),
      workspace: z.object({ id: z.string(), name: z.string() }),
    })
  )
  .handler(async ({ ctx }) => {
    const workspaces = await workspacesRepository.list(ctx.user.id);
    return {
      workspaces,
      workspace: workspaces.find((w) => w.id === ctx.membership.workspaceId)!,
    };
  });

export const authenticate = createServerAction()
  .input(authenticateInputSchema)
  .onError(async (err) => {
    console.log(err);
  })
  .handler(async ({ input }) => {
    const user = await usersRepository.retrieveUserByEmail(input.email);

    if (!user) throw NotAuthorized.throw(["Usuário ou senha incorreta"]);

    const membership = await membershipRepository.retrieveFirstByUserId(
      user.id
    );

    if (!membership) throw NotAuthorized.throw(["Usuário ou senha incorreta"]);

    const isAllowed = authorizationService.can(
      "start:session",
      user,
      membership
    );

    if (!isAllowed) throw NotAuthorized.throw(["Usuário ou senha incorreta"]);

    const password = await usersRepository.retrievePassword(user.id);

    if (!password) throw NotAuthorized.throw(["Usuário ou senha incorreta"]);

    const passIsCorrect = passwordDriver.compare(input.password, password);

    if (!passIsCorrect)
      throw NotAuthorized.throw(["Usuário ou senha incorreta"]);

    const workspace = await workspacesRepository.retrieveFirstWorkspaceByUserId(
      user.id
    );

    let workspaceId = workspace?.id;

    if (!workspace) {
      workspaceId = await workspaceServices.create("Geral");
    }

    if (!workspaceId) throw InvalidCreation.instance();

    const token = tokenDriver.create(user.id);

    const cookieStore = await cookies();

    cookieStore.set(COOKIE_TOKEN_NAME, token);
    cookieStore.set(COOKIE_WORKSPACE_NAME, workspaceId);

    redirect(`/chat`);
  });

export const upsertUser = securityProcedure(["manage:users", "register:users"])
  .input(upsertUserInputSchema)
  .handler(async ({ ctx, input }) => {
    const isNewUser = !input.id;

    const userWithEmail = await usersRepository.retrieveUserByEmail(
      input.email!
    );
    if (userWithEmail && userWithEmail.id !== input.id) {
      throw new Error("Este email já está em uso por outro usuário");
    }

    const displayName = input.displayName || null;
    const phone = input.phone || null;
    const birthDate = input.birthDate || null;
    const address = input.address || null;

    let user: User;
    if (isNewUser) {
      user = User.create({
        email: input.email,
        name: input.name,
        displayName: displayName ?? undefined,
        phone: phone ?? undefined,
        birthDate: birthDate ?? undefined,
        address: address ?? undefined,
      });
    } else {
      const existingUser = await usersRepository.retrieve(input.id!);
      if (!existingUser) {
        throw new Error("Usuário não encontrado");
      }
      user = existingUser;
      user.update({
        name: input.name,
        email: input.email,
        displayName,
        phone,
        birthDate,
        address,
      });
    }

    await usersRepository.upsert(user);

    if (isNewUser && input.password) {
      const hashedPassword = passwordDriver.create(input.password);
      await usersRepository.setPassword(user.id, hashedPassword);
    }

    const membershipAlreadyExists =
      await membershipRepository.retrieveByUserIdAndWorkspaceId(
        user.id,
        ctx.membership.workspaceId
      );

    if (!membershipAlreadyExists) {
      const membership = Membership.create(ctx.membership.workspaceId, user.id);

      await membershipRepository.upsert(membership);
    }

    return { userId: user.id, isNewUser };
  });

export const listUsers = securityProcedure([
  "manage:users",
  "list:users",
]).handler(async ({ ctx }) => {
  return await usersRepository.list(ctx.membership.workspaceId);
});

/**
 * Lista atendentes para filtro no Chat.
 *
 * Regra: apenas para quem tem permissão (direta ou derivada) de ver atendentes no atendimento,
 * e a lista deve ser restrita aos mesmos setores do usuário.
 *
 * Importante: não pode "quebrar" a tela do Chat para perfis sem a permissão, então retorna [].
 */
export const listChatAttendants = securityProcedure().handler(async ({ ctx }) => {
  if (!ctx.membership.hasPermission("list:chat-attendants")) {
    return [];
  }

  // Importante: este action e opcional na UI. Em falhas (db/etc), devolvemos []
  // para nao quebrar a tela do Chat.
  try {
    const users = await usersRepository.listUsersFromUserSectors(
      ctx.user.id,
      ctx.membership.workspaceId
    );

    // Retorna apenas dados minimos necessarios para o filtro no Chat.
    return users.map(
      (u): ChatAttendant => ({ id: u.id, name: u.name, isActive: u.isActive })
    );
  } catch (error) {
    console.error("[listChatAttendants] Error:", error);
    return [];
  }
});

export const listUsersForTransfer = securityProcedure([
  "transfer:conversation",
]).handler(async ({ ctx }) => {
  return await usersRepository.listUsersFromUserSectors(
    ctx.user.id,
    ctx.membership.workspaceId
  );
});

export const listUsersForInternalConversation = securityProcedure([]).handler(
  async ({ ctx }) => {
    const users = await usersRepository.list(ctx.membership.workspaceId);
    return users
      .filter((user) => user.isActive)
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      }));
  }
);

export const listUsersBySectorForTransfer = securityProcedure([
  "transfer:conversation",
])
  .input(z.object({ sectorId: z.string() }))
  .handler(async ({ ctx, input }) => {
    return await usersRepository.listUsersBySectorId(
      input.sectorId,
      ctx.membership.workspaceId
    );
  });

export const retrieveUser = securityProcedure(["manage:users", "list:users"])
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, ctx }) => {
    return await usersRepository.retrieveFromList(input.id, ctx.membership.workspaceId);
  });

export const signOut = createServerAction().handler(async () => {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_TOKEN_NAME);
  redirect("/");
});

export const removeUser = securityProcedure(["manage:users", "remove:users"])
  .input(
    z.object({
      ids: z.array(z.string()),
    })
  )
  .handler(async ({ input }) => {
    for (const id of input.ids) {
      const user = await usersRepository.retrieve(id);
      if (user && !user.isDeletable) {
        throw new Error("Este usuário não pode ser excluído");
      }
      await usersRepository.remove(id);
    }
  });

export const upsertPermissions = securityProcedure([
  "manage:users",
  "register:permissions",
])
  .input(
    z.object({
      permissions: z.array(z.string()),
      userId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const membership =
      await membershipRepository.retrieveByUserIdAndWorkspaceId(
        input.userId,
        ctx.membership.workspaceId
      );
    if (!membership) return;
    membership.setPermissions(input.permissions as PolicyName[]);
    await membershipRepository.upsert(membership);
    revalidatePath("/");
  });

export const validateTransferPermission = securityProcedure([
  "list:conversation",
  "list:all-conversations",
])
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const membership =
      await membershipRepository.retrieveByUserIdAndWorkspaceId(
        input.userId,
        ctx.membership.workspaceId
      );
    if (!membership) return;

    const canTransferToUser =
      membership.permissions.includes("list:all-conversations");

    return canTransferToUser;
  });

export const resetPassword = securityProcedure(["manage:users"])
  .input(resetPasswordInputSchema)
  .handler(async ({ input }) => {
    const hashedPassword = passwordDriver.create(input.newPassword);
    await usersRepository.setPassword(input.userId, hashedPassword);
  });

export const changeOwnPassword = securityProcedure()
  .input(changeOwnPasswordInputSchema)
  .handler(async ({ ctx, input }) => {
    const currentHash = await usersRepository.retrievePassword(ctx.user.id);
    if (
      !currentHash ||
      !passwordDriver.compare(input.currentPassword, currentHash)
    ) {
      throw NotAuthorized.throw(["Senha atual incorreta"]);
    }
    const newHash = passwordDriver.create(input.newPassword);
    await usersRepository.setPassword(ctx.user.id, newHash);
  });

export const updateSignaturePreference = securityProcedure()
  .input(z.object({ enabled: z.boolean() }))
  .handler(async ({ ctx, input }) => {
    await usersRepository.updateSignaturePreference(ctx.user.id, input.enabled);
  });

export const bulkUpsertPermissions = securityProcedure([
  "manage:users",
  "register:permissions",
])
  .input(
    z.object({
      userIds: z.array(z.string()).min(1),
      permissions: z.array(z.string()),
    })
  )
  .handler(async ({ input, ctx }) => {
    for (const userId of input.userIds) {
      const membership =
        await membershipRepository.retrieveByUserIdAndWorkspaceId(
          userId,
          ctx.membership.workspaceId
        );
      if (!membership) continue;
      membership.setPermissions(input.permissions as PolicyName[]);
      await membershipRepository.upsert(membership);
    }
  });

export const updateUserActiveStatus = securityProcedure(["manage:users"])
  .input(
    z.object({
      userId: z.string(),
      isActive: z.boolean(),
    })
  )
  .handler(async ({ input }) => {
    await usersRepository.updateActiveStatus(input.userId, input.isActive);
  });

export const getCurrentMembership = securityProcedure().handler(
  async ({ ctx }) => {
    return {
      id: ctx.membership.id,
      workspaceId: ctx.membership.workspaceId,
      userId: ctx.membership.userId,
      permissions: ctx.membership.permissions,
      canTransferDirectly: ctx.membership.hasPermission("transfer:conversation"),
    };
  }
);
