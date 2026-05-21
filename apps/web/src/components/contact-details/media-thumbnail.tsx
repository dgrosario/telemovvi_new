"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@mui/material";
import { useEffect, useState } from "react";

type MediaItem = {
  id: string;
  type: "image" | "video" | "document" | "audio";
  content: string;
  filename: string | null;
  mimetype: string | null;
  caption: string | null;
  createdAt: Date;
  conversationId: string | null;
  channelId: string | null;
};

type Props = {
  media: MediaItem;
  channelId: string;
};

function getFileIcon(mimetype: string | null): string {
  if (!mimetype) return "tabler-file";
  if (mimetype.includes("pdf")) return "tabler-file-type-pdf";
  if (mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype.includes("csv"))
    return "tabler-file-spreadsheet";
  if (mimetype.includes("zip") || mimetype.includes("rar") || mimetype.includes("tar"))
    return "tabler-file-zip";
  if (mimetype.includes("word") || mimetype.includes("document"))
    return "tabler-file-type-doc";
  return "tabler-file";
}

function getFileExtension(filename: string | null): string {
  if (!filename) return "FILE";
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
}

function getIconColor(mimetype: string | null): string {
  if (!mimetype) return "text-gray-600";
  if (mimetype.includes("pdf")) return "text-red-500";
  if (mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype.includes("csv"))
    return "text-green-600";
  if (mimetype.includes("word") || mimetype.includes("document"))
    return "text-blue-500";
  if (mimetype.includes("zip") || mimetype.includes("rar") || mimetype.includes("tar"))
    return "text-yellow-600";
  return "text-gray-600";
}

export function MediaThumbnail({ media, channelId }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchMedia = async () => {
      if (media.type === "document") {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/message/${media.id}/media?channelId=${channelId}`
        );
        if (!response.ok) throw new Error("Failed to fetch media");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMedia();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [media.id, media.type, channelId]);

  const handleClick = () => {
    if (media.type === "document") {
      handleDownload();
    } else {
      setIsOpen(true);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/message/${media.id}/media?channelId=${channelId}`
      );
      if (!response.ok) throw new Error("Failed to download");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = media.filename ?? "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      console.error("Download failed");
    }
  };

  if (isLoading) {
    return <Skeleton variant="rectangular" className="aspect-square rounded" />;
  }

  if (error) {
    return (
      <div className="aspect-square rounded bg-gray-100 flex items-center justify-center">
        <i className="tabler-photo-off size-6 text-gray-400" />
      </div>
    );
  }

  if (media.type === "image") {
    return (
      <>
        <button
          onClick={handleClick}
          className="aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {blobUrl && (
            <img
              src={blobUrl}
              alt={media.filename ?? ""}
              className="w-full h-full object-cover"
            />
          )}
        </button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
            {blobUrl && (
              <img
                src={blobUrl}
                alt={media.filename ?? ""}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (media.type === "video") {
    return (
      <>
        <button
          onClick={handleClick}
          className="aspect-square rounded overflow-hidden bg-gray-900 cursor-pointer hover:opacity-80 transition-opacity relative flex items-center justify-center"
        >
          <i className="tabler-player-play-filled size-8 text-white" />
        </button>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogTitle className="sr-only">Visualizar video</DialogTitle>
            {blobUrl && (
              <video
                src={blobUrl}
                controls
                className="w-full h-auto max-h-[80vh]"
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (media.type === "audio") {
    return (
      <div className="aspect-square rounded bg-gray-100 flex flex-col items-center justify-center p-2 gap-1">
        <i className="tabler-music size-6 text-gray-600" />
        {blobUrl && (
          <audio src={blobUrl} controls className="w-full h-8" />
        )}
      </div>
    );
  }

  if (media.type === "document") {
    const fileExt = getFileExtension(media.filename);
    const iconColor = getIconColor(media.mimetype);
    
    return (
      <button
        onClick={handleClick}
        className="aspect-square rounded bg-gray-50 border border-gray-200 flex flex-col items-center justify-center p-2 gap-1.5 cursor-pointer hover:bg-gray-100 transition-colors relative"
      >
        <i className={`${getFileIcon(media.mimetype)} size-10 ${iconColor}`} />
        <div className="absolute top-1 right-1 bg-white rounded px-1.5 py-0.5 shadow-sm border border-gray-200">
          <span className="text-[9px] font-semibold text-gray-700">
            {fileExt}
          </span>
        </div>
        <span className="text-[10px] text-gray-700 font-medium truncate w-full text-center px-1">
          {media.filename ?? "Documento"}
        </span>
      </button>
    );
  }

  return null;
}
