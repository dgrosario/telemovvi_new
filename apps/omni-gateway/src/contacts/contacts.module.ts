import { Module } from "@nestjs/common";
import { ContactsController } from "./contacts.controller";
import { ChannelApisModule } from "../channel-apis/channel-apis.module";

@Module({
  imports: [ChannelApisModule],
  controllers: [ContactsController],
})
export class ContactsModule {}
