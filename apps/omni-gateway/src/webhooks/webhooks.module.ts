import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { SignatureGuard } from "./guards/signature.guard";
import { InstagramWebhookController } from "./instagram-webhook.controller";
import { InstagramWebhookService } from "./instagram-webhook.service";
import { InstagramSignatureGuard } from "./guards/instagram-signature.guard";
import { TransformersModule } from "../transformers/transformers.module";
import { MediaModule } from "../media/media.module";

@Module({
  imports: [TransformersModule, MediaModule],
  controllers: [WebhooksController, InstagramWebhookController],
  providers: [
    WebhooksService,
    SignatureGuard,
    InstagramWebhookService,
    InstagramSignatureGuard,
  ],
})
export class WebhooksModule {}
