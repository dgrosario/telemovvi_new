"use client";

import type { Message } from "@omnichannel/core/domain/entities/message";
import type { Channel } from "@omnichannel/core/domain/entities/channel";
import { TextBubble } from "./text-bubble";
import { AudioBubble } from "./audio-bubble";
import { ImageBubble } from "./image-bubble";
import { VideoBubble } from "./video-bubble";
import { FileBubble } from "./file-bubble";
import { StickerBubble } from "./sticker-bubble";
import { LocationBubble } from "./location-bubble";

type Props = {
  message: Message.Raw;
  channelId?: string;
  channelType?: Channel.Type;
  channelName?: string;
};

export function HistoryBubbleRenderer({ message, channelId, channelType, channelName }: Props) {
  const commonProps = {
    message,
    channel: channelId ?? "",
    hiddenAvatar: true,
    channelType,
    channelName,
  };

  switch (message.type) {
    case "audio":
      return <AudioBubble {...commonProps} />;
    case "image":
      return <ImageBubble {...commonProps} />;
    case "video":
      return <VideoBubble {...commonProps} />;
    case "document":
      return <FileBubble {...commonProps} />;
    case "sticker":
      return <StickerBubble {...commonProps} />;
    case "location":
      return <LocationBubble {...commonProps} />;
    default:
      return <TextBubble {...commonProps} />;
  }
}
