"use client";

import { loadMessagesPaginated } from "@/app/actions/conversations";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import {
  Avatar,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { Message } from "@omnichannel/core/domain/entities/message";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useMemo, useRef } from "react";

export function ModalPreviewConversation() {
  const store = useChat();
  const conversationId = store.previewConversationId;
  const conversation = store.previewConversation;
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useServerActionQuery(loadMessagesPaginated, {
    input: { conversationId: conversationId ?? "", limit: 10 },
    queryKey: ["preview-messages", conversationId],
    enabled: !!conversationId,
  });

  const messages = useMemo(() => {
    if (!messagesQuery.data?.messages) return [];
    return messagesQuery.data.messages;
  }, [messagesQuery.data?.messages]);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClose = () => {
    store.setPreviewConversationId(null);
  };

  if (!conversationId) return null;

  return (
    <Dialog
      open={!!conversationId}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      closeAfterTransition={false}
    >
      <DialogTitle className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <Avatar src={conversation?.contact?.thumbnail ?? undefined}>
            {conversation?.contact?.acronym ?? "?"}
          </Avatar>
          <div>
            <Typography variant="subtitle1" className="font-medium">
              {conversation?.contact?.name ?? "Conversa"}
            </Typography>
            <Typography variant="caption" className="text-gray-500">
              Visualizacao da conversa
            </Typography>
          </div>
        </div>
        <IconButton onClick={handleClose} size="small">
          <i className="tabler-x !size-5" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="!p-0">
        <div ref={scrollRef} className="h-[400px] overflow-y-auto p-4 bg-white flex flex-col gap-2">
          {messagesQuery.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <CircularProgress size={32} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Nenhuma mensagem encontrada
            </div>
          ) : (
            messages.map((msg) => (
              <PreviewMessageBubble key={msg.id} message={msg} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewMessageBubble({ message }: { message: Message.Raw }) {
  const isFromContact = message.sender.type === "contact";
  const displayTime = format(new Date(message.createdAt), "HH:mm", { locale: ptBR });

  return (
    <div
      className={`flex ${isFromContact ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isFromContact
            ? "bg-gray-100 border shadow-sm"
            : "bg-blue-100 text-gray-900 border border-blue-200"
        }`}
      >
        {message.type === "text" && (
          <Typography variant="body2" className="whitespace-pre-wrap break-words">
            {message.content}
          </Typography>
        )}
        {message.type === "image" && (
          <div className="flex items-center gap-2">
            <i className="tabler-photo !size-4" />
            <Typography variant="body2">
              {message.caption ?? "Imagem"}
            </Typography>
          </div>
        )}
        {message.type === "audio" && (
          <div className="flex items-center gap-2">
            <i className="tabler-volume !size-4" />
            <Typography variant="body2">Audio</Typography>
          </div>
        )}
        {message.type === "document" && (
          <div className="flex items-center gap-2">
            <i className="tabler-file !size-4" />
            <Typography variant="body2">
              {message.filename ?? "Documento"}
            </Typography>
          </div>
        )}
        {message.type === "video" && (
          <div className="flex items-center gap-2">
            <i className="tabler-video !size-4" />
            <Typography variant="body2">Video</Typography>
          </div>
        )}
        {message.type === "sticker" && (
          <div className="flex items-center gap-2">
            <i className="tabler-sticker !size-4" />
            <Typography variant="body2">Sticker</Typography>
          </div>
        )}
        <Typography
          variant="caption"
          className={`block text-right mt-1 ${
            isFromContact ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {displayTime}
        </Typography>
      </div>
    </div>
  );
}
