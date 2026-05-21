"use client";
import {
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
} from "lucide-react";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { MessageContainer } from "./message-container";
import { QuotedMessagePreview } from "./quoted-message-preview";
import { MediaErrorState } from "./media-error-state";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { cn } from "@/lib/utils";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { canDownloadDocumentInChat } from "@/lib/chat-download-permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Typography } from "@mui/material";

type MessageWithError = Message.Raw & { error?: boolean };

type Props = {
  message: MessageWithError;
  channel: string;
  hiddenAvatar: boolean;
  channelType?: Channel.Type;
  channelName?: string;
  isWhatsAppGroup?: boolean;
  currentUserId?: string;
  conversationAttendantId?: string | null;
  conversationType?: Conversation.Type;
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

// Mapa de extensões por mimetype
const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/x-rar-compressed": "rar",
  "application/x-7z-compressed": "7z",
};

// Ícones por extensão
const EXT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  zip: FileArchive,
  rar: FileArchive,
  "7z": FileArchive,
  js: FileCode,
  ts: FileCode,
  mp3: FileAudio,
  wav: FileAudio,
  mp4: FileVideo,
  mov: FileVideo,
};

// Cores por extensão
const EXT_COLORS: Record<string, { text: string; bg: string }> = {
  pdf: { text: "text-red-600", bg: "bg-red-50" },
  doc: { text: "text-blue-600", bg: "bg-blue-50" },
  docx: { text: "text-blue-600", bg: "bg-blue-50" },
  xls: { text: "text-green-600", bg: "bg-green-50" },
  xlsx: { text: "text-green-600", bg: "bg-green-50" },
  csv: { text: "text-green-600", bg: "bg-green-50" },
  txt: { text: "text-gray-600", bg: "bg-gray-100" },
  zip: { text: "text-amber-600", bg: "bg-amber-50" },
  rar: { text: "text-amber-600", bg: "bg-amber-50" },
  "7z": { text: "text-amber-600", bg: "bg-amber-50" },
};

