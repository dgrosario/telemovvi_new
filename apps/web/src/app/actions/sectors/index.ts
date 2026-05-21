"use server";

import { RemoveManySectors } from "@omnichannel/core/application/command/remove-sector";
import { UpsertSector } from "@omnichannel/core/application/command/upsert-sector";
import { ListMySector } from "@omnichannel/core/application/command/list-my-sector";
import { GetDefaultSector } from "@omnichannel/core/application/queries/get-default-sector";
import { SectorsDatabaseRepository } from "@omnichannel/core/infra/repositories/sectors-respository";
import { ChannelInSectorsDatabaseRepository } from "@omnichannel/core/infra/repositories/channels-in-sectors-repository";
import { createDatabaseConnection, eq, and } from "@omnichannel/core/infra/database";
import { usersInSector } from "@omnichannel/core/infra/database/schemas";
import z from "zod";
import { securityProcedure } from "../procedure";

const sectorsRepository = SectorsDatabaseRepository.instance();
const channelInSectorsRepository = new ChannelInSectorsDatabaseRepository();

export const retrieveSector = securityProcedure([
  "manage:sectors",
  "list:sectors",
])
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const sector = await sectorsRepository.retrieve(input.id);
    if (!sector) return null;
    return sector.raw();
  });

export const listSectors = securityProcedure([
  "manage:sectors",
  "list:sectors",
  "manage:users",
  "list:users",
]).handler(async ({ ctx }) => {
  return await sectorsRepository.list(ctx.membership.workspaceId);
});

export const listMySectors = securityProcedure([
  "manage:sectors",
  "list:sectors",
  "manage:users",
  "list:users",
]).handler(async ({ ctx }) => {
  const listInstance = ListMySector.instance();
  return await listInstance.execute({
    id: ctx.user.id,
    workspaceId: ctx.membership.workspaceId,
    membership: ctx.membership,
  });
});

export const listCurrentUserSectors = securityProcedure(["send:message"]).handler(
  async ({ ctx }) => {
    const listInstance = ListMySector.instance();
    return await listInstance.execute({
      id: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      membership: ctx.membership,
    });
  }
);

export const upsertSector = securityProcedure([
  "manage:sectors",
  "register:sectors",
  "manage:users",
  "register:users",
])
  .input(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      workingHoursStart: z
        .string()
        .regex(/^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/)
        .optional(),
      workingHoursEnd: z
        .string()
        .regex(/^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/)
        .optional(),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      isDefault: z.boolean().optional(),
    })
  )
  .handler(async ({ ctx, input }) => {
    const upsertSector = UpsertSector.instance();
    await upsertSector.execute({
      id: input.id,
      name: input.name,
      workspaceId: ctx.membership.workspaceId,
      workingHoursStart: input.workingHoursStart,
      workingHoursEnd: input.workingHoursEnd,
      color: input.color,
      isDefault: input.isDefault,
    });
  });

export const removeSectors = securityProcedure(["manage:sectors"])
  .input(
    z.object({
      ids: z.array(z.string()).min(1),
    })
  )
  .handler(async ({ input }) => {
    const removeManySectors = RemoveManySectors.instance();
    await removeManySectors.execute({ ids: input.ids });
  });

export const addUsersToSector = securityProcedure([
  "manage:users",
  "register:users",
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      userIds: z.array(z.string()).min(1),
      sectorId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { userIds, sectorId } = input;

    const db = createDatabaseConnection();

    for (const userId of userIds) {
      await db
        .insert(usersInSector)
        .values({ userId, sectorId })
        .onConflictDoNothing();
    }
  });

export const addSectorsToUser = securityProcedure([
  "manage:users",
  "register:users",
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      sectorId: z.string(),
      userId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { sectorId, userId } = input;

    const db = createDatabaseConnection();
    await db
      .insert(usersInSector)
      .values({ userId, sectorId })
      .onConflictDoNothing();
  });

export const addSectorsToChannel = securityProcedure([
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      sectorsIds: z.array(z.string()).min(1),
      channelId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { sectorsIds, channelId } = input;

    return await channelInSectorsRepository.addRelationsToChannel(
      channelId,
      sectorsIds
    );
  });

export const listUsersBySector = securityProcedure([
  "manage:users",
  "list:users",
  "manage:sectors",
  "list:sectors",
])
  .input(
    z.object({
      sectorId: z.string(),
    })
  )
  .handler(async ({ input, ctx }) => {
    const { sectorId } = input;

    const db = createDatabaseConnection();
    const usersInSectorData = await db
      .select({
        userId: usersInSector.userId,
        sectorId: usersInSector.sectorId,
      })
      .from(usersInSector)
      .where(eq(usersInSector.sectorId, sectorId));

    return usersInSectorData;
  });

