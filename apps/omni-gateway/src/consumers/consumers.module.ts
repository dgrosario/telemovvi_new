import { Module, forwardRef } from "@nestjs/common";
import { RabbitMQConsumerService } from "./rabbitmq-consumer.service";
import { GatewayRequestConsumerService } from "./gateway-request-consumer.service";
import { OutboundMessageHandler } from "./outbound-message.handler";
import { GatewayRequestHandler } from "./gateway-request.handler";
import { EvolutionEventConsumerService } from "./evolution-event.consumer";
import { EvolutionConsumersController } from "./evolution-consumers.controller";
import { InternalMessageConsumerService } from "./internal-message-consumer.service";
import { InternalMessageHandler } from "./internal-message.handler";
import { ProfilePictureConsumerService } from "./profile-picture.consumer";
import { InstagramGatewayHandler } from "./handlers/instagram-gateway.handler";
import { InstagramGatewayRequestHandler } from "./handlers/instagram-gateway-request.handler";
import { InstagramChannelsController } from "./instagram-channels.controller";
import { PublishersModule } from "../publishers/publishers.module";
import { ChannelApisModule } from "../channel-apis/channel-apis.module";
import { DatabaseModule } from "../database";
import { MediaModule } from "../media/media.module";
import { RabbitMQManagementModule } from "../rabbitmq";
import { MetaSettingsModule } from "../meta-settings/meta-settings.module";

// Handlers refatorados
import {
  TemplatesHandler,
  ChannelsHandler,
  MediaHandler,
  MessagesHandler,
  MetaSettingsHandler,
  GroupsHandler,
  EvolutionHandler,
} from "./handlers";

@Module({
  imports: [
    PublishersModule,
    ChannelApisModule,
    DatabaseModule,
    forwardRef(() => MediaModule),
    RabbitMQManagementModule,
    MetaSettingsModule,
  ],
  controllers: [EvolutionConsumersController, InstagramChannelsController],
  providers: [
    RabbitMQConsumerService,
    GatewayRequestConsumerService,
    OutboundMessageHandler,
    GatewayRequestHandler,
    EvolutionEventConsumerService,
    InternalMessageConsumerService,
    InternalMessageHandler,
    ProfilePictureConsumerService,
    InstagramGatewayHandler,
    InstagramGatewayRequestHandler,
    // Handlers refatorados
    TemplatesHandler,
    ChannelsHandler,
    MediaHandler,
    MessagesHandler,
    MetaSettingsHandler,
    GroupsHandler,
    EvolutionHandler,
  ],
  exports: [
    RabbitMQConsumerService,
    GatewayRequestConsumerService,
    EvolutionEventConsumerService,
    InternalMessageConsumerService,
    GatewayRequestHandler,
    InstagramGatewayHandler,
  ],
})
export class ConsumersModule {}
