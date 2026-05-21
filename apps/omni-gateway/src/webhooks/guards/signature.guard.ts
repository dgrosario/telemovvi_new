import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { Request } from "express";
import { ChannelsRepository } from "../../database/channels.repository";
import { ChannelSecretsCacheService } from "../../cache/channel-secrets-cache.service";

@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);
  private readonly globalAppSecret: string;

  constructor(
    private configService: ConfigService,
    private channelsRepository: ChannelsRepository,
    private channelSecretsCache: ChannelSecretsCacheService
  ) {
    this.globalAppSecret =
      this.configService.get<string>("meta.appSecret") || "";
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.method === "GET") {
      return true;
    }

    const signature = request.headers["x-hub-signature-256"] as string;

    if (!signature) {
      this.logger.warn("Missing X-Hub-Signature-256 header");
      throw new ForbiddenException("Missing signature header");
    }

    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      this.logger.warn("Raw body not available for signature validation");
      throw new ForbiddenException("Cannot validate signature");
    }

    const requestId = Math.random().toString(36).substring(7);
    const rawBodyHash = createHmac("sha256", "diag").update(rawBody).digest("hex").substring(0, 16);
    const bodyHash = createHmac("sha256", "diag").update(JSON.stringify(request.body)).digest("hex").substring(0, 16);
    const contentEncoding = request.headers["content-encoding"] || "none";
    const rawBodyFirst10 = rawBody.slice(0, 10).toString("hex");

    const relevantHeaders = {
      "content-encoding": contentEncoding,
      "content-type": request.headers["content-type"],
      "content-length": request.headers["content-length"],
      "transfer-encoding": request.headers["transfer-encoding"],
      "x-forwarded-for": request.headers["x-forwarded-for"],
    };
    this.logger.warn(`[DIAG:${requestId}] headers: ${JSON.stringify(relevantHeaders)}`);
    this.logger.warn(`[DIAG:${requestId}] rawBody.length: ${rawBody.length}, first10hex: ${rawBodyFirst10}`);
    this.logger.warn(`[DIAG:${requestId}] rawBody hash: ${rawBodyHash}, body hash: ${bodyHash}`);

    const phoneId = this.extractPhoneIdFromPayload(request.body);
    this.logger.warn(`[DIAG:${requestId}] Extracted phoneId from webhook: ${phoneId}`);

    const appSecret = await this.resolveAppSecret(request.body);

    if (!appSecret) {
      if (process.env.NODE_ENV === "production") {
        this.logger.error(
          "CRITICAL: No App Secret available for validation - webhook rejected"
        );
        throw new ForbiddenException("Signature validation not configured");
      }
      this.logger.warn(
        "App Secret not configured - signature validation bypassed (development only)"
      );
      return true;
    }

    this.logger.warn(
      `[DIAG:${requestId}] Using appSecret starting with: ${appSecret.substring(0, 8)}... (length: ${appSecret.length})`
    );

    const expectedSignature =
      "sha256=" +
      createHmac("sha256", appSecret).update(rawBody).digest("hex");

    this.logger.warn(`[DIAG:${requestId}] Received signature: ${signature.substring(0, 30)}...`);
    this.logger.warn(`[DIAG:${requestId}] Expected signature: ${expectedSignature.substring(0, 30)}...`);
    this.logger.warn(`[DIAG:${requestId}] Match: ${signature === expectedSignature}`);

    const isValid = this.secureCompare(signature, expectedSignature);

    if (!isValid) {
      this.logger.warn(
        `[DIAG:${requestId}] INVALID - phoneId: ${phoneId}, appSecret prefix: ${appSecret.substring(0, 8)}`
      );
      throw new ForbiddenException("Invalid signature");
    }

    this.logger.warn(`[DIAG:${requestId}] VALID - signature verified successfully`);

    return true;
  }

  private async resolveAppSecret(body: unknown): Promise<string | null> {
    const phoneId = this.extractPhoneIdFromPayload(body);

    if (phoneId) {
      const cached = await this.channelSecretsCache.getAppSecret(phoneId, () =>
        this.channelsRepository.findByPhoneIdWithSecret(phoneId)
      );

      this.logger.debug(
        `resolveAppSecret for phoneId ${phoneId}: cached=${JSON.stringify(cached)}`
      );

      // Accept appSecret from both meta_api and whatsapp channel types
      if (cached?.appSecret && (cached.channelType === "meta_api" || cached.channelType === "whatsapp")) {
        this.logger.debug(
          `Using channel-specific appSecret for phoneId: ${phoneId} (type: ${cached.channelType})`
        );
        return cached.appSecret;
      }
    }

    this.logger.debug(`Falling back to global appSecret for phoneId: ${phoneId}`);
    return this.globalAppSecret || null;
  }

  private extractPhoneIdFromPayload(body: unknown): string | null {
    try {
      const payload = body as {
        object?: string;
        entry?: Array<{
          changes?: Array<{
            value?: {
              metadata?: {
                phone_number_id?: string;
              };
            };
          }>;
        }>;
      };

      if (payload?.object === "whatsapp_business_account") {
        return (
          payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ||
          null
        );
      }
    } catch {
      return null;
    }
    return null;
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
