"use client";
import { sendMessage } from "@/app/actions/messages";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { canSendVoiceNote } from "@/lib/channel-capabilities";
import { getMessagePreviewText } from "@/lib/message-utils";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { getPayloadProperty } from "@omnichannel/core/domain/entities/channel";
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { Calculator, FolderOpen, Plus, Reply, X, MessageSquare, Zap, Send, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { toast } from "react-toastify";
import { FileButton, FileButtonRef } from "./file-button";
import {
  InstagramExpirationAlert,
  useInstagramExpiration,
} from "./instagram-expiration-alert";
import { PaymentCalculator } from "./payment-calculator";
import SlashTextarea, { SlashTextareaRef } from "./slash-text-area";
import { MobileQuickMessagesModal } from "./mobile-quick-messages-modal";
import { MobileFlowsModal } from "./mobile-flows-modal";

const VoiceRecorder = dynamic(
  () => import("./voice-recorder").then((Comp) => Comp.VoiceRecorder),
  { ssr: false }
);

type Props = {
  conversation?: Conversation.Raw;
  isInternalNote?: boolean;
  onInternalNoteChange?: (value: boolean) => void;
};

export const ChatForm = forwardRef<SlashTextareaRef, Props>(({ conversation, isInternalNote, onInternalNoteChange }, ref) => {
  const { conversationOpenedId, ...store } = useChat();
  const [inRecording, setInRecording] = useState(false);
  const [hasTextContent, setHasTextContent] = useState(false);
  const [attachMenuAnchor, setAttachMenuAnchor] = useState<HTMLElement | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [quickMessagesOpen, setQuickMessagesOpen] = useState(false);
  const [flowsOpen, setFlowsOpen] = useState(false);
  const { isExpired: isInstagramExpired, isFullyExpired: isInstagramFullyExpired, isHumanAgentWindow } = useInstagramExpiration(conversation);
  const fileButtonRef = useRef<FileButtonRef>(null);
  const slashTextareaRef = useRef<SlashTextareaRef>(null);
  const { hasPermission: canSendMessage } = usePermissionCheck(["send:message"]);

  useImperativeHandle(ref, () => ({
    setText: (text: string) => slashTextareaRef.current?.setText(text),
    focus: () => slashTextareaRef.current?.focus(),
    submit: () => slashTextareaRef.current?.submit(),
    get hasContent() { return slashTextareaRef.current?.hasContent ?? false; },
    get isSending() { return slashTextareaRef.current?.isSending ?? false; },
    get sendWithSignature() { return slashTextareaRef.current?.sendWithSignature ?? false; },
    setSendWithSignature: (value: boolean) => slashTextareaRef.current?.setSendWithSignature(value),
  }));

  const channelType = conversation?.channel?.type;
  const supportsVoiceNotes = canSendVoiceNote(channelType);
  const { hasPermission: canBypassAttendance } = usePermissionCheck([
    "bypass:attendance-to-send",
  ]);

  const sendMessageAction = useServerActionMutation(sendMessage, {
    onError(error) {
      toast.error(error.message);
    },
  });

  const handleOpenAttachMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAttachMenuAnchor(event.currentTarget);
  }, []);

  const handleCloseAttachMenu = useCallback(() => {
    setAttachMenuAnchor(null);
  }, []);

  const handleSelectAttachment = useCallback(() => {
    fileButtonRef.current?.selectFile();
    handleCloseAttachMenu();
  }, [handleCloseAttachMenu]);

  const handlePasteFile = useCallback((file: File, caption?: string) => {
    fileButtonRef.current?.openPreview(file, caption);
  }, []);

  const handleOpenCalculator = useCallback(() => {
    handleCloseAttachMenu();
    setCalculatorOpen(true);
  }, [handleCloseAttachMenu]);

  const handleOpenQuickMessages = useCallback(() => {
    handleCloseAttachMenu();
    setQuickMessagesOpen(true);
  }, [handleCloseAttachMenu]);

  const handleOpenFlows = useCallback(() => {
    handleCloseAttachMenu();
    setFlowsOpen(true);
  }, [handleCloseAttachMenu]);

  const handleQuickMessageSelect = useCallback((message: string, quickMessageId?: string) => {
    setQuickMessagesOpen(false);
    slashTextareaRef.current?.setText(message);
  }, []);

  const handleFlowExecuted = useCallback(() => {
    setFlowsOpen(false);
  }, []);

  const isInternal =
    conversation?.conversationType === "direct" ||
    conversation?.conversationType === "group";

  const isWhatsAppGroup = conversation?.conversationType === "whatsapp-group";

  const isCurrentUserAttendant =
    conversation?.attendant?.id === store?.user?.id;

  const disabled = useMemo(() => {
    if (!canSendMessage && !canBypassAttendance) {
      return true;
    }

    if (isInternal) {
      return false;
    }

    // Regras específicas por canal e status
    const channelType = conversation?.channel?.type;
    const status = conversation?.status;

    // WhatsApp Cloud expired: bloqueia (só template) - APENAS para API oficial
    if (status === "expired" && channelType === "whatsapp") {
      // Verifica se é API oficial (tem wabaId)
      const channel = conversation?.channel as any;
      const wabaId = channel?.payload ? getPayloadProperty(channel.payload, "wabaId") : null;
      const hasWabaId = !!wabaId;
      
      if (hasWabaId) {
        // É API oficial, bloqueia (precisa enviar template)
        return true;
      }
      // Não é API oficial (Evolution), permite enviar
      if (canBypassAttendance) {
        return false;
      }
      return !conversation?.attendant?.id || !isCurrentUserAttendant;
    }

    if (status === "expired" && channelType === "instagram") {
      return isInstagramFullyExpired;
    }

    // Evolution expired: PERMITE enviar mensagem normalmente
    if (status === "expired" && channelType === "evolution") {
      // Não bloqueia, permite enviar
      if (canBypassAttendance) {
        return false;
      }
      // Verifica se tem atendente
      return !conversation?.attendant?.id || !isCurrentUserAttendant;
    }

    // Closed: bloqueia para todos
    if (status === "closed") {
      return true;
    }

    if (canBypassAttendance) {
      return false;
    }

    if (isWhatsAppGroup) {
      return false;
    }

    return !conversation?.attendant?.id || !isCurrentUserAttendant;
  }, [
    canSendMessage,
    canBypassAttendance,
    isInternal,
    isWhatsAppGroup,
    conversation?.attendant?.id,
    conversation?.channel,
    conversation?.status,
    isCurrentUserAttendant,
    isInstagramFullyExpired,
  ]);

  const placeholderText = useMemo(() => {
    if (!canSendMessage) {
      return "Você não tem permissão para enviar mensagens";
    }
    if (isInstagramFullyExpired) {
      return "Janela de 7 dias expirada. Aguarde nova mensagem do contato.";
    }
    if (isHumanAgentWindow) {
      return "Janela padrão expirada. Mensagens serão enviadas com tag HUMAN_AGENT.";
    }
    return undefined;
  }, [canSendMessage, isInstagramFullyExpired, isHumanAgentWindow]);

  return (
    <div className="w-full relative">
      <InstagramExpirationAlert conversation={conversation} />

      <div className="flex items-end gap-2">
        {/* Botão + fora da caixa - esconde quando está gravando */}
        <FileButton
          ref={fileButtonRef}
          conversation={conversation}
          className="hidden"
          disabled={disabled}
        />

        <div className={`transition-all duration-300 ${inRecording ? 'opacity-0 -translate-x-4 pointer-events-none absolute' : 'opacity-100 translate-x-0'}`}>
          <IconButton
            size="small"
            onClick={handleOpenAttachMenu}
            className="hover:bg-gray-100 mb-2"
            disabled={disabled || inRecording}
          >
            <Plus className="size-5 text-gray-600" />
          </IconButton>
        </div>

        {/* Caixa branca com o textarea - esconde quando está gravando */}
        <div
          className={`shadow-md min-h-[44px] flex flex-col bg-[#FFFFFF] rounded-2xl p-2 relative flex-1 transition-all duration-300 ${
            inRecording ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
          }`}
        >
          {store.replyingTo && !isInternal && (
            <div className="flex items-center gap-1.5 md:gap-2 mx-1 md:mx-2 mb-2 px-2 md:px-3 py-1.5 md:py-2 bg-gray-100 rounded-xl border-l-4 border-primary w-full max-w-full">
              <Reply className="size-3.5 md:size-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                <span className="text-[10px] md:text-xs font-medium text-primary block truncate">
                  {store.replyingTo.sender?.name || "Contato"}
                </span>
                <div className="text-[10px] md:text-xs text-gray-600 break-words overflow-y-auto max-h-[3.6em] leading-tight">
                  {getMessagePreviewText(store.replyingTo)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => store.clearReply()}
                className="p-0.5 md:p-1 hover:bg-gray-200 rounded-full transition-colors shrink-0"
              >
                <X className="size-3.5 md:size-4 text-gray-500" />
              </button>
            </div>
          )}
          <SlashTextarea
            ref={slashTextareaRef}
            conversation={conversation}
            inRecording={inRecording}
            disabled={disabled}
            placeholder={placeholderText}
            onHasContentChange={setHasTextContent}
            onPasteFile={handlePasteFile}
            onOpenAttachMenu={handleOpenAttachMenu}
            isInternalNote={isInternalNote}
            onInternalNoteChange={onInternalNoteChange}
          />
        </div>

        {/* Botão de áudio/enviar fora da caixa */}
        {hasTextContent ? (
          <button
            type="button"
            onClick={() => slashTextareaRef.current?.submit()}
            className="rounded-full size-10 p-0 shrink-0 transition-all duration-200 flex items-center justify-center bg-primary hover:bg-primary/90 active:scale-95 mb-2"
            disabled={disabled || slashTextareaRef.current?.isSending}
            aria-label="Enviar mensagem"
          >
            {slashTextareaRef.current?.isSending ? (
              <Loader2 className="animate-spin size-5 text-white" />
            ) : (
              <Send className="size-5 text-white" />
            )}
          </button>
        ) : (
          <VoiceRecorder
            disabled={disabled || !supportsVoiceNotes}
            setStateRecording={setInRecording}
            conversation={conversation}
            hidden={hasTextContent}
            unsupportedMessage={
              !supportsVoiceNotes
                ? "Este canal não suporta mensagens de voz"
                : undefined
            }
          />
        )}
      </div>

      <Menu
        anchorEl={attachMenuAnchor}
        open={Boolean(attachMenuAnchor)}
        onClose={handleCloseAttachMenu}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        <MenuItem onClick={handleSelectAttachment}>
          <ListItemIcon>
            <FolderOpen className="size-5 text-blue-600" />
          </ListItemIcon>
          <ListItemText
            primary="Anexar arquivo"
            secondary="Imagem, vídeo, áudio ou documento"
          />
        </MenuItem>
        
        {/* Mobile: Adicionar Mensagens Rápidas e Fluxos como itens do menu */}
        {!isInternal && (
          <div className="md:hidden">
            <MenuItem 
              onClick={handleOpenQuickMessages}
            >
              <ListItemIcon>
                <MessageSquare className="size-5 text-blue-500" />
              </ListItemIcon>
              <ListItemText>Mensagens Rápidas</ListItemText>
            </MenuItem>
            <MenuItem 
              onClick={handleOpenFlows}
            >
              <ListItemIcon>
                <Zap className="size-5 text-purple-500" />
              </ListItemIcon>
              <ListItemText>Fluxos</ListItemText>
            </MenuItem>
          </div>
        )}
        
        <MenuItem onClick={handleOpenCalculator}>
          <ListItemIcon>
            <Calculator className="size-5 text-green-500" />
          </ListItemIcon>
          <ListItemText>Calculadora</ListItemText>
        </MenuItem>
      </Menu>

      <PaymentCalculator
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        conversation={conversation}
      />

      {/* Mobile Modals */}
      <MobileQuickMessagesModal
        open={quickMessagesOpen}
        onClose={() => setQuickMessagesOpen(false)}
        onSelect={handleQuickMessageSelect}
        conversationId={conversation?.id}
      />
      <MobileFlowsModal
        open={flowsOpen}
        onClose={() => setFlowsOpen(false)}
        conversationId={conversation?.id}
        disabled={disabled}
      />
    </div>
  );
});

ChatForm.displayName = "ChatForm";
