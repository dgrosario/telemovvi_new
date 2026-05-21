import {
  Controller,
  Get,
  Param,
  Res,
  HttpStatus,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import * as path from "node:path";
import { MediaStorageService } from "./media-storage.service";

const MEDIA_CACHE_TTL_SECONDS = 86400;

@Controller("media/public")
export class MediaPublicController {
  private readonly logger = new Logger(MediaPublicController.name);

  constructor(private readonly storageService: MediaStorageService) {}

  @Get(":fileId")
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async serveMedia(
    @Param("fileId") fileId: string,
    @Res() res: Response
  ): Promise<void> {
    const sanitizedId = fileId.replace(/[^a-zA-Z0-9-_.]/g, "");

    if (sanitizedId !== fileId) {
      this.logger.warn(`Invalid fileId attempted: ${fileId}`);
      throw new NotFoundException("Media not found");
    }

    try {
      const filepath = await this.storageService.exists(sanitizedId);

      if (!filepath) {
        this.logger.debug(`Media not found: ${sanitizedId}`);
        throw new NotFoundException("Media not found");
      }

      let buffer: Buffer;
      try {
        buffer = await this.storageService.read(filepath);
      } catch (readError) {
        if (this.isFileNotFoundError(readError)) {
          this.logger.debug(`Media deleted between exists and read: ${sanitizedId}`);
          throw new NotFoundException("Media not found");
        }
        throw readError;
      }

      const mimetype = this.storageService.getMimetypeFromPath(filepath);
      const filename = path.basename(filepath);

      res.set({
        "Content-Type": mimetype,
        "Content-Length": buffer.length,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": `public, max-age=${MEDIA_CACHE_TTL_SECONDS}`,
      });

      res.status(HttpStatus.OK).send(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Error serving media ${sanitizedId}:`, error);
      throw new InternalServerErrorException("Failed to serve media");
    }
  }

  private isFileNotFoundError(error: unknown): boolean {
    if (error instanceof Error && "code" in error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT";
    }
    return false;
  }
}
