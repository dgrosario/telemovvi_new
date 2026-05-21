"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ModalConfirmDelete from "@/components/modal-confirm-delete";
import { cn } from "@/lib/utils";
import { Channel, getChannelFamily } from "@omnichannel/core/domain/entities/channel";

type Props = {
  channel: Channel.Raw;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onLinkSectors: () => void;
  onReceivedChannel: () => void;
  onConnectMetaApi: () => void;
  onReconnect: () => void;
  onRemove: () => void;
};

type ActionButton = {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  hidden?: boolean;
  disabled?: boolean;
  requireConfirm?: boolean;
  confirmTitle?: string;
  confirmContent?: string;
  loading?: boolean;
};

export function ChannelCardActions(props: Props) {
  const { channel, isConnecting } = props;
  const isConnected = channel.status === "connected";

  const actions: ActionButton[] = [
    {
      id: "connect",
      icon: "tabler-wifi",
      label: "Conectar",
      onClick: props.onConnect,
      variant: "primary",
      hidden: isConnected || channel.type === "meta_api",
      loading: isConnecting,
    },
    {
      id: "connect-meta-api",
      icon: "tabler-brand-meta",
      label: "Conectar via Meta API",
      onClick: props.onConnectMetaApi,
      variant: "secondary",
      hidden: isConnected || channel.type !== "meta_api",
    },
    {
      id: "edit",
      icon: "tabler-edit",
      label: "Editar",
      onClick: props.onEdit,
      variant: "ghost",
    },
    {
      id: "link-sectors",
      icon: "tabler-link-plus",
      label: "Vincular Setores",
      onClick: props.onLinkSectors,
      variant: "ghost",
    },
    {
      id: "received-channel",
      icon: "tabler-arrow-bar-to-down",
      label: "Canal de Recebimento",
      onClick: props.onReceivedChannel,
      variant: "ghost",
    },
    {
      id: "reconnect",
      icon: "tabler-refresh",
      label: "Alterar Canal",
      onClick: props.onReconnect,
      variant: "ghost",
      hidden: channel.type === "meta_api" || getChannelFamily(channel.type).length <= 1,
    },
    {
      id: "disconnect",
      icon: "tabler-wifi-off",
      label: "Desconectar",
      onClick: props.onDisconnect,
      variant: "destructive",
      hidden: !isConnected,
      requireConfirm: true,
      confirmTitle: "Desconectar canal",
      confirmContent: "Tem certeza que deseja desconectar este canal?",
    },
    {
      id: "remove",
      icon: "tabler-trash",
      label: "Remover",
      onClick: props.onRemove,
      variant: "destructive",
      requireConfirm: true,
    },
  ];

  const visibleActions = actions.filter((action) => !action.hidden);

  return (
    <div className="flex flex-wrap gap-1 w-full justify-end">
      {visibleActions.map((action) => {
        const buttonElement = (
          <Button
            key={action.id}
            variant={action.variant ?? "ghost"}
            className={cn(
              "h-8 w-8 p-0",
              action.variant === "destructive" &&
                "bg-transparent text-red-500 hover:text-red-600 hover:bg-red-50"
            )}
            disabled={action.disabled}
            isLoading={action.loading}
            onClick={action.requireConfirm ? undefined : action.onClick}
          >
            <i className={cn(action.icon, "text-base")} />
          </Button>
        );

        const wrappedButton = (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>{buttonElement}</TooltipTrigger>
            <TooltipContent>{action.label}</TooltipContent>
          </Tooltip>
        );

        if (action.requireConfirm) {
          return (
            <ModalConfirmDelete
              key={action.id}
              resourceName={channel.name}
              dialogTitle={action.confirmTitle}
              dialogContent={action.confirmContent}
              onConfirm={action.onClick}
              disabled={action.disabled}
            >
              {wrappedButton}
            </ModalConfirmDelete>
          );
        }

        return wrappedButton;
      })}
    </div>
  );
}
