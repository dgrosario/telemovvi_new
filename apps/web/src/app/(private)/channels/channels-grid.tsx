"use client";

import {
  connectChannel,
  disconnectChannel,
  listChannels,
  removeChannel,
  retrieveChannel,
} from "@/app/actions/channels";
import { EmptyState } from "@/components/empty-state";
import { LoadingComponent } from "@/components/loading";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useChannels } from "@/hooks/use-channels";
import { ProxyConnectHandler } from "@/lib/connect-handlers";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { useQueryClient } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ReconnectChannelModal } from "@/components/channels/reconnect-channel-modal";
import { ChannelCard } from "./channel-card";

type Props = {
  channels: Channel.Raw[];
};

export function ChannelsGrid(props: Props) {
  const {
    openRegisterModal,
    openEditModal,
    setChannelValues,
    toggleOpenLink,
    openReceivedModal,
    openMetaApiModal,
  } = useChannels();

  const [channelIdOnConnecting, setChannelIdOnConnecting] = useState("");
  const [reconnectChannel, setReconnectChannel] = useState<Channel.Raw | null>(null);
  const { data } = useServerActionQuery(listChannels, {
    input: {},
    queryKey: ["list-channels"],
  });

  const queryClient = useQueryClient();

  const connectChannelAction = useServerActionMutation(connectChannel, {
    async onSuccess() {
      setChannelIdOnConnecting("");
      await queryClient.invalidateQueries({ queryKey: ["list-channels"] });
    },
    async onError(error) {
      setChannelIdOnConnecting("");
      toast.error(error.message);
    },
  });

  const disconnectChannelAction = useServerActionMutation(disconnectChannel, {
    async onSuccess() {
      toast.success("Canal desconectado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["list-channels"] });
    },
  });

  const removeChannelAction = useServerActionMutation(removeChannel, {
    async onSuccess() {
      toast.success("Canal removido com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["list-channels"] });
    },
  });

  const channels = useMemo(
    () => (data ?? props.channels).sort((a, b) => a.name.localeCompare(b.name)),
    [data, props.channels]
  );

  const handleConnect = async (channel: Channel.Raw) => {
    setChannelIdOnConnecting(channel.id);
    try {
      await ProxyConnectHandler.instance().connect(
        channel,
        connectChannelAction.mutateAsync
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar conexão");
      setChannelIdOnConnecting("");
    }
  };

  const handleDisconnect = (channel: Channel.Raw) => {
    disconnectChannelAction.mutate({ id: channel.id });
  };

  const handleEdit = async (channel: Channel.Raw) => {
    const [data, error] = await retrieveChannel({ id: channel.id });
    if (error || !data) {
      toast.error("Erro ao carregar dados do canal");
      return;
    }
    openEditModal(data);
  };

  const handleLinkSectors = (channel: Channel.Raw) => {
    setChannelValues(channel.id, channel.name);
    toggleOpenLink();
  };

  const handleReceivedChannel = (channel: Channel.Raw) => {
    openReceivedModal(channel.id, channel.name, !!channel.responseChannel);
  };

  const handleConnectMetaApi = (channel: Channel.Raw) => {
    openMetaApiModal(channel.id, channel.name);
  };

  const handleRemove = (channel: Channel.Raw) => {
    removeChannelAction.mutate({ ids: [channel.id] });
  };

  const handleReconnect = (channel: Channel.Raw) => {
    setReconnectChannel(channel);
  };

  if (connectChannelAction.isPending) {
    return <LoadingComponent text="Conectando seu canal..." />;
  }

  if (disconnectChannelAction.isPending) {
    return <LoadingComponent text="Estamos desconectando o seu canal..." />;
  }

  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[400px]">
        <EmptyState
          title="Nenhum canal cadastrado"
          description="Adicione seu primeiro canal para começar a receber mensagens dos seus clientes."
          icons={[Radio]}
          action={{
            label: "Adicionar canal",
            onClick: () => openRegisterModal(),
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            isConnecting={channelIdOnConnecting === channel.id}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onEdit={handleEdit}
            onLinkSectors={handleLinkSectors}
            onReceivedChannel={handleReceivedChannel}
            onConnectMetaApi={handleConnectMetaApi}
            onReconnect={handleReconnect}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {reconnectChannel && (
        <ReconnectChannelModal
          channel={reconnectChannel}
          open
          onOpenChange={(open) => {
            if (!open) setReconnectChannel(null);
          }}
        />
      )}
    </div>
  );
}
