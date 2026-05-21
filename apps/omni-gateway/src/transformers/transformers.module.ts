import { Module } from "@nestjs/common";
import { WhatsAppTransformer } from "./whatsapp.transformer";
import { InstagramTransformer } from "./instagram.transformer";

@Module({
  providers: [WhatsAppTransformer, InstagramTransformer],
  exports: [WhatsAppTransformer, InstagramTransformer],
})
export class TransformersModule {}
