import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../database/redis.service";
import {
  MetaAppSetting,
  MetaChannelType,
  SaveMetaSettingsPayload,
  SaveMetaSettingsPayloadWithOptionalConfigId,
} from "./interfaces/meta-settings.interface";
import {
  InstagramSaveSettingsPayload,
} from "./interfaces/instagram-settings.interface";
import { randomUUID } from "crypto";

@Injectable()
export class MetaSettingsRepository {
  private readonly logger = new Logger(MetaSettingsRepository.name);
  private readonly keyPrefix = "meta:settings:";

  constructor(private readonly redisService: RedisService) {}

  async findByChannelType(
    channelType: MetaChannelType
  ): Promise<MetaAppSetting | null> {
    const data = await this.redisService
      .getClient()
      .hgetall(`${this.keyPrefix}${channelType}`);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async findAll(): Promise<MetaAppSetting[]> {
    const client = this.redisService.getClient();
    const keys = await client.keys(`${this.keyPrefix}*`);

    if (keys.length === 0) {
      return [];
    }

    const results: MetaAppSetting[] = [];
    for (const key of keys) {
      const data = await client.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        results.push(this.mapToEntity(data));
      }
    }

    return results;
  }

  async findAllActive(): Promise<MetaAppSetting[]> {
    const all = await this.findAll();
    return all.filter((setting) => setting.isActive);
  }

  async save(payload: SaveMetaSettingsPayload | SaveMetaSettingsPayloadWithOptionalConfigId | InstagramSaveSettingsPayload): Promise<MetaAppSetting> {
    const client = this.redisService.getClient();
    const key = `${this.keyPrefix}${payload.channelType}`;

    const existing = await client.hgetall(key);
    const now = new Date().toISOString();

    const data = {
      id: existing?.id || randomUUID(),
      channelType: payload.channelType,
      appId: payload.appId,
      appSecret: payload.appSecret,
      configId: payload.configId || "",
      isActive: existing?.isActive || "true",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await client.hset(key, data);

    return this.mapToEntity(data);
  }

  async setActive(
    channelType: MetaChannelType,
    isActive: boolean
  ): Promise<void> {
    const client = this.redisService.getClient();
    const key = `${this.keyPrefix}${channelType}`;

    const exists = await client.exists(key);
    if (!exists) {
      this.logger.warn(`Meta settings not found for channel type: ${channelType}`);
      return;
    }

    await client.hset(key, {
      isActive: String(isActive),
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(channelType: MetaChannelType): Promise<void> {
    await this.redisService.getClient().del(`${this.keyPrefix}${channelType}`);
  }

  private mapToEntity(data: Record<string, string>): MetaAppSetting {
    return {
      id: data.id,
      channelType: data.channelType as MetaChannelType,
      appId: data.appId,
      appSecret: data.appSecret,
      configId: data.configId,
      isActive: data.isActive === "true",
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }
}
