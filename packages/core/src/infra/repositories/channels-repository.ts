import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Channel, ChannelPayload, parseChannelPayload } from "../../domain/entities/channel";
import { createDatabaseConnection } from "../database";
import { channels, channelsInSector, responseChannels, usersInSector } from "../database/schemas";
import { alias } from "drizzle-orm/pg-core";

const notDeleted = isNull(channels.deletedAt);

export class ChannelsDatabaseRepository {
  async list(workspaceId: string, type?: Channel.Type): Promise<Channel.Raw[]> {
    const db = createDatabaseConnection();

    const filters = [eq(channels.workspaceId, workspaceId), notDeleted];

    if (type) {
      filters.push(eq(channels.type, type));
    }
    const resp = alias(channels, "resp");

    const result = await db
      .select({
        id: channels.id,
        name: channels.name,
        createdAt: channels.createdAt,
        status: channels.status,
        type: channels.type,
        payload: channels.payload,
        deletedAt: channels.deletedAt,
        responseChannel: {
          id: resp.id,
          name: resp.name,
          createdAt: resp.createdAt,
          status: resp.status,
          type: resp.type,
          payload: resp.payload,
          deletedAt: resp.deletedAt,
        },
      })
      .from(channels)
      .leftJoin(responseChannels, eq(responseChannels.receivedId, channels.id))
      .leftJoin(resp, eq(responseChannels.responseId, resp.id))
      .where(and(...filters));

    return result as Channel.Raw[];
  }

  async listByUserSectors(
    userId: string,
    workspaceId: string
  ): Promise<Channel.Raw[]> {
    const db = createDatabaseConnection();

    const userSectorIds = await db
      .selectDistinct({ sectorId: usersInSector.sectorId })
      .from(usersInSector)
      .where(eq(usersInSector.userId, userId));

    if (userSectorIds.length === 0) {
      return [];
    }

    const sectorIds = userSectorIds
      .map((s) => s.sectorId)
      .filter((id): id is string => id !== null);

    if (sectorIds.length === 0) {
      return [];
    }

    const channelIds = await db
      .selectDistinct({ channelId: channelsInSector.channelId })
      .from(channelsInSector)
      .where(inArray(channelsInSector.sectorId, sectorIds));

    if (channelIds.length === 0) {
      return [];
    }

    const validChannelIds = channelIds
      .map((c) => c.channelId)
      .filter((id): id is string => id !== null);

    if (validChannelIds.length === 0) {
      return [];
    }

    const resp = alias(channels, "resp");

    const result = await db
      .select({
        id: channels.id,
        name: channels.name,
        createdAt: channels.createdAt,
        status: channels.status,
        type: channels.type,
        payload: channels.payload,
        deletedAt: channels.deletedAt,
        responseChannel: {
          id: resp.id,
          name: resp.name,
          createdAt: resp.createdAt,
          status: resp.status,
          type: resp.type,
          payload: resp.payload,
          deletedAt: resp.deletedAt,
        },
      })
      .from(channels)
      .leftJoin(responseChannels, eq(responseChannels.receivedId, channels.id))
      .leftJoin(resp, eq(responseChannels.responseId, resp.id))
      .where(
        and(
          eq(channels.workspaceId, workspaceId),
          inArray(channels.id, validChannelIds),
          notDeleted
        )
      );

    return result as Channel.Raw[];
  }

  async upsert(channel: Channel, workspaceId: string) {
    const db = createDatabaseConnection();

    const safePayload = parseChannelPayload(channel.payload);

    await db
      .insert(channels)
      .values({
        id: channel.id,
        name: channel.name,
        payload: safePayload,
        workspaceId,
        createdAt: channel.createdAt,
        status: channel.status,
        type: channel.type,
      })
      .onConflictDoUpdate({
        set: {
          name: channel.name,
          workspaceId,
          createdAt: channel.createdAt,
          status: channel.status,
          type: channel.type,
          payload: safePayload,
        },
        target: channels.id,
      });
    if (channel.responseChannel) {
      await db
        .insert(responseChannels)
        .values({
          receivedId: channel.id,
          responseId: channel.responseChannel.id,
        })
        .onConflictDoUpdate({
          target: [responseChannels.receivedId, responseChannels.responseId],
          set: {
            receivedId: channel.id,
            responseId: channel.responseChannel.id,
          },
        });
    } else {
      await db
        .delete(responseChannels)
        .where(eq(responseChannels.receivedId, channel.id));
    }
  }

