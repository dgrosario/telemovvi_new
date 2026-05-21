"use server";

import {
  and,
  createDatabaseConnection,
  eq,
  isNull,
} from "@omnichannel/core/infra/database";
import {
  channels,
  channelsInSector,
  sectors,
  usersInSector,
} from "@omnichannel/core/infra/database/schemas";

const CACHE_TTL_MS = 15_000;
const CACHE_MAX_ENTRIES = 500;

type CacheEntry<T> = {
  fetchedAt: number;
  value: T;
};

const sectorIdsCache = new Map<string, CacheEntry<string[]>>();
const channelIdsCache = new Map<string, CacheEntry<string[]>>();

function makeKey(userId: string, workspaceId: string): string {
  return `${workspaceId}:${userId}`;
}

function getFromCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  if (cache.size > CACHE_MAX_ENTRIES) {
    cache.clear();
  }

  cache.set(key, { fetchedAt: Date.now(), value });
}

export async function getAllowedSectorIdsForUser(
  userId: string,
  workspaceId: string
): Promise<string[]> {
  const cacheKey = makeKey(userId, workspaceId);
  const cached = getFromCache(sectorIdsCache, cacheKey);
  if (cached) return cached;

  const db = createDatabaseConnection();

  const rows = await db
    .select({ sectorId: usersInSector.sectorId })
    .from(usersInSector)
    .innerJoin(sectors, eq(sectors.id, usersInSector.sectorId))
    .where(
      and(
        eq(usersInSector.userId, userId),
        eq(sectors.workspaceId, workspaceId),
        eq(sectors.removed, false)
      )
    );

  const sectorIds = rows
    .map((row) => row.sectorId)
    .filter((id): id is string => !!id);

  setCache(sectorIdsCache, cacheKey, sectorIds);
  return sectorIds;
}

export async function getAllowedChannelIdsForUser(
  userId: string,
  workspaceId: string
): Promise<string[]> {
  const cacheKey = makeKey(userId, workspaceId);
  const cached = getFromCache(channelIdsCache, cacheKey);
  if (cached) return cached;

  const db = createDatabaseConnection();

  const rows = await db
    .select({ channelId: channelsInSector.channelId })
    .from(channelsInSector)
    .innerJoin(usersInSector, eq(usersInSector.sectorId, channelsInSector.sectorId))
    .innerJoin(sectors, eq(sectors.id, usersInSector.sectorId))
    .innerJoin(channels, eq(channels.id, channelsInSector.channelId))
    .where(
      and(
        eq(usersInSector.userId, userId),
        eq(sectors.workspaceId, workspaceId),
        eq(channels.workspaceId, workspaceId),
        isNull(channels.deletedAt)
      )
    );

  const channelIds = Array.from(
    new Set(
      rows
        .map((row) => row.channelId)
        .filter((id): id is string => !!id)
    )
  );

  setCache(channelIdsCache, cacheKey, channelIds);
  return channelIds;
}

