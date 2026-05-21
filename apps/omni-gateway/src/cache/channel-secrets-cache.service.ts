import { Injectable, Logger } from "@nestjs/common";
import { ChannelWithSecret } from "../database/channels.repository";

interface CacheEntry {
  appSecret: string;
  channelType: string;
  verifyToken?: string;
  expiresAt: number;
}

@Injectable()
export class ChannelSecretsCacheService {
  private readonly logger = new Logger(ChannelSecretsCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getChannelSecrets(
    phoneId: string,
    fetchFromDb: () => Promise<ChannelWithSecret | null>
  ): Promise<{
    appSecret: string;
    channelType: string;
    verifyToken?: string;
  } | null> {
    const cached = this.cache.get(phoneId);

    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Cache hit for phoneId: ${phoneId}`);
      return {
        appSecret: cached.appSecret,
        channelType: cached.channelType,
        verifyToken: cached.verifyToken,
      };
    }

    if (cached) {
      this.logger.debug(`Cache expired for phoneId: ${phoneId}`);
      this.cache.delete(phoneId);
    }

    const channel = await fetchFromDb();

    if (channel?.appSecret) {
      this.cache.set(phoneId, {
        appSecret: channel.appSecret,
        channelType: channel.type,
        verifyToken: channel.verifyToken,
        expiresAt: Date.now() + this.TTL_MS,
      });
      this.logger.debug(`Cache populated for phoneId: ${phoneId}`);
      return {
        appSecret: channel.appSecret,
        channelType: channel.type,
        verifyToken: channel.verifyToken,
      };
    }

    return null;
  }

  async getAppSecret(
    phoneId: string,
    fetchFromDb: () => Promise<ChannelWithSecret | null>
  ): Promise<{ appSecret: string; channelType: string } | null> {
    const result = await this.getChannelSecrets(phoneId, fetchFromDb);
    return result
      ? { appSecret: result.appSecret, channelType: result.channelType }
      : null;
  }

  invalidate(phoneId: string): void {
    const deleted = this.cache.delete(phoneId);
    if (deleted) {
      this.logger.debug(`Cache invalidated for phoneId: ${phoneId}`);
    }
  }

  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug(`Cache cleared - ${size} entries removed`);
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
