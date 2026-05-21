import React, { useRef, useEffect, useCallback } from "react";
import { MessageContainer } from "./message-container";
import { QuotedMessagePreview } from "./quoted-message-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Check, X, FileText } from "lucide-react";

type MessageWithError = Message.Raw & { error?: boolean };

function TemplateBadge({ templateName }: { templateName: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 mb-1 bg-emerald-50 border-l-4 border-emerald-500 rounded-r">
      <FileText className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      <span className="text-xs font-medium text-emerald-700 truncate">
        Template: {templateName}
      </span>
    </div>
  );
}

type Props = {
  message: MessageWithError;
  hiddenAvatar?: boolean;
  channelType?: Channel.Type;
  channelName?: string;
  isWhatsAppGroup?: boolean;
  currentUserId?: string;
  conversationType?: string;
  conversationStatus?: string | null;
  isAdmin?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  isDeleting?: boolean;
  isEditing?: boolean;
  editContent?: string;
  onEditChange?: (content: string) => void;
  onEditConfirm?: () => void;
  onEditCancel?: () => void;
  isEditPending?: boolean;
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

export const TextBubble: React.FC<Props> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (props.isEditing) {
      const timeoutId = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length
          );
          autoResizeTextarea();
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [props.isEditing, autoResizeTextarea]);

  useEffect(() => {
    if (props.isEditing) {
      autoResizeTextarea();
    }
  }, [props.editContent, props.isEditing, autoResizeTextarea]);

  const containerProps = {
    createdAt: props.message.createdAt,
    hiddenAvatar: props.hiddenAvatar,
    senderType: props.message.sender?.type,
    status: props.message.status,
    error: props.message.error,
    internal: props.message.internal,
    senderName: props.message.sender.name,
    senderId: props.message.sender.id,
    channelType: props.channelType,
    channelName: props.channelName,
    isWhatsAppGroup: props.isWhatsAppGroup,
    currentUserId: props.currentUserId,
    conversationType: props.conversationType,
    conversationStatus: props.conversationStatus,
    isAdmin: props.isAdmin,
    messageId: props.message.id,
    messageContent: props.message.content,
    messageType: props.message.type,
    deletedAt: props.message.deletedAt,
    editedAt: props.message.editedAt,
    onDelete: props.onDelete,
    onEdit: props.onEdit,
    onReply: props.onReply,
    onForward: props.onForward,
    isDeleting: props.isDeleting,
    isEditing: props.isEditing,
    originalContent: props.originalContent,
    onViewHistory: props.onViewHistory,
    isHistoryExpanded: props.isHistoryExpanded,
    isStarred: props.isStarred,
    onToggleStar: props.onToggleStar,
    isTogglingStarred: props.isTogglingStarred,
    reactions: props.reactions,
    onToggleReaction: props.onToggleReaction,
  };

  if (props.isEditing) {
    return (
      <MessageContainer {...containerProps}>
        <div className="w-full min-w-[250px] px-3 py-2">
          <textarea
            ref={textareaRef}
            className="w-full min-h-[60px] max-h-[300px] p-2 text-sm border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white overflow-y-auto"
            value={props.editContent}
            onChange={(e) => {
              props.onEditChange?.(e.target.value);
              autoResizeTextarea();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                props.onEditConfirm?.();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                props.onEditCancel?.();
              }
            }}
            disabled={props.isEditPending}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={props.onEditCancel}
              disabled={props.isEditPending}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            >
              <X className="size-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={props.onEditConfirm}
              disabled={props.isEditPending || !props.editContent?.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-primary hover:bg-primary/90 rounded transition-colors disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {props.isEditPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </MessageContainer>
    );
  }

  const quotedMessageId = props.quotedMessageId ?? null;
  const messagesMap = props.messages;
  const hasQuote = quotedMessageId && messagesMap;
  const isTemplate = props.message.type === "template" && props.message.templateName;

  // Processar o conteúdo para preservar espaços e quebras de linha + markdown estilo WhatsApp
  const processContent = (content: string) => {
    let processed = content;
    
    // Escapar HTML para segurança
    processed = processed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Processar markdown estilo WhatsApp (ordem importa!)
    
    // 1. Monoespaçado ```texto```
    processed = processed.replace(/```([^`]+)```/g, '<code class="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">$1</code>');
    
    // 2. Código inline `texto`
    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>');
    
    // 3. Negrito *texto*
    processed = processed.replace(/\*([^*\n]+)\*/g, '<strong class="font-bold">$1</strong>');
    
    // 4. Itálico _texto_
    processed = processed.replace(/_([^_\n]+)_/g, '<em class="italic">$1</em>');
    
    // 5. Tachado ~texto~
    processed = processed.replace(/~([^~\n]+)~/g, '<del class="line-through">$1</del>');
    
    // 6. Links [texto](url) - markdown padrão
    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" data-clickable="true" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
    );
    
    // 7. URLs automáticas (http, https, www)
    // Detecta URLs que não estão dentro de tags HTML ou markdown
    processed = processed.replace(
      /(?<!href="|href='|src="|src='|<code[^>]*>)(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,
      (match) => {
        const url = match.startsWith('www.') ? `https://${match}` : match;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" data-clickable="true" class="text-blue-600 hover:text-blue-800 underline break-all">${match}</a>`;
      }
    );
    
    // 8. Citação > texto (no início da linha)
    processed = processed.replace(/^&gt;\s*(.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-3 italic text-gray-600">$1</blockquote>');
    
    // 9. Lista com marcas (* ou -)
    processed = processed.replace(/^[*-]\s+(.+)$/gm, '<li class="ml-4">$1</li>');
    
    // 10. Lista numerada
    processed = processed.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
    
    // 11. Substituir múltiplos espaços por &nbsp; para preservá-los
    processed = processed.replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length));
    
    // 12. Substituir quebras de linha por <br />
    processed = processed.replace(/\n/g, '<br />');
    
    return processed;
  };

  return (
    <MessageContainer {...containerProps}>
      {hasQuote && (
        <QuotedMessagePreview
          quotedMessageId={quotedMessageId}
          messages={messagesMap}
          conversationId={props.conversationId}
        />
      )}
      {isTemplate && props.message.templateName && (
        <TemplateBadge templateName={props.message.templateName} />
      )}
      <div
        className={`text-sm font-normal pr-6 pl-3 pb-1 ${hasQuote || isTemplate ? 'pt-1' : 'pt-2'} break-words overflow-wrap-anywhere`}
        dangerouslySetInnerHTML={{ __html: processContent(props.message.content) }}
      />
    </MessageContainer>
  );
};
