"use client";

import React, { useEffect, useState, useRef } from "react";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Reply, Image, Mic, Video, FileText, Sticker, Loader2, MapPin } from "lucide-react";
import { getMessageById } from "@/app/actions/messages";
import { getMessagePreviewText } from "@/lib/message-utils";
import { useChat } from "@/hooks/use-chat";

type Props = {
  quotedMessageId: string | null;
  messages: Map<string, Message>;
  conversationId?: string;
  onScrollToMessage?: (messageId: string) => void;
};

const MESSAGE_TYPE_ICONS = new Map<Message.Type, React.ReactNode>([
  ["image", <Image key="image" className="size-3 shrink-0" />],
  ["audio", <Mic key="audio" className="size-3 shrink-0" />],
  ["video", <Video key="video" className="size-3 shrink-0" />],
  ["document", <FileText key="document" className="size-3 shrink-0" />],
  ["sticker", <Sticker key="sticker" className="size-3 shrink-0" />],
  ["location", <MapPin key="location" className="size-3 shrink-0" />],
]);

function getMessagePreview(message: Message): { icon: React.ReactNode; text: string } {
  return {
    icon: MESSAGE_TYPE_ICONS.get(message.type) ?? null,
    text: getMessagePreviewText(message),
  };
}

function QuotedPlaceholder({ loading, notFound }: { loading?: boolean; notFound?: boolean }) {
  return (
    <div className="border-l-4 border-gray-300 bg-black/5 rounded-tr-xl px-3 py-2 mt-2 mb-1 w-full">
      <div className="flex items-center gap-1">
        <Reply className="size-3 text-gray-400 shrink-0" />
        {loading ? (
          <Loader2 className="size-3 text-gray-400 animate-spin" />
        ) : null}
        <span className="text-xs text-gray-400 truncate">
          {loading ? "Carregando..." : notFound ? "Mensagem indisponivel" : "Mensagem citada"}
        </span>
      </div>
    </div>
  );
}

export const QuotedMessagePreview: React.FC<Props> = ({
  quotedMessageId,
  messages,
  conversationId,
  onScrollToMessage,
}) => {
  const setScrollToMessageId = useChat((state) => state.setScrollToMessageId);
  const [fetchedMessage, setFetchedMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  const quotedMessageFromMap = quotedMessageId ? messages.get(quotedMessageId) : null;
  const quotedMessage = quotedMessageFromMap ?? fetchedMessage;

  useEffect(() => {
    if (!quotedMessageId) return;
    if (quotedMessageFromMap) return;
    if (notFound && fetchedRef.current === quotedMessageId) return;
    if (fetchedMessage && fetchedRef.current === quotedMessageId) return;

    const fetchMessage = async () => {
      setIsLoading(true);
      setNotFound(false);
      fetchedRef.current = quotedMessageId;

      try {
        const [result] = await getMessageById({ messageId: quotedMessageId });
        if (result) {
          setFetchedMessage(Message.fromRaw(result));
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessage();
  }, [quotedMessageId, quotedMessageFromMap, notFound, fetchedMessage]);

  if (!quotedMessageId) return null;

  if (isLoading) {
    return <QuotedPlaceholder loading />;
  }

  if (notFound) {
    return <QuotedPlaceholder notFound />;
  }

  if (!quotedMessage) {
    return <QuotedPlaceholder />;
  }

  const { icon, text } = getMessagePreview(quotedMessage);
  const senderName = quotedMessage.sender.name || (quotedMessage.sender.type === "attendant" ? "Atendente" : "Contato");

  const handleClick = () => {
    if (!quotedMessageId) return;

    if (onScrollToMessage) {
      onScrollToMessage(quotedMessageId);
      return;
    }

    // Fallback global: ContainerMessages observa este estado e realiza
    // loadMessagesUntilId + scroll/highlight quando necessario.
    setScrollToMessageId(quotedMessageId);
  };

  return (
    <div
      data-clickable="true"
      className="border-l-4 border-primary bg-black/5 rounded-tr-xl px-3 py-2 mt-2 mb-1 cursor-pointer hover:bg-black/10 transition-colors w-full"
      onClick={handleClick}
    >
      <div className="flex items-center gap-1">
        <Reply className="size-3 text-primary shrink-0" />
        <span className="text-xs font-medium text-primary truncate">
          {senderName}
        </span>
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        {icon}
        <span className="text-xs text-gray-600 truncate line-clamp-1">
          {text}
        </span>
      </div>
    </div>
  );
};
