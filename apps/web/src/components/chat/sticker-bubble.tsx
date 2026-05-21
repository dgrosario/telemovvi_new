"use client";
import { cn } from "@/lib/utils";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import Image from "next/image";
import React, { memo, useEffect, useRef, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { MessageContainer } from "./message-container";
import { QuotedMessagePreview } from "./quoted-message-preview";
import { MediaErrorState } from "./media-error-state";

type MessageWithError = Message.Raw & { error?: boolean };

type Props = {
  message: MessageWithError;
  channel: string;
  hiddenAvatar: boolean;
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

export const StickerBubble: React.FC<Props> = memo(function StickerBubble(props) {
  if (props.message?.type !== "sticker") return <></>;

  const [stickerUrl, setStickerUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer para lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "200px",
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isVisible && props.channel) {
      loadSticker();
    }

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [isVisible, props.channel]);

  async function loadSticker() {
    try {
      const response = await fetch(
        `/api/message/${props.message.id}/media?channelId=${props.channel}`
      );

      if (!response.ok) {
        console.error(`[StickerBubble] HTTP ${response.status}:`, props.message.id);
        setLoading(false);
        setHasError(true);
        return;
      }

      const buffer = await response.arrayBuffer();

      const contentType =
        response.headers.get("Content-Type") ||
        props.message.mimetype ||
        "image/webp";
      const blob = new Blob([buffer], { type: contentType });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setStickerUrl(url);
      setLoading(false);
    } catch (error) {
      console.error("[StickerBubble] Error loading sticker:", props.message.id, error);
      setLoading(false);
      setHasError(true);
    }
  }

  return (
    <MessageContainer
      senderId={props.message.sender.id}
      createdAt={props.message.createdAt}
      senderType={props.message.sender?.type}
      status={props.message.status}
      error={props.message.error}
      internal={props.message.internal}
      messageType={props.message.type}
      hiddenAvatar={props.hiddenAvatar}
      senderName={props.message.sender.name}
      channelType={props.channelType}
      channelName={props.channelName}
      isWhatsAppGroup={props.isWhatsAppGroup}
      currentUserId={props.currentUserId}
      messageId={props.message.id}
      messageContent=""
      deletedAt={props.message.deletedAt}
      onDelete={props.onDelete}
      onReply={props.onReply}
      isDeleting={props.isDeleting}
      conversationType={props.conversationType}
      conversationStatus={props.conversationStatus}
      isAdmin={props.isAdmin}
      editedAt={props.message.editedAt}
      originalContent={props.originalContent}
      onViewHistory={props.onViewHistory}
      isHistoryExpanded={props.isHistoryExpanded}
      isStarred={props.isStarred}
      onToggleStar={props.onToggleStar}
      isTogglingStarred={props.isTogglingStarred}
      reactions={props.reactions}
      onToggleReaction={props.onToggleReaction}
    >
      {props.quotedMessageId && props.messages && (
        <QuotedMessagePreview
          quotedMessageId={props.quotedMessageId}
          messages={props.messages}
          conversationId={props.conversationId}
        />
      )}
      <div
        ref={containerRef}
        data-sender={props.message.sender?.type}
        className="group flex w-screen max-w-[250px] px-4 pt-5 flex-col items-start gap-3"
      >
        <div
          data-rounded={!props.hiddenAvatar}
          className={cn(
            "flex flex-col justify-start gap-2 w-full max-w-[320px] leading-1.5 border-gray-200",
            "group-data-[sender=attendant]:data-[rounded=false]:rounded-br-xl group-data-[sender=attendant]:rounded-l-xl group-data-[sender=attendant]:rounded-tr-xl group-data-[sender=attendant]:text-white",
            "group-data-[sender=contact]:rounded-tl-xl group-data-[sender=contact]:data-[rounded=false]:rounded-bl-xl group-data-[sender=contact]:rounded-r-xl group-data-[sender=contact]:rounded-br-xl "
          )}
        >
          {loading && (
            <div className="w-full gap-4 flex justify-center items-center">
              <Skeleton className="w-full h-[200px]" />
            </div>
          )}
          {!loading && hasError && (
            <MediaErrorState type="sticker" className="mb-2" isInstagram={props.channelType === "instagram"} />
          )}
          {!loading && !hasError && (
            <div className="mb-2">
              <Image
                width={2000}
                height={1000}
                alt="sticker"
                src={stickerUrl || "#"}
              />
            </div>
          )}
        </div>
      </div>
    </MessageContainer>
  );
});
