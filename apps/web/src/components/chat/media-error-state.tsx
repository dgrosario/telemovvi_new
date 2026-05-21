"use client";

import { AlertCircle, ImageOff, FileWarning, VideoOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaType = "image" | "audio" | "video" | "document" | "sticker";

interface MediaErrorStateProps {
  type: MediaType;
  className?: string;
  compact?: boolean;
  style?: React.CSSProperties;
  isInstagram?: boolean;
}

const iconMap: Record<MediaType, React.ElementType> = {
  image: ImageOff,
  audio: Volume2,
  video: VideoOff,
  document: FileWarning,
  sticker: ImageOff,
};

const labelMap: Record<MediaType, string> = {
  image: "Imagem indisponível",
  audio: "Áudio indisponível",
  video: "Vídeo indisponível",
  document: "Documento indisponível",
  sticker: "Sticker indisponível",
};

const instagramHint = "Acesse o Instagram no celular ou na web para visualizar";
const defaultHint = "A mídia não pode ser carregada";

export function MediaErrorState({ type, className, compact, style, isInstagram }: MediaErrorStateProps) {
  const Icon = iconMap[type] || AlertCircle;
  const label = labelMap[type] || "Mídia indisponível";
  const hint = isInstagram ? instagramHint : defaultHint;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground",
          className
        )}
        style={style}
      >
        <Icon className="size-4 shrink-0" />
        <span className="text-xs">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30",
        className
      )}
      style={style}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {hint}
        </p>
      </div>
    </div>
  );
}
