"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Channel,
  getPayloadProperty,
  typeChannelsAvailable,
} from "@omnichannel/core/domain/entities/channel";
import { ChannelCardActions } from "./channel-card-actions";

type Props = {
  channel: Channel.Raw;
  onConnect: (channel: Channel.Raw) => Promise<void>;
  onDisconnect: (channel: Channel.Raw) => void;
  onEdit: (channel: Channel.Raw) => void;
  onLinkSectors: (channel: Channel.Raw) => void;
  onReceivedChannel: (channel: Channel.Raw) => void;
  onConnectMetaApi: (channel: Channel.Raw) => void;
  onReconnect: (channel: Channel.Raw) => void;
  onRemove: (channel: Channel.Raw) => void;
  isConnecting: boolean;
};

const channelColorStyles: Record<
  Channel.Type,
  { shadow: string; hoverShadow: string }
> = {
  evolution: {
    shadow: "shadow-[0_2px_8px_rgba(34,197,94,0.15)]",
    hoverShadow: "hover:shadow-[0_4px_20px_rgba(34,197,94,0.3)]",
  },
  whatsapp: {
    shadow: "shadow-[0_2px_8px_rgba(22,163,74,0.15)]",
    hoverShadow: "hover:shadow-[0_4px_20px_rgba(22,163,74,0.3)]",
  },
  instagram: {
    shadow: "shadow-[0_2px_8px_rgba(244,63,94,0.15)]",
    hoverShadow: "hover:shadow-[0_4px_20px_rgba(244,63,94,0.3)]",
  },
  meta_api: {
    shadow: "shadow-[0_2px_8px_rgba(59,130,246,0.15)]",
    hoverShadow: "hover:shadow-[0_4px_20px_rgba(59,130,246,0.3)]",
  },
};

export function ChannelCard(props: Props) {
  const { channel } = props;
  const typeConfig = typeChannelsAvailable.get(channel.type);
  const isConnected = channel.status === "connected";
  const phoneNumber = ["whatsapp", "evolution", "meta_api"].includes(
    channel.type
  )
    ? getPayloadProperty(channel.payload, "phoneNumber")
    : null;

  const profilePictureUrl = channel.type === "instagram"
    ? getPayloadProperty(channel.payload, "profilePictureUrl")
    : null;

  const colorStyle = channelColorStyles[channel.type] ?? {
    shadow: "shadow-sm",
    hoverShadow: "hover:shadow-md",
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden group transition-all duration-300 h-full flex flex-col",
        colorStyle.shadow,
        colorStyle.hoverShadow
      )}
    >
      <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-15 transition-opacity pointer-events-none">
        <i className={cn(typeConfig?.icon, "text-[120px]")} />
      </div>

      <div className="absolute top-3 right-3 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "p-1.5 rounded-full",
                isConnected ? "bg-green-100" : "bg-rose-100"
              )}
            >
              <i
                className={cn(
                  "text-lg",
                  isConnected
                    ? "tabler-wifi text-green-600"
                    : "tabler-wifi-off text-rose-600"
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isConnected ? "Conectado" : "Desconectado"}
          </TooltipContent>
        </Tooltip>
      </div>

      <CardContent className="pt-6 pb-4 relative z-[1] flex-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-muted relative overflow-hidden">
            {profilePictureUrl ? (
              <img
                src={profilePictureUrl}
                alt={channel.name}
                className="w-8 h-8 rounded object-cover"
                onError={(e) => {
                  // Fallback para o ícone se a imagem falhar
                  e.currentTarget.style.display = "none";
                  const iconElement = e.currentTarget.nextElementSibling as HTMLElement;
                  if (iconElement) iconElement.style.display = "block";
                }}
              />
            ) : null}
            <i 
              className={cn(typeConfig?.icon, "text-2xl")} 
              style={{ display: profilePictureUrl ? "none" : "block" }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-lg line-clamp-1">
              {channel.name}
            </h3>
            <span className="text-sm text-muted-foreground">
              {typeConfig?.name}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {phoneNumber && (
            <div className="flex items-center gap-2">
              <i className="tabler-phone text-muted-foreground" />
              <span>{phoneNumber}</span>
            </div>
          )}

          {channel.responseChannel && (
            <div className="flex items-center gap-2">
              <i className="tabler-arrow-back text-muted-foreground" />
              <span className="text-muted-foreground">Canal de resposta:</span>
              <span className="truncate">{channel.responseChannel.name}</span>
            </div>
          )}

          <div className="pt-2">
            {isConnected ? (
              <Badge className="bg-transparent text-green-600 border border-green-500">
                <div className="size-2 rounded-full bg-green-500" />
                <span>Conectado</span>
              </Badge>
            ) : (
              <Badge className="bg-transparent text-rose-600 border border-rose-500">
                <div className="size-2 rounded-full bg-rose-500" />
                <span>Desconectado</span>
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t bg-muted/30 px-4 py-3">
        <ChannelCardActions
          channel={channel}
          isConnecting={props.isConnecting}
          onConnect={() => props.onConnect(channel)}
          onDisconnect={() => props.onDisconnect(channel)}
          onEdit={() => props.onEdit(channel)}
          onLinkSectors={() => props.onLinkSectors(channel)}
          onReceivedChannel={() => props.onReceivedChannel(channel)}
          onConnectMetaApi={() => props.onConnectMetaApi(channel)}
          onReconnect={() => props.onReconnect(channel)}
          onRemove={() => props.onRemove(channel)}
        />
      </CardFooter>
    </Card>
  );
}
