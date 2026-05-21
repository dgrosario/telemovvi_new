import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MediaStorageService } from "./media-storage.service";
import { MessagesRepository } from "../database/messages.repository";

@Injectable()
export class MediaCleanupService implements OnModuleInit {
  private readonly logger = new Logger(MediaCleanupService.name);
  private readonly fileTtlHours: number;
  private readonly autoDeleteEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: MediaStorageService,
    private readonly messagesRepository: MessagesRepository
  ) {
    this.fileTtlHours =
      this.configService.get<number>("media.fileTtlHours") ?? 48;
    this.autoDeleteEnabled =
      this.configService.get<boolean>("media.autoDeleteEnabled") ?? false;
  }

  async onModuleInit(): Promise<void> {
    if (this.autoDeleteEnabled) {
      this.logger.log(
        `Media cleanup service initialized (TTL: ${this.fileTtlHours}h, auto-delete: enabled)`
      );
    } else {
      this.logger.log(
        `Media cleanup service initialized (auto-delete: DISABLED - permanent storage)`
      );
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCleanup(): Promise<void> {
    if (!this.autoDeleteEnabled) {
      this.logger.debug("Scheduled cleanup skipped (auto-delete disabled)");
      return;
    }

    this.logger.debug("Running scheduled media cleanup...");

    try {
      const count = await this.performCleanup();

      if (count > 0) {
        this.logger.log(
          `Scheduled cleanup: removed ${count} media files older than ${this.fileTtlHours}h`
        );
      }
    } catch (error) {
      this.logger.error("Scheduled media cleanup failed:", error);
    }
  }

  async cleanupNow(): Promise<number> {
    if (!this.autoDeleteEnabled) {
      this.logger.warn("Manual cleanup requested but auto-delete is disabled");
      return 0;
    }

    this.logger.debug("Running manual media cleanup...");
    return this.performCleanup();
  }

  private async performCleanup(): Promise<number> {
    const deletedMessageIds = await this.storageService.deleteFilesOlderThan(
      this.fileTtlHours
    );

    if (deletedMessageIds.length > 0) {
      await this.messagesRepository.clearMediaPaths(deletedMessageIds);
    }

    return deletedMessageIds.length;
  }
}
