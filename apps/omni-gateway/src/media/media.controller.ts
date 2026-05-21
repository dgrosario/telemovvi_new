import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  HttpStatus,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { MediaService } from "./media.service";
import { MediaDownloadService } from "./media-download.service";
import { ApiKeyGuard } from "./guards/api-key.guard";

@Controller("media")
@UseGuards(ApiKeyGuard)
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly mediaDownloadService: MediaDownloadService
  ) {}

  @Get(":messageId")
  async downloadMedia(
    @Param("messageId") messageId: string,
    @Query("channelId") channelId: string,
    @Query("force") force: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    if (!channelId) {
      throw new BadRequestException("channelId query parameter is required");
    }

    this.logger.log(
      `[media:${messageId}] Request received (channelId=${channelId}${force === "true" ? ", force=true" : ""})`
    );

    const result = await this.mediaService.downloadMedia(messageId, channelId, force === "true");

    if (!result.success || !result.content) {
      this.logger.warn(
        `[media:${messageId}] Download failed: ${result.error ?? "no content"}`
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: result.error ?? "Failed to download media",
        messageId,
      });
      return;
    }

    res.set({
      "Content-Type": result.mime ?? "application/octet-stream",
      "Content-Length": result.content.length,
      "Content-Disposition": `inline; filename="${result.filename ?? "media"}"`,
      "Cache-Control": "private, max-age=3600",
    });

    res.end(result.content);
  }

  @Get("queue/status")
  async getQueueStatus(): Promise<{
    queueSize: number;
    failedCount: number;
  }> {
    const [queueSize, failedCount] = await Promise.all([
      this.mediaDownloadService.getQueueSize(),
      this.mediaDownloadService.getFailedCount(),
    ]);

    return { queueSize, failedCount };
  }

  @Post("queue/recover")
  async recoverMedia(
    @Query("limit") limitParam?: string
  ): Promise<{
    found: number;
    enqueued: number;
    skipped: number;
  }> {
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    return this.mediaDownloadService.recoverExistingMedia(limit);
  }

  @Post("queue/retry-failed")
  async retryFailed(): Promise<{ retriedCount: number }> {
    const retriedCount = await this.mediaDownloadService.retryFailed();
    return { retriedCount };
  }
}
