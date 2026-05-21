import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Action, ConnectHandler, ConnectOptions } from ".";
import { useQRCodeConnection } from "@/hooks/use-qrcode-connection";

export class EvolutionConnectHandler implements ConnectHandler {
  name = "evolution";

  async connect(channel: Channel.Raw, action: Action, options?: ConnectOptions): Promise<void> {
    const result = await action({
      id: channel.id,
      inputPayload: channel,
      type: channel.type,
      forceNewInstance: options?.forceNewInstance,
    });

    const data = result as Record<string, unknown> | undefined;

    if (options?.forceNewInstance) {
      if (!data?.instanceName) {
        throw new Error("Falha ao criar instância de reconexão: instanceName ausente na resposta");
      }
      useQRCodeConnection.setState({
        channelId: channel.id,
        pendingInstanceName: data.instanceName as string,
        initialQrCode: (data.qrcode as string) ?? null,
      });
    } else {
      useQRCodeConnection.setState({
        channelId: channel.id,
      });
    }
  }

  static instance() {
    return new EvolutionConnectHandler();
  }
}
