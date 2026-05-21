import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RabbitMQManagementService } from "./rabbitmq-management.service";

@Module({
  imports: [ConfigModule],
  providers: [RabbitMQManagementService],
  exports: [RabbitMQManagementService],
})
export class RabbitMQManagementModule {}