  async updateStatus(
    channelId: string,
    status: Channel.Status
  ): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .update(channels)
      .set({ status })
      .where(eq(channels.id, channelId));
  }

  async retrieve(id: string): Promise<Channel | null> {
    if (!id) return null;
    const db = createDatabaseConnection();
    const resp = alias(channels, "resp");

    const [result] = await db
      .select({
        id: channels.id,
        name: channels.name,
        createdAt: channels.createdAt,
        status: channels.status,
        type: channels.type,
        payload: channels.payload,
        deletedAt: channels.deletedAt,
        responseChannel: {
          id: resp.id,
          name: resp.name,
          createdAt: resp.createdAt,
          status: resp.status,
          type: resp.type,
          payload: resp.payload,
          deletedAt: resp.deletedAt,
        },
      })
      .from(channels)
      .leftJoin(responseChannels, eq(responseChannels.receivedId, channels.id))
      .leftJoin(resp, eq(responseChannels.responseId, resp.id))
      .where(and(eq(channels.id, id), notDeleted));

    if (!result) {
      return null;
    }

    return Channel.instance({
      id: result.id,
      name: result.name,
      createdAt: result.createdAt,
      status: result.status,
      type: result.type,
      payload: parseChannelPayload(result.payload),
      deletedAt: result.deletedAt,
      responseChannel: result.responseChannel?.id
        ? Channel.instance({
            id: result.responseChannel.id,
            name: result.responseChannel.name,
            createdAt: result.responseChannel.createdAt,
            status: result.responseChannel.status,
            type: result.responseChannel.type,
            payload: parseChannelPayload(result.responseChannel.payload),
            responseChannel: null,
            deletedAt: result.responseChannel.deletedAt,
          })
        : null,
    });
  }

  async remove(id: string, workspaceId: string) {
    const db = createDatabaseConnection();
    await db
      .update(channels)
      .set({ deletedAt: new Date(), status: "disconnected" })
      .where(and(eq(channels.id, id), eq(channels.workspaceId, workspaceId)));
  }

  async retrieveWithWorkspaceId(
    id: string
  ): Promise<{ channel: Channel; workspaceId: string } | null> {
    if (!id) return null;
    const db = createDatabaseConnection();
    const resp = alias(channels, "resp");

    const [result] = await db
      .select({
        id: channels.id,
        name: channels.name,
        createdAt: channels.createdAt,
        status: channels.status,
        type: channels.type,
        payload: channels.payload,
        deletedAt: channels.deletedAt,
        workspaceId: channels.workspaceId,
        responseChannel: {
          id: resp.id,
          name: resp.name,
          createdAt: resp.createdAt,
          status: resp.status,
          type: resp.type,
          payload: resp.payload,
          deletedAt: resp.deletedAt,
        },
      })
      .from(channels)
      .leftJoin(responseChannels, eq(responseChannels.receivedId, channels.id))
      .leftJoin(resp, eq(responseChannels.responseId, resp.id))
      .where(eq(channels.id, id));

    if (!result) return null;

    return {
      channel: Channel.instance({
        id: result.id,
        name: result.name,
        createdAt: result.createdAt,
        status: result.status,
        type: result.type,
        payload: parseChannelPayload(result.payload),
        deletedAt: result.deletedAt,
        responseChannel: result.responseChannel?.id
          ? Channel.instance({
              id: result.responseChannel.id,
              name: result.responseChannel.name,
              createdAt: result.responseChannel.createdAt,
              status: result.responseChannel.status,
              type: result.responseChannel.type,
              payload: parseChannelPayload(result.responseChannel.payload),
              responseChannel: null,
              deletedAt: result.responseChannel.deletedAt,
            })
          : null,
      }),
      workspaceId: result.workspaceId,
    };
  }

  async retrieveByTypeAndPayload(
    type: Channel.Type,
    payload: Partial<ChannelPayload>
  ): Promise<{ channel: Channel; workspaceId: string } | null> {
    const db = createDatabaseConnection();
    const resp = alias(channels, "resp");

    const [result] = await db
      .select({
        id: channels.id,
        name: channels.name,
        createdAt: channels.createdAt,
        status: channels.status,
        type: channels.type,
        payload: channels.payload,
        deletedAt: channels.deletedAt,
        workspaceId: channels.workspaceId,
        responseChannel: {
          id: resp.id,
          name: resp.name,
          createdAt: resp.createdAt,
          status: resp.status,
          type: resp.type,
          payload: resp.payload,
          deletedAt: resp.deletedAt,
        },
      })
      .from(channels)
      .leftJoin(responseChannels, eq(responseChannels.receivedId, channels.id))
      .leftJoin(resp, eq(responseChannels.responseId, resp.id))
      .where(
        and(
          eq(channels.type, type),
          sql`${channels.payload} @> ${JSON.stringify(payload)}::jsonb`,
          notDeleted
        )
      );

    if (!result) {
      return null;
    }

    return {
      channel: Channel.instance({
        id: result.id,
        name: result.name,
        createdAt: result.createdAt,
        status: result.status,
        type: result.type,
        payload: parseChannelPayload(result.payload),
        deletedAt: result.deletedAt,
        responseChannel: result.responseChannel?.id
          ? Channel.instance({
              id: result.responseChannel.id,
              name: result.responseChannel.name,
              createdAt: result.responseChannel.createdAt,
              status: result.responseChannel.status,
              type: result.responseChannel.type,
              payload: parseChannelPayload(result.responseChannel.payload),
              responseChannel: null,
              deletedAt: result.responseChannel.deletedAt,
            })
          : null,
      }),
      workspaceId: result.workspaceId,
    };
  }

  async retrieveByPayloadField(
    fieldName: string,
    fieldValue: string
  ): Promise<{ channel: Channel; workspaceId: string } | null> {
    const db = createDatabaseConnection();
    const resp = alias(channels, "resp");

    const [result] = await db
      .select({
        id: channels.id,
        name: channels.name,
        createdAt: channels.createdAt,
        status: channels.status,
        type: channels.type,
        payload: channels.payload,
        deletedAt: channels.deletedAt,
        workspaceId: channels.workspaceId,
        responseChannel: {
          id: resp.id,
          name: resp.name,
          createdAt: resp.createdAt,
          status: resp.status,
          type: resp.type,
          payload: resp.payload,
          deletedAt: resp.deletedAt,
        },
      })
      .from(channels)
      .leftJoin(responseChannels, eq(responseChannels.receivedId, channels.id))
      .leftJoin(resp, eq(responseChannels.responseId, resp.id))
      .where(
        and(
          sql`${channels.payload}->>${fieldName} = ${fieldValue}`,
          notDeleted
        )
      );

    if (!result) {
      return null;
    }

    return {
      channel: Channel.instance({
        id: result.id,
        name: result.name,
        createdAt: result.createdAt,
        status: result.status,
        type: result.type,
        payload: parseChannelPayload(result.payload),
        deletedAt: result.deletedAt,
        responseChannel: result.responseChannel?.id
          ? Channel.instance({
              id: result.responseChannel.id,
              name: result.responseChannel.name,
              createdAt: result.responseChannel.createdAt,
              status: result.responseChannel.status,
              type: result.responseChannel.type,
              payload: parseChannelPayload(result.responseChannel.payload),
              responseChannel: null,
              deletedAt: result.responseChannel.deletedAt,
            })
          : null,
      }),
      workspaceId: result.workspaceId,
    };
  }

  async isInternalChannelPhone(
    phoneNumber: string,
    workspaceId: string
  ): Promise<boolean> {
    const db = createDatabaseConnection();
    const normalizedPhone = phoneNumber.replace(/\D/g, "");

    const [result] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.workspaceId, workspaceId),
          sql`${channels.payload}->>'phoneNumber' LIKE '%' || ${normalizedPhone} || '%'`,
          notDeleted
        )
      )
      .limit(1);

    return !!result;
  }

  static instance() {
    return new ChannelsDatabaseRepository();
  }
}
