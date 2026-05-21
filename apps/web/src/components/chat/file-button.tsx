"use client";

import { sendMedia } from "@/app/actions/messages";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import {
  validateMessageForChannel,
  validateMimeTypeForChannel,
} from "@/lib/channel-capabilities";
import {
  Button,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { Attendant } from "@omnichannel/core/domain/entities/attendant";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Message } from "@omnichannel/core/domain/entities/message";
import { File as FileIcon, Loader, Send } from "lucide-react";
import {
  ChangeEvent,
  forwardRef,
  MouseEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import CustomTextField from "../custom-text-field";

const FILE_INPUT_DELAY_MS = 50;
const AUDIO_FILE_ACCEPT =
  ".aac,.amr,.m4a,.mp3,.ogg,.opus,.wav,audio/aac,audio/amr,audio/mp4,audio/mpeg,audio/ogg,audio/opus,audio/wav";

type Props = {
  conversation?: Conversation.Raw;
  className?: string;
  disabled?: boolean;
};

export interface FileButtonRef {
  openPreview: (file: File, caption?: string) => void;
  selectImage: () => void;
  selectFile: () => void;
  selectCamera: () => void;
  selectAudio: () => void;
  /**
   * Opens the video file selector dialog
   */
  selectVideo: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FileButton = forwardRef<FileButtonRef, Props>((props, ref) => {
  const store = useChat();
  const [openPreview, setOpenPreview] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState<string>("");
  const [fileType, setFileType] = useState<
    "image" | "document" | "video" | "audio"
  >("image");
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [pdfThumbnail, setPdfThumbnail] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Gerar thumbnail para PDFs
  async function generatePdfThumbnail(pdfFile: File) {
    try {
      const pdfjsLib = await import("pdfjs-dist");

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }

      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const desiredWidth = 300;
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

      canvas.toBlob(
        (blob) => {
          if (blob) {
            setPdfThumbnail(URL.createObjectURL(blob));
          }
        },
        "image/jpeg",
        0.85,
      );
    } catch (error) {
      console.error("[FileButton] PDF thumbnail error:", error);
    }
  }

  useImperativeHandle(ref, () => ({
    openPreview: (pastedFile: File, captionText?: string) => {
      let pastedFileType: "image" | "document" | "video" | "audio" = "document";

      if (pastedFile.type.startsWith("image/")) {
        pastedFileType = "image";
      } else if (pastedFile.type.startsWith("video/")) {
        pastedFileType = "video";
      } else if (pastedFile.type.startsWith("audio/")) {
        pastedFileType = "audio";
      }

      const channelType = props.conversation?.channel?.type;

      const validationError = validateMessageForChannel(
        channelType,
        pastedFileType,
        pastedFile.size,
      );

      if (validationError) {
        toast.error(validationError.message);
        return;
      }

      const mimeValidation = validateMimeTypeForChannel(
        channelType,
        pastedFileType,
        pastedFile.type,
      );
      if (mimeValidation) {
        toast.error(mimeValidation.message);
        return;
      }

      setFile(pastedFile);
      setFileType(pastedFileType);
      setCaption(captionText ?? "");
      setOpenPreview(true);

      // Gerar thumbnail se for PDF
      if (pastedFile.type === "application/pdf") {
        generatePdfThumbnail(pastedFile);
      }
    },
    selectImage: () => {
      setFileType("image");
      setTimeout(() => {
        imageInputRef.current?.click();
      }, FILE_INPUT_DELAY_MS);
    },
    selectCamera: () => {
      setFileType("image");
      setTimeout(() => {
        cameraInputRef.current?.click();
      }, FILE_INPUT_DELAY_MS);
    },
    selectFile: () => {
      setFileType("document");
      setTimeout(() => {
        documentInputRef.current?.click();
      }, FILE_INPUT_DELAY_MS);
    },
    selectAudio: () => {
      setFileType("audio");
      setTimeout(() => {
        audioInputRef.current?.click();
      }, FILE_INPUT_DELAY_MS);
    },
    selectVideo: () => {
      setFileType("video");
      setTimeout(() => {
        videoInputRef.current?.click();
      }, FILE_INPUT_DELAY_MS);
    },
  }));
  const sendDocumentAction = useServerActionMutation(sendMedia, {
    onError(error) {
      toast.error(error.message);
      if (pendingMessageId) {
        store.markMessageAsError(pendingMessageId);
      }
    },
    onSuccess() {
      setOpenPreview(false);
    },
  });

  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : "/logo.png"),
    [file],
  );

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (file && preview && preview !== "/logo.png") {
        URL.revokeObjectURL(preview);
      }
    };
  }, [file, preview]);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    if (!openPreview) {
      onClear();
    }
  }, [openPreview]);

  const onClear = () => {
    setFile(null);
    setCaption("");
    setFileType("image");
    if (pdfThumbnail) {
      URL.revokeObjectURL(pdfThumbnail);
      setPdfThumbnail(null);
    }
  };

  const handlePrepareFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    if (file.type.startsWith("image/")) {
      setFileType("image");
    } else if (file.type.startsWith("video/")) {
      setFileType("video");
    } else if (file.type.startsWith("audio/")) {
      setFileType("audio");
    } else {
      setFileType("document");
    }
    setOpenPreview(true);

    // Gerar thumbnail se for PDF
    if (file.type === "application/pdf") {
      generatePdfThumbnail(file);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    const channelType = props.conversation?.channel?.type;
    const validationError = validateMessageForChannel(
      channelType,
      fileType,
      file.size,
    );

    if (validationError) {
      toast.error(validationError.message);
      setOpenPreview(false);
      return;
    }

    const mimeValidation = validateMimeTypeForChannel(
      channelType,
      fileType,
      file.type,
    );
    if (mimeValidation) {
      toast.error(mimeValidation.message);
      setOpenPreview(false);
      return;
    }

    const url = URL.createObjectURL(file);
    const messageId = crypto.randomUUID().toString();

    const message = Message.create({
      content: url,
      caption: caption || null,
      createdAt: new Date(),
      id: messageId,
      sender: Attendant.create({
        id: store.user?.id!,
        name: store.user?.name!,
      }),
      type: fileType,
      filename: file.name,
      mimetype: file.type,
    });

    store.addMessage(message);
    setPendingMessageId(messageId);

    sendDocumentAction.mutate({
      file,
      conversationId: store.conversationOpenedId ?? "",
      channelId: props?.conversation?.channel?.id ?? "",
      type: fileType,
      caption,
      correlationId: messageId,
    });
  };

  return (
    <>
      <Drawer
        anchor="bottom"
        open={openPreview}
        onClose={() => setOpenPreview(false)}
        classes={{
          paper: "!bg-black/40 !h-screen",
        }}
      >
        <div className="w-full h-full flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] rounded-2xl bg-muted flex-col flex overflow-hidden relative shadow-2xl">
            <Button
              className="!absolute !top-4 !left-4 !z-10"
              classes={{
                root: "!rounded-full !bg-white/90 hover:!bg-white",
              }}
              onClick={() => {
                setOpenPreview(false);
                onClear();
              }}
            >
              <i className="tabler-x" />
            </Button>

            {/* Área de preview - tamanho dinâmico */}
            <div className="w-full flex items-center justify-center bg-gray-100 p-4">
              {fileType === "image" ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-[150px] h-[200px] object-cover rounded-lg"
                  />
                  {file?.name && (
                    <span className="text-xs text-gray-600 text-center break-all max-w-[200px]">
                      {file.name}
                    </span>
                  )}
                </div>
              ) : fileType === "video" ? (
                <div className="flex flex-col items-center gap-2">
                  <video
                    src={preview}
                    controls
                    preload="metadata"
                    className="max-w-[300px] max-h-[300px] rounded-lg"
                    aria-label="Preview do vídeo"
                  />
                  {file?.name && (
                    <span className="text-xs text-gray-600 text-center break-all max-w-[200px]">
                      {file.name}
                    </span>
                  )}
                </div>
              ) : fileType === "audio" ? (
                <div className="flex flex-col items-center justify-center gap-3 py-4">
                  <audio
                    src={preview}
                    controls
                    className="w-full max-w-[300px]"
                  />
                  <div className="flex flex-col items-center">
                    <span className="font-medium text-center break-all px-4 text-sm">
                      {file?.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatFileSize(file?.size || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-4">
                  {pdfThumbnail ? (
                    <img
                      src={pdfThumbnail}
                      alt="Preview PDF"
                      className="max-w-[200px] max-h-[150px] object-contain rounded-lg shadow-md"
                    />
                  ) : (
                    <FileIcon className="size-12 text-gray-400" />
                  )}
                  <div className="flex flex-col items-center">
                    <span className="font-medium text-center break-all px-4 text-sm">
                      {file?.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatFileSize(file?.size || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Área de legenda e envio - compacta */}
            <div className="w-full flex items-center gap-3 p-4 bg-white">
              <CustomTextField
                className="flex-1 !rounded-full bg-gray-50"
                slotProps={{
                  input: {
                    className: "!rounded-full",
                  },
                }}
                classes={{
                  root: "!rounded-full",
                }}
                placeholder="Adicione uma legenda"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={sendDocumentAction.isPending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUpload();
                  }
                }}
              />
              <Button
                onClick={handleUpload}
                className="disabled:opacity-50"
                classes={{
                  root: "!rounded-full !min-w-[48px] !w-[48px] !h-[48px] !p-0",
                }}
                disabled={sendDocumentAction.isPending}
                loading={sendDocumentAction.isPending}
                loadingIndicator={<Loader className="animate-spin size-6" />}
              >
                <Send
                  data-hidden={sendDocumentAction.isPending}
                  className="rotate-45 -translate-x-0.5 size-5"
                />
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={handlePrepareFile}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePrepareFile}
      />
      <input
        type="file"
        ref={documentInputRef}
        accept="*/*"
        className="hidden"
        onChange={handlePrepareFile}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept={AUDIO_FILE_ACCEPT}
        className="hidden"
        onChange={handlePrepareFile}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        className="hidden"
        onChange={handlePrepareFile}
      />

      {props.className !== "hidden" && (
        <>
          <IconButton
            aria-label="more"
            aria-controls="long-menu"
            aria-haspopup="true"
            onClick={handleClick}
            className={props.className}
            disabled={props.disabled}
          >
            <i className="tabler-plus size-4 group-data-[state=open]:duration-300 duration-300 group-data-[state=open]:-rotate-45 stroke-1" />
          </IconButton>
          <Menu
            keepMounted
            anchorPosition={{
              left: anchorEl?.getClientRects().item(0)?.left!,
              top: anchorEl?.getClientRects().item(0)?.top! - 100,
            }}
            anchorReference="anchorPosition"
            id="long-menu"
            anchorEl={anchorEl}
            onClose={handleClose}
            open={Boolean(anchorEl)}
            slotProps={{ paper: { style: { maxHeight: 48 * 4.5 } } }}
          >
            <MenuItem
              onClick={() => {
                handleClose();
                setFileType("document");
                setTimeout(() => {
                  documentInputRef.current?.click();
                }, 200);
              }}
            >
              <i className="tabler-folder-check !size-6" />
              <Typography variant="button" className="text-sm">
                Arquivos
              </Typography>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleClose();
                setFileType("image");
                setTimeout(() => {
                  imageInputRef.current?.click();
                }, 200);
              }}
            >
              <i className="tabler-photo-check !size-6 text-orange-500" />
              <Typography variant="button" className="text-sm">
                Imagens
              </Typography>
            </MenuItem>
          </Menu>
        </>
      )}
    </>
  );
});
