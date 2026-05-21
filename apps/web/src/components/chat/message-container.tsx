"use client";
import { cn } from "@/lib/utils";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Sender } from "@omnichannel/core/domain/entities/sender";
import { format } from "date-fns";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCheckIcon,
  Clock7,
  Instagram,
  MessageSquare,
  Star,
  Reply,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import React, { useState, useRef, useEffect } from "react";
import { MessageActions } from "./message-actions";
import { MessageReactions } from "./message-reactions";
import { ReactionEmojiButton } from "./reaction-emoji-button";

type IconComponent = React.ComponentType<{
  size?: number;
  style?: React.CSSProperties;
  className?: string;
  "aria-label"?: string;
}>;

const WhatsAppIcon: IconComponent = ({
  size = 14,
  style,
  className,
  ...props
}) => (
  <i
    className={cn("tabler-brand-whatsapp", className)}
    style={{ fontSize: size, ...style }}
    {...props}
  />
);

const EvolutionIcon: IconComponent = ({
  size = 14,
  style,
  className,
  ...props
}) => (
  <i
    className={cn("tabler-message-circle-filled", className)}
    style={{ fontSize: size, ...style }}
    {...props}
  />
);

const CHANNEL_CONFIG: Record<
  string,
  { icon: IconComponent; color: string; label: string }
> = {
  whatsapp: { icon: WhatsAppIcon, color: "#25D366", label: "WhatsApp" },
  instagram: { icon: Instagram, color: "#E4405F", label: "Instagram" },
  evolution: { icon: EvolutionIcon, color: "#10B981", label: "Evolution" },
  default: { icon: MessageSquare, color: "#6B7280", label: "Canal" },
};

type Props = React.PropsWithChildren & {
  senderType: Sender.Type;
  senderName: string;
  senderId: string;
  currentUserId?: string;
  hiddenAvatar?: boolean;
  createdAt: Date;
  status: Message.Status;
  error?: boolean;
  internal?: boolean;
  messageType?: string;
  className?: string;
  style?: any;
  ref?: any;
  channelType?: Channel.Type;
  channelName?: string;
  isWhatsAppGroup?: boolean;
  conversationType?: string;
  conversationStatus?: string | null;
  isAdmin?: boolean;
  messageId?: string;
  messageContent?: string;
  caption?: string | null;
  filename?: string | null;
  mediaKey?: string | null;
  deletedAt?: Date | null;
  editedAt?: Date | null;
  originalContent?: string | null;
  onDelete?: () => void;
  onEdit?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onDownload?: (mediaKey: string) => void;
  onViewHistory?: () => void;
  isDeleting?: boolean;
  isEditing?: boolean;
  isHistoryExpanded?: boolean;
  isStarred?: boolean;
  onToggleStar?: () => void;
  isTogglingStarred?: boolean;
  reactions?: Message.Reaction[];
  onToggleReaction?: (emoji: string) => void;
};

function formatMessageTimestamp(date: Date): string {
  return format(date, "dd/MM/yy HH:mm");
}

