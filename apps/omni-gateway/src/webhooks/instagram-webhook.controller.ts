import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InstagramWebhookService } from "./instagram-webhook.service";
import { InstagramSignatureGuard } from "./guards/instagram-signature.guard";
import { InstagramWebhookPayload } from "../transformers/instagram.transformer";

@Controller("webhooks/instagram")
@UseGuards(InstagramSignatureGuard)
export class InstagramWebhookController {
  private readonly logger = new Logger(InstagramWebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly instagramWebhookService: InstagramWebhookService,
    private readonly configService: ConfigService
  ) {
    this.verifyToken =
      this.configService.get<string>("meta.webhookVerifyToken") || "";
  }

  @Get()
  async verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string
  ): Promise<string> {
    this.logger.log(`Instagram webhook verification: mode=${mode}`);

    if (mode !== "subscribe") {
      this.logger.warn("Instagram webhook verification failed - invalid mode");
      throw new ForbiddenException("Verification failed");
    }

    if (token !== this.verifyToken) {
      this.logger.warn("Instagram webhook verification failed - token mismatch");
      throw new ForbiddenException("Verification failed");
    }

    this.logger.log("Instagram webhook verified successfully");
    return challenge;
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: InstagramWebhookPayload): Promise<string> {
    this.logger.log(`Received Instagram webhook: object=${payload.object}`);

    try {
      if (payload.object === "instagram") {
        await this.instagramWebhookService.handleWebhook(payload);
      } else {
        this.logger.warn(`Unknown Instagram webhook object type: ${payload.object}`);
      }
    } catch (error) {
      this.logger.error("Error processing Instagram webhook:", error);
    }

    return "EVENT_RECEIVED";
  }
}
