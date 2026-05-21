"use client";
import { closeConversation, deleteConversation } from "@/app/actions/conversations";
import { leaveInternalConversation } from "@/app/actions/internal-conversations";
import CustomAvatar from "@/components/custom-avatar";
import CustomChip from "@/components/custom-chip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useForwardMessage } from "@/hooks/use-forward-message";
import { useAssignConversation } from "@/hooks/use-assign-conversation";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { usePermissionCheck, useCanViewContactDetails } from "@/hooks/use-permission-check";
import { useUserSectors } from "@/hooks/use-user-sectors";
import { cn, formatLastMessagemTime } from "@/lib/utils";
import { getMessageTypeLabel } from "@/lib/message-utils";
import { toast } from "react-toastify";
import {
  AvatarGroup,
  Badge,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Avatar as MuiAvatar,
} from "@mui/material";
import { typeChannelsAvailable } from "@omnichannel/core/domain/entities/channel";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCallback, useMemo, useState } from "react";
import { getConversationWindowInfo } from "@/hooks/use-instagram-seven-day-window";
import { ModalSelectSector } from "../modal-select-sector";
import { sendMessage } from "@/app/actions/messages";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  conversation: Conversation.Raw;
  crossChannelStatus?: "recent" | "stale" | null;
};

function getWaitingTimeColor(minutes: number): string {
  if (minutes < 2) return "text-green-600";
  if (minutes < 5) return "text-amber-500";
  if (minutes < 10) return "text-orange-500";
  return "text-red-500";
}

