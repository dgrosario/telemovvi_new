import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { ConsumersModule } from "../consumers/consumers.module";
import { InstagramHealthService } from "./instagram-health.service";
import { DatabaseModule } from "../database";

@Module({
  imports: [TerminusModule, ConsumersModule, DatabaseModule],
  controllers: [HealthController],
  providers: [InstagramHealthService],
})
export class HealthModule {}
