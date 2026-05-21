import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "./health/health.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { PublishersModule } from "./publishers/publishers.module";
import { ConsumersModule } from "./consumers/consumers.module";
import { ChannelApisModule } from "./channel-apis/channel-apis.module";
import { CircuitBreakerModule } from "./circuit-breaker";
import { DatabaseModule } from "./database";
import { CacheModule } from "./cache";
import { MediaModule } from "./media/media.module";
import { MetaSettingsModule } from "./meta-settings/meta-settings.module";
import { ValidationModule } from "./validation/validation.module";
import { ContactsModule } from "./contacts/contacts.module";
import configuration from "./config/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? "info",
      },
    }),
    DatabaseModule,
    CircuitBreakerModule,
    CacheModule,
    HealthModule,
    WebhooksModule,
    PublishersModule,
    ConsumersModule,
    ChannelApisModule,
    MediaModule,
    MetaSettingsModule,
    ValidationModule,
    ContactsModule,
  ],
})
export class AppModule {}