function sanitizeTeaserText(teaser: string | null | undefined): string {
  if (!teaser) return "";

  return teaser
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[`*_~>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const ChatItem: React.FC<Props> = ({ conversation, crossChannelStatus }) => {
  const queryClient = useQueryClient();
  const [openMenuMore, setOpenMenuMore] = useState<HTMLButtonElement | null>(
    null
  );
  const store = useChat();
  const { assign, isPending: isAssigning, checkSectorSelection } = useAssignConversation();
  const [showSectorModal, setShowSectorModal] = useState(false);
  const { messageToForward, clearMessageToForward } = useForwardMessage();
  const [showForwardConfirm, setShowForwardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { hasPermission: canDeleteConversation } = usePermissionCheck(["delete:conversation"]);
  const canViewInCurrentSector = useCanViewContactDetails(conversation.sector?.id);
  const { hasPermission: hasBypassSectorPermission } = usePermissionCheck([
    "list:all-sectors",
    "manage:sectors",
    "manage:conversations"
  ]);
  const { data: userSectors = [] } = useUserSectors();
  const userSectorIds = useMemo(() => userSectors.map(s => s.id), [userSectors]);
  const closeConversationMutation = useServerActionMutation(closeConversation, {
    onSuccess: () => {
      toast.success("Conversa fechada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["conversations-paginated"] });
      setOpenMenuMore(null);
    },
    onError: () => {
      toast.error("Erro ao fechar conversa");
    },
  });
  const deleteConversationMutation = useServerActionMutation(deleteConversation, {
    onSuccess: () => {
      toast.success("Conversa excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["conversations-paginated"] });
      setOpenMenuMore(null);
      if (store.conversationOpenedId === conversation.id) {
        store.setConversationOpenedId(null);
      }
    },
    onError: () => {
      toast.error("Erro ao excluir conversa");
    },
  });
  const leaveConversationMutation = useServerActionMutation(leaveInternalConversation, {
    onSuccess: () => {
      toast.success("Você saiu da conversa!");
      queryClient.invalidateQueries({ queryKey: ["internal-conversations"] });
      setOpenMenuMore(null);
    },
    onError: () => {
      toast.error("Erro ao sair da conversa");
    },
  });

  const isInternal = conversation.conversationType === "direct" || conversation.conversationType === "group";
  const isGroup = conversation.conversationType === "group";
  const isWhatsAppGroup = conversation.conversationType === "whatsapp-group";

  const channelType = useMemo(
    () =>
      conversation.channel
        ? typeChannelsAvailable.get(conversation.channel.type)
        : null,
    [conversation]
  );

  const otherParticipants = useMemo(() => {
    if (!isInternal) return [];
    return conversation.participants.filter(
      (p) => p.userId !== store.user?.id && p.leftAt === null
    );
  }, [conversation.participants, store.user?.id, isInternal]);

  const displayName = useMemo(() => {
    if (isWhatsAppGroup) {
      const name = conversation.name;
      if (!name || name.endsWith("@g.us")) {
        return "Grupo WhatsApp";
      }
      return name;
    }
    if (isInternal) {
      if (isGroup) {
        return conversation.name ?? otherParticipants.map((p) => p.userName).join(", ");
      }
      return otherParticipants[0]?.userName ?? "Conversa";
    }
    return conversation.contact?.name ?? "";
  }, [isInternal, isGroup, isWhatsAppGroup, conversation.name, conversation.contact?.name, otherParticipants]);

  const displayAcronym = useMemo(() => {
    if (isWhatsAppGroup) {
      const name = conversation.name;
      if (!name || name.endsWith("@g.us")) {
        return "G";
      }
      return name.charAt(0).toUpperCase();
    }
    if (isInternal) {
      if (isGroup) {
        return (conversation.name ?? "G").charAt(0).toUpperCase();
      }
      return (otherParticipants[0]?.userName ?? "?").charAt(0).toUpperCase();
    }
    return conversation.contact?.acronym ?? "?";
  }, [isInternal, isGroup, isWhatsAppGroup, conversation.name, conversation.contact?.acronym, otherParticipants]);

  const displayThumbnail = useMemo(() => {
    if (isInternal) {
      if (isGroup) {
        return null;
      }
      return otherParticipants[0]?.userThumbnail ?? null;
    }
    return conversation.contact?.thumbnail ?? null;
  }, [isInternal, isGroup, conversation.contact?.thumbnail, otherParticipants]);

  const isCurrentUserAttendant = conversation?.attendant?.id === store.user?.id;

  const canAssignToSector = useMemo(() => {
    if (hasBypassSectorPermission) return true;
    if (!conversation.sector?.id) return true;
    return userSectorIds.includes(conversation.sector.id);
  }, [hasBypassSectorPermission, conversation.sector?.id, userSectorIds]);

  const canAssign =
    !isWhatsAppGroup &&
    canAssignToSector &&
    ((conversation.status === "waiting" && !conversation.attendant) ||
    conversation.status === "closed");

  const handleAssign = useCallback(() => {
    const result = checkSectorSelection(conversation.id);

    if (result.needsSelection) {
      setShowSectorModal(true);
      return;
    }

    assign(conversation.id, result.autoSectorId);
  }, [conversation.id, checkSectorSelection, assign]);

  const handleSectorSelect = useCallback(
    (sectorId: string) => {
      assign(conversation.id, sectorId);
    },
    [conversation.id, assign]
  );

  const sendMessageMutation = useServerActionMutation(sendMessage, {
    onSuccess: () => {
      toast.success("Mensagem encaminhada com sucesso!");
      clearMessageToForward();
      setShowForwardConfirm(false);
      store.setConversationOpenedId(conversation.id);
    },
    onError: () => {
      toast.error("Erro ao encaminhar mensagem");
      setShowForwardConfirm(false);
    },
  });

  const handleConfirmForward = useCallback(() => {
    if (!messageToForward || !conversation.channel?.id) return;

    // Por enquanto, apenas mensagens de texto podem ser encaminhadas
    if (messageToForward.type === "text") {
      sendMessageMutation.mutate({
        conversationId: conversation.id,
        channelId: conversation.channel.id,
        content: messageToForward.content,
      });
    } else {
      toast.info("Encaminhamento de mídia será implementado em breve");
      clearMessageToForward();
      setShowForwardConfirm(false);
    }
  }, [messageToForward, conversation, sendMessageMutation, clearMessageToForward]);

  const handleCancelForward = useCallback(() => {
    setShowForwardConfirm(false);
  }, []);

  const waitingTime = useMemo(() => {
    if (!conversation.lastClientMessageCreatedAt) return null;

    const lastClientMessage = new Date(conversation.lastClientMessageCreatedAt);
    const lastMessage = conversation.lastMessageCreatedAt
      ? new Date(conversation.lastMessageCreatedAt)
      : null;

    if (lastMessage && lastMessage > lastClientMessage) {
      return null;
    }

    const diffMinutes = Math.floor(
      (Date.now() - lastClientMessage.getTime()) / 60000
    );

    if (diffMinutes < 1) return null;

    return {
      text: formatDistanceToNow(lastClientMessage, {
        locale: ptBR,
        addSuffix: false,
      }),
      minutes: diffMinutes,
    };
  }, [conversation.lastClientMessageCreatedAt, conversation.lastMessageCreatedAt]);

  const lastMessageSender = useMemo<'attendant' | 'client' | null>(() => {
    if (!conversation.lastMessageCreatedAt) return null;
    if (!conversation.lastClientMessageCreatedAt) return null;

    const lastMessage = new Date(conversation.lastMessageCreatedAt);
    const lastClientMessage = new Date(conversation.lastClientMessageCreatedAt);

    return lastMessage > lastClientMessage ? 'attendant' : 'client';
  }, [conversation.lastMessageCreatedAt, conversation.lastClientMessageCreatedAt]);

  type BadgeConfig = {
    label: string;
    shortLabel: string;
    tooltip: string;
    color: 'success' | 'info' | 'warning' | 'error' | 'primary' | 'secondary' | 'default';
    icon: string;
  } | null;

  const attendanceBadgeConfig = useMemo<BadgeConfig>(() => {
    if (conversation.status !== "open" || !conversation.attendant) {
      return null;
    }

    // Always show attendant name (abbreviated when necessary)
    const attendantName = conversation.attendant.name;
    const nameParts = attendantName.trim().split(/\s+/);
    const shortName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : attendantName;

    return {
      label: attendantName,
      shortLabel: shortName,
      tooltip: attendantName,
      color: isCurrentUserAttendant ? "success" : "secondary",
      icon: "tabler-user",
    };
  }, [
    conversation.status,
    conversation.attendant,
    isCurrentUserAttendant,
  ]);

  const teaserText = useMemo(
    () => sanitizeTeaserText(conversation.teaser),
    [conversation.teaser]
  );

  const windowInfo = useMemo(() => {
    return getConversationWindowInfo(
      conversation.channel?.type,
      conversation.lastClientMessageCreatedAt,
      conversation.status
    );
  }, [conversation.channel?.type, conversation.lastClientMessageCreatedAt, conversation.status]);

  const crossChannelAvatarShellClass =
    crossChannelStatus === "recent"
      ? "cross-channel-avatar-shell-recent animate-pulse-ring-green"
      : crossChannelStatus === "stale"
        ? "cross-channel-avatar-shell-stale animate-pulse-ring-orange"
        : null;

  const crossChannelAvatarContentClass =
    crossChannelStatus === "recent"
      ? "cross-channel-avatar-content cross-channel-avatar-content-recent"
      : crossChannelStatus === "stale"
        ? "cross-channel-avatar-content cross-channel-avatar-content-stale"
        : null;

  return (
    <div
      data-active={conversation.id === store.conversationOpenedId}
      onClick={async () => {
        // Se há mensagem para encaminhar, mostrar confirmação
        if (messageToForward) {
          setShowForwardConfirm(true);
          return;
        }
        
        store.setConversationOpenedId(conversation.id);
      }}
      className={cn(
        "group grid grid-cols-[auto_1fr] items-center gap-2 px-3 py-1.5 border-b cursor-pointer",
        "transition-all duration-150 ease-in-out",
        "hover:bg-sidebar-accent hover:shadow-sm",
        "data-[active=true]:bg-primary/10 data-[active=true]:shadow-sm",
        !isWhatsAppGroup && conversation.status === "closed" && "border-l-4 border-l-red-400",
        !isWhatsAppGroup && conversation.status === "expired" && "border-l-4 border-l-sky-400",
        !isWhatsAppGroup && conversation.status === "open" && "border-l-4 border-l-green-500",
        !isWhatsAppGroup && conversation.status === "waiting" && "border-l-4 border-l-amber-400",
        conversation.status === "internal" && "border-l-4 border-l-purple-400"
      )}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          store.setConversationOpenedId(conversation.id);
        }
      }}
    >
      {/* Avatar Section */}
      <div className="relative flex items-center">
        {isGroup ? (
          <AvatarGroup max={2} sx={{ "& .MuiAvatar-root": { width: 28, height: 28, fontSize: "0.75rem" } }}>
            {otherParticipants.slice(0, 3).map((p) => (
              <MuiAvatar key={p.userId} src={p.userThumbnail ?? undefined} alt={p.userName}>
                {p.userName.charAt(0).toUpperCase()}
              </MuiAvatar>
            ))}
          </AvatarGroup>
        ) : isWhatsAppGroup ? (
          <Avatar className="size-11 bg-green-50 border border-green-200">
            <AvatarFallback className="border-0 bg-transparent">
              <i className="tabler-users-group !size-6 text-green-600" />
            </AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className={cn(
            "size-11 bg-white border",
            crossChannelAvatarShellClass
          )}>
            {displayThumbnail && (
              <AvatarImage
                src={displayThumbnail}
                className={cn(crossChannelAvatarContentClass)}
              />
            )}
            <AvatarFallback className={cn("border", crossChannelAvatarContentClass)}>
              <CustomAvatar skin="light-static" color={isInternal ? "secondary" : "primary"}>
                {displayAcronym}
              </CustomAvatar>
            </AvatarFallback>
          </Avatar>
        )}
        {/* Channel Icon Overlay - only for external conversations */}
        {channelType && !isInternal && !isWhatsAppGroup && (
          <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-white border shadow-sm flex items-center justify-center">
            <i className={cn(channelType.icon, "!size-3")} />
          </div>
        )}
        {/* WhatsApp Group Icon Overlay */}
        {isWhatsAppGroup && channelType && (
          <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-green-100 border border-green-300 shadow-sm flex items-center justify-center">
            <i className={cn(channelType.icon, "!size-3 text-green-600")} />
          </div>
        )}
        {/* Internal Conversation Icon Overlay */}
        {isInternal && (
          <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-purple-100 border border-purple-200 shadow-sm flex items-center justify-center">
            <i className={cn(isGroup ? "tabler-users-group" : "tabler-message", "!size-3 text-purple-600")} />
          </div>
        )}
        {/* Cross-Channel Indicator */}
        {crossChannelStatus && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -top-0.5 -left-0.5 size-3.5 rounded-full bg-white border shadow-sm flex items-center justify-center">
                <i className="tabler-arrows-split !size-2.5 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              Contato ativo em outro canal
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Content Section - Header/Body/Footer */}
      <div className="flex flex-col gap-1 min-w-0 py-1">
        {/* Header: Name + Timestamp + Waiting Time */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <Typography
            variant="subtitle2"
            className="select-none truncate text-foreground font-medium flex-1 min-w-0"
          >
            {displayName}
          </Typography>
          <div className="flex items-center gap-1.5 shrink-0">
            <Typography
              variant="caption"
              className="text-muted-foreground select-none text-xs whitespace-nowrap"
            >
              {formatLastMessagemTime(conversation.lastMessageCreatedAt)}
            </Typography>
            {!isInternal && waitingTime && (
              <Typography
                variant="caption"
                className={cn(
                  "text-xs font-medium select-none whitespace-nowrap",
                  getWaitingTimeColor(waitingTime.minutes)
                )}
                title={`Aguardando resposta ha ${waitingTime.text}`}
              >
                <i className="tabler-clock !size-3 mr-0.5 inline-block align-middle" />
                {waitingTime.text}
              </Typography>
            )}
            {!isInternal && !isWhatsAppGroup && windowInfo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-semibold select-none whitespace-nowrap rounded-full px-1.5 py-0.5",
                    windowInfo.color === "success" && "bg-green-50 text-green-600",
                    windowInfo.color === "warning" && "bg-amber-50 text-amber-600 ring-1 ring-amber-300 animate-pulse",
                    windowInfo.color === "error" && "bg-red-50 text-red-600 ring-1 ring-red-300 animate-pulse",
                  )}>
                    <i className="tabler-hourglass-low !size-3" />
                    {windowInfo.formattedTimeRemaining}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {windowInfo.tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Body: Message Teaser + Unread Badge */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                data-unviewed={conversation.messageToView > 0}
                className="line-clamp-2 text-muted-foreground text-xs data-[unviewed=true]:font-bold overflow-hidden cursor-default flex-1 min-w-0"
              >
                <span>{teaserText}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs whitespace-pre-wrap break-words">
                {teaserText}
              </p>
            </TooltipContent>
          </Tooltip>
          {canAssign ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge
                    badgeContent={conversation.messageToView}
                    color="error"
                    sx={{
                      "& .MuiBadge-badge": {
                        fontSize: "0.65rem",
                        height: "16px",
                        minWidth: "16px",
                        padding: "0 4px",
                      },
                    }}
                  >
                    <IconButton
                      size="small"
                      disabled={isAssigning}
                      disableRipple
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssign();
                      }}
                      sx={{
                        bgcolor: "primary.main",
                        color: "white",
                        transition: "all 0.15s ease-in-out",
                        "& .tabler-headset": {
                          color: "white",
                        },
                        "&:hover": {
                          bgcolor: "primary.dark",
                          color: "white",
                          transform: "scale(1.05)",
                          "& .tabler-headset": {
                            color: "white",
                          },
                        },
                        "&:disabled": {
                          bgcolor: "action.disabledBackground",
                          color: "action.disabled",
                        },
                      }}
                    >
                      {isAssigning ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <i className="tabler-headset !size-4 text-white" />
                      )}
                    </IconButton>
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent>Atender</TooltipContent>
            </Tooltip>
          ) : conversation.messageToView > 0 ? (
            <Badge
              badgeContent={conversation.messageToView}
              color={isInternal ? "secondary" : "success"}
              sx={{
                "& .MuiBadge-badge": {
                  position: "static",
                  transform: "none",
                  fontSize: "0.65rem",
                  height: "18px",
                  minWidth: "18px",
                },
              }}
            />
          ) : null}
        </div>

        {/* Footer: Badges + Actions */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Badges (left side) */}
          <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
            {isInternal ? (
              <>
                <CustomChip
                  size="small"
                  color="secondary"
                  variant="tonal"
                  classes={{
                    root: "!h-5",
                    label: "text-xs",
                  }}
                  label={isGroup ? "Grupo" : "Direta"}
                  icon={<i className={cn(isGroup ? "tabler-users-group" : "tabler-message", "!size-3")} />}
                />
                {isGroup && (
                  <CustomChip
                    size="small"
                    color="default"
                    variant="tonal"
                    classes={{
                      root: "!h-5",
                      label: "text-xs",
                    }}
                    label={`${otherParticipants.length + 1} membros`}
                    icon={<i className="tabler-users !size-3" />}
                  />
                )}
              </>
            ) : (
              <>
                <CustomChip
                  size="small"
                  color="info"
                  variant="tonal"
                  classes={{
                    root: "!h-5",
                    label: "text-xs",
                  }}
                  label={conversation.channel?.name ?? ""}
                  icon={<i className={cn(channelType?.icon, "!size-3")} />}
                />
                {isWhatsAppGroup && (
                  <CustomChip
                    size="small"
                    color="success"
                    variant="tonal"
                    classes={{
                      root: "!h-5",
                      label: "text-xs",
                    }}
                    label="Grupo"
                    icon={<i className="tabler-users-group !size-3" />}
                  />
                )}
                {!isWhatsAppGroup && conversation.sector && (
                  <CustomChip
                    size="small"
                    color="secondary"
                    variant="tonal"
                    classes={{
                      root: "!h-5",
                      label: "text-xs",
                    }}
                    label={conversation.sector.name}
                    icon={<i className="tabler-vector-bezier-arc !size-3" />}
                  />
                )}
                {!isWhatsAppGroup && attendanceBadgeConfig && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <CustomChip
                          size="small"
                          color={attendanceBadgeConfig.color}
                          variant="tonal"
                          label={attendanceBadgeConfig.shortLabel}
                          icon={<i className={`${attendanceBadgeConfig.icon} !size-3`} />}
                          classes={{
                            root: "!h-5",
                            label: "text-xs",
                          }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {attendanceBadgeConfig.tooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
                {conversation.receivedChannel && (
                  <CustomChip
                    size="small"
                    color="warning"
                    variant="tonal"
                    label={conversation.receivedChannel.name}
                    icon={<i className="tabler-phone-incoming !size-3" />}
                    classes={{
                      root: "!h-5",
                      label: "text-xs",
                    }}
                  />
                )}
              </>
            )}
          </div>

          {/* Actions (right side) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Action Menu */}
            <div
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <IconButton
                size="small"
                onClick={(e) => {
                  setOpenMenuMore(e.currentTarget);
                }}
                className="!p-1"
                sx={{
                  "&:hover": {
                    bgcolor: "transparent",
                  },
                }}
              >
                <i className="tabler-dots-vertical !size-4" />
              </IconButton>
              <Menu
                keepMounted
                id="long-menu"
                anchorEl={openMenuMore}
                onClose={() => setOpenMenuMore(null)}
                open={Boolean(openMenuMore)}
                slotProps={{ paper: { style: { maxHeight: 48 * 4.5 } } }}
              >
                {isInternal ? (
                  <MenuItem
                    onClick={() => {
                      if (confirm("Deseja realmente sair desta conversa?")) {
                        leaveConversationMutation.mutate({ conversationId: conversation.id });
                      }
                      setOpenMenuMore(null);
                    }}
                    className="gap-2"
                  >
                    <i className="tabler-logout !size-5" />
                    Sair da conversa
                  </MenuItem>
                ) : (
                  [
                    !isCurrentUserAttendant && (
                      <MenuItem key="espiar" onClick={() => {
                        store.setPreviewConversationId(conversation.id, conversation);
                        setOpenMenuMore(null);
                      }} className="gap-2">
                        <i className="tabler-eye !size-5" />
                        Espiar
                      </MenuItem>
                    ),
                    !isWhatsAppGroup && conversation.status === "waiting" && (
                      <MenuItem
                        key="ignorar"
                        onClick={() => {
                          if (confirm("Deseja realmente ignorar esta conversa?")) {
                            closeConversationMutation.mutate({ conversationId: conversation.id });
                          }
                          setOpenMenuMore(null);
                        }}
                        className="gap-2"
                      >
                        <i className="tabler-eye-off !size-5" />
                        Ignorar
                      </MenuItem>
                    ),
                    !isWhatsAppGroup && isCurrentUserAttendant && (
                      <MenuItem
                        key="fechar"
                        onClick={() => {
                          if (confirm("Deseja realmente fechar esta conversa?")) {
                            closeConversationMutation.mutate({ conversationId: conversation.id });
                          }
                          setOpenMenuMore(null);
                        }}
                        className="gap-2"
                      >
                        <i className="tabler-x !size-5" />
                        Fechar
                      </MenuItem>
                    ),
                    !isWhatsAppGroup && canViewInCurrentSector && (isCurrentUserAttendant || conversation.status === "waiting") && (
                      <MenuItem
                        key="transferir"
                        onClick={() => {
                          store.setConversationOpenedId(conversation.id);
                          store.toggleOpenModalTransfer();
                          setOpenMenuMore(null);
                        }}
                        className="gap-2"
                      >
                        <i className="tabler-arrow-forward-up !size-5" />
                        Transferir
                      </MenuItem>
                    ),
                    canDeleteConversation && (
                      <MenuItem
                        key="excluir"
                        onClick={() => {
                          setShowDeleteConfirm(true);
                          setOpenMenuMore(null);
                        }}
                        className="gap-2 text-red-600"
                      >
                        <i className="tabler-trash !size-5" />
                        Excluir
                      </MenuItem>
                    ),
                  ].filter(Boolean)
                )}
              </Menu>
            </div>
          </div>
        </div>
      </div>

      <ModalSelectSector
        open={showSectorModal}
        onClose={() => setShowSectorModal(false)}
        onSelect={handleSectorSelect}
        title="Selecione o setor para o atendimento"
      />

      {/* Modal de confirmação de encaminhamento */}
      <Dialog open={showForwardConfirm} onOpenChange={setShowForwardConfirm}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Encaminhar mensagem</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-3">
              Encaminhar para <strong>{displayName}</strong>?
            </p>
            {messageToForward && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">
                  {getMessageTypeLabel(messageToForward.type)}
                </p>
                {messageToForward.type === "text" && (
                  <p className="text-sm line-clamp-3">{messageToForward.content}</p>
                )}
                {messageToForward.caption && (
                  <p className="text-sm text-gray-600 mt-1">{messageToForward.caption}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelForward}
              disabled={sendMessageMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmForward}
              disabled={sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? "Encaminhando..." : "Encaminhar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Excluir conversa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Deseja realmente excluir esta conversa com <strong>{displayName}</strong>?
            </p>
            <p className="text-sm text-red-600 mt-2">
              Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteConversationMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteConversationMutation.mutate({ conversationId: conversation.id });
                setShowDeleteConfirm(false);
              }}
              disabled={deleteConversationMutation.isPending}
            >
              {deleteConversationMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
