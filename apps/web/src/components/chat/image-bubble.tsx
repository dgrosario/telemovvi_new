"use client";
import { useMediaCache } from "@/hooks/use-media-cache";
import { CircularProgress, Typography } from "@mui/material";
import { Message } from "@omnichannel/core/domain/entities/message";
import React, { memo, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { MessageContainer } from "./message-container";
import { QuotedMessagePreview } from "./quoted-message-preview";
import { MediaErrorState } from "./media-error-state";
import { MediaModalCloseButton } from "./media-modal-close-button";
import { Channel } from "@omnichannel/core/domain/entities/channel";

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

const IMAGE_WIDTH = 300;
const IMAGE_HEIGHT = 200;

export const ImageBubble: React.FC<Props> = memo(function ImageBubble(props) {
  if (props.message?.type !== "image") return <></>;

  const { getMedia } = useMediaCache();
  const [imageUrl, setImageUrl] = useState("");
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  });
  const displayWidth = Math.min(size.width, IMAGE_WIDTH);
  const displayHeight = size.width > 0
    ? Math.round((displayWidth / size.width) * size.height)
    : IMAGE_HEIGHT;
  const clampedHeight = Math.min(Math.max(displayHeight, 80), 400);

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const oversizedBlobUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef(0);

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
    retryRef.current = 0;
  }, [props.message.id]);

  useEffect(() => {
    let isCancelled = false;

    async function loadImage(forceRetry?: boolean) {
      if (!props.channel) return;

      try {
        if (!forceRetry && props.message.content.includes("blob:")) {
          const url = props.message.content;
          const img = new Image();
          img.onload = () => {
            if (isCancelled) return;
            setSize({ height: img.height, width: img.width });
            setImageUrl(url);
            setLoading(false);
          };
          img.onerror = () => {
            if (isCancelled) return;
            setLoading(false);
            setHasError(true);
          };
          img.src = url;
          return;
        }

        const result = await getMedia(
          props.message.id,
          props.channel,
          forceRetry ? { force: true } : undefined
        );

        if (isCancelled) return;

        if (!result) {
          setLoading(false);
          setHasError(true);
          return;
        }

        if (result.isOversized) {
          oversizedBlobUrlRef.current = result.blobUrl;
        }

        const img = new Image();
        img.onload = () => {
          if (isCancelled) return;
          setSize({ height: img.height, width: img.width });
          setImageUrl(result.blobUrl);
          setLoading(false);
        };
        img.onerror = () => {
          console.error(
            `[ImageBubble] img.onerror for ${props.message.id}, blobUrl valid: ${!!result?.blobUrl}, mime: ${result?.mimeType}, retry: ${retryRef.current}`
          );
          if (isCancelled) return;

          if (retryRef.current === 0) {
            retryRef.current = 1;
            console.log(
              `[ImageBubble] Retrying ${props.message.id} with force=true`
            );
            loadImage(true);
            return;
          }

          setLoading(false);
          setHasError(true);
        };
        img.src = result.blobUrl;
      } catch (error) {
        console.error("[ImageBubble] Error loading image:", props.message.id, error);
        if (isCancelled) return;
        setLoading(false);
        setHasError(true);
      }
    }

    if (isVisible) {
      loadImage();
    }

    return () => {
      isCancelled = true;
      if (oversizedBlobUrlRef.current) {
        URL.revokeObjectURL(oversizedBlobUrlRef.current);
        oversizedBlobUrlRef.current = null;
      }
    };
  }, [isVisible, props.message.content, props.channel, getMedia, props.message.id]);

  return (
    <MessageContainer
      senderId={props.message.sender.id}
      createdAt={props.message.createdAt}
      senderType={props.message.sender?.type}
      status={props.message.status}
      error={props.message.error}
      hiddenAvatar={props.hiddenAvatar}
      senderName={props.message.sender.name}
      className="overflow-hidden"
      style={{ maxWidth: IMAGE_WIDTH }}
      channelType={props.channelType}
      channelName={props.channelName}
      isWhatsAppGroup={props.isWhatsAppGroup}
      currentUserId={props.currentUserId}
      messageId={props.message.id}
      messageContent={props.message.caption ?? ""}
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
        className="group flex flex-col items-start"
        style={{ maxWidth: IMAGE_WIDTH }}
      >
        {loading && (
          <div
            className="flex justify-center items-center"
            style={{ width: displayWidth, height: IMAGE_HEIGHT }}
          >
            <CircularProgress />
          </div>
        )}
        {!loading && hasError && (
          <MediaErrorState
            type="image"
            className="m-2"
            style={{ width: IMAGE_WIDTH - 16, minHeight: IMAGE_HEIGHT }}
            isInstagram={props.channelType === "instagram"}
          />
        )}
        {!loading && !hasError && imageUrl && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <div
                className="cursor-pointer"
                data-clickable="true"
                onClick={() => setOpen(true)}
              >
                <img
                  src={imageUrl}
                  alt="Imagem"
                  style={{
                    width: displayWidth,
                    height: clampedHeight,
                  }}
                  className="rounded-t-lg"
                />
                {props.message.caption && (
                  <div className="px-3 py-1.5">
                    <Typography
                      className="!text-slate-600"
                      variant="body2"
                    >
                      {props.message.caption}
                    </Typography>
                  </div>
                )}
              </div>
            </DialogTrigger>
            <DialogContent 
              className="max-w-[90vw] max-h-[90vh] p-4 flex items-center justify-center border-0 bg-transparent shadow-none"
              onPointerDown={(e) => {
                // Fecha ao clicar/tocar no fundo
                if (e.target === e.currentTarget) {
                  setOpen(false);
                }
              }}
            >
              <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
              <div className="relative">
                <MediaModalCloseButton onClick={() => setOpen(false)} />
                <img
                  src={imageUrl}
                  alt="Imagem ampliada"
                  style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
                  className="cursor-default"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MessageContainer>
  );
});
