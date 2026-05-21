"use client";
import { useMediaCache } from "@/hooks/use-media-cache";
import { cn } from "@/lib/utils";
import { CircularProgress, Typography } from "@mui/material";
import { Play } from "lucide-react";
import { Message } from "@omnichannel/core/domain/entities/message";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
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

export const VideoBubble: React.FC<Props> = memo(function VideoBubble(props) {
  if (props.message?.type !== "video") return <></>;

  const { getMedia } = useMediaCache();
  const videoRef = useRef<HTMLVideoElement>(null);
  const oversizedBlobUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const generateThumbnail = useCallback((video: HTMLVideoElement): Promise<string | null> => {
    return new Promise((resolve) => {
      const handleSeeked = async () => {
        await new Promise(r => setTimeout(r, 100));

        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 300;
          canvas.height = video.videoHeight || 200;
          const ctx = canvas.getContext('2d');
          if (ctx && video.videoWidth > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('[VideoBubble] Error generating thumbnail:', error);
          resolve(null);
        }
        video.removeEventListener('seeked', handleSeeked);
      };

      video.addEventListener('seeked', handleSeeked);
      video.currentTime = 0.001;
    });
  }, []);

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
    const video = videoRef.current;
    if (!video || !videoUrl || posterUrl) return;

    const handleLoadedMetadata = async () => {
      if (!posterUrl) {
        const thumbnail = await generateThumbnail(video);
        if (thumbnail) {
          setPosterUrl(thumbnail);
        }
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoUrl, posterUrl, generateThumbnail]);

  useEffect(() => {
    let isCancelled = false;

    async function loadVideo() {
      if (!props.channel) return;

      try {
        if (props.message.content.includes("blob:")) {
          if (isCancelled) return;
          setVideoUrl(props.message.content);
          setLoading(false);
          return;
        }

        const result = await getMedia(props.message.id, props.channel);

        if (isCancelled) return;

        if (!result) {
          setLoading(false);
          setHasError(true);
          return;
        }

        if (result.isOversized) {
          oversizedBlobUrlRef.current = result.blobUrl;
        }

        setVideoUrl(result.blobUrl);
        setLoading(false);
      } catch (error) {
        console.error("[VideoBubble] Error loading video:", props.message.id, error);
        if (isCancelled) return;
        setLoading(false);
        setHasError(true);
      }
    }

    if (isVisible) {
      loadVideo();
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
      className="overflow-hidden !max-w-[500px]"
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
        className="group w-full min-w-[300px] flex-1 flex flex-col items-start gap-3"
      >
        {loading && (
          <div
            className="flex justify-center items-center"
            style={{ minWidth: 300, minHeight: 200 }}
          >
            <CircularProgress />
          </div>
        )}
        {!loading && hasError && (
          <MediaErrorState
            type="video"
            className="m-2"
            style={{ minHeight: 200 }}
            isInstagram={props.channelType === "instagram"}
          />
        )}
        {!loading && !hasError && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="flex flex-col w-full relative items-start !flex-1" data-clickable="true">
            <div
              onClick={() => setOpen(true)}
              data-clickable="true"
              className={cn(
                "h-full w-full flex-1 !cursor-pointer left-0 top-0",
                !props.message.caption && "!min-h-[200px]"
              )}
            >
              {!loading && (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={posterUrl || undefined}
                    className="w-full h-full max-h-[300px] rounded-lg object-contain bg-black"
                    controls={false}
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/50 rounded-full p-3 group-hover:bg-black/70 transition-colors">
                      <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {props.message.caption && (
              <div className="w-full min-h-[2px] px-3 pt-3 bottom-0 !left-0 !flex !justify-start !items-center">
                <Typography
                  className="text-white !text-slate-600 !z-50"
                  variant="body1"
                >
                  {props.message.caption}
                </Typography>
              </div>
            )}
          </DialogTrigger>
          <DialogContent
            className="h-[90vh] w-[90vw] max-w-none max-h-none border-0 bg-black/95 shadow-none p-0 overflow-hidden"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setOpen(false);
              }
            }}
          >
            <DialogTitle className="sr-only">Visualizar vídeo</DialogTitle>
            <div className="relative h-full w-full flex items-center justify-center">
              <MediaModalCloseButton onClick={() => setOpen(false)} />
              <video
                src={videoUrl}
                className="h-full w-full object-contain"
                controls
                autoPlay
                playsInline
              />
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>
    </MessageContainer>
  );
});
