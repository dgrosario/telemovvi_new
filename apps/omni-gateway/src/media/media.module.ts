import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MediaPublicController } from "./media-public.controller";
import { MediaService } from "./media.service";
import { MediaStorageService } from "./media-storage.service";
import { MediaDownloadService } from "./media-download.service";
import { MediaCleanupService } from "./media-cleanup.service";
import { ChannelApisModule } from "../channel-apis/channel-apis.module";

@Module({
  imports: [ChannelApisModule],
  controllers: [MediaController, MediaPublicController],
  providers: [
    MediaService,
    MediaStorageService,
    MediaDownloadService,
    MediaCleanupService,
  ],
  exports: [MediaDownloadService, MediaStorageService],
})
export class MediaModule {}
