import { Module, Global } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { MainDatabaseService } from "./main-database.service";
import { MongoDBService } from "./mongodb.service";
import { ChannelsRepository } from "./channels.repository";
import { MessagesRepository } from "./messages.repository";
import { WebhookLogsRepository } from "./webhook-logs.repository";

@Global()
@Module({
  providers: [
    RedisService,
    MainDatabaseService,
    MongoDBService,
    ChannelsRepository,
    MessagesRepository,
    WebhookLogsRepository,
  ],
  exports: [
    RedisService,
    MainDatabaseService,
    MongoDBService,
    ChannelsRepository,
    MessagesRepository,
    WebhookLogsRepository,
  ],
})
export class DatabaseModule {}
