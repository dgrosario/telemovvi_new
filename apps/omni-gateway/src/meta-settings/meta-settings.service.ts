import { Injectable, Logger } from "@nestjs/common";
import { MetaSettingsRepository } from "./meta-settings.repository";
import {
  MetaAppSetting,
  MetaAppSettingPublic,
  MetaChannelType,
  MetaEmbeddedLoginConfig,
  SaveMetaSettingsPayload,
  SaveMetaSettingsPayloadWithOptionalConfigId,
} from "./interfaces/meta-settings.interface";
import {
  InstagramSaveSettingsPayload,
} from "./interfaces/instagram-settings.interface";

@Injectable()
export class MetaSettingsService {
  private readonly logger = new Logger(MetaSettingsService.name);

  constructor(private readonly repository: MetaSettingsRepository) {}

  async getEmbeddedLoginConfig(
    channelType: MetaChannelType
  ): Promise<MetaEmbeddedLoginConfig | null> {
    const setting = await this.repository.findByChannelType(channelType);

    if (!setting || !setting.isActive) {
      this.logger.warn(
        `No active Meta settings found for channel type: ${channelType}`
      );
      return null;
    }

    // Para Instagram, mesmo com configId vazio, retornar a configuração
    if (channelType === 'instagram') {
      return {
        appId: setting.appId,
        configId: setting.configId,
        channelType: setting.channelType,
      };
    }

    return {
      appId: setting.appId,
      configId: setting.configId,
      channelType: setting.channelType,
    };
  }

  async saveSettings(payload: SaveMetaSettingsPayload | SaveMetaSettingsPayloadWithOptionalConfigId | InstagramSaveSettingsPayload): Promise<MetaAppSetting> {
    this.logger.log(`Saving Meta settings for channel type: ${payload.channelType}`);
    
    // Para Instagram, o configId pode ser vazio
    const processedPayload = {
      ...payload,
      configId: payload.configId || (payload.channelType === 'instagram' ? '' : payload.configId || ''),
    };
    
    return this.repository.save(processedPayload as SaveMetaSettingsPayload);
  }

  async getSettings(channelType: MetaChannelType, includeSecret: boolean = false): Promise<MetaAppSetting | MetaAppSettingPublic | null> {
    const setting = await this.repository.findByChannelType(channelType);
    
    if (!setting) {
      return null;
    }
    
    // Se não deve incluir o secret, retorna a versão pública
    if (!includeSecret) {
      return this.toPublic(setting);
    }
    
    // Caso contrário, retorna com o secret
    return setting;
  }

  async getAllSettings(): Promise<MetaAppSetting[]> {
    return this.repository.findAll();
  }

  async getAllSettingsPublic(): Promise<MetaAppSettingPublic[]> {
    const settings = await this.repository.findAll();
    return settings.map((setting) => this.toPublic(setting));
  }

  async setActive(channelType: MetaChannelType, isActive: boolean): Promise<void> {
    this.logger.log(
      `Setting Meta settings active=${isActive} for channel type: ${channelType}`
    );
    await this.repository.setActive(channelType, isActive);
  }

  async exchangeCodeForToken(
    channelType: MetaChannelType,
    code: string
  ): Promise<{ accessToken: string; expiresIn: number } | null> {
    const setting = await this.repository.findByChannelType(channelType);

    if (!setting) {
      this.logger.error(`No Meta settings found for channel type: ${channelType}`);
      return null;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
          `client_id=${setting.appId}&` +
          `client_secret=${setting.appSecret}&` +
          `code=${code}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          `Failed to exchange code for token: ${JSON.stringify(errorData)}`
        );
        return null;
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      this.logger.error(`Error exchanging code for token: ${error}`);
      return null;
    }
  }

  private toPublic(setting: MetaAppSetting): MetaAppSettingPublic {
    return {
      id: setting.id,
      channelType: setting.channelType,
      appId: setting.appId,
      configId: setting.configId,
      isActive: setting.isActive,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };
  }
}
