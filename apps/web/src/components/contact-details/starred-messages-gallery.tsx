"use client";

import { listStarredMessagesWithDetails } from "@/app/actions/starred-messages";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { CircularProgress } from "@mui/material";
import { Star, FileText, Image, Mic, Video } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  conversationId: string;
  onMessageClick?: (messageId: string) => void;
};

const typeIcons: Record<string, React.ElementType> = {
  text: FileText,
  image: Image,
  audio: Mic,
  video: Video,
  document: FileText,
  sticker: Image,
};

export function StarredMessagesGallery({ conversationId, onMessageClick }: Props) {
  const starredQuery = useServerActionQuery(listStarredMessagesWithDetails, {
    input: { conversationId },
    enabled: Boolean(conversationId),
    queryKey: ["starred-messages-details", conversationId],
  });

  if (starredQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <CircularProgress size={32} />
      </div>
    );
  }

  const starredMessages = starredQuery.data ?? [];

  if (starredMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Star className="size-12 mb-2 opacity-30" />
        <p>Nenhuma mensagem favorita</p>
        <p className="text-sm">Marque mensagens com estrela para ve-las aqui</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {starredMessages.map((msg) => {
        const Icon = typeIcons[msg.type ?? "text"] ?? FileText;
        const isOwnMessage = msg.senderType === "attendant";
        const messageDate = new Date(msg.createdAt * 1000);

        return (
          <button
            key={msg.id}
            onClick={() => onMessageClick?.(msg.messageId)}
            className="flex flex-col gap-1 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-gray-500 shrink-0" />
              <span className="text-sm font-medium truncate flex-1">
                {isOwnMessage ? "Você" : msg.senderName || "Contato"}
              </span>
              <Star className="size-3 text-yellow-500 fill-yellow-500 shrink-0" />
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">
              {msg.type === "text"
                ? msg.content
                : msg.type === "image"
                  ? "Imagem"
                  : msg.type === "audio"
                    ? "Áudio"
                    : msg.type === "video"
                      ? "Video"
                      : msg.type === "document"
                        ? msg.filename || "Documento"
                        : msg.type === "sticker"
                          ? "Sticker"
                          : msg.content || "Mensagem"}
            </p>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(messageDate, { addSuffix: true, locale: ptBR })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
