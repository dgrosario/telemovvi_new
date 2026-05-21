import { Injectable, Logger } from "@nestjs/common";

export interface GroupMetadata {
  groupJid: string;
  groupName: string;
  participants: string[];
}

interface CacheEntry {
  metadata: GroupMetadata;
  expiresAt: number;
}

@Injectable()
export class GroupMetadataCacheService {
  private readonly logger = new Logger(GroupMetadataCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  async getGroupMetadata(
    instanceName: string,
    groupJid: string,
    fetchFromApi: () => Promise<GroupMetadata | null>
  ): Promise<GroupMetadata | null> {
    const cacheKey = this.buildCacheKey(instanceName, groupJid);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Cache hit for group: ${groupJid}`);
      return cached.metadata;
    }

    if (cached) {
      this.logger.debug(`Cache expired for group: ${groupJid}`);
      this.cache.delete(cacheKey);
    }

    const metadata = await fetchFromApi();

    if (metadata) {
      this.cache.set(cacheKey, {
        metadata,
        expiresAt: Date.now() + this.TTL_MS,
      });
      this.logger.debug(`Cache populated for group: ${groupJid}`);
      return metadata;
    }

    return null;
  }

  set(instanceName: string, metadata: GroupMetadata): void {
    const cacheKey = this.buildCacheKey(instanceName, metadata.groupJid);
    this.cache.set(cacheKey, {
      metadata,
      expiresAt: Date.now() + this.TTL_MS,
    });
    this.logger.debug(`Cache set for group: ${metadata.groupJid}`);
  }

  invalidate(instanceName: string, groupJid: string): void {
    const cacheKey = this.buildCacheKey(instanceName, groupJid);
    const deleted = this.cache.delete(cacheKey);
    if (deleted) {
      this.logger.debug(`Cache invalidated for group: ${groupJid}`);
    }
  }

  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug(`Group metadata cache cleared - ${size} entries removed`);
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  private buildCacheKey(instanceName: string, groupJid: string): string {
    return `${instanceName}:${groupJid}`;
  }
}
