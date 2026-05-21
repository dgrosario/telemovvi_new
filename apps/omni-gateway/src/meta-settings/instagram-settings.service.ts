import { Injectable, Logger } from "@nestjs/common";
import { MetaSettingsRepository } from "./meta-settings.repository";
import {
  InstagramSaveSettingsPayload,
  InstagramGetSettingsPayload,
  InstagramGetEmbeddedLoginConfigPayload,
  InstagramExchangeCodePayload,
} from "./interfaces/instagram-settings.interface";
import { MetaSettingsService } from "./meta-settings.service";
import { MetaAppSetting } from "./interfaces/meta-settings.interface";

@Injectable()
export class InstagramSettingsService {
  private readonly logger = new Logger(InstagramSettingsService.name);

  constructor(
    private readonly metaSettingsRepository: MetaSettingsRepository,
    private readonly metaSettingsService: MetaSettingsService
  ) {}

  async saveSettings(payload: InstagramSaveSettingsPayload): Promise<MetaAppSetting> {
    this.logger.log("Saving Instagram settings");
    
    // Garantir que o payload tenha o formato correto
    const processedPayload = {
      ...payload,
      configId: payload.configId || "",
    };
    
    return this.metaSettingsRepository.save(processedPayload);
  }

  async getSettings(payload: InstagramGetSettingsPayload, includeSecret: boolean = false) {
    return this.metaSettingsService.getSettings(payload.channelType, includeSecret);
  }

  async getSettingsWithSecret(payload: InstagramGetSettingsPayload): Promise<MetaAppSetting | null> {
    return this.metaSettingsService.getSettings(payload.channelType, true) as Promise<MetaAppSetting | null>;
  }

  async getEmbeddedLoginConfig(payload: InstagramGetEmbeddedLoginConfigPayload) {
    return this.metaSettingsService.getEmbeddedLoginConfig(payload.channelType);
  }

  async exchangeCodeForToken(payload: InstagramExchangeCodePayload) {
    return this.metaSettingsService.exchangeCodeForToken(payload.channelType, payload.code);
  }

  async setActive(channelType: "instagram", isActive: boolean): Promise<void> {
    return this.metaSettingsService.setActive(channelType, isActive);
  }
}