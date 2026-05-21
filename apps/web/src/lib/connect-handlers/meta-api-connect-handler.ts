import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Action, ConnectHandler } from ".";

export class MetaApiConnectHandler implements ConnectHandler {
  name = "meta_api";

  async connect(_channel: Channel.Raw, _action: Action): Promise<void> {
    // For meta_api, connection is handled via modal in the UI
    // This handler is a no-op since we open the modal from table actions
  }

  static instance() {
    return new MetaApiConnectHandler();
  }
}
