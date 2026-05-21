import { Module, Global } from "@nestjs/common";
import { RabbitMQPublisherService } from "./rabbitmq-publisher.service";

@Global()
@Module({
  providers: [RabbitMQPublisherService],
  exports: [RabbitMQPublisherService],
})
export class PublishersModule {}
