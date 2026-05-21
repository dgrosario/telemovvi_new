import { Module } from "@nestjs/common";
import { ValidationController } from "./validation.controller";
import { ChannelApisModule } from "../channel-apis/channel-apis.module";

@Module({
  imports: [ChannelApisModule],
  controllers: [ValidationController],
})
export class ValidationModule {}
