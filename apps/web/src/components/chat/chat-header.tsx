"use client";

import { useChat } from "@/hooks/use-chat";
import { useContactDetails } from "@/hooks/use-contact-details";
import { useGroupParticipants } from "@/hooks/use-group-participants";
import { useCanViewContactDetails } from "@/hooks/use-permission-check";
import { formatPhoneNumber } from "@/utils/phone-formatter";
import { getInstagramHandleForDisplay } from "@/utils/instagram-contact";
import { IconButton, Skeleton, Tooltip, Typography } from "@mui/material";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import CustomAvatar from "../custom-avatar";
import { CloseConversation } from "./finish-conversation";
import { ContactHistoryModal } from "./contact-history-modal";
import { ModalTransfer } from "./modal-transfer";
import { ChatParticipantsDrawer } from "./chat-participants-drawer";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useMemo, useState, useCallback } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { MessageSearch } from "./message-search";

type Props = {
  isLoading: boolean;
  conversation?: Conversation.Raw;
  onNavigateToMessage?: (messageId: string) => void;
};

export const ChatHeader: React.FC<Props> = ({
  conversation,
  isLoading,
  onNavigateToMessage,
}) => {
  const { openContactDetails } = useContactDetails();
  const { closeConversationOpened, user } = useChat();
  const canViewContactDetails = useCanViewContactDetails(
    conversation?.sector?.id,
  );
  const [participantsDrawerOpen, setParticipantsDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleNavigateToMessage = useCallback(
    (messageId: string) => {
      onNavigateToMessage?.(messageId);
    },
    [onNavigateToMessage],
  );

  const isInternal =
    conversation?.conversationType === "direct" ||
    conversation?.conversationType === "group";

  const isGroup = conversation?.conversationType === "group";
  const isWhatsAppGroup = conversation?.conversationType === "whatsapp-group";

  const {
    participantCount,
    isLoading: isLoadingParticipants,
    groupInfo,
  } = useGroupParticipants({
    channelId: conversation?.channel?.id,
    groupJid: conversation?.groupJid,
    conversationId: conversation?.id,
    currentName: conversation?.name,
    enabled: isWhatsAppGroup,
  });

  const otherParticipants = useMemo(() => {
    if (!isInternal || !conversation?.participants) return [];
    return conversation.participants.filter(
      (p) => p.userId !== user?.id && p.leftAt === null,
    );
  }, [conversation?.participants, user?.id, isInternal]);

  const displayName = useMemo(() => {
    if (isWhatsAppGroup) {
      const name = conversation?.name;
      const safeName = name && !name.endsWith("@g.us") ? name : null;
      return groupInfo?.subject ?? safeName ?? "Grupo WhatsApp";
    }
    if (isInternal) {
      if (isGroup) {
        return (
          conversation?.name ??
          otherParticipants.map((p) => p.userName).join(", ")
        );
      }
      return otherParticipants[0]?.userName ?? "Conversa";
    }
    return conversation?.contact?.name ?? "";
  }, [
    isInternal,
    isGroup,
    isWhatsAppGroup,
    conversation?.name,
    conversation?.contact?.name,
    otherParticipants,
    groupInfo?.subject,
  ]);

  const displaySubtitle = useMemo(() => {
    if (isWhatsAppGroup) {
      const countText = isLoadingParticipants
        ? "..."
        : participantCount > 0
          ? `${participantCount} participantes`
          : "";
      return countText
        ? `${countText} - ${conversation?.channel?.name ?? ""}`
        : `Grupo WhatsApp - ${conversation?.channel?.name ?? ""}`;
    }
    if (isInternal) {
      if (isGroup) {
        return `${otherParticipants.length + 1} membros`;
      }
      return "Conversa Interna";
    }
    // Special handling for Instagram: show @username instead of IGSID.
    if (conversation?.contact?.type === "instagram") {
      const handle = getInstagramHandleForDisplay(conversation?.contact);
      if (handle) {
        return `${handle} (${conversation?.channel?.name ?? ""})`;
      }
      // Fallback: only show channel name, not the IGSID
      return conversation?.channel?.name ?? "";
    }
    const contactValue = canViewContactDetails
      ? conversation?.contact?.value
      : null;
    if (contactValue) {
      const formattedValue =
        conversation?.contact?.type === "whatsapp"
          ? formatPhoneNumber(contactValue)
          : contactValue;
      return `${formattedValue} (${conversation?.channel?.name ?? ""})`;
    }
    return conversation?.channel?.name ?? "";
  }, [
    isInternal,
    isGroup,
    isWhatsAppGroup,
    conversation?.contact?.value,
    conversation?.contact?.type,
    conversation?.contact?.username,
    conversation?.channel?.name,
    otherParticipants.length,
    participantCount,
    isLoadingParticipants,
    canViewContactDetails,
  ]);

  const displayThumbnail = useMemo(() => {
    if (isWhatsAppGroup) {
      return null;
    }
    if (isInternal) {
      if (isGroup) return null;
      return otherParticipants[0]?.userThumbnail ?? null;
    }
    return conversation?.contact?.thumbnail ?? null;
  }, [
    isInternal,
    isGroup,
    isWhatsAppGroup,
    conversation?.contact?.thumbnail,
    otherParticipants,
  ]);

  const displayAcronym = useMemo(() => {
    if (isWhatsAppGroup) {
      return (conversation?.name ?? "G").charAt(0).toUpperCase();
    }
    if (isInternal) {
      if (isGroup) {
        return (conversation?.name ?? "G").charAt(0).toUpperCase();
      }
      return (otherParticipants[0]?.userName ?? "?").charAt(0).toUpperCase();
    }
    return conversation?.contact?.acronym ?? "?";
  }, [
    isInternal,
    isGroup,
    isWhatsAppGroup,
    conversation?.name,
    conversation?.contact?.acronym,
    otherParticipants,
  ]);

  return (
    <div className="w-full z-50 justify-between items-center border-b flex top-0 bg-white min-h-[56px] md:min-h-[64px] py-2 md:py-3 px-2 md:px-4 relative">
      <div className="flex items-center gap-1.5 md:gap-4 flex-1 min-w-0 overflow-hidden">
        <Tooltip title="Voltar">
          <IconButton
            onClick={closeConversationOpened}
            className="md:hidden shrink-0"
            size="small"
          >
            <ArrowLeft className="size-5" />
          </IconButton>
        </Tooltip>
        {isLoading ? (
          <Skeleton
            variant="circular"
            width={40}
            height={40}
            className="shrink-0"
          />
        ) : (
          <Avatar className="size-9 md:size-10 bg-white border shrink-0">
            {displayThumbnail && <AvatarImage src={displayThumbnail} />}
            <AvatarFallback className="border">
              <CustomAvatar
                skin="light-static"
                color={
                  isInternal
                    ? "secondary"
                    : isWhatsAppGroup
                      ? "success"
                      : "primary"
                }
              >
                {displayAcronym}
              </CustomAvatar>
            </AvatarFallback>
          </Avatar>
        )}
        <Tooltip
          title={
            isInternal
              ? "Conversa interna"
              : isWhatsAppGroup
                ? "Grupo WhatsApp"
                : "Perfil do cliente"
          }
        >
          <div
            onClick={() => {
              if (
                !isInternal &&
                !isWhatsAppGroup &&
                conversation?.contact?.id &&
                conversation?.id &&
                conversation?.channel?.id
              ) {
                openContactDetails({
                  contactId: conversation.contact.id,
                  conversationId: conversation.id,
                  channelId: conversation.channel.id,
                  sectorId: conversation.sector?.id,
                });
              }
            }}
            className={`flex flex-col select-none min-w-0 flex-1 overflow-hidden ${isInternal || isWhatsAppGroup ? "" : "cursor-pointer"}`}
          >
            {isLoading ? (
              <Skeleton variant="text" width={100} height={20} />
            ) : (
              <Typography
                variant="h5"
                className="font-medium text-sm md:text-base text-[#0A0A0A] truncate"
              >
                {displayName}
              </Typography>
            )}
            {isLoading ? (
              <Skeleton variant="text" width={120} height={16} />
            ) : (
              <Typography
                variant="body2"
                className="font-normal text-[10px] md:text-xs text-muted-foreground truncate"
              >
                {displaySubtitle}
              </Typography>
            )}
          </div>
        </Tooltip>
      </div>
      <div className="flex gap-0.5 md:gap-2 items-center shrink-0 ml-1">
        {isWhatsAppGroup && (
          <Tooltip title="Ver participantes">
            <IconButton
              onClick={() => setParticipantsDrawerOpen(true)}
              size="small"
              className="p-1.5 md:p-2"
            >
              <i className="tabler-users !size-4 md:!size-5" />
            </IconButton>
          </Tooltip>
        )}
        {!isInternal &&
          !isWhatsAppGroup &&
          user &&
          conversation?.attendant?.id === user?.id &&
          conversation.status !== "closed" && (
            <CloseConversation conversationId={conversation?.id} />
          )}
        {!isInternal && !isWhatsAppGroup && (
          <ModalTransfer conversation={conversation} />
        )}
        {!isInternal && !isWhatsAppGroup && conversation?.contact?.id && (
          <>
            <Tooltip title="Histórico do contato">
              <IconButton
                onClick={() => setHistoryOpen(true)}
                size="small"
                className="p-1.5 md:p-2"
                aria-label="Histórico do contato"
              >
                <i className="tabler-history !size-4 md:!size-5" />
              </IconButton>
            </Tooltip>
            <ContactHistoryModal
              contactId={conversation.contact.id}
              open={historyOpen}
              onOpenChange={setHistoryOpen}
            />
          </>
        )}
        <Tooltip title="Buscar mensagens">
          <IconButton
            onClick={() => setSearchOpen(!searchOpen)}
            size="small"
            className="p-1.5 md:p-2"
          >
            <Search className="size-4 md:size-5" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Fechar chat">
          <IconButton
            onClick={closeConversationOpened}
            size="small"
            className="p-1.5 md:p-2"
          >
            <i className="tabler-x !size-4 md:!size-5" />
          </IconButton>
        </Tooltip>
      </div>
      {searchOpen && (
        <div className="absolute top-full left-0 right-0 z-40">
          <MessageSearch
            conversationId={conversation?.id}
            onNavigateToMessage={handleNavigateToMessage}
            onClose={() => setSearchOpen(false)}
          />
        </div>
      )}
      {isWhatsAppGroup && (
        <ChatParticipantsDrawer
          open={participantsDrawerOpen}
          onClose={() => setParticipantsDrawerOpen(false)}
          channelId={conversation?.channel?.id}
          groupJid={conversation?.groupJid}
          groupName={conversation?.name}
        />
      )}
    </div>
  );
};
