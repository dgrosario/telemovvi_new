import { Module, Global } from "@nestjs/common";
import { MetaSettingsService } from "./meta-settings.service";
import { InstagramSettingsService } from "./instagram-settings.service";
import { MetaSettingsRepository } from "./meta-settings.repository";
import { MetaSettingsController } from "./meta-settings.controller";

@Global()
@Module({
  controllers: [MetaSettingsController],
  providers: [
    MetaSettingsService,
    InstagramSettingsService,
    MetaSettingsRepository,
  ],
  exports: [MetaSettingsService, InstagramSettingsService, MetaSettingsRepository],
})
export class MetaSettingsModule {}
