import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ChannelSecretsCacheService } from "./channel-secrets-cache.service";
import { GroupMetadataCacheService } from "./group-metadata-cache.service";
import { CacheInvalidationConsumer } from "./cache-invalidation.consumer";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ChannelSecretsCacheService,
    GroupMetadataCacheService,
    CacheInvalidationConsumer,
  ],
  exports: [ChannelSecretsCacheService, GroupMetadataCacheService],
})
export class CacheModule {}
