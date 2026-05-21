import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { createHmac } from "crypto";
import { Request } from "express";
import { InstagramSettingsService } from "../../meta-settings/instagram-settings.service";

@Injectable()
export class InstagramSignatureGuard implements CanActivate {
  private readonly logger = new Logger(InstagramSignatureGuard.name);

  constructor(
    private readonly instagramSettingsService: InstagramSettingsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // GET requests are for webhook verification
    if (request.method === "GET") {
      return true;
    }

    const signature = request.headers["x-hub-signature-256"] as string;

    if (!signature) {
      this.logger.warn("Missing X-Hub-Signature-256 header for Instagram webhook");
      throw new ForbiddenException("Missing signature header");
    }

    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      this.logger.warn("Raw body not available for Instagram signature validation");
      throw new ForbiddenException("Cannot validate signature");
    }

    // Get Instagram app secret from settings
    const settings = await this.instagramSettingsService.getSettingsWithSecret({
      channelType: "instagram",
    });

    if (!settings || !settings.appSecret) {
      if (process.env.NODE_ENV === "production") {
        this.logger.error(
          "CRITICAL: No Instagram App Secret available - webhook rejected"
        );
        throw new ForbiddenException("Instagram signature validation not configured");
      }
      this.logger.warn(
        "Instagram App Secret not configured - signature validation bypassed (development only)"
      );
      return true;
    }

    const expectedSignature =
      "sha256=" +
      createHmac("sha256", settings.appSecret).update(rawBody).digest("hex");

    const isValid = this.secureCompare(signature, expectedSignature);

    if (!isValid) {
      this.logger.warn(
        `Invalid Instagram webhook signature - appSecret prefix: ${settings.appSecret.substring(0, 8)}`
      );
      throw new ForbiddenException("Invalid signature");
    }

    this.logger.debug("Instagram webhook signature verified successfully");
    return true;
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
