import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { MetaSettingsService } from "./meta-settings.service";

interface SaveMetaSettingsDto {
  channelType: "whatsapp" | "instagram" | "messenger";
  appId: string;
  appSecret: string;
  configId?: string;
}

interface SetActiveDto {
  isActive: boolean;
}

@Controller("api/meta-settings")
export class MetaSettingsController {
  private readonly logger = new Logger(MetaSettingsController.name);

  constructor(private readonly metaSettingsService: MetaSettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllSettings() {
    this.logger.log("GET /api/meta-settings - Fetching all Meta settings");
    try {
      const settings = await this.metaSettingsService.getAllSettings();
      return { success: true, data: settings };
    } catch (error) {
      this.logger.error("Failed to get all Meta settings", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Get(":channelType")
  @HttpCode(HttpStatus.OK)
  async getSettings(
    @Param("channelType") channelType: string,
    @Query("includeSecret") includeSecret?: string
  ) {
    this.logger.log(
      `GET /api/meta-settings/${channelType} - Fetching Meta settings (includeSecret=${includeSecret})`
    );
    try {
      const settings = await this.metaSettingsService.getSettings(
        channelType as "whatsapp" | "instagram" | "messenger",
        includeSecret === "true"
      );
      return { success: true, data: settings };
    } catch (error) {
      this.logger.error(`Failed to get Meta settings for ${channelType}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async saveSettings(@Body() dto: SaveMetaSettingsDto) {
    this.logger.log(
      `POST /api/meta-settings - Saving Meta settings for ${dto.channelType}`
    );
    try {
      const settings = await this.metaSettingsService.saveSettings(dto);
      return { success: true, data: settings };
    } catch (error) {
      this.logger.error(
        `Failed to save Meta settings for ${dto.channelType}`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Put(":channelType/active")
  @HttpCode(HttpStatus.OK)
  async setActive(
    @Param("channelType") channelType: string,
    @Body() dto: SetActiveDto
  ) {
    this.logger.log(
      `PUT /api/meta-settings/${channelType}/active - Setting active=${dto.isActive}`
    );
    try {
      await this.metaSettingsService.setActive(
        channelType as "whatsapp" | "instagram" | "messenger",
        dto.isActive
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to set active for ${channelType}`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
