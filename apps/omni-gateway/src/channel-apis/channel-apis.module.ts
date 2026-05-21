import { Module } from "@nestjs/common";
import { WhatsAppApiService } from "./whatsapp-api.service";
import { InstagramApiService } from "./instagram-api.service";
import { EvolutionApiService } from "./evolution-api.service";

@Module({
  providers: [WhatsAppApiService, InstagramApiService, EvolutionApiService],
  exports: [WhatsAppApiService, InstagramApiService, EvolutionApiService],
})
export class ChannelApisModule {}
