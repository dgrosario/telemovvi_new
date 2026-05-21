import { Channel } from "@omnichannel/core/domain/entities/channel";
import { EvolutionConnectHandler } from "./evolution-connect-handler";
import { InstagramConnectHandler } from "./instagram-connect-handler";
import { MetaApiConnectHandler } from "./meta-api-connect-handler";
import { WhatsAppConnectHandler } from "./whatsapp-connect-handler";
import { isAxiosError } from "@omnichannel/core/infra/utils/axios-error-handler";
import { getErrorMessage } from "@omnichannel/core/shared/errors";

export type Action = (data: {
  id: string;
  type: Channel.Type;
  inputPayload: unknown;
  forceNewInstance?: boolean;
}) => Promise<unknown>;

export type ConnectOptions = {
  forceNewInstance?: boolean;
};

export interface ConnectHandler {
  name: string;
  connect(channel: Channel.Raw, action: Action, options?: ConnectOptions): Promise<void>;
}

export class ProxyConnectHandler implements ConnectHandler {
  name = "proxy";
  connectHandlers: Map<string, ConnectHandler> = new Map();
  register(connectHandler: ConnectHandler) {
    this.connectHandlers.set(connectHandler.name, connectHandler);
  }

  async connect(channel: Channel.Raw, action: Action, options?: ConnectOptions): Promise<void> {
    try {
      const handler = this.connectHandlers.get(channel.type);
      if (!handler) return;
      return await handler.connect(channel, action, options);
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.log(error.response?.data ?? error.message);
      } else {
        console.log(getErrorMessage(error));
      }
    }
  }

  static instance() {
    const instance = new ProxyConnectHandler();

    instance.register(WhatsAppConnectHandler.instance());
    instance.register(EvolutionConnectHandler.instance());
    instance.register(InstagramConnectHandler.instance());
    instance.register(MetaApiConnectHandler.instance());

    return instance;
  }
}