function getExtension(filename: string | null, mimetype: string | null): string {
  // Primeiro tenta pelo filename
  if (filename) {
    const parts = filename.split(".");
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
  }
  // Fallback para mimetype
  if (mimetype && MIME_TO_EXT[mimetype]) {
    return MIME_TO_EXT[mimetype];
  }
  return "file";
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export const FileBubble: React.FC<Props> = memo(function FileBubble(props) {
  if (props.message?.type !== "document") return <></>;
  const { hasPermission: hasBypassAttendance } = usePermissionCheck([
    "bypass:attendance-to-send",
  ]);
  const canDownloadAttachment = canDownloadDocumentInChat({
    hasBypassAttendance,
    conversationType: props.conversationType,
    conversationAttendantId: props.conversationAttendantId ?? null,
    currentUserId: props.currentUserId ?? null,
  });
  const isDownloadBlocked = !canDownloadAttachment;

  const [fileData, setFileData] = useState<{
    url: string;
    size: number;
    name: string;
    mimetype: string;
  } | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const thumbnailBlobRef = useRef<string | null>(null);

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
      { rootMargin: "200px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Carregar arquivo quando visível
  useEffect(() => {
    if (!isVisible || !props.channel) return;
    if (isDownloadBlocked) {
      setLoading(false);
      setHasError(false);
      return;
    }

    async function loadFile() {
      try {
        const response = await fetch(
          `/api/message/${props.message.id}/media?channelId=${props.channel}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("Content-Type") || props.message.mimetype || "application/octet-stream";
        const contentFilename = response.headers.get("Content-Filename")?.split(";")[0];
        
        const blob = new Blob([buffer], { type: contentType });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;

        const fileInfo = {
          url,
          size: buffer.byteLength,
          name: contentFilename || props.message.filename || "documento",
          mimetype: contentType,
        };
        
        setFileData(fileInfo);

        // Gerar thumbnail para PDFs (usando fallbacks para Content-Type incorreto)
        const isPdf = contentType === "application/pdf" ||
                      props.message.mimetype === "application/pdf" ||
                      (fileInfo.name && fileInfo.name.toLowerCase().endsWith('.pdf'));
        if (isPdf) {
          generatePdfThumbnail(buffer);
        }

        setLoading(false);
      } catch (error) {
        console.error("[FileBubble] Error:", error);
        setLoading(false);
        setHasError(true);
      }
    }

    loadFile();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (thumbnailBlobRef.current) {
        URL.revokeObjectURL(thumbnailBlobRef.current);
        thumbnailBlobRef.current = null;
      }
    };
  }, [isVisible, isDownloadBlocked, props.channel, props.message.id, props.message.filename, props.message.mimetype]);

  // Função para gerar thumbnail do PDF
  async function generatePdfThumbnail(pdfBuffer: ArrayBuffer) {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      
      // Configurar worker usando unpkg CDN (mais confiável)
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }
      
      const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      // Escala para gerar thumbnail de ~200px de largura
      const desiredWidth = 260;
      const viewport = page.getViewport({ scale: 1 });
      const scale = desiredWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      } as any).promise;

      // Converter canvas para blob URL
      canvas.toBlob((blob) => {
        if (blob) {
          const thumbUrl = URL.createObjectURL(blob);
          thumbnailBlobRef.current = thumbUrl;
          setThumbnailUrl(thumbUrl);
        }
      }, "image/jpeg", 0.85);
    } catch (error) {
      console.error("[FileBubble] PDF thumbnail error:", error);
      // Não é crítico, continua sem thumbnail
    }
  }

  // Dados derivados
  const ext = useMemo(() => {
    return getExtension(fileData?.name || props.message.filename, fileData?.mimetype || props.message.mimetype);
  }, [fileData, props.message.filename, props.message.mimetype]);

  const Icon = EXT_ICONS[ext] || FileType;
  const colors = EXT_COLORS[ext] || { text: "text-gray-600", bg: "bg-gray-100" };
  const displayName = fileData?.name || props.message.filename || "Documento";
  const displaySize = formatFileSize(fileData?.size || 0);

  const handleClick = () => {
    if (isDownloadBlocked) return;
    if (!fileData?.url) return;
    
    // Tipos que o navegador consegue exibir nativamente
    const viewableInBrowser = ["pdf", "txt", "png", "jpg", "jpeg", "gif", "svg"];
    
    if (viewableInBrowser.includes(ext)) {
      // Abrir direto no navegador
      window.open(fileData.url, "_blank");
    } else {
      // Para outros tipos (docx, xlsx, zip, rar, etc), forçar download
      const link = document.createElement("a");
      link.href = fileData.url;
      link.download = displayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <MessageContainer
      senderId={props.message.sender.id}
      createdAt={props.message.createdAt}
      senderType={props.message.sender?.type}
      status={props.message.status}
      error={props.message.error}
      internal={props.message.internal}
      hiddenAvatar={props.hiddenAvatar}
      senderName={props.message.sender.name}
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
        className="group flex w-full max-w-[260px] px-2 pb-1 pt-3 flex-col items-start"
      >
        {loading && (
          <Skeleton className="w-full h-[56px] rounded-lg" />
        )}
        
        {!loading && hasError && (
          <MediaErrorState type="document" compact isInstagram={props.channelType === "instagram"} />
        )}
        
        {!loading && !hasError && (fileData || isDownloadBlocked) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleClick}
                data-clickable={!isDownloadBlocked}
                aria-disabled={isDownloadBlocked}
                className={cn(
                  "w-full bg-white transition-colors flex flex-col overflow-hidden rounded-xl border border-gray-200 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  isDownloadBlocked
                    ? "cursor-not-allowed hover:bg-white active:bg-white"
                    : "hover:bg-gray-50 active:bg-gray-100"
                )}
              >
                {/* Preview da primeira página (para PDFs) */}
                {thumbnailUrl && (
                  <div className="w-full h-[90px] bg-gray-100 relative overflow-hidden border-b border-gray-200">
                    <img
                      src={thumbnailUrl}
                      alt="Preview"
                      className={cn(
                        "w-full h-full object-cover object-top",
                        isDownloadBlocked && "opacity-90"
                      )}
                    />
                  </div>
                )}
                
                {/* Info do arquivo */}
                <div className="flex items-center gap-2.5 p-2.5 w-full">
                  {/* Ícone com fundo colorido */}
                  <div className={cn("rounded-lg p-1.5 flex-shrink-0", colors.bg)}>
                    <Icon className={cn("size-5", colors.text)} strokeWidth={1.5} />
                  </div>
                  
                  {/* Detalhes */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      {displaySize && <span>{displaySize}</span>}
                      {displaySize && <span>•</span>}
                      <span className="lowercase">{ext}</span>
                    </p>
                  </div>
                </div>
              </button>
            </TooltipTrigger>
            {isDownloadBlocked && (
              <TooltipContent side="top" sideOffset={6}>
                Assuma o atendimento para baixar este anexo.
              </TooltipContent>
            )}
          </Tooltip>
        )}
        
        {props.message.caption && (
          <div className="px-1 pt-1.5">
            <Typography className="text-xs text-gray-600">
              {props.message.caption}
            </Typography>
          </div>
        )}
      </div>

    </MessageContainer>
  );
});
