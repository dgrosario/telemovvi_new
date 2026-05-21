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
import { WebhooksService } from "./webhooks.service";
import { SignatureGuard } from "./guards/signature.guard";
import { ChannelsRepository } from "../database/channels.repository";

@Controller("webhooks")
@UseGuards(SignatureGuard)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly globalVerifyToken: string;

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
    private readonly channelsRepository: ChannelsRepository
  ) {
    this.globalVerifyToken =
      this.configService.get<string>("meta.webhookVerifyToken") || "";
  }

  @Get("meta")
  async verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string
  ): Promise<string> {
    this.logger.debug(`Webhook verification: mode=${mode}`);

    if (mode !== "subscribe") {
      this.logger.warn("Webhook verification failed - invalid mode");
      throw new ForbiddenException("Verification failed");
    }

    if (token === this.globalVerifyToken) {
      this.logger.log("Webhook verified with global token");
      return challenge;
    }

    const channelWithToken = await this.channelsRepository.findByVerifyToken(
      token
    );
    if (channelWithToken) {
      this.logger.log(
        `Webhook verified with channel token (phoneId: ${channelWithToken.phoneId})`
      );
      return challenge;
    }

    this.logger.warn("Webhook verification failed - token mismatch");
    throw new ForbiddenException("Verification failed");
  }

  @Post("meta")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: { object: string; entry: unknown[] }
  ): Promise<string> {
    this.logger.debug(`Received webhook: object=${payload.object}`);

    if (payload.object === "whatsapp_business_account") {
      await this.webhooksService.handleWhatsAppWebhook(payload as never);
    } else if (payload.object === "instagram") {
      await this.webhooksService.handleInstagramWebhook(payload as never);
    } else {
      this.logger.warn(`Unknown webhook object type: ${payload.object}`);
    }

    return "EVENT_RECEIVED";
  }
}