export const MessageContainer: React.FC<Props> = (props) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const clickCount = useRef(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  
  const channelConfig =
    (props.channelType && CHANNEL_CONFIG[props.channelType]) ||
    CHANNEL_CONFIG.default;
  const ChannelIcon = channelConfig.icon;

  const isOwnMessage = props.internal
    ? props.senderId === props.currentUserId
    : props.senderType === "attendant";

  // Admin pode excluir mensagens em conversas pendentes ou abertas
  const canDeleteAsAdmin = 
    props.isAdmin && 
    !!props.messageId && 
    !!props.onDelete &&
    (props.conversationStatus === "pending" || props.conversationStatus === "open");

  // Usuário normal só pode excluir suas próprias mensagens
  const canDeleteOwn = isOwnMessage && !!props.messageId && !!props.onDelete;

  const isEvolutionChannel = props.channelType === "evolution";

  // Editar/apagar mensagens: permitido apenas em canais Evolution
  const canDelete = isEvolutionChannel && (canDeleteAsAdmin || canDeleteOwn);

  const canEdit =
    isEvolutionChannel &&
    props.senderType === "attendant" &&
    props.senderId !== "flow-executor" &&
    props.senderName !== "Dispositivo" &&
    !!props.messageId &&
    !!props.onEdit &&
    props.messageType === "text" &&
    !props.deletedAt;
  
  // Responder: permitido para Evolution, WhatsApp (Baileys/QR Code) e API Oficial (meta_api)
  // NÃO permitido para Instagram
  const canReply =
    !!props.messageId &&
    !!props.onReply &&
    (props.channelType === "evolution" || props.channelType === "whatsapp" || props.channelType === "meta_api") &&
    !props.internal;
  
  const isDeleted = !!props.deletedAt;
  const isEdited = !!props.editedAt;

  const hasActions =
    canDelete ||
    canEdit ||
    canReply ||
    props.onToggleStar ||
    props.onToggleReaction;

  const isInteractiveTouchTarget = (target: HTMLElement): boolean => {
    if (target.isContentEditable) return true;

    if (
      target.tagName === "IMG" ||
      target.tagName === "VIDEO" ||
      target.tagName === "AUDIO" ||
      target.tagName === "A" ||
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.tagName === "OPTION" ||
      target.tagName === "LABEL"
    ) {
      return true;
    }

    return !!target.closest(
      "a, button, input, textarea, select, option, label, [data-clickable='true'], [role='button'], [contenteditable='true']"
    );
  };

  // Double click handlers para mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasActions || props.isEditing) return;

    const target = e.target as HTMLElement;
    if (isInteractiveTouchTarget(target)) {
      return;
    }

    const touch = e.touches[0];
    if (touch) {
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // Se mover mais de 10px, reseta o contador de cliques
    if (deltaX > 10 || deltaY > 10) {
      clickCount.current = 0;
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasActions || props.isEditing) return;

    const target = e.target as HTMLElement;
    if (isInteractiveTouchTarget(target)) {
      return;
    }

    // Previne comportamento padrão para evitar conflitos
    e.preventDefault();

    clickCount.current += 1;

    if (clickCount.current === 1) {
      // Primeiro clique - aguarda o segundo
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 400); // 400ms para detectar double click (mais tempo)
    } else if (clickCount.current === 2) {
      // Segundo clique - abre o menu
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      clickCount.current = 0;
      
      // Vibração tátil se disponível
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Pequeno delay para garantir que o modal não feche imediatamente
      setTimeout(() => {
        setShowMobileMenu(true);
      }, 50);
    }
  };

  const handleCopyMessage = () => {
    const textToCopy = props.caption || props.messageContent || "";
    navigator.clipboard.writeText(textToCopy);
    setShowMobileMenu(false);
  };

  const handleMobileReply = () => {
    props.onReply?.();
    setShowMobileMenu(false);
  };

  const handleMobileEdit = () => {
    props.onEdit?.();
    setShowMobileMenu(false);
  };

  const handleMobileDelete = () => {
    props.onDelete?.();
    setShowMobileMenu(false);
  };

  const handleMobileStar = () => {
    props.onToggleStar?.();
    setShowMobileMenu(false);
  };

  const handleMobileForward = () => {
    props.onForward?.();
    setShowMobileMenu(false);
  };

  useEffect(() => {
    return () => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={props.ref}
        className={cn(
          "w-full relative flex flex-col gap-1 group",
          isOwnMessage ? "items-end" : "items-start"
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={cn(
            "flex items-center gap-1 max-w-[85%] md:max-w-[75%]",
            isOwnMessage ? "flex-row" : "flex-row-reverse"
          )}
        >
          {/* Emoji button FORA da bolha - centralizado verticalmente - apenas desktop */}
          {props.onToggleReaction && (
            <div className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
              <ReactionEmojiButton
                onSelect={props.onToggleReaction}
                disabled={!props.onToggleReaction}
                isOwnMessage={isOwnMessage}
              />
            </div>
          )}
          {/* Bolha da mensagem - com MessageActions DENTRO */}
          <div className="relative w-full">
            {/* MessageActions DENTRO da bolha, absolute top-right - apenas desktop */}
            {(canDelete || canEdit || canReply || props.onToggleStar || props.onForward) && (
              <div className="hidden md:block absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <MessageActions
                  messageId={props.messageId!}
                  canDelete={canDelete}
                  canEdit={canEdit}
                  canReply={canReply}
                  onDelete={props.onDelete!}
                  onEdit={props.onEdit}
                  onReply={props.onReply}
                  onForward={props.onForward}
                  isDeleting={props.isDeleting}
                  isEditing={props.isEditing}
                  isStarred={props.isStarred}
                  onToggleStar={props.onToggleStar}
                  isTogglingStarred={props.isTogglingStarred}
                />
              </div>
            )}
            <div
            data-rounded={!props.hiddenAvatar}
            style={props.style}
            className={cn(
              "flex items-start justify-start flex-col gap-0 w-full transition-all",
              showMobileMenu && "scale-95 opacity-80",
              isDeleted
                ? "rounded-xl bg-gray-100 border border-gray-300 text-gray-500"
                : isOwnMessage
                  ? cn(
                      "data-[rounded=false]:rounded-br-xl rounded-l-xl rounded-br-xl border border-gray-200",
                      props.internal
                        ? "bg-[#D3F0FD] text-[#0A0A0A]"
                        : "bg-[#D9FDD3] text-[#0A0A0A]"
                    )
                  : props.messageType !== "sticker"
                    ? "rounded-bl-xl data-[rounded=false]:rounded-bl-xl rounded-r-xl rounded-br-xl bg-white border border-gray-200"
                    : "",
              props.className
            )}
          >
            {props.isWhatsAppGroup && !isOwnMessage && props.senderName && (
              <div className="px-3 pt-1.5 pb-0">
                <span className="text-xs font-semibold text-emerald-700">
                  {props.senderName}
                </span>
              </div>
            )}
            {props.internal && props.conversationType === "external" && (
              <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-0">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 border border-blue-200 font-medium">
                  Nota interna
                </span>
              </div>
            )}
            {props.children}
            {((props.reactions && props.reactions.length > 0) ||
              props.onToggleReaction) && (
              <MessageReactions
                reactions={props.reactions || []}
                currentUserId={props.currentUserId}
                onToggleReaction={props.onToggleReaction || (() => {})}
                isOwnMessage={isOwnMessage}
                disabled={!props.onToggleReaction}
              />
            )}
            <div className="flex items-center justify-between w-full px-3 pb-1.5 pt-1 gap-2">
              {/* Channel Info ou Nome do Remetente */}
              <div className="flex items-center gap-1.5 text-[10px] italic min-w-0">
                {props.channelType && (
                  <>
                    <ChannelIcon
                      size={14}
                      style={{ color: channelConfig.color }}
                      aria-label={`Canal: ${channelConfig.label}`}
                      className="flex-shrink-0"
                    />
                    <span
                      style={{ color: channelConfig.color }}
                      className="font-medium truncate"
                    >
                      {props.channelName || channelConfig.label}
                    </span>
                  </>
                )}
                {/* Para notas internas, sempre mostrar o nome do remetente */}
                {props.internal && props.senderName && (
                  <>
                    {props.channelType && <span className="text-gray-500 flex-shrink-0">-</span>}
                    <span className="text-gray-700 truncate font-semibold">
                      {props.senderName}
                    </span>
                  </>
                )}
                {/* Para mensagens normais, mostrar apenas se for própria */}
                {!props.internal && isOwnMessage && props.senderName && (
                  <>
                    {props.channelType && <span className="text-gray-500 flex-shrink-0">-</span>}
                    <span className="text-gray-500 truncate">
                      {props.senderName}
                    </span>
                  </>
                )}
              </div>

              {/* Timestamp + Status */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {props.isStarred && (
                  <Star className="size-3 fill-amber-400 stroke-amber-400" />
                )}
                {isEdited && (
                  <button
                    onClick={props.onViewHistory}
                    className="!text-[10px] text-gray-400 italic font-normal hover:text-gray-600 hover:underline cursor-pointer transition-colors"
                    title="Clique para ver versão anterior"
                    type="button"
                  >
                    (editada)
                  </button>
                )}
                <span
                  className={cn("!text-[10px] text-gray-500 italic font-normal")}
                >
                  {formatMessageTimestamp(props.createdAt)}
                </span>
                {props.status === "senting" && isOwnMessage && (
                  <Clock7 className="size-4 stroke-[#6A7C67]" />
                )}
                {props.status === "sent" && isOwnMessage && (
                  <Check className="size-4 stroke-[#6A7C67]" />
                )}
                {["delivered", "viewed"].includes(props.status) &&
                  isOwnMessage && (
                    <CheckCheckIcon
                      className={cn(
                        "size-4",
                        props.status === "viewed"
                          ? "stroke-[#007BFC]"
                          : "stroke-[#6A7C67]"
                      )}
                    />
                  )}
                {props.status === "failed" && isOwnMessage && (
                  <AlertCircle className="size-4 stroke-red-500" />
                )}
                {props.error && isOwnMessage && (
                  <AlertCircle className="size-4 stroke-red-500" />
                )}
              </div>
            </div>
            {/* Indicador de mensagem excluída - abaixo do rodapé */}
            {isDeleted && (
              <div className="flex items-center justify-end gap-1 px-3 pb-1.5 border-t border-gray-200 pt-1">
                <Ban className="size-3 text-gray-400" />
                <span className="text-[10px] text-gray-400 italic">
                  Excluída em {formatMessageTimestamp(props.deletedAt!)}
                </span>
              </div>
            )}
            {isEdited && props.isHistoryExpanded && props.originalContent && (
              <div className="mt-1 pt-2 border-t border-gray-200">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 italic">
                    Versão anterior:
                  </span>
                  <span className="text-xs text-gray-500 italic pl-2 border-l-2 border-gray-300">
                    {props.originalContent}
                  </span>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Menu mobile estilo WhatsApp */}
      {showMobileMenu && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={(e) => {
            // Só fecha se clicar no backdrop, não no conteúdo
            if (e.target === e.currentTarget) {
              setShowMobileMenu(false);
            }
          }}
          onTouchEnd={(e) => {
            // Previne fechamento acidental no mobile
            if (e.target === e.currentTarget) {
              setShowMobileMenu(false);
            }
          }}
        >
          <div
            className="bg-[#1F2C33] rounded-2xl w-[280px] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Barra de reações rápidas */}
            {props.onToggleReaction && (
              <div className="flex items-center justify-around px-4 py-3 border-b border-gray-700">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      props.onToggleReaction?.(emoji);
                      setShowMobileMenu(false);
                    }}
                    className="text-2xl hover:scale-125 transition-transform active:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Opções de ação */}
            <div className="py-2">
              {canReply && (
                <button
                  onClick={handleMobileReply}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <Reply className="size-5" />
                  <span className="text-sm">Responder</span>
                </button>
              )}
              
              {props.onForward && !isDeleted && (
                <button
                  onClick={handleMobileForward}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <i className="tabler-arrow-forward size-5" />
                  <span className="text-sm">Encaminhar</span>
                </button>
              )}
              
              {(props.messageContent || props.caption) && (
                <button
                  onClick={handleCopyMessage}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <Copy className="size-5" />
                  <span className="text-sm">Copiar</span>
                </button>
              )}

              {props.onToggleStar && (
                <button
                  onClick={handleMobileStar}
                  disabled={props.isTogglingStarred}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-50"
                >
                  <Star className={cn("size-5", props.isStarred && "fill-amber-400 stroke-amber-400")} />
                  <span className="text-sm">
                    {props.isStarred ? "Remover favorito" : "Favoritar"}
                  </span>
                </button>
              )}

              {canEdit && (
                <button
                  onClick={handleMobileEdit}
                  disabled={props.isEditing}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-50"
                >
                  <Pencil className="size-5" />
                  <span className="text-sm">
                    {props.isEditing ? "Editando..." : "Editar"}
                  </span>
                </button>
              )}

              {canDelete && (
                <button
                  onClick={handleMobileDelete}
                  disabled={props.isDeleting}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="size-5" />
                  <span className="text-sm">
                    {props.isDeleting ? "Apagando..." : "Apagar"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
