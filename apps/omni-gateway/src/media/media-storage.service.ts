import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";

@Injectable()
export class MediaStorageService implements OnModuleInit {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath =
      this.configService.get<string>("media.storagePath") ?? "/data/media";
  }

  async onModuleInit(): Promise<void> {
    await this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      this.logger.log(`Media storage directory ready: ${this.storagePath}`);
    } catch (error) {
      this.logger.error(
        `Failed to create storage directory: ${this.storagePath}`,
        error,
      );
    }
  }

  async save(
    messageId: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    if (!this.validateBuffer(buffer, mimetype)) {
      this.logger.warn(
        `[MediaStorage] Buffer validation failed for ${messageId}: expected ${mimetype}, got ${buffer.length} bytes (magic: ${buffer.subarray(0, 4).toString("hex")})`,
      );
      throw new Error(
        `Invalid media content for ${messageId}: buffer does not match expected mimetype ${mimetype}`,
      );
    }

    const ext = this.getExtensionFromMimetype(mimetype);
    const filename = `${messageId}.${ext}`;
    const filepath = path.join(this.storagePath, filename);

    try {
      await fs.writeFile(filepath, buffer);
      this.logger.debug(`Media saved: ${filepath} (${buffer.length} bytes)`);
      return filepath;
    } catch (error) {
      this.logger.error(`Failed to save media: ${filepath}`, error);
      throw error;
    }
  }

  validateBuffer(buffer: Buffer, mimetype: string): boolean {
    if (mimetype.startsWith("image/") && buffer.length < 100) {
      return false;
    }

    const checks: Record<string, (buf: Buffer) => boolean> = {
      "image/jpeg": (buf) =>
        buf.length >= 3 &&
        buf[0] === 0xff &&
        buf[1] === 0xd8 &&
        buf[2] === 0xff,
      "image/png": (buf) =>
        buf.length >= 4 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47,
      "image/gif": (buf) =>
        buf.length >= 3 &&
        buf[0] === 0x47 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46,
      "image/webp": (buf) =>
        buf.length >= 12 &&
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50,
      "application/pdf": (buf) =>
        buf.length >= 4 &&
        buf[0] === 0x25 &&
        buf[1] === 0x50 &&
        buf[2] === 0x44 &&
        buf[3] === 0x46,
      "video/mp4": (buf) =>
        buf.length >= 8 &&
        buf[4] === 0x66 &&
        buf[5] === 0x74 &&
        buf[6] === 0x79 &&
        buf[7] === 0x70,
      "audio/ogg": (buf) =>
        buf.length >= 4 &&
        buf[0] === 0x4f &&
        buf[1] === 0x67 &&
        buf[2] === 0x67 &&
        buf[3] === 0x53,
    };

    const check = checks[mimetype];
    if (!check) {
      return true;
    }

    return check(buffer);
  }

  async exists(messageId: string): Promise<string | null> {
    const extensions = [
      "ogg",
      "mp3",
      "opus",
      "m4a",
      "wav",
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "mp4",
      "webm",
      "mov",
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "zip",
      "bin",
    ];

    for (const ext of extensions) {
      const filepath = path.join(this.storagePath, `${messageId}.${ext}`);
      try {
        await fs.access(filepath);
        return filepath;
      } catch {
        continue;
      }
    }

    return null;
  }

  async read(filepath: string): Promise<Buffer> {
    const resolvedPath = path.resolve(filepath);
    const resolvedStorage = path.resolve(this.storagePath);

    if (!resolvedPath.startsWith(resolvedStorage + path.sep)) {
      this.logger.warn(`Path traversal attempt blocked: ${filepath}`);
      throw new Error("Invalid file path");
    }

    const buffer = await fs.readFile(resolvedPath);
    const mime = this.getMimetypeFromPath(filepath);

    if (
      mime !== "application/octet-stream" &&
      !this.validateBuffer(buffer, mime)
    ) {
      this.logger.warn(
        `Corrupted file detected: ${filepath} (magic: ${buffer.subarray(0, 4).toString("hex")})`,
      );
      await this.deleteIfExists(resolvedPath);
      throw new Error(`Corrupted media file: ${filepath}`);
    }

    return buffer;
  }

  async delete(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
      this.logger.debug(`Media deleted: ${filepath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete media: ${filepath}`, error);
    }
  }

  async deleteIfExists(filepath: string): Promise<boolean> {
    if (!filepath) return false;

    try {
      await fs.unlink(filepath);
      this.logger.debug(`Media deleted: ${filepath}`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      this.logger.warn(`Failed to delete media: ${filepath}`, error);
      return false;
    }
  }

  async deleteFilesOlderThan(hours: number): Promise<string[]> {
    const maxAgeMs = hours * 60 * 60 * 1000;
    const now = Date.now();
    const deletedMessageIds: string[] = [];

    try {
      const files = await fs.readdir(this.storagePath);

      for (const file of files) {
        const filepath = path.join(this.storagePath, file);

        try {
          const stats = await fs.stat(filepath);

          if (!stats.isFile()) continue;

          const ageMs = now - stats.mtimeMs;
          if (ageMs > maxAgeMs) {
            await fs.unlink(filepath);
            deletedMessageIds.push(path.parse(file).name);
            this.logger.debug(
              `Deleted old media file: ${file} (age: ${Math.round(ageMs / 3600000)}h)`,
            );
          }
        } catch (fileError) {
          this.logger.warn(
            `Failed to process file ${file} during cleanup:`,
            fileError,
          );
        }
      }

      if (deletedMessageIds.length > 0) {
        this.logger.log(
          `Media cleanup completed: ${deletedMessageIds.length} files deleted`,
        );
      }
    } catch (error) {
      this.logger.error("Failed to cleanup old media files:", error);
    }

    return deletedMessageIds;
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  getMimetypeFromPath(filepath: string): string {
    const ext = path.extname(filepath).toLowerCase().replace(".", "");
    return this.getMimetypeFromExtension(ext);
  }

  private getExtensionFromMimetype(mimetype: string): string {
    const mimeToExt: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/ogg; codecs=opus": "ogg",
      "audio/opus": "opus",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/wav": "wav",
      "audio/webm": "webm",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "application/zip": "zip",
    };

    return mimeToExt[mimetype] ?? "bin";
  }

  private getMimetypeFromExtension(ext: string): string {
    const extToMime: Record<string, string> = {
      ogg: "audio/ogg",
      opus: "audio/opus",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip",
    };

    return extToMime[ext] ?? "application/octet-stream";
  }
}