export const listSectorsByUser = securityProcedure([
  "manage:users",
  "list:users",
  "manage:sectors",
  "list:sectors",
])
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { userId } = input;

    const db = createDatabaseConnection();
    const sectorsData = await db
      .select({
        userId: usersInSector.userId,
        sectorId: usersInSector.sectorId,
      })
      .from(usersInSector)
      .where(eq(usersInSector.userId, userId));

    return sectorsData;
  });

export const listSectorsByChannel = securityProcedure([
  "manage:sectors",
  "list:sectors",
])
  .input(
    z.object({
      channelId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { channelId } = input;

    return await channelInSectorsRepository.listByChannel(channelId);
  });

export const removeUsersFromSector = securityProcedure([
  "manage:users",
  "register:users",
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      userIds: z.array(z.string()).min(1),
      sectorId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { userIds, sectorId } = input;

    const db = createDatabaseConnection();
    for (const userId of userIds) {
      await db
        .delete(usersInSector)
        .where(
          and(
            eq(usersInSector.userId, userId),
            eq(usersInSector.sectorId, sectorId)
          )
        );
    }
  });

export const removeSectorsFromUser = securityProcedure([
  "manage:users",
  "register:users",
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { userId } = input;

    const db = createDatabaseConnection();
    await db
      .delete(usersInSector)
      .where(eq(usersInSector.userId, userId));
  });

export const removeSectorsFromChannel = securityProcedure([
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      sectorsIds: z.array(z.string()).min(1),
      channelId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { channelId, sectorsIds } = input;

    await channelInSectorsRepository.deleteRelationsFromChannel(
      sectorsIds,
      channelId
    );
  });

export const addChannelsToSector = securityProcedure([
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      channelsIds: z.array(z.string()).min(1),
      sectorId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { channelsIds, sectorId } = input;

    return await channelInSectorsRepository.addRelationsToSector(
      channelsIds,
      sectorId
    );
  });

export const listChannelsBySector = securityProcedure([
  "manage:sectors",
  "list:sectors",
])
  .input(
    z.object({
      sectorId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { sectorId } = input;

    return await channelInSectorsRepository.listBySector(sectorId);
  });

export const removeChannelsFromSector = securityProcedure([
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      channelsIds: z.array(z.string()).min(1),
      sectorId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { channelsIds, sectorId } = input;

    await channelInSectorsRepository.deleteRelationsFromSector(
      channelsIds,
      sectorId
    );
  });

export const getDefaultSector = securityProcedure([
  "manage:sectors",
  "list:sectors",
]).handler(async ({ ctx }) => {
  const getDefaultSector = GetDefaultSector.instance();
  return await getDefaultSector.execute({
    workspaceId: ctx.membership.workspaceId,
  });
});

export const bulkAssignSector = securityProcedure([
  "manage:users",
  "register:users",
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      userIds: z.array(z.string()).min(1),
      sectorIds: z.array(z.string()),
    })
  )
  .handler(async ({ input }) => {
    const { userIds, sectorIds } = input;
    const db = createDatabaseConnection();

    for (const userId of userIds) {
      for (const sectorId of sectorIds) {
        await db
          .insert(usersInSector)
          .values({ userId, sectorId })
          .onConflictDoNothing();
      }
    }
  });

export const removeOneSectorFromUser = securityProcedure([
  "manage:users",
  "register:users",
  "manage:sectors",
  "register:sectors",
])
  .input(
    z.object({
      userId: z.string(),
      sectorId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const { userId, sectorId } = input;

    const db = createDatabaseConnection();
    await db
      .delete(usersInSector)
      .where(
        and(
          eq(usersInSector.userId, userId),
          eq(usersInSector.sectorId, sectorId)
        )
      );
  });

export const listAvailableSectorsForNewConversation = securityProcedure([
  "send:message",
])
  .input(z.object({ channelId: z.string() }))
  .handler(async ({ input, ctx }) => {
    const channelSectors = await channelInSectorsRepository.listByChannel(
      input.channelId
    );

    const listInstance = ListMySector.instance();
    const userSectors = await listInstance.execute({
      id: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      membership: ctx.membership,
    });

    if (channelSectors.length === 0) {
      return userSectors;
    }

    const channelSectorIds = new Set(channelSectors.map((s) => s.sectorId));
    return userSectors.filter((s) => channelSectorIds.has(s.id));
  });

export const listSectorsForTransfer = securityProcedure([
  "send:message",
]).handler(async ({ ctx }) => {
  return await sectorsRepository.list(ctx.membership.workspaceId);
});
