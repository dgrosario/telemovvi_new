"use client";

import { listConversationMedia } from "@/app/actions/messages";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { CircularProgress, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";
import { MediaThumbnail } from "./media-thumbnail";

type MediaType = "image" | "video" | "document" | "audio";

type Props = {
  contactId: string;
  channelId: string;
};

const mediaTypeLabels: Record<MediaType, string> = {
  image: "Imagens",
  video: "Vídeos",
  document: "Documentos",
  audio: "Áudios",
};

export function MediaGallery({ contactId, channelId }: Props) {
  const [activeType, setActiveType] = useState<MediaType>("image");

  const mediaQuery = useServerActionQuery(listConversationMedia, {
    input: { contactId },
    enabled: Boolean(contactId),
    queryKey: ["contact-media", contactId],
  });

  const filteredMedia = mediaQuery.data?.filter((m) => m.type === activeType) ?? [];

  const handleTypeChange = (
    _: React.MouseEvent<HTMLElement>,
    newType: MediaType | null
  ) => {
    if (newType) {
      setActiveType(newType);
    }
  };

  if (mediaQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <CircularProgress size={32} />
      </div>
    );
  }

  const mediaCounts = {
    image: mediaQuery.data?.filter((m) => m.type === "image").length ?? 0,
    video: mediaQuery.data?.filter((m) => m.type === "video").length ?? 0,
    document: mediaQuery.data?.filter((m) => m.type === "document").length ?? 0,
    audio: mediaQuery.data?.filter((m) => m.type === "audio").length ?? 0,
  };

  return (
    <div className="flex flex-col gap-4">
      <ToggleButtonGroup
        value={activeType}
        exclusive
        onChange={handleTypeChange}
        size="small"
        className="flex-wrap"
      >
        {(Object.keys(mediaTypeLabels) as MediaType[]).map((type) => (
          <ToggleButton
            key={type}
            value={type}
            className="text-xs px-3"
          >
            {mediaTypeLabels[type]} ({mediaCounts[type]})
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {filteredMedia.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Nenhuma midia encontrada
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filteredMedia.map((media) => (
            <MediaThumbnail
              key={media.id}
              media={media}
              channelId={channelId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
