import React from "react";
import { MessageContainer } from "./message-container";
import { QuotedMessagePreview } from "./quoted-message-preview";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { MapPin, ExternalLink } from "lucide-react";

interface LocationData {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
}

function parseLocationContent(content: string): LocationData | null {
  try {
    const data = JSON.parse(content);
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function buildGoogleMapsUrl(location: LocationData): string {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

type Props = {
  message: Message.Raw;
  hiddenAvatar?: boolean;
  channelType?: Channel.Type;
  channelName?: string;
  isWhatsAppGroup?: boolean;
  currentUserId?: string;
  conversationType?: string;
  conversationStatus?: string | null;
  isAdmin?: boolean;
  onDelete?: () => void;
  onReply?: () => void;
  isDeleting?: boolean;
  quotedMessageId?: string | null;
  messages?: Map<string, Message>;
  conversationId?: string;
  originalContent?: string | null;
  onViewHistory?: () => void;
  isHistoryExpanded?: boolean;
  isStarred?: boolean;
  onToggleStar?: () => void;
  isTogglingStarred?: boolean;
  reactions?: Message.Reaction[];
  onToggleReaction?: (emoji: string) => void;
};

export const LocationBubble: React.FC<Props> = (props) => {
  const location = parseLocationContent(props.message.content);

  const containerProps = {
    createdAt: props.message.createdAt,
    hiddenAvatar: props.hiddenAvatar,
    senderType: props.message.sender?.type,
    status: props.message.status,
    internal: props.message.internal,
    senderName: props.message.sender.name,
    senderId: props.message.sender.id,
    channelType: props.channelType,
    channelName: props.channelName,
    isWhatsAppGroup: props.isWhatsAppGroup,
    currentUserId: props.currentUserId,
    conversationType: props.conversationType,
    conversationStatus: props.conversationStatus,
    isAdmin: props.isAdmin,
    messageId: props.message.id,
    messageContent: props.message.content,
    messageType: props.message.type,
    deletedAt: props.message.deletedAt,
    editedAt: props.message.editedAt,
    onDelete: props.onDelete,
    onReply: props.onReply,
    isDeleting: props.isDeleting,
    originalContent: props.originalContent,
    onViewHistory: props.onViewHistory,
    isHistoryExpanded: props.isHistoryExpanded,
    isStarred: props.isStarred,
    onToggleStar: props.onToggleStar,
    isTogglingStarred: props.isTogglingStarred,
    reactions: props.reactions,
    onToggleReaction: props.onToggleReaction,
  };

  const quotedMessageId = props.quotedMessageId ?? null;
  const messagesMap = props.messages;
  const hasQuote = quotedMessageId && messagesMap;

  if (!location) {
    return (
      <MessageContainer {...containerProps}>
        <div className="px-3 py-2">
          <p className="text-sm text-gray-500">Localização indisponivel</p>
        </div>
      </MessageContainer>
    );
  }

  const mapsUrl = buildGoogleMapsUrl(location);
  const displayName = location.name || location.address || null;

  return (
    <MessageContainer {...containerProps}>
      {hasQuote && (
        <QuotedMessagePreview
          quotedMessageId={quotedMessageId}
          messages={messagesMap}
          conversationId={props.conversationId}
        />
      )}
      <div className="px-3 py-2 min-w-[220px]">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center size-8 rounded-full bg-red-100 shrink-0 mt-0.5">
            <MapPin className="size-4 text-red-600" />
          </div>
          <div className="flex flex-col min-w-0">
            {displayName && (
              <span className="text-sm font-medium text-gray-900 break-words">
                {displayName}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </span>
          </div>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-clickable="true"
          className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 transition-colors text-blue-700 text-xs font-medium w-full justify-center"
        >
          <ExternalLink className="size-3.5" />
          Abrir no Google Maps
        </a>
      </div>
    </MessageContainer>
  );
};
